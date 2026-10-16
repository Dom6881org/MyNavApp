import React, { useMemo } from 'react';
import { CompassData } from '../types';

interface CompassProps {
  data: CompassData;
  size?: number;
}

const Compass: React.FC<CompassProps> = ({ data, size = 200 }) => {
  const cardinalDirections = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  // Calculer la direction cardinale principale
  const getCardinalDirection = (heading: number): string => {
    const index = Math.round(heading / 45) % 8;
    return cardinalDirections[index];
  };

  const cardinal = useMemo(() => getCardinalDirection(data.heading), [data.heading]);

  return (
    <div className="instrument compass" style={{ width: size, height: size }}>
      <div className="instrument-header">
        <span className="instrument-title">Compas</span>
        <span className="instrument-value">{data.heading}°</span>
      </div>
      
      <div className="compass-container">
        <svg viewBox="0 0 200 200" className="compass-svg">
          {/* Cercle extérieur */}
          <circle cx="100" cy="100" r="90" fill="none" stroke="#444" strokeWidth="2" />
          
          {/* Cercle intérieur */}
          <circle cx="100" cy="100" r="70" fill="none" stroke="#666" strokeWidth="1" />
          
          {/* Marqueurs des directions cardinales */}
          {cardinalDirections.map((dir, i) => {
            const angle = i * 45;
            const x = 100 + 60 * Math.cos((angle - 90) * Math.PI / 180);
            const y = 100 + 60 * Math.sin((angle - 90) * Math.PI / 180);
            
            return (
              <text 
                key={dir}
                x={x} 
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ccc"
                fontSize="12"
                fontWeight="bold"
              >
                {dir}
              </text>
            );
          })}
          
          {/* Graduations tous les 10 degrés */}
          {Array.from({ length: 36 }).map((_, i) => {
            const angle = i * 10;
            const length = i % 5 === 0 ? 15 : 8;
            const x1 = 100 + 80 * Math.cos((angle - 90) * Math.PI / 180);
            const y1 = 100 + 80 * Math.sin((angle - 90) * Math.PI / 180);
            const x2 = 100 + (80 + length) * Math.cos((angle - 90) * Math.PI / 180);
            const y2 = 100 + (80 + length) * Math.sin((angle - 90) * Math.PI / 180);
            
            return (
              <line 
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#666" 
                strokeWidth="2"
              />
            );
          })}
          
          {/* Aiguille de direction */}
          <g transform={`rotate(${data.heading - 90} 100 100)`}>
            <path 
              d="M100,30 L120,100 L80,100 Z" 
              fill="#ff4444" 
              stroke="#ff0000" 
              strokeWidth="1"
            />
            {/* Flèche */}
            <path 
              d="M100,20 L115,40 L100,50 L85,40 Z" 
              fill="#ff0000"
            />
          </g>
          
          {/* Centre */}
          <circle cx="100" cy="100" r="6" fill="#ff0000" />
          
          {/* Indicateurs de déviation */}
          {data.deviation !== 0 && (
            <text 
              x="100" y="180"
              textAnchor="middle"
              fill="#ffaa00"
              fontSize="10"
            >
              Dev: {data.deviation}°
            </text>
          )}
        </svg>
        
        {/* Direction cardinale principale */}
        <div className="compass-cardinal">
          {cardinal}
        </div>
        
        {/* Cap magnétique */}
        <div className="compass-magnetic">
          Magnétique: {data.magneticHeading}°
        </div>
      </div>
    </div>
  );
};

export default Compass;
