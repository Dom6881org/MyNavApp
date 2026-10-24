import React from 'react';
import { Position, GPSTime } from '../types';

interface GPSDisplayProps {
  position: Position | null;
  gpsTime: GPSTime | null;
}

const formatCoord = (value: number, isLat: boolean): string => {
  const degrees = Math.floor(Math.abs(value));
  const minutes = (Math.abs(value) - degrees) * 60;
  const direction = isLat
    ? value >= 0 ? 'N' : 'S'
    : value >= 0 ? 'E' : 'W';
  return `${degrees}°${minutes.toFixed(3)}'${direction}`;
};

const GPSDisplay: React.FC<GPSDisplayProps> = ({
  position,
  gpsTime
}) => {
  return (
    <div className="instrument gps-display">
      <div className="gps-coordinate-list">
        <div className="gps-field gps-coordinate">
          <span className="gps-field-label">LAT</span>
          <span className="gps-field-value">
            {position ? formatCoord(position.latitude, true) : 'Waiting for GPS fix'}
          </span>
        </div>
        <div className="gps-field gps-coordinate">
          <span className="gps-field-label">LON</span>
          <span className="gps-field-value">
            {position ? formatCoord(position.longitude, false) : '—'}
          </span>
        </div>
      </div>

      <div className="gps-meta-list">
        <div className="gps-time-list">
          <div className="gps-field gps-time">
            <span className="gps-field-label">UTC</span>
            <span className="gps-field-value">{gpsTime?.utcTime ?? '—'}</span>
          </div>
          <div className="gps-field gps-time">
            <span className="gps-field-label">LOCAL</span>
            <span className="gps-field-value">{gpsTime?.localTime ?? '—'}</span>
          </div>
          <div className="gps-field gps-time">
            <span className="gps-field-label">Date</span>
            <span className="gps-field-value">{gpsTime?.date ?? '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GPSDisplay;
