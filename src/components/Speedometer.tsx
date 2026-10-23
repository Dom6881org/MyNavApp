import React from 'react';
import { SpeedData } from '../types';

interface SpeedometerProps {
  data: SpeedData | null;
  size?: number;
}

const Speedometer: React.FC<SpeedometerProps> = ({ data, size = 200 }) => {
  const displaySTW = data?.stw ?? data?.sog ?? data?.speed ?? 0;
  const displaySOG = data?.sog ?? data?.speed ?? 0;
  const progress = Math.min(displaySTW / 20, 1) * 100;

  return (
    <div className="instrument speedometer speed-instrument" style={{ '--speed-size': `${size}px` } as React.CSSProperties}>
      <svg className="speed-gauge" viewBox="0 0 180 104" role="img" aria-label={`Speed ${displaySTW.toFixed(1)} knots`}>
        <path className="speed-gauge-track" d="M 18 92 A 72 72 0 0 1 162 92" pathLength="100" />
        <path className="speed-gauge-value" d="M 18 92 A 72 72 0 0 1 162 92" pathLength="100" style={{ strokeDasharray: `${progress} 100` }} />
        <text className="speed-gauge-mark" x="14" y="104">0</text>
        <text className="speed-gauge-mark" x="151" y="104">20</text>
      </svg>
      <div className="speed-primary-reading">
        <strong>{displaySTW.toFixed(1)}</strong>
        <span>kn</span>
      </div>
      <div className="speed-secondary-reading">
        <span>STW</span>
        <strong>{displaySTW.toFixed(1)} <small>kn</small></strong>
        <span className="speed-reading-divider" />
        <span>SOG</span>
        <strong>{displaySOG.toFixed(1)} <small>kn</small></strong>
      </div>
    </div>
  );
};

export default Speedometer;
