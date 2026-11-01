"""Tests des jobs de routage asynchrones."""

import json
import time
import unittest
from http.server import ThreadingHTTPServer
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from unittest.mock import patch

from server import routing
from server.app import RequestHandler
from server.routing_jobs import RoutingJobRegistry


def fake_success(payload, phase_timings=None, include_diagnostics=False):
    phase_timings.update(sample_wind_s=0.25, land_mask_s=0.1, pruning_s=0.05, explored_nodes=42)
    if payload.get("delay"):
        time.sleep(payload["delay"])
    return {
        "found": True,
        "timings": dict(phase_timings),
        "params": {"dt_s": 1800.0, "bin_deg": 0.03},
        "binDeg": 0.03,
    }


def fake_failure(payload, phase_timings=None, include_diagnostics=False):
    raise ValueError("échec de calcul")


def fake_slow_route(payload, phase_timings=None, include_diagnostics=False):
    phase_timings.update(sample_wind_s=0.0, land_mask_s=0.0, pruning_s=0.0, explored_nodes=0)
    time.sleep(10)
    return {}


class RoutingJobTests(unittest.TestCase):
    def setUp(self):
        self.registry = RoutingJobRegistry()

    def wait_for_status(self, job_id, status):
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            job = self.registry.get(job_id)
            if job and job["status"] == status:
                return job
            time.sleep(0.05)
        self.fail(f"Le job n'a pas atteint l'état {status}.")

    def test_job_queued_running_done_with_diagnostics(self):
        with patch("server.routing_jobs.compute_route_payload", fake_success):
            job_id = self.registry.submit({"delay": 0.4})
        self.assertEqual(self.registry.get(job_id)["status"], "queued")
        running = self.wait_for_status(job_id, "running")
        self.assertIn("startedAt", running)
        job = self.wait_for_status(job_id, "done")
        self.assertEqual(job["result"]["params"], {"dt_s": 1800.0, "bin_deg": 0.03})
        self.assertEqual(job["result"]["binDeg"], 0.03)
        self.assertEqual(job["result"]["timings"]["explored_nodes"], 42)
        self.assertEqual(job["progress"]["explored_nodes"], 42)
        self.assertIn("elapsed", job["progress"])
        self.assertEqual(set(job["progress"]["phases"]), {"sample_wind_s", "land_mask_s", "pruning_s"})

    def test_compute_payload_adds_diagnostics_only_when_requested(self):
        timings = {"sample_wind_s": 1.0, "explored_nodes": 12}
        route_result = {
            "found": True,
            "coords": [],
            "eta_s": 120.0,
            "dt_s": 1800.0,
            "bin_deg": 0.03,
            "min_dist_nm": 1.0,
            "bathy_active": False,
            "message": None,
            "geojson": None,
            "start_adjusted": None,
            "finish_adjusted": None,
            "phase_timings": timings,
        }
        payload = {
            "polarId": "test",
            "start": {"latitude": 1, "longitude": 2},
            "finish": {"latitude": 3, "longitude": 4},
        }
        with (
            patch("server.routing.list_polars", return_value=[{"id": "test", "path": "polar.pol"}]),
            patch("server.grib.load_wind_field", return_value=object()),
            patch("server.routing.compute_route", return_value=route_result) as compute_route,
        ):
            result = routing.compute_route_payload(payload, phase_timings=timings, include_diagnostics=True)
            self.assertEqual(result["timings"], timings)
            self.assertEqual(result["params"], {"dt_s": 1800.0, "bin_deg": 0.03})
            self.assertEqual(result["binDeg"], 0.03)
            self.assertEqual(compute_route.call_args.kwargs["phase_timings"], timings)

            legacy_result = routing.compute_route_payload(payload)
        self.assertNotIn("timings", legacy_result)
        self.assertNotIn("params", legacy_result)

    def test_exception_sets_failed_message(self):
        with patch("server.routing_jobs.compute_route_payload", fake_failure):
            job_id = self.registry.submit({})
        job = self.wait_for_status(job_id, "failed")
        self.assertEqual(job["error"], "échec de calcul")
        self.assertIn("endedAt", job)

    def test_cancel_terminates_subprocess_and_is_idempotent(self):
        with patch("server.routing_jobs.compute_route_payload", fake_slow_route):
            job_id = self.registry.submit({})
        self.wait_for_status(job_id, "running")
        process = self.registry._jobs[job_id].process
        cancelled = self.registry.cancel(job_id)
        self.assertEqual(cancelled["status"], "cancelled")
        self.assertIsNotNone(process.exitcode)
        self.assertFalse(process.is_alive())
        self.assertEqual(self.registry.cancel(job_id)["status"], "cancelled")

    def test_unknown_job_is_not_found_by_http(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), RequestHandler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with self.assertRaises(HTTPError) as error:
                urlopen(f"http://127.0.0.1:{server.server_port}/api/routing/jobs/inconnu")
            self.assertEqual(error.exception.code, 404)
            self.assertEqual(json.loads(error.exception.read()), {"error": "Routing job not found."})
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_http_submit_status_and_cancel(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), RequestHandler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base_url = f"http://127.0.0.1:{server.server_port}/api/routing/jobs"
        try:
            with (
                patch("server.app.routing_jobs", self.registry),
                patch("server.routing_jobs.compute_route_payload", fake_success),
            ):
                request = Request(
                    base_url,
                    data=json.dumps({"delay": 0.2}).encode(),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(request) as response:
                    self.assertEqual(response.status, 202)
                    job_id = json.loads(response.read())["jobId"]
                result = self.wait_for_status(job_id, "done")
                with urlopen(f"{base_url}/{job_id}") as response:
                    self.assertEqual(json.loads(response.read()), result)

            with patch("server.app.routing_jobs", self.registry), patch(
                "server.routing_jobs.compute_route_payload", fake_slow_route
            ):
                request = Request(
                    base_url,
                    data=b"{}",
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(request) as response:
                    job_id = json.loads(response.read())["jobId"]
                self.wait_for_status(job_id, "running")
                request = Request(f"{base_url}/{job_id}", method="DELETE")
                with urlopen(request) as response:
                    self.assertEqual(json.loads(response.read())["status"], "cancelled")
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
