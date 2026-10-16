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
  const displayMaxSpeed = useMemo(() => convertSpeed(data.maxSpeed), [data.maxSpeed, unit]);
  const displayAverageSpeed = useMemo(() => convertSpeed(data.averageSpeed), [data.averageSpeed, unit]);

  const getUnitLabel = () => {
    switch (unit) {
      case 'kmh': return 'km/h';
      case 'mph': return 'mph';
      default: return 'knots';
    }
  };

  // Calculate base font size based on container size
  const baseFontSize = size * 0.1;

  return (
    <div 
      className="instrument speedometer" 
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: `${baseFontSize * 0.5}px`,
        boxSizing: 'border-box'
      }}
    >
      <div 
        className="instrument-header" 
        style={{
          width: '100%',
          textAlign: 'center',
          padding: `${baseFontSize * 0.3}px`,
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '4px',
          marginBottom: `${baseFontSize * 0.5}px`
        }}
      >
        <span className="instrument-title" style={{ 
          fontSize: `${baseFontSize * 1}px`, 
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
          gap: `${baseFontSize * 0.3}px`
        }}
      >
        {/* Speed value (from log/speed sensor) */}
        <div 
          style={{
            fontSize: `${baseFontSize * 1.8}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-color)',
            letterSpacing: '0.1em',
            lineHeight: 1
          }}
        >
          Speed: {displaySpeed.toFixed(1)}
        </div>
        
        {/* SOG value (from GPS) */}
        <div 
          style={{
            fontSize: `${baseFontSize * 1.8}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-secondary)',
            letterSpacing: '0.1em',
            lineHeight: 1
          }}
        >
          SOG: {displaySOG.toFixed(1)}
        </div>
        
        {/* Unit */}
        <div 
          style={{
            fontSize: `${baseFontSize * 1}px`,
            color: 'var(--text-secondary)',
            fontWeight: 'normal'
          }}
        >
          {getUnitLabel()}
        </div>
        
        {/* Additional info */}
        <div 
          style={{
            display: 'flex',
            gap: `${baseFontSize * 0.8}px`,
            fontSize: `${baseFontSize * 0.8}px`,
            color: 'var(--text-secondary)',
            marginTop: `${baseFontSize * 0.3}px`
          }}
        >
          <span>Max: {displayMaxSpeed.toFixed(1)}</span>
          <span>Avg: {displayAverageSpeed.toFixed(1)}</span>
        </div>
        
        {/* Legend */}
        <div 
          style={{
            marginTop: `${baseFontSize * 0.5}px`,
            padding: `${baseFontSize * 0.3}px`,
            background: 'rgba(0, 0, 0, 0.1)',
            borderRadius: '4px',
            fontSize: `${baseFontSize * 0.65}px`,
            color: 'var(--text-secondary)',
            textAlign: 'center'
          }}
        >
          Speed = Vitesse du bateau | SOG = Vitesse sur le sol
        </div>
      </div>
    </div>
  );
};

export default Speedometer;
