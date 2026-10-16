import React, { useState } from 'react';
import { useNavigationData, useDashboardLayout } from './hooks';
import { InstrumentPanel } from './components';
import SettingsPage from './components/SettingsPage';
import MapView from './components/MapView';
import './App.css';

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
    setUnit,
    toggleInstrumentVisibility
  } = useDashboardLayout();

  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [collapsedInstruments, setCollapsedInstruments] = useState<Record<string, boolean>>({});

  // Appliquer le thème au document
  React.useEffect(() => {
    document.documentElement.className = `theme-${layout.theme}`;
  }, [layout.theme]);

  // Initialize collapsed state for all instruments
  React.useEffect(() => {
    const initialCollapsed: Record<string, boolean> = {};
    layout.instruments.forEach(instr => {
      initialCollapsed[instr.id] = false;
    });
    setCollapsedInstruments(initialCollapsed);
  }, [layout.instruments]);

  // Toggle collapse for a specific instrument
  const toggleCollapse = (id: string) => {
    setCollapsedInstruments(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Toggle all instruments collapsed/expanded
  const toggleAllCollapse = () => {
    const allCollapsed = Object.values(collapsedInstruments).every(v => v);
    const newState: Record<string, boolean> = {};
    layout.instruments.forEach(instr => {
      newState[instr.id] = !allCollapsed;
    });
    setCollapsedInstruments(newState);
  };

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
          
          {/* Settings button */}
          <button
            className="settings-button"
            onClick={() => setShowSettings(true)}
            title="Paramètres"
          >
            ⚙️
          </button>
          
          {/* Collapse all button */}
          <button
            className="collapse-button"
            onClick={toggleAllCollapse}
            title={Object.values(collapsedInstruments).every(v => v) ? 'Tout développer' : 'Tout réduire'}
          >
            {Object.values(collapsedInstruments).every(v => v) ? '⤢' : '⤣'}
          </button>
        </div>
      </header>

      {/* Main content - Split layout: instruments on left, map on right */}
      <main className="app-main">
        <div className="main-layout">
          {/* Left sidebar - Instruments */}
          <aside className="instruments-sidebar">
            <div className="instruments-container">
              {layout.instruments
                .filter(instr => instr.visible && instr.type !== 'map')
                .map(instrument => {
                  const isCollapsed = collapsedInstruments[instrument.id] || false;
                  
                  return (
                    <div 
                      key={instrument.id}
                      className={`instrument-wrapper ${isCollapsed ? 'collapsed' : ''}`}
                    >
                      {/* Instrument header with collapse button */}
                      <div className="instrument-header-with-controls">
                        <span className="instrument-title">
                          {instrument.title}
                        </span>
                        <div className="instrument-controls">
                          <button 
                            className="collapse-toggle"
                            onClick={() => toggleCollapse(instrument.id)}
                            title={isCollapsed ? 'Développer' : 'Réduire'}
                          >
                            {isCollapsed ? '⤢' : '⤣'}
                          </button>
                          <button 
                            className="visibility-toggle"
                            onClick={() => toggleInstrumentVisibility(instrument.id)}
                            title={instrument.visible ? 'Masquer' : 'Afficher'}
                          >
                            {instrument.visible ? '👁️' : '👁️‍🗨'}
                          </button>
                        </div>
                      </div>
                      
                      {/* Instrument content (collapsed or full) */}
                      <div className="instrument-content">
                        {isCollapsed ? (
                          <div className="instrument-minimized">
                            <InstrumentPanel
                              data={navigationData}
                              config={instrument}
                              units={layout.units}
                            />
                          </div>
                        ) : (
                          <InstrumentPanel
                            data={navigationData}
                            config={instrument}
                            units={layout.units}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </aside>
          
          {/* Right side - Map */}
          <div className="map-container">
            <MapView data={navigationData} size={{ width: '100%', height: '100%' }} />
          </div>
        </div>
      </main>

      {/* Settings modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
              onClose={() => setShowSettings(false)}
            />
          </div>
        </div>
      )}

      <footer className="app-footer">
        <p>MyNavApp - Tableau de bord de navigation personnelle</p>
      </footer>
    </div>
  );
};

export default App;
