import React from 'react';
import { RoutingInput } from '../hooks/useRoutingInput';
import { RoutingRouteApi } from '../hooks/useRoutingRoute';
import { GribApi } from '../hooks/useGrib';

export type RoutingPickTarget = 'start' | 'finish';

interface RoutingPanelProps {
  routing: RoutingInput;
  pickTarget: RoutingPickTarget | null;
  onRequestPick: (target: RoutingPickTarget) => void;
  onClose: () => void;
  routeCalc?: RoutingRouteApi;
  onComputeRoute?: () => void;
  gribCalc?: GribApi;
  onDownloadGrib?: () => void;
}

const formatEta = (etaS: number): string => {
  const hours = etaS / 3600;
  return `${hours >= 10 ? hours.toFixed(0) : hours.toFixed(1)} h`;
};

const formatClock = (epochS: number): string =>
  new Date(epochS * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const gribStatusLabel = (status: GribApi['status']): { text: string; ok: boolean } => {
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
 * Panneau de saisie du plan de routage (issue #15) :
 * départ (position courante, manuelle ou clic carte), arrivée (coordonnées
 * ou clic carte), polaire du bateau, avec validation en direct.
 * Overlay "map tool" ancré à la colonne d'outils, comme le panneau réglages.
 */
const RoutingPanel: React.FC<RoutingPanelProps> = ({
  routing,
  pickTarget,
  onRequestPick,
  onClose,
  routeCalc,
  onComputeRoute,
  gribCalc,
  onDownloadGrib
}) => {
  const coordinateRow = (
    label: string,
    values: { latitude: string; longitude: string },
    onChange: (next: { latitude: string; longitude: string }) => void,
    disabled: boolean
  ) => (
    <div className="routing-coord-row">
      <input
        type="text"
        inputMode="decimal"
        className="routing-input"
        disabled={disabled}
        value={values.latitude}
        placeholder="lat"
        aria-label={`${label} latitude`}
        onChange={event => onChange({ ...values, latitude: event.target.value })}
      />
      <input
        type="text"
        inputMode="decimal"
        className="routing-input"
        disabled={disabled}
        value={values.longitude}
        placeholder="lon"
        aria-label={`${label} longitude`}
        onChange={event => onChange({ ...values, longitude: event.target.value })}
      />
    </div>
  );

  const polarName = routing.polars.find(polar => polar.id === routing.polarId)?.name ?? routing.polarId ?? '';

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
        <h3>Departure</h3>
        <label className="routing-toggle">
          <input
            type="checkbox"
            checked={routing.useCurrentPosition}
            onChange={event => routing.setUseCurrentPosition(event.target.checked)}
          />
          <span>Use current position</span>
        </label>
        {coordinateRow('Departure', routing.startText, routing.setStartText, routing.useCurrentPosition)}
        <button
          type="button"
          className={`routing-pick-button ${pickTarget === 'start' ? 'active' : ''}`}
          disabled={routing.useCurrentPosition}
          onClick={() => onRequestPick('start')}
        >
          {pickButtonLabel('start', pickTarget === 'start')}
        </button>
      </div>

      <div className="control-section routing-section">
        <h3>Destination</h3>
        {coordinateRow('Destination', routing.finishText, routing.setFinishText, false)}
        <button
          type="button"
          className={`routing-pick-button ${pickTarget === 'finish' ? 'active' : ''}`}
          onClick={() => onRequestPick('finish')}
        >
          {pickButtonLabel('finish', pickTarget === 'finish')}
        </button>
      </div>

      <div className="control-section routing-section">
        <h3>Polar</h3>
        <select
          className="routing-input routing-select"
          value={routing.polarId ?? ''}
          onChange={event => routing.setPolarId(event.target.value || null)}
        >
          {routing.polars.map(polar => (
            <option key={polar.id} value={polar.id}>{polar.name}</option>
          ))}
        </select>
      </div>

      {gribCalc && onDownloadGrib && (
        <div className="control-section routing-section">
          <h3>Wind</h3>
          {(() => {
            const label = gribStatusLabel(gribCalc.status);
            return <p className={label.ok ? 'routing-ok' : 'routing-error'}>{label.text}</p>;
          })()}
          <button
            type="button"
            className="routing-pick-button"
            disabled={!routing.plan || gribCalc.isDownloading}
            onClick={onDownloadGrib}
          >
            {gribCalc.isDownloading ? 'Downloading…' : 'Download GRIB (zone + 72 h)'}
          </button>
          {gribCalc.error && <p className="routing-error">{gribCalc.error}</p>}
        </div>
      )}

      {routeCalc && onComputeRoute && (
        <div className="control-section routing-section">
          <h3>Route</h3>
          <button
            type="button"
            className="routing-pick-button"
            disabled={!routing.plan || routeCalc.isLoading}
            onClick={onComputeRoute}
          >
            {routeCalc.isLoading ? 'Computing…' : 'Compute route'}
          </button>
          {routeCalc.error && <p className="routing-error">{routeCalc.error}</p>}
          {routeCalc.route?.found && (
            <p className="routing-ok">
              Route · ETA {formatEta(routeCalc.route.etaS)} · {routeCalc.route.windSource === 'grib' ? 'GRIB wind' : `constant ${routeCalc.route.wind.speedKts.toFixed(0)} kt`}
            </p>
          )}
          {routeCalc.route && !routeCalc.route.found && routeCalc.route.message && (
            <p className="routing-error">{routeCalc.route.message}</p>
          )}
          {routeCalc.route && (
            <button
              type="button"
              className="routing-clear-button"
              onClick={routeCalc.clear}
            >
              Clear route
            </button>
          )}
        </div>
      )}

      <div className="routing-status">
        {routing.polarError && <p className="routing-error">{routing.polarError}</p>}
        {routing.errors.start && <p className="routing-error">{routing.errors.start}</p>}
        {routing.errors.finish && <p className="routing-error">{routing.errors.finish}</p>}
        {routing.errors.same && <p className="routing-error">{routing.errors.same}</p>}
        {routing.errors.polar && <p className="routing-error">{routing.errors.polar}</p>}
        {routing.plan && routing.distanceNm !== null && (
          <p className="routing-ok">Plan ready · {routing.distanceNm.toFixed(1)} NM · {polarName}</p>
        )}
      </div>
    </section>
  );
};

export default RoutingPanel;
