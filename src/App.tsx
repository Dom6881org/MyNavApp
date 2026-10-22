import React, { useState } from 'react';
import { useNavigationData, useDashboardLayout } from './hooks';
import { InstrumentPanel } from './components';
import SettingsPage from './components/SettingsPage';
import MapView from './components/MapView';
import './App.css';

const App: React.FC = () => {
  const {
    navigationData,
    requestWindGrid,
    isGPSEnabled,
    gpsStatus,
    hasGPS,
    toggleGPSConnection
  } = useNavigationData();
  
  const {
    layout,
    setTheme,
    setUnit
  } = useDashboardLayout();

  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Apply the selected theme to the document.
  React.useEffect(() => {
    document.documentElement.className = `theme-${layout.theme}`;
  }, [layout.theme]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-title">
          <h1>MyNavApp - Marine Navigation Dashboard</h1>
        </div>
        
        <div className="header-info">
          {/* GPS Status Indicator */}
          <span 
            className={`gps-status ${gpsStatus.isConnected ? 'connected' : 'disconnected'}`}
            title={gpsStatus.error || (gpsStatus.isConnected ? `GPS accuracy: ±${gpsStatus.accuracy?.toFixed(0) ?? '?'} m` : 'Waiting for GPS fix')}
          >
            {gpsStatus.isConnected
              ? `📡 GPS · ±${gpsStatus.accuracy?.toFixed(0) ?? '?'} m`
              : !hasGPS ? '📡 GPS unavailable' : !isGPSEnabled ? '📡 GPS stopped' : gpsStatus.error ? '📡 GPS · error' : '📡 GPS waiting'}
          </span>
          
          {/* Settings button */}
          <button
            className="settings-button"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙️
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
                .filter(instr => instr.type !== 'map')
                .map(instrument => {
                  return (
                    <div 
                      key={instrument.id}
                      className={`instrument-wrapper instrument-wrapper-${instrument.type}`}
                    >
                      {/* Instrument heading */}
                      <div className="instrument-card-header">
                        <span className="instrument-title">
                          {getInstrumentTitle(instrument.type)}
                        </span>
                        {instrument.type === 'depth' && navigationData.depth?.alarm && (
                          <span className="instrument-wrapper-alarm" role="status">
                            ALARM
                          </span>
                        )}
                      </div>
                      
                      {/* Instrument content */}
                      <div className="instrument-content">
                        <InstrumentPanel
                          data={navigationData}
                          config={{ ...instrument, visible: true }}
                          units={layout.units}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </aside>
          
          {/* Right side - Map */}
          <div className="map-container">
            <MapView
              data={navigationData}
              onWindGridRequest={requestWindGrid}
              size={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
      </main>

      {/* Settings modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <SettingsPage
              layout={layout}
              isGPSEnabled={isGPSEnabled}
              gpsStatus={gpsStatus}
              hasGPS={hasGPS}
              onToggleGPSConnection={toggleGPSConnection}
              onThemeChange={setTheme}
              onUnitChange={setUnit}
              onClose={() => setShowSettings(false)}
            />
          </div>
        </div>
      )}

      <footer className="app-footer">
        <p>MyNavApp · Personal Marine Navigation Dashboard</p>
      </footer>
    </div>
  );
};

const getInstrumentTitle = (type: string): string => {
  switch (type) {
    case 'speed': return 'SPEED';
    case 'compass': return 'COURSE';
    case 'wind': return 'WIND';
    case 'depth': return 'DEPTH';
    case 'gps': return 'GPS';
    default: return type.toUpperCase();
  }
};

export default App;
