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
  it('#172 : barre de modes sans corps — onglets rendus, HELM sélectionné', () => {
    render(<InstrumentModesPanel data={data} initialMode="helm" />);
    expect(screen.getByRole('tab', { name: 'HELM' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'ROUTING' })).toBeTruthy();
    // plus de corps : App rend le panneau du mode actif
    expect(screen.queryByText('137°')).toBeNull();
  });

  it('commutation HELM -> COASTAL -> OVERVIEW -> ROUTING (barre seule)', () => {
    render(<InstrumentModesPanel data={data} initialMode="helm" />);
    fireEvent.click(screen.getByRole('tab', { name: 'COASTAL' }));
    expect(screen.getByRole('tab', { name: 'COASTAL' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'OVERVIEW' }));
    expect(screen.getByRole('tab', { name: 'OVERVIEW' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'ROUTING' }));
    expect(screen.getByRole('tab', { name: 'ROUTING' }).getAttribute('aria-selected')).toBe('true');
  });

  it('ROUTING persiste comme les autres modes', () => {
    render(<InstrumentModesPanel data={data} initialMode="helm" />);
    fireEvent.click(screen.getByRole('tab', { name: 'ROUTING' }));
    expect(window.localStorage.getItem('mynav:ui-mode')).toBe('prep');
  });

  it('AUTO desactive par defaut : alarme profondeur ne change pas le mode (Phase 4)', () => {
    window.localStorage.clear();
    const alarmData: NavigationData = {
      ...data,
      depth: { ...data.depth!, alarm: true, depth: 1.5, alarmDepth: 2 }
    };
    render(<InstrumentModesPanel data={alarmData} initialMode="helm" />);
    // reste en HELM : pas d'avis auto, onglet HELM sélectionné
    expect(screen.getByRole('tab', { name: 'HELM' }).getAttribute('aria-selected')).toBe('true');
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
    expect(screen.getByRole('tab', { name: 'COASTAL' }).getAttribute('aria-selected')).toBe('true');
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

  it('#172 : ROUTING remplace PREP comme libellé du 4e onglet', () => {
    render(<InstrumentModesPanel data={data} initialMode="overview" />);
    expect(screen.getByRole('tab', { name: 'OVERVIEW' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('tab', { name: 'PREP' })).toBeNull();
  });
});
