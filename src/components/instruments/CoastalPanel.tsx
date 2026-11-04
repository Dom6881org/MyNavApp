import React from 'react';
import type { NavigationData } from '../../types';
import InstrumentCard from './InstrumentCard';
import WindDial from './WindDial';

/** Panneau COASTAL (refonte instruments, Phase 2 — #160) : vent resserré
 * (WindDial 170 px, design revue 2) + tuiles numériques 2×2 aérées
 * (DEPTH / SOG / COG / HDG). L'alarme profondeur surligne la tuile DEPTH. */

interface CoastalPanelProps {
  data: NavigationData;
}

const CoastalPanel: React.FC<CoastalPanelProps> = ({ data }) => {
  const depth = data.depth?.depth ?? null;
  const depthAlarm = data.depth?.alarm ?? false;
  const sog = data.speed?.sog ?? null;
  const cog = data.compass?.cog ?? null;
  const hdg = data.compass?.heading ?? null;
  // TWD : direction du vent du point (GRIB/Open-Météo) si disponible
  const twd = data.wind?.direction ?? null;
  const tws = data.wind?.speed ?? null;
  const awa = data.apparentWind?.angleDegrees ?? null;

  return (
    <div className="coastal-panel" role="group" aria-label="Coastal instruments">
      <InstrumentCard
        title="WIND"
        info={awa === null ? null : <span>AWA {Math.round(Math.abs(awa))}°</span>}
      >
        <WindDial twdDeg={twd} twsKts={tws} />
      </InstrumentCard>
      <div className="coastal-tiles" data-testid="coastal-tiles">
        <div
          className={depthAlarm ? 'coastal-tile alarm' : 'coastal-tile'}
          data-testid="coastal-tile-depth"
        >
          <span>DEPTH</span>
          <strong>{depth === null ? '--' : depth.toFixed(1)}</strong>
          <small>m</small>
        </div>
        <div className="coastal-tile" data-testid="coastal-tile-sog">
          <span>SOG</span>
          <strong>{sog === null ? '--' : sog.toFixed(1)}</strong>
          <small>kn</small>
        </div>
        <div className="coastal-tile" data-testid="coastal-tile-cog">
          <span>COG</span>
          <strong>{cog === null ? '--' : `${Math.round(cog)}°`}</strong>
          <small>&nbsp;</small>
        </div>
        <div className="coastal-tile" data-testid="coastal-tile-hdg">
          <span>HDG</span>
          <strong>{hdg === null ? '--' : `${Math.round(hdg)}°`}</strong>
          <small className="helm-hdg">compas</small>
        </div>
      </div>
    </div>
  );
};

export default CoastalPanel;
