import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CompassDial from './CompassDial';

describe('CompassDial (COURSE-UP)', () => {
  it('rose tournee de -COG : le cap reste en haut', () => {
    const { container } = render(<CompassDial cog={90} />);
    const rose = container.querySelector('[data-testid="compass-rose"]');
    expect(rose).toBeTruthy();
    expect(rose!.getAttribute('transform')).toContain('rotate(270');
  });

  it('COG 0 : rose immobile', () => {
    const { container } = render(<CompassDial cog={0} />);
    expect(
      container.querySelector('[data-testid="compass-rose"]')!.getAttribute('transform')
    ).toContain('rotate(0');
  });

  it('#182 n°16 : COG en grand sans unite + label COG TRUE, HDG en ambre DANS le cadran', () => {
    render(<CompassDial cog={137.4} heading={132} />);
    expect(screen.getByText('137')).toBeTruthy();
    expect(screen.getByText('COG °TRUE')).toBeTruthy();
    expect(screen.getByText('HDG 132°')).toBeTruthy();
  });

  it('#182 n°16 : les degres sur la rose — 8 valeurs tous les 30°, pas aux cardinaux', () => {
    const { container } = render(<CompassDial cog={0} />);
    expect(container.querySelectorAll('.compass-deg').length).toBe(8);
    const txts = Array.from(container.querySelectorAll('.compass-deg')).map((e) => e.textContent);
    ['30', '60', '120', '150', '210', '240', '300', '330'].forEach((d) => {
      expect(txts).toContain(d);
    });
  });

  it('#182 n°18 : degrés collés contre les graduations (rayon 76, hors rosace centrale)', () => {
    const { container } = render(<CompassDial cog={0} />);
    const degs = Array.from(container.querySelectorAll('.compass-deg'));
    expect(degs.length).toBe(8);
    for (const d of degs) {
      const x = Number(d.getAttribute('x'));
      const y = Number(d.getAttribute('y')) - 3; // offset baseline
      expect(Math.hypot(x - 110, y - 120)).toBeCloseTo(76, 0);
    }
  });

  it('#182 n°19 : HDG DANS le cercle, en plus petit (avec COG)', () => {
    // Bas de la virole = CY + R_OUTER = 224 ; le HDG doit rester au-dessus.
    const { container } = render(<CompassDial cog={137} heading={132} />);
    const hdg = container.querySelector('.compass-hdg')!;
    expect(Number(hdg.getAttribute('y')) + 13).toBeLessThan(224);
  });

  it('COG null : rose non tournee et double tiret', () => {
    const { container } = render(<CompassDial cog={null} />);
    expect(
      container.querySelector('[data-testid="compass-rose"]')!.getAttribute('transform')
    ).toContain('rotate(0');
    expect(screen.getByText('--')).toBeTruthy();
    expect(screen.getByText('HDG --')).toBeTruthy();
  });

  it('graduations et cardinaux rendus (36 marques, N/E/S/W)', () => {
    const { container } = render(<CompassDial cog={0} />);
    expect(container.querySelectorAll('.compass-tick').length).toBe(36);
    expect(container.querySelectorAll('.compass-point').length).toBe(4);
    expect(container.querySelectorAll('.compass-lubber').length).toBe(1);
  });

  it('cardinaux contre-rotes : les lettres restent droites (rotation inverse de la rose)', () => {
    const { container } = render(<CompassDial cog={137} />);
    const cardinals = container.querySelectorAll('.compass-point');
    expect(cardinals.length).toBe(4);
    // rose tournee de -137 (= 223) ; chaque cardinal porte rotate(-223, x, y)
    for (const c of Array.from(cardinals)) {
      expect(c.getAttribute('transform')).toContain('rotate(-223');
    }
  });

  it('virole extérieure + proue/lubber rouges rendues', () => {
    const { container } = render(<CompassDial cog={45} />);
    expect(container.querySelectorAll('.compass-outer-ring').length).toBe(1);
    expect(container.querySelectorAll('.compass-boat').length).toBe(1);
    expect(container.querySelectorAll('.compass-lubber').length).toBe(1);
  });

  it('#182 n°15 : les lettres ne portent PAS la classe legacy .compass-cardinal', () => {
    // La règle legacy .compass-cardinal { position: absolute; top: 15%;
    // left: 50%; transform: translateX(-50%) } arrachait les 4 lettres de
    // leurs coordonnées SVG et tuait la contre-rotation (empilement en
    // griffe illisible au centre du cadran depuis #180).
    const { container } = render(<CompassDial cog={137} />);
    expect(container.querySelectorAll('.compass-cardinal').length).toBe(0);
    expect(container.querySelectorAll('.compass-point').length).toBe(4);
  });
});
