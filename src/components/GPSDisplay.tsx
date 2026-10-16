import React from 'react';
import { Position, GPSTime } from '../types';

interface GPSDisplayProps {
  position: Position;
  gpsTime: GPSTime;
  signalStrength: number;
  size?: { width: number; height: number };
}

const GPSDisplay: React.FC<GPSDisplayProps> = ({ position, gpsTime, signalStrength, size = { width: 400, height: 200 } }) => {
  // Format time to HH:MM:SS
  const formatTime = (timeString: string): string => {
    const cleanString = timeString
      .replace(/\s*GMT.*$/, '')
      .replace(/^[A-Za-z]+,?\s*/, '')
      .replace(/^[0-9]+\s+[A-Za-z]+\s+[0-9]+\s+/, '')
      .trim();
    
    const parts = cleanString.split(' ');
    const timePart = parts[0];
    const period = parts.length > 1 ? parts[1] : null;
    
    const timeComponents = timePart.split(':');
    let hours = parseInt(timeComponents[0]) || 0;
    let minutes = parseInt(timeComponents[1]) || 0;
    
    if (period === 'PM' && hours !== 12) hours += 12;
    else if (period === 'AM' && hours === 12) hours = 0;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${timeComponents[2] || '00'}`;
  };

  // Format coordinate compactly
  const formatCoord = (value: number, isLat: boolean): string => {
    const abs = Math.abs(value);
    const deg = Math.floor(abs);
    const min = (abs - deg) * 60;
    const dir = isLat ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    return `${deg}°${min.toFixed(3)}'${dir}`;
  };

  const today = new Date();
  const dateStr = `${today.getFullYear()}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}`;

  const utcTime = formatTime(gpsTime.utcTime);
  const localTime = formatTime(gpsTime.localTime);

  const getSignalColor = () => {
    if (signalStrength > 80) return 'var(--accent-color)';
    if (signalStrength > 60) return 'var(--warning-color)';
    if (signalStrength > 40) return '#ffaa00';
    if (signalStrength > 20) return '#ff8800';
    return 'var(--danger-color)';
  };

  // Calculate dimensions
  const width = typeof size.width === 'number' ? size.width : parseInt(size.width) || 400;
  const height = typeof size.height === 'number' ? size.height : parseInt(size.height) || 200;
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
      {/* Header */}
      <div 
        className="instrument-header"
        style={{
          padding: `${baseSize * 0.2}px`,
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '4px',
          marginBottom: `${baseSize * 0.3}px`,
          fontSize: `${baseSize * 0.7}px`
        }}
      >
        <span style={{ fontWeight: 'bold' }}>GPS</span>
      </div>
      
      {/* Coordinates */}
      <div style={{ display: 'flex', gap: `${baseSize * 0.5}px`, marginBottom: `${baseSize * 0.3}px` }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: `${baseSize * 0.55}px` }}>Lat</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--accent-color)', fontSize: `${baseSize * 0.8}px` }}>
            {formatCoord(position.latitude, true)}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: `${baseSize * 0.55}px` }}>Lon</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--accent-color)', fontSize: `${baseSize * 0.8}px` }}>
            {formatCoord(position.longitude, false)}
          </span>
        </div>
      </div>
      
      {/* Time */}
      <div style={{ display: 'flex', gap: `${baseSize * 0.5}px`, marginBottom: `${baseSize * 0.3}px` }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: `${baseSize * 0.55}px` }}>UTC</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--accent-color)', fontSize: `${baseSize * 0.75}px` }}>
            {dateStr} {utcTime}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: `${baseSize * 0.55}px` }}>Local</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--accent-color)', fontSize: `${baseSize * 0.75}px` }}>
            {dateStr} {localTime}
          </span>
        </div>
      </div>
      
      {/* Signal */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: `${baseSize * 0.3}px`,
        marginTop: 'auto',
        paddingTop: `${baseSize * 0.3}px`,
        borderTop: '1px solid var(--border-color)'
      }}>
        <svg width={`${baseSize * 0.9}px`} height={`${baseSize * 0.9}px`} viewBox="0 0 24 24" fill={getSignalColor()}>
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
        <span style={{ 
          fontFamily: 'monospace', 
          fontWeight: 'bold', 
          color: getSignalColor(),
          fontSize: `${baseSize * 0.75}px`
        }}>
          {signalStrength}%
        </span>
      </div>
    </div>
  );
};

export default GPSDisplay;
