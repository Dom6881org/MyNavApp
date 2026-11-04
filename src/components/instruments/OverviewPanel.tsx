import React from 'react';
import type { NavigationData } from '../../types';
import { formatCoordinate } from '../../utils/formatCoordinate';

/** Panneau OVERVIEW (refonte instruments, Phase 2 — #160 ; tuiles #170) :
 * synthèse du bord en TUILES (cadres + grandes valeurs) et non plus en
 * lignes de texte. Rendu au-dessus de la carte en mode OVERVIEW
 * (bandeau App) ; testids et expressions de valeurs inchangés. */

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
      <div className="overview-tile" data-testid="overview-course">
        <span className="overview-tile-label">SOG · COG</span>
        <strong className="overview-tile-value">
          {sog === null && cog === null
            ? '--'
            : `${sog === null ? '--' : `${sog.toFixed(1)} kn`} · ${cog === null ? '--' : `${Math.round(cog)}°`}`}
        </strong>
      </div>
      <div className="overview-tile" data-testid="overview-wind">
        <span className="overview-tile-label">WIND</span>
        <strong className="overview-tile-value">
          {wind === null
            ? '--'
            : `${wind.speed.toFixed(0)} kt · ${Math.round(wind.direction)}° (${wind.source})`}
        </strong>
      </div>
      <div className="overview-tile" data-testid="overview-depth">
        <span className="overview-tile-label">DEPTH</span>
        <strong className="overview-tile-value">
          {depth === null ? '--' : `${depth.toFixed(1)} m`}
        </strong>
      </div>
      <div className="overview-tile" data-testid="overview-time">
        <span className="overview-tile-label">TIME</span>
        <strong className="overview-tile-value">{localTime ?? '--'}</strong>
      </div>
      <div className="overview-tile overview-tile-position" data-testid="overview-position">
        <span className="overview-tile-label">POSITION</span>
        <strong className="overview-tile-value overview-tile-coords">
          {position === null
            ? '--'
            : `${formatCoordinate(position.latitude, true)} · ${formatCoordinate(position.longitude, false)}`}
        </strong>
      </div>
    </div>
  );
};

export default OverviewPanel;
