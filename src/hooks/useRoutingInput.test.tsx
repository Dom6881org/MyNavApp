import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRoutingInput } from './useRoutingInput';
import { Position } from '../types';

const POLARS = [
  { id: 'polaire-sugar', name: 'Sugar (Bavaria 36)' },
  { id: 'polaire-bavaria', name: 'Bavaria 42' }
];

const POSITION: Position = { latitude: 47.5, longitude: -4.5 };

const stubPolarsFetch = (polars = POLARS) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ polars })
  }));
};

const stubOfflineFetch = () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('backend offline')));
};

describe('useRoutingInput', () => {
  it('charge les polaires du backend et sélectionne la première par défaut', async () => {
    stubPolarsFetch();
    const { result } = renderHook(() => useRoutingInput(POSITION));

    await waitFor(() => expect(result.current.polarId).toBe('polaire-sugar'));
    expect(result.current.polars).toHaveLength(2);
    expect(result.current.polarError).toBeNull();
  });

  it('retombe sur la polaire embarquée quand le backend est hors ligne', async () => {
    stubOfflineFetch();
    const { result } = renderHook(() => useRoutingInput(POSITION));

    await waitFor(() => expect(result.current.polarError).toContain('hors ligne'));
    expect(result.current.polars).toEqual([{ id: 'polaire-sugar', name: 'Sugar (Bavaria 36)' }]);
    expect(result.current.polarId).toBe('polaire-sugar');
  });

  it('départ = position courante : plan prêt avec distance orthodromique', async () => {
    stubPolarsFetch();
    const { result } = renderHook(() => useRoutingInput(POSITION));

    await waitFor(() => expect(result.current.polarId).toBe('polaire-sugar'));
    act(() => result.current.setFinishFromPosition({ latitude: 47.6, longitude: -4.6 }));

    // dlat 0.1° = 6 MN ; dlon 0.1° à ~47.5° ≈ 4.05 MN ; hypotèse ≈ 7.25 MN.
    expect(result.current.plan).not.toBeNull();
    expect(result.current.distanceNm).toBeGreaterThan(7);
    expect(result.current.distanceNm).toBeLessThan(7.5);
    expect(result.current.errors.finish).toBeNull();
    expect(result.current.errors.same).toBeNull();
  });

  it('setStartFromPosition décoche la position courante et remplit le départ', async () => {
    stubPolarsFetch();
    const { result } = renderHook(() => useRoutingInput(POSITION));

    await waitFor(() => expect(result.current.polarId).toBe('polaire-sugar'));
    act(() => {
      result.current.setStartFromPosition({ latitude: 47.7, longitude: -4.7 });
      result.current.setFinishFromPosition({ latitude: 47.6, longitude: -4.6 });
    });

    expect(result.current.useCurrentPosition).toBe(false);
    expect(result.current.startText).toEqual({ latitude: '47.70000', longitude: '-4.70000' });
    expect(result.current.plan).not.toBeNull();
    expect(result.current.plan?.startPosition).toEqual({ latitude: 47.7, longitude: -4.7 });
  });

  it('départ manuel invalide : erreur claire et pas de plan', async () => {
    stubPolarsFetch();
    const { result } = renderHook(() => useRoutingInput(POSITION));

    await waitFor(() => expect(result.current.polarId).toBe('polaire-sugar'));
    act(() => {
      result.current.setUseCurrentPosition(false);
      result.current.setStartText({ latitude: 'abc', longitude: '12' });
      result.current.setFinishFromPosition({ latitude: 47.6, longitude: -4.6 });
    });

    expect(result.current.errors.start).toContain('invalides');
    expect(result.current.plan).toBeNull();
  });

  it('position courante absente : le départ attend un fix GPS', async () => {
    stubPolarsFetch();
    const { result } = renderHook(() => useRoutingInput(null));

    await waitFor(() => expect(result.current.polarId).toBe('polaire-sugar'));
    act(() => result.current.setFinishFromPosition({ latitude: 47.6, longitude: -4.6 }));

    expect(result.current.errors.start).toContain('GPS');
    expect(result.current.plan).toBeNull();
  });

  it('départ et arrivée identiques : erreur dédiée', async () => {
    stubPolarsFetch();
    const { result } = renderHook(() => useRoutingInput(POSITION));

    await waitFor(() => expect(result.current.polarId).toBe('polaire-sugar'));
    act(() => result.current.setFinishFromPosition({ latitude: POSITION.latitude, longitude: POSITION.longitude }));

    expect(result.current.errors.same).toContain('identiques');
    expect(result.current.plan).toBeNull();
  });

  it('mémorise la polaire choisie entre les sessions', async () => {
    window.localStorage.setItem('routingPolarId', 'polaire-bavaria');
    stubPolarsFetch();
    const { result } = renderHook(() => useRoutingInput(POSITION));

    await waitFor(() => expect(result.current.polarId).toBe('polaire-bavaria'));
  });
});
