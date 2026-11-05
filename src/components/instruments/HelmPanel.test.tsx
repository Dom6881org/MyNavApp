import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HelmPanel from './HelmPanel';
import { vmgToWind } from '../../utils/instrumentPrimitives';
import type { NavigationData } from '../../types';

const data = (overrides: Partial<NavigationData> = {}): NavigationData => ({
  position: { latitude: 42.5, longitude: 3.1, accuracy: 4 } as unknown as NavigationData['position'],
  speed: { speed: 5.0, sog: 5.0, stw: null, maxSpeed: 6.1, averageSpeed: 4.2 },
  wind: null,
  apparentWind: { angleDegrees: 45, speedKnots: 15 },
  trueWind: { angleDegrees: 60, speedKnots: 12 },
  windGrid: [],
  windForecastStatus: { isLoading: false, error: null, updatedAt: null, gridError: null },
  compass: { heading: 132, cog: 137, magneticHeading: null, deviation: 0 },
  depth: null,
  gpsTime: { utcTime: '11:00:00', localTime: '12:00:00', date: '05/11/2026' },
  gpsAccuracy: null,
  ...overrides
});

describe('HelmPanel', () => {
  it('#182 n°16 : compas central — COG/HDG DANS le cadran, degres sur la rose', () => {
    render(<HelmPanel data={data()} />);
    expect(screen.getByText('COMPASS')).toBeTruthy();
    // valeurs embarquées dans le cadran (maquette), plus de readouts externes
    expect(screen.getByText('COG : 137')).toBeTruthy();
    expect(screen.getByText('HDG : 132°')).toBeTruthy();
    expect(screen.queryByTestId('helm-compass-readouts')).toBeNull();
  });

  it('#182 n°20 : COG/HDG sans donnee -> double tiret dans le cadran', () => {
    const { container } = render(<HelmPanel data={data({ compass: null })} />);
    expect(screen.getByText('HDG : --')).toBeTruthy();
    expect(container.querySelectorAll('.compass-cog')[0].textContent).toBe('COG : --');
  });

  it('#182 : plus de menu d\'onglets sous l\'instrument central', () => {
    render(<HelmPanel data={data()} />);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'VENT' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'VITESSE' })).toBeNull();
  });

  it('#182 n°13 : compas au centre -> tuiles droite = TWS, SOG, DEPTH, TIME, POSITION (pas COG)', () => {
    render(<HelmPanel data={data()} />);
    expect(screen.getByTestId('helm-compact-wind').textContent).toContain('12');
    expect(screen.getByTestId('helm-compact-sog').textContent).toContain('5.0');
    expect(screen.getByTestId('helm-compact-depth')).toBeTruthy();
    expect(screen.getByTestId('helm-compact-time').textContent).toContain('12:00:00');
    expect(screen.getByTestId('helm-compact-position').textContent).toContain("42°30.000'N");
    expect(screen.queryByTestId('helm-compact-compass')).toBeNull();
  });

  it('#182 n°13 : clic sur tuile TWS -> VENT au centre, readouts TWS/AWS/TWA/AWA, COG a droite', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-wind'));
    expect(screen.getByText('WIND')).toBeTruthy();
    // #182 n°13 : les QUATRE valeurs du vent en digital sous le cadran
    const readouts = screen.getByTestId('helm-wind-readouts').textContent ?? '';
    expect(readouts).toContain('TWS');
    expect(readouts).toContain('12 kt');
    expect(readouts).toContain('AWS');
    expect(readouts).toContain('15 kt');
    expect(readouts).toContain('TWA');
    expect(readouts).toContain('60°');
    expect(readouts).toContain('AWA');
    expect(readouts).toContain('45°');
    // l'ancien central (compas) reprend sa place en digital a droite
    expect(screen.getByTestId('helm-compact-compass').textContent).toContain('137°');
    expect(screen.getByTestId('helm-compact-compass').textContent).toContain('HDG 132°');
    // SOG reste a droite, TWS n'y est plus (il est au centre)
    expect(screen.getByTestId('helm-compact-sog').textContent).toContain('5.0');
    expect(screen.queryByTestId('helm-compact-wind')).toBeNull();
  });

  it('#182 n°13 : clic sur tuile SOG -> VITESSE au centre avec STW jumele, COG/TWS a droite', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-sog'));
    expect(screen.getByText('SOG')).toBeTruthy();
    expect(screen.getByText(/kn SOG · STW --/)).toBeTruthy();
    expect(screen.getByTestId('helm-compact-wind').textContent).toContain('12');
    expect(screen.getByTestId('helm-compact-compass').textContent).toContain('137°');
    expect(screen.getByTestId('helm-compact-depth')).toBeTruthy();
    expect(screen.getByTestId('helm-compact-time')).toBeTruthy();
    expect(screen.getByTestId('helm-compact-position')).toBeTruthy();
    expect(screen.queryByTestId('helm-compact-sog')).toBeNull();
  });

  it('#182 n°13 : clic sur tuile COG -> COMPAS au centre, tuiles TWS + SOG a droite', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-wind')); // VENT au centre
    fireEvent.click(screen.getByTestId('helm-compact-compass')); // retour compas
    expect(screen.getByText('COMPASS')).toBeTruthy();
    expect(screen.getByTestId('helm-compact-wind')).toBeTruthy();
    expect(screen.getByTestId('helm-compact-sog')).toBeTruthy();
    expect(screen.queryByTestId('helm-compact-compass')).toBeNull();
  });

  it('#182 n°13 : DEPTH est cliquable -> PROFONDEUR au centre', () => {
    const depthData = data({
      depth: { depth: 24.6, alarm: false, alarmDepth: 2.0 } as unknown as NavigationData['depth']
    });
    render(<HelmPanel data={depthData} />);
    const depthTile = screen.getByTestId('helm-compact-depth');
    expect(depthTile.tagName).toBe('BUTTON');
    expect(depthTile.textContent).toContain('24.6');
    fireEvent.click(depthTile);
    expect(screen.getByText('DEPTH')).toBeTruthy();
    expect(screen.getByText('24.6')).toBeTruthy();
    expect(screen.getByText('m')).toBeTruthy();
    // la tuile profondeur quitte la colonne droite, TWS y reste
    expect(screen.queryByTestId('helm-compact-depth')).toBeNull();
    expect(screen.getByTestId('helm-compact-wind')).toBeTruthy();
  });

  it('#182 n°13 : TIME est cliquable -> HEURE au centre (heure locale + date)', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-time'));
    expect(screen.getByText('TIME')).toBeTruthy();
    expect(screen.getByText('12:00:00')).toBeTruthy();
    expect(screen.getByText('05/11/2026')).toBeTruthy();
    expect(screen.queryByTestId('helm-compact-time')).toBeNull();
    expect(screen.getByTestId('helm-compact-depth')).toBeTruthy();
  });

  it('#182 n°13 : POSITION est cliquable -> lat/lon en grand + WGS 84', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-position'));
    expect(screen.getByText('POSITION')).toBeTruthy();
    expect(screen.getByText("42°30.000'N")).toBeTruthy();
    expect(screen.getByText("3°6.000'E")).toBeTruthy();
    expect(screen.getByText('WGS 84')).toBeTruthy();
    expect(screen.queryByTestId('helm-compact-position')).toBeNull();
  });

  it('#182 n°13 : heure/position sans donnee -> double tiret au centre et en tuile', () => {
    render(<HelmPanel data={data({ gpsTime: null, position: null })} />);
    expect(screen.getByTestId('helm-compact-time').textContent).toContain('--');
    expect(screen.getByTestId('helm-compact-position').textContent).toContain('--');
    fireEvent.click(screen.getByTestId('helm-compact-time'));
    expect(screen.getByText('local')).toBeTruthy();
    fireEvent.click(screen.getByTestId('helm-compact-position'));
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(2);
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

  it('#182 n°13 : STW 0.0 est une donnee reelle, affichee telle quelle (pas --)', () => {
    render(<HelmPanel data={data({ speed: { speed: 0, sog: 0, stw: 0, maxSpeed: 0, averageSpeed: 0 } })} />);
    expect(screen.getByTestId('helm-compact-sog').textContent).toContain('STW 0.0');
    fireEvent.click(screen.getByTestId('helm-compact-sog'));
    expect(screen.getByText(/kn SOG · STW 0.0/)).toBeTruthy();
    expect(screen.getByText('0.0')).toBeTruthy();
  });

  it('tuile DEPTH sans donnee : double tiret', () => {
    render(<HelmPanel data={data()} />);
    expect(screen.getByTestId('helm-compact-depth').textContent).toContain('--');
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
