import React, { useState } from 'react';
import type { ReactNode } from 'react';
import type { InstrumentMode } from '../../utils/instrumentPrimitives';
import { readInstrumentMode, writeInstrumentMode } from '../../utils/instrumentMode';

/** Carte d'instrument générique (refonte instruments, Phase 0 — #156).
 *
 * Fournit le cadre commun des cartes HELM/COASTAL/OVERVIEW : titre,
 * bascule cadran ⇄ numérique INDÉPENDANTE par instrument (bouton
 * 123/◉ du design revue 2), contenu libre via children.
 *
 * #184 retour n°21-quater : le central HELM ne réutilise plus le
 * bouton 123/◉ — il rend son propre switch SEGMENTÉ (CADRAN / 1/2
 * CADRAN / NUMÉRIQUE selon l'instrument) via `headerPrefix`, placé
 * à gauche du titre (maquette validée). Pour cela il passe
 * `hideToggle`. Les props mode/onModeChange/toggleDisabled du
 * retour n°21 v1 sont retirées (remplacées par headerPrefix). */

interface InstrumentCardProps {
  title: string;
  children: ReactNode;
  defaultMode?: InstrumentMode;
  /** Contenu optionnel en zone info (ex. badge de source). */
  info?: ReactNode;
  /** Cache le bouton 123/◉ : pour un instrument sans cadran possible
   * (ex. DEPTH — finalisation #166) ou dont le parent fournit son
   * propre switch (central HELM #184). */
  hideToggle?: boolean;
  /** Contenu optionnel en tête du header, AVANT le titre (ex. switch
   * segmenté du central HELM — #184 retour n°21-quater). */
  headerPrefix?: ReactNode;
}

const InstrumentCard: React.FC<InstrumentCardProps> = ({
  title,
  children,
  defaultMode = 'dial',
  info = null,
  hideToggle = false,
  headerPrefix = null
}) => {
  const [internalMode, setInternalMode] = useState<InstrumentMode>(() =>
    // Persistance par instrument (Phase 2 #160) : la préférence 123/◉ de
    // chaque carte survit aux rechargements ; defaultMode = repli.
    readInstrumentMode(title, defaultMode)
  );

  const toggleMode = () => {
    const next: InstrumentMode = internalMode === 'dial' ? 'numeric' : 'dial';
    setInternalMode(next);
    writeInstrumentMode(title, next);
  };

  return (
    <div className="instrument-card" data-testid={`instrument-${title}`}>
      <div className="instrument-card-header">
        {headerPrefix}
        <span className="instrument-title">{title}</span>
        <span className="instrument-card-info">{info}</span>
        {!hideToggle && (
          <button
            type="button"
            className="instrument-mode-toggle"
            aria-label={`${title} display mode`}
            data-mode={internalMode}
            onClick={toggleMode}
          >
            {internalMode === 'dial' ? '123' : '◉'}
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
