import React from 'react';
import type { WindNeedleMode } from '../../utils/instrumentMode';

/** Switch segmenté APPARENT | VRAI du cadran vent (#188 — l'équivalent
 * du bouton True/App des instruments Raymarine fournis en exemple).
 *
 * Vivant dans le HEADER des cartes vent (pattern #184 : jamais sur le
 * cadran), à gauche du titre. L'état est PERSISTÉ et PARTAGÉ par les
 * trois placements (HELM central, COASTAL, rangée basse) — un seul
 * choix de lecture du vent, cohérent partout (mynav:wind-needle). */

interface WindNeedleSwitchProps {
  mode: WindNeedleMode;
  onChange: (mode: WindNeedleMode) => void;
  /** data-testid distinct par placement (helm-/coastal-/bottom-). */
  testId: string;
}

const LABELS: Record<WindNeedleMode, string> = {
  apparent: 'APPARENT',
  true: 'VRAI'
};

const WindNeedleSwitch: React.FC<WindNeedleSwitchProps> = ({ mode, onChange, testId }) => (
  <div
    className="helm-mode-switch"
    role="group"
    aria-label="Vent affiché sur le cadran"
    data-testid={testId}
  >
    {(['apparent', 'true'] as WindNeedleMode[]).map((m) => (
      <button
        key={m}
        type="button"
        className={`helm-switch-btn${m === mode ? ' active' : ''}`}
        aria-pressed={m === mode}
        onClick={() => onChange(m)}
      >
        {LABELS[m]}
      </button>
    ))}
  </div>
);

export default WindNeedleSwitch;
