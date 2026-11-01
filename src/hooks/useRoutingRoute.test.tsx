import { renderHook, act } from '@testing-library/react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRoutingRoute } from './useRoutingRoute';

import { RoutingJob, RoutingPlan, RoutingRouteResult, RoutingWindInput } from '../types';

const PLAN: RoutingPlan = {
  useCurrentPosition: false,
  startPosition: { latitude: 42.62, longitude: 3.02 },
  finishPosition: { latitude: 42.62, longitude: 3.5 },
  polarId: 'polaire-sugar'
};

const WIND: RoutingWindInput = { directionFromDeg: 270, speedKts: 12 };

const ROUTE: RoutingRouteResult = {
  found: true,
  coords: [[42.62, 3.02], [42.62, 3.5]],
  etaS: 12600,
  dtS: 1800,
  minDistNm: 0.5,
  message: null,
  geojson: {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[3.02, 42.62], [3.5, 42.62]] },
      properties: {}
    }]
  },
  windSource: 'constant',
  wind: { directionFromDeg: 270, speedKts: 12 },
  polarId: 'polaire-sugar',
  start: { latitude: 42.62, longitude: 3.02 },
  finish: { latitude: 42.62, longitude: 3.5 }
};

const jsonResponse = (status: number, body: unknown): Response => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body)
} as Response);

const jobSnapshot = (overrides: Partial<RoutingJob>): RoutingJob => ({
  jobId: 'job-1',
  status: 'running',
  createdAt: '2026-11-02T10:00:00.000Z',
  ...overrides
});

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>;

const stubFetch = (handler: FetchHandler) => {
  const fetchMock = vi.fn(handler);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

/** Avance le polling d'un intervalle (~1 s) en vidant les microtâches. */
const advancePoll = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
};

describe('useRoutingRoute', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cycle complet : POST 202 jobId, polling ~1 s, progression exposée, done avec le résultat', async () => {
    let polls = 0;
    const fetchMock = stubFetch((url, init) => {
      if (url === '/api/routing/jobs' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse(202, { jobId: 'job-1' }));
      }
      if (url === '/api/routing/jobs/job-1' && !init?.method) {
        polls += 1;
        if (polls === 1) {
          return Promise.resolve(jsonResponse(200, jobSnapshot({
            status: 'running',
            progress: { elapsed: 2.5, explored_nodes: 42, phases: { pruning_s: 1.2 } }
          })));
        }
        return Promise.resolve(jsonResponse(200, jobSnapshot({
          status: 'done',
          progress: { elapsed: 4, explored_nodes: 1337, phases: {} },
          result: { ...ROUTE, timings: { total_s: 4 }, params: { dt_s: 1800, bin_deg: 5 } }
        })));
      }
      return Promise.reject(new Error(`unexpected ${init?.method ?? 'GET'} ${url}`));
    });
    const { result } = renderHook(() => useRoutingRoute());

    await act(async () => {
      await result.current.compute(PLAN, WIND);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/routing/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: PLAN.startPosition,
        finish: PLAN.finishPosition,
        polarId: PLAN.polarId,
        wind: WIND
      })
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.route).toBeNull();

    await advancePoll();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.progress).toEqual({ elapsed: 2.5, explored_nodes: 42, phases: { pruning_s: 1.2 } });
    expect(result.current.route).toBeNull();

    await advancePoll();
    expect(result.current.route).toMatchObject(ROUTE);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.progress).toBeNull();

    // Statut terminal : plus de polling.
    const callsAfterDone = fetchMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterDone);
  });

  it('statut failed : message du serveur affiché, pas de route, polling stoppé', async () => {
    const fetchMock = stubFetch((url, init) => {
      if (url === '/api/routing/jobs' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse(202, { jobId: 'job-1' }));
      }
      if (url === '/api/routing/jobs/job-1') {
        return Promise.resolve(jsonResponse(200, jobSnapshot({
          status: 'failed',
          error: 'Polaire inconnue : inconnue.'
        })));
      }
      return Promise.reject(new Error(`unexpected ${init?.method ?? 'GET'} ${url}`));
    });
    const { result } = renderHook(() => useRoutingRoute());

    await act(async () => {
      await result.current.compute(PLAN, WIND);
    });
    await advancePoll();

    expect(result.current.error).toContain('Polaire inconnue');
    expect(result.current.route).toBeNull();
    expect(result.current.isLoading).toBe(false);

    const callsAfterFailed = fetchMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterFailed);
  });

  it('annulation : DELETE du job, tracé retiré, message clair, plus de polling', async () => {
    const fetchMock = stubFetch((url, init) => {
      if (url === '/api/routing/jobs' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse(202, { jobId: 'job-1' }));
      }
      if (url === '/api/routing/jobs/job-1' && init?.method === 'DELETE') {
        return Promise.resolve(jsonResponse(200, jobSnapshot({ status: 'cancelled' })));
      }
      if (url === '/api/routing/jobs/job-1') {
        return Promise.resolve(jsonResponse(200, jobSnapshot({
          status: 'running',
          progress: { elapsed: 1, explored_nodes: 7, phases: {} }
        })));
      }
      return Promise.reject(new Error(`unexpected ${init?.method ?? 'GET'} ${url}`));
    });
    const { result } = renderHook(() => useRoutingRoute());

    await act(async () => {
      await result.current.compute(PLAN, WIND);
    });
    await advancePoll();
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await result.current.cancel();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/routing/jobs/job-1', { method: 'DELETE' });
    expect(result.current.error).toBe('Routing cancelled.');
    expect(result.current.route).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.progress).toBeNull();

    const callsAfterCancel = fetchMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterCancel);
  });

  it('un nouveau calcul annule d\'abord le job précédent (jamais deux concurrents)', async () => {
    const fetchMock = stubFetch((url, init) => {
      const method = init?.method ?? 'GET';
      if (url === '/api/routing/jobs' && method === 'POST') {
        const n = fetchMock.mock.calls.filter(c => c[1]?.method === 'POST').length;
        return Promise.resolve(jsonResponse(202, { jobId: `job-${n}` }));
      }
      if (url === '/api/routing/jobs/job-1' && method === 'DELETE') {
        return Promise.resolve(jsonResponse(200, jobSnapshot({ jobId: 'job-1', status: 'cancelled' })));
      }
      if (url === '/api/routing/jobs/job-1' || url === '/api/routing/jobs/job-2') {
        return Promise.resolve(jsonResponse(200, jobSnapshot({
          jobId: url.endsWith('job-1') ? 'job-1' : 'job-2',
          status: 'running',
          progress: { elapsed: 1, explored_nodes: 3, phases: {} }
        })));
      }
      return Promise.reject(new Error(`unexpected ${method} ${url}`));
    });
    const { result } = renderHook(() => useRoutingRoute());

    await act(async () => {
      await result.current.compute(PLAN, WIND);
    });
    await advancePoll();
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await result.current.compute(PLAN, WIND);
    });

    const deleteCall = fetchMock.mock.calls.findIndex(c => c[0] === '/api/routing/jobs/job-1' && c[1]?.method === 'DELETE');
    const secondPost = fetchMock.mock.calls.findIndex((c, i) => c[0] === '/api/routing/jobs' && c[1]?.method === 'POST' && i > 0);
    expect(deleteCall).toBeGreaterThanOrEqual(0);
    expect(secondPost).toBeGreaterThan(deleteCall);

    // Le polling ne suit plus que le second job.
    await advancePoll();
    expect(fetchMock).toHaveBeenCalledWith('/api/routing/jobs/job-2');
    const pollsJob1 = fetchMock.mock.calls.filter(c => c[0] === '/api/routing/jobs/job-1' && !c[1]?.method).length;
    expect(pollsJob1).toBe(1);
  });

  it('démontage : le job est annulé côté serveur et aucun setState ni polling après unmount', async () => {
    const fetchMock = stubFetch((url, init) => {
      const method = init?.method ?? 'GET';
      if (url === '/api/routing/jobs' && method === 'POST') {
        return Promise.resolve(jsonResponse(202, { jobId: 'job-1' }));
      }
      if (url === '/api/routing/jobs/job-1' && method === 'DELETE') {
        return Promise.resolve(jsonResponse(200, jobSnapshot({ status: 'cancelled' })));
      }
      if (url === '/api/routing/jobs/job-1') {
        return Promise.resolve(jsonResponse(200, jobSnapshot({
          status: 'running',
          progress: { elapsed: 1, explored_nodes: 5, phases: {} }
        })));
      }
      return Promise.reject(new Error(`unexpected ${method} ${url}`));
    });
    const { result, unmount } = renderHook(() => useRoutingRoute());

    await act(async () => {
      await result.current.compute(PLAN, WIND);
    });
    await advancePoll();
    expect(result.current.isLoading).toBe(true);

    unmount();

    expect(fetchMock).toHaveBeenCalledWith('/api/routing/jobs/job-1', { method: 'DELETE' });
    const callsAtUnmount = fetchMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(fetchMock.mock.calls.length).toBe(callsAtUnmount);
  });

  it('erreur HTTP au POST : message du backend affiché, pas de route', async () => {
    stubFetch(() => Promise.resolve(jsonResponse(422, { error: 'Polaire inconnue : inconnue.' })));
    const { result } = renderHook(() => useRoutingRoute());

    await act(async () => {
      await result.current.compute(PLAN, WIND);
    });

    expect(result.current.error).toContain('Polaire inconnue');
    expect(result.current.route).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('backend injoignable au POST : message clair', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { result } = renderHook(() => useRoutingRoute());

    await act(async () => {
      await result.current.compute(PLAN, null);
    });

    expect(result.current.error).toContain('Backend unreachable');
    expect(result.current.route).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('backend injoignable pendant le polling : message clair, polling stoppé', async () => {
    const fetchMock = stubFetch((url, init) => {
      if (url === '/api/routing/jobs' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse(202, { jobId: 'job-1' }));
      }
      return Promise.reject(new Error('network down'));
    });
    const { result } = renderHook(() => useRoutingRoute());

    await act(async () => {
      await result.current.compute(PLAN, WIND);
    });
    await advancePoll();

    expect(result.current.error).toContain('Backend unreachable');
    expect(result.current.isLoading).toBe(false);
    const callsAfterError = fetchMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterError);
  });

  it('job inconnu au polling (404) : message du serveur, polling stoppé', async () => {
    stubFetch((url, init) => {
      if (url === '/api/routing/jobs' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse(202, { jobId: 'job-1' }));
      }
      return Promise.resolve(jsonResponse(404, { error: 'Routing job not found.' }));
    });
    const { result } = renderHook(() => useRoutingRoute());

    await act(async () => {
      await result.current.compute(PLAN, WIND);
    });
    await advancePoll();

    expect(result.current.error).toBe('Routing job not found.');
    expect(result.current.isLoading).toBe(false);
  });

  it('clear remet à zéro route, erreur et progression, et annule un job en cours', async () => {
    const fetchMock = stubFetch((url, init) => {
      const method = init?.method ?? 'GET';
      if (url === '/api/routing/jobs' && method === 'POST') {
        return Promise.resolve(jsonResponse(202, { jobId: 'job-1' }));
      }
      if (url === '/api/routing/jobs/job-1' && method === 'DELETE') {
        return Promise.resolve(jsonResponse(200, jobSnapshot({ status: 'cancelled' })));
      }
      if (url === '/api/routing/jobs/job-1') {
        return Promise.resolve(jsonResponse(200, jobSnapshot({ status: 'running' })));
      }
      return Promise.reject(new Error(`unexpected ${method} ${url}`));
    });
    const { result } = renderHook(() => useRoutingRoute());

    await act(async () => {
      await result.current.compute(PLAN, WIND);
    });
    await advancePoll();
    act(() => result.current.clear());

    expect(result.current.route).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.progress).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('/api/routing/jobs/job-1', { method: 'DELETE' });
  });

  it('clear après un résultat terminé remet à zéro sans DELETE', async () => {
    const fetchMock = stubFetch((url, init) => {
      if (url === '/api/routing/jobs' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse(202, { jobId: 'job-1' }));
      }
      return Promise.resolve(jsonResponse(200, jobSnapshot({ status: 'done', result: ROUTE })));
    });
    const { result } = renderHook(() => useRoutingRoute());

    await act(async () => {
      await result.current.compute(PLAN, WIND);
    });
    await advancePoll();
    expect(result.current.route).toMatchObject(ROUTE);

    act(() => result.current.clear());
    expect(result.current.route).toBeNull();
    expect(result.current.error).toBeNull();
    expect(fetchMock.mock.calls.some(c => c[1]?.method === 'DELETE')).toBe(false);
  });
});
