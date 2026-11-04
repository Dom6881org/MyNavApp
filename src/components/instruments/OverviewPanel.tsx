import React from 'react';
import type { NavigationData } from '../../types';
import { formatCoordinate } from '../../utils/formatCoordinate';

/** Panneau OVERVIEW (refonte instruments, Phase 2 — #160) : vue d'ensemble
 * validée au design revue 2 — position, cap/vitesse, vent, profondeur,
 * heure GPS. Lecture, pas de cadran : c'est la synthèse du bord. */

interface OverviewPanelProps {
  data: NavigationData;
}

const OverviewPanel: React.FC<OverviewPanelProps> = ({ data }) => {
  const position = data.position;
  const sog = data.speed?.sog ?? null;
  const cog = data.compass?.cog ?? null;
  const wind = data.wind;
  const depth = data.depth?.depth ?? null;
  const localTime = data.gpsTime?.localTime ?? null;

  return (
    <div className="overview-panel" role="group" aria-label="Overview">
      <div className="overview-row" data-testid="overview-position">
        <span>POSITION</span>
        <strong>
          {position === null
            ? '--'
            : `${formatCoordinate(position.latitude, true)} · ${formatCoordinate(position.longitude, false)}`}
        </strong>
      </div>
      <div className="overview-row" data-testid="overview-course">
        <span>SOG · COG</span>
        <strong>
          {sog === null ? '--' : `${sog.toFixed(1)} kn`} · {cog === null ? '--' : `${Math.round(cog)}°`}
        </strong>
      </div>
      <div className="overview-row" data-testid="overview-wind">
        <span>WIND</span>
        <strong>
          {wind === null
            ? '--'
            : `${wind.speed.toFixed(0)} kt · ${Math.round(wind.direction)}° (${wind.source})`}
        </strong>
      </div>
      <div className="overview-row" data-testid="overview-depth">
        <span>DEPTH</span>
        <strong>{depth === null ? '--' : `${depth.toFixed(1)} m`}</strong>
      </div>
      <div className="overview-row" data-testid="overview-time">
        <span>TIME</span>
        <strong>{localTime ?? '--'}</strong>
      </div>
    </div>
  );
};

export default OverviewPanel;
