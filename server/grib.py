"""Champ de vent GRIB : téléchargement à terre, cache local, usage offline (issue #16).

download_grib() échantillonne Open-Météo (source open data déjà utilisée par
l'app) sur une grille régulière lat/lon pour une zone + horizon donnés, puis
écrit un fichier GRIB2 standard (u10/v10 en m/s, pas de temps = temps valide)
directement lisible par mynav_routing.GRIBWindField.from_grib().

Offline-first : le fichier est mis en cache avec sa date de validité ; quand
il est expiré ou absent, le routage retombe sur le vent constant (dérgradé).
"""

from __future__ import annotations

import json
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

def _register_eccodes_library() -> bool:
    """Localise la bibliothèque native ecCodes et l'ajoute au chemin de chargement.

    Sans conda sur Windows : le paquet ecCodes de conda-forge extrait dans
    ~/eccodes-win (ou tout dossier pointé par MYNAV_ECCODES_BIN, ou
    <repo>/eccodes-win) fournit Library/bin/eccodes.dll et ses dépendances.
    Retourne True si un dossier contenant la bibliothèque a été enregistré.
    """
    import glob

    lib_name = "eccodes.dll" if os.name == "nt" else "libeccodes.so"
    candidates: list[str] = []
    env_bin = os.environ.get("MYNAV_ECCODES_BIN")
    if env_bin:
        candidates.append(env_bin)
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
    candidates.append(os.path.join(repo_root, "eccodes-win", "root", "Library", "bin"))
    candidates.extend(glob.glob(os.path.join(os.path.expanduser("~"), "eccodes-win*", "root", "Library", "bin")))
    for directory in candidates:
        if os.path.isfile(os.path.join(directory, lib_name)):
            if os.name == "nt":
                try:
                    os.add_dll_directory(directory)
                except (AttributeError, OSError):
                    pass
            os.environ["PATH"] = directory + os.pathsep + os.environ.get("PATH", "")
            return True
    return False


def _import_eccodes() -> bool:
    """Importe eccodes (global du module) en enregistrant d'abord la bibliothèque
    native si l'import direct échoue (Windows sans conda, DLL hors du PATH)."""
    try:
        import eccodes as eccodes_module

        globals()["eccodes"] = eccodes_module
        return True
    except Exception:
        pass
    if not _register_eccodes_library():
        return False
    import sys

    for module in [m for m in sys.modules if m.split(".")[0] in ("eccodes", "gribapi")]:
        del sys.modules[module]
    try:
        import eccodes as eccodes_module

        globals()["eccodes"] = eccodes_module
        return True
    except Exception:
        return False


ECCODES_AVAILABLE = _import_eccodes()

GRIB_CACHE_DIR = os.path.join(os.path.dirname(__file__), os.pardir, "cache", "grib")
GRIB_FILE = "latest.grib2"
GRIB_META = "latest.json"

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
DEFAULT_RESOLUTION_DEG = 0.5
DEFAULT_STEP_H = 3.0
MAX_HORIZON_H = 96.0
MAX_POINTS = 400
HTTP_TIMEOUT_S = 30.0
MS_TO_KNOTS = 1.94384


class GribError(Exception):
    """Erreur de téléchargement/écriture GRIB avec un message clair."""


def wind_components(speed_ms: float, direction_from_deg: float) -> tuple[float, float]:
    """Composantes (u, v) en m/s du VECTEUR de déplacement du vent.

    Open-Météo donne la direction D'OÙ vient le vent (convention météo) ;
    le GRIB u10/v10 et GRIBWindField attendent le vecteur de déplacement.
    """
    radians = math.radians(direction_from_deg)
    return -speed_ms * math.sin(radians), -speed_ms * math.cos(radians)


def grid_points(south: float, north: float, west: float, east: float, resolution: float) -> tuple[list[float], list[float]]:
    """Latitudes (nord->sud) et longitudes (ouest->est) de la grille régulière."""
    count_lat = int(round((north - south) / resolution)) + 1
    count_lon = int(round((east - west) / resolution)) + 1
    lats = [round(north - i * resolution, 4) for i in range(count_lat)]
    lons = [round(west + j * resolution, 4) for j in range(count_lon)]
    return lats, lons


def _fetch_open_meteo(lats: list[float], lons: list[float], horizon_h: float,
                      opener: Callable[[str], Any] | None = None) -> tuple[list[datetime], list[list[list[float]]], list[list[list[float]]]]:
    """Interroge Open-Météo pour tous les points de la grille.

    Retourne (times, u_ms, v_ms) : u_ms[t][j][i] composante est du vent (m/s).
    opener injectable pour les tests.
    """
    # Open-Météo apparie latitude et longitude élément par élément (pas de
    # produit cartésien) et refuse la requête (HTTP 400) si les deux listes
    # n'ont pas la même longueur : on aplatit donc la grille, point p = j*n_lon+i.
    n_lon = len(lons)
    params = urllib.parse.urlencode({
        "latitude": ",".join(str(lat) for lat in lats for _ in range(n_lon)),
        "longitude": ",".join(str(lon) for _ in lats for lon in lons),
        "hourly": "wind_speed_10m,wind_direction_10m",
        "wind_speed_unit": "ms",
        "timezone": "UTC",
        "forecast_days": str(max(1, math.ceil(horizon_h / 24.0) + 1)),
    })
    url = OPEN_METEO_URL + "?" + params
    try:
        open_url = opener or (lambda target: urllib.request.urlopen(target, timeout=HTTP_TIMEOUT_S))
        with open_url(url) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        # Le corps de l'erreur Open-Météo contient la raison exacte (ex. listes
        # latitude/longitude de longueurs différentes) : on la relaie telle quelle.
        detail = ""
        try:
            body = error.read().decode("utf-8", "replace")
            reason = json.loads(body).get("reason")
            detail = str(reason) if reason else body[:200]
        except (OSError, ValueError, AttributeError):
            detail = str(error)
        raise GribError(
            f"Téléchargement Open-Météo refusé (HTTP {error.code}) : {detail}"
        ) from error
    except (OSError, ValueError) as error:
        raise GribError(
            "Téléchargement Open-Météo impossible : vérifiez la connexion internet. " f"({error})"
        ) from error

    forecasts = payload if isinstance(payload, list) else [payload]
    if len(forecasts) != len(lats) * len(lons):
        raise GribError("Réponse Open-Météo incohérente : nombre de points inattendu.")
    times: list[datetime] | None = None
    speeds: list[list[list[float]]] = []
    directions: list[list[list[float]]] = []
    for j, lat in enumerate(lats):
        for i, lon in enumerate(lons):
            entry = forecasts[j * len(lons) + i]
            hourly = (entry or {}).get("hourly") or {}
            if "time" not in hourly or "wind_speed_10m" not in hourly or "wind_direction_10m" not in hourly:
                raise GribError("Réponse Open-Météo incomplète : hourly manquant.")
            iso_times = hourly["time"]
            if times is None:
                times = [datetime.fromisoformat(value).replace(tzinfo=timezone.utc) for value in iso_times]
            speeds.append(hourly["wind_speed_10m"])
            directions.append(hourly["wind_direction_10m"])
    if not times:
        raise GribError("Réponse Open-Météo vide.")
    return times, speeds, directions


def _assemble(lats: list[float], lons: list[float], times: list[datetime],
              speeds: list[list[float]], directions: list[list[float]], horizon_h: float,
              step_h: float) -> tuple[list[datetime], list[list[list[float]]], list[list[list[float]]]]:
    """Réduit les pas horaires au pas demandé et assemble u/v par [t][j][i]."""
    n_lon = len(lons)
    step_count = int(step_h * 3600)
    selected: list[datetime] = []
    u_ms: list[list[list[float]]] = []
    v_ms: list[list[list[float]]] = []
    for t_index, moment in enumerate(times):
        offset = (moment - times[0]).total_seconds()
        if offset % step_count != 0 or offset > horizon_h * 3600:
            continue
        grid_u: list[list[float]] = [[0.0] * n_lon for _ in lats]
        grid_v: list[list[float]] = [[0.0] * n_lon for _ in lats]
        for point_index in range(len(lats) * n_lon):
            j, i = divmod(point_index, n_lon)
            u, v = wind_components(float(speeds[point_index][t_index]), float(directions[point_index][t_index]))
            grid_u[j][i] = u
            grid_v[j][i] = v
        selected.append(moment)
        u_ms.append(grid_u)
        v_ms.append(grid_v)
    if not selected:
        raise GribError("Aucun pas de temps disponible pour l'horizon demandé.")
    return selected, u_ms, v_ms


def _write_message(handle, lats: list[float], lons: list[float], moment: datetime,
                   parameter_number: int, values: list[list[float]]) -> None:
    """Écrit un message GRIB2 (u10=2, v10=3) sur grille régulière lat/lon."""
    eccodes.codes_set(handle, "discipline", 0)
    eccodes.codes_set(handle, "parameterCategory", 2)
    eccodes.codes_set(handle, "parameterNumber", parameter_number)
    # 10 mètres au-dessus du sol (heightAboveGround, niveau 103).
    eccodes.codes_set(handle, "typeOfFirstFixedSurface", 103)
    eccodes.codes_set(handle, "scaleFactorOfFirstFixedSurface", 0)
    eccodes.codes_set(handle, "scaledValueOfFirstFixedSurface", 10)
    # Temps de validité du champ (step 0) : le moteur échantillonne sur "time".
    eccodes.codes_set(handle, "dataDate", int(moment.strftime("%Y%m%d")))
    eccodes.codes_set(handle, "dataTime", int(moment.strftime("%H%M")))
    eccodes.codes_set(handle, "forecastTime", 0)
    eccodes.codes_set(handle, "Ni", len(lons))
    eccodes.codes_set(handle, "Nj", len(lats))
    eccodes.codes_set(handle, "latitudeOfFirstGridPointInDegrees", lats[0])
    eccodes.codes_set(handle, "longitudeOfFirstGridPointInDegrees", lons[0])
    eccodes.codes_set(handle, "iDirectionIncrementInDegrees", round(lons[1] - lons[0], 4) if len(lons) > 1 else 0.0)
    eccodes.codes_set(handle, "jDirectionIncrementInDegrees", round(lats[0] - lats[1], 4) if len(lats) > 1 else 0.0)
    eccodes.codes_set(handle, "iScansNegatively", 0)
    eccodes.codes_set(handle, "jScansPositively", 0)
    eccodes.codes_set_values(handle, [value for row in values for value in row])


def write_grib(path: str, lats: list[float], lons: list[float], times: list[datetime],
               u_ms: list[list[list[float]]], v_ms: list[list[list[float]]]) -> None:
    """Écrit le fichier GRIB2 : 2 messages (u10, v10) par pas de temps."""
    if not ECCODES_AVAILABLE:
        raise GribError(
            "La librairie ecCodes n'est pas installée : impossible d'écrire le GRIB. "
            "Installez-la (ex. conda-forge : eccodes) puis relancez."
        )
    with open(path, "wb") as file_handle:
        for index, moment in enumerate(times):
            for parameter_number, values in ((2, u_ms[index]), (3, v_ms[index])):
                handle = eccodes.codes_grib_new_from_samples("regular_ll_sfc_grib2")
                try:
                    _write_message(handle, lats, lons, moment, parameter_number, values)
                    eccodes.codes_write(handle, file_handle)
                finally:
                    eccodes.codes_release(handle)


def download_grib(south: float, north: float, west: float, east: float,
                  horizon_h: float = 72.0, resolution: float = DEFAULT_RESOLUTION_DEG,
                  step_h: float = DEFAULT_STEP_H,
                  opener: Callable[[str], Any] | None = None) -> dict[str, Any]:
    """Télécharge la zone, écrit le GRIB en cache et retourne ses métadonnées."""
    if not -90.0 <= south < north <= 90.0 or not -180.0 <= west < east <= 180.0:
        raise GribError("Zone invalide : latitudes/longitudes min-max incohérentes.")
    if not 1.0 <= horizon_h <= MAX_HORIZON_H:
        raise GribError(f"Horizon invalide : 1 à {MAX_HORIZON_H:.0f} heures attendues.")
    if resolution <= 0:
        raise GribError("Résolution invalide : valeur positive attendue.")

    lats, lons = grid_points(south, north, west, east, resolution)
    if len(lats) * len(lons) > MAX_POINTS:
        raise GribError(
            f"Zone trop fine pour la résolution ({len(lats) * len(lons)} points, max {MAX_POINTS}). "
            "Augmentez la résolution (degrés) ou réduisez la zone."
        )

    times, speeds, directions = _fetch_open_meteo(lats, lons, horizon_h, opener)
    selected, u_ms, v_ms = _assemble(lats, lons, times, speeds, directions, horizon_h, step_h)

    os.makedirs(GRIB_CACHE_DIR, exist_ok=True)
    grib_path = os.path.join(GRIB_CACHE_DIR, GRIB_FILE)
    write_grib(grib_path, lats, lons, selected, u_ms, v_ms)
    _purge_stale_index(grib_path)

    meta = {
        "createdAt": time.time(),
        "validUntil": (selected[-1] + timedelta(hours=step_h)).timestamp(),
        "south": south,
        "north": north,
        "west": west,
        "east": east,
        "resolutionDeg": resolution,
        "stepH": step_h,
        "points": len(lats) * len(lons),
        "steps": len(selected),
        "firstTime": selected[0].isoformat(),
    }
    with open(os.path.join(GRIB_CACHE_DIR, GRIB_META), "w", encoding="utf-8") as meta_file:
        json.dump(meta, meta_file, indent=2)
    return meta


def _purge_stale_index(grib_path: str) -> None:
    """Supprime les index cfgrib (*.idx) du GRIB : s'ils sont plus anciens que le
    fichier réécrit, ecCodes affiche « Ignoring index file ... older than GRIB file »."""
    import glob

    for index_path in glob.glob(grib_path + ".*.idx"):
        try:
            os.unlink(index_path)
        except OSError:
            pass


def status() -> dict[str, Any]:
    """État du cache GRIB : available/fresh + métadonnées (issue #16)."""
    meta_path = os.path.join(GRIB_CACHE_DIR, GRIB_META)
    if not os.path.isfile(meta_path):
        return {"available": False, "fresh": False, "reason": "no-grib"}
    try:
        with open(meta_path, encoding="utf-8") as meta_file:
            meta = json.load(meta_file)
    except (OSError, json.JSONDecodeError):
        return {"available": False, "fresh": False, "reason": "unreadable-meta"}
    if not os.path.isfile(os.path.join(GRIB_CACHE_DIR, GRIB_FILE)):
        return {"available": False, "fresh": False, "reason": "missing-file"}
    fresh = meta.get("validUntil", 0.0) > time.time()
    return {
        "available": True,
        "fresh": fresh,
        "reason": None if fresh else "expired",
        "createdAt": meta.get("createdAt"),
        "validUntil": meta.get("validUntil"),
        "south": meta.get("south"),
        "north": meta.get("north"),
        "west": meta.get("west"),
        "east": meta.get("east"),
        "resolutionDeg": meta.get("resolutionDeg"),
        "stepH": meta.get("stepH"),
        "points": meta.get("points"),
        "steps": meta.get("steps"),
    }


def load_wind_field():
    """Charge le champ de vent GRIB si le cache est frais, sinon None (dérgradé)."""
    current = status()
    if not current.get("fresh"):
        return None
    try:
        from mynav_routing import GRIBWindField
    except ImportError:
        return None
    try:
        return GRIBWindField.from_grib(os.path.join(GRIB_CACHE_DIR, GRIB_FILE))
    except Exception as error:  # GRIB illisible : dérgradé plutôt qu'erreur bloquante
        raise GribError(f"Fichier GRIB en cache illisible : {error}") from error


_wind_field_cache: dict[str, Any] = {"path": None, "mtime": None, "field": None, "bounds": None}


def sample_points(points: list[dict[str, float]]) -> list[dict[str, float]] | None:
    """Échantillonne le GRIB frais aux points demandés (option B, issue #36).

    Retourne None si aucun GRIB frais n'est disponible (le front retombe alors
    sur le lattice Open-Météo) ; sinon une liste {latitude, longitude, speed
    (nœuds), direction (météo « d'où vient le vent », degrés)} pour les points
    couverts par la zone du GRIB (marge d'une maille). Le champ est mis en
    cache en mémoire et rechargé seulement quand le fichier GRIB change.
    """
    current = status()
    if not current.get("fresh"):
        return None
    grib_path = os.path.join(GRIB_CACHE_DIR, GRIB_FILE)
    try:
        mtime = os.path.getmtime(grib_path)
    except OSError:
        return None
    if (
        _wind_field_cache["path"] != grib_path
        or _wind_field_cache["mtime"] != mtime
        or _wind_field_cache["field"] is None
    ):
        try:
            field = load_wind_field()
        except GribError:
            return None
        if field is None:
            return None
        _wind_field_cache.update({"path": grib_path, "mtime": mtime, "field": field, "bounds": current})
    bounds = _wind_field_cache["bounds"] or current
    margin = float(bounds.get("resolutionDeg") or DEFAULT_RESOLUTION_DEG)
    south = float(bounds["south"]) - margin
    north = float(bounds["north"]) + margin
    west = float(bounds["west"]) - margin
    east = float(bounds["east"]) + margin
    covered = [
        point for point in points
        if south <= point["latitude"] <= north and west <= point["longitude"] <= east
    ]
    if not covered:
        return []
    import datetime as _dt

    import numpy as _np

    field = _wind_field_cache["field"]
    times = field.ds["time"].values.astype("datetime64[ns]")
    now = _np.datetime64(_dt.datetime.now(_dt.timezone.utc).replace(tzinfo=None), "ns")
    horizon_s = float((times[-1] - times[0]) / _np.timedelta64(1, "s"))
    elapsed_s = min(max(float((now - times[0]) / _np.timedelta64(1, "s")), 0.0), horizon_s)
    u, v = field.sample([point["latitude"] for point in covered], [point["longitude"] for point in covered], elapsed_s)
    u = _np.atleast_1d(u)
    v = _np.atleast_1d(v)
    wind: list[dict[str, float]] = []
    for index, point in enumerate(covered):
        speed = float(_np.hypot(u[index], v[index]))
        direction = (math.degrees(math.atan2(-float(u[index]), -float(v[index]))) + 360.0) % 360.0
        wind.append({
            "latitude": point["latitude"],
            "longitude": point["longitude"],
            "speed": round(speed, 2),
            "direction": round(direction, 1),
        })
    return wind
