import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import WindDial from './WindDial';

describe('WindDial façon Raymarine (#176, reprise HELM #180)', () => {
  it('aiguille vers la provenance, TWS dans la vignette, TWD en digital', () => {
    const { container } = render(<WindDial twdDeg={320} twsKts={12} />);
    expect(container.querySelector('[data-testid="wind-arrow"]')).toBeTruthy();
    expect(screen.getByText('12 kt')).toBeTruthy();
    expect(screen.getByTestId('wind-dial-twd').textContent).toBe('320°');
  });

  it('arcs bâbord (rouge) et tribord (vert) présents', () => {
    const { container } = render(<WindDial twdDeg={45} twsKts={10} />);
    expect(container.querySelector('[data-testid="wind-arc-port"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="wind-arc-starboard"]')).toBeTruthy();
  });

  it('virole pleine rendue (fond + contour, comme le compas HELM)', () => {
    const { container } = render(<WindDial twdDeg={45} twsKts={10} />);
    expect(container.querySelectorAll('.wind-dial-virole').length).toBe(1);
  });

  it('sans vent : pas d\'aiguille ni de TWD, un seul double tiret, message DANS le cadran', () => {
    const { container } = render(<WindDial twdDeg={null} twsKts={null} />);
    expect(container.querySelector('[data-testid="wind-arrow"]')).toBeNull();
    expect(container.querySelector('[data-testid="wind-dial-twd"]')).toBeNull();
    expect(screen.getAllByText('--').length).toBe(1);
    expect(screen.getByTestId('wind-no-data').textContent).toBe('no wind data');
  });

  it('graduations (12) et cardinaux (4) rendus (classes .wind-* propres)', () => {
    const { container } = render(<WindDial twdDeg={0} twsKts={5} />);
    expect(container.querySelectorAll('.wind-tick').length).toBe(12);
    expect(container.querySelectorAll('.wind-cardinal').length).toBe(4);
  });

  it('fill : le SVG occupe 100% du conteneur (retour n°9 #180)', () => {
    const { container } = render(<WindDial twdDeg={45} twsKts={10} fill />);
    const svg = container.querySelector('svg.wind-dial');
    expect(svg?.getAttribute('width')).toBe('100%');
    expect(svg?.getAttribute('height')).toBe('100%');
  });

  it('TWD normalisée : 370° affiché 10°', () => {
    render(<WindDial twdDeg={370} twsKts={8} />);
    expect(screen.getByTestId('wind-dial-twd').textContent).toBe('10°');
  });
});
