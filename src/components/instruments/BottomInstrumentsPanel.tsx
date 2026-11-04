import React from 'react';
import type { NavigationData } from '../../types';
import InstrumentCard from './InstrumentCard';
import WindDial from './WindDial';

/** Rangée basse façon InstrumentCard (refonte instruments, finalisation —
 * #166) : remplace les WindIndicator/DepthSounder legacy par les cartes
 * de la refonte — WIND avec WindDial (bascule 123/◉ conservée), DEPTH en
 * numérique (pas de cadran possible → sans bascule), alarme profondeur
 * mise en avant comme dans COASTAL. */

interface BottomInstrumentsPanelProps {
  data: NavigationData;
}

const BottomInstrumentsPanel: React.FC<BottomInstrumentsPanelProps> = ({ data }) => {
  const depth = data.depth?.depth ?? null;
  const depthAlarm = data.depth?.alarm ?? false;
  const alarmDepth = data.depth?.alarmDepth ?? null;
  const twd = data.wind?.direction ?? null;
  const tws = data.wind?.speed ?? null;
  const awa = data.apparentWind?.angleDegrees ?? null;

  return (
    <div
      className={depthAlarm ? 'bottom-instruments alarm' : 'bottom-instruments'}
      role="group"
      aria-label="Bottom instruments"
    >
      <InstrumentCard
        title="WIND"
        info={awa === null ? null : <span>AWA {Math.round(Math.abs(awa))}°</span>}
      >
        <WindDial twdDeg={twd} twsKts={tws} />
      </InstrumentCard>
      <InstrumentCard
        title="DEPTH"
        hideToggle
        info={
          depthAlarm ? (
            <span className="instrument-wrapper-alarm" role="status">ALARM</span>
          ) : null
        }
      >
        <div className="helm-central-value" data-testid="bottom-depth">
          <span className="helm-big-value">{depth === null ? '--' : depth.toFixed(1)}</span>
          <span className="helm-unit">
            {depthAlarm
              ? `m · alarm at ${alarmDepth === null ? '--' : alarmDepth.toFixed(1)}`
              : 'm'}
          </span>
        </div>
      </InstrumentCard>
    </div>
  );
};

export default BottomInstrumentsPanel;
