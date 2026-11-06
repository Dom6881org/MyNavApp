import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import CoastalPanel from './CoastalPanel';
import type { NavigationData } from '../../types';

const data = (overrides: Partial<NavigationData> = {}): NavigationData => ({
  position: { latitude: 42.5, longitude: 3.1 },
  speed: { speed: 5.0, sog: 5.0, stw: null, maxSpeed: 6.1, averageSpeed: 4.2 },
  wind: { direction: 320, speed: 12, gust: 15, source: 'GRIB' },
  apparentWind: { angleDegrees: 45, speedKnots: 15 },
  trueWind: { angleDegrees: 60, speedKnots: 12 },
  windGrid: [],
  windForecastStatus: { isLoading: false, error: null, updatedAt: null, gridError: null },
  compass: { heading: 132, cog: 137, magneticHeading: null, deviation: 0 },
  depth: { depth: 24.6, temperature: 17, alarm: false, alarmDepth: 2 },
  gpsTime: { utcTime: '10:00', localTime: '11:00', date: '2026-11-04' },
  gpsAccuracy: null,
  ...overrides
});

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CoastalPanel — reset #186 (3 colonnes vent/profondeur/carte)', () => {
  it('affiche les 3 cartes VENT / PROFONDEUR / CARTE', () => {
    render(<CoastalPanel data={data()} />);
    expect(screen.getByText('VENT')).toBeTruthy();
    expect(screen.getByText('PROFONDEUR')).toBeTruthy();
    expect(screen.getByText('CARTE')).toBeTruthy();
  });

  it('vent : switch CADRAN/NUMÉRIQUE, cadran par défaut puis TWS énorme en numérique', () => {
    render(<CoastalPanel data={data()} />);
    const sw = screen.getByTestId('coastal-wind-switch');
    expect(sw.textContent).toContain('CADRAN');
    expect(sw.textContent).toContain('NUMÉRIQUE');
    // Cadran par défaut : le WindDial affiche le TWS au centre (et le
    // readout TWS sous le cadran — même texte, plusieurs occurrences).
    expect(screen.getAllByText('12 kt').length).toBeGreaterThanOrEqual(1);
    // Les QUATRE readouts TWS/AWS/TWA/AWA sous le cadran.
    const readouts = screen.getByTestId('coastal-wind-readouts');
    expect(readouts.textContent).toContain('TWS');
    expect(readouts.textContent).toContain('AWS');
    expect(readouts.textContent).toContain('TWA');
    expect(readouts.textContent).toContain('AWA');

    // Passage en numérique : TWS énorme + jumelage AWS/TWA/AWA (HELM).
    fireEvent.click(
      screen.getByTestId('coastal-wind-switch').querySelector('button:last-child')!
    );
    expect(screen.getByTestId('coastal-wind-numeric')).toBeTruthy();
    expect(screen.getByTestId('coastal-wind-numeric').textContent).toContain('12');
    expect(screen.queryByText('12 kt')).toBeNull();
  });

  it('profondeur 24.6 m : échelle adaptative ×2 (0-30) + marqueur', () => {
    render(<CoastalPanel data={data()} />);
    expect(screen.getByTestId('coastal-depth-scale-badge').textContent).toContain('échelle ×2');
    const marker = screen.getByTestId('coastal-depth-marker');
    expect(marker.getAttribute('data-depth')).toBe('24.6');
    // Graduations tous les 5 m jusqu'à 30 (0 m en bas).
    const tickTexts = Array.from(
      screen.getByTestId('coastal-depth-column').querySelectorAll('text')
    ).map((t) => t.textContent);
    ['0', '5', '10', '15', '20', '25', '30'].forEach((t) => {
      expect(tickTexts).toContain(t);
    });
    expect(screen.getByTestId('coastal-depth-value').textContent).toContain('24.6');
    expect(screen.queryByTestId('coastal-depth-alert')).toBeNull();
  });

  it('profondeur 8.4 m : échelle nominale 0-15, pas de badge ×2', () => {
    render(
      <CoastalPanel data={data({ depth: { depth: 8.4, temperature: 17, alarm: false, alarmDepth: 2 } })} />
    );
    expect(screen.queryByTestId('coastal-depth-scale-badge')).toBeNull();
    const tickTexts = Array.from(
      screen.getByTestId('coastal-depth-column').querySelectorAll('text')
    ).map((t) => t.textContent);
    ['0', '5', '10', '15'].forEach((t) => expect(tickTexts).toContain(t));
    expect(tickTexts).not.toContain('20');
    expect(screen.getByTestId('coastal-depth-marker').getAttribute('data-depth')).toBe('8.4');
  });

  it('alerte ≤ 2 m : bandeau clignotant + colonne entière en rouge', () => {
    render(
      <CoastalPanel data={data({ depth: { depth: 1.8, temperature: 17, alarm: false, alarmDepth: 2 } })} />
    );
    const alert = screen.getByTestId('coastal-depth-alert');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('1.8 M');
    expect(alert.textContent).toContain('TROP PEU PROFOND');
    // Colonne entière en rouge : une seule zone danger pleine hauteur.
    expect(screen.getByTestId('coastal-depth-zone-red')).toBeTruthy();
    expect(screen.getByTestId('coastal-depth-value').textContent).toContain('1.8');
    // Pied : TEMP + seuil ALARME 2.0 m.
    expect(screen.getByTestId('coastal-depth-foot').textContent).toContain('2.0 m');
  });

  it('sans données profondeur : double tiret, pas de marqueur, pas de badge', () => {
    render(<CoastalPanel data={data({ depth: null })} />);
    expect(screen.getByTestId('coastal-depth-value').textContent).toContain('--');
    expect(screen.queryByTestId('coastal-depth-marker')).toBeNull();
    expect(screen.queryByTestId('coastal-depth-scale-badge')).toBeNull();
  });

  it('mouillage : bouton pleine largeur, localStorage, remplacement au nouveau clic', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T18:42:00'));
    render(<CoastalPanel data={data()} />);
    const btn = screen.getByTestId('coastal-anchor-btn');
    expect(btn.textContent).toContain('MOUILLAGE FAIT');

    fireEvent.click(btn);
    // Barre de mouillage : heure + position + bouton NOUVEAU MOUILLAGE.
    const bar = screen.getByTestId('coastal-anchor-bar');
    expect(bar.textContent).toContain('05/11 18:42');
    expect(bar.textContent).toContain('42°');
    expect(screen.getByTestId('coastal-anchor-btn').textContent).toContain('NOUVEAU MOUILLAGE');

    const stored = JSON.parse(window.localStorage.getItem('coastal-anchor')!);
    expect(stored.latitude).toBe(42.5);
    expect(stored.longitude).toBe(3.1);

    // Un nouveau mouillage REMPLACE l'ancien (pas d'historique).
    vi.setSystemTime(new Date('2026-11-05T20:05:00'));
    fireEvent.click(screen.getByTestId('coastal-anchor-btn'));
    const stored2 = JSON.parse(window.localStorage.getItem('coastal-anchor')!);
    expect(stored2.timestamp).not.toBe(stored.timestamp);
    expect(screen.getByTestId('coastal-anchor-bar').textContent).toContain('20:05');
  });

  it('sans position GPS : bouton mouillage désactivé + fallback carte', () => {
    render(<CoastalPanel data={data({ position: null })} />);
    expect((screen.getByTestId('coastal-anchor-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('coastal-map-fallback').textContent).toContain('pas de position GPS');
  });
});
