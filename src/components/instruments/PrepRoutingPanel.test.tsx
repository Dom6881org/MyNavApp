import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PrepRoutingPanel from './PrepRoutingPanel';
import type { RoutingInput } from '../../hooks/useRoutingInput';
import type { RoutingRouteApi } from '../../hooks/useRoutingRoute';
import type { GribApi } from '../../hooks/useGrib';

const routing = (overrides: Partial<RoutingInput> = {}): RoutingInput => ({
  polarId: 'bavaria36',
  useCurrentPosition: true,
  setUseCurrentPosition: () => undefined,
  startText: { latitude: '', longitude: '' },
  setStartText: () => undefined,
  finishText: { latitude: '42.6', longitude: '3.2' },
  setFinishText: () => undefined,
  setFinishFromPosition: () => undefined,
  setStartFromPosition: () => undefined,
  motorBelowText: '2',
  setMotorBelowText: () => undefined,
  startPosition: { latitude: 42.5, longitude: 3.1 },
  finishPosition: { latitude: 42.6, longitude: 3.2 },
  distanceNm: 6.7,
  errors: { start: null, finish: null, same: null, polar: null, motor: null },
  plan: {
    useCurrentPosition: true,
    startPosition: { latitude: 42.5, longitude: 3.1 },
    finishPosition: { latitude: 42.6, longitude: 3.2 },
    polarId: 'bavaria36',
    engineBelowKts: 2
  },
  ...overrides
} as RoutingInput);

const routeCalc = (overrides: Partial<RoutingRouteApi> = {}): RoutingRouteApi => ({
  route: {
    found: true,
    coords: [[42.5, 3.1], [42.6, 3.2]],
    etaS: 5400,
    dtS: 600,
    minDistNm: 6.7,
    message: null,
    geojson: null,
    windSource: 'grib',
    wind: null,
    polarId: 'bavaria36'
  },
  isLoading: false,
  error: null,
  progress: null,
  compute: () => Promise.resolve(),
  cancel: () => Promise.resolve(),
  clear: () => undefined,
  ...overrides
} as RoutingRouteApi);

const gribCalc = (overrides: Partial<GribApi> = {}): GribApi => ({
  status: { available: true, fresh: true, validUntil: null },
  isDownloading: false,
  error: null,
  download: () => Promise.resolve(),
  refresh: () => Promise.resolve(),
  ...overrides
} as GribApi);

describe('PrepRoutingPanel', () => {
  it('START/FINISH avec coordonnees, statut GRIB, resume route calculee', () => {
    render(
      <PrepRoutingPanel
        routing={routing()}
        pickTarget={null}
        onRequestPick={() => undefined}
        routeCalc={routeCalc()}
        onComputeRoute={() => undefined}
        gribCalc={gribCalc()}
      />
    );
    expect(screen.getByText('GPS · 42.500, 3.100')).toBeTruthy();
    expect(screen.getByText('42.600, 3.200')).toBeTruthy();
    expect(screen.getByText('Plan ready · 6.7 NM')).toBeTruthy();
    expect(screen.getByText('GRIB fresh')).toBeTruthy();
    expect(screen.getByTestId('prep-summary-distance').textContent).toContain('6.7 NM');
    expect(screen.getByTestId('prep-summary-duration').textContent).toContain('1.5 h');
    expect(screen.getByTestId('prep-summary-eta').textContent).toBeTruthy();
    expect(screen.getByTestId('prep-summary-wind').textContent).toContain('GRIB');
  });

  it('etat vide explicite sans route calculee', () => {
    render(
      <PrepRoutingPanel
        routing={routing()}
        pickTarget={null}
        onRequestPick={() => undefined}
        routeCalc={routeCalc({ route: null })}
        onComputeRoute={() => undefined}
      />
    );
    expect(screen.getByTestId('prep-summary-empty').textContent).toContain('No route computed');
  });

  it('COMPUTE desactive sans plan, actif et branché avec plan', () => {
    const onCompute = vi.fn();
    const { rerender } = render(
      <PrepRoutingPanel
        routing={routing({ plan: null, distanceNm: null })}
        pickTarget={null}
        onRequestPick={() => undefined}
        routeCalc={routeCalc()}
        onComputeRoute={onCompute}
      />
    );
    const compute = screen.getByRole('button', { name: 'COMPUTE' });
    expect(compute.hasAttribute('disabled')).toBe(true);
    rerender(
      <PrepRoutingPanel
        routing={routing()}
        pickTarget={null}
        onRequestPick={() => undefined}
        routeCalc={routeCalc()}
        onComputeRoute={onCompute}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'COMPUTE' }));
    expect(onCompute).toHaveBeenCalledTimes(1);
  });

  it('boutons Chart deleguent la selection sur la carte', () => {
    const onRequestPick = vi.fn();
    render(
      <PrepRoutingPanel
        routing={routing()}
        pickTarget={null}
        onRequestPick={onRequestPick}
        routeCalc={routeCalc()}
        onComputeRoute={() => undefined}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pick start on chart' }));
    expect(onRequestPick).toHaveBeenCalledWith('start');
    fireEvent.click(screen.getByRole('button', { name: 'Pick finish on chart' }));
    expect(onRequestPick).toHaveBeenCalledWith('finish');
  });

  it('pick actif : le bouton cible affiche Click chart…, l autre est desactive', () => {
    render(
      <PrepRoutingPanel
        routing={routing()}
        pickTarget="finish"
        onRequestPick={() => undefined}
        routeCalc={routeCalc()}
        onComputeRoute={() => undefined}
      />
    );
    const finishPick = screen.getByRole('button', { name: 'Click on the chart' });
    expect(finishPick.textContent).toContain('Click chart…');
    const startPick = screen.getByRole('button', { name: 'Pick start on chart' });
    expect(startPick.hasAttribute('disabled')).toBe(true);
  });

  it('calcul en cours : progression et annulation visibles, COMPUTE desactive', () => {
    const { container } = render(
      <PrepRoutingPanel
        routing={routing()}
        pickTarget={null}
        onRequestPick={() => undefined}
        routeCalc={routeCalc({ isLoading: true, progress: { elapsed: 4, explored_nodes: 120, phases: {} } })}
        onComputeRoute={() => undefined}
      />
    );
    expect(screen.getByText('Computing…')).toBeTruthy();
    expect(screen.getByText('4 s · 120 nodes')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel routing computation' })).toBeTruthy();
    const compute = container.querySelector('.prep-routing-compute');
    expect(compute?.hasAttribute('disabled')).toBe(true);
  });

  it('erreurs du plan remontees (polaire manquante)', () => {
    render(
      <PrepRoutingPanel
        routing={routing({
          plan: null,
          errors: { start: null, finish: null, same: null, polar: 'Aucune polaire sélectionnée (réglages).', motor: null }
        })}
        pickTarget={null}
        onRequestPick={() => undefined}
        routeCalc={routeCalc()}
        onComputeRoute={() => undefined}
      />
    );
    expect(screen.getByText('Aucune polaire sélectionnée (réglages).')).toBeTruthy();
  });

  it('GRIB absent : avertissement constant wind', () => {
    render(
      <PrepRoutingPanel
        routing={routing()}
        pickTarget={null}
        onRequestPick={() => undefined}
        routeCalc={routeCalc()}
        onComputeRoute={() => undefined}
        gribCalc={gribCalc({ status: { available: false, fresh: false, validUntil: null } as unknown as GribApi['status'] })}
      />
    );
    expect(screen.getByText('No GRIB — constant wind')).toBeTruthy();
  });
});
