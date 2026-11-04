import React, { useState } from 'react';
import type { NavigationData } from '../../types';
import { setUiMode } from '../../utils/instrumentMode';
import type { UiMode } from '../../utils/instrumentMode';
import type { RoutingInput } from '../../hooks/useRoutingInput';
import type { RoutingRouteApi } from '../../hooks/useRoutingRoute';
import type { GribApi } from '../../hooks/useGrib';
import CoastalPanel from './CoastalPanel';
import HelmPanel from './HelmPanel';
import OverviewPanel from './OverviewPanel';
import PrepRoutingPanel from './PrepRoutingPanel';

/** Commutateur des modes d'instruments (refonte instruments, Phase 2 — #160,
 * Phase 3 — #162) : HELM / COASTAL / OVERVIEW / PREP ROUTING en onglets,
 * panneau choisi rendu, mode persisté (localStorage mynav:ui-mode). Les
 * props de routage alimentent l'onglet PREP (optionnelles : sans routage,
 * l'onglet affiche une invite). */

interface InstrumentModesPanelProps {
  data: NavigationData;
  initialMode: UiMode;
  routing?: RoutingInput;
  routingPickTarget?: 'start' | 'finish' | null;
  onRequestRoutingPick?: (target: 'start' | 'finish') => void;
  routeCalc?: RoutingRouteApi;
  onComputeRoute?: () => void;
  gribCalc?: GribApi;
}

const MODES: { id: UiMode; label: string }[] = [
  { id: 'helm', label: 'HELM' },
  { id: 'coastal', label: 'COASTAL' },
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'prep', label: 'PREP' }
];

const InstrumentModesPanel: React.FC<InstrumentModesPanelProps> = ({
  data,
  initialMode,
  routing,
  routingPickTarget = null,
  onRequestRoutingPick,
  routeCalc,
  onComputeRoute,
  gribCalc
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
      {mode === 'prep' && (routing && onRequestRoutingPick ? (
        <PrepRoutingPanel
          routing={routing}
          pickTarget={routingPickTarget}
          onRequestPick={onRequestRoutingPick}
          routeCalc={routeCalc}
          onComputeRoute={onComputeRoute}
          gribCalc={gribCalc}
        />
      ) : (
        <p className="prep-routing-empty" data-testid="prep-unavailable">
          Routing unavailable in this mode.
        </p>
      ))}
    </div>
  );
};

export default InstrumentModesPanel;
