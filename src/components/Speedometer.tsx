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
  const displayMaxSpeed = useMemo(() => convertSpeed(data.maxSpeed), [data.maxSpeed, unit]);
  const displayAverageSpeed = useMemo(() => convertSpeed(data.averageSpeed), [data.averageSpeed, unit]);

  const percentage = (displaySpeed / (displayMaxSpeed > 0 ? displayMaxSpeed : 1)) * 100;

  const getUnitLabel = () => {
    switch (unit) {
      case 'kmh': return 'km/h';
      case 'mph': return 'mph';
      default: return 'knots';
    }
  };

  return (
    <div className="instrument speedometer" style={{ width: size, height: size }}>
      <div className="instrument-header">
        <span className="instrument-title">Vitesse</span>
        <span className="instrument-unit">{getUnitLabel()}</span>
      </div>
      
      <div className="speedometer-container">
        <svg viewBox="0 0 200 200" className="speedometer-svg">
          {/* Arc de fond */}
          <path 
            d="M50,150 A100,100 0 0,1 150,150" 
            fill="none" 
            stroke="#444" 
            strokeWidth="20"
          />
          
          {/* Arc de remplissage */}
          <path 
            d="M50,150 A100,100 0 0,1 150,150" 
            fill="none" 
            stroke="url(#speedGradient)" 
            strokeWidth="20"
            strokeDasharray={`${2 * Math.PI * 100 * (percentage / 100)} 9999`}
            strokeLinecap="round"
            transform="rotate(-90 100 100)"
          />
          
          {/* Graduations */}
          {Array.from({ length: 11 }).map((_, i) => {
            const angle = (i * 180 / 10) - 90;
            const length = i % 2 === 0 ? 15 : 10;
            const x1 = 100 + 80 * Math.cos(angle * Math.PI / 180);
            const y1 = 100 + 80 * Math.sin(angle * Math.PI / 180);
            const x2 = 100 + (80 + length) * Math.cos(angle * Math.PI / 180);
            const y2 = 100 + (80 + length) * Math.sin(angle * Math.PI / 180);
            
            return (
              <line 
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#666" 
                strokeWidth="2"
              />
            );
          })}
          
          {/* Aiguille */}
          <line 
            x1="100" y1="100" 
            x2={100 + 70 * Math.cos((percentage * 1.8 - 90) * Math.PI / 180)}
            y2={100 + 70 * Math.sin((percentage * 1.8 - 90) * Math.PI / 180)}
            stroke="#ff4444" 
            strokeWidth="4"
            strokeLinecap="round"
          />
          
          {/* Centre */}
          <circle cx="100" cy="100" r="8" fill="#ff4444" />
          
          <defs>
            <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00ff00" />
              <stop offset="50%" stopColor="#ffff00" />
              <stop offset="100%" stopColor="#ff4444" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Valeur principale */}
        <div className="speedometer-value">
          {displaySpeed.toFixed(1)}
        </div>
        
        {/* Infos supplémentaires */}
        <div className="speedometer-info">
          <span>Max: {displayMaxSpeed.toFixed(1)}</span>
          <span>Moy: {displayAverageSpeed.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
};

export default Speedometer;
