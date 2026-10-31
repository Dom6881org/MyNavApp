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
# Départ en pleine eau (~4 mn au large de Saint-Cyprien) : (42.62, 3.02) est
# classé "terre" par le masque Natural Earth (raster 10 m) et serait ramené à l'eau.
START = (42.62, 3.10)
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

    def test_depart_a_terre_rapproche_de_leau(self):
        # Point côtier (près de Colera, Espagne) classé "terre" par le masque
        # Natural Earth : le départ est ramené à l'eau la plus proche et la
        # route est trouvée (sinon le front s'effondre au premier pas).
        coastal_start = (42.39452716666666, 3.1637153333333337)
        coastal_finish = (42.41861, 3.22986)
        result = compute_route(coastal_start, coastal_finish, wind=west_wind_12kt(), polar_path=POLAR_PATH)
        self.assertTrue(result["found"])
        self.assertIsNotNone(result["start_adjusted"])
        self.assertGreater(result["start_adjusted"]["offset_nm"], 0.0)
        self.assertLessEqual(result["start_adjusted"]["offset_nm"], 2.0)
        self.assertAlmostEqual(result["coords"][0][0], result["start_adjusted"]["latitude"])
        self.assertAlmostEqual(result["coords"][0][1], result["start_adjusted"]["longitude"])
        self.assertIsNone(result["finish_adjusted"])

    def test_route_longue_au_pres_ne_zigzague_pas(self):
        # Colera -> Frioul, vent 355/7.2 nd : la maille d'élagage est déduite du
        # déplacement par pas (sinon la route oscille entre cellules adjacentes,
        # trace en zigzag et ETA dégradée).
        import math

        result = compute_route(
            (42.39325, 3.17302), (43.27649, 5.31225),
            wind=ConstantWind(direction_from_deg=355.0, speed_kts=7.2),
            polar_path=POLAR_PATH,
        )
        self.assertTrue(result["found"])
        self.assertLess(result["eta_s"], 30 * 3600)
        coords = result["coords"]
        caps = []
        for i in range(1, len(coords)):
            la1, lo1 = coords[i - 1]
            la2, lo2 = coords[i]
            caps.append(math.degrees(math.atan2(
                (lo2 - lo1) * math.cos(math.radians((la1 + la2) / 2)), la2 - la1
            )) % 360)
        turns = [
            min(abs(caps[i] - caps[i - 1]), 360 - abs(caps[i] - caps[i - 1]))
            for i in range(1, len(caps))
        ]
        avg_turn = sum(turns) / max(len(turns), 1)
        self.assertLess(avg_turn, 20.0)  # ~29 deg avec une maille trop large

    def test_depart_trop_a_terre(self):
        # Au milieu des terres (Paris) : aucune eau à moins de 2 mn -> message
        # explicite au lieu d'un faux "horizon dépassé".
        result = compute_route((48.8566, 2.3522), FINISH, wind=west_wind_12kt(), polar_path=POLAR_PATH)
        self.assertFalse(result["found"])
        self.assertIn("à terre", result["message"])
        self.assertIsNone(result["geojson"])
        self.assertEqual(result["coords"], [(48.8566, 2.3522)])

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
        # Cache GRIB neutralisé : le test ne dépend pas d'un éventuel GRIB frais.
        with patch("server.grib.load_wind_field", return_value=None):
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

    def test_payload_depart_a_terre_rapproche(self):
        result = compute_route_payload(self.payload(
            start={"latitude": 42.39452716666666, "longitude": 3.1637153333333337},
            finish={"latitude": 42.41861, "longitude": 3.22986},
        ))
        self.assertTrue(result["found"])
        self.assertIsNotNone(result["startAdjusted"])
        self.assertGreater(result["startAdjusted"]["offsetNm"], 0.0)
        self.assertIsNone(result["finishAdjusted"])
        # Le point demandé est renvoyé tel quel, l'ajustement est à part.
        self.assertEqual(
            result["start"], {"latitude": 42.39452716666666, "longitude": 3.1637153333333337}
        )

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

    def test_payload_bathy_active_flag(self):
        result = compute_route_payload(self.payload(useBathy=False))
        self.assertTrue(result["found"])
        self.assertFalse(result["bathyActive"])

    def test_payload_min_depth_invalide(self):
        with self.assertRaises(RoutingError):
            compute_route_payload(self.payload(minDepthM=-5))
        with self.assertRaises(RoutingError):
            compute_route_payload(self.payload(minDepthM="profond"))
        with self.assertRaises(RoutingError):
            compute_route_payload(self.payload(useBathy="oui"))


def _synthetic_bathy():
    """Grille GEBCO synthétique : haut-fond (-2 m) en travers de la route directe
    (lat >= 42.55, lon 3.15..3.32), départ/arrivée en eau profonde, passage au sud."""
    import numpy as np
    from mynav_routing import DepthMask

    lats = np.linspace(42.40, 42.75, 36)
    lons = np.linspace(2.95, 3.60, 66)
    elev = np.full((lats.size, lons.size), -100.0, dtype=np.float32)
    shallow = (
        (lats >= 42.55)[:, None]
        & (lons >= 3.15)[None, :]
        & (lons <= 3.32)[None, :]
    )
    elev[shallow] = -2.0
    return DepthMask.from_arrays(lats, lons, elev, default_min_depth_m=10.0)


@unittest.skipUnless(ROUTING_AVAILABLE, "mynav-routing non installé")
class TestBathy(unittest.TestCase):
    """Contrainte de profondeur GEBCO (issue #13)."""

    def setUp(self):
        self.saved_load = routing.load_bathy
        self.bathy = _synthetic_bathy()
        routing.load_bathy = lambda: self.bathy

    def tearDown(self):
        routing.load_bathy = self.saved_load

    def test_haut_fond_evite(self):
        """La route contourne le haut-fond : aucun point intermédiaire à moins de 10 m."""
        result = compute_route(
            START, FINISH, wind=west_wind_12kt(), polar_path=POLAR_PATH
        )
        self.assertTrue(result["found"])
        self.assertTrue(result["bathy_active"])
        for latitude, longitude in result["coords"]:
            if (latitude, longitude) == (42.62, 3.02):
                continue
            is_shallow = self.bathy.is_shallow(latitude, longitude)
            self.assertFalse(bool(is_shallow), f"point en eau peu profonde : {latitude}, {longitude}")

    def test_sans_bathy_passe_le_haut_fond(self):
        """Désactivée, la contrainte de profondeur ne change pas le routage."""
        routing.load_bathy = lambda: None
        result = compute_route(
            START, FINISH, wind=west_wind_12kt(), polar_path=POLAR_PATH, use_bathy=True
        )
        self.assertTrue(result["found"])
        self.assertFalse(result["bathy_active"])

    def test_use_bathy_false_desactive(self):
        routing.load_bathy = lambda: self.bathy
        result = compute_route(
            START, FINISH, wind=west_wind_12kt(), polar_path=POLAR_PATH, use_bathy=False
        )
        self.assertTrue(result["found"])
        self.assertFalse(result["bathy_active"])
        # La route directe traverse le haut-fond : au moins un point peu profond.
        shallow_points = [
            bool(self.bathy.is_shallow(latitude, longitude))
            for latitude, longitude in result["coords"]
        ]
        self.assertTrue(any(shallow_points))


if __name__ == "__main__":
    unittest.main()
