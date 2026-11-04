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

  it('COG affiche en grand, HDG en ambre', () => {
    render(<CompassDial cog={137.4} heading={132} />);
    expect(screen.getByText('137°')).toBeTruthy();
    expect(screen.getByText('HDG 132°')).toBeTruthy();
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
    expect(container.querySelectorAll('.compass-cardinal').length).toBe(4);
    expect(container.querySelectorAll('.compass-lubber').length).toBe(1);
  });
});
