import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import RoutingPanel, { RoutingPickTarget } from './RoutingPanel';
import { useRoutingInput } from '../hooks/useRoutingInput';
import { RoutingRouteApi } from '../hooks/useRoutingRoute';
import { GribApi } from '../hooks/useGrib';
import { Position, GribStatus, RoutingJobResult, RoutingRouteResult } from '../types';

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

const stubRouteCalc = (
  route: RoutingJobResult | null = null,
  error: string | null = null,
  overrides: Partial<RoutingRouteApi> = {}
): RoutingRouteApi => ({
  route,
  isLoading: false,
  error,
  progress: null,
  compute: vi.fn(),
  cancel: vi.fn(),
  clear: vi.fn(),
  ...overrides
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

  it('calcul en cours : progression brute (durée, nœuds explorés) et bouton Annuler fonctionnel', async () => {
    const routeCalc = stubRouteCalc(null, null, {
      isLoading: true,
      progress: { elapsed: 65, explored_nodes: 1234, phases: { pruning_s: 12 } }
    });
    renderPanel({ routeCalc, onComputeRoute: vi.fn() });
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: 'Computing…' })).toBeInTheDocument();
    expect(screen.getByText(/1 min 05 s/)).toBeInTheDocument();
    expect(screen.getByText(/1,234 nodes explored/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel routing computation' }));
    expect(routeCalc.cancel).toHaveBeenCalledTimes(1);
  });

  it('calcul en cours sans progression (file d\'attente) : "Queued…" affiché, pas de pourcentage', () => {
    const routeCalc = stubRouteCalc(null, null, { isLoading: true, progress: null });
    renderPanel({ routeCalc, onComputeRoute: vi.fn() });

    expect(screen.getByText('Queued…')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('calcul en cours : relancer reste possible et annule le job précédent côté hook', async () => {
    const onComputeRoute = vi.fn();
    const routeCalc = stubRouteCalc(null, null, { isLoading: true });
    renderPanel({ routeCalc, onComputeRoute });
    const user = userEvent.setup();

    await enterDestination(user);
    const computeButton = screen.getByRole('button', { name: 'Computing…' });
    expect(computeButton).toBeEnabled();
    await user.click(computeButton);
    expect(onComputeRoute).toHaveBeenCalledTimes(1);
  });

  it('statut cancelled : message clair affiché', () => {
    renderPanel({ routeCalc: stubRouteCalc(null, 'Routing cancelled.'), onComputeRoute: vi.fn() });

    expect(screen.getByText(/Routing cancelled/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel routing computation' })).not.toBeInTheDocument();
  });

  it('paramètres effectifs du job affichés (dt, maille, durée de calcul)', () => {
    const routeWithParams = { ...ROUTE_FOUND, params: { dt_s: 3600, bin_deg: 0.039 }, timings: { total_s: 54.4 } };
    renderPanel({ routeCalc: stubRouteCalc(routeWithParams), onComputeRoute: vi.fn() });

    expect(screen.getByText(/dt 1 h · grid 0\.039° · computed in 54\.4 s/)).toBeInTheDocument();
  });

  it('route sans paramètres remontés : aucune ligne de paramètres', () => {
    renderPanel({ routeCalc: stubRouteCalc(ROUTE_FOUND), onComputeRoute: vi.fn() });

    expect(screen.queryByText(/grid /i)).not.toBeInTheDocument();
    expect(screen.queryByText(/computed in/i)).not.toBeInTheDocument();
  });

  it('SOG par tronçon : sparkline et stats affichées (issue #18)', () => {
    const routeWithSog: RoutingJobResult = {
      ...ROUTE_FOUND,
      timesS: [0, 1800, 3600],
      sogKts: [6.1, 5.4, 6.8]
    };
    renderPanel({ routeCalc: stubRouteCalc(routeWithSog), onComputeRoute: vi.fn() });

    expect(screen.getByRole('img', { name: /SOG along legs/i })).toBeInTheDocument();
    expect(screen.getByText(/SOG 5\.4–6\.8 kt · avg 6\.1 kt/)).toBeInTheDocument();
  });

  it('heure d’arrivée locale affichée, pas de sparkline sans SOG (issue #18)', () => {
    renderPanel({ routeCalc: stubRouteCalc(ROUTE_FOUND), onComputeRoute: vi.fn() });

    expect(screen.getByText(/^arr\. /)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /SOG along legs/i })).not.toBeInTheDocument();
  });

  it('fiche route détaillée : résumé replié puis table des jambes au clic (issue #121)', async () => {
    const routeWithLegs: RoutingJobResult = {
      ...ROUTE_FOUND,
      coords: [[47.5, -4.5], [47.51, -4.5], [47.52, -4.5]],
      // Convention moteur (#123) : une entrée par point du tracé.
      timesS: [0, 1800, 3600],
      sogKts: [5, 5, 5],
      etaS: 3600
    };
    renderPanel({ routeCalc: stubRouteCalc(routeWithLegs), onComputeRoute: vi.fn() });
    const user = userEvent.setup();

    const summary = screen.getByRole('button', { name: 'Route details · 1 leg · 0 course changes' });
    expect(summary).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await user.click(summary);
    expect(summary).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('000°')).toBeInTheDocument();
    expect(screen.getByText(/^Arr\. /)).toBeInTheDocument();

    // Garde-fou anti-régression (#127) : le bloc doit vivre en PORTAL hors du
    // panneau de routage — enfant de document.body, jamais descendant de
    // .map-routing-panel (overflow-y: auto), qui le clipperait à l'écran.
    const panel = document.querySelector('.route-details-panel');
    expect(panel).not.toBeNull();
    expect(panel?.parentElement).toBe(document.body);
    expect(panel?.closest('.map-routing-panel')).toBeNull();
  });

  it('fiche route détaillée masquée quand la route n’est pas trouvée (issue #121)', () => {
    const partialRoute = { ...ROUTE_FOUND, found: false, geojson: null, etaS: 0, message: 'Aucune route trouvée : horizon dépassé (meilleure progression à 14.4 mn de l\'arrivée).' };
    renderPanel({ routeCalc: stubRouteCalc(partialRoute), onComputeRoute: vi.fn() });

    expect(screen.queryByRole('button', { name: /Route details/i })).not.toBeInTheDocument();
  });

  it('fiche route détaillée sans SOG remonté : jambes, caps et distances quand même (issue #121)', async () => {
    renderPanel({ routeCalc: stubRouteCalc(ROUTE_FOUND), onComputeRoute: vi.fn() });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Route details · 1 leg · 0 course changes' }));

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(2); // entête + 1 jambe
    expect(within(table).getByText(/^[0-9]{3}°$/)).toBeInTheDocument();
    expect(within(table).getAllByText('—')).toHaveLength(2); // temps + SOG absents
    expect(within(table).getByText(/NM$/)).toBeInTheDocument();
  });

  // B1 (#133) : seuil de relais moteur « Motor below (kt) ».
  it('champ Motor below (kt) affiché avec le défaut 2, éditable', async () => {
    renderPanel();
    const user = userEvent.setup();

    const input = screen.getByLabelText('Motor below (kt)') as HTMLInputElement;
    expect(input.value).toBe('2');

    await user.clear(input);
    await user.type(input, '2.5');
    expect(input.value).toBe('2.5');
  });

  it('seuil moteur invalide : erreur affichée et Compute route désactivé', async () => {
    renderPanel({ routeCalc: stubRouteCalc(), onComputeRoute: vi.fn() });
    const user = userEvent.setup();

    await enterDestination(user);
    expect(screen.getByRole('button', { name: 'Compute route' })).toBeEnabled();

    const input = screen.getByLabelText('Motor below (kt)');
    await user.clear(input);
    await user.type(input, '15');
    expect(screen.getByText(/Seuil moteur invalide/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compute route' })).toBeDisabled();

    await user.clear(input);
    expect(screen.queryByText(/Seuil moteur invalide/i)).not.toBeInTheDocument();
  });

  it('route avec tronçons moteur : note moteur et badge MOTOR dans la fiche (B1)', async () => {
    const routeWithMotor: RoutingJobResult = {
      ...ROUTE_FOUND,
      coords: [[47.5, -4.5], [47.51, -4.5], [47.52, -4.5]],
      timesS: [0, 1800, 3600],
      sogKts: [4, 4, 4],
      etaS: 3600,
      motorFlags: [false, false, true],
      engineBelowKts: 2
    };
    renderPanel({ routeCalc: stubRouteCalc(routeWithMotor), onComputeRoute: vi.fn() });
    const user = userEvent.setup();

    expect(screen.getByText(/engine legs under 2 kt sail speed/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Route details/i }));
    expect(screen.getByText('MOTOR')).toBeInTheDocument();
  });

  it('route sans moteur : pas de note moteur ni de badge (B1)', async () => {
    const routeWithoutMotor: RoutingJobResult = {
      ...ROUTE_FOUND,
      coords: [[47.5, -4.5], [47.51, -4.5], [47.52, -4.5]],
      timesS: [0, 1800, 3600],
      sogKts: [5, 5, 5],
      etaS: 3600,
      motorFlags: [false, false, false],
      engineBelowKts: 2
    };
    renderPanel({ routeCalc: stubRouteCalc(routeWithoutMotor), onComputeRoute: vi.fn() });
    const user = userEvent.setup();

    expect(screen.queryByText(/engine legs/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Route details/i }));
    expect(screen.queryByText('MOTOR')).not.toBeInTheDocument();
  });

  it('route GRIB : vent utilisé au départ et moyenne le long de la route affichés (#135)', () => {
    const gribRoute: RoutingJobResult = {
      ...ROUTE_FOUND,
      windSource: 'grib',
      wind: { directionFromDeg: 320, speedKts: 12 },
      windAvg: { directionFromDeg: 340, speedKts: 11 }
    };
    renderPanel({ routeCalc: stubRouteCalc(gribRoute), onComputeRoute: vi.fn() });

    expect(screen.getByText(/GRIB wind from 320° · 12 kt/)).toBeInTheDocument();
    expect(screen.getByText(/avg along route 11 kt from 340°/)).toBeInTheDocument();
    expect(screen.queryByText(/constant 12 kt/i)).not.toBeInTheDocument();
  });

  it('route GRIB sans echo de vent : libellé GRIB seul, pas de moyenne (#135)', () => {
    const gribRouteNoWind: RoutingJobResult = {
      ...ROUTE_FOUND,
      windSource: 'grib',
      wind: null,
      windAvg: null
    };
    renderPanel({ routeCalc: stubRouteCalc(gribRouteNoWind), onComputeRoute: vi.fn() });

    expect(screen.getByText('GRIB wind')).toBeInTheDocument();
    expect(screen.queryByText(/avg along route/i)).not.toBeInTheDocument();
  });
});
