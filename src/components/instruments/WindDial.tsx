import React from 'react';
import { normalizeDeg, polarToXY, tickMarks } from '../../utils/instrumentPrimitives';

/** Cadran de vent compact (refonte instruments, Phase 2 — #160) :
 * design COASTAL — vent resserré, 170 px. Rose fixe, flèche indiquant
 * la direction D'OÙ vient le vent (TWD), TWS au centre, AWA en info. */

interface WindDialProps {
  /** Direction du vent vrai (degrés, origine). */
  twdDeg: number | null;
  /** Force du vent vrai (nœuds). */
  twsKts: number | null;
  /** Angle du vent apparent (info, affiché par le panneau appelant). */
  size?: number;
}

const R = 82;
const CX = 100;
const CY = 100;

const WindDial: React.FC<WindDialProps> = ({ twdDeg, twsKts, size = 170 }) => {
  const marks = tickMarks(0, 360, 90, 30);
  const arrowTip = polarToXY(CX, CY, R - 14, twdDeg ?? 0);
  const arrowBase = polarToXY(CX, CY, 34, twdDeg ?? 0);
  const wingL = polarToXY(CX, CY, 52, (twdDeg ?? 0) + 24);
  const wingR = polarToXY(CX, CY, 52, (twdDeg ?? 0) - 24);

  return (
    <svg
      className="wind-dial"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={
        twdDeg === null
          ? 'Wind dial, no wind data'
          : `Wind from ${Math.round(normalizeDeg(twdDeg))} degrees, ${twsKts?.toFixed(0) ?? '--'} knots`
      }
    >
      <circle cx={CX} cy={CY} r={R} className="compass-rose-ring" />
      {marks.map((m) => {
        const outer = polarToXY(CX, CY, R, m.angle);
        const inner = polarToXY(CX, CY, R - 8, m.angle);
        return (
          <line
            key={m.angle}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            className="compass-tick"
          />
        );
      })}
      {/* Points cardinaux discrets */}
      {([0, 90, 180, 270] as const).map((angle) => {
        const p = polarToXY(CX, CY, R - 22, angle);
        const label = angle === 0 ? 'N' : angle === 90 ? 'E' : angle === 180 ? 'S' : 'W';
        return (
          <text key={label} x={p.x} y={p.y + 3} textAnchor="middle" className="compass-cardinal">
            {label}
          </text>
        );
      })}
      {/* Flèche : la pointe marque la provenance du vent */}
      {twdDeg !== null && (
        <polygon
          points={`${arrowTip.x},${arrowTip.y} ${wingL.x},${wingL.y} ${arrowBase.x},${arrowBase.y} ${wingR.x},${wingR.y}`}
          className="wind-arrow"
          data-testid="wind-arrow"
        />
      )}
      <text x={CX} y={CY + 34} textAnchor="middle" className="compass-cog wind-dial-tws">
        {twsKts === null ? '--' : `${twsKts.toFixed(0)} kt`}
      </text>
    </svg>
  );
};

export default WindDial;
