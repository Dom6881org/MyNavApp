import React, { useEffect, useRef, useState } from 'react';
import type { NavigationData } from '../../types';
import { setUiMode } from '../../utils/instrumentMode';
import type { UiMode } from '../../utils/instrumentMode';
import type { RoutingInput } from '../../hooks/useRoutingInput';
import type { RoutingRouteApi } from '../../hooks/useRoutingRoute';
import type { GribApi } from '../../hooks/useGrib';
import { decideAutoMode, readAutoSwitch, writeAutoSwitch } from '../../utils/autoMode';
import CoastalPanel from './CoastalPanel';
import HelmPanel from './HelmPanel';
import OverviewPanel from './OverviewPanel';
import PrepRoutingPanel from './PrepRoutingPanel';

/** Commutateur des modes d'instruments (refonte instruments, Phase 2 — #160,
 * Phase 3 — #162) : HELM / COASTAL / OVERVIEW / PREP ROUTING en onglets,
 * panneau choisi rendu, mode persisté (localStorage mynav:ui-mode). Les
 * props de routage alimentent l'onglet PREP (optionnelles : sans routage,
 * l'onglet affiche une invite).
 *
 * Phase 4 — #164 : auto-switch vers COASTAL à l'activation de l'alarme
 * profondeur, opt-in « AUTO » persisté (mynav:ui-auto, désactivé par
 * défaut), pas de retour arrière automatique. */

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
  const [autoSwitch, setAutoSwitch] = useState<boolean>(() => readAutoSwitch());
  const [autoNotice, setAutoNotice] = useState<string | null>(null);

  const selectMode = (next: UiMode) => {
    setMode(next);
    setAutoNotice(null); // reprise en main : l'avis auto se retire
    setUiMode(next); // persistance entre sessions
  };

  const toggleAutoSwitch = () => {
    setAutoSwitch(value => {
      const next = !value;
      writeAutoSwitch(next); // persistance entre sessions
      return next;
    });
  };

  // Phase 4 (#164) : alarme profondeur -> COASTAL, sans ping-pong (uniquement
  // a l'activation, jamais de retour arriere automatique).
  const depthAlarm = data.depth?.alarm ?? false;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => {
    const forced = decideAutoMode(modeRef.current, depthAlarm, autoSwitch);
    if (forced === null) return;
    setMode(forced);
    setUiMode(forced);
    setAutoNotice('Depth alarm — switched to COASTAL');
  }, [depthAlarm, autoSwitch]);

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
        <button
          type="button"
          className={`helm-switch-btn auto ${autoSwitch ? 'active' : ''}`}
          aria-pressed={autoSwitch}
          aria-label="Auto switch to coastal on depth alarm"
          title="Auto switch to COASTAL on depth alarm"
          onClick={toggleAutoSwitch}
        >
          AUTO
        </button>
      </div>
      {autoNotice && (
        <p className="instrument-auto-notice" role="status" data-testid="instrument-auto-notice">
          {autoNotice}
        </p>
      )}
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
