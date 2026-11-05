import React from 'react';
import {
  normalizeDeg,
  polarToXY,
  roseRotationDeg,
  tickMarks
} from '../../utils/instrumentPrimitives';

/** Compas COURSE-UP (refonte instruments, Phase 1 — #158 ; reprise HELM
 * design-centered façon maquette).
 *
 * Le design revue 2 remplace l'ancienne aiguille sur rose fixe (illisible :
 * « il indique 82 mais on face à l'ouest ») : la ROSE tourne de -COG, le
 * cap du bateau reste TOUJOURS en haut sous le lubber fixe, la proue est
 * fixe. COG en grand, HDG en ambre.
 *
 * Reprise HELM : fidélité à la maquette — double cercle (virole + rose),
 * cardinaux CONTRE-ROTÉS (toujours à l'endroit sous les yeux), proue et
 * lubber ROUGES, COG en grand sans unité + label « COG °TRUE », HDG ambre
 * sous le cadran. Couleurs d'affichage marines fixes (comme WindDial).
 *
 * ⚠️ Classe .compass-courseup (PAS .compass-dial) : App.css garde une
 * règle legacy .compass-dial { height: 96px; width: min(100%, 210px) }
 * qui écrasait ce cadran à ~96 px — c'est ainsi que le compas central
 * HELM restait minuscule depuis la Phase 1 (#180). */

interface CompassDialProps {
  /** Cap sur le fond (COG) — pilote la rotation de la rose. */
  cog: number | null;
  /** Cap compas (HDG) — affiché en ambre, ne fait pas tourner la rose. */
  heading?: number | null;
  size?: number;
}

const CX = 110;
const CY = 120;
const R_OUTER = 104;
const R_ROSE = 88;

const CompassDial: React.FC<CompassDialProps> = ({ cog, heading = null, size = 220 }) => {
  const roseRotation = cog === null ? 0 : roseRotationDeg(cog);
  const marks = tickMarks(0, 360, 30, 10);

  /** Cardinal tournant (positionné dans la rose) mais contre-roté sur
   * lui-même : les lettres restent droites quelle que soit la rose. */
  const cardinal = (angle: number, label: string, highlight: boolean) => {
    const p = polarToXY(CX, CY, R_ROSE - 28, angle);
    return (
      <text
        key={label}
        x={p.x}
        y={p.y + 4}
        textAnchor="middle"
        transform={`rotate(${-roseRotation} ${p.x} ${p.y})`}
        className={highlight ? 'compass-cardinal compass-cardinal-n' : 'compass-cardinal'}
      >
        {label}
      </text>
    );
  };

  return (
    <svg
      className="compass-courseup"
      viewBox="0 0 220 240"
      width={size}
      height={(size * 240) / 220}
      role="img"
      aria-label={`Compass course up${cog === null ? '' : `, COG ${Math.round(cog)} degrees`}`}
    >
      {/* Virole extérieure fixe */}
      <circle cx={CX} cy={CY} r={R_OUTER} className="compass-outer-ring" />
      {/* Rose tournante : le COG reste en haut */}
      <g transform={`rotate(${roseRotation} ${CX} ${CY})`} data-testid="compass-rose">
        <circle cx={CX} cy={CY} r={R_ROSE} className="compass-rose-ring" />
        {marks.map((m) => {
          const outer = polarToXY(CX, CY, R_ROSE, m.angle);
          const inner = polarToXY(CX, CY, R_ROSE - (m.major ? 8 : 4), m.angle);
          return (
            <line
              key={m.angle}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              className={m.major ? 'compass-tick compass-tick-major' : 'compass-tick'}
            />
          );
        })}
        {cardinal(0, 'N', true)}
        {cardinal(90, 'E', false)}
        {cardinal(180, 'S', false)}
        {cardinal(270, 'W', false)}
      </g>

      {/* Proue fixe + lubber rouge : le cap est TOUJOURS ici */}
      <line x1={CX} y1={CY - 96} x2={CX} y2={CY - 72} className="compass-lubber" />
      <polygon
        points={`${CX},${CY - R_OUTER} ${CX - 7},${CY - R_ROSE} ${CX + 7},${CY - R_ROSE}`}
        className="compass-boat"
      />

      {/* Readouts : COG en grand + label, HDG ambre sous le cadran */}
      <text x={CX} y={CY + 52} textAnchor="middle" className="compass-cog">
        {cog === null ? '--' : `${Math.round(normalizeDeg(cog))}`}
      </text>
      <text x={CX} y={CY + 74} textAnchor="middle" className="compass-cog-label">
        COG °TRUE
      </text>
      <text x={CX} y={230} textAnchor="middle" className="compass-hdg">
        {heading === null ? 'HDG --' : `HDG ${Math.round(normalizeDeg(heading))}°`}
      </text>
    </svg>
  );
};

export default CompassDial;
