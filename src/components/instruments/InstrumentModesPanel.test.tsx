import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import InstrumentModesPanel from './InstrumentModesPanel';
import type { NavigationData } from '../../types';
import type { RoutingInput } from '../../hooks/useRoutingInput';

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

  it('onglet PREP ROUTING : rend PrepRoutingPanel quand le routage est fourni', () => {
    const routing = {
      useCurrentPosition: true,
      startPosition: { latitude: 42.5, longitude: 3.1 },
      finishPosition: null,
      distanceNm: null,
      errors: { start: null, finish: null, same: null, polar: null, motor: null },
      plan: null
    } as unknown as RoutingInput;
    render(
      <InstrumentModesPanel
        data={data}
        initialMode="prep"
        routing={routing}
        onRequestRoutingPick={() => undefined}
      />
    );
    expect(screen.getByRole('tab', { name: 'PREP' })).toBeTruthy();
    expect(screen.getByText('START')).toBeTruthy();
    expect(screen.getByText('FINISH')).toBeTruthy();
  });

  it('onglet PREP sans routage : invite explicite', () => {
    render(<InstrumentModesPanel data={data} initialMode="prep" />);
    expect(screen.getByTestId('prep-unavailable').textContent).toContain('Routing unavailable');
  });

  it('PREP persiste comme les autres modes', () => {
    render(<InstrumentModesPanel data={data} initialMode="helm" />);
    fireEvent.click(screen.getByRole('tab', { name: 'PREP' }));
    expect(window.localStorage.getItem('mynav:ui-mode')).toBe('prep');
  });

  it('AUTO desactive par defaut : alarme profondeur ne change pas le mode (Phase 4)', () => {
    window.localStorage.clear();
    const alarmData: NavigationData = {
      ...data,
      depth: { ...data.depth!, alarm: true, depth: 1.5, alarmDepth: 2 }
    };
    render(<InstrumentModesPanel data={alarmData} initialMode="helm" />);
    // reste en HELM : pas de tuiles COASTAL, pas d'avis auto
    expect(screen.getByText('COMPASS')).toBeTruthy();
    expect(screen.queryByTestId('coastal-tiles')).toBeNull();
    expect(screen.queryByTestId('instrument-auto-notice')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Auto switch to coastal on depth alarm' }).getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('AUTO + alarme profondeur : bascule automatique vers COASTAL avec avis', () => {
    window.localStorage.setItem('mynav:ui-auto', '1');
    const alarmData: NavigationData = {
      ...data,
      depth: { ...data.depth!, alarm: true, depth: 1.5, alarmDepth: 2 }
    };
    render(<InstrumentModesPanel data={alarmData} initialMode="helm" />);
    expect(screen.getByTestId('coastal-tiles')).toBeTruthy();
    expect(screen.getByTestId('instrument-auto-notice').textContent).toContain('Depth alarm');
    expect(window.localStorage.getItem('mynav:ui-mode')).toBe('coastal');
  });

  it('toggle AUTO persiste le opt-in', () => {
    render(<InstrumentModesPanel data={data} initialMode="helm" />);
    const toggle = screen.getByRole('button', { name: 'Auto switch to coastal on depth alarm' });
    fireEvent.click(toggle);
    expect(window.localStorage.getItem('mynav:ui-auto')).toBe('1');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(window.localStorage.getItem('mynav:ui-auto')).toBeNull();
  });

  it('le mode choisi est persiste (localStorage mynav:ui-mode)', () => {
    render(<InstrumentModesPanel data={data} initialMode="helm" />);
    fireEvent.click(screen.getByRole('tab', { name: 'OVERVIEW' }));
    expect(window.localStorage.getItem('mynav:ui-mode')).toBe('overview');
  });

  it('#170 : onModeChange remonte le mode actif (init puis commutation)', () => {
    const seen: string[] = [];
    render(
      <InstrumentModesPanel
        data={data}
        initialMode="helm"
        onModeChange={(mode) => seen.push(mode)}
      />
    );
    expect(seen).toContain('helm');
    fireEvent.click(screen.getByRole('tab', { name: 'COASTAL' }));
    expect(seen[seen.length - 1]).toBe('coastal');
  });

  it('#170 : hideActivePanel masque le corps du panneau actif', () => {
    render(
      <InstrumentModesPanel data={data} initialMode="overview" hideActivePanel />
    );
    // l'onglet reste présent et sélectionné, le corps est rendu par App ailleurs
    expect(screen.getByRole('tab', { name: 'OVERVIEW' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByTestId('overview-wind')).toBeNull();
  });
});
