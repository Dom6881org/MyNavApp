import React from 'react';
import { normalizeDeg } from '../../utils/instrumentPrimitives';

/** Demi-cadran compas « legacy » (#184, retour n°21-quater de Dom) —
 * extraction du dial de Compass.tsx SANS son bouton interne ni
 * useDisplayMode : le panneau HELM pilote le format (switch CADRAN /
 * 1/2 CADRAN / NUMÉRIQUE), ce composant ne rend QUE le demi-cadran.
 *
 * Géométrie legacy fidèle (Compass.tsx) : viewBox 0 0 180 94, anneau
 * cx=90 cy=90 r=78, 36 graduations tous les 10° (majeures %3), rose
 * tournée de -COG autour de (90,90) — le cap reste sous l'aiguille
 * cyan FIXE — cardinaux N/E/S/W, valeur du cap superposée (~62 % de
 * la hauteur), HDG/COG en secondaires dessous.
 *
 * ⚠️ Classes .compass-half-* DÉDIÉES (pas .compass-dial ni
 * .compass-cardinal) : App.css garde `.compass-dial { height: 96px }`
 * (écrasait le cadran à ~96 px — leçon Phase 1) et
 * `.compass-cardinal { position: absolute; top: 15%; left: 50% }`
 * (arrachait les lettres de leurs coordonnées SVG, leçon #180). */

interface CompassHalfDialProps {
  /** Cap sur le fond (COG) — pilote la rotation de la rose. */
  cog: number | null;
  /** Cap compas (HDG) — affiché en lecture secondaire. */
  heading?: number | null;
  /** Le demi-cadran occupe tout l'espace disponible de son conteneur
   * (comme CompassDial/WindDial) au lieu d'une largeur fixe. */
  fill?: boolean;
  /** Largeur en pixels quand fill = false (défaut legacy 210 px). */
  size?: number;
}

const CompassHalfDial: React.FC<CompassHalfDialProps> = ({
  cog,
  heading = null,
  fill = false,
  size = 210
}) => {
  // Legacy Compass.tsx : course = cog ?? heading ?? 0
  const course = cog ?? heading ?? 0;
  const courseText = cog === null && heading === null ? '--' : `${Math.round(course)}°`;
  const cogText = cog === null ? '--' : `${Math.round(normalizeDeg(cog))}°`;
  const hdgText = heading === null ? '--' : `${Math.round(normalizeDeg(heading))}°`;

  return (
    <div
      className="compass-half"
      style={fill ? undefined : { width: `${size}px` }}
      data-testid="compass-half"
    >
      <div className="compass-half-stage">
        <svg className="compass-half-svg" viewBox="0 0 180 94" aria-hidden="true">
          {/* Rotation par ATTRIBUT SVG (pas CSS) : transform-origin CSS
              ne s'applique pas, rotate(θ cx cy) est autonome. */}
          <g className="compass-half-rose" transform={`rotate(${-course} 90 90)`}>
            <circle className="compass-half-ring" cx="90" cy="90" r="78" />
            {Array.from({ length: 36 }, (_, index) => (
              <line
                key={index}
                className={
                  index % 3 === 0
                    ? 'compass-half-tick compass-half-tick-major'
                    : 'compass-half-tick'
                }
                x1="90"
                y1="12"
                x2="90"
                y2={index % 3 === 0 ? '23' : '18'}
                transform={`rotate(${index * 10} 90 90)`}
              />
            ))}
            <text className="compass-half-cardinal" x="90" y="34">N</text>
            <text className="compass-half-cardinal" x="136" y="94">E</text>
            <text className="compass-half-cardinal" x="90" y="174">S</text>
            <text className="compass-half-cardinal" x="44" y="94">W</text>
          </g>
          {/* Aiguille cyan FIXE : le cap du bateau reste toujours en haut */}
          <path className="compass-half-needle" d="M90 8 L96 23 L90 19 L84 23 Z" />
        </svg>
        <span className="compass-half-value" data-testid="compass-half-value">
          {courseText}
        </span>
      </div>
      {/* Lectures secondaires (jumelage HDG/COG conservé) */}
      <div className="compass-half-readings" data-testid="compass-half-readings">
        <div>
          <span>HDG</span>
          <strong>{hdgText}</strong>
        </div>
        <div>
          <span>COG</span>
          <strong>{cogText}</strong>
        </div>
      </div>
    </div>
  );
};

export default CompassHalfDial;
