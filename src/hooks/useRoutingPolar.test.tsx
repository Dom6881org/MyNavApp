import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useRoutingPolar } from './useRoutingPolar';

const POLARS = [
  { id: 'polaire-sugar', name: 'Sugar (Bavaria 36)' },
  { id: 'polaire-bavaria', name: 'Bavaria 42' }
];

const stubPolarsFetch = (polars = POLARS) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ polars })
  }));
};

const stubOfflineFetch = () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('backend offline')));
};

describe('useRoutingPolar', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('charge les polaires du backend et sélectionne la première par défaut', async () => {
    stubPolarsFetch();
    const { result } = renderHook(() => useRoutingPolar());

    await waitFor(() => expect(result.current.polarId).toBe('polaire-sugar'));
    expect(result.current.polars).toHaveLength(2);
    expect(result.current.polarName).toBe('Sugar (Bavaria 36)');
    expect(result.current.polarError).toBeNull();
  });

  it('retombe sur la polaire embarquée quand le backend est hors ligne', async () => {
    stubOfflineFetch();
    const { result } = renderHook(() => useRoutingPolar());

    await waitFor(() => expect(result.current.polarError).toContain('hors ligne'));
    expect(result.current.polars).toEqual([{ id: 'polaire-sugar', name: 'Sugar (Bavaria 36)' }]);
    expect(result.current.polarId).toBe('polaire-sugar');
  });

  it('mémorise la polaire choisie entre les sessions', async () => {
    window.localStorage.setItem('routingPolarId', 'polaire-bavaria');
    stubPolarsFetch();
    const { result } = renderHook(() => useRoutingPolar());

    await waitFor(() => expect(result.current.polarId).toBe('polaire-bavaria'));

    act(() => result.current.setPolarId('polaire-sugar'));
    expect(result.current.polarId).toBe('polaire-sugar');
    expect(window.localStorage.getItem('routingPolarId')).toBe('polaire-sugar');
  });
});
