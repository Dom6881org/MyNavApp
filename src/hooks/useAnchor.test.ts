import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnchor, formatAnchorTime } from './useAnchor';

beforeEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
});

describe('useAnchor — mouillage v1 (#186)', () => {
  it('aucun mouillage par défaut', () => {
    const { result } = renderHook(() => useAnchor());
    expect(result.current.anchor).toBeNull();
  });

  it('saveAnchor persiste position + heure en localStorage', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T18:42:00'));
    const { result } = renderHook(() => useAnchor());
    act(() => result.current.saveAnchor(42.68, 3.02));

    expect(result.current.anchor).not.toBeNull();
    expect(result.current.anchor?.latitude).toBe(42.68);
    expect(result.current.anchor?.longitude).toBe(3.02);
    const stored = JSON.parse(window.localStorage.getItem('coastal-anchor')!);
    expect(stored.latitude).toBe(42.68);
    expect(stored.timestamp).toBe(new Date('2026-11-05T18:42:00').toISOString());
  });

  it('un nouveau mouillage REMPLACE l’ancien (pas d’historique)', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAnchor());
    vi.setSystemTime(new Date('2026-11-05T18:42:00'));
    act(() => result.current.saveAnchor(42.68, 3.02));
    vi.setSystemTime(new Date('2026-11-05T20:05:00'));
    act(() => result.current.saveAnchor(42.70, 3.05));

    expect(result.current.anchor?.latitude).toBe(42.70);
    expect(result.current.anchor?.longitude).toBe(3.05);
    const stored = JSON.parse(window.localStorage.getItem('coastal-anchor')!);
    expect(stored.latitude).toBe(42.70);
    expect(stored.timestamp).toBe(new Date('2026-11-05T20:05:00').toISOString());
  });

  it('le mouillage survit à un remontage (lecture localStorage)', () => {
    window.localStorage.setItem(
      'coastal-anchor',
      JSON.stringify({ latitude: 42.5, longitude: 3.1, timestamp: '2026-11-05T17:00:00Z' })
    );
    const { result } = renderHook(() => useAnchor());
    expect(result.current.anchor?.latitude).toBe(42.5);
    expect(result.current.anchor?.timestamp).toBe('2026-11-05T17:00:00Z');
  });

  it('localStorage corrompu : retour à null sans crash', () => {
    window.localStorage.setItem('coastal-anchor', '{pas du json');
    const { result } = renderHook(() => useAnchor());
    expect(result.current.anchor).toBeNull();
  });

  it('formatAnchorTime : « 05/11 18:42 » (heure locale)', () => {
    expect(formatAnchorTime(new Date(2026, 10, 5, 18, 42).toISOString())).toBe('05/11 18:42');
    expect(formatAnchorTime('nimporte')).toBe('--/-- --:--');
  });

  it('clearAnchor efface le mouillage (retour #186)', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAnchor());
    act(() => result.current.saveAnchor(42.68, 3.02));
    expect(result.current.anchor).not.toBeNull();

    act(() => result.current.clearAnchor());

    expect(result.current.anchor).toBeNull();
    expect(window.localStorage.getItem('coastal-anchor')).toBeNull();

    // Sans mouillage, clearAnchor reste sans effet ni crash.
    act(() => result.current.clearAnchor());
    expect(result.current.anchor).toBeNull();
  });
});
