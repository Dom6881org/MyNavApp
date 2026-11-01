import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RoutingPanel, { RoutingPickTarget } from './RoutingPanel';
import { useRoutingInput } from '../hooks/useRoutingInput';
import { RoutingRouteApi } from '../hooks/useRoutingRoute';
import { GribApi } from '../hooks/useGrib';
import { Position, GribStatus, RoutingRouteResult } from '../types';

const POSITION: Position = { latitude: 47.5, longitude: -4.5 };
const POLAR_ID = 'polaire-sugar';
const POLAR_NAME = 'Sugar (Bavaria 36)';

const ROUTE_FOUND: RoutingRouteResult = {
  found: true,
  coords: [[47.5, -4.5], [47.6, -4.6]],
  etaS: 12600,
  dtS: 1800,
  minDistNm: 0.5,
  message: null,
  geojson: {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[-4.5, 47.5], [-4.6, 47.6]] },
      properties: {}
    }]
  },
  windSource: 'constant',
  wind: { directionFromDeg: 270, speedKts: 12 },
  polarId: POLAR_ID,
  start: { latitude: 47.5, longitude: -4.5 },
  finish: { latitude: 47.6, longitude: -4.6 }
};

const stubRouteCalc = (route: RoutingRouteResult | null = null, error: string | null = null): RoutingRouteApi => ({
  route,
  isLoading: false,
  error,
  compute: vi.fn(),
  clear: vi.fn()
});

const GRIB_FRESH: GribStatus = {
  available: true,
  fresh: true,
  reason: null,
  createdAt: 1730000000,
  validUntil: 1730200000,
  south: 46,
  north: 47,
  west: -5,
  east: -4,
  resolutionDeg: 0.5,
  stepH: 3,
  points: 9,
  steps: 25
};

const stubGrib = (status: GribStatus | null, isDownloading = false): GribApi => ({
  status,
  isDownloading,
  error: null,
  download: vi.fn(),
  refresh: vi.fn()
});

interface HarnessProps {
  currentPosition: Position | null;
  pickTarget: RoutingPickTarget | null;
  onRequestPick: (target: RoutingPickTarget) => void;
  onClose: () => void;
  routeCalc?: RoutingRouteApi;
  onComputeRoute?: () => void;
  gribCalc?: GribApi;
}

const Harness: React.FC<HarnessProps> = ({
  currentPosition,
  pickTarget,
  onRequestPick,
  onClose,
  routeCalc,
  onComputeRoute,
  gribCalc
}) => {
  const routing = useRoutingInput(currentPosition, POLAR_ID);
  return (
    <RoutingPanel
      routing={routing}
      polarName={POLAR_NAME}
      pickTarget={pickTarget}
      onRequestPick={onRequestPick}
      onClose={onClose}
      routeCalc={routeCalc}
      onComputeRoute={onComputeRoute}
      gribCalc={gribCalc}
    />
  );
};

const renderPanel = (overrides: Partial<HarnessProps> = {}) => render(
  <Harness
    currentPosition={POSITION}
    pickTarget={null}
    onRequestPick={vi.fn()}
    onClose={vi.fn()}
    {...overrides}
  />
);

const enterDestination = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Edit destination coordinates' }));
  await user.type(screen.getByLabelText('Destination latitude'), '47.6');
  await user.type(screen.getByLabelText('Destination longitude'), '-4.6');
};

describe('RoutingPanel', () => {
  it('affiche le titre et les lignes From / To avec pastilles de coordonnées', () => {
    renderPanel();

    expect(screen.getByText('ROUTING')).toBeVisible();
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
    expect(screen.getByText('47.50000, -4.50000')).toBeInTheDocument();
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('les boutons pick/edit du départ sont désactivés tant que la position courante est utilisée', async () => {
    renderPanel();
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: 'Pick departure on chart' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit departure coordinates' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'Use current position' }));
    expect(screen.getByRole('button', { name: 'Pick departure on chart' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Edit departure coordinates' })).toBeEnabled();
  });

  it('les boutons de sélection demandent la bonne cible', async () => {
    const onRequestPick = vi.fn();
    renderPanel({ onRequestPick });
    const user = userEvent.setup();

    await user.click(screen.getByRole('checkbox', { name: 'Use current position' }));
    await user.click(screen.getByRole('button', { name: 'Pick departure on chart' }));
    expect(onRequestPick).toHaveBeenCalledWith('start');

    await user.click(screen.getByRole('button', { name: 'Pick destination on chart' }));
    expect(onRequestPick).toHaveBeenCalledWith('finish');
  });

  it('la cible active met son bouton en état sélection', () => {
    renderPanel({ pickTarget: 'finish' });

    const destinationButton = screen.getByRole('button', { name: 'Click on the chart…' });
    expect(destinationButton).toHaveClass('active');
    expect(screen.queryByRole('button', { name: 'Pick destination on chart' })).not.toBeInTheDocument();
  });

  it('édition manuelle de l’arrivée : plan prêt avec distance et polaire', async () => {
    renderPanel();
    const user = userEvent.setup();

    await enterDestination(user);

    const status = await screen.findByText(/Plan ready/i);
    expect(status).toHaveTextContent(/NM/);
    expect(status).toHaveTextContent(/Sugar \(Bavaria 36\)/);
    expect(screen.getByText('47.60000, -4.60000')).toBeInTheDocument();
  });

  it('affiche les erreurs de validation en direct', () => {
    renderPanel({ currentPosition: null });

    expect(screen.getByText(/En attente/i)).toBeInTheDocument();
    expect(screen.queryByText(/Plan ready/i)).not.toBeInTheDocument();
  });

  it('le bouton de fermeture appelle onClose', async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Close routing panel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Compute route désactivé sans plan, activé et cliqué avec une arrivée valide', async () => {
    const onComputeRoute = vi.fn();
    renderPanel({ routeCalc: stubRouteCalc(), onComputeRoute });
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: 'Compute route' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Compute route' }));
    expect(onComputeRoute).not.toHaveBeenCalled();

    await enterDestination(user);
    await user.click(screen.getByRole('button', { name: 'Compute route' }));
    expect(onComputeRoute).toHaveBeenCalledTimes(1);
  });

  it('route trouvée : ETA et distance en grand, vent affiché, Clear appelle clear', async () => {
    const routeCalc = stubRouteCalc(ROUTE_FOUND);
    renderPanel({ routeCalc, onComputeRoute: vi.fn() });
    const user = userEvent.setup();

    expect(screen.getByText('3.5 h')).toBeInTheDocument();
    expect(screen.getByText('ETA')).toBeInTheDocument();
    expect(screen.getByText(/7\.\d NM/)).toBeInTheDocument();
    expect(screen.getByText(/constant 12 kt from 270°/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear route' }));
    expect(routeCalc.clear).toHaveBeenCalledTimes(1);
  });

  it('route non trouvée : message de meilleure progression affiché', () => {
    const partialRoute = { ...ROUTE_FOUND, found: false, geojson: null, etaS: 0, message: 'Aucune route trouvée : horizon dépassé (meilleure progression à 14.4 mn de l\'arrivée).' };
    renderPanel({ routeCalc: stubRouteCalc(partialRoute), onComputeRoute: vi.fn() });

    expect(screen.getByText(/Aucune route trouvée/i)).toBeInTheDocument();
    expect(screen.getByText(/14\.4 mn/i)).toBeInTheDocument();
    expect(screen.queryByText('ETA')).not.toBeInTheDocument();
  });

  it('erreur de calcul affichée', () => {
    renderPanel({ routeCalc: stubRouteCalc(null, 'Polaire inconnue : inconnue.'), onComputeRoute: vi.fn() });

    expect(screen.getByText(/Polaire inconnue/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear route' })).not.toBeInTheDocument();
  });

  it('section Wind masquée sans gribCalc, et sans bouton de téléchargement manuel', () => {
    renderPanel();

    expect(screen.queryByText(/GRIB/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download GRIB/i })).not.toBeInTheDocument();
  });

  it('GRIB frais : statut valide affiché', () => {
    renderPanel({ gribCalc: stubGrib(GRIB_FRESH) });

    expect(screen.getByText(/GRIB fresh · valid until/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download GRIB/i })).not.toBeInTheDocument();
  });

  it('GRIB absent : avertissement de repli vent constant', () => {
    renderPanel({ gribCalc: stubGrib(null) });

    expect(screen.getByText(/No GRIB on board — constant wind fallback/i)).toBeInTheDocument();
  });

  it('téléchargement GRIB en cours : statut affiché', () => {
    renderPanel({ gribCalc: stubGrib(null, true) });

    expect(screen.getByText(/Downloading GRIB/i)).toBeInTheDocument();
  });
});
