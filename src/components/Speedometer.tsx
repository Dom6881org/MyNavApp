import React, { useMemo } from 'react';
import { SpeedData } from '../types';

interface SpeedometerProps {
  data: SpeedData;
  unit: 'knots' | 'kmh' | 'mph';
  size?: number;
}

const Speedometer: React.FC<SpeedometerProps> = ({ data, unit, size = 200 }) => {
  const convertSpeed = (speed: number): number => {
    switch (unit) {
      case 'kmh': return speed * 1.852;
      case 'mph': return speed * 1.15078;
      default: return speed;
    }
  };

  const displaySpeed = useMemo(() => convertSpeed(data.speed), [data.speed, unit]);
  const displaySOG = useMemo(() => convertSpeed(data.sog), [data.sog, unit]);

  const getUnitLabel = () => {
    switch (unit) {
      case 'kmh': return 'km/h';
      case 'mph': return 'mph';
      default: return 'kn';
    }
  };

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
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: `${baseFontSize * 0.2}px`
        }}
      >
        {/* Speed value (from log/speed sensor) */}
        <div 
          style={{
            fontSize: `${baseFontSize * 1.4}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-color)',
            letterSpacing: '0.05em',
            lineHeight: 1
          }}
        >
          Speed: {displaySpeed.toFixed(1)}{getUnitLabel()}
        </div>
        
        {/* SOG value (from GPS) */}
        <div 
          style={{
            fontSize: `${baseFontSize * 1.4}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-secondary)',
            letterSpacing: '0.05em',
            lineHeight: 1
          }}
        >
          SOG: {displaySOG.toFixed(1)}{getUnitLabel()}
        </div>
      </div>
    </div>
  );
};

export default Speedometer;
