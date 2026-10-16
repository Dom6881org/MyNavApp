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

  // Calculer la direction du vent en texte
  const getWindDirectionText = (degrees: number): string => {
    const directions = [
      'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
    ];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  const directionText = useMemo(() => getWindDirectionText(data.direction), [data.direction]);

  // Position de l'aiguille (le vent vient DE cette direction)
  const needleAngle = data.direction - 90;

  return (
    <div className="instrument wind-indicator" style={{ width: size, height: size }}>
      <div className="instrument-header">
        <span className="instrument-title">Vent</span>
        <span className="instrument-unit">{getUnitLabel()}</span>
      </div>
      
      <div className="wind-container">
        <svg viewBox="0 0 200 200" className="wind-svg">
          {/* Cercle extérieur */}
          <circle cx="100" cy="100" r="90" fill="none" stroke="#444" strokeWidth="2" />
          
          {/* Direction du vent - Flèche (le vent vient de cette direction) */}
          <g transform={`rotate(${needleAngle} 100 100)`}>
            {/* Flèche principale */}
            <path 
              d="M100,30 L130,80 L100,90 L70,80 Z" 
              fill="#4488ff" 
              stroke="#0066cc" 
              strokeWidth="1"
            />
            <path 
              d="M100,20 L120,40 L100,50 L80,40 Z" 
              fill="#0066cc"
            />
          </g>
          
          {/* Rose des vents */}
          {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map((dir, i) => {
            const angle = i * 45;
            const x = 100 + 70 * Math.cos((angle - 90) * Math.PI / 180);
            const y = 100 + 70 * Math.sin((angle - 90) * Math.PI / 180);
            
            return (
              <text 
                key={dir}
                x={x} 
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#888"
                fontSize="10"
              >
                {dir}
              </text>
            );
          })}
          
          {/* Graduations */}
          {Array.from({ length: 36 }).map((_, i) => {
            const angle = i * 10;
            const length = i % 5 === 0 ? 10 : 5;
            const x1 = 100 + 80 * Math.cos((angle - 90) * Math.PI / 180);
            const y1 = 100 + 80 * Math.sin((angle - 90) * Math.PI / 180);
            const x2 = 100 + (80 + length) * Math.cos((angle - 90) * Math.PI / 180);
            const y2 = 100 + (80 + length) * Math.sin((angle - 90) * Math.PI / 180);
            
            return (
              <line 
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#666" 
                strokeWidth="1"
              />
            );
          })}
          
          {/* Centre */}
          <circle cx="100" cy="100" r="6" fill="#4488ff" />
        </svg>
        
        {/* Informations de vitesse */}
        <div className="wind-info">
          <div className="wind-speed">
            <span className="wind-speed-value">{displaySpeed.toFixed(1)}</span>
            <span className="wind-speed-label">Vitesse</span>
          </div>
          <div className="wind-gust">
            <span className="wind-gust-value">{displayGust.toFixed(1)}</span>
            <span className="wind-gust-label">Rafales</span>
          </div>
        </div>
        
        {/* Direction en texte */}
        <div className="wind-direction-text">
          {directionText} ({data.direction}°)
        </div>
      </div>
    </div>
  );
};

export default WindIndicator;
