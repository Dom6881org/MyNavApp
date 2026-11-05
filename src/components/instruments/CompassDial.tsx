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
 * fixe.
 *
 * Reprise HELM : fidélité à la maquette — double cercle (virole + rose),
 * cardinaux CONTRE-ROTÉS au POURTOUR de la rose (rayon ~97), proue et
 * lubber ROUGES, COG en grand sans unité + label « COG °TRUE », HDG ambre
 * sous le cadran. Couleurs d'affichage marines fixes (comme WindDial).
 *
 * #182 retour n°16 (Dom) : les degrés sur la rose (tous les 30°, sauf aux
 * cardinaux) + les deux valeurs COG/HDG À L'INTÉRIEUR du cadran (les
 * readouts digitaux externes du n°14 sont retirés — retour à la
 * maquette).
 *
 * ⚠️ Classe .compass-point (PAS .compass-cardinal) pour les cardinaux :
 * index.css garde une règle legacy .compass-cardinal { position: absolute;
 * top: 15%; left: 50%; transform: translateX(-50%) } qui ARRACHAIT les
 * lettres de leurs coordonnées SVG et tuait la contre-rotation — depuis
 * #180 les 4 lettres s'empilaient en une griffe illisible au centre du
 * cadran (bug invisible sur captures, la vision hallucinait les lettres —
 * tranché par comptage de pixels, retour n°15). */

interface CompassDialProps {
  /** Cap sur le fond (COG) — pilote la rotation de la rose. */
  cog: number | null;
  /** Cap compas (HDG) — affiché en ambre sous le cadran. */
  heading?: number | null;
  size?: number;
  /** Comme WindDial : le cadran occupe tout l'espace disponible de son
   * conteneur (width/height 100%) au lieu d'une taille fixe. */
  fill?: boolean;
}

const CX = 110;
const CY = 120;
const R_OUTER = 104;
const R_ROSE = 88;

const CompassDial: React.FC<CompassDialProps> = ({
  cog,
  heading = null,
  size = 220,
  fill = false
}) => {
  const roseRotation = cog === null ? 0 : roseRotationDeg(cog);
  const marks = tickMarks(0, 360, 30, 10);

  /** Cardinal tournant (positionné dans la rose) mais contre-roté sur
   * lui-même : les lettres restent droites quelle que soit la rose.
   * #182 retour n°15 : POURTOUR de la rose (rayon ~97, entre rose 88 et
   * virole 104) — façon maquette. */
  const cardinal = (angle: number, label: string, highlight: boolean) => {
    const p = polarToXY(CX, CY, 97, angle);
    return (
      <text
        key={label}
        x={p.x}
        y={p.y + 4}
        textAnchor="middle"
        transform={`rotate(${-roseRotation} ${p.x} ${p.y})`}
        className={highlight ? 'compass-point compass-point-n' : 'compass-point'}
      >
        {label}
      </text>
    );
  };

  /** Degrés tous les 30° sur la rose (retour n°16), sauf aux cardinaux —
   * contre-rotés comme les lettres pour rester lisibles.
   * #182 retours n°17/18 (Dom) : nettement plus petits que le premier
   * essai — rayon 76 (COLLÉS contre les graduations, façon Raymarine)
   * et police 7px : hiérarchie claire (cardinaux 13px ≫ degrés 7px),
   * ils ne dépassent plus sur le cadran. */
  const degLabel = (angle: number) => {
    const p = polarToXY(CX, CY, R_ROSE - 12, angle);
    return (
      <text
        key={`deg-${angle}`}
        x={p.x}
        y={p.y + 3}
        textAnchor="middle"
        transform={`rotate(${-roseRotation} ${p.x} ${p.y})`}
        className="compass-deg"
      >
        {angle}
      </text>
    );
  };

  return (
    <svg
      className="compass-courseup"
      viewBox="0 0 220 248"
      width={fill ? '100%' : size}
      height={fill ? '100%' : (size * 248) / 220}
      role="img"
      aria-label={`Compass course up${cog === null ? '' : `, COG ${Math.round(cog)} degrees`}${
        heading === null ? '' : `, heading ${Math.round(heading)} degrees`
      }`}
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
        {degLabel(30)}
        {degLabel(60)}
        {degLabel(120)}
        {degLabel(150)}
        {degLabel(210)}
        {degLabel(240)}
        {degLabel(300)}
        {degLabel(330)}
      </g>

      {/* Proue fixe + lubber rouge : le cap est TOUJOURS ici */}
      <line x1={CX} y1={CY - 96} x2={CX} y2={CY - 72} className="compass-lubber" />
      <polygon
        points={`${CX},${CY - R_OUTER} ${CX - 7},${CY - R_ROSE} ${CX + 7},${CY - R_ROSE}`}
        className="compass-boat"
      />

      {/* #182 retour n°16 : valeurs À L'INTÉRIEUR du cadran (maquette) —
          COG en grand sans unité, label « COG °TRUE », HDG ambre dessous. */}
      <text x={CX} y={CY + 52} textAnchor="middle" className="compass-cog">
        {cog === null ? '--' : `${Math.round(normalizeDeg(cog))}`}
      </text>
      <text x={CX} y={CY + 74} textAnchor="middle" className="compass-cog-label">
        COG °TRUE
      </text>
      {/* #182 retour n°18 (Dom) : HDG NETTEMENT SOUS le cercle — à y=230
          il chevauchait le bas de la virole (cercle = CY+104 = 224) et
          empiétait sur la rosace. Baseline 242 : le texte (top ~231)
          flotte sous le cercle, plus rien ne touche la rosace. */}
      <text x={CX} y={242} textAnchor="middle" className="compass-hdg">
        {heading === null ? 'HDG --' : `HDG ${Math.round(normalizeDeg(heading))}°`}
      </text>
    </svg>
  );
};

export default CompassDial;
