"""Tests du service de routage (issue #14)."""

import os
import unittest
from unittest.mock import patch

try:
    from mynav_routing import ConstantWind

    ROUTING_AVAILABLE = True
except ImportError:
    ROUTING_AVAILABLE = False

from server import routing
from server.routing import RoutingError, compute_route, compute_route_payload, list_polars, load_polar

POLAR_PATH = os.path.join(os.path.dirname(__file__), os.pardir, "config", "polaire-sugar.pol")
START = (42.62, 3.02)
FINISH = (42.62, 3.5)


def west_wind_12kt():
    return ConstantWind(direction_from_deg=270, speed_kts=12)


@unittest.skipUnless(ROUTING_AVAILABLE, "mynav-routing non installé")
class TestLoadPolar(unittest.TestCase):
    def test_polaire_sugar_chargee(self):
        polar = load_polar(POLAR_PATH)
        self.assertEqual(
            polar.tws.tolist(), [4.0, 6.0, 8.0, 10.0, 12.0, 14.0, 16.0, 20.0, 24.0]
        )
        self.assertEqual(polar.twa[0], 0.0)
        self.assertEqual(polar.twa[-1], 180.0)

    def test_fichier_introuvable(self):
        with self.assertRaises(RoutingError) as context:
            load_polar("/chemin/inexistant.pol")
        self.assertIn("introuvable", str(context.exception))


@unittest.skipUnless(ROUTING_AVAILABLE, "mynav-routing non installé")
class TestComputeRoute(unittest.TestCase):
    def test_route_vent_arriere(self):
        result = compute_route(START, FINISH, wind=west_wind_12kt(), polar_path=POLAR_PATH)
        self.assertTrue(result["found"])
        self.assertTrue(3 * 3600 < result["eta_s"] < 6 * 3600)
        self.assertEqual(result["coords"][0], START)
        self.assertEqual(result["geojson"]["type"], "FeatureCollection")
        self.assertEqual(
            result["geojson"]["features"][0]["geometry"]["type"], "LineString"
        )

    def test_horizon_depasse(self):
        # Issue #17 : la meilleure progression est retournée, pas une erreur.
        result = compute_route(
            START, FINISH, wind=west_wind_12kt(), polar_path=POLAR_PATH, horizon_h=2.0
        )
        self.assertFalse(result["found"])
        self.assertIn("Aucune route trouvée", result["message"])
        self.assertGreater(len(result["coords"]), 0)
        self.assertIsNone(result["geojson"])
        self.assertGreater(result["min_dist_nm"], 0.0)

    def test_positions_invalides(self):
        for position in [(91.0, 3.0), (42.0, 200.0), None]:
            with self.assertRaises(RoutingError):
                compute_route(position, FINISH, wind=west_wind_12kt(), polar_path=POLAR_PATH)

    def test_depart_egale_arrivee(self):
        with self.assertRaises(RoutingError):
            compute_route(START, START, wind=west_wind_12kt(), polar_path=POLAR_PATH)

    def test_sans_vent(self):
        with self.assertRaises(RoutingError):
            compute_route(START, FINISH, polar_path=POLAR_PATH)


class TestRoutingUnavailable(unittest.TestCase):
    def test_erreur_claire_si_moteur_absent(self):
        if routing.ROUTING_AVAILABLE:
            self.skipTest("mynav-routing est installé")
        with self.assertRaises(RoutingError) as context:
            compute_route(START, FINISH)
        self.assertIn("n'est pas installé", str(context.exception))


class TestListPolars(unittest.TestCase):
    def test_liste_les_polaires_embarquees(self):
        polars = list_polars()
        self.assertTrue(any(polar["id"] == "polaire-sugar" for polar in polars))
        for polar in polars:
            self.assertTrue(polar["id"])
            self.assertTrue(polar["name"])
            self.assertTrue(polar["path"].endswith(".pol"))
            self.assertTrue(os.path.isfile(polar["path"]))


@unittest.skipUnless(ROUTING_AVAILABLE, "mynav-routing non installé")
class TestComputeRoutePayload(unittest.TestCase):
    """Payload POST de l'API de calcul de route (issue #17)."""

    def payload(self, **overrides):
        base = {
            "start": {"latitude": 42.62, "longitude": 3.02},
            "finish": {"latitude": 42.62, "longitude": 3.5},
            "polarId": "polaire-sugar",
            "wind": {"directionFromDeg": 270, "speedKts": 12},
        }
        base.update(overrides)
        return base

    def test_payload_complet_route_trouvee(self):
        result = compute_route_payload(self.payload())
        self.assertTrue(result["found"])
        self.assertGreater(result["etaS"], 0.0)
        self.assertEqual(result["geojson"]["type"], "FeatureCollection")
        self.assertEqual(result["geojson"]["features"][0]["geometry"]["type"], "LineString")
        self.assertEqual(result["wind"], {"directionFromDeg": 270.0, "speedKts": 12.0})
        self.assertEqual(result["windSource"], "constant")
        self.assertEqual(result["polarId"], "polaire-sugar")
        self.assertEqual(result["start"], {"latitude": 42.62, "longitude": 3.02})

    def test_payload_avec_grib_frais(self):
        # Issue #16 : un GRIB frais remplace le vent constant.
        with patch("server.grib.load_wind_field", return_value=west_wind_12kt()):
            result = compute_route_payload(self.payload())
        self.assertEqual(result["windSource"], "grib")
        self.assertTrue(result["found"])

    def test_payload_sans_vent_defaut_test(self):
        result = compute_route_payload(self.payload(wind=None))
        self.assertTrue(result["found"])
        self.assertEqual(result["wind"], {"directionFromDeg": 270.0, "speedKts": 12.0})

    def test_polaire_inconnue(self):
        with self.assertRaises(RoutingError) as context:
            compute_route_payload(self.payload(polarId="inconnue"))
        self.assertIn("Polaire inconnue", str(context.exception))

    def test_positions_invalides(self):
        with self.assertRaises(RoutingError):
            compute_route_payload(self.payload(start={"latitude": 91.0, "longitude": 0.0}))
        with self.assertRaises(RoutingError):
            compute_route_payload(self.payload(finish=None))

    def test_payload_non_dict(self):
        with self.assertRaises(RoutingError):
            compute_route_payload("pas un dict")


if __name__ == "__main__":
    unittest.main()
