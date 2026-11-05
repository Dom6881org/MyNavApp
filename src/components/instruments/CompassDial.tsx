import React from 'react';
import {
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
 * cardinaux CONTRE-ROTÉS (toujours à l'endroit sous les yeux), proue et
 * lubber ROUGES. Couleurs d'affichage marines fixes (comme WindDial).
 *
 * #182 retour n°14 : même traitement que le vent — le cadran est un
 * GRAPHIQUE PUR (plus de COG/HDG embarqués dans le SVG) ; les valeurs
 * digitales s'affichent dessous dans HelmPanel (`.helm-readout`, même
 * style que TWS/AWS/TWA/AWA du vent).
 *
 * ⚠️ Classe .compass-courseup (PAS .compass-dial) : App.css garde une
 * règle legacy .compass-dial { height: 96px; width: min(100%, 210px) }
 * qui écrasait ce cadran à ~96 px — c'est ainsi que le compas central
 * HELM restait minuscule depuis la Phase 1 (#180). */

interface CompassDialProps {
  /** Cap sur le fond (COG) — pilote la rotation de la rose. */
  cog: number | null;
  /** Cap compas (HDG) — n'affiche plus rien dans le cadran (readouts
   * digitaux dessous), conservé pour l'aria-label. */
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
   * #182 retour n°15 : fidélité à la maquette — les cardinaux sont
   * POURTOUT de la rose (rayon ~97, entre rose 88 et virole 104),
   * pas au centre du cadran. */
  const cardinal = (angle: number, label: string, highlight: boolean) => {
    const p = polarToXY(CX, CY, 97, angle);
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
      viewBox="0 0 220 232"
      width={fill ? '100%' : size}
      height={fill ? '100%' : (size * 232) / 220}
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
      </g>

      {/* Proue fixe + lubber rouge : le cap est TOUJOURS ici */}
      <line x1={CX} y1={CY - 96} x2={CX} y2={CY - 72} className="compass-lubber" />
      <polygon
        points={`${CX},${CY - R_OUTER} ${CX - 7},${CY - R_ROSE} ${CX + 7},${CY - R_ROSE}`}
        className="compass-boat"
      />
    </svg>
  );
};

export default CompassDial;
