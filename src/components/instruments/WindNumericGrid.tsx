import React from 'react';

/** Grille numérique VENT (#188, retours v5) : les QUATRE valeurs TWS /
 * TWA / AWS / AWA de MÊME taille en 2×2 aérée — fini le TWS géant avec
 * trois valeurs tassées dessous (retour Dom n°2). Couleur par bord de
 * vent : ambre = VRAI (TWS/TWA), bleu = APPARENT (AWS/AWA).
 * Partagée par HELM central et COASTAL (colonne VENT).
 * Pas de switch APPARENT|VRAI ici : tout est affiché (retour n°3). */

interface WindNumericGridProps {
  tws: number | null;
  twa: number | null;
  aws: number | null;
  awa: number | null;
  testId: string;
}

const WindNumericGrid: React.FC<WindNumericGridProps> = ({ tws, twa, aws, awa, testId }) => {
  const kt = (value: number | null) => (value === null ? '--' : `${value.toFixed(0)} kt`);
  const deg = (value: number | null) =>
    value === null ? '--' : `${Math.round(Math.abs(value))}°`;

  const cell = (label: string, value: string, side: 'true' | 'apparent') => (
    <span className="helm-wind-cell" key={label}>
      <span className="helm-wind-lbl">{label}</span>
      {/* Couleur du bord : .wind-true (ambre) / .wind-apparent (bleu) */}
      <strong className={`wind-${side}`}>{value}</strong>
    </span>
  );

  return (
    <div className="helm-wind-grid" data-testid={testId}>
      {cell('TWS', kt(tws), 'true')}
      {cell('TWA', deg(twa), 'true')}
      {cell('AWS', kt(aws), 'apparent')}
      {cell('AWA', deg(awa), 'apparent')}
    </div>
  );
};

export default WindNumericGrid;
