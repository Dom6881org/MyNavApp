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

  it('#182 n°14 : cadran pur — COG/HDG ne sont plus embarques dans le SVG', () => {
    const { container } = render(<CompassDial cog={137.4} heading={132} />);
    expect(container.querySelector('.compass-cog')).toBeNull();
    expect(container.querySelector('.compass-cog-label')).toBeNull();
    expect(container.querySelector('.compass-hdg')).toBeNull();
    expect(screen.queryByText('137')).toBeNull();
    expect(screen.queryByText('COG °TRUE')).toBeNull();
    expect(screen.queryByText('HDG 132°')).toBeNull();
  });

  it('COG null : rose non tournee, pas de faux texte dans le cadran', () => {
    const { container } = render(<CompassDial cog={null} />);
    expect(
      container.querySelector('[data-testid="compass-rose"]')!.getAttribute('transform')
    ).toContain('rotate(0');
    expect(screen.queryByText('--')).toBeNull();
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
