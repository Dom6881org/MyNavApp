import React from 'react';
import { DashboardLayout } from '../types';

interface ControlPanelProps {
  layout: DashboardLayout;
  isConnected: boolean;
  onToggleConnection: () => void;
  onThemeChange: (theme: 'light' | 'dark' | 'night') => void;
  onUnitChange: (unitType: keyof DashboardLayout['units'], value: any) => void;
  onReset: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  layout,
  isConnected,
  onToggleConnection,
  onThemeChange,
  onUnitChange,
  onReset
}) => {
  return (
    <div className="control-panel">
      <div className="control-section">
        <h3>Connexion</h3>
        <button 
          onClick={onToggleConnection}
          className={`connection-button ${isConnected ? 'connected' : 'disconnected'}`}
        >
          {isConnected ? 'Déconnecter' : 'Connecter'}
        </button>
        <button onClick={onReset} className="reset-button">
          Réinitialiser
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
      </div>
    </div>
  );
};

export default ControlPanel;
