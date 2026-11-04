import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RouteTimeCursor from './RouteTimeCursor';

const COORDS: [number, number][] = [
  [42.5, 3.1],
  [42.5, 3.2],
  [42.6, 3.3]
];
const TIMES = [0, 3600, 7200];
const SOG = [0, 4.0, 5.0];

describe('RouteTimeCursor', () => {
  it('rend un slider et la lecture au depart par defaut', () => {
    render(<RouteTimeCursor coords={COORDS} timesS={TIMES} sogKts={SOG} etaS={7200} />);
    const slider = screen.getByLabelText('Time cursor');
    expect(slider).toBeTruthy();
    expect(screen.getByText(/T\+ 0\.0 h/)).toBeTruthy();
    // Le cap du premier segment (est) et le SOG d'arrivee du point 1.
    expect(screen.getByText(/90°/)).toBeTruthy();
    expect(screen.getByText(/4\.0 kt/)).toBeTruthy();
  });

  it('deplacer le curseur : interpolation heure/cap/SOG', () => {
    render(<RouteTimeCursor coords={COORDS} timesS={TIMES} sogKts={SOG} etaS={7200} />);
    const slider = screen.getByLabelText('Time cursor');
    fireEvent.change(slider, { target: { value: '7200' } });
    expect(screen.getByText(/T\+ 2 h/)).toBeTruthy();
    expect(screen.getByText(/5\.0 kt/)).toBeTruthy();
  });

  it('nouvelle route calculee : retour au depart', () => {
    const { rerender } = render(
      <RouteTimeCursor coords={COORDS} timesS={TIMES} sogKts={SOG} etaS={7200} />
    );
    fireEvent.change(screen.getByLabelText('Time cursor'), { target: { value: '7200' } });
    expect(screen.getByText(/T\+ 2 h/)).toBeTruthy();

    const otherCoords: [number, number][] = [[43.0, 4.0], [43.1, 4.1]];
    rerender(
      <RouteTimeCursor coords={otherCoords} timesS={[0, 3600]} sogKts={[0, 3.0]} etaS={3600} />
    );
    expect(screen.getByText(/T\+ 0\.0 h/)).toBeTruthy();
  });

  it('donnees insuffisantes : rien de rendu', () => {
    const { container } = render(
      <RouteTimeCursor coords={[[42.5, 3.1]]} timesS={[0]} sogKts={undefined} etaS={0} />
    );
    expect(container.textContent).toBe('');
  });
});
