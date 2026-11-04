import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import OverviewPanel from './OverviewPanel';
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

describe('OverviewPanel', () => {
  it('position, cap/vitesse, vent, profondeur, heure', () => {
    render(<OverviewPanel data={data()} />);
    expect(screen.getByTestId('overview-position').textContent).toContain("42°30.000'N");
    expect(screen.getByTestId('overview-position').textContent).toContain("3°6.000'E");
    expect(screen.getByTestId('overview-course').textContent).toContain('5.0 kn');
    expect(screen.getByTestId('overview-course').textContent).toContain('137°');
    expect(screen.getByTestId('overview-wind').textContent).toContain('12 kt');
    expect(screen.getByTestId('overview-wind').textContent).toContain('320°');
    expect(screen.getByTestId('overview-depth').textContent).toContain('24.6 m');
    expect(screen.getByTestId('overview-time').textContent).toContain('11:00');
  });

  it('donnees absentes : double tiret sur chaque ligne', () => {
    render(
      <OverviewPanel data={data({ position: null, speed: null, compass: null, wind: null, depth: null, gpsTime: null })} />
    );
    expect(screen.getAllByText('--').length).toBe(5);
  });
});
