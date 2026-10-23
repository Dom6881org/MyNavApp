import json
import math
import mimetypes
import os
import queue
import signal
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
from typing import Any

from server.nmea import parse_nmea_sentence


PROJECT_ROOT = Path(__file__).resolve().parent.parent
WEB_ROOT = PROJECT_ROOT / "dist"
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "3001"))
NMEA_PORT = int(os.environ.get("NMEA_UDP_PORT", "10111"))
NMEA_HOST = os.environ.get("NMEA_UDP_HOST", "0.0.0.0")
IS_PRODUCTION = os.environ.get("NODE_ENV") == "production"
NMEA_FRESHNESS_MS = 5000
BROWSER_FRESHNESS_MS = 10_000

EMPTY_FIELDS = {
    "position": None,
    "speed": None,
    "compass": None,
    "depth": None,
    "apparentWind": None,
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


def combine_fields() -> dict[str, Any]:
    now = int(time.time() * 1000)
    with state_lock:
        nmea_connected = last_nmea_message_at is not None and now - last_nmea_message_at <= NMEA_FRESHNESS_MS
        browser_fresh = browser_navigation is not None and now - browser_navigation["receivedAt"] <= BROWSER_FRESHNESS_MS
        browser_fields = {
            "position": browser_navigation["position"],
            "speed": browser_navigation["speed"],
            "compass": browser_navigation["compass"],
            "depth": None,
            "apparentWind": None,
            "gpsTime": browser_navigation["gpsTime"],
            "gpsAccuracy": browser_navigation["gpsAccuracy"],
        } if browser_fresh and browser_navigation else EMPTY_FIELDS
        navigation = {
            "position": (nmea_navigation["position"] or browser_fields["position"]) if nmea_connected else browser_fields["position"],
            "speed": _merge_speed(nmea_navigation["speed"], browser_fields["speed"]) if nmea_connected else browser_fields["speed"],
            "compass": _merge_compass(nmea_navigation["compass"], browser_fields["compass"]) if nmea_connected else browser_fields["compass"],
            "depth": nmea_navigation["depth"] if nmea_connected else browser_fields["depth"],
            "apparentWind": nmea_navigation["apparentWind"] if nmea_connected else browser_fields["apparentWind"],
            "gpsTime": (nmea_navigation["gpsTime"] or browser_fields["gpsTime"]) if nmea_connected else browser_fields["gpsTime"],
            "gpsAccuracy": (nmea_navigation["gpsAccuracy"] if nmea_navigation["gpsAccuracy"] is not None else browser_fields["gpsAccuracy"]) if nmea_connected else browser_fields["gpsAccuracy"],
        }
        source = "nmea" if nmea_connected else "browser" if browser_fresh else "none"
        updated_at = last_nmea_message_at if nmea_connected else browser_navigation["receivedAt"] if browser_fresh and browser_navigation else None
        return {"source": source, "nmeaConnected": nmea_connected, "updatedAt": updated_at, "navigation": navigation}


def broadcast_navigation() -> None:
    global last_broadcast_message
    message = "data: " + json.dumps(combine_fields(), separators=(",", ":"), allow_nan=False) + "\n\n"
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


class NavigationHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class RequestHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

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
        elif path.startswith("/api/"):
            self._send_json(404, {"error": "API route not found."})
        elif not IS_PRODUCTION:
            self._send_json(404, {"error": "Development server routes frontend requests."})
        else:
            self._serve_static(path)

    def do_HEAD(self) -> None:
        path = urlsplit(self.path).path
        if path.startswith("/api/"):
            self._send_json(404, {"error": "API route not found."})
        elif not IS_PRODUCTION:
            self._send_json(404, {"error": "Development server routes frontend requests."})
        else:
            self._serve_static(path)

    def do_POST(self) -> None:
        if urlsplit(self.path).path != "/api/navigation/browser":
            self._send_json(404, {"error": "API route not found."} if urlsplit(self.path).path.startswith("/api/") else {"error": "Not found."})
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
        if not _valid_browser_update(value):
            self._send_json(400, {"error": "Invalid browser navigation payload."})
            return
        global browser_navigation
        with state_lock:
            browser_navigation = value
        snapshot = combine_fields()
        broadcast_navigation()
        self._send_json(202, snapshot)

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
