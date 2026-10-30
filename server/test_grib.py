"""Tests du module GRIB : composantes, grille, cache, écriture/llecture (issue #16)."""

import json
import math
import os
import tempfile
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
        # Contrat actuel du moteur : sample() retourne u10 (m/s) / 1.94384.
        self.assertAlmostEqual(u[0], 5.0 / grib.MS_TO_KNOTS, places=3)

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
