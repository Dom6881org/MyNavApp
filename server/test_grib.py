"""Tests du module GRIB : composantes, grille, cache, écriture/llecture (issue #16)."""

import json
import math
import os
import tempfile
import time
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from server import grib
from server.grib import GribError, download_grib, grid_points, status, wind_components

try:
    from mynav_routing import GRIBWindField

    ROUTING_AVAILABLE = True
except ImportError:
    ROUTING_AVAILABLE = False


class FakeResponse:
    def __init__(self, body):
        self._body = body

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def open_meteo_payload(times, speed_ms, direction_deg):
    """Réponse Open-Météo factice : chaque point de la grille reçoit le même vent."""
    hourly = {
        "time": [moment.strftime("%Y-%m-%dT%H:%M") for moment in times],
        "wind_speed_10m": [speed_ms] * len(times),
        "wind_direction_10m": [direction_deg] * len(times),
    }
    return lambda url: FakeResponse(json.dumps([{"hourly": hourly} for _ in range(9)]).encode("utf-8"))


class TestWindComponents(unittest.TestCase):
    def test_vent_douest_vers_est(self):
        # Vent de 270° (ouest) : le vecteur de déplacement pointe vers l'est.
        u, v = wind_components(5.0, 270.0)
        self.assertAlmostEqual(u, 5.0)
        self.assertAlmostEqual(v, 0.0)

    def test_vent_de_nord_vers_sud(self):
        u, v = wind_components(5.0, 0.0)
        self.assertAlmostEqual(u, 0.0)
        self.assertAlmostEqual(v, -5.0)

    def test_vent_de_sud_est(self):
        # 135° (sud-est) : déplacement vers le nord-ouest.
        u, v = wind_components(10.0, 135.0)
        self.assertAlmostEqual(u, -10.0 * math.sin(math.radians(135)))
        self.assertAlmostEqual(v, -10.0 * math.cos(math.radians(135)))


class TestGridPoints(unittest.TestCase):
    def test_grille_3x3(self):
        lats, lons = grid_points(46.0, 47.0, -5.0, -4.0, 0.5)
        self.assertEqual(lats, [47.0, 46.5, 46.0])
        self.assertEqual(lons, [-5.0, -4.5, -4.0])


class TestStatus(unittest.TestCase):
    def test_aucun_cache(self):
        with tempfile.TemporaryDirectory() as cache_dir:
            with patch.object(grib, "GRIB_CACHE_DIR", cache_dir):
                current = status()
        self.assertFalse(current["available"])
        self.assertFalse(current["fresh"])
        self.assertEqual(current["reason"], "no-grib")

    def test_grib_expire(self):
        with tempfile.TemporaryDirectory() as cache_dir:
            meta = {"validUntil": 1000.0, "createdAt": 500.0}
            with open(os.path.join(cache_dir, "latest.json"), "w", encoding="utf-8") as handle:
                json.dump(meta, handle)
            with open(os.path.join(cache_dir, "latest.grib2"), "wb") as handle:
                handle.write(b"")
            with patch.object(grib, "GRIB_CACHE_DIR", cache_dir):
                current = status()
        self.assertTrue(current["available"])
        self.assertFalse(current["fresh"])
        self.assertEqual(current["reason"], "expired")


class TestDownloadGrib(unittest.TestCase):
    def test_zone_invalide(self):
        with self.assertRaises(GribError):
            download_grib(47.0, 46.0, -5.0, -4.0)
        with self.assertRaises(GribError):
            download_grib(46.0, 47.0, -5.0, -4.0, horizon_h=0.5)

    def test_zone_trop_fine(self):
        with self.assertRaises(GribError):
            download_grib(40.0, 50.0, -10.0, 10.0, horizon_h=24.0, resolution=0.05)

    @unittest.skipUnless(grib.ECCODES_AVAILABLE, "ecCodes non installé")
    @unittest.skipUnless(ROUTING_AVAILABLE, "mynav-routing non installé")
    def test_telechargement_ecriture_puis_lecture_moteur(self):
        start = datetime(2026, 10, 31, 0, 0, tzinfo=timezone.utc)
        times = [start + timedelta(hours=h) for h in range(24)]
        opener = open_meteo_payload(times, speed_ms=5.0, direction_deg=270.0)
        with tempfile.TemporaryDirectory() as cache_dir:
            with patch.object(grib, "GRIB_CACHE_DIR", cache_dir):
                meta = download_grib(
                    46.0, 47.0, -5.0, -4.0, horizon_h=6.0, step_h=3.0, opener=opener
                )
                current = status()
                wind_field = grib.load_wind_field()
                u, v = wind_field.sample([46.5], [-4.5], 0)

        # Zone 2° x 1° à 0.5° -> 3x3 points, 3 pas (0 h, 3 h, 6 h).
        self.assertEqual(meta["points"], 9)
        self.assertEqual(meta["steps"], 3)
        self.assertTrue(current["fresh"])
        self.assertIsNotNone(wind_field)
        # Critère d'acceptation #16 : le moteur charge le fichier sans erreur.
        # Vent d'ouest 5 m/s : vecteur vers l'est, positif.
        self.assertGreater(u[0], 0.0)
        # Contrat du moteur (fix mynav-routing PR#3) : sample() convertit m/s en
        # nœuds -> 5 m/s ≈ 9.72 nœuds.
        self.assertAlmostEqual(u[0], 5.0 * grib.MS_TO_KNOTS, places=3)

    def test_url_open_meteo_grille_aplatie(self):
        # Open-Météo apparie latitude/longitude élément par élément : la requête
        # doit contenir n_lat*n_lon couples (sinon HTTP 400), point p = j*n_lon+i.
        import urllib.parse

        captured = {}

        def capturing_opener(url):
            captured["url"] = url
            times = [datetime(2026, 10, 31, 0, 0, tzinfo=timezone.utc)]
            return open_meteo_payload(times, 5.0, 270.0)(url)

        with tempfile.TemporaryDirectory() as cache_dir:
            with patch.object(grib, "GRIB_CACHE_DIR", cache_dir):
                with patch.object(grib, "ECCODES_AVAILABLE", False):
                    try:
                        download_grib(46.0, 47.0, -5.0, -4.0, horizon_h=1.0, step_h=3.0, opener=capturing_opener)
                    except GribError:
                        pass  # l'écriture échoue sans ecCodes, mais l'URL est capturée
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(captured["url"]).query)
        lats = query["latitude"][0].split(",")
        lons = query["longitude"][0].split(",")
        self.assertEqual(len(lats), len(lons))
        self.assertEqual(len(lats), 9)  # grille 3x3 aplatie
        # appariement : lat[0..2] = 47.0 (n_lon=3), lon[0..2] = -5.0,-4.5,-4.0
        self.assertEqual(lats[:3], ["47.0", "47.0", "47.0"])
        self.assertEqual(lons[:3], ["-5.0", "-4.5", "-4.0"])
        self.assertEqual(lats[3], "46.5")

    def test_erreur_http_open_meteo_detail_relay(self):
        # Le corps de l'erreur HTTP Open-Météo (champ "reason") doit apparaître
        # dans le message, sinon le 400 est incompréhensible côté UI.
        import urllib.error

        def http_400_opener(url):
            body = json.dumps({"error": True, "reason": "Parameter 'latitude' and 'longitude' must have the same number of elements"}).encode("utf-8")
            raise urllib.error.HTTPError(url, 400, "Bad Request", {}, io.BytesIO(body))

        import io

        with tempfile.TemporaryDirectory() as cache_dir:
            with patch.object(grib, "GRIB_CACHE_DIR", cache_dir):
                with self.assertRaises(GribError) as context:
                    download_grib(46.0, 47.0, -5.0, -4.0, opener=http_400_opener)
        message = str(context.exception)
        self.assertIn("HTTP 400", message)
        self.assertIn("same number of elements", message)

    @unittest.skipUnless(grib.ECCODES_AVAILABLE, "ecCodes non installé")
    def test_index_cfgrib_obsolète_purgé(self):
        # Un .idx plus ancien que le GRIB réécrit fait crier ecCodes
        # (« Ignoring index file ... older than GRIB file ») : il est supprimé.
        start = datetime(2026, 10, 31, 0, 0, tzinfo=timezone.utc)
        times = [start + timedelta(hours=h) for h in range(24)]
        opener = open_meteo_payload(times, 5.0, 270.0)
        with tempfile.TemporaryDirectory() as cache_dir:
            with patch.object(grib, "GRIB_CACHE_DIR", cache_dir):
                grib_path = os.path.join(cache_dir, grib.GRIB_FILE)
                with open(grib_path, "wb") as handle:
                    handle.write(b"ancien grib")
                stale_idx = grib_path + ".5b7b6.idx"
                with open(stale_idx, "wb") as handle:
                    handle.write(b"idx")
                os.utime(grib_path, (time.time() + 100, time.time() + 100))  # GRIB plus récent
                download_grib(46.0, 47.0, -5.0, -4.0, horizon_h=6.0, step_h=3.0, opener=opener)
                self.assertFalse(os.path.exists(stale_idx))

    def test_register_eccodes_library_trouve_la_dll(self):
        # Sans conda : un dossier contenant la bibliothèque native (paquet
        # conda-forge extrait) est enregistré via MYNAV_ECCODES_BIN.
        lib_name = "eccodes.dll" if os.name == "nt" else "libeccodes.so"
        with tempfile.TemporaryDirectory() as fake_bin:
            with open(os.path.join(fake_bin, lib_name), "wb") as handle:
                handle.write(b"")
            with patch.dict(os.environ, {"MYNAV_ECCODES_BIN": fake_bin}):
                old_path = os.environ.get("PATH", "")
                self.assertTrue(grib._register_eccodes_library())
                self.assertIn(fake_bin, os.environ["PATH"])
                os.environ["PATH"] = old_path

    def test_register_eccodes_library_absente(self):
        with patch.dict(os.environ, {"MYNAV_ECCODES_BIN": tempfile.mkdtemp()}):
            with patch.object(grib, "_register_eccodes_library", grib._register_eccodes_library):
                pass
        # Aucun candidat valide -> False (environnement sans paquet ecCodes extrait)
        with patch.dict(os.environ, {"MYNAV_ECCODES_BIN": ""}, clear=False):
            if os.name != "nt":
                self.skipTest("chemin Windows")
            # ~/eccodes-win existe peut-etre sur la machine de dev : on isole HOME
            with tempfile.TemporaryDirectory() as fake_home:
                with patch.object(grib.os.path, "expanduser", lambda _: fake_home):
                    self.assertFalse(grib._register_eccodes_library())

    def test_erreur_reseau_message_clair(self):
        def broken_opener(url):
            raise OSError("network down")

        with tempfile.TemporaryDirectory() as cache_dir:
            with patch.object(grib, "GRIB_CACHE_DIR", cache_dir):
                with self.assertRaises(GribError) as context:
                    download_grib(46.0, 47.0, -5.0, -4.0, opener=broken_opener)
        self.assertIn("Open-Météo", str(context.exception))


if __name__ == "__main__":
    unittest.main()
