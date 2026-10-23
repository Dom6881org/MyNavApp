import unittest
from unittest.mock import patch

from server.ais import LocalAISDecoder, parse_internet_message
from server import app


class AisDecoderTests(unittest.TestCase):
    def test_decodes_local_vhf_position_report(self) -> None:
        decoder = LocalAISDecoder()
        update = decoder.decode_line("!AIVDO,1,1,,A,15M67FOP1sG?ur@E`FL8T@01P000,0*2A")
        self.assertIsNotNone(update)
        assert update is not None
        self.assertEqual(update["mmsi"], "366053209")
        self.assertAlmostEqual(update["latitude"], 37.802)
        self.assertAlmostEqual(update["longitude"], -122.341)
        self.assertAlmostEqual(update["sog"], 12.3)
        self.assertAlmostEqual(update["cog"], 219.3)
        self.assertEqual(update["source"], "local")

    def test_ignores_non_ais_and_invalid_nmea(self) -> None:
        decoder = LocalAISDecoder()
        self.assertIsNone(decoder.decode_line("$GPRMC,123519,A,,,,,,,"))
        self.assertIsNone(decoder.decode_line("!AIVDM,1,1,,A,invalid,0*00"))

    def test_normalizes_aisstream_position_report(self) -> None:
        update = parse_internet_message({
            "MessageType": "PositionReport",
            "MetaData": {
                "MMSI": 123456789,
                "ShipName": "TEST VESSEL",
                "Latitude": 48.1,
                "Longitude": -4.5,
            },
            "Message": {
                "PositionReport": {
                    "UserID": 123456789,
                    "Sog": 8.4,
                    "Cog": 270.5,
                    "TrueHeading": 271,
                    "NavigationalStatus": 0,
                    "Valid": True,
                }
            },
        })
        self.assertIsNotNone(update)
        assert update is not None
        self.assertEqual(update["mmsi"], "123456789")
        self.assertEqual(update["name"], "TEST VESSEL")
        self.assertEqual(update["latitude"], 48.1)
        self.assertEqual(update["longitude"], -4.5)
        self.assertEqual(update["sog"], 8.4)
        self.assertEqual(update["source"], "internet")

    def test_rejects_non_position_messages_without_coordinates(self) -> None:
        self.assertIsNone(parse_internet_message({
            "MessageType": "PositionReport",
            "MetaData": {"MMSI": 123456789},
            "Message": {"PositionReport": {"UserID": 123456789}},
        }))
        self.assertIsNone(parse_internet_message({"MessageType": "SubscriptionConfirmation"}))

    def test_rejects_invalid_position_report(self) -> None:
        self.assertIsNone(parse_internet_message({
            "MessageType": "PositionReport",
            "MetaData": {
                "MMSI": 123456789,
                "Latitude": 48.1,
                "Longitude": -4.5,
            },
            "Message": {"PositionReport": {"UserID": 123456789, "Valid": False}},
        }))

    def test_target_state_keeps_static_and_dynamic_data_together(self) -> None:
        isolated_targets = {"local": {}, "internet": {}}
        with patch.object(app, "ais_targets", isolated_targets):
            app._upsert_ais_target({
                "mmsi": "123456789",
                "latitude": 48.1,
                "longitude": -4.5,
                "sog": 7.2,
                "source": "local",
                "updatedAt": 1000,
            })
            app._upsert_ais_target({
                "mmsi": "123456789",
                "name": "TEST VESSEL",
                "source": "local",
                "updatedAt": 2000,
            })
        target = isolated_targets["local"]["123456789"]
        self.assertEqual(target["name"], "TEST VESSEL")
        self.assertEqual(target["latitude"], 48.1)
        self.assertEqual(target["longitude"], -4.5)
        self.assertEqual(target["sog"], 7.2)
        self.assertIsNone(target["heading"])

    def test_internet_subscription_tracks_a_limited_area_around_vessel(self) -> None:
        with patch.object(app, "AISSTREAM_API_KEY", "test-key"):
            subscription = app._aisstream_subscription({"latitude": 43.6, "longitude": 1.4})
        southwest, northeast = subscription["BoundingBoxes"][0]
        self.assertEqual(subscription["APIKey"], "test-key")
        self.assertAlmostEqual(southwest[0], 43.35)
        self.assertAlmostEqual(northeast[0], 43.85)
        self.assertAlmostEqual(southwest[1] + northeast[1], 2.8)
        self.assertEqual(subscription["FilterMessageTypes"][0], "PositionReport")

    def test_internet_subscription_wraps_at_dateline_and_poles(self) -> None:
        with patch.object(app, "AISSTREAM_API_KEY", "test-key"):
            dateline = app._aisstream_subscription({"latitude": 0, "longitude": 179.9})
            polar = app._aisstream_subscription({"latitude": 89.9, "longitude": 0})
        self.assertEqual(len(dateline["BoundingBoxes"]), 2)
        self.assertEqual(dateline["BoundingBoxes"][0][1][1], 180)
        self.assertEqual(dateline["BoundingBoxes"][1][0][1], -180)
        self.assertEqual(polar["BoundingBoxes"][0][1][0], 90)

    def test_replay_position_takes_priority_for_aisstream_bounds(self) -> None:
        replay_position = {
            "position": {"latitude": 48.1, "longitude": -4.5},
            "receivedAt": 100_000,
        }
        navigation = {"position": {"latitude": 43.6, "longitude": 1.4}}
        with (
            patch.object(app, "ais_replay_position", replay_position),
            patch.object(app, "combine_fields", return_value={"navigation": navigation}),
            patch.object(app.time, "time", return_value=100),
        ):
            self.assertEqual(app._current_ais_position(), replay_position["position"])

    def test_stale_replay_position_falls_back_to_live_navigation(self) -> None:
        replay_position = {
            "position": {"latitude": 48.1, "longitude": -4.5},
            "receivedAt": 0,
        }
        navigation = {"position": {"latitude": 43.6, "longitude": 1.4}}
        with (
            patch.object(app, "ais_replay_position", replay_position),
            patch.object(app, "combine_fields", return_value={"navigation": navigation}),
            patch.object(app.time, "time", return_value=100),
        ):
            self.assertEqual(app._current_ais_position(), navigation["position"])

    def test_replay_position_validation_accepts_null_or_valid_coordinates(self) -> None:
        self.assertTrue(app._valid_ais_replay_position_update({"position": None}))
        self.assertTrue(app._valid_ais_replay_position_update({
            "position": {"latitude": 48.1, "longitude": -4.5}
        }))
        self.assertFalse(app._valid_ais_replay_position_update({
            "position": {"latitude": 91, "longitude": -4.5}
        }))
        self.assertFalse(app._valid_ais_replay_position_update({"position": "48.1,-4.5"}))


if __name__ == "__main__":
    unittest.main()
