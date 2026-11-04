import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMotionSensors } from './useMotionSensors';

const dispatchMotion = (x: number, y: number, z: number, tMs: number) => {
  const event = new Event('devicemotion');
  Object.defineProperty(event, 'accelerationIncludingGravity', { value: { x, y, z } });
  Object.defineProperty(event, 'timeStamp', { value: tMs });
  window.dispatchEvent(event);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMotionSensors', () => {
  it('sans capteurs (desktop) : indisponible, valeurs null, aucun throw', () => {
    vi.stubGlobal('DeviceMotionEvent', undefined);
    const { result } = renderHook(() => useMotionSensors());

    expect(result.current.motionAvailable).toBe(false);
    expect(result.current.heel).toBeNull();
    expect(result.current.pitch).toBeNull();
    expect(result.current.rollPeriod).toBeNull();
  });

  it('capteurs présents : gîte et tangage dérivés du vecteur gravité', () => {
    vi.stubGlobal('DeviceMotionEvent', class DeviceMotionEventStub {});
    const { result } = renderHook(() => useMotionSensors());

    // Gravité à plat + composante x (gîte tribord) : atan2(3, 9.81) ~ 17 deg.
    act(() => {
      dispatchMotion(3, 0, 9.81, 1000);
    });

    expect(result.current.motionAvailable).toBe(true);
    expect(result.current.heel).toBeCloseTo(17.05, 1);
    expect(result.current.pitch).toBeCloseTo(0, 5);
    // Un seul échantillon : pas de période de roulis.
    expect(result.current.rollPeriod).toBeNull();
  });

  it('événement sans accéléromètre (Firefox peut renvoyer null) : ignoré sans throw', () => {
    vi.stubGlobal('DeviceMotionEvent', class DeviceMotionEventStub {});
    const { result } = renderHook(() => useMotionSensors());

    const event = new Event('devicemotion');
    Object.defineProperty(event, 'accelerationIncludingGravity', { value: null });
    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.heel).toBeNull();
  });

  it('démontage : le listener devicemotion est retiré', () => {
    vi.stubGlobal('DeviceMotionEvent', class DeviceMotionEventStub {});
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useMotionSensors());

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('devicemotion', expect.any(Function));
    removeSpy.mockRestore();
  });
});
