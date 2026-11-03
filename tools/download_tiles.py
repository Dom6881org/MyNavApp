#!/usr/bin/env python3
"""
download_tiles.py — Prépare le cache de tuiles offline pour MyNavApp.

Télécharge les tuiles OpenStreetMap (fond de carte) et OpenSeaMap (seamarks)
d'une zone géographique donnée, au format z/x/y.png servi par le backend
(route /api/tiles/{layer}/{z}/{x}/{y}.png, dossier tiles/).

Exemple ad hoc (zone côtière Bretagne sud, zooms 8 à 16) :
    python tools/download_tiles.py --bbox 47.0,-5.0,48.2,-2.5 --zooms 8-16

Zones de navigation (mode --zones, recommandé) : chaque zone du fichier JSON
définit une bbox et des zooms PAR COUCHE, ce qui permet de couvrir une grande
zone aux zooms bas et de réserver les zooms élevés à de petites bbox (ports) :
    python tools/download_tiles.py --zones config/tile_zones.json

Rafraîchissement quotidien (Planificateur de tâches / cron) :
    python tools/download_tiles.py --zones config/tile_zones.json \
        --once-a-day --refresh-days 30 --max-minutes 45
  - --once-a-day    : exit 0 silencieux si déjà exécuté aujourd'hui (--force
                     pour ignorer le marqueur) ;
  - --refresh-days N: re-télécharge uniquement les tuiles plus vieilles que N
                     jours (les autres sont ignorées sans requête réseau) ;
  - --max-minutes N : plafond de durée, arrêt propre — le run suivant reprend
                     là où il s'est arrêté (les tuiles déjà posées sont skippées) ;
  - hors ligne      : détection au démarrage, exit 0 silencieux (aucune erreur
                     dans le Planificateur de tâches).

Notes :
  - Restez raisonnable : zone et zooms limités à votre zone de navigation.
    Le nombre de tuiles explose avec le zoom (x4 par niveau) : une grande bbox
    complète au-delà de z13 se compte en millions de tuiles — préférez des
    petites bbox de ports pour z14+.
  - OpenSeaMap renvoie 404 pour les zones sans marques ; c'est normal (tuile
    non sauvegardée, la couche s'affiche vide à cet endroit).
  - La politique d'usage d'OpenStreetMap demande un User-Agent identifié et
    un débit modéré ; le délai --delay par défaut y contribue.
"""

import argparse
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta

LAYERS = {
    "osm": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "seamark": "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png",
}
SUBDOMAINS = ("a", "b", "c")
USER_AGENT = "MyNavApp tile downloader (personal offline navigation use)"
ONLINE_PROBE_URL = "https://www.openstreetmap.org/copyright"
MARKER_FILENAME = ".last-tile-update"


# ---------------------------------------------------------------------------
# Géométrie / énumération
# ---------------------------------------------------------------------------

def lonlat_to_tile(lat: float, lon: float, zoom: int) -> tuple[int, int]:
    lat_rad = math.radians(lat)
    n = 2 ** zoom
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return min(max(x, 0), n - 1), min(max(y, 0), n - 1)


def zoom_range(spec: str) -> range:
    if "-" in spec:
        low, high = spec.split("-", 1)
        return range(int(low), int(high) + 1)
    value = int(spec)
    return range(value, value + 1)


def enumerate_tiles(
    min_lat: float, min_lon: float, max_lat: float, max_lon: float,
    zooms: range, layers: list[str],
) -> list[tuple[str, int, int, int]]:
    """Liste les (couche, z, x, y) couvrant la bbox aux zooms donnés."""
    tiles: list[tuple[str, int, int, int]] = []
    for zoom in zooms:
        x_min, y_min = lonlat_to_tile(max_lat, min_lon, zoom)
        x_max, y_max = lonlat_to_tile(min_lat, max_lon, zoom)
        for x in range(min(x_min, x_max), max(x_min, x_max) + 1):
            for y in range(min(y_min, y_max), max(y_min, y_max) + 1):
                for layer in layers:
                    tiles.append((layer, zoom, x, y))
    return tiles


# ---------------------------------------------------------------------------
# Zones de navigation (--zones)
# ---------------------------------------------------------------------------

def load_zones(path: str) -> list[dict]:
    """Charge et valide un fichier de zones JSON.

    Format attendu : [{"name": str, "bbox": [minlat, minlon, maxlat, maxlon],
    "zooms": {"osm": "8-12", "seamark": "12-13"}}]
    """
    with open(path, "r", encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, list) or not data:
        raise ValueError("Le fichier de zones doit être une liste non vide.")
    zones: list[dict] = []
    for index, entry in enumerate(data):
        if not isinstance(entry, dict):
            raise ValueError(f"Zone {index} : objet attendu.")
        name = entry.get("name")
        bbox = entry.get("bbox")
        zooms = entry.get("zooms")
        if not name or not isinstance(name, str):
            raise ValueError(f"Zone {index} : 'name' (chaîne) requis.")
        try:
            min_lat, min_lon, max_lat, max_lon = (float(value) for value in bbox)
        except (TypeError, ValueError):
            raise ValueError(f"Zone {name} : 'bbox' = [minlat, minlon, maxlat, maxlon] requis.")
        if not isinstance(zooms, dict) or not zooms:
            raise ValueError(f"Zone {name} : 'zooms' par couche requis (ex. {{\"osm\": \"8-12\"}}).")
        parsed_zooms: dict[str, range] = {}
        for layer, spec in zooms.items():
            if layer not in LAYERS:
                raise ValueError(f"Zone {name} : couche inconnue '{layer}' (valides : {', '.join(LAYERS)}).")
            if not isinstance(spec, (str, int)):
                raise ValueError(f"Zone {name} : zooms de '{layer}' invalides (ex. \"8-12\" ou 12).")
            try:
                parsed_zooms[layer] = zoom_range(str(spec))
            except ValueError:
                raise ValueError(f"Zone {name} : zooms de '{layer}' invalides (ex. \"8-12\" ou 12).")
        zones.append({
            "name": name,
            "bbox": (min(min_lat, max_lat), min(min_lon, max_lon), max(min_lat, max_lat), max(min_lon, max_lon)),
            "zooms": parsed_zooms,
        })
    return zones


def zone_tile_count(zone: dict) -> int:
    """Nombre de tuiles d'une zone (toutes couches et zooms confondus)."""
    min_lat, min_lon, max_lat, max_lon = zone["bbox"]
    total = 0
    for layer, zooms in zone["zooms"].items():
        total += len(enumerate_tiles(min_lat, min_lon, max_lat, max_lon, zooms, [layer]))
    return total


# ---------------------------------------------------------------------------
# Rafraîchissement (mtime) et garde-fous quotidiens
# ---------------------------------------------------------------------------

def tile_is_recent(target: str, refresh_days: int | None) -> bool:
    """True si la tuile existante peut être ignorée (assez récente).

    refresh_days None = comportement historique : toute tuile présente est
    ignorée. Sinon, une tuile est récente si son mtime a moins de N jours.
    """
    if not os.path.isfile(target):
        return False
    if refresh_days is None:
        return True
    age_days = (time.time() - os.path.getmtime(target)) / 86400.0
    return age_days < float(refresh_days)


def marker_path(out: str) -> str:
    return os.path.join(out, MARKER_FILENAME)


def already_ran_today(out: str) -> bool:
    try:
        with open(marker_path(out), "r", encoding="utf-8") as file:
            return file.read().strip() == date.today().isoformat()
    except OSError:
        return False


def mark_ran_today(out: str) -> None:
    os.makedirs(out, exist_ok=True)
    with open(marker_path(out), "w", encoding="utf-8") as file:
        file.write(date.today().isoformat())


def is_online(timeout: float = 5.0) -> bool:
    """Sonde légère : le serveur de tuiles est-il joignable ?"""
    try:
        request = urllib.request.Request(ONLINE_PROBE_URL, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError):
        return False


# ---------------------------------------------------------------------------
# Téléchargement
# ---------------------------------------------------------------------------

def download_tiles(
    tiles: list[tuple[str, int, int, int]],
    out: str,
    delay: float,
    refresh_days: int | None = None,
    max_minutes: float | None = None,
    log_every: int = 200,
    verbose: bool = True,
) -> dict[str, int]:
    """Télécharge les tuiles dans out/ et renvoie les compteurs.

    Les tuiles existantes et assez récentes sont skippées sans requête réseau ;
    une 404 (pas de donnée, ex. pleine mer en seamark) compte comme 'absent'
    et n'est pas sauvegardée (la couche s'affiche vide à cet endroit).
    """
    started = time.monotonic()
    downloaded = refreshed = skipped = absent = failed = 0
    for index, (layer, zoom, x, y) in enumerate(tiles, start=1):
        target = os.path.join(out, layer, str(zoom), str(x), f"{y}.png")
        if os.path.isfile(target):
            if tile_is_recent(target, refresh_days):
                skipped += 1
                continue
            # tuile ancienne : re-téléchargée (rafraîchissement)
            mode = "refresh"
        else:
            mode = "new"
        url = LAYERS[layer].format(
            s=SUBDOMAINS[index % len(SUBDOMAINS)], z=zoom, x=x, y=y
        )
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = response.read()
        except urllib.error.HTTPError as error:
            if error.code == 404:
                absent += 1  # pas de donnée à cet endroit (normal en pleine eau)
            else:
                failed += 1
                if verbose:
                    print(f"HTTP {error.code} : {url}")
        except OSError as error:
            failed += 1
            if verbose:
                print(f"Erreur : {url} ({error})")
        else:
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with open(target, "wb") as file:
                file.write(body)
            if mode == "new":
                downloaded += 1
            else:
                refreshed += 1
        finally:
            if verbose and index % log_every == 0:
                print(
                    f"{index}/{len(tiles)} — {downloaded} téléchargées, "
                    f"{refreshed} rafraîchies, {skipped} ignorées, "
                    f"{absent} absentes, {failed} erreurs"
                )
            if delay:
                time.sleep(delay)
        if max_minutes is not None:
            elapsed = (time.monotonic() - started) / 60.0
            if elapsed >= max_minutes:
                if verbose:
                    print(
                        f"Plafond de durée atteint ({max_minutes} min) à "
                        f"{index}/{len(tiles)} — reprise au prochain run."
                    )
                return {
                    "downloaded": downloaded, "refreshed": refreshed,
                    "skipped": skipped, "absent": absent, "failed": failed,
                    "capped": index,
                }
    return {
        "downloaded": downloaded, "refreshed": refreshed,
        "skipped": skipped, "absent": absent, "failed": failed,
        "capped": 0,
    }


def _count_suffix(counts: dict[str, int]) -> str:
    parts = []
    if counts["downloaded"]:
        parts.append(f"{counts['downloaded']} téléchargées")
    if counts["refreshed"]:
        parts.append(f"{counts['refreshed']} rafraîchies")
    if counts["skipped"]:
        parts.append(f"{counts['skipped']} déjà en cache")
    if counts["absent"]:
        parts.append(f"{counts['absent']} absentes (pleine mer)")
    if counts["failed"]:
        parts.append(f"{counts['failed']} erreurs")
    return ", ".join(parts) if parts else "rien à faire"


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sources = parser.add_mutually_exclusive_group(required=True)
    sources.add_argument("--bbox", help="minlat,minlon,maxlat,maxlon (ex: 47.0,-5.0,48.2,-2.5)")
    sources.add_argument("--zones", help="fichier JSON de zones de navigation (ex: config/tile_zones.json)")
    parser.add_argument("--zooms", default="8-16", help="zooms en mode --bbox, ex: 8-16 ou 12 (défaut : 8-16)")
    parser.add_argument("--layers", default="osm,seamark", help="couches en mode --bbox (défaut : osm,seamark)")
    parser.add_argument("--out", default="tiles", help="dossier de sortie (défaut : tiles)")
    parser.add_argument("--delay", type=float, default=0.15, help="délai entre requêtes en secondes (défaut : 0.15)")
    parser.add_argument("--refresh-days", type=int, default=None,
                         help="re-télécharger les tuiles plus vieilles que N jours (sinon: toute tuile présente est ignorée)")
    parser.add_argument("--max-minutes", type=float, default=None,
                         help="plafond de durée en minutes — arrêt propre, reprise au run suivant")
    parser.add_argument("--once-a-day", action="store_true",
                         help="exécuter une seule fois par jour (marqueur dans --out ; exit 0 si déjà fait)")
    parser.add_argument("--force", action="store_true", help="ignorer le marqueur quotidien")
    parser.add_argument("--dry-run", action="store_true", help="compter les tuiles par zone sans rien télécharger")
    parser.add_argument("--skip-online-check", action="store_true", help="ne pas vérifier la connexion au démarrage")
    args = parser.parse_args()

    if args.once_a_day and not args.force and already_ran_today(args.out):
        print(f"Tuiles déjà mises à jour aujourd'hui ({marker_path(args.out)}).")
        return 0
    if not args.skip_online_check and not is_online():
        print("Hors ligne — cache de tuiles inchangé.")
        return 0

    # Groupes de téléchargement : en mode zones, chaque zone a ses zooms PAR
    # COUCHE (l'énumération est faite couche par couche) ; en mode bbox, une
    # seule entrée avec --zooms/--layers.
    if args.zones:
        try:
            zones = load_zones(args.zones)
        except (OSError, ValueError) as error:
            print(f"Zones invalides : {error}")
            return 2
        groups = []
        for zone in zones:
            zone_tiles: list[tuple[str, int, int, int]] = []
            for layer, layer_zooms in zone["zooms"].items():
                zone_tiles.extend(enumerate_tiles(*zone["bbox"], layer_zooms, [layer]))
            groups.append((zone["name"], zone_tiles))
    else:
        try:
            min_lat, min_lon, max_lat, max_lon = (float(value) for value in args.bbox.split(","))
        except ValueError:
            parser.error("--bbox doit contenir 4 nombres : minlat,minlon,maxlat,maxlon")
            return 2
        layers = [layer.strip() for layer in args.layers.split(",") if layer.strip() in LAYERS]
        if not layers:
            parser.error(f"couche inconnue ; valides : {', '.join(LAYERS)}")
            return 2
        zooms = zoom_range(args.zooms)
        groups = [
            (
                "bbox",
                enumerate_tiles(min(min_lat, max_lat), min(min_lon, max_lon),
                                max(min_lat, max_lat), max(min_lon, max_lon),
                                zooms, layers),
            )
        ]

    total = sum(len(tiles) for _, tiles in groups)
    if args.zones:
        for zone in zones:
            zooms_desc = ", ".join(
                f"{layer} {z.start}-{z.stop - 1}" for layer, z in zone["zooms"].items()
            )
            count = zone_tile_count(zone)
            print(f"Zone {zone['name']} : {count} tuiles ({zooms_desc})")
    print(f"Total : {total} tuiles à vérifier")

    if args.dry_run:
        print("Dry-run : rien téléchargé.")
        return 0

    summary = {"downloaded": 0, "refreshed": 0, "skipped": 0, "absent": 0, "failed": 0, "capped": 0}
    for name, tiles in groups:
        if total > len(tiles):
            print(f"--- {name}")
        counts = download_tiles(
            tiles, out=args.out, delay=args.delay,
            refresh_days=args.refresh_days, max_minutes=args.max_minutes,
        )
        for key in summary:
            summary[key] += counts[key]
        print(f"{name} : {_count_suffix(counts)}")
        if counts["capped"]:
            break

    if summary["capped"]:
        print(f"Arrêt au plafond de durée — {summary['capped']} tuiles traitées, reprise au prochain run.")
    print(f"Récap : {_count_suffix(summary)}")
    if summary["downloaded"] or summary["refreshed"] or summary["skipped"]:
        print(f"Cache : {os.path.abspath(args.out)} — démarrage : python -m server.app")
    if args.once_a_day:
        mark_ran_today(args.out)
    return 0 if summary["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
