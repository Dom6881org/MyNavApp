import React from 'react';
import { DashboardLayout } from '../types';
import ControlPanel from './ControlPanel';

interface SettingsPageProps {
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
  onClose?: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({
  layout,
  isGPSEnabled,
  gpsStatus,
  hasGPS,
  onToggleGPSConnection,
  onThemeChange,
  onUnitChange,
  onClose
}) => {
  return (
    <div className="settings-page">
      <div className="settings-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Settings</h2>
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
        <p>Configure your dashboard</p>
      </div>
      
      <div className="settings-content">
        <ControlPanel
          layout={layout}
          isGPSEnabled={isGPSEnabled}
          gpsStatus={gpsStatus}
          hasGPS={hasGPS}
          onToggleGPSConnection={onToggleGPSConnection}
          onThemeChange={onThemeChange}
          onUnitChange={onUnitChange}
        />
      </div>
    </div>
  );
};

export default SettingsPage;
