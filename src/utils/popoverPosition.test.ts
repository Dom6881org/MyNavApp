import { describe, expect, it } from 'vitest';
import { ANCHOR_GAP_PX, PANEL_WIDTH_PX, computePopoverPosition } from './popoverPosition';

// jsdom : window.innerWidth = 1024 par défaut.
const anchor = (left: number, top = 100, bottom = 130) => ({ left, top, bottom });

describe('computePopoverPosition (#127)', () => {
  it('à gauche du bouton quand la place suffit', () => {
    expect(computePopoverPosition(anchor(800))).toEqual({
      left: 800 - PANEL_WIDTH_PX - ANCHOR_GAP_PX,
      top: 100
    });
  });

  it('en dessous quand il n’y a pas la place à gauche', () => {
    expect(computePopoverPosition(anchor(200))).toEqual({ left: 200, top: 130 + ANCHOR_GAP_PX });
  });

  it('en dessous, borné au bord gauche de la fenêtre', () => {
    expect(computePopoverPosition(anchor(0))).toEqual({ left: ANCHOR_GAP_PX, top: 138 });
  });

  it('assez de place à gauche même près du bord droit : reste à côté, sans clamp', () => {
    expect(computePopoverPosition(anchor(1000))).toEqual({ left: 1000 - PANEL_WIDTH_PX - ANCHOR_GAP_PX, top: 100 });
  });

  it('en dessous, borné au bord droit de la fenêtre (petit écran)', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth');
    Object.defineProperty(window, 'innerWidth', { value: 300, configurable: true });
    try {
      // sideLeft = -80 < 8 → repli dessous, borné à droite : min(200, 300-280) = 20.
      expect(computePopoverPosition(anchor(200))).toEqual({ left: 300 - PANEL_WIDTH_PX - ANCHOR_GAP_PX, top: 138 });
    } finally {
      if (descriptor) Object.defineProperty(window, 'innerWidth', descriptor);
    }
  });
});
