import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from server.app import _load_local_environment


class LocalEnvironmentTests(unittest.TestCase):
    def test_loads_settings_from_project_env_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, ".env").write_text("AISSTREAM_API_KEY=file-value\n", encoding="utf-8")
            with patch.dict(os.environ, {}, clear=True):
                _load_local_environment(Path(directory))
                self.assertEqual(os.environ["AISSTREAM_API_KEY"], "file-value")

    def test_process_environment_takes_precedence_over_env_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, ".env").write_text("AISSTREAM_API_KEY=file-value\n", encoding="utf-8")
            with patch.dict(os.environ, {"AISSTREAM_API_KEY": "process-value"}, clear=True):
                _load_local_environment(Path(directory))
                self.assertEqual(os.environ["AISSTREAM_API_KEY"], "process-value")


if __name__ == "__main__":
    unittest.main()
