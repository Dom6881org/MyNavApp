import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  gpsAccuracy: 8,
  ...overrides
});

const clickSegment = (label: string) => {
  const buttons = screen
    .getByTestId('helm-mode-switch')
    .querySelectorAll('button');
  const target = Array.from(buttons).find((b) => b.textContent === label);
  if (!target) throw new Error(`segment introuvable : ${label}`);
  fireEvent.click(target);
};

describe('HelmPanel', () => {
  it('#182 n°16 : compas central par defaut — COG/HDG DANS le cadran', () => {
    render(<HelmPanel data={data()} />);
    expect(screen.getByText('COMPASS')).toBeTruthy();
    // valeurs embarquées dans le cadran (maquette), plus de readouts externes
    expect(screen.getByText('COG : 137')).toBeTruthy();
    expect(screen.getByText('HDG : 132°')).toBeTruthy();
    expect(screen.queryByTestId('helm-compass-readouts')).toBeNull();
  });

  it('#184 n°21-quater : switch SEGMENTE a gauche du titre — compas TROIS segments', () => {
    render(<HelmPanel data={data()} />);
    const segments = Array.from(
      screen.getByTestId('helm-mode-switch').querySelectorAll('button')
    );
    expect(segments.map((b) => b.textContent)).toEqual(['CADRAN', '1/2 CADRAN', 'NUMÉRIQUE']);
    // CADRAN actif par défaut, les autres non
    expect(segments.find((b) => b.textContent === 'CADRAN')?.getAttribute('aria-pressed')).toBe('true');
    expect(segments.find((b) => b.textContent === 'NUMÉRIQUE')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('#184 n°21-quater : segment 1/2 CADRAN -> demi-cadran legacy en grand', () => {
    render(<HelmPanel data={data()} />);
    clickSegment('1/2 CADRAN');
    expect(screen.getByTestId('compass-half')).toBeTruthy();
    // cap superposé au cadran
    expect(screen.getByTestId('compass-half-value').textContent).toBe('137°');
    const readings = screen.getByTestId('compass-half-readings').textContent ?? '';
    expect(readings).toContain('HDG');
    expect(readings).toContain('132°');
    expect(readings).toContain('COG');
    expect(readings).toContain('137°');
    // le course-up a laissé la place
    expect(screen.queryByText('COG : 137')).toBeNull();
    // retour au cadran course-up
    clickSegment('CADRAN');
    expect(screen.getByText('COG : 137')).toBeTruthy();
    expect(screen.queryByTestId('compass-half')).toBeNull();
  });

  it('#184 n°21-quater : segment NUMERIQUE -> vue cadrée COG/HDG', () => {
    render(<HelmPanel data={data()} />);
    clickSegment('NUMÉRIQUE');
    const numeric = screen.getByTestId('helm-central-numeric');
    expect(numeric.textContent).toContain('COG');
    expect(numeric.textContent).toContain('137°');
    expect(numeric.textContent).toContain('HDG');
    expect(numeric.textContent).toContain('132°');
    // plus de cadran
    expect(screen.queryByText('COG : 137')).toBeNull();
    expect(screen.queryByTestId('compass-half')).toBeNull();
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

  it('#184 : clic sur tuile TWS -> VENT au centre (2 segments), tuile reste active', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-wind'));
    expect(screen.getByTestId('instrument-WIND')).toBeTruthy();
    // le vent n'a QUE DEUX segments (pas de 1/2 CADRAN)
    const segments = Array.from(
      screen.getByTestId('helm-mode-switch').querySelectorAll('button')
    ).map((b) => b.textContent);
    expect(segments).toEqual(['CADRAN', 'NUMÉRIQUE']);
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
  });

  it('#188 : switch APPARENT|VRAI au central VENT — défaut apparent, persisté, aiguille suit', () => {
    window.localStorage.clear();
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-wind')); // VENT au centre
    const needleSwitch = screen.getByTestId('helm-wind-needle-switch');
    expect(needleSwitch).toBeTruthy();
    const segments = Array.from(needleSwitch.querySelectorAll('button'));
    // APPARENT actif par défaut — aiguille sur AWA 45
    expect(segments.find((b) => b.textContent === 'APPARENT')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('svg.wind-dial')?.getAttribute('aria-label')).toContain('Apparent wind 45');
    // clic VRAI : aiguille sur TWA 60 + persistance mynav:wind-needle
    fireEvent.click(segments.find((b) => b.textContent === 'VRAI')!);
    expect(segments.find((b) => b.textContent === 'VRAI')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('svg.wind-dial')?.getAttribute('aria-label')).toContain('True wind 60');
    expect(window.localStorage.getItem('mynav:wind-needle')).toBe('true');
    window.localStorage.clear();
  });

  it('#184 : vue digitale du VENT — TWS enorme + AWS/TWA/AWA dessous', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-wind')); // VENT au centre
    clickSegment('NUMÉRIQUE');
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

  it('#184 n°21-quater : vitesse CADRAN — jauge legacy STW/SOG + MAX + RESET', () => {
    const onReset = vi.fn();
    render(<HelmPanel data={data()} onResetMaxSpeed={onReset} />);
    fireEvent.click(screen.getByTestId('helm-compact-sog'));
    expect(screen.getByTestId('instrument-SOG')).toBeTruthy();
    const gauge = screen.getByTestId('speed-gauge');
    expect(gauge.textContent).toContain('STW');
    expect(gauge.textContent).toContain('5.0');
    expect(gauge.textContent).toContain('SOG');
    expect(gauge.textContent).toContain('MAX');
    expect(gauge.textContent).toContain('6.1');
    // bouton RESET actif (onResetMaxSpeed fourni)
    const reset = screen.getByTitle('Reset session max speed');
    fireEvent.click(reset);
    expect(onReset).toHaveBeenCalledTimes(1);
    // la tuile reste, active
    expect(screen.getByTestId('helm-compact-sog').className).toContain('active');
  });

  it('#184 n°21-quater : vitesse NUMERIQUE — lignes cadrées STW/SOG/MAX + RESET', () => {
    const onReset = vi.fn();
    render(<HelmPanel data={data()} onResetMaxSpeed={onReset} />);
    fireEvent.click(screen.getByTestId('helm-compact-sog'));
    clickSegment('NUMÉRIQUE');
    const numeric = screen.getByTestId('helm-central-numeric');
    // STW absent (VHW) -> double tiret ; SOG et MAX présents
    expect(numeric.textContent).toContain('STW');
    expect(numeric.textContent).toContain('--');
    expect(numeric.textContent).toContain('SOG');
    expect(numeric.textContent).toContain('5.0');
    expect(numeric.textContent).toContain('MAX');
    expect(numeric.textContent).toContain('6.1');
    expect(numeric.textContent).toContain('kn');
    fireEvent.click(screen.getByTitle('Reset session max speed'));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('#184 : HEURE au centre — PAS de switch, lignes cadrées LOCAL + TU', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-time'));
    expect(screen.getByTestId('instrument-TIME')).toBeTruthy();
    // pas de switch du tout pour l'heure (retour n°21-quater)
    expect(screen.queryByTestId('helm-mode-switch')).toBeNull();
    const numeric = screen.getByTestId('helm-central-numeric');
    expect(numeric.textContent).toContain('LOCAL');
    expect(numeric.textContent).toContain('12:00:00');
    expect(numeric.textContent).toContain('TU');
    expect(numeric.textContent).toContain('11:00:00');
    // heure locale au centre ET en tuile ; date en tuile
    expect(screen.getAllByText('12:00:00').length).toBe(2);
    expect(screen.getByText('05/11/2026')).toBeTruthy();
    expect(screen.getByTestId('helm-compact-time').className).toContain('active');
  });

  it('#184 : PROFONDEUR au centre — PAS de switch, lignes cadrées DEPTH + TEMP', () => {
    const depthData = data({
      depth: {
        depth: 24.6,
        temperature: 18.2,
        alarm: false,
        alarmDepth: 2.0
      } as unknown as NavigationData['depth']
    });
    render(<HelmPanel data={depthData} />);
    fireEvent.click(screen.getByTestId('helm-compact-depth'));
    expect(screen.getByTestId('instrument-DEPTH')).toBeTruthy();
    expect(screen.queryByTestId('helm-mode-switch')).toBeNull();
    const numeric = screen.getByTestId('helm-central-numeric');
    expect(numeric.textContent).toContain('DEPTH');
    expect(numeric.textContent).toContain('24.6');
    expect(numeric.textContent).toContain('m');
    expect(numeric.textContent).toContain('TEMP');
    expect(numeric.textContent).toContain('18.2');
    expect(screen.getByTestId('helm-compact-depth').className).toContain('active');
  });

  it('#184 : POSITION au centre — lignes cadrées LAT/LON + qualité GPS', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-position'));
    expect(screen.getByTestId('instrument-POSITION')).toBeTruthy();
    expect(screen.queryByTestId('helm-mode-switch')).toBeNull();
    const numeric = screen.getByTestId('helm-central-numeric');
    expect(numeric.textContent).toContain('LAT');
    expect(numeric.textContent).toContain("42°30.000'N");
    expect(numeric.textContent).toContain('LON');
    expect(numeric.textContent).toContain("3°6.000'E");
    expect(numeric.textContent).toContain('GPS');
    expect(numeric.textContent).toContain('± 8 m');
    // lat/lon au centre ET en tuile
    expect(screen.getAllByText("42°30.000'N").length).toBe(2);
    expect(screen.getByTestId('helm-compact-position').className).toContain('active');
  });

  it('#184 n°21-quater : plus de VMG au central (retire, retour de Dom)', () => {
    render(<HelmPanel data={data()} />);
    expect(screen.queryByTestId('helm-vmg')).toBeNull();
    expect(screen.queryByText(/VMG/)).toBeNull();
  });

  it('#182 n°20 : COG/HDG sans donnee -> double tiret dans le cadran', () => {
    const { container } = render(<HelmPanel data={data({ compass: null })} />);
    expect(screen.getByText('HDG : --')).toBeTruthy();
    expect(container.querySelectorAll('.compass-cog')[0].textContent).toBe('COG : --');
  });

  it('#182 n°13 : heure/position sans donnee -> double tiret au centre et en tuile', () => {
    render(<HelmPanel data={data({ gpsTime: null, position: null })} />);
    expect(screen.getByTestId('helm-compact-time').textContent).toContain('--');
    expect(screen.getByTestId('helm-compact-position').textContent).toContain('--');
    fireEvent.click(screen.getByTestId('helm-compact-time'));
    // tuile sans date -> repli 'local'
    expect(screen.getAllByText('local').length).toBe(1);
    fireEvent.click(screen.getByTestId('helm-compact-position'));
    // LAT/LON/GPS sans donnee : triple tiret
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(3);
  });

  it('#182 n°13 : STW 0.0 est une donnee reelle, affichee telle quelle (pas --)', () => {
    render(
      <HelmPanel
        data={data({ speed: { speed: 0, sog: 0, stw: 0, maxSpeed: 0, averageSpeed: 0 } })}
      />
    );
    expect(screen.getByTestId('helm-compact-sog').textContent).toContain('STW 0.0');
    fireEvent.click(screen.getByTestId('helm-compact-sog'));
    // jauge : STW 0.0 affiche tel quel
    expect(screen.getByTestId('speed-gauge').textContent).toContain('STW');
    expect(screen.getByTestId('speed-gauge').textContent).toContain('0.0');
    // SOG en tuile aussi
    expect(screen.getByTestId('helm-compact-sog').textContent).toContain('0.0');
  });

  it('#184 : clic sur tuile COG -> COMPAS au centre, tuile COG active', () => {
    render(<HelmPanel data={data()} />);
    fireEvent.click(screen.getByTestId('helm-compact-wind')); // VENT au centre
    fireEvent.click(screen.getByTestId('helm-compact-compass')); // retour compas
    expect(screen.getByTestId('instrument-COMPASS')).toBeTruthy();
    expect(screen.getByTestId('helm-compact-compass').className).toContain('active');
    expect(screen.getByTestId('helm-compact-wind').className).not.toContain('active');
  });

  it('tuile DEPTH sans donnee : double tiret', () => {
    render(<HelmPanel data={data()} />);
    expect(screen.getByTestId('helm-compact-depth').textContent).toContain('--');
  });

  it('STW jumele SOG en tuile : double tiret tant que VHW est absent (#166)', () => {
    render(<HelmPanel data={data()} />);
    expect(screen.getByTestId('helm-compact-sog').textContent).toContain('STW --');
  });

  it('#182 : plus de menu d\'onglets sous l\'instrument central', () => {
    render(<HelmPanel data={data()} />);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'VENT' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'VITESSE' })).toBeNull();
  });
});

describe('vmgToWind (pur — fonction conservée, plus affichée au central)', () => {
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
