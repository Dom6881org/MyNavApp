#!/usr/bin/env python3
"""
download_tiles.py — Prépare le cache de tuiles offline pour MyNavApp.

Télécharge les tuiles OpenStreetMap (fond de carte) et OpenSeaMap (seamarks)
d'une zone géographique donnée, au format z/x/y.png servi par le backend
(route /api/tiles/{layer}/{z}/{x}/{y}.png, dossier tiles/).

Exemple (zone côtière Bretagne sud, zooms 8 à 16) :
    python tools/download_tiles.py --bbox 47.0,-5.0,48.2,-2.5 --zooms 8-16

Notes :
  - Restez raisonnable : zone et zooms limités à votre zone de navigation.
    OpenSeaMap renvoie 404 pour les zones sans marques ; c'est normal (tuile
    non sauvegardée, la couche s'affiche vide à cet endroit).
  - La politique d'usage d'OpenStreetMap demande un User-Agent identifié et
    un débit modéré ; le délai --delay par défaut y contribue.
"""

import argparse
import math
import os
import sys
import time
import urllib.request
import urllib.error

LAYERS = {
    "osm": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "seamark": "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png",
}
SUBDOMAINS = ("a", "b", "c")
USER_AGENT = "MyNavApp tile downloader (personal offline navigation use)"


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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--bbox", required=True, help="minlat,minlon,maxlat,maxlon (ex: 47.0,-5.0,48.2,-2.5)")
    parser.add_argument("--zooms", default="8-16", help="zooms, ex: 8-16 ou 12 (défaut : 8-16)")
    parser.add_argument("--layers", default="osm,seamark", help="couches à télécharger (défaut : osm,seamark)")
    parser.add_argument("--out", default="tiles", help="dossier de sortie (défaut : tiles)")
    parser.add_argument("--delay", type=float, default=0.15, help="délai entre requêtes en secondes (défaut : 0.15)")
    args = parser.parse_args()

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
    if min_lat > max_lat:
        min_lat, max_lat = max_lat, min_lat
    if min_lon > max_lon:
        min_lon, max_lon = max_lon, min_lon

    tiles: list[tuple[str, int, int, int]] = []
    for zoom in zooms:
        x_min, y_min = lonlat_to_tile(min_lat, min_lon, zoom)
        x_max, y_max = lonlat_to_tile(max_lat, max_lon, zoom)
        for x in range(min(x_min, x_max), max(x_min, x_max) + 1):
            for y in range(min(y_min, y_max), max(y_min, y_max) + 1):
                for layer in layers:
                    tiles.append((layer, zoom, x, y))

    print(f"{len(tiles)} tuiles à vérifier ({', '.join(layers)}, zooms {zooms.start}-{zooms.stop - 1})")
    if tiles:
        sample_layer, sample_z, _, _ = tiles[0]
        print(f"Exemple : {LAYERS[sample_layer].format(s=SUBDOMAINS[0], z=sample_z, x=tiles[0][2], y=tiles[0][3])}")

    downloaded = skipped = failed = 0
    for index, (layer, zoom, x, y) in enumerate(tiles, start=1):
        directory = os.path.join(args.out, layer, str(zoom), str(x))
        target = os.path.join(directory, f"{y}.png")
        if os.path.isfile(target):
            skipped += 1
            continue

        url = LAYERS[layer].format(s=SUBDOMAINS[index % len(SUBDOMAINS)], z=zoom, x=x, y=y)
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = response.read()
        except urllib.error.HTTPError as error:
            if error.code == 404:
                skipped += 1  # pas de donnée à cet endroit (normal en pleine eau pour les seamarks)
            else:
                failed += 1
                print(f"HTTP {error.code} : {url}")
        except OSError as error:
            failed += 1
            print(f"Erreur : {url} ({error})")
        else:
            os.makedirs(directory, exist_ok=True)
            with open(target, "wb") as file:
                file.write(body)
            downloaded += 1
        finally:
            if index % 200 == 0:
                print(f"{index}/{len(tiles)} — {downloaded} téléchargées, {skipped} absentes, {failed} erreurs")
            time.sleep(args.delay)

    print(f"Terminé : {downloaded} tuiles téléchargées, {skipped} absentes/ignorées, {failed} erreurs.")
    print(f"Cache : {os.path.abspath(args.out)} — démarrage : python -m server.app")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
