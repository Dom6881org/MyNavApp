import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import BottomInstrumentsPanel from './BottomInstrumentsPanel';
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

describe('BottomInstrumentsPanel (finalisation #166)', () => {
  it('WIND avec WindDial + bascule, DEPTH numerique sans bascule', () => {
    render(<BottomInstrumentsPanel data={data()} />);
    expect(screen.getByTestId('instrument-WIND')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'WIND display mode' })).toBeTruthy();
    expect(screen.getByTestId('bottom-depth').textContent).toContain('24.6');
    // DEPTH : pas de cadran possible -> pas de bouton 123/◉
    expect(screen.queryByRole('button', { name: 'DEPTH display mode' })).toBeNull();
  });

  it('#188 v5 : switch APPARENT|VRAI SOUS la rosace + readouts apparents colorés, défaut apparent, persisté', () => {
    render(<BottomInstrumentsPanel data={data()} />);
    const sw = screen.getByTestId('bottom-wind-needle-switch');
    // retour n°1 : sous la rosace, pas dans le header
    expect(sw.closest('.instrument-card-header')).toBeNull();
    expect(sw.closest('.helm-central-value')).toBeTruthy();
    // readouts apparents sous le cadran, bleu = apparent
    const readouts = screen.getByTestId('bottom-wind-readouts');
    expect(readouts.textContent).toContain('AWS');
    expect(readouts.textContent).toContain('15 kt');
    expect(readouts.textContent).toContain('AWA');
    expect(readouts.textContent).toContain('45°');
    expect(readouts.querySelectorAll('.wind-apparent').length).toBe(2);
    const segments = Array.from(sw.querySelectorAll('button'));
    // APPARENT actif par défaut — aiguille sur AWA 45
    expect(segments.find((b) => b.textContent === 'APPARENT')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('svg.wind-dial')?.getAttribute('aria-label')).toContain('Apparent wind 45');
    // clic VRAI : aiguille sur TWA 60 + persistance mynav:wind-needle
    fireEvent.click(segments.find((b) => b.textContent === 'VRAI')!);
    expect(segments.find((b) => b.textContent === 'VRAI')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('svg.wind-dial')?.getAttribute('aria-label')).toContain('True wind 60');
    expect(window.localStorage.getItem('mynav:wind-needle')).toBe('true');
  });

  it('alarme profondeur : badge ALARM + seuil affiche', () => {
    render(
      <BottomInstrumentsPanel
        data={data({ depth: { depth: 1.5, temperature: 17, alarm: true, alarmDepth: 2 } })}
      />
    );
    expect(screen.getByText('ALARM')).toBeTruthy();
    expect(screen.getByTestId('bottom-depth').textContent).toContain('1.5');
    expect(screen.getByTestId('bottom-depth').textContent).toContain('alarm at 2.0');
  });

  it('donnees absentes : double tiret sans crash', () => {
    render(
      <BottomInstrumentsPanel
        data={data({ depth: null, wind: null, apparentWind: null })}
      />
    );
    expect(screen.getByTestId('bottom-depth').textContent).toContain('--');
  });
});
