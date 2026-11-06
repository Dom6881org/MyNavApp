import React, { useEffect, useRef, useState } from 'react';
import * as LeafletBundle from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Position } from '../../types';
import { formatCoordinate } from '../../utils/formatCoordinate';
import type { AnchorRecord } from '../../hooks/useAnchor';
import { formatAnchorTime } from '../../hooks/useAnchor';
import InstrumentCard from './InstrumentCard';

/** Carte du reset COASTAL (#186, maquettes c1/c4 validées) :
 * « Fond + bateau + ⚓ uniquement, épuré au max » (Dom).
 *
 * Composant carte MINIMAL dédié — PAS MapViewSimple (64 Ko : barbes de
 * vent, tracks, AIS, outils de routage…). Fond OSM + seamarks + bateau
 * + marqueur ⚓ du mouillage, rien d'autre.
 *
 * Pied de carte : bouton « ⚓ MOUILLAGE FAIT » pleine largeur (accent) ;
 * une fois mouillé, barre « ⚓ date heure · position » + bouton
 * « NOUVEAU MOUILLAGE ». */

interface CoastalMapProps {
  position: Position | null;
  /** Cap du bateau (icône orientée), sinon COG, sinon triangle fixe. */
  heading: number | null;
  /** Mouillage enregistré (localStorage) — null tant que pas mouillé. */
  anchor: AnchorRecord | null;
  /** Enregistre un nouveau mouillage (REMPLACE l'ancien). */
  onDropAnchor: (latitude: number, longitude: number) => void;
}

/** window.L est déclaré globalement par MapViewSimple (LeafletObject) —
 * même mécanique que la carte principale. */

/** Icône bateau minimaliste : triangle blanc orienté au cap. */
const makeBoatIcon = (L: typeof LeafletBundle, heading: number) =>
  L.divIcon({
    className: 'coastal-map-boat-icon',
    html: `<svg width="26" height="26" viewBox="0 0 26 26" style="transform: rotate(${heading}deg)">
      <path d="M 13 3 L 7.5 22 L 13 18.5 L 18.5 22 Z" fill="#ffffff" stroke="#1a2530" stroke-width="1"/>
    </svg>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });

/** Marqueur ⚓ du mouillage : pastille accent + ancre blanche. */
const makeAnchorIcon = (L: typeof LeafletBundle) =>
  L.divIcon({
    className: 'coastal-map-anchor-icon',
    html: `<span class="coastal-map-anchor-pin">⚓</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

const CoastalMap: React.FC<CoastalMapProps> = ({
  position,
  heading,
  anchor,
  onDropAnchor
}) => {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletBundle.Map | null>(null);
  const boatRef = useRef<LeafletBundle.Marker | null>(null);
  const anchorMarkerRef = useRef<LeafletBundle.Marker | null>(null);
  const anchorLineRef = useRef<LeafletBundle.Polyline | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  // Leaflet identique au MapViewSimple : bundle exposé via window.L.
  useEffect(() => {
    window.L = LeafletBundle;
    setLeafletReady(true);
  }, []);

  // Démontage (changement de vue) : la carte est détruite proprement.
  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      boatRef.current = null;
      anchorMarkerRef.current = null;
      anchorLineRef.current = null;
    };
  }, []);

  // Init + update : bateau récentré à chaque position, ⚓ si mouillage.
  useEffect(() => {
    const L = window.L;
    if (!leafletReady || !L || !mapDivRef.current || !position) return;

    try {
      if (!mapRef.current) {
        const map = L.map(mapDivRef.current, {
          center: [position.latitude, position.longitude],
          zoom: 15,
          zoomControl: false,
          attributionControl: true
        });
        L.tileLayer('/api/tiles/osm/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          className: 'osm-base-tiles',
          maxZoom: 19,
          keepBuffer: 2,
          updateWhenIdle: true,
          updateWhenZooming: false
        }).addTo(map);
        L.tileLayer('/api/tiles/seamark/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openseamap.org/">OpenSeaMap</a> contributors',
          maxZoom: 18,
          minZoom: 9,
          minNativeZoom: 12,
          opacity: 0.9,
          keepBuffer: 2,
          updateWhenIdle: true,
          updateWhenZooming: false
        }).addTo(map);
        mapRef.current = map;
      }

      const map = mapRef.current;
      const boatIcon = makeBoatIcon(L, heading ?? 0);
      if (!boatRef.current) {
        boatRef.current = L.marker([position.latitude, position.longitude], {
          icon: boatIcon,
          title: 'Vessel',
          zIndexOffset: 1000
        }).addTo(map);
      } else {
        boatRef.current.setLatLng([position.latitude, position.longitude]);
        boatRef.current.setIcon(boatIcon);
      }
      map.setView([position.latitude, position.longitude]);

      // ⚓ du mouillage : pastille + pointillé vers le bateau.
      if (anchor) {
        const anchorPos: LeafletBundle.LatLngExpression = [
          anchor.latitude,
          anchor.longitude
        ];
        if (!anchorMarkerRef.current) {
          anchorMarkerRef.current = L.marker(anchorPos, {
            icon: makeAnchorIcon(L),
            title: 'Mouillage',
            zIndexOffset: 900
          }).addTo(map);
        } else {
          anchorMarkerRef.current.setLatLng(anchorPos);
        }
        const line: LeafletBundle.LatLngExpression[] = [
          anchorPos,
          [position.latitude, position.longitude]
        ];
        if (!anchorLineRef.current) {
          anchorLineRef.current = L.polyline(line, {
            color: '#4488ff',
            weight: 1.5,
            opacity: 0.9,
            dashArray: '4 6'
          }).addTo(map);
        } else {
          anchorLineRef.current.setLatLngs(line);
        }
      }
    } catch {
      setMapError(true);
    }
  }, [leafletReady, position, heading, anchor]);

  const canDropAnchor = position !== null;

  return (
    <InstrumentCard title="CARTE" hideToggle>
      <div className="coastal-map-stage" data-testid="coastal-map">
        <div
          className="coastal-map-canvas"
          ref={mapDivRef}
          role="img"
          aria-label="Carte du mouillage"
        />
        {(!position || mapError) && (
          <div className="coastal-map-fallback" data-testid="coastal-map-fallback">
            {mapError ? 'carte indisponible' : 'pas de position GPS'}
          </div>
        )}
      </div>
      {anchor === null ? (
        <button
          type="button"
          className="coastal-anchor-btn"
          data-testid="coastal-anchor-btn"
          disabled={!canDropAnchor}
          onClick={() => {
            if (position) onDropAnchor(position.latitude, position.longitude);
          }}
        >
          ⚓ MOUILLAGE FAIT
        </button>
      ) : (
        <div className="coastal-anchor-bar" data-testid="coastal-anchor-bar">
          <span className="coastal-anchor-info">
            ⚓ {formatAnchorTime(anchor.timestamp)} ·{' '}
            {formatCoordinate(anchor.latitude, true)}{' '}
            {formatCoordinate(anchor.longitude, false)}
          </span>
          <button
            type="button"
            className="coastal-anchor-btn new"
            data-testid="coastal-anchor-btn"
            disabled={!canDropAnchor}
            onClick={() => {
              if (position) onDropAnchor(position.latitude, position.longitude);
            }}
          >
            NOUVEAU MOUILLAGE
          </button>
        </div>
      )}
    </InstrumentCard>
  );
};

export default CoastalMap;
