import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import WindNumericGrid from './WindNumericGrid';

/** #188 retours v5 : grille numérique VENT — 4 valeurs de MÊME taille
 * en 2×2, couleurs par bord (ambre = vrai, bleu = apparent). */

describe('WindNumericGrid (#188 v5)', () => {
  it('les 4 valeurs TWS/TWA/AWS/AWA rendues, vraies en ambre, apparentes en bleu', () => {
    const { container } = render(
      <WindNumericGrid tws={15} twa={-45} aws={17} awa={-100} testId="wind-numeric" />
    );
    const grid = screen.getByTestId('wind-numeric');
    expect(grid.textContent).toContain('TWS');
    expect(grid.textContent).toContain('15 kt');
    expect(grid.textContent).toContain('TWA');
    expect(grid.textContent).toContain('45°'); // absolu, pas de signe
    expect(grid.textContent).toContain('AWS');
    expect(grid.textContent).toContain('17 kt');
    expect(grid.textContent).toContain('AWA');
    expect(grid.textContent).toContain('100°');
    expect(container.querySelectorAll('.helm-wind-cell').length).toBe(4);
    expect(container.querySelectorAll('.wind-true').length).toBe(2);
    expect(container.querySelectorAll('.wind-apparent').length).toBe(2);
  });

  it('sans données : double tiret partout, sans crash', () => {
    render(<WindNumericGrid tws={null} twa={null} aws={null} awa={null} testId="wind-numeric" />);
    expect(screen.getAllByText('--').length).toBe(4);
  });
});
