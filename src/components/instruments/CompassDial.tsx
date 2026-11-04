import React from 'react';
import {
  needlePoints,
  normalizeDeg,
  polarToXY,
  roseRotationDeg,
  tickMarks
} from '../../utils/instrumentPrimitives';

/** Compas COURSE-UP (refonte instruments, Phase 1 — #158).
 *
 * Le design revue 2 remplace l'ancienne aiguille sur rose fixe (illisible :
 * « il indique 82 mais on face à l'ouest ») : la ROSE tourne de -COG, le
 * cap du bateau reste TOUJOURS en haut sous le lubber fixe, la proue est
 * fixe. COG en grand, HDG en ambre. */

interface CompassDialProps {
  /** Cap sur le fond (COG) — pilote la rotation de la rose. */
  cog: number | null;
  /** Cap compas (HDG) — affiché en ambre, ne fait pas tourner la rose. */
  heading?: number | null;
  size?: number;
}

const R = 90;
const CX = 100;
const CY = 100;

const cardinal = (angle: number, label: string, highlight: boolean) => {
  const p = polarToXY(CX, CY, R - 26, angle);
  return (
    <text
      key={label}
      x={p.x}
      y={p.y + 4}
      textAnchor="middle"
      className={highlight ? 'compass-cardinal compass-cardinal-n' : 'compass-cardinal'}
    >
      {label}
    </text>
  );
};

const CompassDial: React.FC<CompassDialProps> = ({ cog, heading = null, size = 200 }) => {
  const roseRotation = cog === null ? 0 : roseRotationDeg(cog);
  const marks = tickMarks(0, 360, 30, 10);

  return (
    <svg
      className="compass-dial"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={`Compass course up${cog === null ? '' : `, COG ${Math.round(cog)} degrees`}`}
    >
      {/* Rose tournante : le COG reste en haut */}
      <g transform={`rotate(${roseRotation} ${CX} ${CY})`} data-testid="compass-rose">
        <circle cx={CX} cy={CY} r={R} className="compass-rose-ring" />
        {marks.map((m) => {
          const outer = polarToXY(CX, CY, R, m.angle);
          const inner = polarToXY(CX, CY, R - (m.major ? 12 : 6), m.angle);
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

      {/* Lubber fixe : le cap est TOUJOURS ici */}
      <line x1={CX} y1={4} x2={CX} y2={20} className="compass-lubber" />
      {/* Proue fixe */}
      <polygon points={needlePoints(CX, CY, 58, 7, 12)} className="compass-boat" />

      {/* Readouts : COG grand, HDG ambre */}
      <text x={CX} y={CY + 44} textAnchor="middle" className="compass-cog">
        {cog === null ? '--' : `${Math.round(normalizeDeg(cog))}°`}
      </text>
      <text x={CX} y={CY + 58} textAnchor="middle" className="compass-hdg">
        {heading === null ? 'HDG --' : `HDG ${Math.round(normalizeDeg(heading))}°`}
      </text>
    </svg>
  );
};

export default CompassDial;
