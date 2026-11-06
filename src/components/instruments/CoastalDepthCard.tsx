import React from 'react';
import InstrumentCard from './InstrumentCard';

/** Colonne PROFONDEUR du reset COASTAL (#186, maquettes c1–c4 validées).
 *
 * Vue verticale pensée pour l'arrivée au mouillage : **0 m EN BAS**
 * (ajustement Dom), l'échelle monte vers le haut — le marqueur monte
 * quand ça s'approfondit, l'eau (voile translucide) se remplit depuis
 * le bas jusqu'au marqueur.
 *
 * Zones : rouge 0–2 m (le fond de colonne), orange 2–3 m, vert ensuite.
 * Échelle ADAPTATIVE : 0–15 m par défaut, ×2 (0–30 m) si profondeur
 * > 15 m — badge « échelle ×2 » dans le header, graduations tous les
 * 5 m dans les deux cas.
 *
 * Alerte ≤ 2 m (spec Dom) : bandeau rouge clignotant au-dessus de la
 * colonne, colonne ENTIÈRE en rouge, grande valeur en rouge. Le pied
 * affiche TEMP + ALARME (seuil, 2.0 m par défaut). */

/** Seuil d'alerte profondeur (m) — spec reset COASTAL : 2 m. */
export const DEPTH_ALERT_THRESHOLD = 2;
/** Fin de zone orange (m). */
const CAUTION_DEPTH = 3;
/** Étendue nominale de l'échelle (m). */
const BASE_MAX = 15;
/** Étendue adaptative ×2 (m) — si profondeur > BASE_MAX. */
const EXTENDED_MAX = 30;
/** Pas des graduations (m). */
const TICK_STEP = 5;

// Géométrie SVG (viewBox 240×560) : colonne x 30→140, 0 m à y=560.
const COL_X0 = 30;
const COL_X1 = 140;
const COL_W = COL_X1 - COL_X0;
const BASE_Y = 560;
const VB_W = 240;

interface CoastalDepthCardProps {
  depth: number | null;
  temperature: number | null;
  /** Seuil d'alarme configuré (pied « ALARME X m ») — 2.0 par défaut. */
  alarmDepth?: number | null;
  /** Alarme remontée par la sonde (fraise l'alerte visuelle). */
  sensorAlarm?: boolean;
}

const CoastalDepthCard: React.FC<CoastalDepthCardProps> = ({
  depth,
  temperature,
  alarmDepth = null,
  sensorAlarm = false
}) => {
  // Échelle adaptative : ×2 dès que la profondeur dépasse 15 m.
  const scaleMax = depth !== null && depth > BASE_MAX ? EXTENDED_MAX : BASE_MAX;
  const extended = scaleMax === EXTENDED_MAX;
  const pxPerM = BASE_Y / scaleMax;
  const yOf = (m: number) => BASE_Y - m * pxPerM;

  // Alerte ≤ 2 m (spec Dom) OU alarme de la sonde.
  const alarm =
    depth !== null && (depth <= DEPTH_ALERT_THRESHOLD || sensorAlarm);

  const markerY = depth === null ? null : yOf(depth);
  const ticks: number[] = [];
  for (let m = 0; m <= scaleMax; m += TICK_STEP) ticks.push(m);

  return (
    <InstrumentCard
      title="PROFONDEUR"
      hideToggle
      headerPrefix={
        extended ? (
          <span className="coastal-depth-scale-badge" data-testid="coastal-depth-scale-badge">
            échelle ×2
          </span>
        ) : null
      }
    >
      {alarm && depth !== null && (
        <div
          className="coastal-depth-alert"
          role="alert"
          data-testid="coastal-depth-alert"
        >
          ⚠ PROFONDEUR {depth.toFixed(1)} M — TROP PEU PROFOND
        </div>
      )}
      <div className="coastal-depth-value" data-testid="coastal-depth-value">
        <strong className={alarm ? 'alarm' : undefined}>
          {depth === null ? '--' : depth.toFixed(1)}
        </strong>
        <span>m</span>
      </div>
      <div className="coastal-depth-stage">
        <svg
          className={`coastal-depth-column${alarm ? ' alarm' : ''}`}
          data-testid="coastal-depth-column"
          viewBox={`0 0 ${VB_W} ${BASE_Y}`}
          role="img"
          aria-label={`Colonne de profondeur, 0 mètre en bas, échelle 0 à ${scaleMax} mètres`}
        >
          {/* Zones de couleur — 0 m EN BAS : rouge 0–2, orange 2–3, vert ensuite. */}
          {alarm ? (
            <rect
              className="coastal-depth-zone-danger"
              data-testid="coastal-depth-zone-red"
              x={COL_X0}
              y={yOf(scaleMax)}
              width={COL_W}
              height={BASE_Y}
            />
          ) : (
            <>
              <rect
                className="coastal-depth-zone-safe"
                x={COL_X0}
                y={yOf(scaleMax)}
                width={COL_W}
                height={yOf(CAUTION_DEPTH) - yOf(scaleMax)}
              />
              <rect
                className="coastal-depth-zone-caution"
                x={COL_X0}
                y={yOf(CAUTION_DEPTH)}
                width={COL_W}
                height={yOf(DEPTH_ALERT_THRESHOLD) - yOf(CAUTION_DEPTH)}
              />
              <rect
                className="coastal-depth-zone-danger"
                data-testid="coastal-depth-zone-red"
                x={COL_X0}
                y={yOf(DEPTH_ALERT_THRESHOLD)}
                width={COL_W}
                height={BASE_Y - yOf(DEPTH_ALERT_THRESHOLD)}
              />
            </>
          )}
          {/* Eau : voile translucide du bas (0 m) jusqu'au marqueur. */}
          {markerY !== null && (
            <rect
              className={alarm ? 'coastal-depth-water alarm' : 'coastal-depth-water'}
              x={COL_X0}
              y={markerY}
              width={COL_W}
              height={BASE_Y - markerY}
            />
          )}
          {/* Graduations : 0 m en bas, monte tous les 5 m. */}
          {ticks.map((m) => (
            <g key={m} className="coastal-depth-tick">
              <line x1={COL_X0 - 10} y1={yOf(m)} x2={COL_X0} y2={yOf(m)} />
              <text x={COL_X0 - 16} y={yOf(m) + 4}>
                {m}
              </text>
            </g>
          ))}
          {/* Marqueur de profondeur actuelle. */}
          {markerY !== null && (
            <g
              className="coastal-depth-marker"
              data-testid="coastal-depth-marker"
              data-depth={depth?.toFixed(1)}
            >
              <line x1={COL_X0} y1={markerY} x2={COL_X1} y2={markerY} />
              <circle cx={COL_X1} cy={markerY} r={6} />
              <text x={COL_X1 + 16} y={markerY + 6}>
                {depth?.toFixed(1)} m
              </text>
            </g>
          )}
        </svg>
      </div>
      <div className="coastal-depth-foot" data-testid="coastal-depth-foot">
        <span className="helm-readout">
          <span className="helm-readout-lbl">TEMP</span>
          <strong>{temperature === null ? '--' : `${temperature.toFixed(1)}°`}</strong>
        </span>
        <span className="helm-readout">
          <span className="helm-readout-lbl">ALARME</span>
          <strong>
            {(alarmDepth ?? DEPTH_ALERT_THRESHOLD).toFixed(1)} m
          </strong>
        </span>
      </div>
    </InstrumentCard>
  );
};

export default CoastalDepthCard;
