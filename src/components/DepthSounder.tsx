import React, { useMemo } from 'react';
import { DepthData } from '../types';

interface DepthSounderProps {
  data: DepthData;
  unit: 'meters' | 'feet' | 'fathoms';
  size?: number;
}

const DepthSounder: React.FC<DepthSounderProps> = ({ data, unit, size = 200 }) => {
  const convertDepth = (depth: number): number => {
    switch (unit) {
      case 'feet': return depth * 3.28084;
      case 'fathoms': return depth / 1.8288;
      default: return depth;
    }
  };

  const displayDepth = useMemo(() => convertDepth(data.depth), [data.depth, unit]);

  const getUnitLabel = () => {
    switch (unit) {
      case 'feet': return 'pieds';
      case 'fathoms': return 'brasses';
      default: return 'm';
    }
  };

  // Calculer le pourcentage pour l'affichage
  const maxDepth = 100; // Profondeur max pour l'affichage
  const percentage = Math.min(100, (displayDepth / maxDepth) * 100);

  // Déterminer la couleur en fonction de la profondeur
  const getDepthColor = () => {
    if (data.alarm) return '#ff4444';
    if (displayDepth < 15) return '#ffaa00';
    if (displayDepth < 30) return '#4488ff';
    return '#00ff00';
  };

  const depthColor = useMemo(() => getDepthColor(), [data.alarm, displayDepth]);

  return (
    <div className="instrument depth-sounder" style={{ width: size, height: size }}>
      <div className="instrument-header">
        <span className="instrument-title">Sondeur</span>
        {data.alarm && <span className="instrument-alarm">⚠️ ALARME</span>}
      </div>
      
      <div className="depth-container">
        <svg viewBox="0 0 200 200" className="depth-svg">
          {/* Cercle extérieur */}
          <circle cx="100" cy="100" r="90" fill="none" stroke="#444" strokeWidth="2" />
          
          {/* Niveau d'eau - Arc */}
          <path 
            d="M10,100 A90,90 0 0,1 190,100" 
            fill="none" 
            stroke={depthColor} 
            strokeWidth="20"
            strokeDasharray={`${2 * Math.PI * 90 * (percentage / 100)} 9999`}
            strokeLinecap="round"
            transform="rotate(-90 100 100)"
          />
          
          {/* Graduations de profondeur */}
          {Array.from({ length: 11 }).map((_, i) => {
            const depthValue = (i * 10);
            const angle = (i * 18) - 90;
            const length = i % 2 === 0 ? 15 : 10;
            const x1 = 100 + 70 * Math.cos(angle * Math.PI / 180);
            const y1 = 100 + 70 * Math.sin(angle * Math.PI / 180);
            const x2 = 100 + (70 + length) * Math.cos(angle * Math.PI / 180);
            const y2 = 100 + (70 + length) * Math.sin(angle * Math.PI / 180);
            
            return (
              <g key={i}>
                <line 
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="#666" 
                  strokeWidth="2"
                />
                {i % 2 === 0 && (
                  <text 
                    x={x1 + 10 * Math.cos((angle + 90) * Math.PI / 180)}
                    y={y1 + 10 * Math.sin((angle + 90) * Math.PI / 180)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#888"
                    fontSize="8"
                  >
                    {depthValue}
                  </text>
                )}
              </g>
            );
          })}
          
          {/* Aiguille de profondeur */}
          <line 
            x1="100" y1="100" 
            x2={100 + 60 * Math.cos((percentage * 3.6 - 90) * Math.PI / 180)}
            y2={100 + 60 * Math.sin((percentage * 3.6 - 90) * Math.PI / 180)}
            stroke={depthColor} 
            strokeWidth="4"
            strokeLinecap="round"
          />
          
          {/* Centre */}
          <circle cx="100" cy="100" r="8" fill={depthColor} />
          
          {/* Fond de l'eau */}
          <rect x="0" y="150" width="200" height="50" fill="#113366" />
          
          {/* Surface de l'eau */}
          <path 
            d="M0,150 Q100,140 200,150 L200,155 Q100,165 0,155 Z" 
            fill="#4488ff" 
            fillOpacity="0.7"
          />
          
          {/* Bateau */}
          <path 
            d="M100,130 L120,130 L125,140 L100,120 L75,140 L80,130 Z" 
            fill="#ff4444"
          />
        </svg>
        
        {/* Valeur de profondeur */}
        <div className="depth-value">
          <span className="depth-number">{displayDepth.toFixed(1)}</span>
          <span className="depth-unit">{getUnitLabel()}</span>
        </div>
        
        {/* Température de l'eau */}
        <div className="depth-temp">
          <span className="temp-label">Température:</span>
          <span className="temp-value">{data.temperature.toFixed(1)}°C</span>
        </div>
        
        {/* Profondeur d'alarme */}
        <div className="depth-alarm-info">
          Alarme: {data.alarmDepth}{getUnitLabel()}
        </div>
      </div>
    </div>
  );
};

export default DepthSounder;
