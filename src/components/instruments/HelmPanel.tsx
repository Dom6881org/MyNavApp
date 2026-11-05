import React, { useMemo, useState } from 'react';
import type { NavigationData } from '../../types';
import { normalizeDeg, vmgToWind } from '../../utils/instrumentPrimitives';
import CompassDial from './CompassDial';
import WindDial from './WindDial';
import InstrumentCard from './InstrumentCard';

/** Panneau HELM (refonte instruments, Phase 1 — #158) : instrument central
 * commutable VENT / COMPAS / VITESSE en grand, VMG toujours visible
 * (SOG × cos(TWA) au vent). Les cartes réutilisent InstrumentCard (#157) :
 * bascule cadran ⇄ numérique par instrument.
 *
 * #176 : le central VENT est le grand cadran Raymarine (WindDial — arcs
 * bâbord/tribord, aiguille à la provenance, TWS + TWD en digital).
 *
 * #182 (retour terrain n°12 de Dom) : instrument central sur 2/3, colonne
 * droite sur 1/3 en VUE DIGITALE — elle montre les instruments NON centraux
 * (les deux de vent/vitesse/cap non affichés au centre + profondeur).
 * Le choix de l'instrument central se fait EN CLIQUANT sur une tuile à
 * droite (permutation : la tuile cliquée passe au centre, l'ancien central
 * reprend sa place en digital) — plus de menu d'onglets sous le central.
 * La profondeur reste toujours à droite, jamais centrale. */

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
  const depth = data.depth?.depth ?? null;

  const centralTitle = central === 'compass' ? 'COMPASS' : central === 'speed' ? 'SOG' : 'WIND';

  const centralContent =
    central === 'compass' ? (
      <CompassDial cog={cog} heading={hdg} size={300} />
    ) : central === 'speed' ? (
      <div className="helm-central-value">
        <span className="helm-big-value">{sog === null ? '--' : sog.toFixed(1)}</span>
        <span className="helm-unit">
          kn SOG · STW {stw === null ? '--' : stw.toFixed(1)}
        </span>
      </div>
    ) : (
      <div className="helm-central-value">
        {/* #180 retour n°9 : le cadran vent OCCUPE L'ESPACE DISPONIBLE —
            plus de taille fixe, il grandit avec la carte centrale. */}
        <div className="helm-wind-stage">
          <WindDial twdDeg={twd} twsKts={tws} fill />
        </div>
        {twa !== null && (
          <span className="helm-unit" data-testid="helm-wind-line">
            {`TWA ${Math.round(twa)}°${awa === null ? '' : ` · AWA ${Math.round(Math.abs(awa))}°`}`}
          </span>
        )}
      </div>
    );

  // #182 : tuiles digitales de la colonne droite — les instruments NON
  // centraux. Ordre demandé par Dom : l'autre instrument (vent/vitesse)
  // d'abord, puis CAP, puis PROFONDEUR en dernier.
  const others = (['wind', 'compass', 'speed'] as CentralInstrument[]).filter(
    (type) => type !== central
  );
  // CAP en 2e position quand il est à droite (ordre des exemples de Dom) ;
  // si le cap EST central, il n'apparaît pas dans la colonne.
  const nonCompass = others.filter((type) => type !== 'compass');
  const tileOrder: CentralInstrument[] = others.includes('compass')
    ? [...nonCompass, 'compass']
    : nonCompass;

  // Contenu digital d'une tuile par type d'instrument (jumelages conservés).
  const tileData = (type: CentralInstrument) => {
    if (type === 'wind') {
      return {
        label: 'TWS',
        value: tws === null ? '--' : tws.toFixed(0),
        sub: twa === null ? 'no wind' : `kt · TWA ${Math.round(twa)}°`,
        testid: 'helm-compact-wind',
        name: 'VENT'
      };
    }
    if (type === 'speed') {
      return {
        label: 'SOG',
        value: sog === null ? '--' : sog.toFixed(1),
        sub: stw === null ? 'kn · STW --' : `kn · STW ${stw.toFixed(1)}`,
        testid: 'helm-compact-sog',
        name: 'VITESSE'
      };
    }
    return {
      label: 'COG',
      value: cog === null ? '--' : `${Math.round(normalizeDeg(cog))}°`,
      sub: hdg === null ? 'HDG --' : `HDG ${Math.round(normalizeDeg(hdg))}°`,
      testid: 'helm-compact-compass',
      name: 'CAP'
    };
  };

  return (
    <div className="helm-panel" role="group" aria-label="Helm instruments">
      {/* Instrument central : 2/3 de la largeur (#182) */}
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
      </div>

      {/* Colonne droite : 1/3, VUE DIGITALE, instruments non centraux.
          Cliquer une tuile la fait passer au centre (permutation #182) —
          la profondeur n'est pas cliquable (jamais centrale). */}
      <div className="helm-compact" role="group" aria-label="Instruments numériques">
        {tileOrder.map((type) => {
          const tile = tileData(type);
          return (
            <button
              key={type}
              type="button"
              className="helm-tile"
              data-testid={tile.testid}
              aria-label={`Afficher ${tile.name} au centre`}
              onClick={() => setCentral(type)}
            >
              <span className="helm-tile-lbl">{tile.label}</span>
              <strong className="helm-tile-val">{tile.value}</strong>
              <small className={type === 'compass' ? 'helm-tile-sub helm-hdg' : 'helm-tile-sub'}>
                {tile.sub}
              </small>
            </button>
          );
        })}
        <div className="helm-tile" data-testid="helm-compact-depth">
          <span className="helm-tile-lbl">DEPTH</span>
          <strong className="helm-tile-val">{depth === null ? '--' : depth.toFixed(1)}</strong>
          <small className="helm-tile-sub">m</small>
        </div>
      </div>
    </div>
  );
};

export default HelmPanel;
