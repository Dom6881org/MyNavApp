import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWindForecast } from './useWindForecast';

const POINTS = [
  { latitude: 39.5, longitude: 2.5 },
  { latitude: 40.5, longitude: 3.5 }
];

const omForecast = (n: number) => {
  const one = { current: { wind_speed_10m: 10, wind_direction_10m: 90, wind_gusts_10m: 12 } };
  return n === 1 ? one : Array.from({ length: n }, () => one);
};

const stubFetch = (gribWind: unknown[], omStatus = 200) => {
  const calls: string[] = [];
  const mock = vi.fn((url: string) => {
    calls.push(url);
    if (url.includes('/api/grib/sample')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ fresh: true, wind: gribWind }) });
    }
    if (url.includes('open-meteo')) {
      const n = new URL(url).searchParams.get('latitude')!.split(',').length;
      return Promise.resolve({
        ok: omStatus === 200,
        status: omStatus,
        headers: new Headers(),
        json: () => Promise.resolve(omForecast(n))
      });
    }
    return Promise.resolve({ ok: false, status: 404, headers: new Headers(), json: () => Promise.resolve({}) });
  });
  vi.stubGlobal('fetch', mock);
  return calls;
};

afterEach(() => vi.unstubAllGlobals());

describe('useWindForecast grille GRIB (#82)', () => {
  it('GRIB complet : aucun appel Open-Météo pour la grille', async () => {
    const calls = stubFetch(POINTS.map(p => ({ ...p, speed: 8, direction: 180 })));
    const { result } = renderHook(() => useWindForecast(null));
    act(() => result.current.requestWindGrid(POINTS));
    await waitFor(() => expect(result.current.windGrid).toHaveLength(2));
    expect(result.current.windGrid.every(point => point.wind.source === 'GRIB')).toBe(true);
    expect(calls.some(url => url.includes('open-meteo'))).toBe(false);
  });

  it('GRIB partiel : conserve les points GRIB et complète hors zone via Open-Météo', async () => {
    const calls = stubFetch([{ ...POINTS[0], speed: 8, direction: 180 }]);
    const { result } = renderHook(() => useWindForecast(null));
    act(() => result.current.requestWindGrid(POINTS));
    await waitFor(() => expect(result.current.windGrid).toHaveLength(2));
    const sources = result.current.windGrid.map(point => point.wind.source).sort();
    expect(sources).toEqual(['GRIB', 'Open-Meteo']);
    const om = calls.filter(url => url.includes('open-meteo'));
    expect(om).toHaveLength(1);
    expect(om[0]).toContain('latitude=40.5000');
    expect(om[0]).not.toContain('39.5000');
  });

  it('GRIB partiel + complément en échec : gridError actif', async () => {
    stubFetch([{ ...POINTS[0], speed: 8, direction: 180 }], 429);
    const { result } = renderHook(() => useWindForecast(null));
    act(() => result.current.requestWindGrid(POINTS));
    await waitFor(() => expect(result.current.status.gridError).not.toBeNull());
    expect(result.current.windGrid).toHaveLength(1);
  });
});
