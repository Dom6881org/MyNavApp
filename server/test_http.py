import unittest
from http.server import BaseHTTPRequestHandler
from unittest.mock import patch

from server.app import RequestHandler


class RequestHandlerTests(unittest.TestCase):
    def test_client_disconnect_exceptions_are_handled(self) -> None:
        for error in (BrokenPipeError(), ConnectionAbortedError(), ConnectionResetError()):
            with self.subTest(error=type(error).__name__):
                handler = RequestHandler.__new__(RequestHandler)
                with patch.object(BaseHTTPRequestHandler, "handle", side_effect=error):
                    handler.handle()
                self.assertTrue(handler.close_connection)

    def test_unexpected_handler_errors_are_not_suppressed(self) -> None:
        handler = RequestHandler.__new__(RequestHandler)
        with patch.object(BaseHTTPRequestHandler, "handle", side_effect=ValueError("unexpected")):
            with self.assertRaisesRegex(ValueError, "unexpected"):
                handler.handle()


if __name__ == "__main__":
    unittest.main()
