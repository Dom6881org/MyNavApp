import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import WindDial from './WindDial';

/** #188 : cadran vent RELATIF au bateau (maquette v4 validée Dom) —
 * rose proue-en-haut, wedges remplis 0-50°, aiguille APPARENT par
 * défaut (repli sur le vrai), TWD étiqueté, plus de cardinals N/E/S/W. */

describe('WindDial relatif bateau (#188)', () => {
  it('aiguille sur l’apparent (AWA -100 → 260° relatif), TWD étiqueté, TWS en boîte', () => {
    const { container } = render(
      <WindDial twdDeg={135} twsKts={15} awaDeg={-100} twaDeg={-45} />
    );
    expect(container.querySelector('[data-testid="wind-arrow"]')).toBeTruthy();
    // Vignette étiquetée : plus d'angle anonyme au milieu du cadran
    expect(screen.getByText('TWD')).toBeTruthy();
    expect(screen.getByTestId('wind-dial-twd').textContent).toBe('135°');
    expect(screen.getByText('15 kt')).toBeTruthy();
    // aria-label = apparent par défaut, angle relatif normalisé
    const svg = container.querySelector('svg.wind-dial');
    expect(svg?.getAttribute('aria-label')).toContain('Apparent wind 260');
    expect(svg?.getAttribute('aria-label')).toContain('15 knots');
  });

  it('mode vrai : aiguille sur TWA (-45 → 315° relatif, exemple Raymarine)', () => {
    const { container } = render(
      <WindDial twdDeg={135} twsKts={15} awaDeg={-100} twaDeg={-45} mode="true" />
    );
    const svg = container.querySelector('svg.wind-dial');
    expect(svg?.getAttribute('aria-label')).toContain('True wind 315');
  });

  it('repli apparent↔vrai si la donnée du mode manque', () => {
    // Mode vrai sans TWA : repli sur l'apparent, aria-label le dit
    const { container } = render(
      <WindDial twdDeg={135} twsKts={15} awaDeg={-100} twaDeg={null} mode="true" />
    );
    expect(container.querySelector('svg.wind-dial')?.getAttribute('aria-label')).toContain(
      'Apparent wind 260'
    );
    // Mode apparent sans AWA : repli sur le vrai
    const { container: c2 } = render(
      <WindDial twdDeg={135} twsKts={15} awaDeg={null} twaDeg={-45} mode="apparent" />
    );
    expect(c2.querySelector('svg.wind-dial')?.getAttribute('aria-label')).toContain(
      'True wind 315'
    );
  });

  it('wedges remplis 0-50° : bâbord rouge, tribord vert', () => {
    const { container } = render(<WindDial twdDeg={45} twsKts={10} awaDeg={30} />);
    expect(container.querySelector('[data-testid="wind-wedge-port"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="wind-wedge-starboard"]')).toBeTruthy();
  });

  it('rose relative : chiffres 30/60/90/120 chaque bord + 180, sans cardinals', () => {
    const { container } = render(<WindDial twdDeg={0} twsKts={5} awaDeg={60} />);
    // 4 valeurs × 2 bords + 180 à la poupe
    const cardinals = container.querySelectorAll('.wind-cardinal');
    expect(cardinals.length).toBe(9);
    expect(screen.getAllByText('180').length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector('.wind-cardinal-n')).toBeNull();
    expect(screen.queryByText('N')).toBeNull();
    expect(screen.queryByText('E')).toBeNull();
    expect(screen.queryByText('S')).toBeNull();
    expect(screen.queryByText('W')).toBeNull();
  });

  it('graduations tous les 30° de 60° à 180° chaque bord (9, dont 3 majeures)', () => {
    const { container } = render(<WindDial twdDeg={0} twsKts={5} awaDeg={60} />);
    expect(container.querySelectorAll('.wind-tick').length).toBe(9);
    expect(container.querySelectorAll('.wind-tick-major').length).toBe(3);
  });

  it('virole pleine rendue (fond + contour, comme le compas HELM)', () => {
    const { container } = render(<WindDial twdDeg={45} twsKts={10} awaDeg={30} />);
    expect(container.querySelectorAll('.wind-dial-virole').length).toBe(1);
  });

  it('sans vent : pas d’aiguille ni de TWD, un seul double tiret, message DANS le cadran', () => {
    const { container } = render(
      <WindDial twdDeg={null} twsKts={null} awaDeg={null} twaDeg={null} />
    );
    expect(container.querySelector('[data-testid="wind-arrow"]')).toBeNull();
    expect(container.querySelector('[data-testid="wind-dial-twd"]')).toBeNull();
    expect(screen.getAllByText('--').length).toBe(1);
    expect(screen.getByTestId('wind-no-data').textContent).toBe('no wind data');
  });

  it('angle sans TWD : aiguille rendue, TWD absent, PAS de message no-data', () => {
    const { container } = render(
      <WindDial twdDeg={null} twsKts={12} awaDeg={60} twaDeg={null} />
    );
    expect(container.querySelector('[data-testid="wind-arrow"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="wind-dial-twd"]')).toBeNull();
    expect(container.querySelector('[data-testid="wind-no-data"]')).toBeNull();
    expect(screen.getByText('12 kt')).toBeTruthy();
  });

  it('fill : le SVG occupe 100% du conteneur (retour n°9 #180)', () => {
    const { container } = render(<WindDial twdDeg={45} twsKts={10} awaDeg={30} fill />);
    const svg = container.querySelector('svg.wind-dial');
    expect(svg?.getAttribute('width')).toBe('100%');
    expect(svg?.getAttribute('height')).toBe('100%');
  });

  it('TWD normalisée : 370° affiché 10°', () => {
    render(<WindDial twdDeg={370} twsKts={8} awaDeg={30} />);
    expect(screen.getByTestId('wind-dial-twd').textContent).toBe('10°');
  });
});
