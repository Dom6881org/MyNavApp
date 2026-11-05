import React from 'react';
import { describeArc, normalizeDeg, polarToXY, tickMarks } from '../../utils/instrumentPrimitives';

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
  /** #180 retour n°9 : le cadran occupe tout l'espace disponible de son
   * conteneur (width/height 100%) au lieu d'une taille fixe. */
  fill?: boolean;
}

const R = 88;
const CX = 100;
const CY = 100;

const WindDial: React.FC<WindDialProps> = ({ twdDeg, twsKts, size = 170, fill = false }) => {
  const marks = tickMarks(0, 360, 90, 30);
  const twd = twdDeg === null ? null : normalizeDeg(twdDeg);

  // Arcs façon Raymarine (retour terrain n°8 #180) : ils s'arrêtent à
  // 35° de l'axe du bateau au lieu de descendre à l'horizontale (90°) —
  // rouge à bâbord, vert à tribord, symétriques autour de la proue.
  const ARC_HALF_DEG = 35;
  const arcPort = describeArc(CX, CY, R, -ARC_HALF_DEG, 0);
  const arcStarboard = describeArc(CX, CY, R, 0, ARC_HALF_DEG);

  // Aiguille fine façon Raymarine (retour terrain n°7 #180) : tête
  // étroite à la pointe, tige courte qui S'ARRÊTE au bord du bateau —
  // l'aiguille ne traverse plus la silhouette.
  const needleAngle = twd ?? 0;
  const tip = polarToXY(CX, CY, R - 14, needleAngle);
  const headBaseA = polarToXY(CX, CY, R - 30, needleAngle + 4);
  const headBaseB = polarToXY(CX, CY, R - 30, needleAngle - 4);
  const shaftStart = polarToXY(CX, CY, 34, needleAngle);
  const shaftEnd = polarToXY(CX, CY, R - 28, needleAngle);

  return (
    <svg
      className="wind-dial"
      viewBox="0 0 200 200"
      width={fill ? '100%' : size}
      height={fill ? '100%' : size}
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

      {/* Aiguille : pointe à la provenance du vent — fine, hors du bateau */}
      {twd !== null && (
        <g className="wind-needle" data-testid="wind-arrow">
          <line x1={shaftStart.x} y1={shaftStart.y} x2={shaftEnd.x} y2={shaftEnd.y} />
          <polygon
            points={`${tip.x},${tip.y} ${headBaseA.x},${headBaseA.y} ${headBaseB.x},${headBaseB.y}`}
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
