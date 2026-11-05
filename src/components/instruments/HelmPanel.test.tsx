import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HelmPanel from './HelmPanel';
import { vmgToWind } from '../../utils/instrumentPrimitives';
import type { NavigationData } from '../../types';

const data = (overrides: Partial<NavigationData> = {}): NavigationData => ({
  position: null,
  speed: { speed: 5.0, sog: 5.0, stw: null, maxSpeed: 6.1, averageSpeed: 4.2 },
  wind: null,
  apparentWind: { angleDegrees: 45, speedKnots: 15 },
  trueWind: { angleDegrees: 60, speedKnots: 12 },
  windGrid: [],
  windForecastStatus: { isLoading: false, error: null, updatedAt: null, gridError: null },
  compass: { heading: 132, cog: 137, magneticHeading: null, deviation: 0 },
  depth: null,
  gpsTime: null,
  gpsAccuracy: null,
  ...overrides
});

describe('HelmPanel', () => {
  it('compas central par defaut : cadran COURSE-UP avec COG/HDG', () => {
    render(<HelmPanel data={data()} />);
    expect(screen.getByText('COMPASS')).toBeTruthy();
    expect(screen.getByText('137')).toBeTruthy();
    expect(screen.getByText('HDG 132°')).toBeTruthy();
  });

  it('#182 : plus de menu d\'onglets sous l\'instrument central', () => {
    render(<HelmPanel data={data()} />);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'VENT' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'VITESSE' })).toBeNull();
  });

  it('#182 : compas au centre -> tuiles droite = TWS, SOG, DEPTH (pas COG)', () => {
    render(<HelmPanel data={data()} />);
    expect(screen.getByTestId('helm-compact-wind').textContent).toContain('12');
    expect(screen.getByTestId('helm-compact-sog').textContent).toContain('5.0');
    expect(screen.getByTestId('helm-compact-depth')).toBeTruthy();
    expect(screen.queryByTestId('helm-compact-compass')).toBeNull();
  });

  it('#182 : clic sur tuile TWS -> VENT au centre, tuile COG apparait a droite', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-wind'));
    expect(screen.getByText('WIND')).toBeTruthy();
    expect(screen.getByTestId('helm-wind-line').textContent).toContain('TWA 60°');
    // l'ancien central (compas) reprend sa place en digital a droite
    expect(screen.getByTestId('helm-compact-compass').textContent).toContain('137°');
    expect(screen.getByTestId('helm-compact-compass').textContent).toContain('HDG 132°');
    // SOG reste a droite, TWS n'y est plus (il est au centre)
    expect(screen.getByTestId('helm-compact-sog').textContent).toContain('5.0');
    expect(screen.queryByTestId('helm-compact-wind')).toBeNull();
  });

  it('#182 : clic sur tuile SOG -> VITESSE au centre avec STW jumele, COG/TWS a droite', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-sog'));
    expect(screen.getByText('SOG')).toBeTruthy();
    expect(screen.getByText(/kn SOG · STW --/)).toBeTruthy();
    expect(screen.getByTestId('helm-compact-wind').textContent).toContain('12');
    expect(screen.getByTestId('helm-compact-compass').textContent).toContain('137°');
    expect(screen.queryByTestId('helm-compact-sog')).toBeNull();
  });

  it('#182 : clic sur tuile COG -> COMPAS au centre, tuiles TWS + SOG a droite', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-wind')); // VENT au centre
    fireEvent.click(screen.getByTestId('helm-compact-compass')); // retour compas
    expect(screen.getByText('COMPASS')).toBeTruthy();
    expect(screen.getByTestId('helm-compact-wind')).toBeTruthy();
    expect(screen.getByTestId('helm-compact-sog')).toBeTruthy();
    expect(screen.queryByTestId('helm-compact-compass')).toBeNull();
  });

  it('#182 : DEPTH n\'est pas cliquable (jamais centrale)', () => {
    render(<HelmPanel data={data()} />);
    const depthTile = screen.getByTestId('helm-compact-depth');
    expect(depthTile.tagName).toBe('DIV');
    expect(screen.queryByLabelText('Afficher PROFONDEUR au centre')).toBeNull();
  });

  it('VMG affiche : sog x cos(TWA)', () => {
    render(<HelmPanel data={data()} />);
    // 5.0 * cos(60°) = 2.5
    expect(screen.getByTestId('helm-vmg').textContent).toBe('VMG 2.5 kt');
  });

  it('VMG sans donnees : double tiret', () => {
    render(
      <HelmPanel
        data={data({ speed: null, trueWind: null, apparentWind: null, compass: null })}
      />
    );
    expect(screen.getByTestId('helm-vmg').textContent).toBe('VMG --');
  });

  it('STW jumele SOG en tuile : double tiret tant que VHW est absent (#166)', () => {
    render(<HelmPanel data={data()} />);
    expect(screen.getByTestId('helm-compact-sog').textContent).toContain('STW --');
  });

  it('tuile DEPTH : valeur sonde en metres, double tiret sans donnee', () => {
    const depthData = data({
      depth: { depth: 24.6, alarm: false, alarmDepth: 2.0 } as unknown as NavigationData['depth']
    });
    render(<HelmPanel data={depthData} />);
    expect(screen.getByTestId('helm-compact-depth').textContent).toContain('24.6');
  });

  it('bascule cadran/numerique de la carte centrale (InstrumentCard #157)', () => {
    render(<HelmPanel data={data()} />);
    const toggle = screen.getByLabelText('COMPASS display mode');
    expect(toggle.getAttribute('data-mode')).toBe('dial');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('data-mode')).toBe('numeric');
  });
});

describe('vmgToWind (pur)', () => {
  it('vent arriere TWA 180 : VMG negatif', () => {
    expect(vmgToWind(5, 180)).toBeCloseTo(-5, 6);
  });

  it('TWA 0 : VMG = SOG', () => {
    expect(vmgToWind(4.8, 0)).toBeCloseTo(4.8, 6);
  });

  it('donnee absente : null', () => {
    expect(vmgToWind(null, 60)).toBeNull();
    expect(vmgToWind(5, null)).toBeNull();
  });
});
