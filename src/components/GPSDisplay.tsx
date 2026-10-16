import React from 'react';
import { Position, GPSTime } from '../types';

interface GPSDisplayProps {
  position: Position;
  gpsTime: GPSTime;
  signalStrength: number;
  size?: { width: number; height: number };
}

const GPSDisplay: React.FC<GPSDisplayProps> = ({ position, gpsTime, signalStrength, size = { width: 400, height: 200 } }) => {
  // Formater les coordonnées
  const formatCoordinate = (value: number, isLatitude: boolean): string => {
    const absValue = Math.abs(value);
    const degrees = Math.floor(absValue);
    const minutesDecimal = (absValue - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = ((minutesDecimal - minutes) * 60).toFixed(2);
    
    const hemisphere = isLatitude ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    
    return `${degrees}° ${minutes}' ${seconds}" ${hemisphere}`;
  };

  const latString = formatCoordinate(position.latitude, true);
  const lonString = formatCoordinate(position.longitude, false);

  // Calculer la couleur du signal
  const getSignalColor = () => {
    if (signalStrength > 80) return '#00ff00';
    if (signalStrength > 60) return '#ffff00';
    if (signalStrength > 40) return '#ffaa00';
    return '#ff4444';
  };

  // Calculer la largeur de la barre de signal
  const signalBarWidth = (signalStrength / 100) * 100;

  return (
    <div className="instrument gps-display" style={{ width: size.width, height: size.height }}>
      <div className="instrument-header">
        <span className="instrument-title">GPS</span>
        <span className="instrument-status">
          Signal: {signalStrength}%
        </span>
      </div>
      
      <div className="gps-container">
        <div className="gps-coordinates">
          <div className="coordinate">
            <span className="coordinate-label">Latitude:</span>
            <span className="coordinate-value">{latString}</span>
          </div>
          <div className="coordinate">
            <span className="coordinate-label">Longitude:</span>
            <span className="coordinate-value">{lonString}</span>
          </div>
          <div className="coordinate">
            <span className="coordinate-label">Décimal:</span>
            <span className="coordinate-value">
              {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
            </span>
          </div>
        </div>
        
        <div className="gps-time">
          <div className="time-item">
            <span className="time-label">UTC:</span>
            <span className="time-value">{gpsTime.utcTime}</span>
          </div>
          <div className="time-item">
            <span className="time-label">Local:</span>
            <span className="time-value">{gpsTime.localTime}</span>
          </div>
          <div className="time-item">
            <span className="time-label">Date:</span>
            <span className="time-value">{gpsTime.date}</span>
          </div>
        </div>
        
        <div className="gps-signal">
          <div className="signal-bar-container">
            <div className="signal-bar" style={{ width: `${signalBarWidth}%`, backgroundColor: getSignalColor() }} />
          </div>
          <div className="signal-indicator">
            <svg width="40" height="40" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="15" fill="none" stroke="#444" strokeWidth="2" />
              <circle cx="20" cy="20" r="10" fill="none" stroke="#666" strokeWidth="1" />
              <circle cx="20" cy="20" r="5" fill={getSignalColor()} />
              
              {/* Icône satellite */}
              <path d="M20,5 L25,15 L15,15 Z" fill="#888" />
              <path d="M5,20 L15,25 L15,15 Z" fill="#888" />
              <path d="M20,25 L25,35 L15,35 Z" fill="#888" />
              <path d="M35,20 L25,25 L25,15 Z" fill="#888" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GPSDisplay;
