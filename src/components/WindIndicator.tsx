import React, { useMemo } from 'react';
import { WindData } from '../types';

interface WindIndicatorProps {
  data: WindData;
  unit: 'knots' | 'kmh' | 'mph';
  size?: number;
}

const WindIndicator: React.FC<WindIndicatorProps> = ({ data, unit, size = 200 }) => {
  const convertSpeed = (speed: number): number => {
    switch (unit) {
      case 'kmh': return speed * 1.852;
      case 'mph': return speed * 1.15078;
      default: return speed;
    }
  };

  const displaySpeed = useMemo(() => convertSpeed(data.speed), [data.speed, unit]);
  const displayGust = useMemo(() => convertSpeed(data.gust), [data.gust, unit]);

  const getUnitLabel = () => {
    switch (unit) {
      case 'kmh': return 'km/h';
      case 'mph': return 'mph';
      default: return 'knots';
    }
  };

  const getWindDirectionText = (degrees: number): string => {
    const directions = [
      'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
    ];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  const directionText = useMemo(() => getWindDirectionText(data.direction), [data.direction]);

  // Calculate base font size based on container size
  const baseFontSize = size * 0.1;

  return (
    <div 
      className="instrument wind-indicator" 
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
        }}>Wind</span>
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
        {/* Direction */}
        <div 
          style={{
            fontSize: `${baseFontSize * 1.8}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-color)',
            letterSpacing: '0.05em',
            lineHeight: 1
          }}
        >
          {directionText}
        </div>
        
        {/* Direction in degrees */}
        <div 
          style={{
            fontSize: `${baseFontSize * 1}px`,
            color: 'var(--text-secondary)',
            fontWeight: 'normal'
          }}
        >
          {data.direction.toFixed(0)}°
        </div>
        
        {/* Wind speed */}
        <div 
          style={{
            fontSize: `${baseFontSize * 2}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-color)',
            letterSpacing: '0.1em',
            lineHeight: 1,
            marginTop: `${baseFontSize * 0.3}px`
          }}
        >
          {displaySpeed.toFixed(1)}
        </div>
        
        {/* Unit */}
        <div 
          style={{
            fontSize: `${baseFontSize * 0.9}px`,
            color: 'var(--text-secondary)',
            fontWeight: 'normal'
          }}
        >
          {getUnitLabel()}
        </div>
        
        {/* Gust info */}
        <div 
          style={{
            display: 'flex',
            gap: `${baseFontSize * 0.3}px`,
            fontSize: `${baseFontSize * 0.8}px`,
            color: 'var(--text-secondary)',
            marginTop: `${baseFontSize * 0.3}px`
          }}
        >
          <span>Gust: {displayGust.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
};

export default WindIndicator;
