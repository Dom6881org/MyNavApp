import React from 'react';

interface WindIndicatorProps {
  unit: 'knots' | 'kmh' | 'mph';
  size?: number;
}

const WindIndicator: React.FC<WindIndicatorProps> = ({ unit, size = 200 }) => {
  const unitLabel = unit === 'kmh' ? 'km/h' : unit === 'mph' ? 'mph' : 'kn';

  return (
    <div className="instrument wind-indicator wind-instrument" style={{ '--wind-size': `${size}px` } as React.CSSProperties}>
      <div className="wind-dial" aria-hidden="true">
        <span>N</span><span>E</span><span>S</span><span>W</span>
        <div className="wind-dial-needle" />
        <div className="wind-dial-center">—</div>
      </div>
      <div className="wind-readings">
        <div><span>AWS</span><strong>0.0 <small>{unitLabel}</small></strong></div>
        <div><span>AWA</span><strong>0°</strong></div>
        <span className="instrument-reading-secondary">No anemometer data</span>
      </div>
    </div>
  );
};

export default WindIndicator;
