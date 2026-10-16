import React from 'react';
import { DashboardLayout } from '../types';

interface ControlPanelProps {
  layout: DashboardLayout;
  isConnected: boolean;
  isGPSEnabled: boolean;
  dataSource: 'simulation' | 'gps';
  gpsStatus: {
    isConnected: boolean;
    error: string | null;
    accuracy: number | null;
    lastUpdate: number | null;
  };
  hasGPS: boolean;
  onToggleConnection: () => void;
  onToggleGPSConnection: () => void;
  onThemeChange: (theme: 'light' | 'dark' | 'night') => void;
  onUnitChange: (unitType: keyof DashboardLayout['units'], value: any) => void;
  onReset: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  layout,
  isConnected,
  isGPSEnabled,
  dataSource,
  gpsStatus,
  hasGPS,
  onToggleConnection,
  onToggleGPSConnection,
  onThemeChange,
  onUnitChange,
  onReset
}) => {
  return (
    <div className="control-panel">
      {/* Connection section */}
      <div className="control-section">
        <h3>Connexion</h3>
        
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
              {isGPSEnabled ? 'GPS: Connecté' : 'GPS: Déconnecté'}
            </button>
          </div>
          
          {/* GPS Status */}
          {isGPSEnabled && (
            <div style={{
              fontSize: '0.85rem',
              color: gpsStatus.isConnected ? 'var(--accent-color)' : 'var(--warning-color)',
              padding: '0.5rem',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px'
            }}>
              {gpsStatus.isConnected ? (
                <>
                  <span>Précision: {gpsStatus.accuracy?.toFixed(0)}m</span>
                  {gpsStatus.lastUpdate && (
                    <span style={{ marginLeft: '0.5rem' }}>
                      • Mis à jour il y a {Math.floor((Date.now() - gpsStatus.lastUpdate) / 1000)}s
                    </span>
                  )}
                </>
              ) : gpsStatus.error ? (
                <span>⚠️ {gpsStatus.error}</span>
              ) : (
                <span>⏳ En attente de signal GPS...</span>
              )}
            </div>
          )}
        </div>

        {/* Simulation Connection */}
        <div style={{ marginBottom: '1rem' }}>
          <button 
            onClick={onToggleConnection}
            className={`connection-button ${isConnected ? 'connected' : 'disconnected'}`}
            style={{ width: '100%' }}
          >
            {isConnected ? 'Simulation: Active' : 'Simulation: Inactive'}
          </button>
        </div>

        <button onClick={onReset} className="reset-button" style={{ width: '100%' }}>
          Réinitialiser les données
        </button>
      </div>

      <div className="control-section">
        <h3>Thème</h3>
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
        <h3>Unités</h3>
        <div className="unit-selector">
          <div className="unit-group">
            <label>Vitesse:</label>
            <select 
              value={layout.units.speed}
              onChange={(e) => onUnitChange('speed', e.target.value as 'knots' | 'kmh' | 'mph')}
              disabled={isGPSEnabled}
            >
              <option value="knots">Nœuds</option>
              <option value="kmh">km/h</option>
              <option value="mph">mph</option>
            </select>
          </div>
          <div className="unit-group">
            <label>Profondeur:</label>
            <select 
              value={layout.units.depth}
              onChange={(e) => onUnitChange('depth', e.target.value as 'meters' | 'feet' | 'fathoms')}
            >
              <option value="meters">Mètres</option>
              <option value="feet">Pieds</option>
              <option value="fathoms">Brasses</option>
            </select>
          </div>
          <div className="unit-group">
            <label>Température:</label>
            <select 
              value={layout.units.temperature}
              onChange={(e) => onUnitChange('temperature', e.target.value as 'celsius' | 'fahrenheit')}
            >
              <option value="celsius">Celsius</option>
              <option value="fahrenheit">Fahrenheit</option>
            </select>
          </div>
        </div>
        
        {/* Mode indicator */}
        <div style={{
          marginTop: '1rem',
          padding: '0.5rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          background: 'rgba(0, 0, 0, 0.1)',
          borderRadius: '4px'
        }}>
          <strong>Mode:</strong> {dataSource === 'gps' ? '📡 GPS Réel' : '🎮 Simulation'}
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
