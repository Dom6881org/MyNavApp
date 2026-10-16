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
      case 'feet': return 'ft';
      case 'fathoms': return 'fath';
      default: return 'm';
    }
  };

  const getDepthColor = () => {
    if (data.alarm) return 'var(--danger-color)';
    if (displayDepth < 15) return 'var(--warning-color)';
    if (displayDepth < 30) return 'var(--accent-color)';
    return '#00ff88';
  };

  const depthColor = useMemo(() => getDepthColor(), [data.alarm, displayDepth]);

  // Calculate base font size based on container size
  const baseFontSize = size * 0.08;

  return (
    <div 
      className="instrument depth-sounder" 
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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: `${baseFontSize * 0.2}px`,
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '4px',
          marginBottom: `${baseFontSize * 0.3}px`
        }}
      >
        <span className="instrument-title" style={{ 
          fontSize: `${baseFontSize * 0.8}px`, 
          fontWeight: 'bold' 
        }}>Depth</span>
        {data.alarm && (
          <span className="instrument-alarm" style={{ 
            fontSize: `${baseFontSize * 0.7}px` 
          }}>
            !
          </span>
        )}
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
        {/* Main depth value */}
        <div 
          style={{
            fontSize: `${baseFontSize * 1.8}px`,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            color: depthColor,
            letterSpacing: '0.05em',
            lineHeight: 1
          }}
        >
          {displayDepth.toFixed(1)}{getUnitLabel()}
        </div>
        
        {/* Temperature */}
        <div 
          style={{
            fontSize: `${baseFontSize * 1}px`,
            color: 'var(--text-secondary)',
            fontWeight: 'normal'
          }}
        >
          Temp: {data.temperature.toFixed(1)}°C
        </div>
      </div>
    </div>
  );
};

export default DepthSounder;
