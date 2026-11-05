import React, { useEffect, useState } from 'react';
import type { NavigationData } from '../../types';
import { setUiMode } from '../../utils/instrumentMode';
import type { UiMode } from '../../utils/instrumentMode';

/** Commutateur des modes d'instruments (refonte instruments, Phase 2 — #160,
 * Phase 3 — #162) : HELM / COASTAL / OVERVIEW / PREP ROUTING en onglets,
 * panneau choisi rendu, mode persisté (localStorage mynav:ui-mode). Les
 * props de routage alimentent l'onglet PREP (optionnelles : sans routage,
 * l'onglet affiche une invite).
 *
 * Phase 4 — #164 : le toggle « AUTO » (auto-switch vers COASTAL sur alarme
 * profondeur) a été RETIRÉ de la barre à la demande de Dom (retour terrain
 * #180) — il sera peut-être réajouté plus tard ; l'utilitaire autoMode.ts
 * et son comportement restent en place et testés.
 *
 * Mise en page v3 (#172) : BARRE DE MODES pleine largeur en haut de
 * l'écran — plus de corps ici : App rend le panneau du mode (HELM /
 * COASTAL plein écran, OVERVIEW/ROUTING = tuiles + carte, le routing
 * complet dans le cartouche). `onModeChange` remonte le mode actif. */

interface InstrumentModesPanelProps {
  data: NavigationData;
  initialMode: UiMode;
  onModeChange?: (mode: UiMode) => void;
}

const MODES: { id: UiMode; label: string }[] = [
  { id: 'helm', label: 'HELM' },
  { id: 'coastal', label: 'COASTAL' },
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'prep', label: 'ROUTING' }
];

// `data` reste dans l'interface (l'auto-switch profondeur le réutilisera
// s'il revient) mais n'est plus déstructuré : ESLint échoue la CI sur une
// prop non lue.
const InstrumentModesPanel: React.FC<InstrumentModesPanelProps> = ({
  initialMode,
  onModeChange
}) => {
  const [mode, setMode] = useState<UiMode>(initialMode);

  const selectMode = (next: UiMode) => {
    setMode(next);
    setUiMode(next); // persistance entre sessions
  };

  // #170 : App a besoin du mode actif pour piloter la carte
  // (masquée en HELM/COASTAL, bandeau tuiles au-dessus en OVERVIEW).
  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  return (
    <div className="instrument-modes-panel">
      <div className="instrument-modes-switch" role="tablist" aria-label="Instruments mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            className={mode === m.id ? 'helm-switch-btn active' : 'helm-switch-btn'}
            onClick={() => selectMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {/* #172 : plus de corps ici — App rend le panneau du mode actif
          (HELM/COASTAL plein écran, OVERVIEW/ROUTING tuiles + carte). */}
    </div>
  );
};

export default InstrumentModesPanel;
