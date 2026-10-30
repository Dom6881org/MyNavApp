import json
import math
import mimetypes
import os
import queue
import signal
import socket
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit
from typing import Any

from dotenv import load_dotenv

from server.ais import LocalAISDecoder, parse_internet_message
from server.nmea import parse_nmea_sentence
from server.tracks import (
    TrackNotFoundError,
    TrackRecorder,
    TrackRecorderError,
    track_to_csv,
    track_to_geojson,
    track_to_gpx,
)
from websockets.sync.client import connect as connect_websocket


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _load_local_environment(project_root: Path) -> None:
    load_dotenv(project_root / ".env", override=False)


_load_local_environment(PROJECT_ROOT)
WEB_ROOT = PROJECT_ROOT / "dist"
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "3001"))
NMEA_PORT = int(os.environ.get("NMEA_UDP_PORT", "10111"))
NMEA_HOST = os.environ.get("NMEA_UDP_HOST", "0.0.0.0")
TILES_DIR = os.environ.get("TILES_DIR", str(PROJECT_ROOT / "tiles"))
TRACKS_DIR = os.environ.get("TRACKS_DIR", str(PROJECT_ROOT / "tracks"))
TILE_LAYERS = ("osm", "seamark")
AISSTREAM_API_KEY = os.environ.get("AISSTREAM_API_KEY", "").strip()
IS_PRODUCTION = os.environ.get("NODE_ENV") == "production"
NMEA_FRESHNESS_MS = 5000
BROWSER_FRESHNESS_MS = 10_000
AIS_FRESHNESS_MS = 10 * 60_000
AIS_TARGET_LIMIT = 1500
AIS_REPLAY_POSITION_FRESHNESS_MS = 5_000

EMPTY_FIELDS = {
    "position": None,
    "speed": None,
    "compass": None,
    "depth": None,
    "apparentWind": None,
    "trueWind": None,
    "gpsTime": None,
    "gpsAccuracy": None,
}
state_lock = threading.RLock()
browser_navigation: dict[str, Any] | None = None
nmea_navigation = dict(EMPTY_FIELDS)
last_nmea_message_at: int | None = None
nmea_listening = False
event_clients: set[queue.Queue[str]] = set()
last_broadcast_message = ""
stop_event = threading.Event()
ais_targets: dict[str, dict[str, dict[str, Any]]] = {"local": {}, "internet": {}}
ais_source = "local"
ais_visible = True
ais_internet_connected = False
ais_internet_error: str | None = None
ais_replay_position: dict[str, Any] | None = None
local_ais_decoder = LocalAISDecoder()
track_recorder = TrackRecorder(Path(TRACKS_DIR))


def _merge_speed(primary: dict[str, Any] | None, fallback: dict[str, Any] | None) -> dict[str, Any] | None:
    if primary is None:
        return fallback
    return {
        key: primary.get(key) if primary.get(key) is not None else fallback.get(key) if fallback else None
        for key in ("speed", "sog", "stw", "maxSpeed", "averageSpeed")
    }


def _merge_compass(primary: dict[str, Any] | None, fallback: dict[str, Any] | None) -> dict[str, Any] | None:
    if primary is None:
        return fallback
    return {
        "heading": primary.get("heading") if primary.get("heading") is not None else fallback.get("heading") if fallback else None,
        "cog": primary.get("cog") if primary.get("cog") is not None else fallback.get("cog") if fallback else None,
        "magneticHeading": primary.get("magneticHeading") if primary.get("magneticHeading") is not None else fallback.get("magneticHeading") if fallback else None,
        "deviation": primary.get("deviation") or (fallback.get("deviation") if fallback else 0) or 0,
    }


def _internet_ais_wanted(source: str, visible: bool, local_fresh_count: int) -> bool:
    """Internet AIS serves the selected "internet" source and acts as a fallback
    while the local NMEA stream carries no AIS targets."""
    if not visible:
        return False
    if source == "internet":
        return True
    return source == "local" and bool(AISSTREAM_API_KEY) and local_fresh_count == 0


def _fresh_local_ais_count(now: int) -> int:
    with state_lock:
        return sum(
            now - target["updatedAt"] <= AIS_FRESHNESS_MS
            for target in ais_targets["local"].values()
        )


def combine_fields() -> dict[str, Any]:
    now = int(time.time() * 1000)
    with state_lock:
        nmea_connected = last_nmea_message_at is not None and now - last_nmea_message_at <= NMEA_FRESHNESS_MS
        browser_fresh = browser_navigation is not None and now - browser_navigation["receivedAt"] <= BROWSER_FRESHNESS_MS
        browser_fields = {
            # .get : la validation accepte les clés facultatives absentes du payload.
            "position": browser_navigation.get("position"),
            "speed": browser_navigation.get("speed"),
            "compass": browser_navigation.get("compass"),
            "depth": None,
            "apparentWind": None,
            "trueWind": None,
            "gpsTime": browser_navigation.get("gpsTime"),
            "gpsAccuracy": browser_navigation.get("gpsAccuracy"),
        } if browser_fresh and browser_navigation else EMPTY_FIELDS
        navigation = {
            "position": (nmea_navigation["position"] or browser_fields["position"]) if nmea_connected else browser_fields["position"],
            "speed": _merge_speed(nmea_navigation["speed"], browser_fields["speed"]) if nmea_connected else browser_fields["speed"],
            "compass": _merge_compass(nmea_navigation["compass"], browser_fields["compass"]) if nmea_connected else browser_fields["compass"],
            "depth": nmea_navigation["depth"] if nmea_connected else browser_fields["depth"],
            "apparentWind": nmea_navigation["apparentWind"] if nmea_connected else browser_fields["apparentWind"],
            "trueWind": nmea_navigation["trueWind"] if nmea_connected else browser_fields["trueWind"],
            "gpsTime": (nmea_navigation["gpsTime"] or browser_fields["gpsTime"]) if nmea_connected else browser_fields["gpsTime"],
            "gpsAccuracy": (nmea_navigation["gpsAccuracy"] if nmea_navigation["gpsAccuracy"] is not None else browser_fields["gpsAccuracy"]) if nmea_connected else browser_fields["gpsAccuracy"],
        }
        source = "nmea" if nmea_connected else "browser" if browser_fresh else "none"
        updated_at = last_nmea_message_at if nmea_connected else browser_navigation["receivedAt"] if browser_fresh and browser_navigation else None
        local_target_count = sum(
            now - target["updatedAt"] <= AIS_FRESHNESS_MS for target in ais_targets["local"].values()
        )
        internet_target_count = sum(
            now - target["updatedAt"] <= AIS_FRESHNESS_MS for target in ais_targets["internet"].values()
        )
        # Fall back to Internet targets while the local NMEA stream carries no
        # AIS data and an AISstream key is configured on the server.
        effective_source = (
            "internet"
            if ais_source == "local" and local_target_count == 0 and AISSTREAM_API_KEY
            else ais_source
        )
        selected_targets = [
            target for target in ais_targets[effective_source].values()
            if now - target["updatedAt"] <= AIS_FRESHNESS_MS
        ]
        selected_targets.sort(key=lambda target: target["updatedAt"], reverse=True)
        ais = {
            "source": effective_source,
            "requestedSource": ais_source,
            "localNmeaPort": NMEA_PORT if nmea_listening else None,
            "targets": selected_targets[:AIS_TARGET_LIMIT],
            "localTargetCount": local_target_count,
            "internetTargetCount": internet_target_count,
            "internetConfigured": bool(AISSTREAM_API_KEY),
            "internetConnected": ais_internet_connected,
            "internetError": ais_internet_error,
        }
        return {
            "source": source,
            "nmeaConnected": nmea_connected,
            "updatedAt": updated_at,
            "navigation": navigation,
            "ais": ais,
        }


def _upsert_ais_target(update: dict[str, Any]) -> None:
    source = update["source"]
    with state_lock:
        targets = ais_targets[source]
        existing = targets.get(update["mmsi"], {})
        if "latitude" not in update and "latitude" not in existing:
            return
        target = {
            "mmsi": update["mmsi"],
            "name": None,
            "latitude": existing.get("latitude"),
            "longitude": existing.get("longitude"),
            "sog": None,
            "cog": None,
            "heading": None,
            "navigationalStatus": None,
            **existing,
            **update,
        }
        targets[update["mmsi"]] = target
        if len(targets) > AIS_TARGET_LIMIT * 2:
            oldest = sorted(targets, key=lambda mmsi: targets[mmsi]["updatedAt"])
            for mmsi in oldest[:len(targets) - AIS_TARGET_LIMIT]:
                del targets[mmsi]


def _aisstream_subscription(position: dict[str, float]) -> dict[str, Any]:
    latitude = position["latitude"]
    longitude = position["longitude"]
    lat_delta = 0.25
    lon_delta = min(180.0, lat_delta / max(0.001, abs(math.cos(math.radians(latitude)))))
    south = max(-90, latitude - lat_delta)
    north = min(90, latitude + lat_delta)
    west = longitude - lon_delta
    east = longitude + lon_delta
    if west < -180:
        bounding_boxes = [
            [[south, west + 360], [north, 180]],
            [[south, -180], [north, east]],
        ]
    elif east > 180:
        bounding_boxes = [
            [[south, west], [north, 180]],
            [[south, -180], [north, east - 360]],
        ]
    else:
        bounding_boxes = [[[south, west], [north, east]]]
    return {
        "APIKey": AISSTREAM_API_KEY,
        "BoundingBoxes": bounding_boxes,
        "FilterMessageTypes": [
            "PositionReport",
            "StandardClassBPositionReport",
            "ExtendedClassBPositionReport",
            "LongRangeAisBroadcastMessage",
            "ShipStaticData",
            "StaticDataReport",
        ],
    }


def _current_ais_position() -> dict[str, float] | None:
    now = int(time.time() * 1000)
    with state_lock:
        replay_position = ais_replay_position
        if (
            replay_position
            and now - replay_position["receivedAt"] <= AIS_REPLAY_POSITION_FRESHNESS_MS
        ):
            position = replay_position["position"]
            if _is_position(position):
                return {"latitude": position["latitude"], "longitude": position["longitude"]}
    snapshot = combine_fields()
    position = snapshot["navigation"]["position"]
    if position and _is_position(position):
        return {"latitude": position["latitude"], "longitude": position["longitude"]}
    return None


def _valid_ais_replay_position_update(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and "position" in value
        and (value["position"] is None or _is_position(value["position"]))
    )


def _set_ais_connection(connected: bool, error: str | None = None) -> None:
    global ais_internet_connected, ais_internet_error
    with state_lock:
        changed = connected != ais_internet_connected or error != ais_internet_error
        ais_internet_connected = connected
        ais_internet_error = error
    if changed:
        broadcast_navigation()


def _aisstream_worker() -> None:
    reconnect_delay = 2
    while not stop_event.is_set():
        with state_lock:
            source = ais_source
            visible = ais_visible
        if not _internet_ais_wanted(source, visible, _fresh_local_ais_count(int(time.time() * 1000))):
            _set_ais_connection(False)
            stop_event.wait(1)
            continue
        if not AISSTREAM_API_KEY:
            _set_ais_connection(False, "Set AISSTREAM_API_KEY to enable Internet AIS.")
            stop_event.wait(3)
            continue
        position = _current_ais_position()
        if position is None:
            _set_ais_connection(False, "Waiting for a GPS position to select the AISstream coverage area.")
            stop_event.wait(2)
            continue
        try:
            with connect_websocket(
                "wss://stream.aisstream.io/v0/stream",
                compression="deflate",
                open_timeout=10,
                ping_interval=20,
                ping_timeout=20,
                max_size=1_048_576,
            ) as websocket:
                websocket.send(json.dumps(_aisstream_subscription(position), separators=(",", ":")))
                _set_ais_connection(True)
                reconnect_delay = 2
                last_subscription_position = position
                while not stop_event.is_set():
                    with state_lock:
                        if ais_source == "local" and _fresh_local_ais_count(int(time.time() * 1000)) > 0:
                            # Fallback mode: hand targets back to local AIS as soon as it talks.
                            break
                    current_position = _current_ais_position()
                    if current_position and (
                        abs(current_position["latitude"] - last_subscription_position["latitude"]) >= 0.1
                        or abs(current_position["longitude"] - last_subscription_position["longitude"]) >= 0.1
                    ):
                        websocket.send(json.dumps(_aisstream_subscription(current_position), separators=(",", ":")))
                        last_subscription_position = current_position
                    try:
                        raw_message = websocket.recv(timeout=1)
                    except TimeoutError:
                        continue
                    value = json.loads(raw_message)
                    if isinstance(value, dict) and value.get("MessageType") == "SubscriptionConfirmation":
                        if not value.get("Message", {}).get("CompressionEnabled"):
                            raise RuntimeError("AISstream did not negotiate WebSocket compression.")
                        continue
                    update = parse_internet_message(value)
                    if update:
                        _upsert_ais_target(update)
                        broadcast_navigation()
        except Exception as error:
            if stop_event.is_set():
                break
            message = f"AISstream connection failed ({type(error).__name__})."
            print(message)
            _set_ais_connection(False, message)
            stop_event.wait(reconnect_delay)
            reconnect_delay = min(reconnect_delay * 2, 60)
        else:
            _set_ais_connection(False)


def _expire_ais_targets() -> None:
    while not stop_event.wait(5):
        cutoff = int(time.time() * 1000) - AIS_FRESHNESS_MS
        with state_lock:
            for targets in ais_targets.values():
                expired = [mmsi for mmsi, target in targets.items() if target["updatedAt"] < cutoff]
                for mmsi in expired:
                    del targets[mmsi]
        broadcast_navigation()


def broadcast_navigation() -> None:
    global last_broadcast_message
    snapshot = combine_fields()
    track_recorder.record(snapshot["navigation"], int(time.time() * 1000))
    message = "data: " + json.dumps(snapshot, separators=(",", ":"), allow_nan=False) + "\n\n"
    with state_lock:
        if message == last_broadcast_message:
            return
        last_broadcast_message = message
        for client in list(event_clients):
            try:
                client.put_nowait(message)
            except queue.Full:
                try:
                    client.get_nowait()
                except queue.Empty:
                    pass
                try:
                    client.put_nowait(message)
                except queue.Full:
                    pass


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _is_position(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and _is_number(value.get("latitude"))
        and -90 <= value["latitude"] <= 90
        and _is_number(value.get("longitude"))
        and -180 <= value["longitude"] <= 180
    )


def _nullable_number(value: Any) -> bool:
    return value is None or _is_number(value)


def _valid_browser_update(value: Any) -> bool:
    if not isinstance(value, dict) or not _is_position(value.get("position")):
        return False
    if not _nullable_number(value.get("gpsAccuracy")) or not _is_number(value.get("receivedAt")):
        return False
    speed = value.get("speed")
    if speed is not None and (
        not isinstance(speed, dict)
        or any(not _nullable_number(speed.get(key)) for key in ("speed", "sog", "stw", "maxSpeed", "averageSpeed"))
    ):
        return False
    compass = value.get("compass")
    if compass is not None and (
        not isinstance(compass, dict)
        or any(not _nullable_number(compass.get(key)) for key in ("heading", "cog", "magneticHeading"))
        or not _is_number(compass.get("deviation"))
    ):
        return False
    gps_time = value.get("gpsTime")
    if gps_time is not None and (
        not isinstance(gps_time, dict)
        or any(not isinstance(gps_time.get(key), str) for key in ("utcTime", "localTime", "date"))
    ):
        return False
    return True


def _tile_path(segments: list[str]) -> Path | None:
    """Resolve /api/tiles/{layer}/{z}/{x}/{y}.png to a file inside TILES_DIR, or None."""
    if len(segments) != 4 or segments[0] not in TILE_LAYERS:
        return None
    _layer, z_raw, x_raw, y_raw = segments
    name, extension = os.path.splitext(y_raw)
    if extension != ".png":
        return None
    try:
        z, x, y = int(z_raw), int(x_raw), int(name)
    except ValueError:
        return None
    if z < 0 or z > 21 or not (0 <= x < 2 ** z) or not (0 <= y < 2 ** z):
        return None
    root = Path(TILES_DIR).resolve()
    tile = (root / _layer / str(z) / str(x) / f"{y}.png").resolve()
    if tile != root and root not in tile.parents:
        return None
    return tile


class NavigationHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    # On Windows allow_reuse_address lets two instances silently share the
    # port, which splits requests between stale and fresh processes; the
    # exclusive flag below makes a second instance fail loudly instead.
    allow_reuse_address = sys.platform != "win32"

    def server_bind(self) -> None:
        if sys.platform == "win32":
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


class RequestHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def handle(self) -> None:
        try:
            super().handle()
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            self.close_connection = True

    def log_message(self, format_string: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format_string % args}")

    def _send_json(self, status: int, value: Any) -> None:
        body = json.dumps(value, separators=(",", ":"), allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _send_tile(self, path: str) -> None:
        tile = _tile_path(path[len("/api/tiles/"):].split("/"))
        if tile is None or not tile.is_file():
            self._send_json(404, {"error": "Tile not found."})
            return
        body = tile.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("Cache-Control", "public, max-age=86400")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path == "/api/health":
            self._send_json(200, {
                "ok": True,
                "nmeaUdpEnabled": nmea_listening,
                "nmeaUdpPort": NMEA_PORT if nmea_listening else None,
                "production": IS_PRODUCTION,
            })
        elif path == "/api/navigation":
            self._send_json(200, combine_fields())
        elif path == "/api/navigation/events":
            self._send_events()
        elif path.startswith("/api/tiles/"):
            self._send_tile(path)
        elif path == "/api/tracks":
            self._send_json(200, {
                "recorder": track_recorder.status(),
                "tracks": track_recorder.list_tracks(),
            })
        elif path.startswith("/api/tracks/"):
            self._send_track_route()
        elif path.startswith("/api/"):
            self._send_json(404, {"error": "API route not found."})
        elif not IS_PRODUCTION:
            self._send_json(404, {"error": "Development server routes frontend requests."})
        else:
            self._serve_static(path)

    def do_HEAD(self) -> None:
        path = urlsplit(self.path).path
        if path.startswith("/api/tiles/"):
            self._send_tile(path)
        elif path == "/api/tracks" or path.startswith("/api/tracks/"):
            self._send_track_route()
        elif path.startswith("/api/"):
            self._send_json(404, {"error": "API route not found."})
        elif not IS_PRODUCTION:
            self._send_json(404, {"error": "Development server routes frontend requests."})
        else:
            self._serve_static(path)

    def do_POST(self) -> None:
        path = urlsplit(self.path).path
        if path in ("/api/tracks/start", "/api/tracks/stop"):
            try:
                stopped = track_recorder.stop() if path == "/api/tracks/stop" else track_recorder.start()
            except TrackRecorderError as error:
                self._send_json(409, {"error": str(error)})
                return
            self._send_json(202, {
                "recorder": track_recorder.status(),
                "tracks": track_recorder.list_tracks(),
                "stopped": stopped if path == "/api/tracks/stop" else None,
            })
            return
        if path not in ("/api/navigation/browser", "/api/ais/settings", "/api/ais/replay-position"):
            self._send_json(404, {"error": "API route not found."} if path.startswith("/api/") else {"error": "Not found."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 0:
                raise ValueError
        except ValueError:
            self._send_json(400, {"error": "Invalid Content-Length."})
            return
        if length > 64 * 1024:
            self._send_json(400, {"error": "Request body exceeds 64 KB."})
            return
        try:
            value = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(400, {"error": "Malformed JSON request body."})
            return
        if path == "/api/ais/replay-position":
            if not _valid_ais_replay_position_update(value):
                self._send_json(400, {"error": "Invalid AIS replay position."})
                return
            global ais_replay_position
            with state_lock:
                position = value["position"]
                ais_replay_position = (
                    {"position": position, "receivedAt": int(time.time() * 1000)}
                    if position is not None else None
                )
            self._send_json(202, {"ok": True})
            return
        if path == "/api/ais/settings":
            if (
                not isinstance(value, dict)
                or value.get("source") not in ("local", "internet")
                or not isinstance(value.get("visible"), bool)
            ):
                self._send_json(400, {"error": "Invalid AIS source."})
                return
            global ais_source, ais_visible, ais_internet_error
            with state_lock:
                if value["source"] != ais_source:
                    ais_targets["internet"].clear()
                ais_source = value["source"]
                ais_visible = value["visible"]
                if ais_source == "local":
                    ais_internet_error = None
            broadcast_navigation()
            self._send_json(202, combine_fields())
            return
        if not _valid_browser_update(value):
            self._send_json(400, {"error": "Invalid browser navigation payload."})
            return
        global browser_navigation
        with state_lock:
            browser_navigation = value
        snapshot = combine_fields()
        broadcast_navigation()
        self._send_json(202, snapshot)

    def do_DELETE(self) -> None:
        path = urlsplit(self.path).path
        prefix = "/api/tracks/"
        if not path.startswith(prefix):
            self._send_json(404, {"error": "API route not found."} if path.startswith("/api/") else {"error": "Not found."})
            return
        track_id = path[len(prefix):]
        if not track_id or "/" in track_id:
            self._send_json(404, {"error": "Track API route not found."})
            return
        try:
            track_recorder.delete_track(track_id)
        except TrackNotFoundError:
            self._send_json(404, {"error": "Track not found."})
            return
        except TrackRecorderError as error:
            self._send_json(409, {"error": str(error)})
            return
        self._send_json(202, {
            "recorder": track_recorder.status(),
            "tracks": track_recorder.list_tracks(),
        })

    def _send_track_route(self) -> None:
        """Route les requêtes /api/tracks/{id}/export?format=... vers le bon format."""
        url = urlsplit(self.path)
        segments = url.path[len("/api/tracks/"):].split("/")
        if len(segments) == 2 and segments[1] == "export":
            self._send_track_export(segments[0], parse_qs(url.query))
        else:
            self._send_json(404, {"error": "Track API route not found."})

    def _send_track_export(self, track_id: str, query: dict[str, list[str]]) -> None:
        export_format = (query.get("format") or ["geojson"])[0]
        if export_format not in ("geojson", "gpx", "csv"):
            self._send_json(400, {"error": "Unsupported export format. Use geojson, gpx or csv."})
            return
        try:
            summary = track_recorder.track_summary(track_id)
            points = track_recorder.load_points(track_id)
        except TrackNotFoundError:
            self._send_json(404, {"error": "Track not found."})
            return
        if export_format == "geojson":
            body = json.dumps(track_to_geojson(summary, points), separators=(",", ":"), allow_nan=False).encode("utf-8")
            content_type = "application/geo+json; charset=utf-8"
        elif export_format == "gpx":
            body = track_to_gpx(summary, points).encode("utf-8")
            content_type = "application/gpx+xml; charset=utf-8"
        else:
            body = track_to_csv(summary, points).encode("utf-8")
            content_type = "text/csv; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Disposition", f'attachment; filename="{track_id}.{export_format}"')
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _send_events(self) -> None:
        client: queue.Queue[str] = queue.Queue(maxsize=1)
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()
        with state_lock:
            event_clients.add(client)
        try:
            initial = "data: " + json.dumps(combine_fields(), separators=(",", ":"), allow_nan=False) + "\n\n"
            self.wfile.write(initial.encode("utf-8"))
            self.wfile.flush()
            while not stop_event.is_set():
                try:
                    message = client.get(timeout=15)
                    self.wfile.write(message.encode("utf-8"))
                except queue.Empty:
                    self.wfile.write(b": keep-alive\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            with state_lock:
                event_clients.discard(client)

    def _serve_static(self, path: str) -> None:
        try:
            decoded = unquote(path, errors="strict")
        except UnicodeDecodeError:
            self._send_json(400, {"error": "Invalid URL path."})
            return
        requested = "index.html" if decoded == "/" else decoded.lstrip("/")
        root = WEB_ROOT.resolve()
        file_path = (root / requested).resolve()
        if not file_path.is_relative_to(root):
            self._send_json(403, {"error": "Forbidden."})
            return
        if not file_path.is_file():
            if not Path(requested).suffix:
                file_path = root / "index.html"
            else:
                self._send_json(404, {"error": "Not found."})
                return
        try:
            content = file_path.read_bytes()
        except FileNotFoundError:
            self._send_json(404, {"error": "Not found."})
            return
        except OSError:
            print(f"Static file request failed: {file_path}")
            self._send_json(500, {"error": "Unable to serve requested file."})
            return
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(file_path.name)[0] or "application/octet-stream")
        self.send_header("Cache-Control", "no-cache" if file_path.name == "index.html" else "public, max-age=3600")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(content)


def _nmea_listener() -> None:
    global nmea_listening, nmea_navigation, last_nmea_message_at
    udp_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        udp_socket.bind((NMEA_HOST, NMEA_PORT))
        udp_socket.settimeout(1)
        nmea_listening = True
        print(f"NMEA UDP listener bound to {NMEA_HOST}:{NMEA_PORT}")
        while not stop_event.is_set():
            try:
                message, _ = udp_socket.recvfrom(65535)
            except socket.timeout:
                continue
            except OSError:
                if not stop_event.is_set():
                    raise
                break
            for line in message.decode("utf-8", errors="replace").splitlines():
                ais_update = local_ais_decoder.decode_line(line.strip())
                if ais_update:
                    _upsert_ais_target(ais_update)
                    broadcast_navigation()
                update = parse_nmea_sentence(line)
                if not update:
                    continue
                with state_lock:
                    previous = nmea_navigation
                    nmea_navigation = {
                        **previous,
                        **update,
                        "speed": _merge_speed(update.get("speed"), previous["speed"]) if update.get("speed") else previous["speed"],
                        "compass": _merge_compass(update.get("compass"), previous["compass"]) if update.get("compass") else previous["compass"],
                        "apparentWind": update.get("apparentWind", previous["apparentWind"]),
                        "trueWind": update.get("trueWind", previous["trueWind"]),
                        "depth": {
                            **(previous["depth"] or {}),
                            **update["depth"],
                            "temperature": (previous["depth"] or {}).get("temperature", update["depth"]["temperature"]),
                        } if update.get("depth") else previous["depth"],
                    }
                    last_nmea_message_at = int(time.time() * 1000)
                broadcast_navigation()
    except OSError as error:
        if not stop_event.is_set():
            nmea_listening = False
            print(f"NMEA UDP listener error: {error}")
    finally:
        nmea_listening = False
        udp_socket.close()


def main() -> None:
    if NMEA_PORT < 0 or NMEA_PORT > 65535:
        raise ValueError(f"Invalid NMEA_UDP_PORT value: {os.environ.get('NMEA_UDP_PORT', str(NMEA_PORT))}")
    http_server = NavigationHTTPServer((HOST, PORT), RequestHandler)
    if HOST not in ("127.0.0.1", "localhost", "::1"):
        print("WARNING: Backend is exposed beyond loopback. Use only on a trusted network; authentication and HTTPS are not configured.")

    if NMEA_PORT:
        threading.Thread(target=_nmea_listener, name="nmea-udp", daemon=True).start()
    threading.Thread(target=_aisstream_worker, name="aisstream", daemon=True).start()
    threading.Thread(target=_expire_ais_targets, name="ais-expiry", daemon=True).start()
    print(f"Navigation backend listening on http://{HOST}:{PORT}")
    print(f"NMEA UDP {'listening on ' + NMEA_HOST + ':' + str(NMEA_PORT) if NMEA_PORT else 'disabled'}")

    def shutdown(_signum: int, _frame: Any) -> None:
        stop_event.set()
        threading.Thread(target=http_server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    try:
        http_server.serve_forever(poll_interval=0.5)
    finally:
        stop_event.set()
        http_server.server_close()


if __name__ == "__main__":
    main()
