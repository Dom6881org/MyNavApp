import React from 'react';
import { CompassData } from '../types';

interface CompassProps {
  data: CompassData | null;
  size?: number;
}

const Compass: React.FC<CompassProps> = ({ data, size = 200 }) => {
  // Calculate base font size based on container size
  const baseFontSize = size * 0.08;

  return (
    <div 
      className="instrument compass" 
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
        }}>Course</span>
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
        {/* Heading is unavailable until a heading sensor is connected. */}
        <div
          className="instrument-reading instrument-reading-primary"
          style={{
            fontSize: `${baseFontSize * 1.4}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-color)',
            letterSpacing: '0.05em',
            lineHeight: 1
          }}
        >
          HDG: {(data?.heading ?? 0).toFixed(0)}°
        </div>
        
        {/* Course over ground calculated from GPS positions. */}
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
          COG: {(data?.cog ?? 0).toFixed(0)}°
        </div>
      </div>
    </div>
  );
};

export default Compass;
