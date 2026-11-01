import React from 'react';

import { RoutingInput } from '../hooks/useRoutingInput';

import { RoutingRouteApi } from '../hooks/useRoutingRoute';

import { GribApi } from '../hooks/useGrib';

import { Position } from '../types';

export type RoutingPickTarget = 'start' | 'finish';

interface RoutingPanelProps {
  routing: RoutingInput;
  polarName?: string;
  pickTarget: RoutingPickTarget | null;
  onRequestPick: (target: RoutingPickTarget) => void;
  onClose: () => void;
  routeCalc?: RoutingRouteApi;
  onComputeRoute?: () => void;
  gribCalc?: GribApi;
}

const formatEta = (etaS: number): string => {
  const hours = etaS / 3600;
  return `${hours >= 10 ? hours.toFixed(0) : hours.toFixed(1)} h`;
};

const formatClock = (epochS: number): string =>
  new Date(epochS * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Progression brute du job (issue #96) : durée écoulée, sans pourcentage. */
const formatElapsed = (elapsedS: number): string => {
  const total = Math.max(0, Math.floor(elapsedS));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  if (minutes > 0) return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
  return `${seconds} s`;
};

const formatPosition = (position: Position | null): string =>
  position ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : 'Not set';

const routeDistanceNm = (coords: [number, number][]): number => {
  const toRadians = Math.PI / 180;
  let total = 0;
  for (let i = 1; i < coords.length; i += 1) {
    const [lat1, lon1] = coords[i - 1];
    const [lat2, lon2] = coords[i];
    const dLat = (lat2 - lat1) * toRadians;
    const dLon = (lon2 - lon1) * toRadians;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRadians) * Math.cos(lat2 * toRadians) * Math.sin(dLon / 2) ** 2;
    total += 2 * 3437.75 * Math.asin(Math.sqrt(a));
  }
  return total;
};

const gribStatusLabel = (status: GribApi['status'], isDownloading: boolean): { text: string; ok: boolean } => {
  if (isDownloading) return { text: 'Downloading GRIB for the route zone…', ok: true };
  if (!status || !status.available) return { text: 'No GRIB on board — constant wind fallback', ok: false };
  if (status.fresh && status.validUntil !== null) {
    return { text: `GRIB fresh · valid until ${formatClock(status.validUntil)}`, ok: true };
  }
  return { text: 'GRIB expired — constant wind fallback', ok: false };
};

const pickButtonLabel = (target: RoutingPickTarget, active: boolean): string => {
  if (active) return 'Click on the chart…';
  return target === 'start' ? 'Pick departure on chart' : 'Pick destination on chart';
};

/**
 * Panneau de routage (issue #15) : une ligne par extrémité (From / To) avec
 * pastille de coordonnées lisible, bouton "Chart" pour choisir en un clic sur
 * la carte et bouton "Edit" pour la saisie manuelle (champs dépliés à la
 * demande). Le vent (GRIB) est téléchargé automatiquement par l'application ;
 * le panneau n'affiche que son statut, en avertissement s'il est indisponible.
 * Bouton de calcul discret, résultat (ETA, distance) mis en avant. Tant que le
 * job de routage tourne (issue #96) : progression brute (durée écoulée, nœuds
 * explorés — pas de pourcentage) et bouton « Annuler » ; relancer un calcul
 * annule d'abord le job précédent côté hook.
 * La polaire est un réglage global de l'application (voir useRoutingPolar).
 */
const RoutingPanel: React.FC<RoutingPanelProps> = ({
  routing,
  polarName = '',
  pickTarget,
  onRequestPick,
  onClose,
  routeCalc,
  onComputeRoute,
  gribCalc
}) => {
  const [editingStart, setEditingStart] = React.useState(false);
  const [editingFinish, setEditingFinish] = React.useState(false);

  const coordinateRow = (
    label: string,
    values: { latitude: string; longitude: string },
    onChange: (next: { latitude: string; longitude: string }) => void
  ) => (
    <div className="routing-coord-row">
      <input
        type="text"
        inputMode="decimal"
        className="routing-input"
        value={values.latitude}
        placeholder="lat"
        aria-label={`${label} latitude`}
        onChange={event => onChange({ ...values, latitude: event.target.value })}
      />
      <input
        type="text"
        inputMode="decimal"
        className="routing-input"
        value={values.longitude}
        placeholder="lon"
        aria-label={`${label} longitude`}
        onChange={event => onChange({ ...values, longitude: event.target.value })}
      />
    </div>
  );

  const endpointRow = (
    target: RoutingPickTarget,
    label: string,
    chip: string,
    editing: boolean,
    onToggleEdit: () => void,
    disabled: boolean
  ) => (
    <div className="routing-endpoint">
        <span className="routing-endpoint-label">{label}</span>
        <span className="routing-chip" title={chip}>{chip}</span>
        <button
          type="button"
          className={`routing-mini-button ${pickTarget === target ? 'active' : ''}`}
          aria-label={pickButtonLabel(target, pickTarget === target)}
          title={pickButtonLabel(target, pickTarget === target)}
          disabled={disabled}
          onClick={() => onRequestPick(target)}
        >
          {pickTarget === target ? 'Click chart…' : 'Chart'}
        </button>
        <button
          type="button"
          className={`routing-mini-button ${editing ? 'active' : ''}`}
          aria-label={target === 'start' ? 'Edit departure coordinates' : 'Edit destination coordinates'}
          title="Enter coordinates manually"
          aria-pressed={editing}
          disabled={disabled}
          onClick={onToggleEdit}
        >
          {editing ? 'Hide' : 'Edit'}
        </button>
      </div>
  );

  // Issue #52 : sans le préfixe « GPS · », le chip reste étroit quand la
  // position courante est utilisée — la case à cocher l'indique déjà.
  const startChip = routing.useCurrentPosition
    ? (routing.startPosition ? formatPosition(routing.startPosition) : 'Waiting for GPS…')
    : formatPosition(routing.startPosition);
  const finishChip = formatPosition(routing.finishPosition);

  const route = routeCalc?.route ?? null;

  return (
    <section id="map-routing-panel" className="map-tool-panel map-routing-panel" aria-label="Routing">
      <div className="map-settings-heading">
        <strong>ROUTING</strong>
        <button
          type="button"
          aria-label="Close routing panel"
          title="Close routing panel"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="control-section routing-section">
        <span className="routing-section-label">Route</span>

        {endpointRow('start', 'From', startChip, editingStart, () => setEditingStart(value => !value), routing.useCurrentPosition)}
        <label className="routing-gps-toggle">
          <input
            type="checkbox"
            checked={routing.useCurrentPosition}
            aria-label="Use current position"
            onChange={event => routing.setUseCurrentPosition(event.target.checked)}
          />
          <span>Use current GPS position</span>
        </label>
        {editingStart && !routing.useCurrentPosition && coordinateRow('Departure', routing.startText, routing.setStartText)}

        {endpointRow('finish', 'To', finishChip, editingFinish, () => setEditingFinish(value => !value), false)}
        {editingFinish && coordinateRow('Destination', routing.finishText, routing.setFinishText)}

        <div className="routing-status">
          {routing.errors.start && <p className="routing-error">{routing.errors.start}</p>}
          {routing.errors.finish && <p className="routing-error">{routing.errors.finish}</p>}
          {routing.errors.same && <p className="routing-error">{routing.errors.same}</p>}
          {routing.errors.polar && <p className="routing-error">{routing.errors.polar}</p>}
          {routing.plan && routing.distanceNm !== null && (
            <p className="routing-ok">
              Plan ready · {routing.distanceNm.toFixed(1)} NM{polarName ? ` · ${polarName}` : ''}
            </p>
          )}
        </div>
      </div>

      {gribCalc && (
        <div className="control-section routing-section routing-wind">
          <span className="routing-section-label">Wind</span>
          {(() => {
            const label = gribStatusLabel(gribCalc.status, gribCalc.isDownloading);
            return <p className={label.ok ? 'routing-ok' : 'routing-warn'}>{label.text}</p>;
          })()}
          {gribCalc.error && <p className="routing-error">{gribCalc.error}</p>}
        </div>
      )}

      {routeCalc && onComputeRoute && (
        <div className="routing-actions">
          <button
            type="button"
            className="routing-compute-button"
            disabled={!routing.plan}
            onClick={onComputeRoute}
          >
            {routeCalc.isLoading ? 'Computing…' : 'Compute route'}
          </button>
          {routeCalc.isLoading && (
            <button
              type="button"
              className="routing-cancel-button"
              aria-label="Cancel routing computation"
              title="Cancel routing computation"
              onClick={() => void routeCalc.cancel()}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {routeCalc?.isLoading && (
        <p className="routing-progress" aria-live="polite">
          {routeCalc.progress
            ? `${formatElapsed(routeCalc.progress.elapsed)} · ${routeCalc.progress.explored_nodes.toLocaleString('en-US')} nodes explored`
            : 'Queued…'}
        </p>
      )}

      {routeCalc?.error && <p className="routing-error routing-calc-error">{routeCalc.error}</p>}

      {route && (
        <div className={`routing-result ${route.found ? 'routing-result-found' : ''}`}>
          {route.found ? (
            <>
              <div className="routing-result-main">
                <span className="routing-result-eta">{formatEta(route.etaS)}</span>
                <span className="routing-result-eta-label">ETA</span>
                <span className="routing-result-dist">{routeDistanceNm(route.coords).toFixed(1)} NM</span>
              </div>
              <p className="routing-ok routing-result-sub">
                {route.windSource === 'grib'
                  ? 'GRIB wind'
                  : `constant ${route.wind.speedKts.toFixed(0)} kt from ${route.wind.directionFromDeg.toFixed(0)}°`}
              </p>
            </>
          ) : (
            route.message && <p className="routing-error">{route.message}</p>
          )}
          <button
            type="button"
            className="routing-clear-button"
            onClick={routeCalc?.clear}
          >
            Clear route
          </button>
        </div>
      )}
    </section>
  );
};

export default RoutingPanel;
