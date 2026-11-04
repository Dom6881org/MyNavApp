import React from 'react';
import { normalizeDeg, polarToXY, tickMarks } from '../../utils/instrumentPrimitives';

/** Cadran de vent façon Raymarine (#176, regression #169 : la version
 * Raymarine n'avait jamais atteint ce fichier — voir issue) :
 * arcs ROUGE bâbord / VERT tribord, silhouette de bateau au centre,
 * aiguille depuis le bateau vers la provenance (TWD), vignette digitale
 * TWS + TWD. Sans donnée : `--` unique. API inchangée (twdDeg/twsKts/size). */

interface WindDialProps {
  /** Direction du vent vrai (degrés, origine). */
  twdDeg: number | null;
  /** Force du vent vrai (nœuds). */
  twsKts: number | null;
  size?: number;
}

const R = 88;
const CX = 100;
const CY = 100;

const WindDial: React.FC<WindDialProps> = ({ twdDeg, twsKts, size = 170 }) => {
  const marks = tickMarks(0, 360, 90, 30);
  const twd = twdDeg === null ? null : normalizeDeg(twdDeg);

  // Arcs façon Raymarine : rouge à bâbord (moitié gauche du cadran),
  // vert à tribord (moitié droite) — le bateau pointe vers le haut.
  const arcPort = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX} ${CY - R}`;
  const arcStarboard = `M ${CX} ${CY - R} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

  // Aiguille : du bateau vers la provenance du vent.
  const needleOuter = polarToXY(CX, CY, R - 16, twd ?? 0);
  const needleBase = polarToXY(CX, CY, 22, twd ?? 0);
  const headA = polarToXY(CX, CY, R - 6, (twd ?? 0) + 165);
  const headB = polarToXY(CX, CY, R - 6, (twd ?? 0) - 165);

  return (
    <svg
      className="wind-dial"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={
        twd === null
          ? 'Wind dial, no wind data'
          : `Wind from ${Math.round(twd)} degrees, ${twsKts?.toFixed(0) ?? '--'} knots`
      }
    >
      <circle cx={CX} cy={CY} r={R} className="compass-rose-ring" />

      {/* Arcs bâbord (rouge) / tribord (vert) — référence Raymarine Alpha */}
      <path d={arcPort} className="wind-arc-port" data-testid="wind-arc-port" />
      <path d={arcStarboard} className="wind-arc-starboard" data-testid="wind-arc-starboard" />

      {marks.map((m) => {
        const outer = polarToXY(CX, CY, R, m.angle);
        const inner = polarToXY(CX, CY, R - 7, m.angle);
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

      {/* Cardinaux : N surligné, la rose est fixe (le bateau pointe au nord) */}
      {([0, 90, 180, 270] as const).map((angle) => {
        const p = polarToXY(CX, CY, R - 20, angle);
        const label = angle === 0 ? 'N' : angle === 90 ? 'E' : angle === 180 ? 'S' : 'W';
        return (
          <text
            key={label}
            x={p.x}
            y={p.y + 4}
            textAnchor="middle"
            className={angle === 0 ? 'compass-cardinal compass-cardinal-n' : 'compass-cardinal'}
          >
            {label}
          </text>
        );
      })}

      {/* Aiguille : pointe à la provenance du vent */}
      {twd !== null && (
        <g className="wind-needle" data-testid="wind-arrow">
          <line
            x1={needleBase.x}
            y1={needleBase.y}
            x2={needleOuter.x}
            y2={needleOuter.y}
          />
          <polygon
            points={`${needleOuter.x},${needleOuter.y} ${headA.x},${headA.y} ${headB.x},${headB.y}`}
          />
        </g>
      )}

      {/* Silhouette du bateau, proue vers le haut */}
      <polygon
        points={`${CX},${CY - 30} ${CX - 9},${CY + 20} ${CX},${CY + 12} ${CX + 9},${CY + 20}`}
        className="wind-boat"
      />

      {/* Vignette digitale : TWS dans le cadre, TWD au-dessus */}
      {twd !== null && (
        <text x={CX} y={CY - 42} textAnchor="middle" className="wind-dial-twd" data-testid="wind-dial-twd">
          {`${Math.round(twd)}°`}
        </text>
      )}
      <rect x={CX - 34} y={CY + 28} width={68} height={28} rx={6} className="wind-dial-box" />
      <text x={CX} y={CY + 48} textAnchor="middle" className="compass-cog wind-dial-tws">
        {twsKts === null ? '--' : `${twsKts.toFixed(0)} kt`}
      </text>
    </svg>
  );
};

export default WindDial;
