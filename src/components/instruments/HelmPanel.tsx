import React, { useMemo, useState } from 'react';
import type { NavigationData } from '../../types';
import { normalizeDeg, vmgToWind } from '../../utils/instrumentPrimitives';
import { formatCoordinate } from '../../utils/formatCoordinate';
import CompassDial from './CompassDial';
import WindDial from './WindDial';
import InstrumentCard from './InstrumentCard';

/** Panneau HELM (refonte instruments, Phase 1 — #158) : instrument central
 * commutable en grand, VMG toujours visible (SOG × cos(TWA) au vent).
 * Les cartes réutilisent InstrumentCard (#157) : bascule cadran ⇄ numérique.
 *
 * #182 (retour n°12) : central sur 2/3, colonne droite sur 1/3 en VUE
 * DIGITALE — tuiles des instruments NON centraux, PERMUTATION par clic
 * (la tuile passe au centre, l'ancien central reprend sa place à droite).
 *
 * #182 (retour n°13 de Dom) : la colonne droite s'élargit à SIX
 * instruments (vent, cap, vitesse, PROFONDEUR, HEURE, POSITION — la bande
 * d'état est retirée de HELM, ces deux tuiles la remplacent) et TOUTES
 * les tuiles sont cliquables. Les tuiles OCCUPENT TOUT l'espace de la
 * colonne, verticalement et horizontalement. Affichages centraux :
 * vitesse = SOG + STW (0.0 affiché tel quel si donnée réelle, '--' sinon) ;
 * cap = COG + HDG ; vent = cadran + TWS/AWS/TWA/AWA en digital ;
 * profondeur/heure/position = gros affichages numériques. */

type CentralInstrument = 'wind' | 'compass' | 'speed' | 'depth' | 'time' | 'position';

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
  // Jumelage design revue 2 : SOG+STW ensemble partout. 0.0 = donnée
  // réelle, affichée telle quelle ; '--' seulement sans donnée (VHW absent).
  const stw = data.speed?.stw ?? null;
  const vmg = useMemo(() => vmgToWind(sog, twa), [sog, twa]);
  // #176 : sources du cadran vent (mêmes que COASTAL — vent du point)
  const twd = data.wind?.direction ?? null;
  const aws = data.apparentWind?.speedKnots ?? null;
  const awa = data.apparentWind?.angleDegrees ?? null;
  const depth = data.depth?.depth ?? null;
  // #182 retour n°13 : heure + position remplacent la bande d'état en HELM
  const localTime = data.gpsTime?.localTime ?? null;
  const localDate = data.gpsTime?.date ?? null;
  const position = data.position;

  const fmt = (value: number | null, digits: number, unit: string) =>
    value === null ? '--' : `${value.toFixed(digits)} ${unit}`;

  const centralTitle =
    central === 'compass'
      ? 'COMPASS'
      : central === 'speed'
        ? 'SOG'
        : central === 'depth'
          ? 'DEPTH'
          : central === 'time'
            ? 'TIME'
            : central === 'position'
              ? 'POSITION'
              : 'WIND';

  const centralContent =
    central === 'compass' ? (
      /* #182 retour n°14 : même traitement que le vent — cadran pur en
         haut (occupe l'espace disponible), valeurs digitales dessous. */
      <div className="helm-central-value">
        <div className="helm-compass-stage">
          <CompassDial cog={cog} heading={hdg} fill />
        </div>
        <div className="helm-compass-readouts" data-testid="helm-compass-readouts">
          <span className="helm-readout">
            <span className="helm-readout-lbl">COG</span>
            <strong>{cog === null ? '--' : `${Math.round(normalizeDeg(cog))}°`}</strong>
          </span>
          <span className="helm-readout helm-readout-hdg">
            <span className="helm-readout-lbl">HDG</span>
            <strong>{hdg === null ? '--' : `${Math.round(normalizeDeg(hdg))}°`}</strong>
          </span>
        </div>
      </div>
    ) : central === 'speed' ? (
      <div className="helm-central-value">
        <span className="helm-big-value">{sog === null ? '--' : sog.toFixed(1)}</span>
        <span className="helm-unit">
          kn SOG · STW {stw === null ? '--' : stw.toFixed(1)}
        </span>
      </div>
    ) : central === 'depth' ? (
      <div className="helm-central-value">
        <span className="helm-big-value">{depth === null ? '--' : depth.toFixed(1)}</span>
        <span className="helm-unit">m</span>
      </div>
    ) : central === 'time' ? (
      <div className="helm-central-value">
        <span className="helm-big-value">{localTime ?? '--'}</span>
        <span className="helm-unit">{localDate ?? 'local'}</span>
      </div>
    ) : central === 'position' ? (
      <div className="helm-central-value">
        <span className="helm-big-value helm-position-line">
          {position === null ? '--' : formatCoordinate(position.latitude, true)}
        </span>
        <span className="helm-big-value helm-position-line">
          {position === null ? '--' : formatCoordinate(position.longitude, false)}
        </span>
        <span className="helm-unit">WGS 84</span>
      </div>
    ) : (
      <div className="helm-central-value">
        {/* Cadran Raymarine occupant l'espace disponible (#180 retour n°9) */}
        <div className="helm-wind-stage">
          <WindDial twdDeg={twd} twsKts={tws} fill />
        </div>
        {/* #182 retour n°13 : les QUATRE valeurs du vent en digital sous
            le cadran — TWS, AWS, TWA, AWA. */}
        <div className="helm-wind-readouts" data-testid="helm-wind-readouts">
          <span className="helm-readout">
            <span className="helm-readout-lbl">TWS</span>
            <strong>{fmt(tws, 0, 'kt')}</strong>
          </span>
          <span className="helm-readout">
            <span className="helm-readout-lbl">AWS</span>
            <strong>{fmt(aws, 0, 'kt')}</strong>
          </span>
          <span className="helm-readout">
            <span className="helm-readout-lbl">TWA</span>
            <strong>{twa === null ? '--' : `${Math.round(Math.abs(twa))}°`}</strong>
          </span>
          <span className="helm-readout">
            <span className="helm-readout-lbl">AWA</span>
            <strong>{awa === null ? '--' : `${Math.round(Math.abs(awa))}°`}</strong>
          </span>
        </div>
      </div>
    );

  // #182 retour n°13 : SIX instruments — la colonne droite montre TOUS les
  // non-centraux. Ordre fixe : vent, vitesse, cap, profondeur, heure,
  // position (les non-centraux, le central exclu).
  const tileOrder: CentralInstrument[] = (
    ['wind', 'speed', 'compass', 'depth', 'time', 'position'] as CentralInstrument[]
  ).filter((type) => type !== central);

  // Contenu digital d'une tuile par instrument (jumelages conservés).
  const tileData = (type: CentralInstrument) => {
    if (type === 'wind') {
      return {
        label: 'TWS',
        value: tws === null ? '--' : tws.toFixed(0),
        sub: twa === null ? 'no wind' : `kt · TWA ${Math.round(Math.abs(twa))}°`,
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
    if (type === 'compass') {
      return {
        label: 'COG',
        value: cog === null ? '--' : `${Math.round(normalizeDeg(cog))}°`,
        sub: hdg === null ? 'HDG --' : `HDG ${Math.round(normalizeDeg(hdg))}°`,
        testid: 'helm-compact-compass',
        name: 'CAP'
      };
    }
    if (type === 'depth') {
      return {
        label: 'DEPTH',
        value: depth === null ? '--' : depth.toFixed(1),
        sub: 'm',
        testid: 'helm-compact-depth',
        name: 'PROFONDEUR'
      };
    }
    if (type === 'time') {
      return {
        label: 'TIME',
        value: localTime ?? '--',
        sub: 'local',
        testid: 'helm-compact-time',
        name: 'HEURE'
      };
    }
    return {
      label: 'POSITION',
      value: position === null ? '--' : formatCoordinate(position.latitude, true),
      sub: position === null ? 'WGS 84' : formatCoordinate(position.longitude, false),
      testid: 'helm-compact-position',
      name: 'POSITION'
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

      {/* Colonne droite : 1/3, VUE DIGITALE, TOUS les instruments non
          centraux (retour n°13 : profondeur, heure et position inclus).
          Chaque tuile est CLIQUABLE et OCCUPE tout l'espace disponible
          (flex 1, verticalement et horizontalement). */}
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
      </div>
    </div>
  );
};

export default HelmPanel;
