import React from 'react';
import { normalizeDeg, polarToXY, tickMarks } from '../../utils/instrumentPrimitives';

/** Cadran de vent façon Raymarine (#176 ; reprise HELM design-centered
 * #180, retour n°6 : la vue VENT doit être à la hauteur du nouveau compas).
 *
 * Refonte fidèle à la maquette : virole pleine (fond #0d141c, contour
 * #263444), arcs ROUGE bâbord / VERT tribord, aiguille ROUGE à la
 * provenance (TWD), silhouette de bateau blanche, vignette digitale
 * TWS + TWD. Sans vent : « no wind data » DANS le cadran, en bas.
 *
 * ⚠️ Classes PROPRES (.wind-*) : ce cadran héritait de .compass-tick /
 * .compass-cardinal / .compass-rose-ring, styler désormais scopés sous
 * .compass-courseup (leçon collision CSS #180) — les ticks étaient donc
 * devenus invisibles et les cardinaux noirs. */

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

  // Aiguille à la provenance du vent, comme la maquette : pointe fine
  // rouge à l'extrémité, tige traversant le centre vers l'arrière.
  const needleAngle = twd ?? 0;
  const headTip = polarToXY(CX, CY, R - 14, needleAngle);
  const headA = polarToXY(CX, CY, R - 26, needleAngle + 90);
  const headB = polarToXY(CX, CY, R - 26, needleAngle - 90);
  const stern = polarToXY(CX, CY, 30, needleAngle + 180);

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
      {/* Virole pleine : fond marin, contour — comme le compas HELM */}
      <circle cx={CX} cy={CY} r={R} className="wind-dial-virole" />

      {/* Arcs bâbord (rouge) / tribord (vert) — référence Raymarine Alpha */}
      <path d={arcPort} className="wind-arc-port" data-testid="wind-arc-port" />
      <path d={arcStarboard} className="wind-arc-starboard" data-testid="wind-arc-starboard" />

      {marks.map((m) => {
        const outer = polarToXY(CX, CY, R - 8, m.angle);
        const inner = polarToXY(CX, CY, R - 8 - (m.major ? 8 : 4), m.angle);
        return (
          <line
            key={m.angle}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            className={m.major ? 'wind-tick wind-tick-major' : 'wind-tick'}
          />
        );
      })}

      {/* Cardinaux : N surligné, la rose est fixe (le bateau pointe au nord) */}
      {([0, 90, 180, 270] as const).map((angle) => {
        const p = polarToXY(CX, CY, R - 26, angle);
        const label = angle === 0 ? 'N' : angle === 90 ? 'E' : angle === 180 ? 'S' : 'W';
        return (
          <text
            key={label}
            x={p.x}
            y={p.y + 4}
            textAnchor="middle"
            className={angle === 0 ? 'wind-cardinal wind-cardinal-n' : 'wind-cardinal'}
          >
            {label}
          </text>
        );
      })}

      {/* Aiguille : pointe à la provenance du vent */}
      {twd !== null && (
        <g className="wind-needle" data-testid="wind-arrow">
          <line x1={headTip.x} y1={headTip.y} x2={stern.x} y2={stern.y} />
          <polygon
            points={`${headTip.x},${headTip.y} ${headA.x},${headA.y} ${headB.x},${headB.y}`}
          />
        </g>
      )}

      {/* Silhouette du bateau, proue vers le haut */}
      <polygon
        points={`${CX},${CY - 30} ${CX - 9},${CY + 20} ${CX},${CY + 12} ${CX + 9},${CY + 20}`}
        className="wind-boat"
      />

      {/* Vignette digitale : TWD au-dessus du cadre, TWS dans le cadre */}
      {twd !== null && (
        <text x={CX} y={CY - 42} textAnchor="middle" className="wind-dial-twd" data-testid="wind-dial-twd">
          {`${Math.round(twd)}°`}
        </text>
      )}
      <rect x={CX - 34} y={CY + 28} width={68} height={28} rx={6} className="wind-dial-box" />
      <text x={CX} y={CY + 48} textAnchor="middle" className="wind-dial-tws">
        {twsKts === null ? '--' : `${twsKts.toFixed(0)} kt`}
      </text>

      {/* Sans vent : message DANS le cadran, en bas — pas de ligne
          externe en doublon (retour terrain Dom, image 2) */}
      {twd === null && (
        <text
          x={CX}
          y={CY + 76}
          textAnchor="middle"
          className="wind-no-data"
          data-testid="wind-no-data"
        >
          no wind data
        </text>
      )}
    </svg>
  );
};

export default WindDial;
