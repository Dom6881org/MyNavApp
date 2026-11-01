import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as LeafletBundle from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@tomickigrzegorz/leaflet-rotate';
import { AISBackendState, AISSource, AISTarget, DashboardLayout, NavigationData, Position, TrackRecorderStatus, TrackSummary, UnitChangeHandler, WindData } from '../types';
import ControlPanel, { MapBaseStyle } from './ControlPanel';
import RoutingPanel, { RoutingPickTarget } from './RoutingPanel';
import MapPositionReadout from './MapPositionReadout';
import AppLogo from './AppLogo';
import { RoutingInput } from '../hooks/useRoutingInput';
import { RoutingPolarApi } from '../hooks/useRoutingPolar';
import { RoutingRouteApi } from '../hooks/useRoutingRoute';
import { GribApi } from '../hooks/useGrib';
import { buildWindLattice, barbPositionKey } from '../utils/windLattice';
import { isMapProfilingEnabled, reportMapPerformance } from '../utils/mapPerformance';

// Extend Window interface for Leaflet
declare global {
  interface Window {
    L: LeafletObject;
  }
}

// Leaflet is loaded from a CDN script without bundled typings.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletObject = any;

// Issue #39 : pane dédié pour les barbes de vent — au-dessus des tuiles (z 200)
// mais sous toutes les autres couches : tracks/vecteur/routage (overlayPane z 400),
// bateau et AIS (markerPane z 600).
const WIND_BARB_PANE = 'wind-barbs';
const TOOLTIP_CLASS = 'nav-tooltip';
const POPUP_OPTIONS = { className: 'nav-popup', closeButton: false, minWidth: 170 };

interface MapViewSimpleProps {
  data: NavigationData;
  onWindGridRequest?: (visible: Position[], prefetch?: Position[]) => void;
  onRoutingMapPick?: (position: Position) => void;
  routingPickTarget?: RoutingPickTarget | null;
  routing?: RoutingInput;
  onRoutingPickRequest?: (target: RoutingPickTarget) => void;
  routingRoute?: RoutingRouteApi;
  onRoutingCompute?: () => void;
  gribApi?: GribApi;
  routingPolar?: RoutingPolarApi;
  aisTargets?: AISTarget[];
  aisState?: AISBackendState | null;
  showAIS?: boolean;
  aisSource?: AISSource;
  onAISSourceChange?: (source: AISSource) => void;
  onAISVisibilityChange?: (visible: boolean) => void;
  layout?: DashboardLayout;
  onThemeChange?: (theme: 'light' | 'dark' | 'night') => void;
  onUnitChange?: UnitChangeHandler;
  onToggleGPSConnection?: () => void;
  gpsStatus?: GPSStatus;
  navigationSource?: 'nmea' | 'browser' | 'none';
  hasGPS?: boolean;
  isGPSEnabled?: boolean;
  backendStatus?: { isConnected: boolean; error?: string | null };
  trackRecorder?: TrackRecorderControls;
  size?: { width: number | string; height: number | string };
}

type TrackRecorderControls = {
  status: TrackRecorderStatus | null;
  tracks: TrackSummary[];
  error: string | null;
  isBusy: boolean;
  refresh: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  remove: (trackId: string) => Promise<void>;
};

type MapOrientation = 'north' | 'heading' | 'course';
const ORIENTATION_ORDER: MapOrientation[] = ['north', 'heading', 'course'];
const ORIENTATION_LABELS: Record<MapOrientation, string> = {
  north: 'North up',
  heading: 'Heading up',
  course: 'Course up'
};
const ORIENTATION_BADGES: Record<MapOrientation, string> = { north: 'N', heading: 'H', course: 'C' };
const nextOrientation = (current: MapOrientation): MapOrientation =>
  ORIENTATION_ORDER[(ORIENTATION_ORDER.indexOf(current) + 1) % ORIENTATION_ORDER.length];
type MapToolPanel = 'ais' | 'weather' | 'gps' | 'track' | 'routing' | 'settings' | 'about' | null;
const NAVIGATION_SOURCE_LABELS: Record<NonNullable<MapViewSimpleProps['navigationSource']>, string> = {
  nmea: 'NMEA (backend)',
  browser: 'Browser GPS',
  none: 'No position source'
};
type GPSStatus = {
  isConnected: boolean;
  error: string | null;
  accuracy: number | null;
  lastUpdate: number | null;
};

/**
 * Marine chart with OpenStreetMap base tiles and OpenSeaMap navigation marks.
 */
const MapViewSimple: React.FC<MapViewSimpleProps> = ({
  data,
  onWindGridRequest,
  onRoutingMapPick,
  routingPickTarget = null,
  routing,
  onRoutingPickRequest,
  routingRoute,
  onRoutingCompute,
  gribApi,
  routingPolar,
  aisTargets = [],
  aisState = null,
  showAIS = false,
  aisSource = 'local',
  onAISSourceChange,
  onAISVisibilityChange,
  layout,
  onThemeChange,
  onUnitChange,
  onToggleGPSConnection,
  gpsStatus,
  navigationSource = 'none',
  hasGPS = true,
  isGPSEnabled = true,
  backendStatus,
  trackRecorder,
  size
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletObject>(null);
  // Issue #50: layer de vent persistant + marqueurs réutilisés entre les ticks
  // de navigation, pour qu'aucune mise à jour de position ne la reconstruise.
  const flowLayerRef = useRef<LeafletObject>(null);
  const barbMarkersRef = useRef<Map<string, { marker: LeafletObject; speed: number; direction: number }>>(new Map());
  const [mapInstance, setMapInstance] = useState<LeafletObject>(null);
  const [leafletLoaded, setLeafletLoaded] = useState<boolean>(false);
  const [rotationAvailable, setRotationAvailable] = useState<boolean>(false);
  const [rotationUnavailable, setRotationUnavailable] = useState<boolean>(false);
  const [leafletError, setLeafletError] = useState<boolean>(false);
  const [mapOrientation, setMapOrientation] = useState<MapOrientation>('north');
  const [activeMapTool, setActiveMapTool] = useState<MapToolPanel>(null);
  const [showWindLayer, setShowWindLayer] = useState(true);
  const [followVessel, setFollowVessel] = useState(true);
  // Live elapsed time for the REC badge while the backend records the track.
  const isTrackRecording = Boolean(trackRecorder?.status?.recording);
  const [recordingNow, setRecordingNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!isTrackRecording) return;
    setRecordingNow(Date.now());
    const timerId = window.setInterval(() => setRecordingNow(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, [isTrackRecording]);
  const [mapBaseStyle, setMapBaseStyle] = useState<MapBaseStyle>(() => {
    try {
      const stored = localStorage.getItem('mapBaseStyle');
      return stored === 'muted' || stored === 'faded' ? stored : 'standard';
    } catch {
      return 'standard';
    }
  });
  const changeMapBaseStyle = (style: MapBaseStyle) => {
    setMapBaseStyle(style);
    try {
      localStorage.setItem('mapBaseStyle', style);
    } catch {
      // Storage unavailable: the choice only lasts for this session.
    }
  };
  const canOpenSettings = Boolean(
    layout && gpsStatus && onThemeChange && onUnitChange && onToggleGPSConnection
  );
  const aisMarkersRef = useRef<Map<string, LeafletObject>>(new Map());
  const lastBearingRef = useRef<number | null>(null);
  const visibleAISTargets = useMemo(() => aisTargets.filter(target =>
    Number.isFinite(target.latitude) && Number.isFinite(target.longitude) &&
    target.latitude >= -90 && target.latitude <= 90 &&
    target.longitude >= -180 && target.longitude <= 180
  ), [aisTargets]);
  
  // Load Leaflet library
  useEffect(() => {
    // Leaflet and the rotation plugin are bundled with the app, so the chart
    // works fully offline; tiles are served by the navigation backend.
    window.L = LeafletBundle;
    setLeafletLoaded(true);
    if (window.L?.Map?.prototype?.setBearing) {
      setRotationAvailable(true);
    } else {
      setRotationUnavailable(true);
    }
  }, []);

  // Initialize map when Leaflet is ready
  useEffect(() => {
    if (!leafletLoaded || (!rotationAvailable && !rotationUnavailable) || !mapRef.current || !window.L || leafletError || !data.position) return;
    
    const L = window.L;
    
    try {
      // Check if map already exists
      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current, {
          center: [data.position.latitude, data.position.longitude],
          zoom: 15,
          zoomControl: true,
          attributionControl: true,
          rotate: rotationAvailable,
          dragRotate: false,
          shiftKeyRotate: false,
          touchRotate: false
        });
        
        const baseLayer = createTileLayer(L, 'osm', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          className: 'osm-base-tiles',
          maxZoom: 19,
          keepBuffer: 2,
          updateWhenIdle: true,
          updateWhenZooming: false
        }).addTo(map);
        const seamarkLayer = createTileLayer(L, 'seamark', {
          attribution: '&copy; <a href="https://www.openseamap.org/">OpenSeaMap</a> contributors',
          maxZoom: 18,
          // OpenSeaMap renders almost no marks below ~z12; request z12 tiles and
          // scale them down so marks stay visible on wide views.
          minZoom: 9,
          minNativeZoom: 12,
          opacity: 0.9,
          keepBuffer: 2,
          updateWhenIdle: true,
          updateWhenZooming: false
        }).addTo(map);

        L.control.layers(
          { 'Fond OSM': baseLayer },
          { 'Seamarks & navigation aids': seamarkLayer },
          { collapsed: true, position: 'topright' }
        ).addTo(map);
        L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);
        // Issue #39 : les barbes de vent passent derrière tracks, routage, bateau et AIS.
        const windBarbPane = map.createPane(WIND_BARB_PANE);
        windBarbPane.style.zIndex = '350';
        const trackLine = L.polyline([], {
          color: '#19d3c5',
          weight: 4,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
        
        const heading = data.compass?.heading ?? data.compass?.cog ?? 0;
        const boatIcon = createBoatIcon(L, heading);
        const marker = L.marker([data.position.latitude, data.position.longitude], {
          icon: boatIcon,
          title: `Vessel · ${getHeadingSource(data.compass?.heading)} ${heading.toFixed(0)}°`,
          zIndexOffset: 1000,
          rotateWithView: true
        }).addTo(map);
        
        marker.bindPopup(getVesselPopup(data.position), POPUP_OPTIONS);
        marker.bindTooltip(getVesselTooltip(data), {
          direction: 'top',
          offset: [0, -14],
          opacity: 1,
          className: TOOLTIP_CLASS
        });
        
        const instance = {
          map,
          marker,
          trackLine,
          lastTrackPosition: null as Position | null
        };
        mapInstanceRef.current = instance;
        setMapInstance(instance);
      } else {
        const instance = mapInstanceRef.current;
        const boatPosition = L.latLng(data.position.latitude, data.position.longitude);

        instance.marker.setLatLng(boatPosition);
        instance.marker.setPopupContent(getVesselPopup(data.position));
      }
    } catch (error) {
      console.error('Map error:', error);
      if (!mapInstanceRef.current) setLeafletError(true);
    }
  }, [leafletLoaded, rotationAvailable, rotationUnavailable, data, leafletError]);

  // Dragging the map (user action only) stops following the vessel until "center" is clicked.
  useEffect(() => {
    if (!mapInstance) return;
    const stopFollowing = () => setFollowVessel(false);
    mapInstance.map.on('dragstart', stopFollowing);
    return () => {
      mapInstance.map.off('dragstart', stopFollowing);
    };
  }, [mapInstance]);

  // Routage (issue #15) : transmet les clics carte au panneau de saisie quand un
  // point (depart ou arrivee) est en cours de selection. Le panneau se rouvre
  // automatiquement une fois le point choisi.
  useEffect(() => {
    if (!mapInstance || !routingPickTarget || !onRoutingMapPick) return;
    // leaflet-rotate exposes latlng as a plain object {lat, lng}, while stock
    // Leaflet provides LatLng instances with lat()/lng() methods: support both.
    const handleRoutingPick = (event: { latlng: { lat: number | (() => number); lng: number | (() => number) } }) => {
      const toNumber = (value: number | (() => number)): number =>
        typeof value === 'function' ? value() : value;
      onRoutingMapPick({ latitude: toNumber(event.latlng.lat), longitude: toNumber(event.latlng.lng) });
      setActiveMapTool('routing');
    };
    mapInstance.map.on('click', handleRoutingPick);
    const container = mapInstance.map.getContainer() as HTMLElement;
    container.style.cursor = 'crosshair';
    return () => {
      mapInstance.map.off('click', handleRoutingPick);
      container.style.cursor = '';
    };
  }, [mapInstance, routingPickTarget, onRoutingMapPick]);

  // Route calculée (issue #17) : LineString GeoJSON (ou meilleure progression
  // si found=false) + marqueurs départ/arrivée, sur une couche dédiée.
  useEffect(() => {
    if (!mapInstance || !leafletLoaded || leafletError || !window.L) return;
    const L = window.L;
    const map = mapInstance.map;
    if (!mapInstance.routingLayer) mapInstance.routingLayer = L.layerGroup().addTo(map);
    mapInstance.routingLayer.clearLayers();
    const result = routingRoute?.route;
    if (!result) return;
    // GeoJSON : LineString [lon, lat] ; found=false : coords moteur [lat, lon].
    const latlngs: Array<[number, number]> = result.found && result.geojson
      ? result.geojson.features[0]?.geometry.coordinates.map(([lon, lat]) => [lat, lon]) ?? []
      : result.coords;
    if (latlngs.length < 2) return;
    L.polyline(latlngs, {
      color: '#a78bfa',
      weight: 3,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: result.found ? undefined : '5 6'
    }).addTo(mapInstance.routingLayer);
    L.circleMarker(latlngs[0], {
      radius: 5,
      color: '#a78bfa',
      weight: 2,
      fillColor: '#102532',
      fillOpacity: 1
    }).bindTooltip('Departure', { className: TOOLTIP_CLASS, direction: 'top' }).addTo(mapInstance.routingLayer);
    L.circleMarker(latlngs[latlngs.length - 1], {
      radius: 5,
      color: '#a78bfa',
      weight: 2,
      fillColor: '#a78bfa',
      fillOpacity: 1
    }).bindTooltip('Destination', { className: TOOLTIP_CLASS, direction: 'top' }).addTo(mapInstance.routingLayer);
  }, [mapInstance, leafletLoaded, leafletError, routingRoute?.route]);

  useEffect(() => {
    if (!mapInstance || !followVessel || !data.position) return;
    mapInstance.map.setView([data.position.latitude, data.position.longitude], mapInstance.map.getZoom(), { animate: false });
  }, [mapInstance, followVessel, data.position]);

  useEffect(() => {
    if (!mapInstance || !rotationAvailable || !leafletLoaded || leafletError || !data.position) return;

    const heading = data.compass?.heading ?? data.compass?.cog ?? null;
    const course = data.compass?.cog ?? data.compass?.heading ?? null;
    const selectedBearing = mapOrientation === 'heading'
      ? heading
      : mapOrientation === 'course'
        ? course
        : 0;

    // Keep the last known bearing while the boat has no heading/course (e.g. stopped) instead of snapping back to north.
    if (selectedBearing === null) {
      if (lastBearingRef.current === null || mapOrientation === 'north') return;
    } else {
      lastBearingRef.current = (360 - selectedBearing) % 360;
    }

    mapInstance.map.setBearing(lastBearingRef.current ?? 0);
  }, [mapInstance, rotationAvailable, leafletLoaded, leafletError, mapOrientation, data.position, data.compass?.heading, data.compass?.cog]);

  useEffect(() => {
    if (!mapInstance || !leafletLoaded || leafletError || !window.L) return;

    const position = data.position;
    const previous = mapInstance.lastTrackPosition as Position | null;
    if (position && (position.latitude !== previous?.latitude || position.longitude !== previous?.longitude)) {
      mapInstance.trackLine.addLatLng([position.latitude, position.longitude]);
      mapInstance.lastTrackPosition = position;
    }
  }, [mapInstance, leafletLoaded, leafletError, data.position]);

  useEffect(() => () => {
    mapInstanceRef.current?.map.remove();
    mapInstanceRef.current = null;
    aisMarkersRef.current.clear();
  }, []);

  // Update vectors when data changes
  useEffect(() => {
    if (!mapInstance || !leafletLoaded || leafletError || !window.L || !data.position) return;
    
    const L = window.L;
    const map = mapInstance.map;
    const lat = data.position.latitude;
    const lng = data.position.longitude;
    
    // Clear old vectors
    if (mapInstance.sogLine && map.hasLayer(mapInstance.sogLine)) map.removeLayer(mapInstance.sogLine);
    if (mapInstance.speedLine && map.hasLayer(mapInstance.speedLine)) map.removeLayer(mapInstance.speedLine);
    if (mapInstance.windLine && map.hasLayer(mapInstance.windLine)) map.removeLayer(mapInstance.windLine);
    
    const course = data.compass?.cog ?? data.compass?.heading;
    const speedKnots = data.speed?.sog ?? data.speed?.speed;
    if (course !== null && course !== undefined && speedKnots !== null && speedKnots !== undefined && speedKnots > 0) {
      const courseRad = course * Math.PI / 180;
      const distanceDegrees = (speedKnots * 1852 / 4) / 111320;
      const endLat = lat + Math.cos(courseRad) * distanceDegrees;
      const endLng = lng + Math.sin(courseRad) * distanceDegrees / Math.cos(lat * Math.PI / 180);
      mapInstance.speedLine = L.polyline([[lat, lng], [endLat, endLng]], {
        color: '#123b66',
        weight: 4,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    }
    
    // Update marker
    if (mapInstance.marker) {
      mapInstance.marker.setLatLng([lat, lng]);
      const heading = data.compass?.heading ?? data.compass?.cog ?? 0;
      mapInstance.marker.setIcon(createBoatIcon(L, heading));
      mapInstance.marker.options.title = `Vessel · ${getHeadingSource(data.compass?.heading)} ${heading.toFixed(0)}°`;
      mapInstance.marker.setPopupContent(getVesselPopup(data.position));
      mapInstance.marker.setTooltipContent(getVesselTooltip(data));
    }
  }, [mapInstance, leafletLoaded, leafletError, data]);

  useEffect(() => {
    if (!mapInstance || !leafletLoaded || leafletError || !window.L) return;
    const L = window.L;
    const map = mapInstance.map;
    if (!mapInstance.aisLayer) mapInstance.aisLayer = L.layerGroup().addTo(map);

    const visibleTargets = showAIS ? visibleAISTargets : [];
    const visibleMmsi = new Set(visibleTargets.map(target => target.mmsi));

    for (const [mmsi, marker] of aisMarkersRef.current) {
      if (!visibleMmsi.has(mmsi)) {
        mapInstance.aisLayer.removeLayer(marker);
        aisMarkersRef.current.delete(mmsi);
      }
    }

    for (const target of visibleTargets) {
      const position: [number, number] = [target.latitude, target.longitude];
      const marker = aisMarkersRef.current.get(target.mmsi);
      if (marker) {
        const previous = marker.aisTarget as AISTarget;
        if (previous.latitude !== target.latitude || previous.longitude !== target.longitude) {
          marker.setLatLng(position);
        }
        if (previous.cog !== target.cog || previous.heading !== target.heading) {
          marker.setIcon(createAisIcon(L, target));
        }
        if (previous.name !== target.name || previous.sog !== target.sog || previous.updatedAt !== target.updatedAt) {
          marker.setTooltipContent(getAISTargetTooltip(target, aisSource));
          marker.setPopupContent(getAISTargetPopup(target, aisSource));
          marker.options.title = `${target.name ?? 'AIS target'} · MMSI ${target.mmsi}`;
        }
        marker.aisTarget = target;
      } else {
        const newMarker = L.marker(position, {
          icon: createAisIcon(L, target),
          title: `${target.name ?? 'AIS target'} · MMSI ${target.mmsi}`,
          zIndexOffset: 600,
          rotateWithView: true
        });
        newMarker.bindTooltip(getAISTargetTooltip(target, aisSource), {
          direction: 'top',
          sticky: true,
          opacity: 1,
          className: TOOLTIP_CLASS
        });
        newMarker.bindPopup(getAISTargetPopup(target, aisSource), POPUP_OPTIONS);
        newMarker.aisTarget = target;
        newMarker.addTo(mapInstance.aisLayer);
        aisMarkersRef.current.set(target.mmsi, newMarker);
      }
    }
  }, [mapInstance, leafletLoaded, leafletError, visibleAISTargets, showAIS, aisSource]);

  useEffect(() => {
    if (!mapInstance || !leafletLoaded || leafletError || !onWindGridRequest) return;

    const map = mapInstance.map;
    let debounceId: number | undefined;
    const requestVisibleGrid = () => {
      if (debounceId !== undefined) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        // The lattice is anchored to geographic coordinates so cached points stay valid when panning.
        const zoom = map.getZoom();
        const visible = buildWindLattice(map.getBounds().pad(0.1), zoom);
        // Light prefetch only: the coarser zoom-1 lattice tripled the request volume
        // for little UX gain, which triggered Open-Meteo rate limits (#36).
        const prefetch = [
          ...buildWindLattice(map.getBounds().pad(0.2), zoom)
        ];
        onWindGridRequest(visible, prefetch);
      }, 350);
    };

    requestVisibleGrid();
    map.on('moveend zoomend resize', requestVisibleGrid);

    return () => {
      if (debounceId !== undefined) window.clearTimeout(debounceId);
      map.off('moveend zoomend resize', requestVisibleGrid);
    };
  }, [mapInstance, leafletLoaded, leafletError, onWindGridRequest]);

  // Issue #50 : le cycle de vie du layer est découplé des mises à jour de
  // windGrid — le layer et ses marqueurs survivent aux ticks de navigation,
  // donc plus aucun clignotement quand la position du bateau change.
  useEffect(() => {
    if (!showWindLayer || !mapInstance || !leafletLoaded || leafletError || !window.L) return;

    const L = window.L;
    const map = mapInstance.map;
    const flowLayer = L.layerGroup().addTo(map);
    flowLayerRef.current = flowLayer;
    barbMarkersRef.current = new Map();

    return () => {
      flowLayerRef.current = null;
      barbMarkersRef.current = new Map();
      map.removeLayer(flowLayer);
    };
  }, [mapInstance, leafletLoaded, leafletError, showWindLayer]);

  // Issue #50 : rendu incrémental — marqueurs indexés par position géographique
  // et réutilisés ; seules les prévisions réellement changées mettent à jour
  // l'icône et le tooltip, les nouveaux points sont ajoutés, les obsolètes
  // retirés. Un nouvel array windGrid à contenu identique ne redessine rien.
  useEffect(() => {
    if (!showWindLayer || !mapInstance || !leafletLoaded || leafletError || !window.L || data.windGrid.length === 0) return;

    const syncStartedAt = isMapProfilingEnabled() ? performance.now() : 0;
    const L = window.L;
    const map = mapInstance.map;
    const flowLayer = flowLayerRef.current;
    if (!flowLayer) return;

    const barbMarkers = barbMarkersRef.current;
    const barbKey = barbPositionKey;
    const makeBarbIcon = (wind: WindData) => L.divIcon({
      className: 'wind-map-barb-icon',
      html: `<svg class="wind-map-barb" viewBox="0 0 48 48" aria-hidden="true" style="transform:rotate(${wind.direction}deg)">${getWindBarbSvg(wind.speed)}</svg>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const seen = new Set<string>();
    let added = 0;
    let updated = 0;
    let removed = 0;
    for (const point of data.windGrid) {
      const key = barbKey(point);
      seen.add(key);
      const existing = barbMarkers.get(key);
      if (existing) {
        if (existing.speed !== point.wind.speed || existing.direction !== point.wind.direction) {
          existing.marker.setIcon(makeBarbIcon(point.wind));
          existing.marker.setTooltipContent(getWindTooltip(point.wind));
          existing.speed = point.wind.speed;
          existing.direction = point.wind.direction;
          updated += 1;
        }
        continue;
      }
      const direction = getWindDirectionText(point.wind.direction);
      const marker = L.marker([point.position.latitude, point.position.longitude], {
        icon: makeBarbIcon(point.wind),
        pane: WIND_BARB_PANE,
        rotateWithView: true,
        title: `Wind from ${direction}, ${point.wind.speed.toFixed(1)} knots`
      })
        .bindTooltip(getWindTooltip(point.wind), { direction: 'top', sticky: true, opacity: 1, className: TOOLTIP_CLASS })
        .addTo(flowLayer);
      barbMarkers.set(key, { marker, speed: point.wind.speed, direction: point.wind.direction });
      added += 1;
    }

    for (const [key, entry] of barbMarkers) {
      if (!seen.has(key)) {
        flowLayer.removeLayer(entry.marker);
        barbMarkers.delete(key);
        removed += 1;
      }
    }

    if (isMapProfilingEnabled()) {
      const count = barbMarkers.size;
      const pane = map.getPane(WIND_BARB_PANE) as HTMLElement | undefined;
      if (pane) pane.dataset.windBarbsCount = String(count);
      reportMapPerformance('wind-barb-sync', performance.now() - syncStartedAt, {
        count,
        added,
        updated,
        removed,
        zoom: map.getZoom()
      });
    }
  }, [mapInstance, leafletLoaded, leafletError, data.windGrid, showWindLayer]);

  const recordingElapsed = trackRecorder?.status?.recording
    ? formatRecordingElapsed(trackRecorder.status.startedAt ?? 0, recordingNow)
    : null;

  return (
    <div 
      className="instrument map-view"
      style={{
        width: size?.width || '100%',
        height: size?.height || '100%',
        minHeight: '0',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'hidden',
        flex: 1
      }}
    >
      {/* Header */}
      <div 
        className="instrument-header"
        style={{
          width: '100%',
          textAlign: 'center',
          padding: '0.5rem',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '4px',
          marginBottom: '0.5rem',
          zIndex: 1000,
          position: 'relative'
        }}
      >
        <span className="instrument-title" style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
          Marine Chart · OpenSeaMap
        </span>
      </div>
      
      {/* Map container */}
      <div 
        className={`marine-chart-canvas map-base-${mapBaseStyle}`}
        ref={mapRef}
        style={{
          width: '100%',
          flex: 1,
          height: '100%',
          minHeight: '0',
          position: 'relative',
          overflow: 'hidden',
          border: '2px solid var(--accent-color)',
          borderRadius: '4px',
          background: leafletError ? 'var(--bg-secondary)' : '#1a2e1a'
        }}
      >
        {!leafletError && leafletLoaded && data.position && (
          <>
            <MapPositionReadout position={data.position} gpsTime={data.gpsTime} part="time" recording={recordingElapsed} />
            <MapPositionReadout position={data.position} gpsTime={data.gpsTime} part="position" />
          </>
        )}
        {showWindLayer && data.windForecastStatus.gridError && (
          <div className="map-status-badge" role="status" title={data.windForecastStatus.gridError}>
            Météo limitée
          </div>
        )}
        <div className="map-tools map-tools--left" onMouseDown={event => event.stopPropagation()}>
          <div className="map-tools-toolbar" role="group" aria-label="Map display">
            <div className="map-tool-item">
              <button
                className={`map-tool-button map-logo-button ${activeMapTool === 'about' ? 'active' : ''}`}
                type="button"
                aria-label="About MyNavApp"
                title="About MyNavApp"
                aria-expanded={activeMapTool === 'about'}
                aria-controls="map-about-panel"
                onClick={() => setActiveMapTool(activeMapTool === 'about' ? null : 'about')}
              >
                <AppLogo />
              </button>
              {activeMapTool === 'about' && (
                <section id="map-about-panel" className="map-tool-panel map-about-panel" aria-label="About MyNavApp">
                  <strong>MyNavApp <small>v{__APP_VERSION__}</small></strong>
                  <span>Personal marine navigation dashboard</span>
                  <span className={backendStatus?.isConnected ? 'about-ok' : 'about-warning'} title={backendStatus?.error ?? undefined}>
                    Backend: {backendStatus?.isConnected ? 'connected' : 'offline'}
                  </span>
                  <span>Position source: {NAVIGATION_SOURCE_LABELS[navigationSource]}</span>
                  <span>Charts: OpenStreetMap · OpenSeaMap</span>
                  <span>Weather: Open-Meteo forecast</span>
                </section>
              )}
            </div>
            <div className="map-tool-divider" aria-hidden="true" />
            {data.position && (
              <button
                className={`map-tool-button recenter-map-button ${followVessel ? 'layer-visible' : ''}`}
                aria-pressed={followVessel}
                type="button"
                aria-label="Center map on vessel"
                title="Center map on vessel"
                disabled={!mapInstance || leafletError}
                onClick={event => {
                  event.stopPropagation();
                  const position = data.position;
                  if (position) {
                    mapInstanceRef.current?.map.panTo([
                      position.latitude,
                      position.longitude
                    ]);
                  }
                  setFollowVessel(true);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="7" />
                  <circle cx="12" cy="12" r="2" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                </svg>
              </button>
            )}
            {data.position && !leafletError && leafletLoaded && (rotationAvailable || rotationUnavailable) && (
              <button
                className={`map-tool-button orientation-map-button ${mapOrientation !== 'north' ? 'layer-visible' : ''}`}
                type="button"
                aria-label={`Map orientation: ${ORIENTATION_LABELS[mapOrientation]}`}
                title={rotationUnavailable
                  ? 'Rotation unavailable · North up'
                  : `${ORIENTATION_LABELS[mapOrientation]} · click for ${ORIENTATION_LABELS[nextOrientation(mapOrientation)]}`}
                disabled={rotationUnavailable}
                onClick={event => {
                  event.stopPropagation();
                  setMapOrientation(nextOrientation(mapOrientation));
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m12 5 3 7h-6l3-7Z" />
                  <path d="M12 12v7" />
                </svg>
                <span className="map-tool-mode" aria-hidden="true">{ORIENTATION_BADGES[mapOrientation]}</span>
              </button>
            )}
            <div className="map-tool-divider" aria-hidden="true" />
            {canOpenSettings && (
              <div className="map-tool-item">
                <button
                  className={`map-tool-button ${activeMapTool === 'settings' ? 'layer-visible' : ''}`}
                  type="button"
                  aria-label="Settings"
                  title="Settings"
                  aria-expanded={activeMapTool === 'settings'}
                  aria-controls="map-settings-panel"
                  onClick={() => setActiveMapTool(activeMapTool === 'settings' ? null : 'settings')}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
                    <path d="m19.4 13.5 1.1.9-1.4 2.4-1.4-.5a7.8 7.8 0 0 1-1.5.9l-.2 1.5h-2.8l-.3-1.5a7.8 7.8 0 0 1-1.5-.9l-1.4.5-1.4-2.4 1.1-.9a6.8 6.8 0 0 1 0-1.8l-1.1-.9 1.4-2.4 1.4.5a7.8 7.8 0 0 1 1.5-.9l.3-1.5H16l.2 1.5a7.8 7.8 0 0 1 1.5.9l1.4-.5 1.4 2.4-1.1.9a6.8 6.8 0 0 1 0 1.8Z" transform="translate(-1 -1)" />
                  </svg>
                </button>
                {activeMapTool === 'settings' && layout && gpsStatus &&
                  onThemeChange && onUnitChange && onToggleGPSConnection && (
                  <section id="map-settings-panel" className="map-tool-panel map-settings-panel" aria-label="Settings">
                    <div className="map-settings-heading">
                      <strong>SETTINGS</strong>
                      <button
                        type="button"
                        aria-label="Close settings panel"
                        title="Close settings panel"
                        onClick={() => setActiveMapTool(null)}
                      >
                        ×
                      </button>
                    </div>
                    <ControlPanel
                      layout={layout}
                      isGPSEnabled={isGPSEnabled}
                      gpsStatus={gpsStatus}
                      hasGPS={hasGPS}
                      onToggleGPSConnection={onToggleGPSConnection}
                      onThemeChange={onThemeChange}
                      onUnitChange={onUnitChange}
                      mapBaseStyle={mapBaseStyle}
                      onMapBaseStyleChange={changeMapBaseStyle}
                      routingPolars={routingPolar?.polars}
                      routingPolarId={routingPolar?.polarId ?? null}
                      onRoutingPolarChange={routingPolar?.setPolarId}
                    />
                  </section>
                )}
              </div>
            )}
            <div className="map-tool-item">
              <button
                className={`map-tool-button ${showAIS ? 'layer-visible' : ''}`}
                type="button"
                aria-label={`${showAIS ? 'Hide' : 'Show'} AIS targets on map`}
                aria-pressed={showAIS}
                title={`${showAIS ? 'Hide' : 'Show'} AIS targets on map`}
                onClick={() => onAISVisibilityChange?.(!showAIS)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3 20 19H4L12 3Z" />
                  <path d="M8 16h8M12 9v4" />
                </svg>
                <span className="map-tool-count">{getAISDetectedTargetCount(aisState)}</span>
              </button>
              <button
                className={`map-tool-details ${activeMapTool === 'ais' ? 'active' : ''}`}
                type="button"
                aria-label="AIS settings and status"
                aria-expanded={activeMapTool === 'ais'}
                aria-controls="map-ais-panel"
                title="AIS settings and status"
                onClick={() => setActiveMapTool(activeMapTool === 'ais' ? null : 'ais')}
              >
                ⚙
              </button>
              {activeMapTool === 'ais' && (
                <section id="map-ais-panel" className="map-tool-panel ais-map-controls" aria-label="AIS controls">
                  <label className="ais-map-source">
                    <span>AIS source</span>
                    <select
                      value={aisSource}
                      onChange={event => onAISSourceChange?.(event.target.value as AISSource)}
                    >
                      <option value="local">Local VHF · NMEA/UDP</option>
                      <option value="internet">Internet · AISstream</option>
                    </select>
                  </label>
                  <label className="ais-map-visibility">
                    <input
                      type="checkbox"
                      checked={showAIS}
                      onChange={event => onAISVisibilityChange?.(event.target.checked)}
                    />
                    <span>Show AIS targets</span>
                  </label>
                  <div className="ais-map-target-count" aria-live="polite">
                    <span>AIS targets detected</span>
                    <strong>{getAISDetectedTargetCount(aisState)}</strong>
                  </div>
                  <div className="ais-map-status" role="status">
                    {getAISStatusMessage(aisSource, aisState)}
                  </div>
                  {aisSource === 'internet' && (
                    <div className="ais-map-coverage">
                      AISstream area: about 15 NM around the latest GPS position
                    </div>
                  )}
                  {visibleAISTargets.length > 0 && (
                    <button
                      className="ais-map-zoom"
                      type="button"
                      disabled={!showAIS || !mapInstance}
                      onClick={event => {
                        event.stopPropagation();
                        if (!mapInstance || !window.L || !showAIS) return;
                        const points: [number, number][] = visibleAISTargets.map(target => [target.latitude, target.longitude]);
                        if (data.position) points.push([data.position.latitude, data.position.longitude]);
                        mapInstance.map.fitBounds(window.L.latLngBounds(points), {
                          padding: [48, 48],
                          maxZoom: 13
                        });
                      }}
                    >
                      Zoom to {visibleAISTargets.length === 1 ? 'target' : 'targets'} ({visibleAISTargets.length})
                    </button>
                  )}
                </section>
              )}
            </div>
            <div className="map-tool-item">
              <button
                className={`map-tool-button ${showWindLayer ? 'layer-visible' : ''}`}
                type="button"
                aria-label={`${showWindLayer ? 'Hide' : 'Show'} weather layer on map`}
                aria-pressed={showWindLayer}
                title={`${showWindLayer ? 'Hide' : 'Show'} weather layer on map`}
                onClick={() => setShowWindLayer(visible => !visible)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.5 15.5h11a3.5 3.5 0 0 0 .2-7 5.7 5.7 0 0 0-10.8 1.2 3 3 0 0 0-.4 5.8Z" />
                  <path d="m8 19-1 2m6-2-1 2m6-2-1 2" />
                </svg>
              </button>
              <button
                className={`map-tool-details ${activeMapTool === 'weather' ? 'active' : ''}`}
                type="button"
                aria-label="Weather forecast information"
                aria-expanded={activeMapTool === 'weather'}
                aria-controls="map-weather-panel"
                title="Weather forecast information"
                onClick={() => setActiveMapTool(activeMapTool === 'weather' ? null : 'weather')}
              >
                i
              </button>
              {activeMapTool === 'weather' && (
                <section id="map-weather-panel" className="map-tool-panel wind-map-readout" aria-label="Weather forecast">
                  <strong>LOCAL WIND FORECAST</strong>
                  {data.wind ? (
                    <span>
                      {data.wind.speed.toFixed(1)} kn · FROM {getWindDirectionText(data.wind.direction)} {data.wind.direction.toFixed(0)}°
                    </span>
                  ) : (
                    <span>{data.windForecastStatus.error || (data.windForecastStatus.isLoading ? 'Loading…' : 'Waiting for GPS fix')}</span>
                  )}
                  {data.wind && <span>Hover over a wind barb for its forecast</span>}
                  {data.windForecastStatus.updatedAt && (
                    <span className="wind-map-updated">
                      Updated {new Date(data.windForecastStatus.updatedAt).toLocaleTimeString('en-GB')}
                    </span>
                  )}
                  {data.windForecastStatus.error && <span role="alert">{data.windForecastStatus.error}</span>}
                  {data.windForecastStatus.gridError && <span role="alert">{data.windForecastStatus.gridError}</span>}
                </section>
              )}
            </div>
          </div>
        </div>
        <div className="map-tools map-tools--right" onMouseDown={event => event.stopPropagation()}>
          <div className="map-tools-toolbar" role="group" aria-label="Map actions">
            <div className="map-tool-item">
              <button
                className={`map-tool-button gps-map-button ${gpsStatus?.isConnected || navigationSource === 'nmea' ? 'gps-connected' : 'gps-disconnected'}`}
                type="button"
                aria-label="GPS signal and position status"
                aria-expanded={activeMapTool === 'gps'}
                aria-controls="map-gps-panel"
                title={getGPSStatusMessage(gpsStatus, navigationSource, hasGPS, isGPSEnabled)}
                onClick={() => setActiveMapTool(activeMapTool === 'gps' ? null : 'gps')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
                  <circle cx="12" cy="9" r="2.3" />
                </svg>
                <span className="gps-map-indicator" aria-hidden="true" />
              </button>
              {activeMapTool === 'gps' && (
                <section id="map-gps-panel" className="map-tool-panel gps-map-readout" aria-label="GPS status">
                  <strong>GPS STATUS</strong>
                  <span>{getGPSStatusMessage(gpsStatus, navigationSource, hasGPS, isGPSEnabled)}</span>
                  {gpsStatus?.error && <span role="alert">{gpsStatus.error}</span>}
                </section>
              )}
            </div>
            {routing && (
              <div className="map-tool-item">
                <button
                  className={`map-tool-button ${activeMapTool === 'routing' ? 'layer-visible' : ''}`}
                  type="button"
                  aria-label="Routing"
                  title="Routing"
                  aria-expanded={activeMapTool === 'routing'}
                  aria-controls="map-routing-panel"
                  onClick={() => setActiveMapTool(activeMapTool === 'routing' ? null : 'routing')}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M15.5 8.5 13.2 13.2 8.5 15.5 10.8 10.8Z" />
                  </svg>
                </button>
              </div>
            )}
            {trackRecorder && (
              <div className="map-tool-item">
                <button
                  className={`map-tool-button track-record-button ${trackRecorder.status?.recording ? 'recording-active' : ''}`}
                  type="button"
                  aria-label={trackRecorder.status?.recording ? 'Stop track recording' : 'Start track recording'}
                  aria-pressed={Boolean(trackRecorder.status?.recording)}
                  title={trackRecorder.status?.recording ? 'Stop track recording' : 'Record the vessel track'}
                  disabled={trackRecorder.isBusy}
                  onClick={event => {
                    event.stopPropagation();
                    void (trackRecorder.status?.recording ? trackRecorder.stop() : trackRecorder.start());
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="6" />
                  </svg>
                </button>
                <button
                  className={`map-tool-details ${activeMapTool === 'track' ? 'active' : ''}`}
                  type="button"
                  aria-label="Track recording and export"
                  aria-expanded={activeMapTool === 'track'}
                  aria-controls="map-track-panel"
                  title="Track recording and export"
                  onClick={() => {
                    if (activeMapTool !== 'track') void trackRecorder.refresh();
                    setActiveMapTool(activeMapTool === 'track' ? null : 'track');
                  }}
                >
                  i
                </button>
                {activeMapTool === 'track' && trackRecorder && (
                  <section id="map-track-panel" className="map-tool-panel track-map-controls" aria-label="Track recording and export">
                    <strong>TRACK RECORDING</strong>
                    <span className="track-map-status" role="status">
                      {trackRecorder.status?.recording
                        ? `Recording · ${formatTrackStartedAt(trackRecorder.status.startedAt ?? 0)} · ${trackRecorder.status.pointCount ?? 0} points`
                        : 'Not recording'}
                    </span>
                    {(trackRecorder.status?.error || trackRecorder.error) && (
                      <span role="alert">{trackRecorder.status?.error ?? trackRecorder.error}</span>
                    )}
                    <button
                      className="ais-map-zoom track-map-toggle"
                      type="button"
                      disabled={trackRecorder.isBusy}
                      onClick={() => void (trackRecorder.status?.recording ? trackRecorder.stop() : trackRecorder.start())}
                    >
                      {trackRecorder.status?.recording ? 'Stop recording' : 'Start recording'}
                    </button>
                    <div className="track-map-list-heading">
                      <strong>SAVED TRACKS</strong>
                      <button type="button" onClick={() => void trackRecorder.refresh()}>Refresh</button>
                    </div>
                    {trackRecorder.tracks.length === 0 ? (
                      <span className="track-map-status">No saved tracks yet.</span>
                    ) : (
                      <div className="track-map-list">
                        {trackRecorder.tracks.map(track => (
                          <div key={track.id} className="track-map-item">
                            <div className="track-map-item-info">
                              <strong>{formatTrackStartedAt(track.startedAt)}</strong>
                              <span>
                                {track.pointCount} points · {formatTrackSize(track.sizeBytes)}
                                {track.endedAt === null ? ' · recording' : ''}
                              </span>
                            </div>
                            <div className="track-map-item-actions">
                              <a href={`/api/tracks/${track.id}/export?format=geojson`} download={`${track.id}.geojson`}>GeoJSON</a>
                              <a href={`/api/tracks/${track.id}/export?format=gpx`} download={`${track.id}.gpx`}>GPX</a>
                              <a href={`/api/tracks/${track.id}/export?format=csv`} download={`${track.id}.csv`}>CSV</a>
                              <button
                                type="button"
                                disabled={trackRecorder.isBusy}
                                onClick={() => void trackRecorder.remove(track.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
        {activeMapTool === 'routing' && routing && (
          <RoutingPanel
            routing={routing}
            pickTarget={routingPickTarget}
            onRequestPick={target => {
              // Le panneau reste ouvert pendant la sélection : le bouton actif
              // passe en "Click chart…" et le curseur de la carte en croix.
              onRoutingPickRequest?.(target);
            }}
            onClose={() => setActiveMapTool(null)}
            routeCalc={routingRoute}
            onComputeRoute={onRoutingCompute}
            gribCalc={gribApi}
            polarName={routingPolar?.polarName}
          />
        )}
        {!leafletError && !leafletLoaded && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeContent: 'center',
            background: 'rgba(0, 0, 0, 0.8)',
            padding: '1rem',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '1rem',
            zIndex: 1000,
            textAlign: 'center'
          }}>
            <div>Loading marine chart…</div>
          </div>
        )}

        {!leafletError && leafletLoaded && !data.position && (
          <>
            <div className="map-gps-pending">
              Allow location access to show the chart around your vessel.
            </div>
          </>
        )}
        
        {/* Show an explicit error instead of silently switching to a non-marine map provider. */}
        {leafletError && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeContent: 'center',
            gap: '0.5rem',
            padding: '1.5rem',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            textAlign: 'center',
            lineHeight: 1.5,
            zIndex: 1000
          }}>
            <strong>Marine chart unavailable</strong>
            <span>The chart could not be initialized. Restart the application.</span>
          </div>
        )}
      </div>
      
      <details className="map-global-legend">
        <summary>Map legend</summary>
        <div className="map-global-legend-content">
          <div className="map-global-legend-item">
            <span className="map-legend-speed-vector" aria-hidden="true" />
            <span>Speed vector · 15 min (SOG / COG)</span>
          </div>
          <div className="map-global-legend-item">
            <span className="map-legend-track" aria-hidden="true" />
            <span>Past positions · GPS</span>
          </div>
          <div className="map-global-legend-item">
            <svg width="14" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path d={getWindBarbSvg(15, false)} fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <span>Wind barbs · hover for forecast</span>
          </div>
          <div className="map-global-legend-item">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path d="M24 3 C30 12 33 24 32 37 Q31.500 43 27 44 L21 44 Q16.500 43 16 37 C15 24 18 12 24 3 Z" fill="#f4f8fb" stroke="#10202a" strokeWidth="2.500" strokeLinejoin="round" />
              <path d="M24 9 C27 16 28.500 24 28 33 L20 33 C19.500 24 21 16 24 9 Z" fill="#19d3c5" fillOpacity="0.85" />
            </svg>
            <span>Vessel · HDG</span>
          </div>
          <p>Each barb uses the forecast at its location; nearby winds may match due to model resolution.</p>
          <p>Enable “Seamarks &amp; navigation aids” to show OpenSeaMap data.</p>
          <p>Indicative data only · not a substitute for an official nautical chart.</p>
        </div>
      </details>
    </div>
  );
};

const getWindDirectionText = (degrees: number): string => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round(degrees / 22.5) % 16];
};

const formatTrackStartedAt = (startedAt: number): string => {
  const started = new Date(startedAt);
  return `Track ${started.toLocaleDateString('en-GB')} ${started.toLocaleTimeString('en-GB')}`;
};

const formatRecordingElapsed = (startedAt: number, now: number): string => {
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const formatTrackSize = (sizeBytes: number): string => sizeBytes >= 1_048_576
  ? `${(sizeBytes / 1_048_576).toFixed(1)} MB`
  : `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;

/**
 * Tile layer served by the navigation backend from its offline cache or online
 * tile provider, keeping browser tile requests same-origin.
 */
const createTileLayer = (
  leaflet: LeafletObject,
  layer: 'osm' | 'seamark',
  options: Record<string, unknown>
): LeafletObject => {
  return leaflet.tileLayer(`/api/tiles/${layer}/{z}/{x}/{y}.png`, options);
};

const getGPSStatusMessage = (
  gpsStatus: GPSStatus | undefined,
  navigationSource: 'nmea' | 'browser' | 'none',
  hasGPS: boolean,
  isGPSEnabled: boolean
): string => {
  if (navigationSource === 'nmea') return 'Navigation data received from NMEA';
  if (gpsStatus?.error) return gpsStatus.error;
  if (gpsStatus?.isConnected) {
    return `GPS connected · accuracy ±${gpsStatus.accuracy?.toFixed(0) ?? '?'} m`;
  }
  if (!hasGPS) return 'GPS unavailable in this browser';
  if (!isGPSEnabled) return 'GPS stopped';
  return 'Waiting for GPS fix';
};

const getHeadingSource = (heading: number | null | undefined): 'HDG' | 'COG' => (
  heading === null || heading === undefined ? 'COG' : 'HDG'
);

const getVesselTooltip = (data: NavigationData): string => {
  const speed = data.speed?.sog ?? data.speed?.speed ?? 0;
  const heading = data.compass?.heading;
  const cog = data.compass?.cog;
  const course = heading ?? cog ?? 0;
  const courseLabel = heading !== null && heading !== undefined
    ? 'HDG'
    : cog !== null && cog !== undefined
      ? 'COG'
      : 'Course';

  return buildInfoCard('Vessel', [
    ['SOG', `${speed.toFixed(1)} kn`],
    [courseLabel, `${course.toFixed(0)}°`]
  ], undefined, 'nav-card-vessel');
};

const BOAT_SVG = '<svg class="boat-marker-icon" viewBox="0 0 48 48" aria-hidden="true" style="transform:rotate(__HEADING__deg)"><path d="M24 3 C30 12 33 24 32 37 Q31.500 43 27 44 L21 44 Q16.500 43 16 37 C15 24 18 12 24 3 Z" fill="#f4f8fb" stroke="#10202a" stroke-width="2.500" stroke-linejoin="round"/><path d="M24 9 C27 16 28.500 24 28 33 L20 33 C19.500 24 21 16 24 9 Z" fill="#19d3c5" fill-opacity="0.85"/><rect x="20.500" y="26" width="7" height="9" rx="1.800" fill="#10202a" fill-opacity="0.75"/></svg>';

const createBoatIcon = (leaflet: LeafletObject, heading: number) => leaflet.divIcon({
  className: 'boat-marker',
  html: BOAT_SVG.replace('__HEADING__', String(heading)),
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

const createAisIcon = (leaflet: LeafletObject, target: AISTarget) => {
  const heading = target.heading ?? target.cog ?? 0;
  return leaflet.divIcon({
    className: 'ais-vessel-marker',
    html: `<svg class="ais-vessel-marker-icon" viewBox="0 0 48 48" aria-hidden="true" style="transform:rotate(${heading}deg)"><path d="M24 4 C29 13 31 24 30 36 Q29.500 41 26 42 L22 42 Q18.500 41 18 36 C17 24 19 13 24 4 Z" fill="#ffd166" stroke="#10202a" stroke-width="2.500" stroke-linejoin="round"/><path d="M24 12 L24 34" stroke="#fff4cf" stroke-width="2" stroke-linecap="round"/></svg>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
};

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character] ?? character);

// Callers pass pre-escaped text; values are plain strings built from numbers or escaped fields.
const buildInfoCard = (title: string, rows: Array<[string, string]>, note?: string, kind = ''): string => {
  const body = rows
    .map(([label, value]) => `<div class="nav-card-row"><span>${label}</span><strong>${value}</strong></div>`)
    .join('');
  return `<div class="nav-card ${kind}"><div class="nav-card-title">${title}</div>${body}${note ? `<div class="nav-card-note">${note}</div>` : ''}</div>`;
};

const getAISTargetTooltip = (target: AISTarget, source: AISSource): string => {
  const speed = target.sog === null ? '—' : `${target.sog.toFixed(1)} kn`;
  return buildInfoCard(
    escapeHtml(target.name ?? 'Unknown vessel'),
    [['MMSI', escapeHtml(target.mmsi)], ['SOG', speed]],
    source === 'local' ? 'Local VHF AIS' : 'Internet AIS · AISstream',
    'nav-card-ais'
  );
};

const getAISTargetPopup = (target: AISTarget, source: AISSource): string => {
  const course = target.cog === null ? '—' : `${target.cog.toFixed(0)}°`;
  const heading = target.heading === null ? '—' : `${target.heading.toFixed(0)}°`;
  const updated = new Date(target.updatedAt).toLocaleTimeString('en-GB');
  return buildInfoCard(
    escapeHtml(target.name ?? 'Unknown vessel'),
    [
      ['MMSI', escapeHtml(target.mmsi)],
      ['SOG', target.sog === null ? '—' : `${target.sog.toFixed(1)} kn`],
      ['COG', course],
      ['HDG', heading],
      ['Source', source === 'local' ? 'Local VHF' : 'AISstream'],
      ['Last report', updated]
    ],
    'AIS positions may be delayed; not for collision avoidance.',
    'nav-card-ais'
  );
};

const getVesselPopup = (position: Position): string => buildInfoCard('Vessel position', [
  ['LAT', `${position.latitude.toFixed(6)}°`],
  ['LON', `${position.longitude.toFixed(6)}°`]
], undefined, 'nav-card-vessel');

const getWindTooltip = (wind: WindData): string => buildInfoCard('Wind forecast', [
  ['Speed', `${wind.speed.toFixed(1)} kn`],
  ['From', `${getWindDirectionText(wind.direction)} ${wind.direction.toFixed(0)}°`],
  ['Gusts', `${wind.gust.toFixed(1)} kn`]
], 'Open-Meteo', 'nav-card-wind');

const getAISStatusMessage = (source: AISSource, state: AISBackendState | null): string => {
  if (!state) return 'Waiting for local navigation backend.';
  if (state.source === 'internet' && source === 'local') {
    // Local AIS is silent: the backend fell back to AISstream targets.
    if (state.internetError) return `No local AIS data · ${state.internetError}`;
    if (!state.internetConnected) return 'No local AIS data · connecting to AISstream…';
    return state.internetTargetCount > 0
      ? `No local AIS data · ${state.internetTargetCount} Internet target${state.internetTargetCount === 1 ? '' : 's'} received.`
      : 'No local AIS data · connected to AISstream, no targets in this area yet.';
  }
  if (state.source === 'local') {
    if (state.localTargetCount > 0) {
      return `${state.localTargetCount} local target${state.localTargetCount === 1 ? '' : 's'} received.`;
    }
    return state.localNmeaPort === null
      ? 'Local AIS listener is disabled (NMEA_UDP_PORT=0).'
      : `Waiting for VHF AIS data on UDP port ${state.localNmeaPort}.`;
  }
  if (!state.internetConfigured) return 'Set AISSTREAM_API_KEY on the server to enable Internet AIS.';
  if (state.internetError) return state.internetError;
  if (!state.internetConnected) return 'Connecting to AISstream…';
  return state.internetTargetCount > 0
    ? `${state.internetTargetCount} Internet target${state.internetTargetCount === 1 ? '' : 's'} received.`
    : 'Connected to AISstream; no targets reported in this area yet.';
};

const getAISDetectedTargetCount = (state: AISBackendState | null): number => {
  if (!state) return 0;
  return state.source === 'local' ? state.localTargetCount : state.internetTargetCount;
};

const getWindBarbSvg = (speedKnots: number, includeOutline = true): string => {
  const roundedSpeed = Math.round(speedKnots / 5) * 5;
  const paths: string[] = [];
  const flags = Math.floor(roundedSpeed / 50);
  const fullBarbs = Math.floor((roundedSpeed % 50) / 10);
  const halfBarb = (roundedSpeed % 10) >= 5;
  let y = 7;

  paths.push('M24 42 L24 7');

  for (let index = 0; index < flags; index += 1) {
    paths.push(`M24 ${y} L40 ${y + 7} L24 ${y + 14} Z`);
    y += 14;
  }

  for (let index = 0; index < fullBarbs; index += 1) {
    paths.push(`M24 ${y} L39 ${y + 7}`);
    y += 7;
  }

  if (halfBarb) {
    paths.push(`M24 ${y} L32 ${y + 4}`);
  }

  const path = paths.join(' ');
  if (!includeOutline) return path;

  // #86 : code couleur par force de vent restauré (rouge > 30 kt, orange > 20 kt,
  // blanc sinon). Le motif de suppression d'origine (clignotement à chaque
  // reconstruction d'icône) n'existe plus : le rendu incrémental (#50) ne recrée
  // une icône que si vitesse ou direction change, et le zoom par paliers (#62)
  // a supprimé le churn de reconstruction.
  const color = speedKnots > 30 ? '#ff4d4f' : speedKnots > 20 ? '#ff9f43' : '#fff';
  return `<path d="${path}" fill="none" stroke="#10202a" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
};

export default MapViewSimple;
