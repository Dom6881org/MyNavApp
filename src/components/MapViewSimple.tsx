import React, { useEffect, useRef, useState } from 'react';
import { NavigationData, Position } from '../types';

// Extend Window interface for Leaflet
declare global {
  interface Window {
    L: any;
  }
}

interface MapViewSimpleProps {
  data: NavigationData;
  onWindGridRequest?: (points: Position[]) => void;
  size?: { width: number | string; height: number | string };
}

/**
 * Marine chart with OpenStreetMap base tiles and OpenSeaMap navigation marks.
 */
const MapViewSimple: React.FC<MapViewSimpleProps> = ({ data, onWindGridRequest, size }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState<boolean>(false);
  const [leafletError, setLeafletError] = useState<boolean>(false);
  
  // Load Leaflet library
  useEffect(() => {
    let disposed = false;
    let checkInterval: number | undefined;
    let timeoutId: number | undefined;
    const script = document.getElementById('leaflet-js') as HTMLScriptElement | null;

    const markLoaded = () => {
      if (disposed || !window.L) return;
      if (checkInterval !== undefined) window.clearInterval(checkInterval);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      setLeafletLoaded(true);
    };
    const markFailed = () => {
      if (disposed) return;
      if (checkInterval !== undefined) window.clearInterval(checkInterval);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      setLeafletError(true);
    };

    if (window.L) {
      markLoaded();
      return;
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css';
      link.onerror = markFailed;
      document.head.appendChild(link);
    }

    const leafletScript = script ?? document.createElement('script');
    leafletScript.id = 'leaflet-js';
    leafletScript.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js';
    leafletScript.addEventListener('load', markLoaded);
    leafletScript.addEventListener('error', markFailed);
    if (!script) document.head.appendChild(leafletScript);

    checkInterval = window.setInterval(markLoaded, 100);
    timeoutId = window.setTimeout(() => {
      if (!window.L) markFailed();
    }, 10000);

    return () => {
      disposed = true;
      if (checkInterval !== undefined) window.clearInterval(checkInterval);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      leafletScript.removeEventListener('load', markLoaded);
      leafletScript.removeEventListener('error', markFailed);
    };
  }, []);

  // Initialize map when Leaflet is ready
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || !window.L || leafletError || !data.position) return;
    
    const L = window.L;
    
    try {
      // Check if map already exists
      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current, {
          center: [data.position.latitude, data.position.longitude],
          zoom: 15,
          zoomControl: true,
          attributionControl: true
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
          { 'Balisage et aides à la navigation': seamarkLayer },
          { collapsed: true, position: 'topright' }
        ).addTo(map);
        L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);
        
        // Add boat marker
        const boatIcon = L.divIcon({
          className: 'boat-marker',
          html: '🚤',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });
        
        const marker = L.marker([data.position.latitude, data.position.longitude], {
          icon: boatIcon,
          title: 'Position du bateau'
        }).addTo(map);
        
        marker.bindPopup(`<b>Position du bateau</b><br>Lat: ${data.position.latitude.toFixed(6)}°<br>Lon: ${data.position.longitude.toFixed(6)}°`).openPopup();
        
        const instance = { map, marker };
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
          `<b>Position du bateau</b><br>Lat: ${data.position.latitude.toFixed(6)}°<br>Lon: ${data.position.longitude.toFixed(6)}°`
        );
      }
    } catch (error) {
      console.error('Map error:', error);
      if (!mapInstanceRef.current) setLeafletError(true);
    }
  }, [leafletLoaded, data.position, leafletError]);

  useEffect(() => () => {
    mapInstanceRef.current?.map.remove();
    mapInstanceRef.current = null;
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
    
    // SOG Vector (blue dashed)
    if (data.compass?.cog !== null && data.compass?.cog !== undefined && data.speed?.sog && data.speed.sog > 0) {
      const cogRad = data.compass.cog * Math.PI / 180;
      const scale = (data.speed.sog * 1852) / 111320; // meters to degrees
      const endLat = lat + Math.cos(cogRad) * scale;
      const endLng = lng + Math.sin(cogRad) * scale / Math.cos(lat * Math.PI / 180);
      mapInstance.sogLine = L.polyline([[lat, lng], [endLat, endLng]], {
        color: '#4488ff', weight: 3, dashArray: '10,5', opacity: 0.8
      }).addTo(map);
    }
    
    // Speed Vector (red solid)
    if (data.compass?.heading !== null && data.compass?.heading !== undefined && data.speed?.speed && data.speed.speed > 0) {
      const headingRad = data.compass.heading * Math.PI / 180;
      const scale = (data.speed.speed * 1852) / 111320;
      const endLat = lat + Math.cos(headingRad) * scale;
      const endLng = lng + Math.sin(headingRad) * scale / Math.cos(lat * Math.PI / 180);
      mapInstance.speedLine = L.polyline([[lat, lng], [endLat, endLng]], {
        color: '#ff4444', weight: 2, opacity: 0.8
      }).addTo(map);
    }
    
    // Update marker
    if (mapInstance.marker) {
      mapInstance.marker.setLatLng([lat, lng]);
      mapInstance.marker.setPopupContent(
        `<b>Position du bateau</b><br>Lat: ${lat.toFixed(6)}°<br>Lon: ${lng.toFixed(6)}°`
      );
    }
  }, [mapInstance, leafletLoaded, leafletError, data]);

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
        L.marker([point.position.latitude, point.position.longitude], {
          icon: barbIcon,
            interactive: false,
            keyboard: false,
            zIndexOffset: 500
        }).addTo(flowLayer);
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
        minHeight: '500px',
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
          Carte marine - OpenSeaMap
        </span>
      </div>
      
      {/* Map container */}
      <div 
        ref={mapRef}
        style={{
          width: '100%',
          flex: 1,
          height: '100%',
          minHeight: '400px',
          position: 'relative',
          overflow: 'hidden',
          border: '2px solid var(--accent-color)',
          borderRadius: '4px',
          background: leafletError ? 'var(--bg-secondary)' : '#1a2e1a'
        }}
      >
        <div className="wind-map-readout" aria-live="polite">
          <strong>VENT · PRÉVISION OPEN-METEO</strong>
          {data.wind ? (
            <span>
              {data.wind.speed.toFixed(1)} kn · vient du {getWindDirectionText(data.wind.direction)} {data.wind.direction.toFixed(0)}°
              {' · '}rafales {data.wind.gust.toFixed(1)} kn
            </span>
          ) : (
            <span>{data.windForecastStatus.error || (data.windForecastStatus.isLoading ? 'Chargement…' : 'En attente du GPS')}</span>
          )}
          {data.windForecastStatus.updatedAt && (
            <span className="wind-map-updated">
              Mise à jour {new Date(data.windForecastStatus.updatedAt).toLocaleTimeString('fr-FR')}
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
            <div>Chargement de la carte marine...</div>
          </div>
        )}

        {!leafletError && leafletLoaded && !data.position && (
          <>
            <div className="map-gps-pending">
              Autorisez l’accès à la position pour afficher la carte autour du bateau.
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
            <strong>Carte marine indisponible</strong>
            <span>Vérifiez votre connexion pour charger OpenSeaMap.</span>
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
          <div style={{ width: '12px', height: '2px', backgroundColor: '#ff4444' }} />
          <span>Cap et vitesse</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{ width: '12px', height: '2px', backgroundColor: '#4488ff', border: '1px dashed #4488ff' }} />
          <span>Route fond (COG)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <svg width="14" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path d={getWindBarbSvg(15, false)} fill="none" stroke="#10202a" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
            <path d={getWindBarbSvg(15, false)} fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <span>Barbules du vent · Open-Meteo</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span>🚤</span>
          <span>Position du bateau</span>
        </div>
        <span>Chaque barbule utilise la prévision à son emplacement; les vents proches peuvent rester identiques selon la résolution météo.</span>
        <span>Activez « Balisage et aides à la navigation » pour afficher les données OpenSeaMap.</span>
        <span>Ces données indicatives ne remplacent pas une carte marine officielle.</span>
      </div>
    </div>
  );
};

const getWindDirectionText = (degrees: number): string => {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  return directions[Math.round(degrees / 22.5) % 16];
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
