import React from 'react';
import { normalizeDeg, polarToXY } from '../../utils/instrumentPrimitives';
import type { WindNeedleMode } from '../../utils/instrumentMode';

/** Cadran de vent RELATIF AU BATEAU, façon Raymarine (#188, retour
 * terrain Dom : « je préfère que le cadran soit positionné en relatif
 * par rapport au bateau » — maquette v4 validée).
 *
 * L'ancien cadran (#176/#177) était nord-en-haut : aiguille à la
 * provenance (TWD) sur cardinals N/E/S/W, silhouette « proue au nord »
 * quel que soit le cap réel, et une vignette TWD sans étiquette (le
 * fameux « 135 » incompréhensible). Désormais :
 *
 * - Rose RELATIVE proue-en-haut : chiffres 30/60/90/120 chaque bord +
 *   180 à la poupe, graduations tous les 30° de 60° à 180° (le secteur
 *   0-50° est marqué par les wedges) ; plus de cardinals.
 * - WEDGES REMPLIS 0-50° rouge bâbord / vert tribord, bande épaisse
 *   près de la jante (maquette v4 — remplace les arcs fins ±35°).
 * - AIGUILLE = angle du vent PAR RAPPORT À LA PROUE : apparent (AWA)
 *   par défaut ou vrai (TWA) selon le mode, avec repli sur l'autre bord
 *   si la donnée sélectionnée manque (mode partagé mynav:wind-needle,
 *   switch APPARENT | VRAI dans le header des cartes — #184).
 * - TWD ÉTIQUETÉ en vignette au-dessus du bateau + TWS en boîte.
 *
 * ⚠️ Classes PROPRES (.wind-*) — leçon collision CSS #180. */

interface WindDialProps {
  /** Direction du vent vrai (degrés compas, origine) — vignette étiquetée. */
  twdDeg: number | null;
  /** Force du vent vrai (nœuds). */
  twsKts: number | null;
  /** Angle du vent APPARENT par rapport à la proue (signé, convention
   * ApparentWindData : -180..180, négatif = bâbord). */
  awaDeg?: number | null;
  /** Angle du vent VRAI par rapport à la proue (signé, -180..180). */
  twaDeg?: number | null;
  /** Aiguille sur l'apparent (défaut) ou le vrai — mode partagé/persisté. */
  mode?: WindNeedleMode;
  size?: number;
  /** #180 retour n°9 : le cadran occupe tout l'espace disponible de son
   * conteneur (width/height 100%) au lieu d'une taille fixe. */
  fill?: boolean;
}

const R = 88;
const CX = 100;
const CY = 100;
/** Bande des secteurs rouge/vert : rayon interne/externe (près de la
 * jante) — maquette v4 validée par Dom. */
const WEDGE_IN = 66;
const WEDGE_OUT = 84;
/** Secteurs 0-50° de chaque bord de la proue (retour Dom : étendue). */
const WEDGE_HALF = 50;

/** Secteur annulaire rempli (wedge) — helper local non exporté (règle
 * react-refresh : un fichier composant n'exporte que des composants). */
function wedgePath(angleStart: number, angleEnd: number): string {
  const p1 = polarToXY(CX, CY, WEDGE_OUT, angleStart);
  const p2 = polarToXY(CX, CY, WEDGE_OUT, angleEnd);
  const p3 = polarToXY(CX, CY, WEDGE_IN, angleEnd);
  const p4 = polarToXY(CX, CY, WEDGE_IN, angleStart);
  return (
    `M ${p1.x} ${p1.y} A ${WEDGE_OUT} ${WEDGE_OUT} 0 0 1 ${p2.x} ${p2.y} ` +
    `L ${p3.x} ${p3.y} A ${WEDGE_IN} ${WEDGE_IN} 0 0 0 ${p4.x} ${p4.y} Z`
  );
}

const WindDial: React.FC<WindDialProps> = ({
  twdDeg,
  twsKts,
  awaDeg = null,
  twaDeg = null,
  mode = 'apparent',
  size = 170,
  fill = false
}) => {
  const twd = twdDeg === null ? null : normalizeDeg(twdDeg);
  const awa = awaDeg ?? null;
  const twa = twaDeg ?? null;

  // Aiguille : angle sélectionné selon le mode, repli sur l'autre bord
  // de vent si la donnée manque — l'aria-label dit ce qui est VRAIMENT
  // affiché (apparent ou vrai), pas ce qui était demandé.
  let needleRaw: number | null = null;
  let fromApparent: boolean;
  if (mode === 'apparent') {
    if (awa !== null) {
      needleRaw = awa;
      fromApparent = true;
    } else if (twa !== null) {
      needleRaw = twa;
      fromApparent = false;
    } else {
      fromApparent = true;
    }
  } else {
    if (twa !== null) {
      needleRaw = twa;
      fromApparent = false;
    } else if (awa !== null) {
      needleRaw = awa;
      fromApparent = true;
    } else {
      fromApparent = false;
    }
  }
  const needle = needleRaw === null ? null : normalizeDeg(needleRaw);

  // Rose relative : graduations tous les 30° de 60° à la poupe, chaque
  // bord (le secteur 0-50° est marqué par les wedges) ; 90/180 majeurs.
  const ticks: { angle: number; major: boolean }[] = [];
  for (let a = 60; a <= 180; a += 30) {
    const angles = a === 180 ? [180] : [a, 360 - a];
    for (const angle of angles) {
      ticks.push({ angle, major: a === 90 || a === 180 });
    }
  }

  // Aiguille fine façon Raymarine (#180 retour n°7) : tête étroite à la
  // pointe, tige courte qui s'arrête au bord du bateau.
  const tip = needle === null ? null : polarToXY(CX, CY, R - 14, needle);
  const headBaseA = needle === null ? null : polarToXY(CX, CY, R - 30, needle + 4);
  const headBaseB = needle === null ? null : polarToXY(CX, CY, R - 30, needle - 4);
  const shaftStart = needle === null ? null : polarToXY(CX, CY, 34, needle);
  const shaftEnd = needle === null ? null : polarToXY(CX, CY, R - 28, needle);

  return (
    <svg
      className="wind-dial"
      viewBox="0 0 200 200"
      width={fill ? '100%' : size}
      height={fill ? '100%' : size}
      role="img"
      aria-label={
        needle === null
          ? twd === null
            ? 'Wind dial, no wind data'
            : 'Wind dial, no wind angle data'
          : `${fromApparent ? 'Apparent' : 'True'} wind ${Math.round(
              needle
            )} degrees relative to the bow, ${twsKts?.toFixed(0) ?? '--'} knots`
      }
    >
      {/* Virole pleine : fond marin, contour — comme le compas HELM */}
      <circle cx={CX} cy={CY} r={R} className="wind-dial-virole" />

      {/* Wedges 0-50° : rouge bâbord / vert tribord (maquette v4) */}
      <path d={wedgePath(-WEDGE_HALF, 0)} className="wind-wedge-port" data-testid="wind-wedge-port" />
      <path d={wedgePath(0, WEDGE_HALF)} className="wind-wedge-starboard" data-testid="wind-wedge-starboard" />

      {ticks.map((t) => {
        const outer = polarToXY(CX, CY, R - 8, t.angle);
        const inner = polarToXY(CX, CY, R - 8 - (t.major ? 8 : 5), t.angle);
        return (
          <line
            key={t.angle}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            className={t.major ? 'wind-tick wind-tick-major' : 'wind-tick'}
          />
        );
      })}

      {/* Chiffres relatifs façon Raymarine : 30/60/90/120 chaque bord */}
      {([30, 60, 90, 120] as const).flatMap((a) =>
        ([a, 360 - a] as const).map((angle) => {
          const p = polarToXY(CX, CY, R - 26, angle);
          return (
            <text
              key={angle}
              x={p.x}
              y={p.y + 4}
              textAnchor="middle"
              className="wind-cardinal"
            >
              {a}
            </text>
          );
        })
      )}
      {/* 180 à la poupe */}
      <text
        x={polarToXY(CX, CY, R - 26, 180).x}
        y={polarToXY(CX, CY, R - 26, 180).y + 4}
        textAnchor="middle"
        className="wind-cardinal"
      >
        180
      </text>

      {/* Aiguille : angle du vent par rapport à la proue */}
      {needle !== null &&
        tip !== null &&
        headBaseA !== null &&
        headBaseB !== null &&
        shaftStart !== null &&
        shaftEnd !== null && (
          <g className="wind-needle" data-testid="wind-arrow">
            <line x1={shaftStart.x} y1={shaftStart.y} x2={shaftEnd.x} y2={shaftEnd.y} />
            <polygon
              points={`${tip.x},${tip.y} ${headBaseA.x},${headBaseA.y} ${headBaseB.x},${headBaseB.y}`}
            />
          </g>
        )}

      {/* Silhouette du bateau, proue vers le haut — la rose EST le bateau */}
      <polygon
        points={`${CX},${CY - 30} ${CX - 9},${CY + 20} ${CX},${CY + 12} ${CX + 9},${CY + 20}`}
        className="wind-boat"
      />

      {/* Vignette TWD ÉTIQUETÉE : l'angle compas du vent vrai reste
          disponible, sans ambiguïté (retour Dom « le 135 ? »). */}
      {twd !== null && (
        <>
          <text x={CX} y={CY - 52} textAnchor="middle" className="wind-dial-twd-label">
            TWD
          </text>
          <text
            x={CX}
            y={CY - 40}
            textAnchor="middle"
            className="wind-dial-twd"
            data-testid="wind-dial-twd"
          >
            {`${Math.round(twd)}°`}
          </text>
        </>
      )}
      <rect x={CX - 34} y={CY + 28} width={68} height={28} rx={6} className="wind-dial-box" />
      <text x={CX} y={CY + 48} textAnchor="middle" className="wind-dial-tws">
        {twsKts === null ? '--' : `${twsKts.toFixed(0)} kt`}
      </text>

      {/* Sans angle de vent NI TWD : message DANS le cadran, en bas
          (retour terrain Dom, image 2). Si seul l'angle manque, le
          cadran affiche TWD + TWS sans aiguille — pas de message. */}
      {needle === null && twd === null && (
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
