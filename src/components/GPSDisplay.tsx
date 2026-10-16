import React from 'react';
import { Position, GPSTime } from '../types';

interface GPSDisplayProps {
  position: Position;
  gpsTime: GPSTime;
  signalStrength: number; // Signal GPS du device (0-100%)
  size?: { width: number; height: number };
}

const GPSDisplay: React.FC<GPSDisplayProps> = ({ position, gpsTime, signalStrength, size = { width: 400, height: 300 } }) => {
  // Format date and time to YYYY/MM/DD HH:MM:SS
  const formatDateTime = (timeString: string, _isUTC: boolean): string => {
    // Get today's date
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    
    // Parse the time string to get hours, minutes, seconds
    let hours = 0, minutes = 0, seconds = 0;
    
    // Clean the string - remove any timezone info, day names, etc.
    const cleanString = timeString
      .replace(/\s*GMT.*$/, '')
      .replace(/^[A-Za-z]+,?\s*/, '')
      .replace(/^[0-9]+\s+[A-Za-z]+\s+[0-9]+\s+/, '')
      .trim();
    
    // Split by space to separate time from AM/PM
    const parts = cleanString.split(' ');
    const timePart = parts[0];
    const period = parts.length > 1 ? parts[1] : null;
    
    // Split by colon
    const timeComponents = timePart.split(':');
    
    hours = parseInt(timeComponents[0]) || 0;
    minutes = parseInt(timeComponents[1]) || 0;
    seconds = parseInt(timeComponents[2] || '0') || 0;
    
    // Handle AM/PM conversion to 24-hour format
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    // Format to YYYY/MM/DD HH:MM:SS
    return `${year}/${month}/${day} ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

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

  const getSignalColor = () => {
    if (signalStrength > 80) return 'var(--accent-color)';
    if (signalStrength > 60) return 'var(--warning-color)';
    if (signalStrength > 40) return '#ffaa00';
    if (signalStrength > 20) return '#ff8800';
    return 'var(--danger-color)';
  };

  const getSignalLabel = () => {
    if (signalStrength > 80) return 'Excellent';
    if (signalStrength > 60) return 'Bon';
    if (signalStrength > 40) return 'Moyen';
    if (signalStrength > 20) return 'Faible';
    return 'Aucun';
  };

  // Calculate font sizes based on container dimensions
  const containerWidth = size.width;
  const containerHeight = size.height;
  const baseFontSize = Math.min(containerWidth * 0.06, containerHeight * 0.1);

  // Format UTC and Local times with date
  const utcDateTime = formatDateTime(gpsTime.utcTime, true);
  const localDateTime = formatDateTime(gpsTime.localTime, false);

  return (
    <div 
      className="instrument gps-display" 
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: 'auto auto auto',
        gap: `${baseFontSize * 0.5}px`,
        padding: `${baseFontSize}px`,
        boxSizing: 'border-box'
      }}
    >
      {/* Header spanning both columns */}
      <div 
        className="instrument-header" 
        style={{
          gridColumn: '1 / -1',
          textAlign: 'center',
          padding: `${baseFontSize * 0.5}px`,
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '4px',
          marginBottom: `${baseFontSize * 0.5}px`
        }}
      >
        <span className="instrument-title" style={{ 
          fontSize: `${baseFontSize * 1.2}px`, 
          fontWeight: 'bold' 
        }}>GPS Device</span>
      </div>
      
      {/* Latitude */}
      <div 
        style={{
          gridColumn: '1',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <span 
          style={{
            fontSize: `${baseFontSize}px`,
            color: 'var(--text-secondary)',
            fontWeight: 'normal'
          }}
        >
          Latitude
        </span>
        <div 
          style={{
            fontSize: `${baseFontSize * 1.5}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-color)',
            letterSpacing: '0.05em',
            textAlign: 'center',
            marginTop: `${baseFontSize * 0.2}px`
          }}
        >
          {latString}
        </div>
        <div 
          style={{
            fontSize: `${baseFontSize * 0.9}px`,
            color: 'var(--text-secondary)',
            fontFamily: 'monospace',
            marginTop: `${baseFontSize * 0.3}px`
          }}
        >
          {position.latitude.toFixed(6)}°
        </div>
      </div>
      
      {/* Longitude */}
      <div 
        style={{
          gridColumn: '2',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <span 
          style={{
            fontSize: `${baseFontSize}px`,
            color: 'var(--text-secondary)',
            fontWeight: 'normal'
          }}
        >
          Longitude
        </span>
        <div 
          style={{
            fontSize: `${baseFontSize * 1.5}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-color)',
            letterSpacing: '0.05em',
            textAlign: 'center',
            marginTop: `${baseFontSize * 0.2}px`
          }}
        >
          {lonString}
        </div>
        <div 
          style={{
            fontSize: `${baseFontSize * 0.9}px`,
            color: 'var(--text-secondary)',
            fontFamily: 'monospace',
            marginTop: `${baseFontSize * 0.3}px`
          }}
        >
          {position.longitude.toFixed(6)}°
        </div>
      </div>
      
      {/* Time - UTC with date */}
      <div 
        style={{
          gridColumn: '1',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: `${baseFontSize * 0.5}px`,
          borderTop: '1px solid var(--border-color)'
        }}
      >
        <span 
          style={{
            fontSize: `${baseFontSize}px`,
            color: 'var(--text-secondary)',
            fontWeight: 'normal'
          }}
        >
          UTC
        </span>
        <div 
          style={{
            fontSize: `${baseFontSize * 1}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-color)',
            letterSpacing: '0.05em',
            marginTop: `${baseFontSize * 0.2}px`,
            textAlign: 'center'
          }}
        >
          {utcDateTime}
        </div>
      </div>
      
      {/* Time - Local with date */}
      <div 
        style={{
          gridColumn: '2',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: `${baseFontSize * 0.5}px`,
          borderTop: '1px solid var(--border-color)'
        }}
      >
        <span 
          style={{
            fontSize: `${baseFontSize}px`,
            color: 'var(--text-secondary)',
            fontWeight: 'normal'
          }}
        >
          Local
        </span>
        <div 
          style={{
            fontSize: `${baseFontSize * 1}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-color)',
            letterSpacing: '0.05em',
            marginTop: `${baseFontSize * 0.2}px`,
            textAlign: 'center'
          }}
        >
          {localDateTime}
        </div>
      </div>
      
      {/* GPS Device Signal */}
      <div 
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: `${baseFontSize}px`,
          paddingTop: `${baseFontSize * 0.5}px`,
          borderTop: '1px solid var(--border-color)'
        }}
      >
        <div 
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: `${baseFontSize * 0.3}px`
          }}
        >
          <span 
            style={{
              fontSize: `${baseFontSize}px`,
              color: 'var(--text-secondary)'
            }}
          >
            Signal GPS Device
          </span>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${baseFontSize * 0.5}px`
            }}
          >
            <span 
              style={{
                fontSize: `${baseFontSize * 1}px`,
                fontWeight: 'bold',
                color: getSignalColor()
              }}
            >
              {signalStrength}%
            </span>
            <span 
              style={{
                fontSize: `${baseFontSize * 0.8}px`,
                color: getSignalColor()
              }}
            >
              ({getSignalLabel()})
            </span>
          </div>
        </div>
        
        {/* Signal bar with satellite icon */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${baseFontSize * 0.5}px`,
            width: `${baseFontSize * 8}px`
          }}
        >
          {/* Satellite icon */}
          <svg 
            width={`${baseFontSize * 1.5}px`} 
            height={`${baseFontSize * 1.5}px`} 
            viewBox="0 0 24 24" 
            fill={getSignalColor()}
          >
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          
          {/* Signal bars */}
          <div 
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: `${baseFontSize * 0.15}px`,
              justifyContent: 'center'
            }}
          >
            {[4, 3, 2, 1, 0].map((level) => {
              const barHeight = baseFontSize * 0.6;
              const barWidth = baseFontSize * 0.25;
              const isActive = signalStrength >= level * 20;
              return (
                <div 
                  key={level}
                  style={{
                    width: barWidth,
                    height: barHeight,
                    backgroundColor: isActive ? getSignalColor() : '#333',
                    borderRadius: `${barWidth * 0.2}px`,
                    transition: 'background-color 0.3s'
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GPSDisplay;
