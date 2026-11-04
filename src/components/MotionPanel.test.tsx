import { render, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MotionPanel from './MotionPanel';

afterEach(() => {
  vi.unstubAllGlobals();
});

const dispatchMotion = (x: number, y: number, z: number) => {
  const event = new Event('devicemotion');
  Object.defineProperty(event, 'accelerationIncludingGravity', { value: { x, y, z } });
  Object.defineProperty(event, 'timeStamp', { value: 1000 });
  act(() => {
    window.dispatchEvent(event);
  });
};

describe('MotionPanel', () => {
  it('sans capteurs (desktop) : badge no sensors', () => {
    vi.stubGlobal('DeviceMotionEvent', undefined);
    render(<MotionPanel />);

    expect(screen.getByText('no sensors')).toBeTruthy();
    expect(screen.getByText('no motion sensors on this device · tablet required')).toBeTruthy();
  });

  it('capteurs présents : gîte signée affichée avec le bord', () => {
    vi.stubGlobal('DeviceMotionEvent', class DeviceMotionEventStub {});
    render(<MotionPanel />);

    // atan2(3, 9.81) ~ +17.0 deg : tribord.
    dispatchMotion(3, 0, 9.81);

    expect(screen.getByText('+17.0°')).toBeTruthy();
    expect(screen.getByText('STBD')).toBeTruthy();
  });

  it('capteurs présents : gîte négative affichée bord opposé', () => {
    vi.stubGlobal('DeviceMotionEvent', class DeviceMotionEventStub {});
    render(<MotionPanel />);

    dispatchMotion(-3, 0, 9.81);

    expect(screen.getByText('-17.0°')).toBeTruthy();
    expect(screen.getByText('PORT')).toBeTruthy();
  });
});
