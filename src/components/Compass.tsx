import React from 'react';
import { CompassData } from '../types';
import useDisplayMode from '../hooks/useDisplayMode';

interface CompassProps {
  data: CompassData | null;
  size?: number;
}

const Compass: React.FC<CompassProps> = ({ data, size = 200 }) => {
  const course = data?.cog ?? data?.heading ?? 0;
  const heading = data?.heading ?? 0;
  const cog = data?.cog ?? 0;
  const { displayMode, toggleDisplayMode } = useDisplayMode('compass-display-mode');
  const isDigital = displayMode === 'digital';

  return (
    <div className="instrument compass course-instrument" style={{ '--compass-size': `${size}px` } as React.CSSProperties}>
      <button
        type="button"
        className="instrument-mode-toggle"
        onClick={toggleDisplayMode}
        title={isDigital ? 'Switch to dial display' : 'Switch to digital display'}
      >
        {isDigital ? 'DIAL' : 'DIGITAL'}
      </button>
      {isDigital ? (
        <div className="instrument-digital">
          <div className="instrument-digital-row instrument-digital-cog">
            <span>COG</span>
            <strong>{cog.toFixed(0)}°</strong>
          </div>
          <div className="instrument-digital-row instrument-digital-hdg">
            <span>HDG</span>
            <strong>{heading.toFixed(0)}°</strong>
          </div>
        </div>
      ) : (
        <>
          <div className="compass-dial" aria-label={`Course ${course.toFixed(0)} degrees`}>
            <svg viewBox="0 0 180 94" aria-hidden="true">
              <g className="compass-rose" style={{ transform: `rotate(${-course}deg)` }}>
                <circle className="compass-dial-ring" cx="90" cy="90" r="78" />
                {Array.from({ length: 36 }, (_, index) => (
                  <line
                    key={index}
                    className={index % 3 === 0 ? 'compass-tick compass-tick-major' : 'compass-tick'}
                    x1="90"
                    y1="12"
                    x2="90"
                    y2={index % 3 === 0 ? '23' : '18'}
                    transform={`rotate(${index * 10} 90 90)`}
                  />
                ))}
                <text className="compass-cardinal" x="90" y="34">N</text>
                <text className="compass-cardinal" x="136" y="94">E</text>
                <text className="compass-cardinal" x="90" y="174">S</text>
                <text className="compass-cardinal" x="44" y="94">W</text>
              </g>
              <g className="compass-needle">
                <path d="M90 8 L96 23 L90 19 L84 23 Z" />
              </g>
            </svg>
            <span className="compass-heading-value">{course.toFixed(0)}°</span>
          </div>
          <div className="course-secondary-readings">
            <div><span>HDG</span><strong>{heading.toFixed(0)}°</strong></div>
            <div><span>COG</span><strong>{cog.toFixed(0)}°</strong></div>
          </div>
        </>
      )}
    </div>
  );
};

export default Compass;
