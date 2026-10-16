import React from 'react';
import { useNavigationData, useDashboardLayout } from './hooks';
import { InstrumentPanel, ControlPanel } from './components';
import './App.css';

const App: React.FC = () => {
  const { navigationData, isConnected, toggleConnection, resetData } = useNavigationData(1000);
  const {
    layout,
    setTheme,
    setUnit
  } = useDashboardLayout();

  // Appliquer le thème au document
  React.useEffect(() => {
    document.documentElement.className = `theme-${layout.theme}`;
  }, [layout.theme]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>MyNavApp - Tableau de bord de navigation</h1>
        <div className="header-info">
          <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Connecté' : 'Déconnecté'}
          </span>
          <span className="battery-indicator">
            Batterie: {navigationData.batteryVoltage.toFixed(1)}V
          </span>
        </div>
      </header>

      <main className="dashboard">
        <div className="instruments-grid">
          {layout.instruments
            .filter(instr => instr.visible)
            .map(instrument => (
              <InstrumentPanel
                key={instrument.id}
                data={navigationData}
                config={instrument}
                units={layout.units}
              />
            ))}
        </div>

        <aside className="sidebar">
          <ControlPanel
            layout={layout}
            isConnected={isConnected}
            onToggleConnection={toggleConnection}
            onThemeChange={setTheme}
            onUnitChange={setUnit}
            onReset={resetData}
          />
        </aside>
      </main>

      <footer className="app-footer">
        <p>MyNavApp - Application de navigation personnelle</p>
      </footer>
    </div>
  );
};

export default App;
