import React, { useMemo, useState } from 'react';
import type { NavigationData } from '../../types';
import { vmgToWind } from '../../utils/instrumentPrimitives';
import CompassDial from './CompassDial';
import WindDial from './WindDial';
import InstrumentCard from './InstrumentCard';

/** Panneau HELM (refonte instruments, Phase 1 — #158) : instrument central
 * commutable VENT / COMPAS / VITESSE en grand, VMG toujours visible
 * (SOG × cos(TWA) au vent). Les cartes réutilisent InstrumentCard (#157) :
 * bascule cadran ⇄ numérique par instrument.
 *
 * #176 : le central VENT est le grand cadran Raymarine (WindDial — arcs
 * bâbord/tribord, aiguille à la provenance, TWS + TWD en digital) avec la
 * ligne TWA/AWA, fidèle à la maquette.
 *
 * Reprise HELM design-centered : compacts FIXES à droite, comme la
 * maquette — SOG (jumelé STW), TWS (jumelé TWA), DEPTH — indépendants
 * de l'instrument central affiché. */

type CentralInstrument = 'wind' | 'compass' | 'speed';

interface HelmPanelProps {
  data: NavigationData;
}

const HelmPanel: React.FC<HelmPanelProps> = ({ data }) => {
  const [central, setCentral] = useState<CentralInstrument>('compass');

  const cog = data.compass?.cog ?? null;
  const hdg = data.compass?.heading ?? null;
  const sog = data.speed?.sog ?? null;
  const tws = data.trueWind?.speedKnots ?? null;
  const twa = data.trueWind?.angleDegrees ?? null;
  // Jumelage design revue 2 : SOG+STW ensemble partout — STW reste `--`
  // tant que la phrase VHW (loch) n'est pas reçue (chantier serveur séparé).
  const stw = data.speed?.stw ?? null;
  const vmg = useMemo(() => vmgToWind(sog, twa), [sog, twa]);
  // #176 : sources du cadran vent (mêmes que COASTAL — vent du point)
  const twd = data.wind?.direction ?? null;
  const awa = data.apparentWind?.angleDegrees ?? null;
  // Compacts fixes (reprise HELM) : DEPTH rejoint SOG et TWS à droite.
  const depth = data.depth?.depth ?? null;

  const centralTitle = central === 'compass' ? 'COMPASS' : central === 'speed' ? 'SOG' : 'WIND';

  const centralContent =
    central === 'compass' ? (
      <CompassDial cog={cog} heading={hdg} />
    ) : central === 'speed' ? (
      <div className="helm-central-value">
        <span className="helm-big-value">{sog === null ? '--' : sog.toFixed(1)}</span>
        <span className="helm-unit">
          kn SOG · STW {stw === null ? '--' : stw.toFixed(1)}
        </span>
      </div>
    ) : (
      <div className="helm-central-value">
        {/* #176 : grand cadran Raymarine au central VENT, comme la maquette */}
        <WindDial twdDeg={twd} twsKts={tws} size={280} />
        <span className="helm-unit" data-testid="helm-wind-line">
          {twa === null
            ? 'no wind data'
            : `TWA ${Math.round(twa)}°${awa === null ? '' : ` · AWA ${Math.round(Math.abs(awa))}°`}`}
        </span>
      </div>
    );

  return (
    <div className="helm-panel" role="group" aria-label="Helm instruments">
      <div className="helm-central">
        <InstrumentCard
          title={centralTitle}
          info={
            <span className="helm-vmg" data-testid="helm-vmg">
              VMG {vmg === null ? '--' : `${vmg.toFixed(1)} kt`}
            </span>
          }
        >
          {centralContent}
        </InstrumentCard>
        <div className="helm-central-switch" role="tablist" aria-label="Helm central instrument">
          {(['wind', 'compass', 'speed'] as CentralInstrument[]).map((type) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={central === type}
              className={central === type ? 'helm-switch-btn active' : 'helm-switch-btn'}
              onClick={() => setCentral(type)}
            >
              {type === 'wind' ? 'VENT' : type === 'compass' ? 'COMPAS' : 'VITESSE'}
            </button>
          ))}
        </div>
      </div>

      {/* Compacts fixes façon maquette : SOG+STW, TWS+TWA, DEPTH —
          la colonne ne change jamais avec l'instrument central. */}
      <div className="helm-compact">
        <div className="helm-compact-row" data-testid="helm-compact-sog">
          <span>SOG</span>
          <strong>{sog === null ? '--' : sog.toFixed(1)}</strong>
          <small>{stw === null ? 'kn · STW --' : `kn · STW ${stw.toFixed(1)}`}</small>
        </div>
        <div className="helm-compact-row" data-testid="helm-compact-wind">
          <span>TWS</span>
          <strong>{tws === null ? '--' : tws.toFixed(0)}</strong>
          <small>{twa === null ? 'no wind' : `kt · TWA ${Math.round(twa)}°`}</small>
        </div>
        <div className="helm-compact-row" data-testid="helm-compact-depth">
          <span>DEPTH</span>
          <strong>{depth === null ? '--' : depth.toFixed(1)}</strong>
          <small>m</small>
        </div>
      </div>
    </div>
  );
};

export default HelmPanel;
