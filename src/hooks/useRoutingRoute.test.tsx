import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRoutingRoute } from './useRoutingRoute';
import { RoutingPlan, RoutingRouteResult, RoutingWindInput } from '../types';

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

const stubFetch = (response: { ok: boolean; status: number; json: () => Promise<unknown> }) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('useRoutingRoute', () => {
  it('calcule la route : POST au backend, résultat exposé', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, json: () => Promise.resolve(ROUTE) });
    const { result } = renderHook(() => useRoutingRoute());

    await act(() => result.current.compute(PLAN, WIND));

    expect(result.current.route).toEqual(ROUTE);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('/api/routing/compute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: PLAN.startPosition,
        finish: PLAN.finishPosition,
        polarId: PLAN.polarId,
        wind: WIND
      })
    });
  });

  it('erreur HTTP : message du backend affiché, pas de route', async () => {
    stubFetch({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ error: 'Polaire inconnue : inconnue.' })
    });
    const { result } = renderHook(() => useRoutingRoute());

    await act(() => result.current.compute(PLAN, WIND));

    expect(result.current.error).toContain('Polaire inconnue');
    expect(result.current.route).toBeNull();
  });

  it('backend injoignable : message clair', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { result } = renderHook(() => useRoutingRoute());

    await act(() => result.current.compute(PLAN, null));

    expect(result.current.error).toContain('Backend unreachable');
    expect(result.current.route).toBeNull();
  });

  it('clear remet à zéro route et erreur', async () => {
    stubFetch({ ok: true, status: 200, json: () => Promise.resolve(ROUTE) });
    const { result } = renderHook(() => useRoutingRoute());

    await act(() => result.current.compute(PLAN, WIND));
    await waitFor(() => expect(result.current.route).not.toBeNull());
    act(() => result.current.clear());

    expect(result.current.route).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
