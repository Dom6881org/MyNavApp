import React from 'react';
import { GPSTime, Position } from '../types';
import { formatCoordinate } from '../utils/formatCoordinate';

interface MapPositionReadoutProps {
  position: Position | null;
  gpsTime: GPSTime | null;
  part: 'position' | 'time';
}

const MapPositionReadout: React.FC<MapPositionReadoutProps> = ({ position, gpsTime, part }) => (
  <div
    className={`map-position-readout map-position-readout-${part}`}
    role="status"
    aria-label={part === 'position' ? 'Position' : 'Date and time'}
  >
    <div className="map-position-readout-row">
      {part === 'position' ? (
        <>
          <span><em>LAT</em> {position ? formatCoordinate(position.latitude, true) : '—'}</span>
          <span><em>LON</em> {position ? formatCoordinate(position.longitude, false) : '—'}</span>
        </>
      ) : (
        <>
          <span><em>UTC</em> {gpsTime?.utcTime ?? '—'}</span>
          <span><em>LOCAL</em> {gpsTime?.localTime ?? '—'}</span>
          <span>{gpsTime?.date ?? '—'}</span>
        </>
      )}
    </div>
  </div>
);

export default MapPositionReadout;
