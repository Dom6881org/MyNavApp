import React, { useState } from 'react';
import type { ReactNode } from 'react';
import type { InstrumentMode } from '../../utils/instrumentPrimitives';
import { readInstrumentMode, writeInstrumentMode } from '../../utils/instrumentMode';

/** Carte d'instrument générique (refonte instruments, Phase 0 — #156).
 *
 * Fournit le cadre commun des futures cartes HELM/COASTAL/OVERVIEW :
 * titre, bascule cadran ⇄ numérique INDÉPENDANTE par instrument (bouton
 * 123/◉ du design revue 2), contenu libre via children.
 * Les modes suivants (persistance, panneau HELM) s'appuieront sur elle. */

interface InstrumentCardProps {
  title: string;
  children: ReactNode;
  defaultMode?: InstrumentMode;
  /** Contenu optionnel en zone info (ex. badge de source). */
  info?: ReactNode;
  /** Cache le bouton 123/◉ : pour un instrument sans cadran possible
   * (ex. DEPTH — finalisation #166). */
  hideToggle?: boolean;
  /** Mode CONTRÔLÉ (#184) : quand fourni, le bouton reflète ce mode et
   * le clic remonte au parent via onModeChange (pas de state interne,
   * pas de persistance — le central HELM pilote tout son affichage). */
  mode?: InstrumentMode;
  onModeChange?: (mode: InstrumentMode) => void;
  /** Bouton 123/◉ visible mais DÉSACTIVÉ (#184) : instrument dont le
   * cadran n'existe pas encore (TIME/POSITION/SOG/DEPTH en central). */
  toggleDisabled?: boolean;
}

const InstrumentCard: React.FC<InstrumentCardProps> = ({
  title,
  children,
  defaultMode = 'dial',
  info = null,
  hideToggle = false,
  mode,
  onModeChange,
  toggleDisabled = false
}) => {
  const [internalMode, setInternalMode] = useState<InstrumentMode>(() =>
    // Persistance par instrument (Phase 2 #160) : la préférence 123/◉ de
    // chaque carte survit aux rechargements ; defaultMode = repli.
    readInstrumentMode(title, defaultMode)
  );
  // #184 : mode contrôlé (ex. central HELM) — le parent est la source
  // de vérité, le bouton ne fait que remonter l'intention.
  const controlled = mode !== undefined;
  const currentMode = controlled ? mode : internalMode;

  const toggleMode = () => {
    const next: InstrumentMode = currentMode === 'dial' ? 'numeric' : 'dial';
    if (controlled) {
      onModeChange?.(next);
      return;
    }
    setInternalMode(next);
    writeInstrumentMode(title, next);
  };

  return (
    <div className="instrument-card" data-testid={`instrument-${title}`}>
      <div className="instrument-card-header">
        <span className="instrument-title">{title}</span>
        <span className="instrument-card-info">{info}</span>
        {!hideToggle && (
          <button
            type="button"
            className="instrument-mode-toggle"
            aria-label={`${title} display mode`}
            data-mode={currentMode}
            disabled={toggleDisabled}
            onClick={toggleMode}
          >
            {currentMode === 'dial' ? '123' : '◉'}
          </button>
        )}
      </div>
      <div className="instrument-card-body" data-testid="instrument-card-body">
        {children}
      </div>
    </div>
  );
};

export default InstrumentCard;
