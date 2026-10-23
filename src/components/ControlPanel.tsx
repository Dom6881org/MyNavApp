import React from 'react';
import { DashboardLayout } from '../types';

interface ControlPanelProps {
  layout: DashboardLayout;
  isGPSEnabled: boolean;
  gpsStatus: {
    isConnected: boolean;
    error: string | null;
    accuracy: number | null;
    lastUpdate: number | null;
  };
  hasGPS: boolean;
  onToggleGPSConnection: () => void;
  onThemeChange: (theme: 'light' | 'dark' | 'night') => void;
  onUnitChange: (unitType: keyof DashboardLayout['units'], value: any) => void;
  onToggleInstrumentVisibility: (id: string) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  layout,
  isGPSEnabled,
  gpsStatus,
  hasGPS,
  onToggleGPSConnection,
  onThemeChange,
  onUnitChange,
  onToggleInstrumentVisibility
}) => {
  const depthInstrument = layout.instruments.find(instrument => instrument.type === 'depth');
  const gpsInstrument = layout.instruments.find(instrument => instrument.type === 'gps');

  return (
    <div className="control-panel">
      {/* Connection section */}
      <div className="control-section">
        <h3>Connection</h3>
        
        {/* GPS Connection */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}>
            <button 
              onClick={onToggleGPSConnection}
              className={`connection-button gps-button ${isGPSEnabled ? 'connected' : 'disconnected'}`}
              disabled={!hasGPS}
              style={{ flex: 1 }}
            >
              {isGPSEnabled
                ? gpsStatus.isConnected ? 'GPS: Connected' : gpsStatus.error ? 'GPS: Retry' : 'GPS: Searching…'
                : 'GPS: Start'}
            </button>
          </div>
          
          {/* GPS Status */}
          <div style={{
              fontSize: '0.85rem',
              color: gpsStatus.isConnected ? 'var(--accent-color)' : 'var(--warning-color)',
              padding: '0.5rem',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px'
            }}>
              {gpsStatus.isConnected
                ? `Position received · accuracy ±${gpsStatus.accuracy?.toFixed(0) ?? '?'} m`
                : gpsStatus.error
                  ? `⚠️ ${gpsStatus.error}`
                  : '⏳ Allow location access and wait for a GPS fix.'}
          </div>
        </div>

      </div>

      <div className="control-section">
        <h3>Instruments</h3>
        <label className="instrument-visibility-option">
          <input
            type="checkbox"
            checked={depthInstrument?.visible ?? true}
            onChange={() => depthInstrument && onToggleInstrumentVisibility(depthInstrument.id)}
          />
          <span>Show depth</span>
        </label>
        <label className="instrument-visibility-option">
          <input
            type="checkbox"
            checked={gpsInstrument?.visible ?? true}
            onChange={() => gpsInstrument && onToggleInstrumentVisibility(gpsInstrument.id)}
          />
          <span>Show GPS</span>
        </label>
      </div>

      <div className="control-section">
        <h3>Theme</h3>
        <div className="theme-selector">
          {['light', 'dark', 'night'].map(theme => (
            <button
              key={theme}
              onClick={() => onThemeChange(theme as 'light' | 'dark' | 'night')}
              className={`theme-button ${layout.theme === theme ? 'active' : ''}`}
            >
              {theme.charAt(0).toUpperCase() + theme.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="control-section">
        <h3>Units</h3>
        <div className="unit-selector">
          <div className="unit-group">
            <label>Speed:</label>
            <select 
              value={layout.units.speed}
              onChange={(e) => onUnitChange('speed', e.target.value as 'knots' | 'kmh' | 'mph')}
            >
              <option value="knots">Knots</option>
              <option value="kmh">km/h</option>
              <option value="mph">mph</option>
            </select>
          </div>
          <div className="unit-group">
            <label>Depth:</label>
            <select 
              value={layout.units.depth}
              onChange={(e) => onUnitChange('depth', e.target.value as 'meters' | 'feet' | 'fathoms')}
            >
              <option value="meters">Meters</option>
              <option value="feet">Feet</option>
              <option value="fathoms">Fathoms</option>
            </select>
          </div>
          <div className="unit-group">
            <label>Temperature:</label>
            <select 
              value={layout.units.temperature}
              onChange={(e) => onUnitChange('temperature', e.target.value as 'celsius' | 'fahrenheit')}
            >
              <option value="celsius">Celsius</option>
              <option value="fahrenheit">Fahrenheit</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
