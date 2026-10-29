import json
import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree

from server.tracks import (
    TrackNotFoundError,
    TrackRecorder,
    TrackRecorderError,
    track_to_csv,
    track_to_geojson,
    track_to_gpx,
)


def navigation(latitude: float, longitude: float, sog: float | None = None, cog: float | None = None) -> dict:
    return {
        "position": {"latitude": latitude, "longitude": longitude},
        "speed": {"sog": sog},
        "compass": {"cog": cog},
        "depth": None,
        "gpsAccuracy": 3,
    }


class TrackRecorderTests(unittest.TestCase):
    def setUp(self) -> None:
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.directory = Path(directory.name)
        self.recorder = TrackRecorder(self.directory)

    def tearDown(self) -> None:
        # Libère le fichier de trace ouvert sous Windows avant le nettoyage.
        if self.recorder.status()["recording"]:
            self.recorder.stop()

    def test_start_creates_track_file(self) -> None:
        status = self.recorder.start(now_ms=1_000_000_000_000)
        self.assertTrue(status["recording"])
        self.assertEqual(status["trackId"], "track-20010909T014640Z")
        self.assertEqual(status["pointCount"], 0)
        self.assertIsNone(status["error"])
        self.assertTrue((self.directory / "track-20010909T014640Z.jsonl").is_file())

    def test_start_twice_is_rejected(self) -> None:
        self.recorder.start(now_ms=1_000_000_000_000)
        with self.assertRaises(TrackRecorderError):
            self.recorder.start(now_ms=1_000_000_001_000)

    def test_stop_without_active_track_is_rejected(self) -> None:
        with self.assertRaises(TrackRecorderError):
            self.recorder.stop()

    def test_record_filters_by_interval_distance_and_heartbeat(self) -> None:
        self.recorder.start(now_ms=1_000_000_000_000)
        self.recorder.record(navigation(42.0, 3.0, sog=5.2, cog=90), 1_000_000_000_000)
        # Trop tôt depuis le dernier point : ignoré.
        self.recorder.record(navigation(42.0, 3.0), 1_000_000_000_500)
        # Immobile (moins de MIN_DISTANCE_M) avant le battement de cœur : ignoré.
        self.recorder.record(navigation(42.0, 3.0), 1_000_000_002_000)
        self.assertEqual(self.recorder.status()["pointCount"], 1)
        # Environ 8 mètres parcourus : le point est conservé.
        self.recorder.record(navigation(42.0, 3.0001), 1_000_000_003_200)
        self.assertEqual(self.recorder.status()["pointCount"], 2)
        # Battement de cœur au mouillage : un point toutes les 60 s.
        self.recorder.record(navigation(42.0, 3.0), 1_000_000_064_000)
        self.assertEqual(self.recorder.status()["pointCount"], 3)

    def test_record_ignores_invalid_positions(self) -> None:
        self.recorder.start(now_ms=1_000_000_000_000)
        self.recorder.record({"position": None}, 1_000_000_000_000)
        self.recorder.record({"position": {"latitude": 999, "longitude": 3}}, 1_000_000_000_000)
        self.recorder.record(navigation(42.0, 3.0), 1_000_000_000_000)
        self.assertEqual(self.recorder.status()["pointCount"], 1)

    def test_record_without_active_track_is_ignored(self) -> None:
        self.recorder.record(navigation(42.0, 3.0), 1_000_000_000_000)
        self.assertFalse(self.recorder.status()["recording"])
        self.assertEqual(self.recorder.list_tracks(), [])

    def test_stop_finalizes_track(self) -> None:
        self.recorder.start(now_ms=1_000_000_000_000)
        self.recorder.record(navigation(42.0, 3.0), 1_000_000_000_000)
        self.recorder.record(navigation(42.0, 3.0001), 1_000_000_002_000)
        stopped = self.recorder.stop()
        self.assertEqual(stopped["id"], "track-20010909T014640Z")
        self.assertEqual(stopped["pointCount"], 2)
        self.assertEqual(stopped["endedAt"], 1_000_000_002_000)
        self.assertFalse(self.recorder.status()["recording"])
        tracks = self.recorder.list_tracks()
        self.assertEqual(len(tracks), 1)
        self.assertEqual(tracks[0]["pointCount"], 2)
        self.assertEqual(tracks[0]["endedAt"], 1_000_000_002_000)
        self.assertGreater(tracks[0]["sizeBytes"], 0)

    def test_list_tracks_rebuilds_summary_after_abrupt_stop(self) -> None:
        # Fichier sans ligne finale "type: end" (coupure de courant simulée).
        path = self.directory / "track-20260101T000000Z.jsonl"
        path.write_text(
            '{"type":"meta","id":"track-20260101T000000Z","startedAt":1000}\n'
            '{"timestampMs":1500,"latitude":42.0,"longitude":3.0,"sog":5.0,"cog":90.0,"heading":null,"depth":null,"gpsAccuracy":3}\n',
            encoding="utf-8",
        )
        tracks = self.recorder.list_tracks()
        self.assertEqual(len(tracks), 1)
        self.assertEqual(tracks[0]["startedAt"], 1000)
        self.assertEqual(tracks[0]["pointCount"], 1)
        self.assertEqual(tracks[0]["endedAt"], 1500)

    def test_load_points_and_unknown_identifiers(self) -> None:
        self.recorder.start(now_ms=1_000_000_000_000)
        self.recorder.record(navigation(42.0, 3.0, sog=5.2, cog=90), 1_000_000_000_000)
        track_id = self.recorder.status()["trackId"]
        self.recorder.stop()
        points = self.recorder.load_points(track_id)
        self.assertEqual(len(points), 1)
        self.assertEqual(points[0]["sog"], 5.2)
        for invalid_id in ("../" + track_id, "track-123", "track-20260101T000000Z"):
            with self.subTest(track_id=invalid_id):
                with self.assertRaises(TrackNotFoundError):
                    self.recorder.load_points(invalid_id)

    def test_delete_active_track_is_rejected_then_deleted(self) -> None:
        self.recorder.start(now_ms=1_000_000_000_000)
        track_id = self.recorder.status()["trackId"]
        with self.assertRaises(TrackRecorderError):
            self.recorder.delete_track(track_id)
        self.recorder.stop()
        self.recorder.delete_track(track_id)
        self.assertEqual(self.recorder.list_tracks(), [])

    def test_geojson_export(self) -> None:
        summary = {"id": "track-20260101T000000Z", "startedAt": 1000, "endedAt": 2000, "pointCount": 2, "sizeBytes": 100}
        points = [
            {"timestampMs": 1000, "latitude": 42.0, "longitude": 3.0},
            {"timestampMs": 2000, "latitude": 42.1, "longitude": 3.1},
        ]
        value = track_to_geojson(summary, points)
        self.assertEqual(value["type"], "FeatureCollection")
        feature = value["features"][0]
        self.assertEqual(feature["geometry"]["type"], "LineString")
        # GeoJSON impose l'ordre [longitude, latitude].
        self.assertEqual(feature["geometry"]["coordinates"], [[3.0, 42.0], [3.1, 42.1]])
        self.assertEqual(feature["properties"]["coordTimes"], ["1970-01-01T00:00:01.000Z", "1970-01-01T00:00:02.000Z"])

    def test_gpx_export(self) -> None:
        summary = {"id": "track-20260101T000000Z", "startedAt": 1000, "endedAt": 2000, "pointCount": 1, "sizeBytes": 100}
        points = [{"timestampMs": 1000, "latitude": 42.6347, "longitude": 3.0425}]
        document = ElementTree.fromstring(track_to_gpx(summary, points))
        namespace = {"gpx": "http://www.topografix.com/GPX/1/1"}
        track_points = document.findall(".//gpx:trkpt", namespace)
        self.assertEqual(len(track_points), 1)
        self.assertEqual(track_points[0].attrib["lat"], "42.6347")
        self.assertEqual(track_points[0].attrib["lon"], "3.0425")
        self.assertEqual(track_points[0].find("gpx:time", namespace).text, "1970-01-01T00:00:01.000Z")

    def test_csv_export(self) -> None:
        summary = {"id": "track-20260101T000000Z", "startedAt": 1000, "endedAt": 1000, "pointCount": 1, "sizeBytes": 100}
        points = [{"timestampMs": 1000, "latitude": 42.0, "longitude": 3.0, "sog": 5.2, "cog": 90.0, "heading": None, "depth": None, "gpsAccuracy": 3}]
        lines = track_to_csv(summary, points).strip().splitlines()
        self.assertEqual(lines[0], "time,latitude,longitude,sog_knots,cog_deg,heading_deg,depth_m,gps_accuracy_m")
        self.assertEqual(lines[1], "1970-01-01T00:00:01.000Z,42.0,3.0,5.2,90.0,,,3")


if __name__ == "__main__":
    unittest.main()
