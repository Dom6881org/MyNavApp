import io
import tempfile
import unittest
from unittest.mock import MagicMock, Mock, patch
from urllib.error import URLError

from server import app
from server.app import RequestHandler, _fetch_remote_tile


PNG = b"\x89PNG\r\n\x1a\nvalid tile"


class TileProxyTests(unittest.TestCase):
    def setUp(self) -> None:
        self.handler = RequestHandler.__new__(RequestHandler)
        self.handler.wfile = io.BytesIO()
        self.handler.command = "GET"
        self.handler.send_response = Mock()
        self.handler.send_header = Mock()
        self.handler.end_headers = Mock()

    def _provider_response(self, content_type: str, body: bytes):
        response = MagicMock()
        response.__enter__.return_value = response
        response.headers.get.return_value = content_type
        response.read.return_value = body
        return response

    def test_fetch_remote_tile_identifies_client_and_validates_png(self) -> None:
        response = self._provider_response("image/png; charset=binary", PNG)
        with patch("server.app.urlopen", return_value=response) as urlopen:
            self.assertEqual(_fetch_remote_tile("osm", 3, 1, 2), PNG)

        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://a.tile.openstreetmap.org/3/1/2.png")
        self.assertIn("MyNavApp", request.get_header("User-agent"))
        urlopen.assert_called_once_with(request, timeout=10)

    def test_fetch_remote_tile_rejects_non_image_responses(self) -> None:
        response = self._provider_response("text/html", b"<html>blocked</html>")
        with patch("server.app.urlopen", return_value=response):
            with self.assertRaises(ValueError):
                _fetch_remote_tile("seamark", 3, 1, 2)

    def test_fetch_remote_tile_rejects_invalid_png_bytes(self) -> None:
        response = self._provider_response("image/png", b"<html>blocked</html>")
        with patch("server.app.urlopen", return_value=response):
            with self.assertRaises(ValueError):
                _fetch_remote_tile("osm", 3, 1, 2)

    def test_missing_cached_tile_is_proxied_same_origin(self) -> None:
        with tempfile.TemporaryDirectory() as tiles_dir, patch.object(app, "TILES_DIR", tiles_dir):
            with patch("server.app._fetch_remote_tile", return_value=PNG) as fetch:
                self.handler._send_tile("/api/tiles/osm/3/1/2.png")

        fetch.assert_called_once_with("osm", 3, 1, 2)
        self.handler.send_response.assert_called_once_with(200)
        self.assertEqual(self.handler.wfile.getvalue(), PNG)

    def test_provider_failure_returns_gateway_error(self) -> None:
        with tempfile.TemporaryDirectory() as tiles_dir, patch.object(app, "TILES_DIR", tiles_dir):
            with patch("server.app._fetch_remote_tile", side_effect=URLError("offline")):
                with patch.object(self.handler, "_send_json") as send_json:
                    self.handler._send_tile("/api/tiles/osm/3/1/2.png")

        send_json.assert_called_once_with(502, {"error": "Tile provider unavailable."})


if __name__ == "__main__":
    unittest.main()
