import React, { useState } from 'react';
import type { NavigationData } from '../../types';
import { normalizeDeg } from '../../utils/instrumentPrimitives';
import { formatCoordinate } from '../../utils/formatCoordinate';
import CompassDial from './CompassDial';
import CompassHalfDial from './CompassHalfDial';
import WindDial from './WindDial';
import SpeedGauge from './SpeedGauge';
import FramedReadouts from './FramedReadouts';
import InstrumentCard from './InstrumentCard';

/** Panneau HELM (refonte instruments, Phase 1 — #158) : instrument
 * central commutable en grand + colonne de tuiles digitales.
 *
 * #182 (retour n°12/13) : central sur 2/3, colonne droite sur 1/3 en
 * VUE DIGITALE — SIX instruments (vent, cap, vitesse, PROFONDEUR,
 * HEURE, POSITION), TOUTES les tuiles cliquables, le clic affiche
 * l'information EN GRAND au centre, la tuile RESTE à droite et
 * l'active est SURLIGNÉE (cadre accent).
 *
 * #184 (retour n°21-quater de Dom, maquette validée) : SWITCH
 * SEGMENTÉ à gauche du titre du container central — COMPAS : TROIS
 * états (CADRAN course-up / 1/2 CADRAN legacy / NUMÉRIQUE) ;
 * VITESSE et VENT : DEUX (CADRAN / NUMÉRIQUE) ; PROFONDEUR, HEURE,
 * POSITION : AUCUN (pas de switch du tout). Vues numériques CADRÉES
 * (lignes label/valeur, même philosophie partout) : compas COG/HDG ;
 * vitesse STW/SOG/MAX + bouton RESET ; heure LOCALE/TU ; profondeur
 * DEPTH/TEMP ; position LAT/LON + qualité du signal GPS (± m).
 * VMG retiré (retour n°21-quater) : les informations de route suivie
 * (ETA, next waypoint…) arriveront dans cette vue plus tard. */

type CentralInstrument = 'wind' | 'compass' | 'speed' | 'depth' | 'time' | 'position';

/** Format d'affichage du central : 'dial' = cadran course-up (ou
 * jauge/cadran selon l'instrument), 'half' = demi-cadran legacy
 * (compas uniquement), 'numeric' = vue numérique cadrée. */
type CentralDisplay = 'dial' | 'half' | 'numeric';

interface HelmPanelProps {
  data: NavigationData;
  /** #184 : reset du max de vitesse de session — bouton RESET de la
   * vue vitesse (cadran et numérique). */
  onResetMaxSpeed?: () => void;
}

/** Segments du switch par instrument (maquette n°21-quater) : le
 * compas a le segment 1/2 CADRAN en plus ; profondeur/heure/position
 * n'ont PAS de switch (liste vide). */
const MODES: Record<CentralInstrument, CentralDisplay[]> = {
  compass: ['dial', 'half', 'numeric'],
  speed: ['dial', 'numeric'],
  wind: ['dial', 'numeric'],
  depth: [],
  time: [],
  position: []
};

const MODE_LABEL: Record<CentralDisplay, string> = {
  dial: 'CADRAN',
  half: '1/2 CADRAN',
  numeric: 'NUMÉRIQUE'
};

const HelmPanel: React.FC<HelmPanelProps> = ({ data, onResetMaxSpeed }) => {
  const [central, setCentral] = useState<CentralInstrument>('compass');
  // #184 : un seul état de format pour tout le central (préférence
  // d'affichage, pas de données) ; pas de persistance pour l'instant.
  const [centralMode, setCentralMode] = useState<CentralDisplay>('dial');

  const cog = data.compass?.cog ?? null;
  const hdg = data.compass?.heading ?? null;
  const sog = data.speed?.sog ?? null;
  // Jumelage design revue 2 : SOG+STW ensemble partout. 0.0 = donnée
  // réelle, affichée telle quelle ; '--' seulement sans donnée (VHW absent).
  const stw = data.speed?.stw ?? null;
  const maxSpeed = data.speed?.maxSpeed ?? null;
  // #176 : sources du cadran vent (mêmes que COASTAL — vent du point)
  const twd = data.wind?.direction ?? null;
  const tws = data.trueWind?.speedKnots ?? null;
  const twa = data.trueWind?.angleDegrees ?? null;
  const aws = data.apparentWind?.speedKnots ?? null;
  const awa = data.apparentWind?.angleDegrees ?? null;
  const depth = data.depth?.depth ?? null;
  const waterTemp = data.depth?.temperature ?? null;
  // #182 retour n°13 : heure + position remplacent la bande d'état en HELM
  const localTime = data.gpsTime?.localTime ?? null;
  const utcTime = data.gpsTime?.utcTime ?? null;
  const localDate = data.gpsTime?.date ?? null;
  const position = data.position;
  // #184 retour n°21-quater : qualité du signal GPS (précision en mètres)
  const gpsAccuracy = data.gpsAccuracy ?? null;

  const fmt = (value: number | null, digits: number, unit: string) =>
    value === null ? '--' : `${value.toFixed(digits)} ${unit}`;

  // Mode EFFECTIF : si l'instrument courant ne propose pas le mode
  // mémorisé (ex. 'half' en revenant au vent), repli sur son premier
  // mode — sans toucher à l'état (le mode d'origine est restauré en
  // revenant sur l'instrument qui le propose).
  const modes = MODES[central];
  const effectiveMode: CentralDisplay = modes.includes(centralMode)
    ? centralMode
    : modes[0] ?? 'dial';

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

  // Switch segmenté (header du central, à GAUCHE du titre) — absent
  // pour profondeur/heure/position (retour n°21-quater).
  const modeSwitch =
    modes.length > 0 ? (
      <div
        className="helm-mode-switch"
        role="group"
        aria-label="Format d'affichage"
        data-testid="helm-mode-switch"
      >
        {modes.map((mode) => (
          <button
            key={mode}
            type="button"
            className={`helm-switch-btn${mode === effectiveMode ? ' active' : ''}`}
            aria-pressed={mode === effectiveMode}
            onClick={() => setCentralMode(mode)}
          >
            {MODE_LABEL[mode]}
          </button>
        ))}
      </div>
    ) : null;

  // ===== vues numériques CADRÉES (#184 retour n°21-quater) =====
  const framedNumeric =
    central === 'compass' ? (
      <div className="helm-central-value">
        <FramedReadouts
          data-testid="helm-central-numeric"
          rows={[
            {
              label: 'COG',
              labelClass: 'lbl-cog',
              value: cog === null ? '--' : `${Math.round(normalizeDeg(cog))}°`
            },
            {
              label: 'HDG',
              labelClass: 'lbl-hdg',
              value: hdg === null ? '--' : `${Math.round(normalizeDeg(hdg))}°`
            }
          ]}
        />
      </div>
    ) : central === 'speed' ? (
      <div className="helm-central-value">
        <FramedReadouts
          data-testid="helm-central-numeric"
          rows={[
            {
              label: 'STW',
              labelClass: 'lbl-stw',
              value: stw === null ? '--' : stw.toFixed(1),
              unit: 'kn'
            },
            {
              label: 'SOG',
              labelClass: 'lbl-sog',
              value: sog === null ? '--' : sog.toFixed(1),
              unit: 'kn'
            },
            {
              label: 'MAX',
              labelClass: 'lbl-max',
              value: maxSpeed === null ? '--.-' : maxSpeed.toFixed(1),
              unit: 'kn',
              secondary: true,
              extra: onResetMaxSpeed ? (
                <button
                  type="button"
                  className="speed-max-reset"
                  onClick={onResetMaxSpeed}
                  title="Reset session max speed"
                >
                  RESET
                </button>
              ) : undefined
            }
          ]}
        />
      </div>
    ) : central === 'depth' ? (
      <div className="helm-central-value">
        <FramedReadouts
          data-testid="helm-central-numeric"
          rows={[
            {
              label: 'DEPTH',
              labelClass: 'lbl-depth',
              value: depth === null ? '--' : depth.toFixed(1),
              unit: 'm'
            },
            {
              label: 'TEMP',
              value: waterTemp === null ? '--' : waterTemp.toFixed(1),
              unit: '°C',
              secondary: true
            }
          ]}
        />
      </div>
    ) : central === 'time' ? (
      <div className="helm-central-value">
        <FramedReadouts
          data-testid="helm-central-numeric"
          rows={[
            { label: 'LOCAL', value: localTime ?? '--' },
            { label: 'TU', value: utcTime ?? '--' }
          ]}
        />
      </div>
    ) : central === 'position' ? (
      <div className="helm-central-value">
        <FramedReadouts
          data-testid="helm-central-numeric"
          rows={[
            {
              label: 'LAT',
              value: position === null ? '--' : formatCoordinate(position.latitude, true)
            },
            {
              label: 'LON',
              value: position === null ? '--' : formatCoordinate(position.longitude, false)
            },
            {
              label: 'GPS',
              labelClass: 'lbl-gps',
              rowClass: 'gps',
              value: gpsAccuracy === null ? '--' : `± ${Math.round(gpsAccuracy)} m`,
              secondary: true
            }
          ]}
        />
      </div>
    ) : null; // vent : la vue digitale existante (TWS énorme) reste

  // ===== contenu central selon l'instrument et le mode =====
  const renderCentral = () => {
    if (central === 'compass') {
      if (effectiveMode === 'dial') {
        /* #182 retours n°14/15/16 : cadran course-up OCCUPANT l'espace
           disponible ; COG/HDG À L'INTÉRIEUR du cadran (maquette). */
        return (
          <div className="helm-central-value">
            <div className="helm-compass-stage">
              <CompassDial cog={cog} heading={hdg} fill />
            </div>
          </div>
        );
      }
      if (effectiveMode === 'half') {
        /* #184 retour n°21-quater : demi-cadran LEGACY en grand au
           central (rose -COG, aiguille cyan fixe, cap superposé,
           HDG/COG en secondaires) — jamais rogné (chaîne flex
           min-height: 0 comme les autres stages). */
        return (
          <div className="helm-central-value">
            <div className="helm-compass-half-stage">
              <CompassHalfDial cog={cog} heading={hdg} fill />
            </div>
          </div>
        );
      }
      return framedNumeric;
    }
    if (central === 'speed') {
      if (effectiveMode === 'dial') {
        /* #184 retour n°21-quater : jauge legacy du Speedometer en
           grand au central (aiguilles STW/SOG, marque MAX, readouts,
           ligne MAX + RESET). */
        return (
          <div className="helm-central-value">
            <div className="helm-speed-stage">
              <SpeedGauge
                sog={sog}
                stw={stw}
                maxSpeed={maxSpeed}
                onResetMaxSpeed={onResetMaxSpeed}
              />
            </div>
          </div>
        );
      }
      return framedNumeric;
    }
    if (central === 'wind') {
      /* Mode cadran : cadran Raymarine occupant l'espace (#180 n°9) +
         les QUATRE valeurs du vent en digital sous le cadran (#182
         retour n°13). Mode numérique : TWS énorme + AWS/TWA/AWA
         dessous (livré au retour n°21, inchangé). */
      if (effectiveMode === 'numeric') {
        return (
          <div className="helm-central-value helm-central-digital" data-testid="helm-central-digital">
            <span className="helm-digital-label">TWS</span>
            <span className="helm-digital-value">{tws === null ? '--' : tws.toFixed(0)}</span>
            <span className="helm-unit">kt</span>
            <div className="helm-wind-readouts">
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
      }
      return (
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
    }
    // depth / time / position : vue numérique cadrée, pas de switch
    return framedNumeric;
  };

  // #184 retour n°21 : ordre demandé par Dom — HEURE en haut, POSITION
  // en 2e, puis VITESSE, VENT, CAP, PROFONDEUR. Les SIX tuiles restent
  // TOUJOURS visibles (l'info passe en grand au centre, la tuile reste).
  const tileOrder: CentralInstrument[] = [
    'time',
    'position',
    'speed',
    'wind',
    'compass',
    'depth'
  ];

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
        sub: localDate ?? 'local',
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
      {/* Instrument central : 2/3 de la largeur (#182). Le switch
          segmenté vit dans le header (headerPrefix, à gauche du titre). */}
      <div className="helm-central">
        <InstrumentCard
          title={centralTitle}
          hideToggle
          headerPrefix={modeSwitch}
        >
          {renderCentral()}
        </InstrumentCard>
      </div>

      {/* Colonne droite : 1/3, VUE DIGITALE, les SIX instruments TOUJOURS
          visibles (retour n°21 #184) — ordre HEURE, POSITION, VITESSE,
          VENT, CAP, PROFONDEUR. Chaque tuile est CLIQUABLE et OCCUPE tout
          l'espace disponible ; la tuile de l'instrument AU CENTRE reste
          affichée et est SURLIGNÉE (cadre accent + pastille). */}
      <div className="helm-compact" role="group" aria-label="Instruments numériques">
        {tileOrder.map((type) => {
          const tile = tileData(type);
          const active = type === central;
          return (
            <button
              key={type}
              type="button"
              className={`helm-tile${active ? ' active' : ''}`}
              data-testid={tile.testid}
              aria-label={`Afficher ${tile.name} au centre`}
              aria-current={active ? 'true' : undefined}
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
