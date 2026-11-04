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
}

const InstrumentCard: React.FC<InstrumentCardProps> = ({
  title,
  children,
  defaultMode = 'dial',
  info = null
}) => {
  const [mode, setMode] = useState<InstrumentMode>(() =>
    // Persistance par instrument (Phase 2 #160) : la préférence 123/◉ de
    // chaque carte survit aux rechargements ; defaultMode = repli.
    readInstrumentMode(title, defaultMode)
  );

  const toggleMode = () => {
    setMode((m) => {
      const next: InstrumentMode = m === 'dial' ? 'numeric' : 'dial';
      writeInstrumentMode(title, next);
      return next;
    });
  };

  return (
    <div className="instrument-card" data-testid={`instrument-${title}`}>
      <div className="instrument-card-header">
        <span className="instrument-title">{title}</span>
        <span className="instrument-card-info">{info}</span>
        <button
          type="button"
          className="instrument-mode-toggle"
          aria-label={`${title} display mode`}
          data-mode={mode}
          onClick={toggleMode}
        >
          {mode === 'dial' ? '123' : '◉'}
        </button>
      </div>
      <div className="instrument-card-body" data-testid="instrument-card-body">
        {children}
      </div>
    </div>
  );
};

export default InstrumentCard;
