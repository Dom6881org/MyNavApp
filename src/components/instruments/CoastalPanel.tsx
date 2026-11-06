import React, { useState } from 'react';
import type { NavigationData } from '../../types';
import InstrumentCard from './InstrumentCard';
import WindDial from './WindDial';
import WindNeedleSwitch from './WindNeedleSwitch';
import WindNumericGrid from './WindNumericGrid';
import {
  readWindNeedleMode,
  writeWindNeedleMode,
  type WindNeedleMode
} from '../../utils/instrumentMode';
import CoastalDepthCard from './CoastalDepthCard';
import CoastalMap from './CoastalMap';
import { useAnchor } from '../../hooks/useAnchor';

/** Panneau COASTAL — reset complet (#186, maquettes c1–c4 validées).
 *
 * Pensé pour L'ARRIVÉE AU MOUILLAGE : trois colonnes égales (1/3
 * chacune), VENT / PROFONDEUR / CARTE, le panneau prend tout l'écran
 * (bandeau haut classique conservé au-dessus, hors de ce panneau).
 *
 * - VENT : mêmes présentation et options que HELM — switch segmenté
 *   CADRAN / NUMÉRIQUE dans le header (pattern #184 headerPrefix).
 * - PROFONDEUR : colonne verticale 0 m EN BAS, zones rouge 0–2 /
 *   orange 2–3 / vert, échelle adaptative ×2, marqueur + alerte ≤ 2 m
 *   (voir CoastalDepthCard).
 * - CARTE : fond + bateau + ⚓, épuré au max (voir CoastalMap) + bouton
 *   « MOUILLAGE FAIT » (localStorage, un nouveau mouillage remplace).
 *
 * MotionPanel et BottomInstrumentsPanel disparaissent de la vue
 * (reset complet — App.tsx). */

type WindDisplay = 'dial' | 'numeric';

interface CoastalPanelProps {
  data: NavigationData;
}

const CoastalPanel: React.FC<CoastalPanelProps> = ({ data }) => {
  const [windMode, setWindMode] = useState<WindDisplay>('dial');
  // #188 : bord de l'aiguille (apparent par défaut) — même mode
  // partagé que HELM et la rangée basse (mynav:wind-needle).
  const [needleMode, setNeedleMode] = useState<WindNeedleMode>(readWindNeedleMode);
  const { anchor, saveAnchor, clearAnchor } = useAnchor();

  // Sources du vent identiques à HELM (#176) : vent du point pour TWD,
  // vent vrai interpolé pour TWS/TWA, apparent pour AWS/AWA.
  const twd = data.wind?.direction ?? null;
  const tws = data.trueWind?.speedKnots ?? null;
  const twa = data.trueWind?.angleDegrees ?? null;
  const aws = data.apparentWind?.speedKnots ?? null;
  const awa = data.apparentWind?.angleDegrees ?? null;

  const depth = data.depth?.depth ?? null;
  const waterTemp = data.depth?.temperature ?? null;
  const sensorAlarm = data.depth?.alarm ?? false;
  const alarmDepth = data.depth?.alarmDepth ?? null;

  const position = data.position ?? null;
  const heading = data.compass?.heading ?? data.compass?.cog ?? null;

  const fmt = (value: number | null, digits: number, unit: string) =>
    value === null ? '--' : `${value.toFixed(digits)} ${unit}`;

  const windSwitch = (
    <div
      className="helm-mode-switch"
      role="group"
      aria-label="Format d'affichage du vent"
      data-testid="coastal-wind-switch"
    >
      {(['dial', 'numeric'] as WindDisplay[]).map((mode) => (
        <button
          key={mode}
          type="button"
          className={`helm-switch-btn${mode === windMode ? ' active' : ''}`}
          aria-pressed={mode === windMode}
          onClick={() => setWindMode(mode)}
        >
          {mode === 'dial' ? 'CADRAN' : 'NUMÉRIQUE'}
        </button>
      ))}
    </div>
  );

  const windReadouts = () => {
    // #188 v5 : colorées par bord — ambre = vrai (TWS/TWA),
    // bleu = apparent (AWS/AWA).
    const items = (
      [
        ['TWS', fmt(tws, 0, 'kt'), 'true'],
        ['AWS', fmt(aws, 0, 'kt'), 'apparent'],
        ['TWA', twa === null ? '--' : `${Math.round(Math.abs(twa))}°`, 'true'],
        ['AWA', awa === null ? '--' : `${Math.round(Math.abs(awa))}°`, 'apparent']
      ] as const
    );
    return (
      <div className="helm-wind-readouts" data-testid="coastal-wind-readouts">
        {items.map(([label, value, side]) => (
          <span className="helm-readout" key={label}>
            <span className="helm-readout-lbl">{label}</span>
            <strong className={`wind-${side}`}>{value}</strong>
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="coastal-panel" role="group" aria-label="Coastal instruments">
      <div className="coastal-grid">
        {/* Colonne 1/3 — VENT : même présentation et options que HELM.
            #188 v5 : le switch APPARENT|VRAI vit SOUS la rosace (plus
            dans le header) — le header ne garde que CADRAN|NUMÉRIQUE. */}
        <InstrumentCard title="VENT" hideToggle headerPrefix={windSwitch}>
          {windMode === 'numeric' ? (
            /* #188 v5 (retours n°2/n°3) : grille 2×2 de valeurs ÉGALES
               colorées par bord — PAS de switch en numérique. */
            <div className="helm-central-value">
              <WindNumericGrid
                tws={tws}
                twa={twa}
                aws={aws}
                awa={awa}
                testId="coastal-wind-numeric"
              />
            </div>
          ) : (
            <div className="helm-central-value">
              <div className="coastal-wind-stage">
                <WindDial
                  twdDeg={twd}
                  twsKts={tws}
                  awaDeg={awa}
                  twaDeg={twa}
                  mode={needleMode}
                  fill
                />
              </div>
              {/* #188 v5 (retour n°1) : switch SOUS la rosace, centré. */}
              <WindNeedleSwitch
                mode={needleMode}
                onChange={(m) => {
                  setNeedleMode(m);
                  writeWindNeedleMode(m);
                }}
                testId="coastal-wind-needle-switch"
              />
              {windReadouts()}
            </div>
          )}
        </InstrumentCard>

        {/* Colonne 1/3 — PROFONDEUR : colonne verticale, 0 m en bas. */}
        <CoastalDepthCard
          depth={depth}
          temperature={waterTemp}
          alarmDepth={alarmDepth}
          sensorAlarm={sensorAlarm}
        />

        {/* Colonne 1/3 — CARTE : fond + bateau + ⚓, mouillage fait. */}
        <CoastalMap
          position={position}
          heading={heading}
          anchor={anchor}
          onDropAnchor={saveAnchor}
          onClearAnchor={clearAnchor}
        />
      </div>
    </div>
  );
};

export default CoastalPanel;
