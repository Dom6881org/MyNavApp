import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGrib } from './useGrib';
import { GribStatus } from '../types';

const FRESH_STATUS: GribStatus = {
  available: true,
  fresh: true,
  reason: null,
  createdAt: 1730000000,
  validUntil: 1730200000,
  south: 46,
  north: 47,
  west: -5,
  east: -4,
  resolutionDeg: 0.5,
  stepH: 3,
  points: 9,
  steps: 25
};

const stubFetch = (response: { ok: boolean; status: number; json: () => Promise<unknown> }) => {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

describe('useGrib', () => {
  it('charge le statut du cache au montage', async () => {
    stubFetch({ ok: true, status: 200, json: () => Promise.resolve(FRESH_STATUS) });
    const { result } = renderHook(() => useGrib());

    await waitFor(() => expect(result.current.status).toEqual(FRESH_STATUS));
    expect(result.current.error).toBeNull();
  });

  it('télécharge une zone + horizon : POST au backend, statut rafraîchi', async () => {
    const fetchMock = stubFetch({ ok: true, status: 200, json: () => Promise.resolve(FRESH_STATUS) });
    const { result } = renderHook(() => useGrib());

    await act(() => result.current.download({ south: 46, north: 47, west: -5, east: -4 }, 72));

    expect(result.current.status).toEqual(FRESH_STATUS);
    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/grib/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ south: 46, north: 47, west: -5, east: -4, horizonH: 72 })
    });
  });

  it('erreur du backend (hors ligne) : message affiché, statut conservé', async () => {
    stubFetch({ ok: false, status: 503, json: () => Promise.resolve({ error: 'Téléchargement Open-Météo impossible' }) });
    const { result } = renderHook(() => useGrib());

    await act(() => result.current.download({ south: 46, north: 47, west: -5, east: -4 }, 72));

    expect(result.current.error).toContain('Open-Météo');
    expect(result.current.status).toBeNull();
    expect(result.current.isDownloading).toBe(false);
  });
});
