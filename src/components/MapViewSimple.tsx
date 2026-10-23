import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AISBackendState, AISSource, AISTarget, NavigationData, Position } from '../types';

// Extend Window interface for Leaflet
declare global {
  interface Window {
    L: any;
  }
}

interface MapViewSimpleProps {
  data: NavigationData;
  isReplay?: boolean;
  replayTrack?: Position[];
  replayTrackIndex?: number;
  onWindGridRequest?: (points: Position[]) => void;
  aisTargets?: AISTarget[];
  aisState?: AISBackendState | null;
  showAIS?: boolean;
  aisSource?: AISSource;
  onAISSourceChange?: (source: AISSource) => void;
  onAISVisibilityChange?: (visible: boolean) => void;
  size?: { width: number | string; height: number | string };
}

type MapOrientation = 'north' | 'heading' | 'course';

/**
 * Marine chart with OpenStreetMap base tiles and OpenSeaMap navigation marks.
 */
const MapViewSimple: React.FC<MapViewSimpleProps> = ({
  data,
  isReplay = false,
  replayTrack = [],
  replayTrackIndex = -1,
  onWindGridRequest,
  aisTargets = [],
  aisState = null,
  showAIS = false,
  aisSource = 'local',
  onAISSourceChange,
  onAISVisibilityChange,
  size
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState<boolean>(false);
  const [rotationAvailable, setRotationAvailable] = useState<boolean>(false);
  const [rotationUnavailable, setRotationUnavailable] = useState<boolean>(false);
  const [leafletError, setLeafletError] = useState<boolean>(false);
  const [mapOrientation, setMapOrientation] = useState<MapOrientation>('north');
  const aisMarkersRef = useRef<Map<string, any>>(new Map());
  const visibleAISTargets = useMemo(() => aisTargets.filter(target =>
    Number.isFinite(target.latitude) && Number.isFinite(target.longitude) &&
    target.latitude >= -90 && target.latitude <= 90 &&
    target.longitude >= -180 && target.longitude <= 180
  ), [aisTargets]);
  
  // Load Leaflet library
  useEffect(() => {
    let disposed = false;
    let checkInterval: number | undefined;
    let timeoutId: number | undefined;
    const script = document.getElementById('leaflet-js') as HTMLScriptElement | null;
    let rotationScript: HTMLScriptElement | null = null;
    const onLeafletLoad = () => {
      markMapLoaded();
      loadRotationPlugin();
    };

    const markMapLoaded = () => {
      if (disposed || !window.L) return;
      setLeafletLoaded(true);
    };
    const markRotationLoaded = () => {
      if (disposed || !window.L?.Map?.prototype?.setBearing) return;
      if (checkInterval !== undefined) window.clearInterval(checkInterval);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      setRotationAvailable(true);
      setRotationUnavailable(false);
      markMapLoaded();
    };
    const markUnavailable = () => {
      if (disposed) return;
      if (window.L) {
        markMapLoaded();
        setRotationUnavailable(true);
        if (checkInterval !== undefined) window.clearInterval(checkInterval);
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        return;
      }
      if (checkInterval !== undefined) window.clearInterval(checkInterval);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      setLeafletError(true);
    };

    const loadRotationPlugin = () => {
      if (disposed || !window.L) return;
      if (window.L.Map?.prototype?.setBearing) {
        markRotationLoaded();
        return;
      }

      rotationScript = document.getElementById('leaflet-rotate-js') as HTMLScriptElement | null;
      if (!rotationScript) {
        rotationScript = document.createElement('script');
        rotationScript.id = 'leaflet-rotate-js';
        rotationScript.src = 'https://cdn.jsdelivr.net/npm/@tomickigrzegorz/leaflet-rotate@0.3.0/dist/leaflet-rotate.umd.min.js';
        document.head.appendChild(rotationScript);
      }
      rotationScript.addEventListener('load', markRotationLoaded);
      rotationScript.addEventListener('error', markUnavailable);
    };

    if (window.L) {
      loadRotationPlugin();
    } else {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css';
        link.onerror = markUnavailable;
        document.head.appendChild(link);
      }

      const leafletScript = script ?? document.createElement('script');
      leafletScript.id = 'leaflet-js';
      leafletScript.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js';
      leafletScript.addEventListener('load', onLeafletLoad);
      leafletScript.addEventListener('error', markUnavailable);
      if (!script) document.head.appendChild(leafletScript);

      rotationScript = document.getElementById('leaflet-rotate-js') as HTMLScriptElement | null;
      checkInterval = window.setInterval(() => {
        if (window.L?.Map?.prototype?.setBearing) markRotationLoaded();
        else if (window.L) loadRotationPlugin();
      }, 100);
    }

    if (window.L) {
      markMapLoaded();
      if (window.L.Map?.prototype?.setBearing) markRotationLoaded();
    }

    timeoutId = window.setTimeout(() => {
      markUnavailable();
    }, 10000);

    return () => {
      disposed = true;
      if (checkInterval !== undefined) window.clearInterval(checkInterval);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      script?.removeEventListener('load', onLeafletLoad);
      script?.removeEventListener('error', markUnavailable);
      rotationScript?.removeEventListener('load', markRotationLoaded);
      rotationScript?.removeEventListener('error', markUnavailable);
    };
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
        
        const baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
          keepBuffer: 2,
          updateWhenIdle: true,
          updateWhenZooming: false
        }).addTo(map);
        const seamarkLayer = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openseamap.org/">OpenSeaMap</a> contributors',
          maxZoom: 18,
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
        
        marker.bindPopup(`<b>Vessel position</b><br>LAT: ${data.position.latitude.toFixed(6)}°<br>LON: ${data.position.longitude.toFixed(6)}°`);
        marker.bindTooltip(getVesselTooltip(data), {
          direction: 'top',
          offset: [0, -18],
          opacity: 0.95
        });
        
        const instance = {
          map,
          marker,
          trackLine,
          trackMode: null as string | null,
          lastReplayTrackIndex: -1,
          lastTrackPosition: null as Position | null
        };
        mapInstanceRef.current = instance;
        setMapInstance(instance);
      } else {
        const instance = mapInstanceRef.current;
        const boatPosition = L.latLng(data.position.latitude, data.position.longitude);
        const visibleBounds = instance.map.getBounds().pad(-0.25);

        if (!visibleBounds.contains(boatPosition)) {
          instance.map.panTo(boatPosition, { animate: false });
        }
        instance.marker.setLatLng(boatPosition);
        instance.marker.setPopupContent(
          `<b>Vessel position</b><br>LAT: ${data.position.latitude.toFixed(6)}°<br>LON: ${data.position.longitude.toFixed(6)}°`
        );
      }
    } catch (error) {
      console.error('Map error:', error);
      if (!mapInstanceRef.current) setLeafletError(true);
    }
  }, [leafletLoaded, rotationAvailable, rotationUnavailable, data.position, leafletError]);

  useEffect(() => {
    if (!mapInstance || !rotationAvailable || !leafletLoaded || leafletError || !data.position) return;

    const heading = data.compass?.heading ?? data.compass?.cog ?? 0;
    const course = data.compass?.cog ?? data.compass?.heading ?? 0;
    const selectedBearing = mapOrientation === 'heading'
      ? heading
      : mapOrientation === 'course'
        ? course
        : 0;
    const bearing = (360 - selectedBearing) % 360;

    mapInstance.map.setBearing(bearing);
  }, [mapInstance, rotationAvailable, leafletLoaded, leafletError, mapOrientation, data.position, data.compass?.heading, data.compass?.cog]);

  useEffect(() => {
    if (!mapInstance || !leafletLoaded || leafletError || !window.L) return;

    const trackMode = isReplay ? 'replay' : 'live';
    if (mapInstance.trackMode !== trackMode) {
      mapInstance.trackLine.setLatLngs([]);
      mapInstance.trackMode = trackMode;
      mapInstance.lastReplayTrackIndex = -1;
      mapInstance.lastTrackPosition = null;
    }

    if (isReplay) {
      const firstIndex = mapInstance.lastReplayTrackIndex + 1;
      const lastIndex = Math.min(replayTrackIndex, replayTrack.length - 1);
      for (let index = firstIndex; index <= lastIndex; index += 1) {
        const position = replayTrack[index];
        mapInstance.trackLine.addLatLng([position.latitude, position.longitude]);
        mapInstance.lastTrackPosition = position;
      }
      mapInstance.lastReplayTrackIndex = Math.max(mapInstance.lastReplayTrackIndex, lastIndex);
      return;
    }

    const position = data.position;
    const previous = mapInstance.lastTrackPosition as Position | null;
    if (position && (position.latitude !== previous?.latitude || position.longitude !== previous?.longitude)) {
      mapInstance.trackLine.addLatLng([position.latitude, position.longitude]);
      mapInstance.lastTrackPosition = position;
    }
  }, [mapInstance, leafletLoaded, leafletError, isReplay, replayTrack, replayTrackIndex, data.position]);

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
      mapInstance.marker.setPopupContent(
        `<b>Vessel position</b><br>LAT: ${lat.toFixed(6)}°<br>LON: ${lng.toFixed(6)}°`
      );
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
          opacity: 0.95
        });
        newMarker.bindPopup(getAISTargetPopup(target, aisSource));
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
        const { x: width, y: height } = map.getSize();
        const spacing = 144;
        const points: Position[] = [];

        for (let y = spacing / 2; y < height; y += spacing) {
          for (let x = spacing / 2; x < width; x += spacing) {
            const latLng = map.containerPointToLatLng([x, y]);
            points.push({ latitude: latLng.lat, longitude: latLng.lng });
          }
        }

        onWindGridRequest(points);
      }, 350);
    };

    requestVisibleGrid();
    map.on('moveend zoomend resize', requestVisibleGrid);

    return () => {
      if (debounceId !== undefined) window.clearTimeout(debounceId);
      map.off('moveend zoomend resize', requestVisibleGrid);
    };
  }, [mapInstance, leafletLoaded, leafletError, onWindGridRequest]);

  useEffect(() => {
    if (!mapInstance || !leafletLoaded || leafletError || !window.L || data.windGrid.length === 0) return;

    const L = window.L;
    const map = mapInstance.map;
    const flowLayer = L.layerGroup().addTo(map);

    const drawWindBarbs = () => {
      flowLayer.clearLayers();
      for (const point of data.windGrid) {
        const barbIcon = L.divIcon({
          className: 'wind-map-barb-icon',
          html: `<svg class="wind-map-barb" viewBox="0 0 48 48" aria-hidden="true" style="transform:rotate(${point.wind.direction}deg)">${getWindBarbSvg(point.wind.speed)}</svg>`,
          iconSize: [48, 48],
          iconAnchor: [24, 24]
        });
        const direction = getWindDirectionText(point.wind.direction);
        const tooltip = [
          '<strong>Wind forecast · Open-Meteo</strong>',
          `Speed: ${point.wind.speed.toFixed(1)} kn`,
          `Direction: from ${direction} ${point.wind.direction.toFixed(0)}°`,
          `Gusts: ${point.wind.gust.toFixed(1)} kn`
        ].join('<br>');
        L.marker([point.position.latitude, point.position.longitude], {
          icon: barbIcon,
          zIndexOffset: 500,
          rotateWithView: true,
          title: `Wind from ${direction}, ${point.wind.speed.toFixed(1)} knots`
        })
          .bindTooltip(tooltip, { direction: 'top', sticky: true, opacity: 0.95 })
          .addTo(flowLayer);
      }
    };

    drawWindBarbs();

    return () => {
      map.removeLayer(flowLayer);
    };
  }, [mapInstance, leafletLoaded, leafletError, data.windGrid]);

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
        className="marine-chart-canvas"
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
        {!leafletError && leafletLoaded && data.position && (rotationAvailable || rotationUnavailable) && (
          <div className="map-orientation-control" role="group" aria-label="Map orientation">
            {rotationUnavailable && (
              <span className="map-rotation-error" role="status">
                Rotation unavailable · North up
              </span>
            )}
            {([
              ['north', 'North up'],
              ['heading', 'Heading up'],
              ['course', 'Course up']
            ] as const).map(([orientation, label]) => (
              <button
                key={orientation}
                type="button"
                aria-pressed={mapOrientation === orientation}
                disabled={rotationUnavailable && orientation !== 'north'}
                onClick={event => {
                  event.stopPropagation();
                  setMapOrientation(orientation);
                }}
                onMouseDown={event => event.stopPropagation()}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <section className="ais-map-controls" aria-label="AIS controls" onMouseDown={event => event.stopPropagation()}>
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
            <strong>{getAISDetectedTargetCount(aisSource, aisState)}</strong>
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
              onMouseDown={event => event.stopPropagation()}
            >
              Zoom to {visibleAISTargets.length === 1 ? 'target' : 'targets'} ({visibleAISTargets.length})
            </button>
          )}
        </section>
        <div className="wind-map-readout" aria-live="polite">
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
        </div>
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
            <span>Check your connection to load OpenSeaMap.</span>
          </div>
        )}
      </div>
      
      {/* Legend */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem 1rem',
          marginTop: '0.5rem',
          padding: '0.5rem',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '4px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{ width: '12px', height: '3px', backgroundColor: '#123b66' }} />
          <span>Speed vector · 15 min (SOG / COG)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{ width: '14px', height: '3px', backgroundColor: '#19d3c5' }} />
          <span>Past positions · GPS / GPX replay</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <svg width="14" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path d={getWindBarbSvg(15, false)} fill="none" stroke="#10202a" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
            <path d={getWindBarbSvg(15, false)} fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <span>Wind barbs · hover for forecast</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M24 3 L40 38 Q24 47 8 38 Z" fill="#f4f8fb" stroke="#10202a" strokeWidth="4" />
            <path d="M24 8 L24 35" stroke="#19d3c5" strokeWidth="3" />
          </svg>
          <span>Vessel · HDG</span>
        </div>
        <span>Each barb uses the forecast at its location; nearby winds may match due to model resolution.</span>
        <span>Enable “Seamarks & navigation aids” to show OpenSeaMap data.</span>
        <span>Indicative data only · not a substitute for an official nautical chart.</span>
      </div>
    </div>
  );
};

const getWindDirectionText = (degrees: number): string => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round(degrees / 22.5) % 16];
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

  return `<strong>Vessel</strong><br>SOG: ${speed.toFixed(1)} kn<br>${courseLabel}: ${course.toFixed(0)}°`;
};

const createBoatIcon = (leaflet: any, heading: number) => leaflet.divIcon({
  className: 'boat-marker',
  html: `<svg class="boat-marker-icon" viewBox="0 0 48 48" aria-hidden="true" style="transform:rotate(${heading}deg)"><path d="M24 3 L40 38 Q24 47 8 38 Z" fill="#f4f8fb" stroke="#10202a" stroke-width="4"/><path d="M24 8 L24 35" stroke="#19d3c5" stroke-width="3" stroke-linecap="round"/></svg>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

const createAisIcon = (leaflet: any, target: AISTarget) => {
  const heading = target.heading ?? target.cog ?? 0;
  return leaflet.divIcon({
    className: 'ais-vessel-marker',
    html: `<svg class="ais-vessel-marker-icon" viewBox="0 0 32 32" aria-hidden="true" style="transform:rotate(${heading}deg)"><path d="M16 2 L26 25 L16 21 L6 25 Z" fill="#ffd166" stroke="#10202a" stroke-width="2"/><path d="M16 7 L16 21" stroke="#fff4cf" stroke-width="1.5"/></svg>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
};

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character] ?? character);

const getAISTargetTooltip = (target: AISTarget, source: AISSource): string => {
  const name = escapeHtml(target.name ?? 'Unknown vessel');
  const speed = target.sog === null ? '—' : `${target.sog.toFixed(1)} kn`;
  return `<strong>${name}</strong><br>MMSI ${escapeHtml(target.mmsi)}<br>SOG ${speed}<br>${source === 'local' ? 'Local VHF AIS' : 'Internet AIS · AISstream'}`;
};

const getAISTargetPopup = (target: AISTarget, source: AISSource): string => {
  const name = escapeHtml(target.name ?? 'Unknown vessel');
  const course = target.cog === null ? '—' : `${target.cog.toFixed(0)}°`;
  const heading = target.heading === null ? '—' : `${target.heading.toFixed(0)}°`;
  const updated = new Date(target.updatedAt).toLocaleTimeString('en-GB');
  return `<strong>${name}</strong><br>MMSI ${escapeHtml(target.mmsi)}<br>SOG: ${target.sog === null ? '—' : `${target.sog.toFixed(1)} kn}`}<br>COG: ${course} · HDG: ${heading}<br>Source: ${source === 'local' ? 'Local VHF AIS' : 'Internet AIS · AISstream'}<br>Last report: ${updated}<br><small>AIS positions may be delayed; not for collision avoidance.</small>`;
};

const getAISStatusMessage = (source: AISSource, state: AISBackendState | null): string => {
  if (!state) return 'Waiting for local navigation backend.';
  if (source === 'local') {
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

const getAISDetectedTargetCount = (source: AISSource, state: AISBackendState | null): number => {
  if (!state || state.source !== source) return 0;
  return source === 'local' ? state.localTargetCount : state.internetTargetCount;
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

  return `<path d="${path}" fill="#fff" stroke="#10202a" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><path d="${path}" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
};

export default MapViewSimple;
