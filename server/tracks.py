"""Enregistrement des traces de navigation et exports GeoJSON, GPX et CSV.

Chaque trace est stockée dans un fichier JSONL (un point par ligne) écrit et
flushé au fil de l'eau : en cas de coupure de courant sur le Raspberry, seule la
dernière seconde de navigation est perdue. Les lignes de métadonnées
(``type: meta`` / ``type: end``) encadrent les points de la trace.
"""

import json
import math
import re
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

TRACK_ID_PATTERN = re.compile(r"track-\d{8}T\d{6}Z(-\d+)?")
TRACK_FILE_SUFFIX = ".jsonl"
SAMPLE_INTERVAL_MS = 1_000
HEARTBEAT_MS = 60_000
MIN_DISTANCE_M = 5.0
CSV_HEADER = "time,latitude,longitude,sog_knots,cog_deg,heading_deg,depth_m,gps_accuracy_m"


class TrackRecorderError(Exception):
    """Erreur d'utilisation de l'enregistreur de traces."""


class TrackNotFoundError(TrackRecorderError):
    """Identifiant de trace inconnu."""


def _now_ms() -> int:
    return int(time.time() * 1000)


def _iso_utc(timestamp_ms: int) -> str:
    """Formate un horodatage en millisecondes en ISO 8601 UTC (suffixe Z)."""
    moment = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
    return moment.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _is_position(position: Any) -> bool:
    return (
        isinstance(position, dict)
        and _is_number(position.get("latitude"))
        and -90 <= position["latitude"] <= 90
        and _is_number(position.get("longitude"))
        and -180 <= position["longitude"] <= 180
    )


def _distance_m(a: dict[str, Any], b: dict[str, Any]) -> float:
    """Distance approximative en mètres entre deux positions (projection équirectangulaire)."""
    mean_latitude = math.radians((a["latitude"] + b["latitude"]) / 2)
    delta_x = math.radians(b["longitude"] - a["longitude"]) * math.cos(mean_latitude)
    delta_y = math.radians(b["latitude"] - a["latitude"])
    return math.hypot(delta_x, delta_y) * 6_371_000


class TrackRecorder:
    """Enregistreur de traces persistant sur le disque, thread-safe."""

    def __init__(self, tracks_dir: Path) -> None:
        self.tracks_dir = tracks_dir
        self.error: str | None = None
        self._lock = threading.RLock()
        self._active: dict[str, Any] | None = None

    def start(self, now_ms: int | None = None) -> dict[str, Any]:
        """Démarre l'enregistrement d'une nouvelle trace et retourne son statut."""
        now = now_ms if now_ms is not None else _now_ms()
        with self._lock:
            if self._active is not None:
                raise TrackRecorderError("A track is already being recorded.")
            track_id = "track-" + datetime.fromtimestamp(now / 1000, tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            try:
                self.tracks_dir.mkdir(parents=True, exist_ok=True)
                path = self.tracks_dir / f"{track_id}{TRACK_FILE_SUFFIX}"
                attempt = 1
                while path.exists():
                    attempt += 1
                    path = self.tracks_dir / f"{track_id}-{attempt}{TRACK_FILE_SUFFIX}"
                track_id = path.stem
                file = path.open("a", encoding="utf-8")
                meta = {"type": "meta", "id": track_id, "startedAt": now}
                file.write(json.dumps(meta, separators=(",", ":"), allow_nan=False) + "\n")
                file.flush()
            except OSError as error:
                raise TrackRecorderError(f"Unable to create the track file: {error}") from error
            self.error = None
            self._active = {
                "id": track_id,
                "path": path,
                "file": file,
                "startedAt": now,
                "pointCount": 0,
                "lastPoint": None,
            }
            return self.status()

    def stop(self) -> dict[str, Any]:
        """Arrête l'enregistrement et retourne le résumé de la trace terminée."""
        with self._lock:
            active = self._active
            if active is None:
                raise TrackRecorderError("No track is currently recorded.")
            ended_at = active["lastPoint"]["timestampMs"] if active["lastPoint"] else active["startedAt"]
            end_meta = {"type": "end", "endedAt": ended_at, "pointCount": active["pointCount"]}
            try:
                active["file"].write(json.dumps(end_meta, separators=(",", ":"), allow_nan=False) + "\n")
                active["file"].flush()
                active["file"].close()
            except OSError as error:
                self.error = f"Failed to finalize the track file: {error}"
            finally:
                self._active = None
            return {
                "id": active["id"],
                "startedAt": active["startedAt"],
                "endedAt": ended_at,
                "pointCount": active["pointCount"],
                "sizeBytes": self._safe_size(active["path"]),
            }

    def record(self, navigation: dict[str, Any], now_ms: int) -> None:
        """Ajoute un point à la trace active à partir de l'état de navigation fusionné.

        Un point n'est ajouté que si le bateau s'est déplacé d'au moins
        ``MIN_DISTANCE_M`` mètres depuis le dernier point, ou toutes les
        ``HEARTBEAT_MS`` millisecondes au mouillage ; au plus un point par
        ``SAMPLE_INTERVAL_MS`` millisecondes est écrit.
        """
        with self._lock:
            active = self._active
            if active is None:
                return
            position = navigation.get("position")
            if not _is_position(position):
                return
            last = active["lastPoint"]
            if last is not None:
                elapsed = now_ms - last["timestampMs"]
                if elapsed < SAMPLE_INTERVAL_MS:
                    return
                if _distance_m(last, position) < MIN_DISTANCE_M and elapsed < HEARTBEAT_MS:
                    return
            speed = navigation.get("speed") if isinstance(navigation.get("speed"), dict) else {}
            compass = navigation.get("compass") if isinstance(navigation.get("compass"), dict) else {}
            depth = navigation.get("depth") if isinstance(navigation.get("depth"), dict) else {}
            sog = speed.get("sog") if _is_number(speed.get("sog")) else speed.get("speed")
            point = {
                "timestampMs": now_ms,
                "latitude": position["latitude"],
                "longitude": position["longitude"],
                "sog": sog if _is_number(sog) else None,
                "cog": compass.get("cog") if _is_number(compass.get("cog")) else None,
                "heading": compass.get("heading") if _is_number(compass.get("heading")) else None,
                "depth": depth.get("depth") if _is_number(depth.get("depth")) else None,
                "gpsAccuracy": navigation.get("gpsAccuracy") if _is_number(navigation.get("gpsAccuracy")) else None,
            }
            try:
                active["file"].write(json.dumps(point, separators=(",", ":"), allow_nan=False) + "\n")
                active["file"].flush()
            except OSError as error:
                self.error = f"Track write failed; recording stopped: {error}"
                self._close_active()
                return
            active["pointCount"] += 1
            active["lastPoint"] = point

    def status(self) -> dict[str, Any]:
        """Retourne l'état courant de l'enregistreur."""
        with self._lock:
            active = self._active
            return {
                "recording": active is not None,
                "trackId": active["id"] if active else None,
                "startedAt": active["startedAt"] if active else None,
                "pointCount": active["pointCount"] if active else None,
                "error": self.error,
            }

    def list_tracks(self) -> list[dict[str, Any]]:
        """Retourne le résumé de toutes les traces connues, la plus récente d'abord."""
        if not self.tracks_dir.is_dir():
            return []
        summaries: list[dict[str, Any]] = []
        for path in self.tracks_dir.glob(f"track-*{TRACK_FILE_SUFFIX}"):
            if not path.is_file():
                continue
            try:
                summaries.append(self._scan_summary(path))
            except (OSError, json.JSONDecodeError):
                continue
        summaries.sort(key=lambda summary: summary["startedAt"], reverse=True)
        return summaries

    def track_summary(self, track_id: str) -> dict[str, Any]:
        """Retourne le résumé d'une trace existante."""
        return self._scan_summary(self._track_path(track_id))

    def load_points(self, track_id: str) -> list[dict[str, Any]]:
        """Retourne la liste des points d'une trace existante."""
        path = self._track_path(track_id)
        points: list[dict[str, Any]] = []
        with path.open(encoding="utf-8") as file:
            for line in file:
                try:
                    value = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if isinstance(value, dict) and "type" not in value and _is_number(value.get("timestampMs")):
                    points.append(value)
        return points

    def delete_track(self, track_id: str) -> None:
        """Supprime le fichier d'une trace terminée."""
        with self._lock:
            if self._active and self._active["id"] == track_id:
                raise TrackRecorderError("Stop the recording before deleting the active track.")
        path = self._track_path(track_id)
        try:
            path.unlink()
        except OSError as error:
            raise TrackRecorderError(f"Unable to delete the track file: {error}") from error

    def _close_active(self) -> None:
        active = self._active
        if active is None:
            return
        self._active = None
        try:
            active["file"].close()
        except OSError:
            pass

    def _track_path(self, track_id: str) -> Path:
        """Résout un identifiant de trace en chemin de fichier sûr, sinon lève TrackNotFoundError."""
        if not isinstance(track_id, str) or not TRACK_ID_PATTERN.fullmatch(track_id):
            raise TrackNotFoundError(f"Unknown track identifier: {track_id!r}.")
        path = self.tracks_dir / f"{track_id}{TRACK_FILE_SUFFIX}"
        if not path.is_file():
            raise TrackNotFoundError(f"Track {track_id} not found.")
        return path

    def _scan_summary(self, path: Path) -> dict[str, Any]:
        """Parcourt un fichier de trace pour construire son résumé.

        La ligne finale ``type: end`` peut manquer (arrêt brutal du serveur) :
        le résumé est alors reconstruit à partir des points du fichier.
        """
        started_at: int | None = None
        ended_at: int | None = None
        point_count = 0
        last_timestamp: int | None = None
        with path.open(encoding="utf-8") as file:
            for line in file:
                try:
                    value = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if not isinstance(value, dict):
                    continue
                if value.get("type") == "meta" and _is_number(value.get("startedAt")):
                    started_at = value["startedAt"]
                elif value.get("type") == "end":
                    ended_at = value.get("endedAt") if _is_number(value.get("endedAt")) else ended_at
                    if _is_number(value.get("pointCount")):
                        point_count = value["pointCount"]
                elif _is_number(value.get("timestampMs")):
                    point_count += 1
                    last_timestamp = value["timestampMs"]
        return {
            "id": path.stem,
            "startedAt": started_at if started_at is not None else 0,
            "endedAt": ended_at if ended_at is not None else last_timestamp,
            "pointCount": point_count,
            "sizeBytes": self._safe_size(path),
        }

    @staticmethod
    def _safe_size(path: Path) -> int:
        try:
            return path.stat().st_size
        except OSError:
            return 0


def track_to_geojson(summary: dict[str, Any], points: list[dict[str, Any]]) -> dict[str, Any]:
    """Construit un FeatureCollection GeoJSON avec la trace en LineString."""
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "name": summary["id"],
                    "startedAt": summary["startedAt"],
                    "endedAt": summary["endedAt"],
                    "pointCount": len(points),
                    "coordTimes": [_iso_utc(point["timestampMs"]) for point in points],
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[point["longitude"], point["latitude"]] for point in points],
                },
            }
        ],
    }


def track_to_gpx(summary: dict[str, Any], points: list[dict[str, Any]]) -> str:
    """Construit un document GPX 1.1 avec un segment de trace par excursion."""
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="MyNavApp">',
        "  <trk>",
        f"    <name>{escape(str(summary['id']))}</name>",
        "    <trkseg>",
    ]
    for point in points:
        lines.append(
            f'      <trkpt lat="{point["latitude"]}" lon="{point["longitude"]}">'
            f"<time>{_iso_utc(point['timestampMs'])}</time></trkpt>"
        )
    lines.extend(["    </trkseg>", "  </trk>", "</gpx>", ""])
    return "\n".join(lines)


def track_to_csv(summary: dict[str, Any], points: list[dict[str, Any]]) -> str:
    """Construit un tableau CSV des points de la trace (une ligne par point)."""

    def cell(value: Any) -> str:
        return "" if value is None else str(value)

    lines = [CSV_HEADER]
    for point in points:
        lines.append(
            ",".join(
                [
                    _iso_utc(point["timestampMs"]),
                    str(point["latitude"]),
                    str(point["longitude"]),
                    cell(point.get("sog")),
                    cell(point.get("cog")),
                    cell(point.get("heading")),
                    cell(point.get("depth")),
                    cell(point.get("gpsAccuracy")),
                ]
            )
        )
    return "\n".join(lines) + "\n"
