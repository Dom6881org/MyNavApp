import React from 'react';
import { normalizeDeg, polarToXY, tickMarks } from '../../utils/instrumentPrimitives';

/** Cadran de vent façon Raymarine (refonte instruments, #168) : arcs
 * rouge bâbord / vert tribord autour de la rose, aiguille depuis le
 * bateau (silhouette au centre) vers la provenance du vent (TWD),
 * vignette digitale TWS + TWD. Style de référence : affichages
 * Raymarine Alpha (lien consigné dans la Knowledge). */

interface WindDialProps {
  /** Direction du vent vrai (degrés, origine). */
  twdDeg: number | null;
  /** Force du vent vrai (nœuds). */
  twsKts: number | null;
  /** Taille du cadran en pixels. */
  size?: number;
}

const R = 82;
const CX = 100;
const CY = 100;

const WindDial: React.FC<WindDialProps> = ({ twdDeg, twsKts, size = 170 }) => {
  const marks = tickMarks(0, 360, 90, 30);
  const twd = twdDeg === null ? null : normalizeDeg(twdDeg);
  // Aiguille depuis le bateau : pointe à la provenance, pied au centre.
  const needleTip = polarToXY(CX, CY, R - 10, twd ?? 0);
  const needleBase = polarToXY(CX, CY, 24, twd ?? 0);
  const needleWingL = polarToXY(CX, CY, 34, (twd ?? 0) + 18);
  const needleWingR = polarToXY(CX, CY, 34, (twd ?? 0) - 18);

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
      {/* Arcs façon Raymarine : bâbord rouge (moitié gauche), tribord vert */}
      <path
        d={`M ${CX} ${CY - R} A ${R} ${R} 0 0 0 ${CX} ${CY + R}`}
        className="wind-arc-port"
        data-testid="wind-arc-port"
      />
      <path
        d={`M ${CX} ${CY - R} A ${R} ${R} 0 0 1 ${CX} ${CY + R}`}
        className="wind-arc-starboard"
        data-testid="wind-arc-starboard"
      />
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
      {/* Bateau au centre, proue vers le haut */}
      <polygon
        points={`${CX},${CY - 24} ${CX - 8},${CY + 16} ${CX},${CY + 10} ${CX + 8},${CY + 16}`}
        className="wind-boat"
      />
      {/* Aiguille : la pointe marque la provenance du vent, pied sur le bateau */}
      {twd !== null && (
        <g>
          <line
            x1={needleBase.x}
            y1={needleBase.y}
            x2={needleTip.x}
            y2={needleTip.y}
            className="wind-needle"
          />
          <polygon
            points={`${needleTip.x},${needleTip.y} ${needleWingL.x},${needleWingL.y} ${needleWingR.x},${needleWingR.y}`}
            className="wind-arrow"
            data-testid="wind-arrow"
          />
        </g>
      )}
      {/* Vignette digitale : TWS + TWD (une seule valeur sans donnée) */}
      <rect
        x={CX - 33}
        y={CY + 30}
        width={66}
        height={26}
        rx={5}
        className="wind-dial-box"
      />
      <text
        x={CX}
        y={CY + 48}
        textAnchor="middle"
        className="compass-cog wind-dial-tws"
      >
        {twsKts === null ? '--' : `${twsKts.toFixed(0)} kt`}
      </text>
      {twd !== null && (
        <text
          x={CX}
          y={CY + 24}
          textAnchor="middle"
          className="wind-dial-twd"
          data-testid="wind-dial-twd"
        >
          {`${Math.round(twd)}°`}
        </text>
      )}
    </svg>
  );
};

export default WindDial;
