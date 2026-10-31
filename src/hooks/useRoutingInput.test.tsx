import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRoutingInput } from './useRoutingInput';
import { Position } from '../types';

const POSITION: Position = { latitude: 47.5, longitude: -4.5 };
const POLAR_ID = 'polaire-sugar';

describe('useRoutingInput', () => {
  it('départ = position courante : plan prêt avec distance orthodromique', () => {
    const { result } = renderHook(() => useRoutingInput(POSITION, POLAR_ID));

    act(() => result.current.setFinishFromPosition({ latitude: 47.6, longitude: -4.6 }));

    // dlat 0.1° = 6 MN ; dlon 0.1° à ~47.5° ≈ 4.05 MN ; hypoténuse ≈ 7.25 MN.
    expect(result.current.plan).not.toBeNull();
    expect(result.current.distanceNm).toBeGreaterThan(7);
    expect(result.current.distanceNm).toBeLessThan(7.5);
    expect(result.current.errors.finish).toBeNull();
    expect(result.current.errors.same).toBeNull();
    expect(result.current.plan?.polarId).toBe(POLAR_ID);
  });

  it('setStartFromPosition décoche la position courante et remplit le départ', () => {
    const { result } = renderHook(() => useRoutingInput(POSITION, POLAR_ID));

    act(() => {
      result.current.setStartFromPosition({ latitude: 47.7, longitude: -4.7 });
      result.current.setFinishFromPosition({ latitude: 47.6, longitude: -4.6 });
    });

    expect(result.current.useCurrentPosition).toBe(false);
    expect(result.current.startText).toEqual({ latitude: '47.70000', longitude: '-4.70000' });
    expect(result.current.plan).not.toBeNull();
    expect(result.current.plan?.startPosition).toEqual({ latitude: 47.7, longitude: -4.7 });
  });

  it('départ manuel invalide : erreur claire et pas de plan', () => {
    const { result } = renderHook(() => useRoutingInput(POSITION, POLAR_ID));

    act(() => {
      result.current.setUseCurrentPosition(false);
      result.current.setStartText({ latitude: 'abc', longitude: '12' });
      result.current.setFinishFromPosition({ latitude: 47.6, longitude: -4.6 });
    });

    expect(result.current.errors.start).toContain('invalides');
    expect(result.current.plan).toBeNull();
  });

  it('position courante absente : le départ attend un fix GPS', () => {
    const { result } = renderHook(() => useRoutingInput(null, POLAR_ID));

    act(() => result.current.setFinishFromPosition({ latitude: 47.6, longitude: -4.6 }));

    expect(result.current.errors.start).toContain('GPS');
    expect(result.current.plan).toBeNull();
  });

  it('départ et arrivée identiques : erreur dédiée', () => {
    const { result } = renderHook(() => useRoutingInput(POSITION, POLAR_ID));

    act(() => result.current.setFinishFromPosition({ latitude: POSITION.latitude, longitude: POSITION.longitude }));

    expect(result.current.errors.same).toContain('identiques');
    expect(result.current.plan).toBeNull();
  });

  it('sans polaire (paramètre app non défini) : erreur dédiée et pas de plan', () => {
    const { result } = renderHook(() => useRoutingInput(POSITION, null));

    act(() => result.current.setFinishFromPosition({ latitude: 47.6, longitude: -4.6 }));

    expect(result.current.errors.polar).toContain('polaire');
    expect(result.current.plan).toBeNull();
  });
});
