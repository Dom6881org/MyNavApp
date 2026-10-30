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
    dt: float = 1800.0,
    heading_step: float = 5.0,
    bin_deg: float = 0.05,
    arrival_nm: float = 5.0,
    tws_max: float | None = None,
) -> dict[str, Any]:
    """Calcule la route la plus rapide de start vers finish.

    start, finish : (lat, lon) en degrés décimaux.
    wind : WindField du moteur (GRIBWindField, ConstantWind...).
    bin_deg : maille d'élagage des isochrones ; elle doit être de l'ordre du
    déplacement par pas (vitesse * dt / 3600 en degrés) sinon le front
    s'effondre sur un point unique et le routage échoue (défaut 0.05°
    ≈ 3 mn pour 30 min à 6 nds).
    Retourne un dict : found, coords, times_s, sog_kts, headings_deg,
    eta_s, min_dist_nm, geojson.
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

    polar = load_polar(polar_path)
    try:
        result = route(
            start_position,
            finish_position,
            polar=polar,
            wind=wind,
            horizon_h=horizon_h,
            dt=dt,
            heading_step=heading_step,
            bin_deg=bin_deg,
            arrival_nm=arrival_nm,
            tws_max=tws_max,
        )
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
            "geojson": None,
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
        "geojson": to_geojson(result),
        "message": None,
    }


def compute_route_payload(payload: Any) -> dict[str, Any]:
    """Exécute un calcul de routage depuis le payload POST de l'API (issue #17).

    Attend : start/finish = {latitude, longitude}, polarId = id de polaire
    (voir list_polars), wind = {directionFromDeg, speedKts} (optionnel :
    vent constant de test 270°/12 nds par défaut).
    Retourne un dict JSON-ready : found, coords, etaS, minDistNm, message,
    geojson, wind, polarId.
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

    from mynav_routing import ConstantWind

    wind = ConstantWind(direction_from_deg=wind_values[0], speed_kts=wind_values[1])

    def position_tuple(value: Any) -> Any:
        """Convertit {latitude, longitude} en (lat, lon) accepté par compute_route."""
        if isinstance(value, dict):
            return (value.get("latitude"), value.get("longitude"))
        return value

    start = position_tuple(payload.get("start"))
    finish = position_tuple(payload.get("finish"))

    result = compute_route(start, finish, wind=wind, polar_path=polar["path"])

    start_position = _validate_position("de départ", start)
    finish_position = _validate_position("d'arrivée", finish)
    return {
        "found": result["found"],
        "coords": result["coords"],
        "etaS": result["eta_s"],
        "minDistNm": result["min_dist_nm"],
        "message": result["message"],
        "geojson": result["geojson"],
        "wind": {"directionFromDeg": wind_values[0], "speedKts": wind_values[1]},
        "polarId": polar_id,
        "start": {"latitude": start_position[0], "longitude": start_position[1]},
        "finish": {"latitude": finish_position[0], "longitude": finish_position[1]},
    }


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
