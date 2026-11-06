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

  it('vent : switch CADRAN/NUMÉRIQUE, cadran par défaut puis grille 2×2 égale en numérique (#188 v5)', () => {
    render(<CoastalPanel data={data()} />);
    const sw = screen.getByTestId('coastal-wind-switch');
    expect(sw.textContent).toContain('CADRAN');
    expect(sw.textContent).toContain('NUMÉRIQUE');
    // Cadran par défaut : le WindDial affiche le TWS au centre (et le
    // readout TWS sous le cadran — même texte, plusieurs occurrences).
    expect(screen.getAllByText('12 kt').length).toBeGreaterThanOrEqual(1);
    // Les QUATRE readouts TWS/AWS/TWA/AWA sous le cadran, colorés par bord.
    const readouts = screen.getByTestId('coastal-wind-readouts');
    expect(readouts.textContent).toContain('TWS');
    expect(readouts.textContent).toContain('AWS');
    expect(readouts.textContent).toContain('TWA');
    expect(readouts.textContent).toContain('AWA');
    expect(readouts.querySelectorAll('.wind-true').length).toBe(2);
    expect(readouts.querySelectorAll('.wind-apparent').length).toBe(2);

    // Passage en numérique : grille 2×2 de valeurs ÉGALES (#188 v5
    // retour n°2) — et PAS de switch APPARENT|VRAI (retour n°3).
    fireEvent.click(
      screen.getByTestId('coastal-wind-switch').querySelector('button:last-child')!
    );
    const grid = screen.getByTestId('coastal-wind-numeric');
    expect(grid.textContent).toContain('TWS');
    expect(grid.textContent).toContain('12 kt');
    expect(grid.textContent).toContain('TWA');
    expect(grid.textContent).toContain('60°');
    expect(grid.textContent).toContain('AWS');
    expect(grid.textContent).toContain('15 kt');
    expect(grid.textContent).toContain('AWA');
    expect(grid.textContent).toContain('45°');
    expect(screen.queryByTestId('coastal-wind-needle-switch')).toBeNull();
  });

  it('#188 : switch APPARENT|VRAI dans le header VENT — défaut apparent, persisté', () => {
    render(<CoastalPanel data={data()} />);
    const sw = screen.getByTestId('coastal-wind-needle-switch');
    // #188 v5 (retour n°1) : sous la rosace, PAS dans le header — qui
    // ne garde que le switch CADRAN|NUMÉRIQUE.
    expect(sw.closest('.instrument-card-header')).toBeNull();
    expect(sw.closest('.helm-central-value')).toBeTruthy();
    expect(screen.getByTestId('coastal-wind-switch').closest('.instrument-card-header')).not.toBeNull();
    const segments = Array.from(sw.querySelectorAll('button'));
    // APPARENT actif par défaut — aiguille sur AWA 45 (fixtures)
    expect(segments.find((b) => b.textContent === 'APPARENT')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('svg.wind-dial')?.getAttribute('aria-label')).toContain('Apparent wind 45');
    // clic VRAI : aiguille sur TWA 60 + persistance
    fireEvent.click(segments.find((b) => b.textContent === 'VRAI')!);
    expect(segments.find((b) => b.textContent === 'VRAI')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('svg.wind-dial')?.getAttribute('aria-label')).toContain('True wind 60');
    expect(window.localStorage.getItem('mynav:wind-needle')).toBe('true');
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

  it('quitter le mouillage : efface le mouillage et revient à l\'état initial (retour #186)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T18:42:00'));
    render(<CoastalPanel data={data()} />);
    fireEvent.click(screen.getByTestId('coastal-anchor-btn'));
    expect(screen.getByTestId('coastal-anchor-bar')).toBeTruthy();
    expect(window.localStorage.getItem('coastal-anchor')).not.toBeNull();

    // QUITTER LE MOUILLAGE : barre remplacée par le bouton pleine largeur,
    // localStorage effacé.
    fireEvent.click(screen.getByTestId('coastal-anchor-quit-btn'));
    expect(screen.queryByTestId('coastal-anchor-bar')).toBeNull();
    expect(window.localStorage.getItem('coastal-anchor')).toBeNull();
    expect(screen.getByTestId('coastal-anchor-btn').textContent).toContain('MOUILLAGE FAIT');
  });

  it('chart background : suit la préférence OVERVIEW (clé mapBaseStyle, retour #186)', () => {
    // Défaut : standard.
    const { unmount } = render(<CoastalPanel data={data()} />);
    expect(
      (screen.getByTestId('coastal-map').querySelector('.coastal-map-canvas') as HTMLElement)
        .className
    ).toContain('map-base-standard');
    unmount();

    // Préférence OVERVIEW 'faded' → classe map-base-faded sur le conteneur carte.
    window.localStorage.setItem('mapBaseStyle', 'faded');
    render(<CoastalPanel data={data()} />);
    expect(
      (screen.getByTestId('coastal-map').querySelector('.coastal-map-canvas') as HTMLElement)
        .className
    ).toContain('map-base-faded');
    expect(
      (screen.getByTestId('coastal-map').querySelector('.coastal-map-canvas') as HTMLElement)
        .className
    ).not.toContain('map-base-standard');
  });

  it('sans position GPS : bouton mouillage désactivé + fallback carte', () => {
    render(<CoastalPanel data={data({ position: null })} />);
    expect((screen.getByTestId('coastal-anchor-btn') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('coastal-map-fallback').textContent).toContain('pas de position GPS');
  });
});
