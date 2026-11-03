"""Tests des outils de cache de tuiles offline (issue #148).

Cible tools/download_tiles.py (stdlib uniquement) : énumération, validation
des zones, logique de rafraîchissement par mtime, marqueur quotidien et
téléchargement complet AVEC RÉSEAU MOCKÉ (aucune vraie requête).
"""

import os
import sys
import time
import unittest
import urllib.error
import urllib.request
from io import BytesIO
from unittest.mock import patch

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import tools.download_tiles as dt

PNG_BODY = dt.PNG_SIGNATURE + b"tile-data"


class FakeResponse:
    def __init__(self, body: bytes = PNG_BODY, status: int = 200):
        self._body = body
        self.status = status

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class TestEnumerate(unittest.TestCase):
    def test_bbox_petite_un_zoom(self):
        # Zone minuscule contenue dans une seule tuile à z8.
        tiles = dt.enumerate_tiles(47.0, -5.0, 47.001, -4.999, dt.zoom_range("8"), ["osm"])
        self.assertEqual(len(tiles), 1)
        self.assertEqual(tiles[0][0], "osm")
        self.assertEqual(tiles[0][1], 8)

    def test_nb_de_tuiles_par_zoom_x4(self):
        low = dt.enumerate_tiles(38.6, 1.6, 43.2, 5.2, dt.zoom_range("11"), ["osm"])
        high = dt.enumerate_tiles(38.6, 1.6, 43.2, 5.2, dt.zoom_range("12"), ["osm"])
        self.assertGreater(len(high), 3 * len(low))
        self.assertLess(len(high), 5 * len(low))

    def test_zoom_range_formats(self):
        self.assertEqual(len(dt.zoom_range("8-12")), 5)
        self.assertEqual(list(dt.zoom_range("14")), [14])

    def test_couches_multiples_double(self):
        one = dt.enumerate_tiles(47.0, -5.0, 47.5, -4.5, dt.zoom_range("10"), ["osm"])
        two = dt.enumerate_tiles(47.0, -5.0, 47.5, -4.5, dt.zoom_range("10"), ["osm", "seamark"])
        self.assertEqual(len(two), 2 * len(one))


class TestLoadZones(unittest.TestCase):
    def setUp(self):
        import json
        import tempfile
        self.json = json
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)

    def write_zones(self, data) -> str:
        path = os.path.join(self.tempdir.name, "zones.json")
        with open(path, "w", encoding="utf-8") as file:
            self.json.dump(data, file)
        return path

    def test_zone_valide(self):
        path = self.write_zones([
            {"name": "test", "bbox": [47.0, -5.0, 48.2, -2.5],
             "zooms": {"osm": "8-12", "seamark": "12-13"}},
        ])
        zones = dt.load_zones(path)
        self.assertEqual(zones[0]["name"], "test")
        self.assertEqual(zones[0]["bbox"], (47.0, -5.0, 48.2, -2.5))
        self.assertEqual(zones[0]["zooms"]["osm"], dt.zoom_range("8-12"))
        self.assertEqual(zones[0]["zooms"]["seamark"], dt.zoom_range("12-13"))

    def test_bbox_inversee_normalisee(self):
        path = self.write_zones([
            {"name": "inv", "bbox": [48.2, -2.5, 47.0, -5.0], "zooms": {"osm": 10}},
        ])
        zones = dt.load_zones(path)
        self.assertEqual(zones[0]["bbox"], (47.0, -5.0, 48.2, -2.5))

    def test_couche_inconnue_refusee(self):
        path = self.write_zones([
            {"name": "bad", "bbox": [47.0, -5.0, 48.2, -2.5], "zooms": {"satellite": "8-12"}},
        ])
        with self.assertRaises(ValueError):
            dt.load_zones(path)

    def test_bbox_absente_refusee(self):
        path = self.write_zones([{"name": "bad", "zooms": {"osm": "8-12"}}])
        with self.assertRaises(ValueError):
            dt.load_zones(path)

    def test_zones_reelles_livrees(self):
        # Le fichier livré (zones de Dom) doit être valide et raisonnable :
        # pas de zone au-delà de ~50 000 tuiles (garde-fou anti-explosion).
        zones = dt.load_zones(os.path.join(PROJECT_ROOT, "config", "tile_zones.json"))
        self.assertEqual(len(zones), 2)
        for zone in zones:
            count = dt.zone_tile_count(zone)
            self.assertGreater(count, 0)
            self.assertLess(count, 50000, f"zone {zone['name']} trop grosse : {count} tuiles")


class TestRefresh(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.target = os.path.join(self.tempdir.name, "8", "128", "99.png")
        os.makedirs(os.path.dirname(self.target), exist_ok=True)
        with open(self.target, "wb") as file:
            file.write(b"tile")

    def test_sans_refresh_days_tout_present_est_recent(self):
        self.assertTrue(dt.tile_is_recent(self.target, None))

    def test_recente_avec_refresh_days(self):
        self.assertTrue(dt.tile_is_recent(self.target, 30))

    def test_ancienne_retelechargee(self):
        old = time.time() - 40 * 86400
        os.utime(self.target, (old, old))
        self.assertFalse(dt.tile_is_recent(self.target, 30))

    def test_fichier_absent_jamais_recent(self):
        missing = os.path.join(self.tempdir.name, "missing.png")
        self.assertFalse(dt.tile_is_recent(missing, None))


class TestOnceADay(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)

    def test_marqueur_cycle_complet(self):
        out = self.tempdir.name
        self.assertFalse(dt.already_ran_today(out))
        dt.mark_ran_today(out)
        self.assertTrue(dt.already_ran_today(out))
        # Un marqueur périmé (hier) ne bloque pas.
        with open(dt.marker_path(out), "w", encoding="utf-8") as file:
            file.write("2000-01-01")
        self.assertFalse(dt.already_ran_today(out))


class TestDownloadTilesMocked(unittest.TestCase):
    """Téléchargement complet avec urlopen mocké — aucune vraie requête."""

    def setUp(self):
        import tempfile
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.out = self.tempdir.name
        self.tiles = [("osm", 8, 130, 99), ("seamark", 12, 2100, 1580)]

    def test_telechargement_puis_skip(self):
        with patch.object(urllib.request, "urlopen", return_value=FakeResponse(dt.PNG_SIGNATURE + b"tile-a")):
            counts = dt.download_tiles(self.tiles, out=self.out, delay=0)
        self.assertEqual(counts["downloaded"], 2)
        self.assertTrue(os.path.isfile(os.path.join(self.out, "osm", "8", "130", "99.png")))
        # 2e run : tout est en cache, aucune requête (urlopen lèverait sinon).
        def boom(*args, **kwargs):
            raise AssertionError("aucune requête attendue pour des tuiles en cache")
        with patch.object(urllib.request, "urlopen", side_effect=boom):
            counts = dt.download_tiles(self.tiles, out=self.out, delay=0)
        self.assertEqual(counts["downloaded"], 0)
        self.assertEqual(counts["skipped"], 2)

    def test_404_pleine_mer_pas_sauvegardee(self):
        def fake_urlopen(request, timeout=None):
            raise urllib.error.HTTPError(request.full_url, 404, "Not Found", {}, None)
        with patch.object(urllib.request, "urlopen", side_effect=fake_urlopen):
            counts = dt.download_tiles([("seamark", 12, 999, 999)], out=self.out, delay=0)
        self.assertEqual(counts["absent"], 1)
        self.assertFalse(os.path.isfile(os.path.join(self.out, "seamark", "12", "999", "999.png")))

    def test_refresh_ancienne_retelechargee(self):
        with patch.object(urllib.request, "urlopen", return_value=FakeResponse(dt.PNG_SIGNATURE + b"old")):
            dt.download_tiles(self.tiles, out=self.out, delay=0)
        # On vieillit une tuile de plus de 30 jours.
        target = os.path.join(self.out, "osm", "8", "130", "99.png")
        old = time.time() - 40 * 86400
        os.utime(target, (old, old))
        with patch.object(urllib.request, "urlopen", return_value=FakeResponse(dt.PNG_SIGNATURE + b"new")):
            counts = dt.download_tiles(self.tiles, out=self.out, delay=0, refresh_days=30)
        self.assertEqual(counts["refreshed"], 1)   # l'ancienne, re-téléchargée
        self.assertEqual(counts["skipped"], 1)     # la récente, ignorée
        with open(target, "rb") as file:
            self.assertEqual(file.read(), dt.PNG_SIGNATURE + b"new")

    def test_plafond_duree(self):
        # max_minutes=0 : arrêt après la première tuile traitée.
        with patch.object(urllib.request, "urlopen", return_value=FakeResponse()) as mock:
            counts = dt.download_tiles(self.tiles, out=self.out, delay=0, max_minutes=0)
        self.assertEqual(counts["capped"], 1)
        self.assertEqual(mock.call_count, 1)

    def test_contenu_non_png_rejete(self):
        # Réponse 200 mais HTML (page d'erreur) : jamais sauvegardée.
        with patch.object(urllib.request, "urlopen", return_value=FakeResponse(b"<html>blocked</html>")):
            counts = dt.download_tiles([("osm", 8, 130, 99)], out=self.out, delay=0)
        self.assertEqual(counts["failed"], 1)
        self.assertFalse(os.path.isfile(os.path.join(self.out, "osm", "8", "130", "99.png")))

    def test_403_arret_immediat(self):
        # Blocage serveur : la 2e tuile ne doit PAS être requêtée.
        def fake_urlopen(request, timeout=None):
            raise urllib.error.HTTPError(request.full_url, 403, "Forbidden", {}, None)
        with patch.object(urllib.request, "urlopen", side_effect=fake_urlopen) as mock:
            counts = dt.download_tiles(self.tiles, out=self.out, delay=0)
        self.assertEqual(counts["blocked"], 1)
        self.assertEqual(mock.call_count, 1, "arrêt immédiat attendu sur 403")
        self.assertFalse(os.path.exists(os.path.join(self.out, "osm")))

    def test_user_agent_contient_contact(self):
        # Politique OSM : UA identifié AVEC coordonnées de contact.
        captured = {}
        def fake_urlopen(request, timeout=None):
            captured["ua"] = request.get_header("User-agent")
            return FakeResponse()
        with patch.object(urllib.request, "urlopen", side_effect=fake_urlopen):
            dt.download_tiles(self.tiles, out=self.out, delay=0)
        self.assertIn("github.com/Dom6881org/MyNavApp", captured["ua"])


class TestMainGlue(unittest.TestCase):
    """main() en mode zones : téléchargement + marqueur quotidien, réseau mocké."""

    def setUp(self):
        import contextlib
        import io
        import json
        import tempfile
        self.contextlib = contextlib
        self.io = io
        self.json = json
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.out = os.path.join(self.tempdir.name, "tiles")
        self.zones_path = os.path.join(self.tempdir.name, "zones.json")
        with open(self.zones_path, "w", encoding="utf-8") as file:
            self.json.dump([{
                "name": "mini", "bbox": [47.0, -5.0, 47.01, -4.99],
                "zooms": {"osm": "10", "seamark": "12"},
            }], file)

    def run_main(self, *extra):
        argv = [
            "download_tiles.py", "--zones", self.zones_path, "--out", self.out,
            "--delay", "0", "--skip-online-check", *extra,
        ]
        with patch.object(sys, "argv", argv):
            stdout = self.io.StringIO()
            with self.contextlib.redirect_stdout(stdout):
                code = dt.main()
        return code, stdout.getvalue()

    def test_run_puis_deja_fait_aujourd_hui(self):
        with patch.object(urllib.request, "urlopen", return_value=FakeResponse(dt.PNG_SIGNATURE + b"tile")) as mock:
            code, output = self.run_main("--once-a-day")
        self.assertEqual(code, 0)
        self.assertGreaterEqual(mock.call_count, 1)
        self.assertTrue(dt.already_ran_today(self.out), "marqueur quotidien posé")
        # Second run le même jour : exit 0 immédiat, AUCUNE requête réseau.
        def boom(*args, **kwargs):
            raise AssertionError("aucune requête attendue après le run du jour")
        with patch.object(urllib.request, "urlopen", side_effect=boom):
            code, output = self.run_main("--once-a-day")
        self.assertEqual(code, 0)
        self.assertIn("déjà", output)
        # --force passe outre le marqueur.
        with patch.object(urllib.request, "urlopen", return_value=FakeResponse()):
            code, output = self.run_main("--once-a-day", "--force")
        self.assertEqual(code, 0)

    def test_dry_run_ne_pose_pas_le_marqueur(self):
        with patch.object(urllib.request, "urlopen", return_value=FakeResponse()):
            code, output = self.run_main("--once-a-day", "--dry-run")
        self.assertEqual(code, 0)
        self.assertFalse(dt.already_ran_today(self.out), "dry-run ≠ mise à jour du jour")

    def test_zones_invalides_exit_2(self):
        with open(self.zones_path, "w", encoding="utf-8") as file:
            file.write("pas un json")
        with patch.object(urllib.request, "urlopen", return_value=FakeResponse()):
            code, output = self.run_main()
        self.assertEqual(code, 2)
        self.assertIn("invalides", output.lower())

    def test_bloque_exit_3_sans_marqueur(self):
        # Blocage serveur en cours de run : exit 3 et marqueur NON posé
        # (le run suivant pourra retenter après la levée du blocage).
        def fake_urlopen(request, timeout=None):
            raise urllib.error.HTTPError(request.full_url, 403, "Forbidden", {}, None)
        with patch.object(urllib.request, "urlopen", side_effect=fake_urlopen):
            code, output = self.run_main("--once-a-day")
        self.assertEqual(code, 3)
        self.assertFalse(dt.already_ran_today(self.out), "blocage : le marqueur ne doit pas être posé")
        self.assertIn("blocage", output.lower())


if __name__ == "__main__":
    unittest.main()
