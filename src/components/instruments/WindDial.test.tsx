import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import WindDial from './WindDial';

describe('WindDial', () => {
  it('rend la fleche a la TWD quand le vent est disponible', () => {
    const { container } = render(<WindDial twdDeg={320} twsKts={12} />);
    expect(container.querySelector('[data-testid="wind-arrow"]')).toBeTruthy();
    expect(screen.getByText('12 kt')).toBeTruthy();
  });

  it('sans vent : pas de fleche, double tiret', () => {
    const { container } = render(<WindDial twdDeg={null} twsKts={null} />);
    expect(container.querySelector('[data-testid="wind-arrow"]')).toBeNull();
    expect(screen.getByText('--')).toBeTruthy();
  });

  it('graduations et cardinaux rendus', () => {
    const { container } = render(<WindDial twdDeg={0} twsKts={5} />);
    expect(container.querySelectorAll('.compass-tick').length).toBe(12);
    expect(container.querySelectorAll('.compass-cardinal').length).toBe(4);
  });
});
