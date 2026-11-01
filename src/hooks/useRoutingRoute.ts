import { useCallback, useEffect, useRef, useState } from 'react';

import { RoutingJob, RoutingJobAccepted, RoutingJobProgress, RoutingPlan, RoutingRouteResult, RoutingWindInput } from '../types';

const JOBS_URL = '/api/routing/jobs';

/** Intervalle de polling du statut (le serveur publie la progression ~1 Hz). */
const POLL_INTERVAL_MS = 1000;

const sleep = (ms: number) => new Promise<void>(resolve => {
  setTimeout(resolve, ms);
});

export interface RoutingRouteApi {
  route: RoutingRouteResult | null;
  isLoading: boolean;
  error: string | null;
  /** Progression brute du job en cours (elapsed, explored_nodes) — issue #96. */
  progress: RoutingJobProgress | null;
  compute: (plan: RoutingPlan, wind: RoutingWindInput | null) => Promise<void>;
  /** Annule le job en cours (DELETE) : tracé retiré, message affiché, polling stoppé. */
  cancel: () => Promise<void>;
  clear: () => void;
}

/**
 * Calcul de la route (issues #17, #96) : POST /api/routing/jobs (202 + jobId)
 * puis polling de GET /api/routing/jobs/{jobId} (~1 s) jusqu'au statut terminal
 * (done / failed / cancelled). Un nouveau calcul annule d'abord le job
 * précédent (jamais deux routages concurrents) ; le polling s'arrête
 * proprement au démontage du hook.
 */
export const useRoutingRoute = (): RoutingRouteApi => {
  const [route, setRoute] = useState<RoutingRouteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<RoutingJobProgress | null>(null);

  const jobIdRef = useRef<string | null>(null);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  /** DELETE best-effort : l'annulation côté serveur ne doit jamais bloquer l'UI. */
  const cancelJobOnServer = useCallback((jobId: string) => {
    fetch(`${JOBS_URL}/${jobId}`, { method: 'DELETE' }).catch(() => undefined);
  }, []);

  /** Invalide le job courant : la boucle de polling en cours s'arrête d'elle-même. */
  const stopJob = useCallback(() => {
    jobIdRef.current = null;
    runIdRef.current += 1;
  }, []);

  const poll = useCallback(async (jobId: string, runId: number) => {
    const isActive = () => mountedRef.current && runIdRef.current === runId && jobIdRef.current === jobId;
    while (isActive()) {
      await sleep(POLL_INTERVAL_MS);
      if (!isActive()) return;
      let response: Response;
      let value: RoutingJob & { error?: string };
      try {
        response = await fetch(`${JOBS_URL}/${jobId}`);
        value = await response.json() as RoutingJob & { error?: string };
      } catch {
        if (isActive()) {
          setError('Backend unreachable: routing computation unavailable.');
          setIsLoading(false);
          setProgress(null);
          jobIdRef.current = null;
        }
        return;
      }
      if (!isActive()) return;
      if (!response.ok) {
        // 404 : job inconnu ou purgé (TTL 30 min après terminaison).
        setError(value.error ?? 'Routing job not found.');
        setRoute(null);
        setIsLoading(false);
        setProgress(null);
        jobIdRef.current = null;
        return;
      }
      if (value.progress) setProgress(value.progress);
      if (value.status === 'done') {
        setRoute(value.result ?? null);
        setError(null);
        setIsLoading(false);
        setProgress(null);
        jobIdRef.current = null;
        return;
      }
      if (value.status === 'failed') {
        setError(value.error ?? 'Routing computation failed.');
        setRoute(null);
        setIsLoading(false);
        setProgress(null);
        jobIdRef.current = null;
        return;
      }
      if (value.status === 'cancelled') {
        setError('Routing cancelled.');
        setRoute(null);
        setIsLoading(false);
        setProgress(null);
        jobIdRef.current = null;
        return;
      }
    }
  }, []);

  const compute = useCallback(async (plan: RoutingPlan, wind: RoutingWindInput | null) => {
    // Nouveau calcul : annule d'abord le job précédent (jamais deux concurrents).
    const previousJobId = jobIdRef.current;
    stopJob();
    if (previousJobId) cancelJobOnServer(previousJobId);
    const runId = runIdRef.current;
    setIsLoading(true);
    setError(null);
    setProgress(null);
    let response: Response;
    let value: RoutingJobAccepted & { error?: string };
    try {
      response = await fetch(JOBS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: plan.startPosition,
          finish: plan.finishPosition,
          polarId: plan.polarId,
          wind
        })
      });
      value = await response.json() as RoutingJobAccepted & { error?: string };
    } catch {
      if (!mountedRef.current || runIdRef.current !== runId) return;
      setError('Backend unreachable: routing computation unavailable.');
      setIsLoading(false);
      return;
    }
    if (!mountedRef.current || runIdRef.current !== runId) return;
    if (response.status !== 202 || typeof value.jobId !== 'string') {
      setError(value.error ?? 'Routing computation failed.');
      setIsLoading(false);
      return;
    }
    jobIdRef.current = value.jobId;
    void poll(value.jobId, runId);
  }, [cancelJobOnServer, poll, stopJob]);

  const cancel = useCallback(async () => {
    const jobId = jobIdRef.current;
    stopJob();
    if (jobId) cancelJobOnServer(jobId);
    if (!mountedRef.current) return;
    setRoute(null);
    setError('Routing cancelled.');
    setIsLoading(false);
    setProgress(null);
  }, [cancelJobOnServer, stopJob]);

  const clear = useCallback(() => {
    const jobId = jobIdRef.current;
    stopJob();
    if (jobId) cancelJobOnServer(jobId);
    setRoute(null);
    setError(null);
    setProgress(null);
    setIsLoading(false);
  }, [cancelJobOnServer, stopJob]);

  // Arrêt propre au démontage : plus de setState, le job est annulé côté serveur.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const jobId = jobIdRef.current;
      stopJob();
      if (jobId) cancelJobOnServer(jobId);
    };
  }, [cancelJobOnServer, stopJob]);

  return { route, isLoading, error, progress, compute, cancel, clear };
};

export default useRoutingRoute;
