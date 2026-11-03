import { describe, expect, it } from 'vitest';
import {
  ANCHOR_GAP_PX,
  PANEL_WIDTH_PX,
  POPOVER_MIN_HEIGHT_PX,
  SIDE_LIFT_PX,
  computePopoverMaxHeightPx,
  computePopoverPosition
} from './popoverPosition';

// jsdom : window.innerWidth = 1024 par défaut.
const anchor = (left: number, top = 100, bottom = 130) => ({ left, top, bottom });

describe('computePopoverPosition (#127/#129)', () => {
  it('à gauche du bouton quand la place suffit, décalé au-dessus du bouton (#129)', () => {
    expect(computePopoverPosition(anchor(800))).toEqual({
      left: 800 - PANEL_WIDTH_PX - ANCHOR_GAP_PX,
      top: 100 - SIDE_LIFT_PX
    });
  });

  it('le décalage vers le haut ne franchit jamais le bord supérieur de la fenêtre', () => {
    // anchor.top = 30 < SIDE_LIFT_PX : top clampé à la marge, pas négatif.
    expect(computePopoverPosition(anchor(800, 30, 60))).toEqual({
      left: 800 - PANEL_WIDTH_PX - ANCHOR_GAP_PX,
      top: ANCHOR_GAP_PX
    });
  });

  it('en dessous quand il n’y a pas la place à gauche (pas de décalage haut)', () => {
    expect(computePopoverPosition(anchor(200))).toEqual({ left: 200, top: 130 + ANCHOR_GAP_PX });
  });

  it('en dessous, borné au bord gauche de la fenêtre', () => {
    expect(computePopoverPosition(anchor(0))).toEqual({ left: ANCHOR_GAP_PX, top: 138 });
  });

  it('assez de place à gauche même près du bord droit : reste à côté, sans clamp', () => {
    expect(computePopoverPosition(anchor(1000))).toEqual({
      left: 1000 - PANEL_WIDTH_PX - ANCHOR_GAP_PX,
      top: 100 - SIDE_LIFT_PX
    });
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

describe('computePopoverMaxHeightPx (#129)', () => {
  it('tout l’espace vertical sous le haut du bloc, moins la marge de bord', () => {
    // innerHeight jsdom = 768 par défaut.
    expect(computePopoverMaxHeightPx(60)).toBe(768 - 60 - ANCHOR_GAP_PX);
    expect(computePopoverMaxHeightPx(0)).toBe(768 - ANCHOR_GAP_PX);
  });

  it('plancher : le bloc reste lisible même si l’écran est trop bas', () => {
    expect(computePopoverMaxHeightPx(700)).toBe(POPOVER_MIN_HEIGHT_PX);
  });

  it('suit un innerHeight modifié (repli/restauration dans le test)', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'innerHeight');
    Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });
    try {
      expect(computePopoverMaxHeightPx(60)).toBe(400 - 60 - ANCHOR_GAP_PX);
      expect(computePopoverMaxHeightPx(360)).toBe(POPOVER_MIN_HEIGHT_PX);
    } finally {
      if (descriptor) Object.defineProperty(window, 'innerHeight', descriptor);
    }
  });
});
