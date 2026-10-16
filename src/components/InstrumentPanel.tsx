import React from 'react';
import { NavigationData, InstrumentConfig } from '../types';
import Speedometer from './Speedometer';
import Compass from './Compass';
import WindIndicator from './WindIndicator';
import DepthSounder from './DepthSounder';
import GPSDisplay from './GPSDisplay';
import MapView from './MapView';

interface InstrumentPanelProps {
  data: NavigationData;
  config: InstrumentConfig;
  units: {
    speed: 'knots' | 'kmh' | 'mph';
    depth: 'meters' | 'feet' | 'fathoms';
    temperature: 'celsius' | 'fahrenheit';
  };
  size?: 'normal' | 'minimized';
}

const InstrumentPanel: React.FC<InstrumentPanelProps> = ({ data, config, units, size = 'normal' }) => {
  if (!config.visible) return null;

  const renderInstrument = () => {
    const instrumentSize = size === 'minimized' ? 100 : 200;
    const gpsSize = size === 'minimized' ? { width: 200, height: 100 } : { width: 400, height: 200 };
    
    switch (config.type) {
      case 'speed':
        return <Speedometer data={data.speed} unit={units.speed} size={instrumentSize} />;
      case 'compass':
        return <Compass data={data.compass} size={instrumentSize} />;
      case 'wind':
        return <WindIndicator data={data.wind} unit={units.speed} size={instrumentSize} />;
      case 'depth':
        return <DepthSounder data={data.depth} unit={units.depth} size={instrumentSize} />;
      case 'gps':
        return <GPSDisplay 
          position={data.position} 
          gpsTime={data.gpsTime} 
          signalStrength={data.signalStrength}
          size={gpsSize}
        />;
      case 'map':
        return <MapView data={data} size={{ width: '100%', height: '100%' }} />;
      default:
        return <div>Instrument inconnu</div>;
    }
  };

  return (
    <div 
      className="instrument-panel"
      style={{
        gridColumn: `span ${config.size.width}`,
        gridRow: `span ${config.size.height}`
      }}
    >
      <div className="instrument-panel-inner">
        {renderInstrument()}
      </div>
    </div>
  );
};

export default InstrumentPanel;
