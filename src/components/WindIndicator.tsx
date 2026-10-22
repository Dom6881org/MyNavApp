import React from 'react';

interface WindIndicatorProps {
  unit: 'knots' | 'kmh' | 'mph';
  size?: number;
}

const WindIndicator: React.FC<WindIndicatorProps> = ({ unit, size = 200 }) => {
  const unitLabel = unit === 'kmh' ? 'km/h' : unit === 'mph' ? 'mph' : 'kn';
  const baseFontSize = size * 0.08;

  return (
    <div
      className="instrument wind-indicator"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: `${baseFontSize * 0.4}px`,
        boxSizing: 'border-box'
      }}
    >
      <div
        className="instrument-header"
        style={{
          width: '100%',
          textAlign: 'center',
          padding: `${baseFontSize * 0.2}px`,
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '4px',
          marginBottom: `${baseFontSize * 0.3}px`
        }}
      >
        <span className="instrument-title" style={{ fontSize: `${baseFontSize * 0.8}px`, fontWeight: 'bold' }}>
          WIND · ANEMOMETER
        </span>
      </div>

      <div
        className="instrument-reading-group"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: `${baseFontSize * 0.2}px`
        }}
      >
        <div
          className="instrument-reading instrument-reading-primary"
          style={{
            fontSize: `${baseFontSize * 1.4}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-color)',
            letterSpacing: '0.05em',
            lineHeight: 1
          }}
        >
          AWS: 0.0 {unitLabel}
        </div>
        <div
          className="instrument-reading instrument-reading-primary"
          style={{
            fontSize: `${baseFontSize * 1.4}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-secondary)',
            letterSpacing: '0.05em',
            lineHeight: 1
          }}
        >
          AWA: 0°
        </div>
        <div className="instrument-reading-secondary">No anemometer data</div>
      </div>
    </div>
  );
};

export default WindIndicator;
