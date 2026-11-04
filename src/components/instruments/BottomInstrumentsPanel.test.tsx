import { render, screen } from '@testing-library/react';
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
