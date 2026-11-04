import React, { useState } from 'react';
import type { NavigationData } from '../../types';
import { setUiMode } from '../../utils/instrumentMode';
import type { UiMode } from '../../utils/instrumentMode';
import CoastalPanel from './CoastalPanel';
import HelmPanel from './HelmPanel';
import OverviewPanel from './OverviewPanel';

/** Commutateur des modes d'instruments (refonte instruments, Phase 2 — #160) :
 * HELM / COASTAL / OVERVIEW en onglets, panneau choisi rendu, mode persisté
 * (localStorage mynav:ui-mode) — l'app ouvre la stack via getUiMode(). */

interface InstrumentModesPanelProps {
  data: NavigationData;
  initialMode: UiMode;
}

const MODES: { id: UiMode; label: string }[] = [
  { id: 'helm', label: 'HELM' },
  { id: 'coastal', label: 'COASTAL' },
  { id: 'overview', label: 'OVERVIEW' }
];

const InstrumentModesPanel: React.FC<InstrumentModesPanelProps> = ({
  data,
  initialMode
}) => {
  const [mode, setMode] = useState<UiMode>(initialMode);

  const selectMode = (next: UiMode) => {
    setMode(next);
    setUiMode(next); // persistance entre sessions
  };

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
      {mode === 'helm' && <HelmPanel data={data} />}
      {mode === 'coastal' && <CoastalPanel data={data} />}
      {mode === 'overview' && <OverviewPanel data={data} />}
    </div>
  );
};

export default InstrumentModesPanel;
