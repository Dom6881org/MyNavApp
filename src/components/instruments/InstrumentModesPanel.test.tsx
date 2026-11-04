import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import InstrumentModesPanel from './InstrumentModesPanel';
import type { NavigationData } from '../../types';

const data: NavigationData = {
  position: null,
  speed: { speed: 5.0, sog: 5.0, stw: null, maxSpeed: null, averageSpeed: null },
  wind: { direction: 320, speed: 12, gust: 15, source: 'GRIB' },
  apparentWind: null,
  trueWind: { angleDegrees: 60, speedKnots: 12 },
  windGrid: [],
  windForecastStatus: { isLoading: false, error: null, updatedAt: null, gridError: null },
  compass: { heading: 132, cog: 137, magneticHeading: null, deviation: 0 },
  depth: { depth: 24.6, temperature: 17, alarm: false, alarmDepth: 2 },
  gpsTime: null,
  gpsAccuracy: null
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('InstrumentModesPanel', () => {
  it('initialise sur HELM et rend le compas COURSE-UP', () => {
    render(<InstrumentModesPanel data={data} initialMode="helm" />);
    expect(screen.getByText('COMPASS')).toBeTruthy();
    expect(screen.getByText('137°')).toBeTruthy();
  });

  it('commutation HELM -> COASTAL -> OVERVIEW', () => {
    render(<InstrumentModesPanel data={data} initialMode="helm" />);
    fireEvent.click(screen.getByRole('tab', { name: 'COASTAL' }));
    // COASTAL : tuiles et vent
    expect(screen.getByTestId('coastal-tiles')).toBeTruthy();
    expect(screen.getByText('DEPTH')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'OVERVIEW' }));
    expect(screen.getByTestId('overview-wind')).toBeTruthy();
  });

  it('le mode choisi est persiste (localStorage mynav:ui-mode)', () => {
    render(<InstrumentModesPanel data={data} initialMode="helm" />);
    fireEvent.click(screen.getByRole('tab', { name: 'OVERVIEW' }));
    expect(window.localStorage.getItem('mynav:ui-mode')).toBe('overview');
  });
});
