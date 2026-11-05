import React from 'react';
import type { ReactNode } from 'react';

export interface ReadoutRow {
  /** Label de la ligne (ex. COG, STW, LOCAL). */
  label: string;
  /** Classe de couleur du label (lbl-cog, lbl-hdg, lbl-stw, lbl-sog,
   * lbl-max, lbl-depth, lbl-gps — palette legacy). */
  labelClass?: string;
  /** Classe additionnelle de la ligne (ex. gps — teinte la valeur). */
  rowClass?: string;
  /** Valeur principale, alignée à droite. */
  value: string;
  /** Unité accolée à la valeur (ex. kn, m, °C). */
  unit?: string;
  /** Ligne secondaire : police plus petite (ex. MAX, TEMP, GPS). */
  secondary?: boolean;
  /** Contenu additionnel après la valeur (bouton RESET). */
  extra?: ReactNode;
}

/** Vue numérique CADRÉE (#184, retour n°21-quater — maquette validée).
 *
 * Même philosophie pour tous les instruments du central HELM : cadre
 * intérieur, lignes réparties, label à GAUCHE (code couleur legacy :
 * COG/SOG cyan, HDG/STW ambre, MAX rouge, DEPTH/GPS vert), valeur
 * alignée à DROITE, séparateurs discrets. Compas : COG/HDG ; vitesse :
 * STW/SOG/MAX (+ RESET) ; heure : locale/TU ; profondeur : DEPTH/TEMP ;
 * position : LAT/LON/GPS (qualité du signal). */
const FramedReadouts: React.FC<{ rows: ReadoutRow[]; 'data-testid'?: string }> = ({
  rows,
  'data-testid': testid
}) => (
  <div className="helm-frame" data-testid={testid}>
    {rows.map((row) => (
      <div
        key={row.label}
        className={`helm-frame-row${row.secondary ? ' secondary' : ''}${row.rowClass ? ` ${row.rowClass}` : ''}`}
      >
        <span className={`helm-frame-lbl ${row.labelClass ?? ''}`}>{row.label}</span>
        <span className="helm-frame-val">
          {row.value}
          {row.unit && <small>{row.unit}</small>}
          {row.extra}
        </span>
      </div>
    ))}
  </div>
);

export default FramedReadouts;
