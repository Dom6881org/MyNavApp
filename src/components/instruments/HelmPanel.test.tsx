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

  it('#184 : ordre des tuiles TIME, POSITION, SOG, TWS, COG, DEPTH — les SIX toujours visibles', () => {
    const { container } = render(<HelmPanel data={data()} />);
    const order = Array.from(container.querySelectorAll('.helm-compact .helm-tile')).map(
      (tile) => tile.getAttribute('data-testid')
    );
    expect(order).toEqual([
      'helm-compact-time',
      'helm-compact-position',
      'helm-compact-sog',
      'helm-compact-wind',
      'helm-compact-compass',
      'helm-compact-depth'
    ]);
    // la tuile de l'instrument au centre est presente ET surlignee
    const active = screen.getByTestId('helm-compact-compass');
    expect(active.className).toContain('active');
    expect(active.getAttribute('aria-current')).toBe('true');
    const idle = screen.getByTestId('helm-compact-time');
    expect(idle.className).not.toContain('active');
    expect(idle.getAttribute('aria-current')).toBeNull();
  });

  it('#184 : clic sur tuile TWS -> VENT au centre, la tuile RESTE a droite (active)', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-wind'));
    expect(screen.getByTestId('instrument-WIND')).toBeTruthy();
    // les QUATRE valeurs du vent en digital sous le cadran (mode cadran par defaut)
    const readouts = screen.getByTestId('helm-wind-readouts').textContent ?? '';
    expect(readouts).toContain('TWS');
    expect(readouts).toContain('12 kt');
    expect(readouts).toContain('AWS');
    expect(readouts).toContain('15 kt');
    expect(readouts).toContain('TWA');
    expect(readouts).toContain('60°');
    expect(readouts).toContain('AWA');
    expect(readouts).toContain('45°');
    // #184 : la tuile TWS ne quitte PAS la colonne — elle devient active
    const windTile = screen.getByTestId('helm-compact-wind');
    expect(windTile.className).toContain('active');
    expect(windTile.textContent).toContain('12');
    // le compas reste en tuile, plus actif
    expect(screen.getByTestId('helm-compact-compass').textContent).toContain('137°');
    expect(screen.getByTestId('helm-compact-compass').className).not.toContain('active');
  });

  it('#184 : clic sur tuile SOG -> VITESSE au centre avec STW jumele, tuile reste', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-sog'));
    expect(screen.getByTestId('instrument-SOG')).toBeTruthy();
    expect(screen.getByText(/kn SOG · STW --/)).toBeTruthy();
    expect(screen.getByTestId('helm-compact-sog').className).toContain('active');
    // toutes les tuiles restent presentees
    expect(screen.getByTestId('helm-compact-wind')).toBeTruthy();
    expect(screen.getByTestId('helm-compact-compass')).toBeTruthy();
    expect(screen.getByTestId('helm-compact-depth')).toBeTruthy();
    expect(screen.getByTestId('helm-compact-time')).toBeTruthy();
    expect(screen.getByTestId('helm-compact-position')).toBeTruthy();
  });

  it('#184 : clic sur tuile COG -> COMPAS au centre, tuile COG active', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-wind')); // VENT au centre
    fireEvent.click(screen.getByTestId('helm-compact-compass')); // retour compas
    expect(screen.getByTestId('instrument-COMPASS')).toBeTruthy();
    expect(screen.getByTestId('helm-compact-compass').className).toContain('active');
    expect(screen.getByTestId('helm-compact-wind').className).not.toContain('active');
  });

  it('#184 : DEPTH est cliquable -> PROFONDEUR au centre, tuile reste', () => {
    const depthData = data({
      depth: { depth: 24.6, alarm: false, alarmDepth: 2.0 } as unknown as NavigationData['depth']
    });
    render(<HelmPanel data={depthData} />);
    const depthTile = screen.getByTestId('helm-compact-depth');
    expect(depthTile.tagName).toBe('BUTTON');
    expect(depthTile.textContent).toContain('24.6');
    fireEvent.click(depthTile);
    expect(screen.getByTestId('instrument-DEPTH')).toBeTruthy();
    // la tuile profondeur RESTE dans la colonne droite, active
    expect(screen.getByTestId('helm-compact-depth').className).toContain('active');
    expect(screen.getByTestId('helm-compact-wind')).toBeTruthy();
  });

  it('#184 : TIME est cliquable -> HEURE au centre, tuile reste', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-time'));
    expect(screen.getByTestId('instrument-TIME')).toBeTruthy();
    // heure affichee au centre ET en tuile
    expect(screen.getAllByText('12:00:00').length).toBe(2);
    expect(screen.getByText('05/11/2026')).toBeTruthy();
    expect(screen.getByTestId('helm-compact-time').className).toContain('active');
    expect(screen.getByTestId('helm-compact-depth')).toBeTruthy();
  });

  it('#184 : POSITION est cliquable -> lat/lon en grand + WGS 84, tuile reste', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-position'));
    expect(screen.getByTestId('instrument-POSITION')).toBeTruthy();
    // lat/lon au centre ET en tuile
    expect(screen.getAllByText("42°30.000'N").length).toBe(2);
    expect(screen.getAllByText("3°6.000'E").length).toBe(2);
    expect(screen.getByText('WGS 84')).toBeTruthy();
    expect(screen.getByTestId('helm-compact-position').className).toContain('active');
  });

  it('#182 n°13 : heure/position sans donnee -> double tiret au centre et en tuile', () => {
    render(<HelmPanel data={data({ gpsTime: null, position: null })} />);
    expect(screen.getByTestId('helm-compact-time').textContent).toContain('--');
    expect(screen.getByTestId('helm-compact-position').textContent).toContain('--');
    fireEvent.click(screen.getByTestId('helm-compact-time'));
    expect(screen.getAllByText('local').length).toBe(2);
    fireEvent.click(screen.getByTestId('helm-compact-position'));
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(2);
  });

  it('#184 : switch 123 -> vue digitale COG enorme + HDG ambre dessous', () => {
    render(<HelmPanel data={data()} />);
    const toggle = screen.getByLabelText('COMPASS display mode');
    expect(toggle.getAttribute('data-mode')).toBe('dial');
    expect(toggle.hasAttribute('disabled')).toBe(false);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('data-mode')).toBe('numeric');
    const digital = screen.getByTestId('helm-central-digital');
    expect(digital.textContent).toContain('137°');
    expect(digital.textContent).toContain('HDG 132°');
    expect(digital.textContent).toContain('°TRUE');
    // le cadran a laisse la place a la vue digitale
    expect(screen.queryByText('COG : 137')).toBeNull();
    // retour au cadran
    fireEvent.click(toggle);
    expect(screen.getByText('COG : 137')).toBeTruthy();
    expect(screen.queryByTestId('helm-central-digital')).toBeNull();
  });

  it('#184 : vue digitale du VENT — TWS enorme + AWS/TWA/AWA dessous', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-wind')); // VENT au centre
    const toggle = screen.getByLabelText('WIND display mode');
    expect(toggle.getAttribute('data-mode')).toBe('dial');
    fireEvent.click(toggle);
    const digital = screen.getByTestId('helm-central-digital');
    expect(digital.textContent).toContain('TWS');
    expect(digital.textContent).toContain('12');
    expect(digital.textContent).toContain('kt');
    expect(digital.textContent).toContain('AWS');
    expect(digital.textContent).toContain('15 kt');
    expect(digital.textContent).toContain('TWA');
    expect(digital.textContent).toContain('60°');
    expect(digital.textContent).toContain('AWA');
    expect(digital.textContent).toContain('45°');
  });

  it('#184 : switch DESACTIVE (grise) pour TIME — instrument sans cadran', () => {
    render(<HelmPanel data={data()} />);
    const compassToggle = screen.getByLabelText('COMPASS display mode');
    expect(compassToggle.hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByTestId('helm-compact-time')); // TIME au centre
    const timeToggle = screen.getByLabelText('TIME display mode');
    expect(timeToggle.hasAttribute('disabled')).toBe(true);
    // un clic n'a aucun effet : pas de vue digitale pour l'heure
    fireEvent.click(timeToggle);
    expect(screen.queryByTestId('helm-central-digital')).toBeNull();
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
    // SOG au centre ET en tuile
    expect(screen.getAllByText('0.0').length).toBe(2);
  });

  it('tuile DEPTH sans donnee : double tiret', () => {
    render(<HelmPanel data={data()} />);
    expect(screen.getByTestId('helm-compact-depth').textContent).toContain('--');
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
