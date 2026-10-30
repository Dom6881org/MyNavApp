import React from 'react';
import { useAISSettings, useNavigationData, useDashboardLayout, useTrackRecorder, useRoutingInput, useRoutingRoute } from './hooks';
import { InstrumentPanel } from './components';
import { Position } from './types';
import MapView from './components/MapView';
import './App.css';

const App: React.FC = () => {
  const {
    navigationData,
    resetMaxSpeed,
    requestWindGrid,
    isGPSEnabled,
    gpsStatus,
    navigationSource,
    backendStatus,
    aisState,
    hasGPS,
    toggleGPSConnection
  } = useNavigationData();
  
  const {
    layout,
    setTheme,
    setUnit
  } = useDashboardLayout();

  const aisSettings = useAISSettings(backendStatus.isConnected, aisState);
  const trackRecorder = useTrackRecorder();

  // Routage (issue #15) : saisie départ/arrivée + polaire, panneau outil de la carte.
  const routing = useRoutingInput(navigationData.position);
  const { setStartFromPosition, setFinishFromPosition } = routing;
  const [routingPickTarget, setRoutingPickTarget] = React.useState<'start' | 'finish' | null>(null);
  const handleRoutingPickRequest = React.useCallback((target: 'start' | 'finish') => {
    setRoutingPickTarget(target);
  }, []);
  const handleRoutingMapPick = React.useCallback((position: Position) => {
    if (routingPickTarget === 'start') {
      setStartFromPosition(position);
    } else {
      setFinishFromPosition(position);
    }
    setRoutingPickTarget(null);
  }, [routingPickTarget, setStartFromPosition, setFinishFromPosition]);

  // Calcul de la route (issue #17) : plan courant + vent instruments -> moteur.
  const routingRoute = useRoutingRoute();
  const { compute: computeRoute } = routingRoute;
  const handleComputeRoute = React.useCallback(() => {
    if (!routing.plan) return;
    const wind = navigationData.wind
      ? { directionFromDeg: navigationData.wind.direction, speedKts: navigationData.wind.speed }
      : null;
    void computeRoute(routing.plan, wind);
  }, [routing.plan, navigationData.wind, computeRoute]);

  // Apply the selected theme to the document.
  React.useEffect(() => {
    document.documentElement.className = `theme-${layout.theme}`;
  }, [layout.theme]);

  const renderInstrumentCards = (types: string[], row: 'top' | 'bottom') => layout.instruments
    .filter(instrument => types.includes(instrument.type) && instrument.visible)
    .map(instrument => (
      <div
        key={instrument.id}
        className={`instrument-wrapper instrument-wrapper-${instrument.type} instrument-row-${row}`}
      >
        <div className="instrument-card-header">
          <span className="instrument-title">{getInstrumentTitle(instrument.type)}</span>
          {instrument.type === 'depth' && navigationData.depth?.alarm && (
            <span className="instrument-wrapper-alarm" role="status">ALARM</span>
          )}
        </div>
        <div className="instrument-content">
          <InstrumentPanel
            data={navigationData}
            config={{ ...instrument, visible: true }}
            units={layout.units}
            onResetMaxSpeed={resetMaxSpeed}
          />
        </div>
      </div>
    ));

  return (
    <div className="app">
      {/* Main content - primary instruments, chart, then secondary instruments */}
      <main className="app-main">
        <div className="main-layout main-layout-instruments-top">
          <aside className="instruments-sidebar">
            <div className="instruments-container instrument-grid instrument-grid-top">
              {renderInstrumentCards(['speed', 'compass'], 'top')}
            </div>
          </aside>
          
          <div className="map-container">
            <MapView
              data={navigationData}
              onWindGridRequest={requestWindGrid}
              aisTargets={aisState?.targets ?? []}
              aisState={aisState}
              showAIS={aisSettings.isVisible}
              aisSource={aisSettings.source}
              onAISSourceChange={aisSettings.setSource}
              onAISVisibilityChange={aisSettings.setIsVisible}
              layout={layout}
              onThemeChange={setTheme}
              onUnitChange={setUnit}
              onToggleGPSConnection={toggleGPSConnection}
              gpsStatus={gpsStatus}
              navigationSource={navigationSource}
              hasGPS={hasGPS}
              isGPSEnabled={isGPSEnabled}
              backendStatus={backendStatus}
              trackRecorder={trackRecorder}
              size={{ width: '100%', height: '100%' }}
              onRoutingMapPick={handleRoutingMapPick}
              routingPickTarget={routingPickTarget}
              routing={routing}
              onRoutingPickRequest={handleRoutingPickRequest}
              routingRoute={routingRoute}
              onRoutingCompute={handleComputeRoute}
            />
          </div>

          {layout.instruments.some(instrument =>
            (instrument.type === 'depth' || instrument.type === 'wind') && instrument.visible
          ) && (
            <aside className="instruments-sidebar instruments-sidebar-bottom">
              <div className="instruments-container instrument-grid instrument-grid-bottom">
                {renderInstrumentCards(['wind', 'depth'], 'bottom')}
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
};

const getInstrumentTitle = (type: string): string => {
  switch (type) {
    case 'speed': return 'SPEED';
    case 'compass': return 'COURSE';
    case 'wind': return 'WIND';
    case 'depth': return 'DEPTH';
    default: return type.toUpperCase();
  }
};

export default App;
