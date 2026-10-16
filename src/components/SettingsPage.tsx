import React from 'react';
import { DashboardLayout } from '../types';
import ControlPanel from './ControlPanel';

interface SettingsPageProps {
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
  onClose?: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({
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
  onReset,
  onClose
}) => {
  return (
    <div className="settings-page">
      <div className="settings-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Paramètres</h2>
          {onClose && (
            <button 
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '0.3rem 0.6rem'
              }}
            >
              ✕
            </button>
          )}
        </div>
        <p>Configurez votre tableau de bord</p>
      </div>
      
      <div className="settings-content">
        <ControlPanel
          layout={layout}
          isConnected={isConnected}
          isGPSEnabled={isGPSEnabled}
          dataSource={dataSource}
          gpsStatus={gpsStatus}
          hasGPS={hasGPS}
          onToggleConnection={onToggleConnection}
          onToggleGPSConnection={onToggleGPSConnection}
          onThemeChange={onThemeChange}
          onUnitChange={onUnitChange}
          onReset={onReset}
        />
      </div>
    </div>
  );
};

export default SettingsPage;
