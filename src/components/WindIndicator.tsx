import React from 'react';
import { ApparentWindData } from '../types';

interface WindIndicatorProps {
  data: ApparentWindData | null;
  unit: 'knots' | 'kmh' | 'mph';
  size?: number;
}

const WindIndicator: React.FC<WindIndicatorProps> = ({ data, unit, size = 200 }) => {
  const unitLabel = unit === 'kmh' ? 'km/h' : unit === 'mph' ? 'mph' : 'kn';
  const speed = data
    ? unit === 'kmh'
      ? data.speedKnots * 1.852
      : unit === 'mph'
        ? data.speedKnots * 1.15078
        : data.speedKnots
    : null;

  return (
    <div className="instrument wind-indicator wind-instrument" style={{ '--wind-size': `${size}px` } as React.CSSProperties}>
      <div className="wind-dial" aria-hidden="true">
        <span>N</span><span>E</span><span>S</span><span>W</span>
        <div className="wind-dial-needle" style={{ transform: `rotate(${data?.angleDegrees ?? 0}deg)` }} />
        <div className="wind-dial-center">{data ? `${data.angleDegrees.toFixed(0)}°` : '—'}</div>
      </div>
      <div className="wind-readings">
        <div><span>AWS</span><strong>{speed === null ? '—' : speed.toFixed(1)} <small>{unitLabel}</small></strong></div>
        <div><span>AWA</span><strong>{data ? `${data.angleDegrees.toFixed(0)}°` : '—'}</strong></div>
        <span className="instrument-reading-secondary">{data ? 'Onboard anemometer' : 'No anemometer data'}</span>
      </div>
    </div>
  );
};

export default WindIndicator;
