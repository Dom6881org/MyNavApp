import React, { useState } from 'react';
import { useNavigationData, useDashboardLayout } from './hooks';
import { InstrumentPanel } from './components';
import SettingsPage from './components/SettingsPage';
import MapView from './components/MapView';
import './App.css';

type TabType = 'dashboard' | 'settings' | 'map';

const App: React.FC = () => {
  const {
    navigationData,
    isConnected,
    isGPSEnabled,
    dataSource,
    gpsStatus,
    hasGPS,
    toggleConnection,
    toggleGPSConnection,
    resetData
  } = useNavigationData(1000);
  
  const {
    layout,
    setTheme,
    setUnit
  } = useDashboardLayout();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // Appliquer le thème au document
  React.useEffect(() => {
    document.documentElement.className = `theme-${layout.theme}`;
  }, [layout.theme]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-title">
          <h1>MyNavApp - Tableau de bord de navigation</h1>
        </div>
        
        <div className="header-info">
          {/* GPS Status Indicator */}
          <span 
            className={`gps-status ${gpsStatus.isConnected ? 'connected' : 'disconnected'}`}
            title={gpsStatus.isConnected ? `GPS: ${gpsStatus.accuracy?.toFixed(0)}m` : gpsStatus.error || 'GPS non connecté'}
          >
            {dataSource === 'gps' ? (
              gpsStatus.isConnected ? '📡 GPS' : '📡 GPS...'
            ) : (
              '🎮 SIM'
            )}
          </span>
          
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Connecté' : 'Déconnecté'}
          </span>
          
          <span className="battery-indicator">
            Batterie: {navigationData.batteryVoltage.toFixed(1)}V
          </span>
        </div>
      </header>

      {/* Navigation tabs */}
      <nav className="app-nav">
        <button
          className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Tableau de bord
        </button>
        <button
          className={`nav-tab ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          Carte
        </button>
        <button
          className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Paramètres
        </button>
      </nav>

      {/* Main content */}
      <main className="app-main">
        {activeTab === 'dashboard' ? (
          <div className="dashboard">
            <div className="instruments-grid">
              {layout.instruments
                .filter(instr => instr.visible && instr.type !== 'map')
                .map(instrument => (
                  <InstrumentPanel
                    key={instrument.id}
                    data={navigationData}
                    config={instrument}
                    units={layout.units}
                  />
                ))}
            </div>
          </div>
        ) : activeTab === 'map' ? (
          <div className="map-container">
            <MapView data={navigationData} size={{ width: '100%', height: '100%' }} />
          </div>
        ) : (
          <SettingsPage
            layout={layout}
            isConnected={isConnected}
            isGPSEnabled={isGPSEnabled}
            dataSource={dataSource}
            gpsStatus={gpsStatus}
            hasGPS={hasGPS}
            onToggleConnection={toggleConnection}
            onToggleGPSConnection={toggleGPSConnection}
            onThemeChange={setTheme}
            onUnitChange={setUnit}
            onReset={resetData}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>MyNavApp - Application de navigation personnelle</p>
      </footer>
    </div>
  );
};

export default App;
