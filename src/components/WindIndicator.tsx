import React, { useMemo } from 'react';
import { WindData, WindForecastStatus } from '../types';

interface WindIndicatorProps {
  data: WindData | null;
  status: WindForecastStatus;
  unit: 'knots' | 'kmh' | 'mph';
  size?: number;
}

const WindIndicator: React.FC<WindIndicatorProps> = ({ data, status, unit, size = 200 }) => {
  const convertSpeed = (speed: number): number => {
    switch (unit) {
      case 'kmh': return speed * 1.852;
      case 'mph': return speed * 1.15078;
      default: return speed;
    }
  };

  const displaySpeed = useMemo(() => data ? convertSpeed(data.speed) : null, [data, unit]);
  const displayGust = useMemo(() => data ? convertSpeed(data.gust) : null, [data, unit]);

  const getUnitLabel = () => {
    switch (unit) {
      case 'kmh': return 'km/h';
      case 'mph': return 'mph';
      default: return 'kn';
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

  const directionText = useMemo(() => data ? getWindDirectionText(data.direction) : null, [data]);

  // Calculate base font size based on container size
  const baseFontSize = size * 0.08;

  if (!data) {
    return (
      <div className="instrument-unavailable">
        {status.error || (status.isLoading ? 'Loading weather forecast…' : 'Wind forecast available after GPS fix')}
      </div>
    );
  }

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
        <span className="instrument-title" style={{ 
          fontSize: `${baseFontSize * 0.8}px`, 
          fontWeight: 'bold' 
        }}>WIND · FORECAST</span>
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
        {/* Direction */}
        <div
          className="instrument-reading instrument-reading-direction"
          style={{
            fontSize: `${baseFontSize * 1.2}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-color)',
            letterSpacing: '0.05em',
            lineHeight: 1
          }}
        >
          {directionText} ({data.direction.toFixed(0)}°)
        </div>
        
        {/* Wind speed */}
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
          {displaySpeed === null ? '—' : `${displaySpeed.toFixed(1)} ${getUnitLabel()}`}
        </div>
        
        {/* Gust info */}
        <div
          className="instrument-reading instrument-reading-secondary"
          style={{
            fontSize: `${baseFontSize * 0.9}px`,
            color: 'var(--text-secondary)',
            marginTop: `${baseFontSize * 0.2}px`
          }}
        >
          GUSTS: {displayGust === null ? '—' : `${displayGust.toFixed(1)} ${getUnitLabel()}`}
        </div>
        {status.updatedAt && (
          <div className="instrument-reading-secondary">
            Open-Meteo · {new Date(status.updatedAt).toLocaleTimeString('en-GB')}
          </div>
        )}
        {status.error && <div className="instrument-unavailable" role="alert">{status.error}</div>}
      </div>
    </div>
  );
};

export default WindIndicator;
