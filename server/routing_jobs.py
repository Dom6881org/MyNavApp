"""Exécution isolée des calculs de routage et suivi de leur progression."""

from __future__ import annotations

import multiprocessing
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from multiprocessing.connection import Connection
from typing import Any, Callable

from server.routing import compute_route_payload

JOB_TTL_S = 30 * 60
PROGRESS_INTERVAL_S = 1.0
PROCESS_JOIN_TIMEOUT_S = 2.0


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _routing_job_worker(
    payload: Any,
    connection: Connection,
    compute_payload: Callable[..., dict[str, Any]],
) -> None:
    """Worker module-level compatible avec le mode spawn."""
    phase_timings: dict[str, Any] = {
        "sample_wind_s": 0.0,
        "land_mask_s": 0.0,
        "pruning_s": 0.0,
        "explored_nodes": 0,
    }
    started = time.monotonic()
    send_lock = threading.Lock()
    stop_progress = threading.Event()

    def send(message: dict[str, Any]) -> None:
        try:
            with send_lock:
                connection.send(message)
        except (BrokenPipeError, EOFError, OSError):
            stop_progress.set()

    def publish_progress() -> None:
        phases = {key: value for key, value in phase_timings.items() if key != "explored_nodes"}
        send({
            "type": "progress",
            "progress": {
                "elapsed": time.monotonic() - started,
                "explored_nodes": phase_timings.get("explored_nodes", 0),
                "phases": phases,
            },
        })

    def report_progress() -> None:
        while not stop_progress.wait(PROGRESS_INTERVAL_S):
            publish_progress()

    send({"type": "started"})
    progress_thread = threading.Thread(target=report_progress, name="routing-progress", daemon=True)
    progress_thread.start()
    try:
        result = compute_payload(payload, phase_timings=phase_timings, include_diagnostics=True)
        stop_progress.set()
        progress_thread.join()
        publish_progress()
        send({"type": "done", "result": result})
    except Exception as error:
        stop_progress.set()
        progress_thread.join()
        send({"type": "failed", "error": str(error) or type(error).__name__})
    finally:
        connection.close()


@dataclass
class _RoutingJob:
    job_id: str
    created_at: str
    process: multiprocessing.Process | None = None
    status: str = "queued"
    started_at: str | None = None
    ended_at: str | None = None
    progress: dict[str, Any] | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    cancel_requested: bool = False
    ended_monotonic: float | None = None
    monitor: threading.Thread | None = field(default=None, repr=False)

    def snapshot(self) -> dict[str, Any]:
        value: dict[str, Any] = {"jobId": self.job_id, "status": self.status, "createdAt": self.created_at}
        if self.started_at is not None:
            value["startedAt"] = self.started_at
        if self.ended_at is not None:
            value["endedAt"] = self.ended_at
        if self.progress is not None:
            value["progress"] = self.progress
        if self.status == "done":
            value["result"] = self.result
        if self.status == "failed":
            value["error"] = self.error
        return value


class RoutingJobRegistry:
    """Registry mémoire des jobs de routage, purgés après leur terminaison."""

    def __init__(self, ttl_s: float = JOB_TTL_S) -> None:
        self._jobs: dict[str, _RoutingJob] = {}
        self._lock = threading.RLock()
        self._context = multiprocessing.get_context("spawn")
        self._ttl_s = ttl_s

    def submit(self, payload: Any) -> str:
        job_id = str(uuid.uuid4())
        job = _RoutingJob(job_id=job_id, created_at=_utc_now())
        receive_connection, send_connection = self._context.Pipe(duplex=False)
        process = self._context.Process(
            target=_routing_job_worker,
            args=(payload, send_connection, compute_route_payload),
            name=f"routing-{job_id}",
            daemon=True,
        )
        job.process = process
        with self._lock:
            self._purge_expired()
            self._jobs[job_id] = job
        try:
            process.start()
        except Exception as error:
            receive_connection.close()
            send_connection.close()
            with self._lock:
                self._finish(job, "failed", error=str(error) or type(error).__name__)
            return job_id
        send_connection.close()
        monitor = threading.Thread(
            target=self._monitor_job,
            args=(job, receive_connection),
            name=f"routing-monitor-{job_id}",
            daemon=True,
        )
        job.monitor = monitor
        monitor.start()
        return job_id

    def get(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            self._purge_expired()
            job = self._jobs.get(job_id)
            return job.snapshot() if job is not None else None

    def cancel(self, job_id: str) -> dict[str, Any] | None:
        with self._lock:
            self._purge_expired()
            job = self._jobs.get(job_id)
            if job is None:
                return None
            process = job.process
            if job.status in ("done", "failed", "cancelled") or process is None:
                return job.snapshot()
            job.cancel_requested = True

        if process.is_alive():
            process.terminate()
        process.join(timeout=PROCESS_JOIN_TIMEOUT_S)
        if process.is_alive():
            process.kill()
            process.join()
        with self._lock:
            self._finish(job, "cancelled")
            return job.snapshot()

    def _monitor_job(self, job: _RoutingJob, connection: Connection) -> None:
        try:
            while True:
                if connection.poll(0.1):
                    try:
                        message = connection.recv()
                    except EOFError:
                        break
                    with self._lock:
                        self._handle_message(job, message)
                    if message.get("type") in ("done", "failed"):
                        break
                elif job.process is not None and not job.process.is_alive():
                    break
            if job.process is not None:
                job.process.join()
            with self._lock:
                if job.status not in ("done", "failed", "cancelled"):
                    if job.cancel_requested:
                        self._finish(job, "cancelled")
                    else:
                        code = job.process.exitcode if job.process is not None else None
                        self._finish(job, "failed", error=f"Le subprocess de routage s'est arrêté (code {code}).")
        finally:
            connection.close()

    def _handle_message(self, job: _RoutingJob, message: dict[str, Any]) -> None:
        if job.cancel_requested:
            return
        message_type = message.get("type")
        if message_type == "started":
            job.status = "running"
            job.started_at = _utc_now()
        elif message_type == "progress":
            job.progress = message["progress"]
        elif message_type == "done":
            job.result = message["result"]
            self._finish(job, "done")
        elif message_type == "failed":
            self._finish(job, "failed", error=message.get("error", "Erreur de routage inconnue."))

    @staticmethod
    def _finish(job: _RoutingJob, status: str, error: str | None = None) -> None:
        job.status = status
        job.error = error
        job.ended_at = _utc_now()
        job.ended_monotonic = time.monotonic()

    def _purge_expired(self) -> None:
        now = time.monotonic()
        expired = [
            job_id
            for job_id, job in self._jobs.items()
            if job.status in ("done", "failed", "cancelled")
            and job.ended_monotonic is not None
            and now - job.ended_monotonic >= self._ttl_s
        ]
        for job_id in expired:
            del self._jobs[job_id]


routing_jobs = RoutingJobRegistry()
