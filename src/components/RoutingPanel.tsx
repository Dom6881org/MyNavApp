import React, { useEffect, useState } from 'react';
import { Position } from '../types';
import { useRoutingInput } from '../hooks/useRoutingInput';

interface RoutingPanelProps {
  currentPosition: Position | null;
  pickedPosition: Position | null;
  pickActive: boolean;
  onRequestPick: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '7.5rem',
  padding: '0.25rem 0.4rem',
  borderRadius: '4px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)'
};

const errorStyle: React.CSSProperties = {
  color: '#ff9f43',
  fontSize: '0.78rem',
  margin: '0.15rem 0'
};

const okStyle: React.CSSProperties = {
  color: '#19d3c5',
  fontSize: '0.82rem',
  margin: '0.4rem 0 0'
};

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  right: '1rem',
  bottom: '4rem',
  zIndex: 1200,
  width: '19rem',
  maxHeight: '70vh',
  overflowY: 'auto',
  padding: '0.9rem 1rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)'
};

const toggleStyle: React.CSSProperties = {
  position: 'fixed',
  right: '1rem',
  bottom: '1rem',
  zIndex: 1200,
  padding: '0.45rem 0.7rem',
  borderRadius: '6px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: '1rem'
};

/**
 * Panneau de saisie du plan de routage (issue #15) :
 * départ (position courante ou manuelle), arrivée (coordonnées ou clic carte),
 * polaire du bateau, avec validation en direct.
 */
const RoutingPanel: React.FC<RoutingPanelProps> = ({
  currentPosition,
  pickedPosition,
  pickActive,
  onRequestPick
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const routing = useRoutingInput(currentPosition);
  const { setFinishFromPosition } = routing;

  useEffect(() => {
    if (pickedPosition) setFinishFromPosition(pickedPosition);
  }, [pickedPosition, setFinishFromPosition]);

  if (!isOpen) {
    return (
      <button
        type="button"
        style={toggleStyle}
        onClick={() => setIsOpen(true)}
        aria-label="Ouvrir le panneau de routage"
        title="Routage"
      >
        🧭 Routage
      </button>
    );
  }

  const coordinateRow = (
    label: string,
    values: { latitude: string; longitude: string },
    onChange: (next: { latitude: string; longitude: string }) => void,
    disabled: boolean
  ) => (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', margin: '0.25rem 0' }}>
      <span style={{ minWidth: '3.4rem', fontSize: '0.8rem' }}>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        style={inputStyle}
        disabled={disabled}
        value={values.latitude}
        placeholder="lat"
        aria-label={label + ' latitude'}
        onChange={event => onChange({ ...values, latitude: event.target.value })}
      />
      <input
        type="text"
        inputMode="decimal"
        style={inputStyle}
        disabled={disabled}
        value={values.longitude}
        placeholder="lon"
        aria-label={label + ' longitude'}
        onChange={event => onChange({ ...values, longitude: event.target.value })}
      />
    </div>
  );

  const polarName = routing.polars.find(polar => polar.id === routing.polarId)?.name ?? routing.polarId ?? '';

  return (
    <>
      <button
        type="button"
        style={toggleStyle}
        onClick={() => setIsOpen(false)}
        aria-label="Fermer le panneau de routage"
        title="Fermer"
      >
        🧭 ✕
      </button>
      <section style={panelStyle} aria-label="Saisie du plan de routage">
        <strong style={{ display: 'block', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
          ROUTAGE
        </strong>

        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '0.3rem 0' }}>
          <input
            type="checkbox"
            checked={routing.useCurrentPosition}
            onChange={event => routing.setUseCurrentPosition(event.target.checked)}
          />
          <span style={{ fontSize: '0.85rem' }}>Départ = position courante</span>
        </label>

        {coordinateRow('Départ', routing.startText, routing.setStartText, routing.useCurrentPosition)}

        {coordinateRow('Arrivée', routing.finishText, routing.setFinishText, false)}
        <button
          type="button"
          style={{
            padding: '0.25rem 0.55rem',
            marginTop: '0.2rem',
            borderRadius: '4px',
            border: pickActive ? '1px solid #19d3c5' : '1px solid var(--border-color)',
            background: pickActive ? 'rgba(25, 211, 197, 0.15)' : 'var(--bg-primary)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '0.8rem'
          }}
          onClick={onRequestPick}
        >
          {pickActive ? 'Cliquez sur la carte…' : "Choisir l'arrivée sur la carte"}
        </button>

        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', margin: '0.55rem 0' }}>
          <span style={{ fontSize: '0.8rem' }}>Polaire</span>
          <select
            style={{ ...inputStyle, flex: 1 }}
            value={routing.polarId ?? ''}
            onChange={event => routing.setPolarId(event.target.value || null)}
          >
            {routing.polars.map(polar => (
              <option key={polar.id} value={polar.id}>{polar.name}</option>
            ))}
          </select>
        </label>

        {routing.polarError && <span style={errorStyle}>{routing.polarError}</span>}
        {routing.errors.start && <span style={errorStyle}>{routing.errors.start}</span>}
        {routing.errors.finish && <span style={errorStyle}>{routing.errors.finish}</span>}
        {routing.errors.same && <span style={errorStyle}>{routing.errors.same}</span>}
        {routing.errors.polar && <span style={errorStyle}>{routing.errors.polar}</span>}

        {routing.plan && routing.distanceNm !== null && (
          <p style={okStyle}>
            Plan prêt · {routing.distanceNm.toFixed(1)} MN · {polarName}
          </p>
        )}
        {routing.plan && (
          <p style={{ fontSize: '0.72rem', margin: '0.15rem 0 0', opacity: 0.75 }}>
            Le calcul de route arrive avec l'affichage carte (#17).
          </p>
        )}
      </section>
    </>
  );
};

export default RoutingPanel;
