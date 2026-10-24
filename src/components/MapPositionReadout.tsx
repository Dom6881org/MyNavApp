import React from 'react';
import { GPSTime, Position } from '../types';
import { formatCoordinate } from '../utils/formatCoordinate';

interface MapPositionReadoutProps {
  position: Position | null;
  gpsTime: GPSTime | null;
}

const MapPositionReadout: React.FC<MapPositionReadoutProps> = ({ position, gpsTime }) => (
  <div className="map-position-readout" role="status" aria-label="Position and time">
    <div className="map-position-readout-row">
      <span><em>LAT</em> {position ? formatCoordinate(position.latitude, true) : '—'}</span>
      <span><em>LON</em> {position ? formatCoordinate(position.longitude, false) : '—'}</span>
    </div>
    <div className="map-position-readout-row">
      <span><em>UTC</em> {gpsTime?.utcTime ?? '—'}</span>
      <span><em>LOCAL</em> {gpsTime?.localTime ?? '—'}</span>
      <span>{gpsTime?.date ?? '—'}</span>
    </div>
  </div>
);

export default MapPositionReadout;
