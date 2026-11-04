import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
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

describe('CoastalPanel', () => {
  it('vent resserré + tuiles 2x2 : DEPTH/SOG/COG/HDG', () => {
    render(<CoastalPanel data={data()} />);
    expect(screen.getByText('WIND')).toBeTruthy();
    expect(screen.getByText('12 kt')).toBeTruthy();   // TWS au centre du WindDial
    expect(screen.getByText('24.6')).toBeTruthy();    // DEPTH
    expect(screen.getByText('5.0')).toBeTruthy();     // SOG
    expect(screen.getByText('137°')).toBeTruthy();    // COG
    expect(screen.getByText('132°')).toBeTruthy();    // HDG
  });

  it('alarme profondeur : tuile DEPTH surlignee', () => {
    render(
      <CoastalPanel
        data={data({ depth: { depth: 1.5, temperature: 17, alarm: true, alarmDepth: 2 } })}
      />
    );
    expect(screen.getByTestId('coastal-tile-depth').className).toContain('alarm');
  });

  it('donnees absentes : double tiret sans crash', () => {
    render(
      <CoastalPanel
        data={data({ depth: null, speed: null, compass: null, wind: null, apparentWind: null })}
      />
    );
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(4);
  });
});
