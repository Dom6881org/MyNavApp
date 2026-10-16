import React from 'react';
import { CompassData } from '../types';

interface CompassProps {
  data: CompassData;
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
        }}>Compass</span>
      </div>
      
      <div 
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: `${baseFontSize * 0.2}px`
        }}
      >
        {/* Heading value (where the boat is pointing) */}
        <div 
          style={{
            fontSize: `${baseFontSize * 1.4}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-color)',
            letterSpacing: '0.05em',
            lineHeight: 1
          }}
        >
          HDG: {data.heading.toFixed(0)}°
        </div>
        
        {/* COG value (where the boat is actually going) */}
        <div 
          style={{
            fontSize: `${baseFontSize * 1.4}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-secondary)',
            letterSpacing: '0.05em',
            lineHeight: 1
          }}
        >
          COG: {data.cog.toFixed(0)}°
        </div>
      </div>
    </div>
  );
};

export default Compass;
