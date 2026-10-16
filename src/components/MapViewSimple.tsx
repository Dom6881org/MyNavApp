import React, { useEffect, useRef, useState } from 'react';
import { NavigationData } from '../types';

// Extend Window interface for Leaflet
declare global {
  interface Window {
    L: any;
  }
}

interface MapViewSimpleProps {
  data: NavigationData;
  size?: { width: number | string; height: number | string };
}

/**
 * Simple map display with fallback static image
 */
const MapViewSimple: React.FC<MapViewSimpleProps> = ({ data, size }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState<boolean>(false);
  const [leafletError, setLeafletError] = useState<boolean>(false);
  
  // Load Leaflet library
  useEffect(() => {
    const loadLeaflet = () => {
      if (window.L) {
        setLeafletLoaded(true);
        return;
      }
      
      // Check if already loading
      if (document.getElementById('leaflet-js')) {
        const check = setInterval(() => {
          if (window.L) {
            clearInterval(check);
            setLeafletLoaded(true);
          }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(check);
          setLeafletError(true);
        }, 10000);
        return;
      }
      
      // Load CSS
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css';
      link.onerror = () => setLeafletError(true);
      document.head.appendChild(link);
      
      // Load JS
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js';
      script.onload = () => setLeafletLoaded(true);
      script.onerror = () => setLeafletError(true);
      document.head.appendChild(script);
      
      // Timeout
      setTimeout(() => {
        if (!window.L) {
          setLeafletError(true);
        }
      }, 10000);
    };
    
    loadLeaflet();
    return () => {};
  }, []);

  // Initialize map when Leaflet is ready
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || !window.L || leafletError) return;
    
    const L = window.L;
    
    try {
      // Check if map already exists
      if (!mapInstance) {
        const map = L.map(mapRef.current, {
          center: [data.position.latitude, data.position.longitude],
          zoom: 15,
          zoomControl: true,
          attributionControl: false
        });
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19
        }).addTo(map);
        
        // Add boat marker
        const boatIcon = L.divIcon({
          className: 'boat-marker',
          html: '🚤',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });
        
        const marker = L.marker([data.position.latitude, data.position.longitude], {
          icon: boatIcon,
          title: 'Position'
        }).addTo(map);
        
        marker.bindPopup(`<b>Position</b><br>Lat: ${data.position.latitude.toFixed(6)}°<br>Lon: ${data.position.longitude.toFixed(6)}°`).openPopup();
        
        setMapInstance({ map, marker });
      } else {
        // Update existing map
        mapInstance.map.setView([data.position.latitude, data.position.longitude]);
        mapInstance.marker.setLatLng([data.position.latitude, data.position.longitude]);
      }
    } catch (error) {
      console.error('Map error:', error);
      setLeafletError(true);
    }
  }, [leafletLoaded, data.position, leafletError]);

  // Update vectors when data changes
  useEffect(() => {
    if (!mapInstance || !leafletLoaded || leafletError || !window.L) return;
    
    const L = window.L;
    const map = mapInstance.map;
    const lat = data.position.latitude;
    const lng = data.position.longitude;
    
    // Clear old vectors
    if (mapInstance.sogLine) map.removeLayer(mapInstance.sogLine);
    if (mapInstance.speedLine) map.removeLayer(mapInstance.speedLine);
    if (mapInstance.windLine) map.removeLayer(mapInstance.windLine);
    
    // SOG Vector (blue dashed)
    if (data.compass && data.speed?.sog > 0) {
      const cogRad = data.compass.cog * Math.PI / 180;
      const scale = (data.speed.sog * 1852) / 111320; // meters to degrees
      const endLat = lat + Math.cos(cogRad) * scale;
      const endLng = lng + Math.sin(cogRad) * scale / Math.cos(lat * Math.PI / 180);
      mapInstance.sogLine = L.polyline([[lat, lng], [endLat, endLng]], {
        color: '#4488ff', weight: 3, dashArray: '10,5', opacity: 0.8
      }).addTo(map);
    }
    
    // Speed Vector (red solid)
    if (data.compass && data.speed?.speed > 0) {
      const headingRad = data.compass.heading * Math.PI / 180;
      const scale = (data.speed.speed * 1852) / 111320;
      const endLat = lat + Math.cos(headingRad) * scale;
      const endLng = lng + Math.sin(headingRad) * scale / Math.cos(lat * Math.PI / 180);
      mapInstance.speedLine = L.polyline([[lat, lng], [endLat, endLng]], {
        color: '#ff4444', weight: 2, opacity: 0.8
      }).addTo(map);
    }
    
    // Wind Vector (white dashed)
    if (data.wind?.speed > 0) {
      const windDirRad = data.wind.direction * Math.PI / 180;
      const scale = (data.wind.speed * 1852 * 0.5) / 111320;
      const endLat = lat + Math.cos(windDirRad) * scale;
      const endLng = lng + Math.sin(windDirRad) * scale / Math.cos(lat * Math.PI / 180);
      mapInstance.windLine = L.polyline([[lat, lng], [endLat, endLng]], {
        color: '#ffffff', weight: 2, dashArray: '5,3', opacity: 0.8
      }).addTo(map);
    }
    
    // Update marker
    if (mapInstance.marker) {
      mapInstance.marker.setLatLng([lat, lng]);
    }
  }, [mapInstance, leafletLoaded, leafletError, data]);

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
          Carte - Position actuelle
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
        {/* Leaflet map */}
        {!leafletError && (
          <>
            {/* Loading message */}
            {!leafletLoaded && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'rgba(0, 0, 0, 0.8)',
                padding: '1rem',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '1rem',
                zIndex: 1000,
                textAlign: 'center'
              }}>
                <div>Chargement de Leaflet...</div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.7 }}>
                  Veuillez patienter
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Fallback static map */}
        {leafletError && (
          <img
            src={`https://static-maps.yandex.ru/1.x/?ll=${data.position.longitude},${data.position.latitude}&z=15&l=map&size=800,600&pt=${data.position.longitude},${data.position.latitude},pm2blm`}
            alt="Carte statique"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              minHeight: '400px'
            }}
          />
        )}
        
        {/* Error message overlay */}
        {leafletError && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255, 0, 0, 0.8)',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '0.85rem',
            zIndex: 1000,
            textAlign: 'center'
          }}>
            Utilisation d'une carte statique
          </div>
        )}
      </div>
      
      {/* Legend */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
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
          <span>Speed (Heading)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{ width: '12px', height: '2px', backgroundColor: '#4488ff', border: '1px dashed #4488ff' }} />
          <span>SOG (COG)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{ width: '12px', height: '2px', backgroundColor: '#ffffff', border: '1px dashed #ffffff' }} />
          <span>Vent</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span>🚤</span>
          <span>Position</span>
        </div>
      </div>
    </div>
  );
};

export default MapViewSimple;
