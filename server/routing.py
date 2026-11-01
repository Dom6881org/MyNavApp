"""Routage météo : encapsule le moteur mynav-routing (isochrones, polaires, vent).

compute_route() valide les entrées, charge la polaire du bateau, appelle le
moteur et traduit ses erreurs en messages exploitables par l'interface.
Contrat : départ = position NMEA courante, vent = GRIB téléchargé à terre,
exécution 100 % offline (voir issue #14).
"""

from __future__ import annotations

import os
from typing import Any

try:
    from mynav_routing import route, to_geojson

    ROUTING_AVAILABLE = True
except ImportError:
    # Moteur non installé (ex. CI sans accès au dépôt privé) :
    # les tests de routage sont sautés, le reste de l'app fonctionne.
    ROUTING_AVAILABLE = False

DEFAULT_POLAR_PATH = os.path.join(os.path.dirname(__file__), os.pardir, "config", "polaire-sugar.pol")

# Bathymétrie GEBCO (issue #13) : profondeur minimale acceptée (m) et toggle.
# Fichier local prioritaire via MYNAV_ROUTING_BATHY_FILE, sinon
# MYNAV_ROUTING_BATHY_URL (téléchargé une fois, mis en cache disque).
BATHY_MIN_DEPTH_M = float(os.environ.get("ROUTING_MIN_DEPTH_M", "10"))

_bathy_cache: dict[str, Any] = {}


def load_bathy() -> Any | None:
    """Charge la bathymétrie GEBCO une seule fois par processus.

    Retourne None (contrainte de profondeur désactivée) si aucune bathymétrie
    n'est disponible : le routage reste utilisable, la terre restant gérée par
    le LandMask du moteur. Message d'aide affiché une fois en console.
    """
    if not ROUTING_AVAILABLE:
        return None
    if "mask" in _bathy_cache:
        return _bathy_cache["mask"]
    try:
        from mynav_routing import DepthMask

        _bathy_cache["mask"] = DepthMask.from_open_data()
    except Exception as error:  # BathyDataError, fichier illisible, hors ligne...
        print(
            "Bathymétrie indisponible (" + str(error) + ") ; "
            "routage sans contrainte de profondeur. Pour l'activer : extrait régional "
            "GEBCO (https://download.gebco.net/) + MYNAV_ROUTING_BATHY_FILE dans .env."
        )
        _bathy_cache["mask"] = None
    return _bathy_cache["mask"]

# Rapprochement d'un point à terre vers l'eau la plus proche (masque Natural Earth) :
# un départ GPS côtier peut être classé "terre" par le masque 10 m alors que le
# bateau flotte à quelques centaines de mètres du rivage.
SNAP_MAX_NM = 2.0
SNAP_STEP_NM = 0.1
SNAP_BEARING_STEP_DEG = 5.0
LONG_ROUTE_THRESHOLD_NM = 150.0


class RoutingError(Exception):
    """Erreur de routage avec un message clair pour l'utilisateur."""


def load_polar(path: str | None = None) -> Any:
    """Charge une polaire .pol, avec un message d'erreur exploitable."""
    from mynav_routing import Polar

    resolved = os.path.abspath(path or DEFAULT_POLAR_PATH)
    if not os.path.isfile(resolved):
        raise RoutingError(f"Fichier de polaire introuvable : {resolved}")
    try:
        return Polar.from_file(resolved)
    except ValueError as error:
        raise RoutingError(
            f"Format de polaire non reconnu ({os.path.basename(resolved)}). "
            "Vérifiez que le fichier .pol est bien au format OpenCPN/qtVlm."
        ) from error


MINOR_ISLANDS_URL = (
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/"
    "geojson/ne_10m_minor_islands.geojson"
)


def _load_land_mask() -> Any:
    """Charge le masque de terre utilisé par le moteur (Natural Earth, cache local).

    ne_10m_land est fusionné avec ne_10m_minor_islands : les petites îles
    (ex. îlots méditerranéens) sont absentes de ne_10m_land seul et le routage
    passerait sinon dessus. Si le fichier des îles est indisponible (hors
    ligne, pas de cache), on retombe sur ne_10m_land seul.
    Retourne None si les données sont indisponibles : dans ce cas on n'impose
    pas de masque à route(), qui chargera le sien par défaut et lèvera
    LandDataError (traduit en RoutingError) si les données manquent aussi.
    """
    try:
        from mynav_routing.land import OPEN_LAND_URL, LandMask, _load_open_land_geojson

        land_data = _load_open_land_geojson(OPEN_LAND_URL)
        features = list(land_data.get("features", []))
        try:
            minor_data = _load_open_land_geojson(MINOR_ISLANDS_URL)
            features += minor_data.get("features", [])
        except ValueError:
            pass  # îles mineures indisponibles : masque ne_10m_land seul
        return LandMask.from_geojson({"type": "FeatureCollection", "features": features})
    except ValueError:
        return None


def _nearest_water(land_mask: Any, position: tuple[float, float], max_nm: float = SNAP_MAX_NM):
    """Ramène une position classée "terre" au point d'eau le plus proche.

    Recherche en anneaux (pas de SNAP_STEP_NM jusqu'à max_nm, tous les caps).
    Retourne (point, ajustement) : si la position est déjà en mer, ajustement
    vaut None ; si aucune eau n'est trouvée, point vaut None.
    """
    import numpy as np

    from mynav_routing.engine.isochrones import move_nm

    lat, lon = position
    if not land_mask.is_land([lat], [lon])[0]:
        return (lat, lon), None
    bearings = np.arange(0.0, 360.0, SNAP_BEARING_STEP_DEG)
    radius = SNAP_STEP_NM
    while radius <= max_nm:
        lats, lons = move_nm(
            np.full(bearings.shape, lat),
            np.full(bearings.shape, lon),
            bearings,
            np.full(bearings.shape, radius),
        )
        water = ~land_mask.is_land(lats, lons)
        if water.any():
            i = int(np.flatnonzero(water)[0])
            snapped = (float(lats[i]), float(lons[i]))
            return snapped, {
                "latitude": snapped[0],
                "longitude": snapped[1],
                "offset_nm": float(radius),
            }
        radius += SNAP_STEP_NM
    return None, None


def _validate_position(name: str, position: Any) -> tuple[float, float]:
    """Valide une position (lat, lon) en degrés décimaux."""
    try:
        latitude, longitude = position
        latitude, longitude = float(latitude), float(longitude)
    except (TypeError, ValueError) as error:
        raise RoutingError(f"Position {name} invalide : deux nombres attendus (lat, lon).") from error
    if not -90.0 <= latitude <= 90.0 or not -180.0 <= longitude <= 180.0:
        raise RoutingError(f"Position {name} hors limites : lat {latitude}, lon {longitude}.")
    return latitude, longitude


def compute_route(
    start: Any,
    finish: Any,
    wind: Any = None,
    polar_path: str | None = None,
    horizon_h: float = 72.0,
    dt: float | None = None,
    heading_step: float = 5.0,
    bin_deg: float | None = None,
    arrival_nm: float = 2.0,
    tws_max: float | None = None,
    use_bathy: bool = True,
    min_depth_m: float | None = None,
    phase_timings: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Calcule la route la plus rapide de start vers finish.

    start, finish : (lat, lon) en degrés décimaux.
    wind : WindField du moteur (GRIBWindField, ConstantWind...).
    bin_deg : maille d'élagage des isochrones ; si None, elle est déduite du
    déplacement par pas (vitesse max de la polaire * dt, divisé par 3, borné à
    [0.01°, 0.05°]) — une maille plus grande que le pas fait osciller la route
    entre cellules adjacentes (trace en zigzag) et dégrade l'ETA.
    Si le masque de terre classe le départ ou l'arrivée "à terre", le point est
    ramené à l'eau la plus proche (moins de SNAP_MAX_NM mn) avant le calcul.
    use_bathy : activer la contrainte de profondeur (GEBCO) si disponible ;
    min_depth_m : profondeur minimale acceptée (m), défaut ROUTING_MIN_DEPTH_M
    ou 10 m. Aucune bathymétrie configurée = contrainte désactivée.
    Retourne un dict : found, coords, times_s, sog_kts, headings_deg,
    eta_s, min_dist_nm, geojson, start_adjusted, finish_adjusted
    (ajustements vers l'eau : {latitude, longitude, offset_nm} ou None).
    Lève RoutingError avec un message clair en cas d'erreur.
    """
    if not ROUTING_AVAILABLE:
        raise RoutingError(
            "Le moteur de routage n'est pas installé. "
            "Installez-le avec : pip install -r requirements-routing.txt"
        )
    if wind is None:
        raise RoutingError(
            "Aucun champ de vent fourni. Téléchargez un GRIB ou fournissez un vent constant."
        )

    start_position = _validate_position("de départ", start)
    finish_position = _validate_position("d'arrivée", finish)
    if start_position == finish_position:
        raise RoutingError("Le point de départ et le point d'arrivée sont identiques.")

    if dt is None:
        from mynav_routing.engine.isochrones import haversine_nm

        distance_nm = float(
            haversine_nm(
                [start_position[0]],
                [start_position[1]],
                finish_position[0],
                finish_position[1],
            )[0]
        )
        dt = 3600.0 if distance_nm > LONG_ROUTE_THRESHOLD_NM else 1800.0

    polar = load_polar(polar_path)

    if bin_deg is None:
        # Maille d'élagage sous le déplacement par pas : sinon le front tient
        # un seul point par cellule et la route trace des zigzags entre cellules.
        step_deg = float(polar.speeds.max()) * dt / 3600.0 / 60.0
        bin_deg = min(0.05, max(0.01, step_deg / 3.0))

    bathy = load_bathy() if use_bathy else None
    if bathy is not None and min_depth_m is None:
        min_depth_m = BATHY_MIN_DEPTH_M

    # Masque de terre partagé avec le moteur : si le départ (ou l'arrivée) est
    # classé "terre" — GPS côtier dans la tolérance du masque — on le ramène au
    # point d'eau le plus proche, sinon le front d'isochrones s'effondre dès le
    # premier pas et le routage échoue avec un faux "horizon dépassé".
    land_mask = _load_land_mask()
    route_start, start_adjusted = start_position, None
    route_finish, finish_adjusted = finish_position, None
    if land_mask is not None:
        route_start, start_adjusted = _nearest_water(land_mask, start_position)
        route_finish, finish_adjusted = _nearest_water(land_mask, finish_position)
        if route_start is None or route_finish is None:
            from mynav_routing.engine.isochrones import haversine_nm

            name = "de départ" if route_start is None else "d'arrivée"
            return {
                "found": False,
                "coords": [start_position],
                "times_s": [0.0],
                "sog_kts": [0.0],
                "headings_deg": [0.0],
                "eta_s": 0.0,
                "min_dist_nm": float(
                    haversine_nm([start_position[0]], [start_position[1]], finish_position[0], finish_position[1])[0]
                ),
                "bathy_active": bathy is not None,
                "geojson": None,
                "start_adjusted": start_adjusted,
                "finish_adjusted": finish_adjusted,
                "dt_s": dt,
                "bin_deg": bin_deg,
                "phase_timings": dict(phase_timings or {}),
                "message": (
                    f"Aucune route trouvée : le point {name} est à terre "
                    f"(aucun point d'eau à moins de {SNAP_MAX_NM:.0f} mn selon le masque de côtes). "
                    "Choisissez un point en mer."
                ),
            }

    route_kwargs: dict[str, Any] = {
        "polar": polar,
        "wind": wind,
        "horizon_h": horizon_h,
        "dt": dt,
        "heading_step": heading_step,
        "bin_deg": bin_deg,
        "arrival_nm": arrival_nm,
        "tws_max": tws_max,
        "bathy": bathy,
        "min_depth_m": min_depth_m,
        "phase_timings": phase_timings,
    }
    if land_mask is not None:
        route_kwargs["land"] = land_mask
    try:
        result = route(route_start, route_finish, **route_kwargs)
    except ValueError as error:
        raise RoutingError(f"Le calcul de routage a échoué : {error}") from error

    if not result.found:
        # Horizon dépassé (issue #17) : pas une erreur bloquante — on retourne
        # la meilleure progression atteinte pour l'afficher sur la carte.
        return {
            "found": False,
            "coords": result.coords,
            "times_s": result.times_s,
            "sog_kts": result.sog_kts,
            "headings_deg": result.headings_deg,
            "eta_s": 0.0,
            "min_dist_nm": result.min_dist_nm,
            "bathy_active": bathy is not None,
            "geojson": None,
            "start_adjusted": start_adjusted,
            "finish_adjusted": finish_adjusted,
            "dt_s": dt,
            "bin_deg": bin_deg,
            "phase_timings": dict(phase_timings or {}),
            "message": (
                "Aucune route trouvée : horizon dépassé "
                f"(meilleure progression à {result.min_dist_nm:.1f} mn de l'arrivée). "
                "Augmentez l'horizon ou rapprochez le point d'arrivée."
            ),
        }

    return {
        "found": True,
        "coords": result.coords,
        "times_s": result.times_s,
        "sog_kts": result.sog_kts,
        "headings_deg": result.headings_deg,
        "eta_s": result.eta_s,
        "min_dist_nm": result.min_dist_nm,
        "bathy_active": bathy is not None,
        "geojson": to_geojson(result),
        "message": None,
        "start_adjusted": start_adjusted,
        "finish_adjusted": finish_adjusted,
        "dt_s": dt,
        "bin_deg": bin_deg,
        "phase_timings": dict(phase_timings or {}),
    }


def compute_route_payload(
    payload: Any,
    phase_timings: dict[str, Any] | None = None,
    include_diagnostics: bool = False,
) -> dict[str, Any]:
    """Exécute un calcul de routage depuis le payload POST de l'API (issue #17).

    Attend : start/finish = {latitude, longitude}, polarId = id de polaire
    (voir list_polars), wind = {directionFromDeg, speedKts} (optionnel :
    vent constant de test 270°/12 nds par défaut).
    Retourne un dict JSON-ready : found, coords, etaS, dtS, minDistNm, message,
    geojson, wind, polarId, startAdjusted, finishAdjusted (rapprochement à
    l'eau si le point demandé était classé "à terre" : {latitude, longitude,
    offsetNm} ou null).
    Lève RoutingError (message utilisateur) si les entrées sont invalides.
    """
    if not isinstance(payload, dict):
        raise RoutingError("Requête de routage invalide : objet JSON attendu.")

    polar_id = payload.get("polarId")
    polar = next((entry for entry in list_polars() if entry["id"] == polar_id), None)
    if polar is None:
        raise RoutingError(
            "Polaire inconnue : " + str(polar_id) + ". Choisissez une polaire de la liste."
        )

    wind_payload = payload.get("wind")
    if wind_payload is None:
        wind_values = (270.0, 12.0)
    elif (
        isinstance(wind_payload, dict)
        and isinstance(wind_payload.get("directionFromDeg"), (int, float))
        and isinstance(wind_payload.get("speedKts"), (int, float))
    ):
        wind_values = (
            float(wind_payload["directionFromDeg"]),
            float(wind_payload["speedKts"]),
        )
    else:
        raise RoutingError("Vent invalide : {directionFromDeg, speedKts} attendus.")

    # Issue #16 : champ GRIB frais s'il existe (offline à bord), sinon vent constant.
    wind_source = "constant"
    wind_field = None
    try:
        from server.grib import load_wind_field

        wind_field = load_wind_field()
    except Exception:
        wind_field = None
    if wind_field is None:
        from mynav_routing import ConstantWind

        wind_field = ConstantWind(direction_from_deg=wind_values[0], speed_kts=wind_values[1])
    else:
        wind_source = "grib"

    def position_tuple(value: Any) -> Any:
        """Convertit {latitude, longitude} en (lat, lon) accepté par compute_route."""
        if isinstance(value, dict):
            return (value.get("latitude"), value.get("longitude"))
        return value

    start = position_tuple(payload.get("start"))
    finish = position_tuple(payload.get("finish"))

    def adjustment_json(adjustment: Any) -> Any:
        if adjustment is None:
            return None
        return {
            "latitude": adjustment["latitude"],
            "longitude": adjustment["longitude"],
            "offsetNm": adjustment["offset_nm"],
        }

    # Bathymétrie (issue #13) : useBathy (défaut vrai) et minDepthM (m) optionnels.
    use_bathy = payload.get("useBathy", True)
    if not isinstance(use_bathy, bool):
        raise RoutingError("useBathy invalide : booléen attendu.")
    min_depth_payload = payload.get("minDepthM")
    min_depth_m: float | None = None
    if min_depth_payload is not None:
        if not isinstance(min_depth_payload, (int, float)):
            raise RoutingError("minDepthM invalide : nombre attendu (profondeur en mètres).")
        min_depth_m = float(min_depth_payload)
        if min_depth_m <= 0:
            raise RoutingError("minDepthM invalide : valeur strictement positive attendue.")

    result = compute_route(
        start, finish, wind=wind_field, polar_path=polar["path"],
        use_bathy=use_bathy, min_depth_m=min_depth_m, phase_timings=phase_timings,
    )

    start_position = _validate_position("de départ", start)
    finish_position = _validate_position("d'arrivée", finish)
    payload_result = {
        "found": result["found"],
        "coords": result["coords"],
        "etaS": result["eta_s"],
        "dtS": result["dt_s"],
        "minDistNm": result["min_dist_nm"],
        "bathyActive": result["bathy_active"],
        "message": result["message"],
        "geojson": result["geojson"],
        "windSource": wind_source,
        "wind": {"directionFromDeg": wind_values[0], "speedKts": wind_values[1]},
        "polarId": polar_id,
        "start": {"latitude": start_position[0], "longitude": start_position[1]},
        "finish": {"latitude": finish_position[0], "longitude": finish_position[1]},
        "startAdjusted": adjustment_json(result["start_adjusted"]),
        "finishAdjusted": adjustment_json(result["finish_adjusted"]),
    }
    if include_diagnostics:
        payload_result.update({
            "timings": result["phase_timings"],
            "params": {"dt_s": result["dt_s"], "bin_deg": result["bin_deg"]},
            "binDeg": result["bin_deg"],
        })
    return payload_result


ROUTING_POLARS_DIR = os.path.join(os.path.dirname(__file__), os.pardir, "config")


def list_polars() -> list[dict[str, str]]:
    """Liste les polaires .pol disponibles dans config/ (issue #15)."""
    directory = os.path.abspath(ROUTING_POLARS_DIR)
    if not os.path.isdir(directory):
        return []
    polars = []
    for filename in sorted(os.listdir(directory)):
        if not filename.lower().endswith(".pol"):
            continue
        identifier = filename[: -len(".pol")]
        polars.append({
            "id": identifier,
            "name": identifier.replace("-", " ").replace("_", " ").strip(),
            "path": os.path.join(directory, filename),
        })
    return polars
