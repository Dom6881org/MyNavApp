import React from 'react';
import { GPSTime, Position } from '../types';
import { formatCoordinate } from '../utils/formatCoordinate';

interface MapPositionReadoutProps {
  position: Position | null;
  gpsTime: GPSTime | null;
  part: 'position' | 'time';
  /** Pre-formatted REC elapsed time, shown next to the date while a track is being recorded. */
  recording?: string | null;
}

const MapPositionReadout: React.FC<MapPositionReadoutProps> = ({ position, gpsTime, part, recording }) => (
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
          <span><em>LOCAL</em> {gpsTime ? `${gpsTime.date} ${gpsTime.localTime}` : '—'}</span>
          <span><em>UTC</em> {gpsTime?.utcTime ?? '—'}</span>
          {recording && (
            <span className="map-rec-indicator">
              <span className="map-rec-indicator-dot" aria-hidden="true" />
              REC {recording}
            </span>
          )}
        </>
      )}
    </div>
  </div>
);

export default MapPositionReadout;
