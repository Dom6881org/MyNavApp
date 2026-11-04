import React from 'react';
import useMotionSensors from '../hooks/useMotionSensors';

// Carte MOTION (issue #152) : gîte, tangage et période de roulis depuis les
// capteurs de la tablette de cockpit. 100 % front, aucune donnée serveur.

const formatSignedDegrees = (value: number | null): string =>
  value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}°`;

const heelSide = (heel: number | null): string => {
  if (heel === null || Math.abs(heel) < 0.5) return '—';
  return heel > 0 ? 'STBD' : 'PORT';
};

const MotionPanel: React.FC = () => {
  const { motionAvailable, heel, pitch, rollPeriod } = useMotionSensors();

  return (
    <div className="motion-panel" role="group" aria-label="Boat motion from tablet sensors">
      <div className="instrument-card-header">
        <span className="instrument-title">MOTION</span>
        {!motionAvailable && (
          <span className="motion-unavailable" role="status">no sensors</span>
        )}
      </div>
      {motionAvailable ? (
        <div className="motion-rows">
          <div className="motion-row">
            <span>HEEL</span>
            <strong>{formatSignedDegrees(heel)}</strong>
            <small>{heelSide(heel)}</small>
          </div>
          <div className="motion-row">
            <span>PITCH</span>
            <strong>{formatSignedDegrees(pitch)}</strong>
            <small />
          </div>
          <div className="motion-row">
            <span>ROLL</span>
            <strong>{rollPeriod === null ? '—' : `${rollPeriod.toFixed(1)} s`}</strong>
            <small>period</small>
          </div>
        </div>
      ) : (
        <div className="motion-hint">no motion sensors on this device · tablet required</div>
      )}
    </div>
  );
};

export default MotionPanel;
