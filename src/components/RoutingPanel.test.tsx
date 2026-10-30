import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RoutingPanel, { RoutingPickTarget } from './RoutingPanel';
import { useRoutingInput } from '../hooks/useRoutingInput';
import { RoutingRouteApi } from '../hooks/useRoutingRoute';
import { GribApi } from '../hooks/useGrib';
import { Position, GribStatus, RoutingRouteResult } from '../types';

const POSITION: Position = { latitude: 47.5, longitude: -4.5 };

const stubPolarsFetch = () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve({
      polars: [{ id: 'polaire-sugar', name: 'Sugar (Bavaria 36)' }]
    })
  }));
};

const ROUTE_FOUND: RoutingRouteResult = {
  found: true,
  coords: [[47.5, -4.5], [47.6, -4.6]],
  etaS: 12600,
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
  polarId: 'polaire-sugar',
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

const stubGrib = (status: GribStatus | null): GribApi => ({
  status,
  isDownloading: false,
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
  onDownloadGrib?: () => void;
}

const Harness: React.FC<HarnessProps> = ({
  currentPosition,
  pickTarget,
  onRequestPick,
  onClose,
  routeCalc,
  onComputeRoute,
  gribCalc,
  onDownloadGrib
}) => {
  const routing = useRoutingInput(currentPosition);
  return (
    <RoutingPanel
      routing={routing}
      pickTarget={pickTarget}
      onRequestPick={onRequestPick}
      onClose={onClose}
      routeCalc={routeCalc}
      onComputeRoute={onComputeRoute}
      gribCalc={gribCalc}
      onDownloadGrib={onDownloadGrib}
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

describe('RoutingPanel', () => {
  it('affiche le titre et les sections Départ / Arrivée / Polaire', async () => {
    stubPolarsFetch();
    renderPanel();

    expect(screen.getByText('ROUTING')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Departure' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Destination' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Polar' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveValue('polaire-sugar');
    });
    expect(screen.getByRole('combobox')).toHaveDisplayValue('Sugar (Bavaria 36)');
  });

  it('le bouton de sélection du départ est désactivé tant que la position courante est utilisée', async () => {
    stubPolarsFetch();
    renderPanel();
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: 'Pick departure on chart' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Pick departure on chart' })).toBeEnabled();
  });

  it('les boutons de sélection demandent la bonne cible', async () => {
    stubPolarsFetch();
    const onRequestPick = vi.fn();
    renderPanel({ onRequestPick });
    const user = userEvent.setup();

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Pick departure on chart' }));
    expect(onRequestPick).toHaveBeenCalledWith('start');

    await user.click(screen.getByRole('button', { name: 'Pick destination on chart' }));
    expect(onRequestPick).toHaveBeenCalledWith('finish');
  });

  it('la cible active met son bouton en état sélection', () => {
    stubPolarsFetch();
    renderPanel({ pickTarget: 'finish' });

    const destinationButton = screen.getByRole('button', { name: 'Click on the chart…' });
    expect(destinationButton).toHaveClass('active');
    expect(screen.queryByRole('button', { name: 'Pick destination on chart' })).not.toBeInTheDocument();
  });

  it('affiche les erreurs de validation en direct', async () => {
    stubPolarsFetch();
    renderPanel({ currentPosition: null });

    await waitFor(() => {
      expect(screen.getByText(/En attente/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Plan ready/i)).not.toBeInTheDocument();
  });

  it('saisie d’une arrivée valide : plan prêt avec distance et polaire', async () => {
    stubPolarsFetch();
    renderPanel();
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('polaire-sugar'));
    await user.type(screen.getByLabelText('Destination latitude'), '47.6');
    await user.type(screen.getByLabelText('Destination longitude'), '-4.6');

    const status = await screen.findByText(/Plan ready/i);
    expect(status).toHaveTextContent(/NM/);
    expect(status).toHaveTextContent(/Sugar \(Bavaria 36\)/);
  });

  it('le bouton de fermeture appelle onClose', async () => {
    stubPolarsFetch();
    const onClose = vi.fn();
    renderPanel({ onClose });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Close routing panel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('section Route masquée sans routeCalc fourni', () => {
    stubPolarsFetch();
    renderPanel();

    expect(screen.queryByRole('heading', { name: 'Route' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Compute route' })).not.toBeInTheDocument();
  });

  it('Compute route désactivé sans plan, activé et cliqué avec une arrivée valide', async () => {
    stubPolarsFetch();
    const onComputeRoute = vi.fn();
    renderPanel({ routeCalc: stubRouteCalc(), onComputeRoute });
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: 'Compute route' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Compute route' }));
    expect(onComputeRoute).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Destination latitude'), '47.6');
    await user.type(screen.getByLabelText('Destination longitude'), '-4.6');
    await user.click(screen.getByRole('button', { name: 'Compute route' }));
    expect(onComputeRoute).toHaveBeenCalledTimes(1);
  });

  it('route trouvée : ETA et vent affichés, Clear appelle clear', async () => {
    stubPolarsFetch();
    const routeCalc = stubRouteCalc(ROUTE_FOUND);
    renderPanel({ routeCalc, onComputeRoute: vi.fn() });
    const user = userEvent.setup();

    expect(screen.getByText(/Route · ETA 3\.5 h/)).toBeInTheDocument();
    expect(screen.getByText(/constant 12 kt/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear route' }));
    expect(routeCalc.clear).toHaveBeenCalledTimes(1);
  });

  it('route non trouvée : message de meilleure progression affiché', () => {
    stubPolarsFetch();
    const partialRoute = { ...ROUTE_FOUND, found: false, geojson: null, etaS: 0, message: 'Aucune route trouvée : horizon dépassé (meilleure progression à 14.4 mn de l\'arrivée).' };
    renderPanel({ routeCalc: stubRouteCalc(partialRoute), onComputeRoute: vi.fn() });

    expect(screen.getByText(/Aucune route trouvée/i)).toBeInTheDocument();
    expect(screen.getByText(/14\.4 mn/i)).toBeInTheDocument();
    expect(screen.queryByText(/Route · ETA/i)).not.toBeInTheDocument();
  });

  it('erreur de calcul affichée avec bouton actif', () => {
    stubPolarsFetch();
    renderPanel({ routeCalc: stubRouteCalc(null, 'Polaire inconnue : inconnue.'), onComputeRoute: vi.fn() });

    expect(screen.getByText(/Polaire inconnue/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear route' })).not.toBeInTheDocument();
  });

  it('section Wind masquée sans gribCalc fourni', () => {
    stubPolarsFetch();
    renderPanel();

    expect(screen.queryByRole('heading', { name: 'Wind' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download GRIB/i })).not.toBeInTheDocument();
  });

  it('GRIB frais : statut valide jusqu’au, bouton téléchargement actif avec plan', async () => {
    stubPolarsFetch();
    const onDownloadGrib = vi.fn();
    renderPanel({ gribCalc: stubGrib(GRIB_FRESH), onDownloadGrib });
    const user = userEvent.setup();

    expect(screen.getByText(/GRIB fresh · valid until/i)).toBeInTheDocument();
    const downloadButton = screen.getByRole('button', { name: /Download GRIB/i });
    expect(downloadButton).toBeDisabled();

    await user.type(screen.getByLabelText('Destination latitude'), '47.6');
    await user.type(screen.getByLabelText('Destination longitude'), '-4.6');
    await user.click(downloadButton);
    expect(onDownloadGrib).toHaveBeenCalledTimes(1);
  });

  it('GRIB absent : repli vent constant affiché', () => {
    stubPolarsFetch();
    renderPanel({ gribCalc: stubGrib(null), onDownloadGrib: vi.fn() });

    expect(screen.getByText(/No GRIB on board — constant wind fallback/i)).toBeInTheDocument();
  });
});
