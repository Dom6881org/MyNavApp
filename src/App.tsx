import React from 'react';
import { useAISSettings, useNavigationData, useDashboardLayout, useTrackRecorder, useRoutingInput, useRoutingPolar, useRoutingRoute, useGrib } from './hooks';
import { InstrumentPanel, MotionPanel, InstrumentModesPanel, RoutingPanel } from './components';
import BottomInstrumentsPanel from './components/instruments/BottomInstrumentsPanel';
import OverviewPanel from './components/instruments/OverviewPanel';
import HelmPanel from './components/instruments/HelmPanel';
import CoastalPanel from './components/instruments/CoastalPanel';
import { getUiMode } from './utils/instrumentMode';
import type { UiMode } from './utils/instrumentMode';
import { Position } from './types';
import MapView from './components/MapView';
import { isMapProfilingEnabled, reportMapPerformance } from './utils/mapPerformance';
import './App.css';

const handleMapRender: React.ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) => {
  reportMapPerformance('react-map-commit', actualDuration, {
    id,
    phase,
    baseDuration,
    startTime,
    commitTime
  });
};

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

  // Routage (issue #15) : saisie départ/arrivée, panneau outil de la carte.
  // La polaire du bateau est un paramètre global de l'app (réglages carte).
  const routingPolar = useRoutingPolar();
  const routing = useRoutingInput(navigationData.position, routingPolar.polarId);
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

  // Calcul de la route (issues #17, #103) : le plan seul est envoyé — le serveur
  // est l'autorité du vent (GRIB, sinon repli constant dérivé de son NMEA).
  const routingRoute = useRoutingRoute();
  const { compute: computeRoute } = routingRoute;
  const handleComputeRoute = React.useCallback(() => {
    if (!routing.plan) return;
    void computeRoute(routing.plan);
  }, [routing.plan, computeRoute]);

  // GRIB (issue #16) : téléchargé automatiquement par l'app dès qu'un plan est
  // prêt et que le cache n'est pas frais (zone départ/arrivée + 72 h). À bord,
  // sans réseau, le téléchargement échoue et le panneau affiche l'avertissement
  // de repli sur vent constant.
  const grib = useGrib();
  const lastGribRequestRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!routing.plan || grib.isDownloading) return;
    if (grib.status?.fresh) {
      lastGribRequestRef.current = null;
      return;
    }
    const margin = 1.0;
    const start = routing.plan.startPosition ?? { latitude: 0, longitude: 0 };
    const finish = routing.plan.finishPosition ?? { latitude: 0, longitude: 0 };
    const bounds = {
      south: Math.max(-90, Math.min(start.latitude, finish.latitude) - margin),
      north: Math.min(90, Math.max(start.latitude, finish.latitude) + margin),
      west: Math.max(-180, Math.min(start.longitude, finish.longitude) - margin),
      east: Math.min(180, Math.max(start.longitude, finish.longitude) + margin)
    };
    const key = JSON.stringify({ ...bounds, horizonH: 72 });
    if (lastGribRequestRef.current === key) return;
    lastGribRequestRef.current = key;
    void grib.download(bounds, 72);
  }, [routing.plan, grib]);

  // Apply the selected theme to the document.
  React.useEffect(() => {
    document.documentElement.className = `theme-${layout.theme}`;
  }, [layout.theme]);

  // Refonte instruments Phases 1-2 (#158, #160) : stack HELM/COASTAL/OVERVIEW
  // activée par ?ui=... ou ?helm=1 (rétro-compat) / localStorage — défaut :
  // rendu legacy inchangé.
  const uiMode = getUiMode();

  // #172 : mode actif remonté par la barre de modes — sélecteur en haut
  // pleine largeur ; HELM/COASTAL = scène d'instruments plein écran ;
  // OVERVIEW/ROUTING = tuiles au-dessus de la carte (+ cartouche routing).
  const [activeMode, setActiveMode] = React.useState<UiMode | null>(uiMode);
  const showMap = activeMode === null || activeMode === 'overview' || activeMode === 'prep';
  const showStrip = activeMode === 'overview' || activeMode === 'prep';
  // Menu routing de la carte masqué en OVERVIEW/ROUTING : tout le routing
  // vit dans le cartouche (#172). En legacy il reste sur la carte.
  const hideRoutingTool = activeMode === 'overview' || activeMode === 'prep';

  const renderInstrumentCards = (types: string[], row: 'top' | 'bottom') => layout.instruments    .filter(instrument => types.includes(instrument.type) && instrument.visible)
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

  const mapView = (
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
      gribApi={grib}
      routingPolar={routingPolar}
      hideRoutingTool={hideRoutingTool}
    />
  );
  const profiledMapView = isMapProfilingEnabled()
    ? <React.Profiler id="MapView" onRender={handleMapRender}>{mapView}</React.Profiler>
    : mapView;

  return (
    <div className="app">
      {/* Main content - primary instruments, chart, then secondary instruments */}
      <main className="app-main">
        {/* Legacy (?ui=legacy) : rangées d'instruments + carte, inchangé */}
        {uiMode === null && (
          <div className="main-layout main-layout-instruments-top">
            <aside className="instruments-sidebar">
              <div className="instruments-container instrument-grid instrument-grid-top">
                {renderInstrumentCards(['speed', 'compass'], 'top')}
              </div>
              {/* Capteurs tablette (#152) : gîte / tangage / roulis, front pur */}
              <MotionPanel />
            </aside>
            <div className="map-container">
              {profiledMapView}
            </div>
            {layout.instruments.some(instrument =>
              (instrument.type === 'depth' || instrument.type === 'wind') && instrument.visible
            ) && (
              <aside className="instruments-sidebar instruments-sidebar-bottom">
                <div className="instruments-container instrument-grid instrument-grid-bottom">
                  <BottomInstrumentsPanel data={navigationData} />
                </div>
              </aside>
            )}
          </div>
        )}
        {uiMode !== null && (
          <div className="ui-shell">
            {/* #172 : choix des vues en haut, sur toute la largeur de l'écran */}
            <div className="ui-mode-topbar">
              <InstrumentModesPanel
                data={navigationData}
                initialMode={uiMode}
                onModeChange={setActiveMode}
              />
            </div>
            {/* HELM : panneau seul, plein écran — retour terrain Dom :
                MOTION et rangée basse (WIND/DEPTH) retirés, ils dupliquent
                le vent et la profondeur déjà dans les compacts HELM (#180). */}
            {activeMode === 'helm' && (
              <div className="ui-stage-panels ui-stage-helm">
                <HelmPanel data={navigationData} />
              </div>
            )}
            {/* COASTAL : les instruments remplissent l'écran —
                l'emplacement de la carte ne reste jamais vide (#172) */}
            {activeMode === 'coastal' && (
              <div className="ui-stage-panels">
                <CoastalPanel data={navigationData} />
                <MotionPanel />
                <div className="ui-stage-bottom">
                  <BottomInstrumentsPanel data={navigationData} />
                </div>
              </div>
            )}
            {/* OVERVIEW / ROUTING : indicateurs en tuiles au-dessus de la carte */}
            {(showMap && (activeMode === 'overview' || activeMode === 'prep')) && (
              <div className="ui-stage-map">
                {showStrip && (
                  <div className="overview-strip">
                    <OverviewPanel data={navigationData} />
                  </div>
                )}
                {/* Carte + cartouche : la carte occupe tout l'espace libre (#174) */}
                <div className="ui-stage-map-body">
                <div className="map-container">
                  {profiledMapView}
                </div>
                {/* ROUTING : tout le routing dans le cartouche (#172) */}
                {activeMode === 'prep' && (
                  <aside className="routing-cartouche">
                    <RoutingPanel
                      routing={routing}
                      polarName={routingPolar?.polarName}
                      pickTarget={routingPickTarget}
                      onRequestPick={handleRoutingPickRequest}
                      onClose={() => setActiveMode('prep')}
                      routeCalc={routingRoute}
                      onComputeRoute={handleComputeRoute}
                      gribCalc={grib}
                    />
                    <MotionPanel />
                  </aside>
                )}
                </div>
              </div>
            )}
          </div>
        )}
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
