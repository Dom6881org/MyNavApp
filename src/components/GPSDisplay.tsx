import React from 'react';
import { Position, GPSTime } from '../types';

interface GPSDisplayProps {
  position: Position | null;
  gpsTime: GPSTime | null;
  accuracy: number | null;
  size?: { width: number; height: number };
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
  gpsTime,
  accuracy,
  size = { width: 400, height: 200 }
}) => {
  const width = typeof size.width === 'number' ? size.width : parseInt(String(size.width), 10) || 400;
  const height = typeof size.height === 'number' ? size.height : parseInt(String(size.height), 10) || 200;
  const baseSize = Math.min(width, height) * 0.08;

  return (
    <div
      className="instrument gps-display"
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: `${baseSize * 0.4}px`,
        boxSizing: 'border-box',
        fontSize: `${baseSize * 0.6}px`
      }}
    >
      <div className="instrument-header">
        <span className="instrument-title">GPS</span>
      </div>

      <div className="gps-coordinate-list" style={{ display: 'flex', gap: `${baseSize * 0.5}px` }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="gps-field-label">LAT</span>
          <span className="gps-field-value">
            {position ? formatCoord(position.latitude, true) : 'Waiting for GPS fix'}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="gps-field-label">LON</span>
          <span className="gps-field-value">
            {position ? formatCoord(position.longitude, false) : '—'}
          </span>
        </div>
      </div>

      <div className="gps-time-list" style={{ display: 'flex', gap: `${baseSize * 0.5}px` }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="gps-field-label">UTC</span>
          <span className="gps-field-value">{gpsTime?.utcTime ?? '—'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="gps-field-label">LOCAL</span>
          <span className="gps-field-value">{gpsTime?.localTime ?? '—'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="gps-field-label">Date</span>
          <span className="gps-field-value">{gpsTime?.date ?? '—'}</span>
        </div>
      </div>

      <div className="gps-signal">
        <span className="gps-field-label">GPS ACCURACY</span>
        <span className="gps-field-value">
          {accuracy === null ? 'Waiting for position' : `± ${Math.round(accuracy)} m`}
        </span>
      </div>
    </div>
  );
};

export default GPSDisplay;
