import React, { useMemo, useState } from 'react';
import type { NavigationData } from '../../types';
import { vmgToWind } from '../../utils/instrumentPrimitives';
import CompassDial from './CompassDial';
import InstrumentCard from './InstrumentCard';

/** Panneau HELM (refonte instruments, Phase 1 — #158) : instrument central
 * commutable VENT / COMPAS / VITESSE en grand, les deux autres en compact,
 * VMG toujours visible (SOG × cos(TWA) au vent). Les cartes réutilisent
 * InstrumentCard (#157) : bascule cadran ⇄ numérique par instrument. */

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
        <span className="helm-big-value">{tws === null ? '--' : tws.toFixed(0)}</span>
        <span className="helm-unit">
          {twa === null ? 'no wind data' : `kt · TWA ${Math.round(twa)}°`}
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

      <div className="helm-compact">
        {central !== 'compass' && (
          <div className="helm-compact-row" data-testid="helm-compact-cog">
            <span>COG</span>
            <strong>{cog === null ? '--' : `${Math.round(cog)}°`}</strong>
            <small className="helm-hdg">{hdg === null ? 'HDG --' : `HDG ${Math.round(hdg)}°`}</small>
          </div>
        )}
        {central !== 'speed' && (
          <div className="helm-compact-row" data-testid="helm-compact-sog">
            <span>SOG</span>
            <strong>{sog === null ? '--' : sog.toFixed(1)}</strong>
            <small>{stw === null ? 'kn · STW --' : `kn · STW ${stw.toFixed(1)}`}</small>
          </div>
        )}
        {central !== 'wind' && (
          <div className="helm-compact-row" data-testid="helm-compact-wind">
            <span>TWS</span>
            <strong>{tws === null ? '--' : tws.toFixed(0)}</strong>
            <small>{twa === null ? 'no wind' : `kt · TWA ${Math.round(twa)}°`}</small>
          </div>
        )}
      </div>
    </div>
  );
};

export default HelmPanel;
