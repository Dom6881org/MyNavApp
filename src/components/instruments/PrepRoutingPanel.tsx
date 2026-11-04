import React from 'react';
import type { RoutingInput } from '../../hooks/useRoutingInput';
import type { RoutingRouteApi } from '../../hooks/useRoutingRoute';
import type { GribApi } from '../../hooks/useGrib';
import type { Position } from '../../types';

/** Panneau PREP ROUTING (refonte instruments, Phase 3 — #162) : préparation
 * de la navigation à la barre — départ/arrivée, calcul, résumé. Compact par
 * design (sidebar) : la saisie manuelle fine reste dans le panneau ROUTING
 * de la carte ; ici on choisit les extrémités sur la carte, on lance le
 * calcul et on lit la synthèse distance/durée/ETA + statut GRIB. */

export type PrepPickTarget = 'start' | 'finish';

interface PrepRoutingPanelProps {
  routing: RoutingInput;
  pickTarget: PrepPickTarget | null;
  onRequestPick: (target: PrepPickTarget) => void;
  routeCalc?: RoutingRouteApi;
  onComputeRoute?: () => void;
  gribCalc?: GribApi;
}

/** Formatage compact des coordonnées (3 décimales suffisent en sidebar). */
const formatPrepPosition = (position: Position | null): string =>
  position
    ? `${position.latitude.toFixed(3)}, ${position.longitude.toFixed(3)}`
    : 'Not set';

/** Durée lisible : heures si >= 1 h, sinon minutes. */
const formatPrepDuration = (etaS: number): string => {
  if (etaS >= 3600) {
    const hours = etaS / 3600;
    return `${hours >= 10 ? hours.toFixed(0) : hours.toFixed(1)} h`;
  }
  return `${Math.max(1, Math.round(etaS / 60))} min`;
};

/** Heure d'arrivée locale estimée : maintenant + durée de route. */
const formatPrepArrival = (etaS: number): string =>
  new Date(Date.now() + etaS * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });

/** Statut GRIB en une ligne (cf. RoutingPanel, version compacte). */
const prepGribLabel = (grib: GribApi): { text: string; ok: boolean } => {
  if (grib.isDownloading) return { text: 'GRIB downloading…', ok: true };
  if (!grib.status?.available) return { text: 'No GRIB — constant wind', ok: false };
  if (grib.status.fresh) return { text: 'GRIB fresh', ok: true };
  return { text: 'GRIB expired — constant wind', ok: false };
};

const endpointRow = (
  target: PrepPickTarget,
  label: string,
  chip: string,
  pickTarget: PrepPickTarget | null,
  onRequestPick: (target: PrepPickTarget) => void
) => (
  <div className="prep-routing-endpoint">
    <span className="prep-routing-label">{label}</span>
    <span className="prep-routing-chip" title={chip}>{chip}</span>
    <button
      type="button"
      className={`prep-routing-pick ${pickTarget === target ? 'active' : ''}`}
      aria-label={pickTarget === target ? 'Click on the chart' : `Pick ${label.toLowerCase()} on chart`}
      disabled={pickTarget !== null && pickTarget !== target}
      onClick={() => onRequestPick(target)}
    >
      {pickTarget === target ? 'Click chart…' : 'Chart'}
    </button>
  </div>
);

const PrepRoutingPanel: React.FC<PrepRoutingPanelProps> = ({
  routing,
  pickTarget,
  onRequestPick,
  routeCalc,
  onComputeRoute,
  gribCalc
}) => {
  const route = routeCalc?.route ?? null;
  const isLoading = routeCalc?.isLoading ?? false;

  const startChip = routing.useCurrentPosition
    ? (routing.startPosition ? `GPS · ${formatPrepPosition(routing.startPosition)}` : 'Waiting for GPS…')
    : formatPrepPosition(routing.startPosition);
  const finishChip = formatPrepPosition(routing.finishPosition);

  const grib = gribCalc ? prepGribLabel(gribCalc) : null;

  return (
    <div className="prep-routing-panel" role="group" aria-label="Prep routing">
      <div className="prep-routing-section">
        <span className="prep-routing-section-label">ROUTE</span>
        {endpointRow('start', 'START', startChip, pickTarget, onRequestPick)}
        {endpointRow('finish', 'FINISH', finishChip, pickTarget, onRequestPick)}
        {routing.errors.start && <p className="prep-routing-error">{routing.errors.start}</p>}
        {routing.errors.finish && <p className="prep-routing-error">{routing.errors.finish}</p>}
        {routing.errors.polar && <p className="prep-routing-error">{routing.errors.polar}</p>}
        {routing.plan && routing.distanceNm !== null && (
          <p className="prep-routing-ok">
            Plan ready · {routing.distanceNm.toFixed(1)} NM
          </p>
        )}
      </div>

      {routeCalc && onComputeRoute && (
        <div className="prep-routing-actions">
          <button
            type="button"
            className="prep-routing-compute"
            disabled={!routing.plan || isLoading}
            onClick={onComputeRoute}
          >
            {isLoading ? 'Computing…' : 'COMPUTE'}
          </button>
          {isLoading && routeCalc.progress && (
            <p className="prep-routing-progress">
              {Math.max(0, Math.floor(routeCalc.progress.elapsed))} s · {routeCalc.progress.explored_nodes} nodes
            </p>
          )}
          {isLoading && routeCalc.cancel && (
            <button
              type="button"
              className="prep-routing-cancel"
              aria-label="Cancel routing computation"
              onClick={() => void routeCalc.cancel()}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {routeCalc?.error && <p className="prep-routing-error">{routeCalc.error}</p>}

      {gribCalc && grib && (
        <p className={grib.ok ? 'prep-routing-ok' : 'prep-routing-warn'}>{grib.text}</p>
      )}

      <div className="prep-routing-summary" data-testid="prep-summary">
        <span className="prep-routing-section-label">SUMMARY</span>
        {route && route.found ? (
          <>
            <div className="overview-row" data-testid="prep-summary-distance">
              <span>DISTANCE</span>
              <strong>{route.minDistNm.toFixed(1)} NM</strong>
            </div>
            <div className="overview-row" data-testid="prep-summary-duration">
              <span>DURATION</span>
              <strong>{formatPrepDuration(route.etaS)}</strong>
            </div>
            <div className="overview-row" data-testid="prep-summary-eta">
              <span>ETA</span>
              <strong>{formatPrepArrival(route.etaS)}</strong>
            </div>
            <div className="overview-row" data-testid="prep-summary-wind">
              <span>WIND</span>
              <strong>{route.windSource === 'grib' ? 'GRIB' : 'Constant'}</strong>
            </div>
          </>
        ) : (
          <p className="prep-routing-empty" data-testid="prep-summary-empty">
            No route computed — set START and FINISH, then COMPUTE.
          </p>
        )}
      </div>
    </div>
  );
};

export default PrepRoutingPanel;
