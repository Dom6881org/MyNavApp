import React from 'react';
import { CompassData } from '../types';

interface CompassProps {
  data: CompassData;
  size?: number;
}

const Compass: React.FC<CompassProps> = ({ data, size = 200 }) => {
  // Calculate base font size based on container size
  const baseFontSize = size * 0.1;

  return (
    <div 
      className="instrument compass" 
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: `${baseFontSize * 0.5}px`,
        boxSizing: 'border-box'
      }}
    >
      <div 
        className="instrument-header" 
        style={{
          width: '100%',
          textAlign: 'center',
          padding: `${baseFontSize * 0.3}px`,
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '4px',
          marginBottom: `${baseFontSize * 0.5}px`
        }}
      >
        <span className="instrument-title" style={{ 
          fontSize: `${baseFontSize * 1}px`, 
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
          gap: `${baseFontSize * 0.3}px`
        }}
      >
        {/* Heading value (where the boat is pointing) */}
        <div 
          style={{
            fontSize: `${baseFontSize * 1.8}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-color)',
            letterSpacing: '0.1em',
            lineHeight: 1
          }}
        >
          Heading: {data.heading.toFixed(0)}°
        </div>
        
        {/* COG value (where the boat is actually going) */}
        <div 
          style={{
            fontSize: `${baseFontSize * 1.8}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: 'var(--accent-secondary)',
            letterSpacing: '0.1em',
            lineHeight: 1
          }}
        >
          COG: {data.cog.toFixed(0)}°
        </div>
        
        {/* Additional info */}
        <div 
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${baseFontSize * 0.2}px`,
            fontSize: `${baseFontSize * 0.8}px`,
            color: 'var(--text-secondary)',
            marginTop: `${baseFontSize * 0.5}px`,
            textAlign: 'center'
          }}
        >
          <span>Magnétique: {data.magneticHeading.toFixed(0)}°</span>
          {data.deviation !== 0 && (
            <span>Dévitation: {data.deviation}°</span>
          )}
        </div>
        
        {/* Legend */}
        <div 
          style={{
            marginTop: `${baseFontSize * 0.5}px`,
            padding: `${baseFontSize * 0.3}px`,
            background: 'rgba(0, 0, 0, 0.1)',
            borderRadius: '4px',
            fontSize: `${baseFontSize * 0.65}px`,
            color: 'var(--text-secondary)',
            textAlign: 'center'
          }}
        >
          Heading = Où pointe le bateau | COG = Où va le bateau
        </div>
      </div>
    </div>
  );
};

export default Compass;
