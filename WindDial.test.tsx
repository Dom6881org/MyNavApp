import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import WindDial from './WindDial';

describe('WindDial', () => {
  it('rend aiguille, TWS et TWD quand le vent est disponible', () => {
    const { container } = render(<WindDial twdDeg={320} twsKts={12} />);
    expect(container.querySelector('[data-testid="wind-arrow"]')).toBeTruthy();
    expect(screen.getByText('12 kt')).toBeTruthy();
    expect(screen.getByTestId('wind-dial-twd').textContent).toBe('320°');
  });

  it('arcs Raymarine : bâbord rouge, tribord vert', () => {
    const { container } = render(<WindDial twdDeg={0} twsKts={5} />);
    expect(container.querySelector('[data-testid="wind-arc-port"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="wind-arc-starboard"]')).toBeTruthy();
  });

  it('sans vent : pas d aiguille ni de TWD, double tiret unique', () => {
    const { container } = render(<WindDial twdDeg={null} twsKts={null} />);
    expect(container.querySelector('[data-testid="wind-arrow"]')).toBeNull();
    expect(container.querySelector('[data-testid="wind-dial-twd"]')).toBeNull();
    expect(screen.getAllByText('--').length).toBe(1);
  });

  it('graduations et cardinaux rendus', () => {
    const { container } = render(<WindDial twdDeg={0} twsKts={5} />);
    expect(container.querySelectorAll('.compass-tick').length).toBe(12);
    expect(container.querySelectorAll('.compass-cardinal').length).toBe(4);
  });

  it('TWD normalisee (370° -> 10°)', () => {
    render(<WindDial twdDeg={370} twsKts={5} />);
    expect(screen.getByTestId('wind-dial-twd').textContent).toBe('10°');
  });
});
