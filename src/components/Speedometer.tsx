import React, { useMemo } from 'react';
import { SpeedData } from '../types';

interface SpeedometerProps {
  data: SpeedData | null;
  size?: number;
}

const Speedometer: React.FC<SpeedometerProps> = ({ data, size = 200 }) => {
  const displaySTW = null;
  const displaySOG = useMemo(() => data?.sog ?? data?.speed ?? 0, [data?.sog, data?.speed]);

  // Calculate base font size based on container size
  const baseFontSize = size * 0.08;

  return (
    <div 
      className="instrument speedometer" 
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
        <span className="instrument-title" style={{ 
          fontSize: `${baseFontSize * 0.8}px`, 
          fontWeight: 'bold' 
        }}>Speed</span>
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
        {/* STW stays at zero until a water-speed sensor is connected. */}
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
          STW: {(displaySTW ?? 0).toFixed(1)} kn
        </div>
        
        {/* Speed over ground */}
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
          SOG: {displaySOG.toFixed(1)} kn
        </div>
      </div>
    </div>
  );
};

export default Speedometer;
