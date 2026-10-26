import React from 'react';
import { SpeedData } from '../types';

interface SpeedometerProps {
  data: SpeedData | null;
  size?: number;
  onResetMaxSpeed?: () => void;
}

const Speedometer: React.FC<SpeedometerProps> = ({ data, size = 200, onResetMaxSpeed }) => {
  const displaySTW = data?.stw ?? data?.sog ?? data?.speed ?? 0;
  const displaySOG = data?.sog ?? data?.speed ?? 0;
  const displayMax = data?.maxSpeed ?? null;
  const needleAngle = (speed: number) => -135 + Math.min(Math.max(speed, 0), 15) / 15 * 270;
  const ticks = Array.from({ length: 16 }, (_, index) => {
    const angle = (-135 + index * 18) * Math.PI / 180;
    const innerRadius = index % 5 === 0 ? 53 : 57;
    const outerRadius = 63;
    const point = (radius: number) => ({
      x: 90 + Math.sin(angle) * radius,
      y: 84 - Math.cos(angle) * radius
    });
    return {
      value: index,
      start: point(innerRadius),
      end: point(outerRadius),
      label: point(43)
    };
  });

  return (
    <div className="instrument speedometer speed-instrument" style={{ '--speed-size': `${size}px` } as React.CSSProperties}>
      <svg
        className="speed-gauge"
        viewBox="0 0 180 132"
        role="img"
        aria-label={`Speed over water ${displaySTW.toFixed(1)} knots; speed over ground ${displaySOG.toFixed(1)} knots`}
      >
        <path className="speed-gauge-track" d="M 44.75 129.25 A 64 64 0 1 1 135.25 129.25" />
        {ticks.map(tick => (
          <g key={tick.value}>
            <line
              className={`speed-gauge-tick${tick.value % 5 === 0 ? ' speed-gauge-tick-major' : ''}`}
              x1={tick.start.x}
              y1={tick.start.y}
              x2={tick.end.x}
              y2={tick.end.y}
            />
            {tick.value % 5 === 0 && (
              <text className="speed-gauge-mark" x={tick.label.x} y={tick.label.y + 3}>
                {tick.value}
              </text>
            )}
          </g>
        ))}
        <line
          className="speed-needle speed-needle-stw"
          x1="90"
          y1="84"
          x2="90"
          y2="35"
          transform={`rotate(${needleAngle(displaySTW)} 90 84)`}
        />
        <line
          className="speed-needle speed-needle-sog"
          x1="90"
          y1="84"
          x2="90"
          y2="43"
          transform={`rotate(${needleAngle(displaySOG)} 90 84)`}
        />
        {displayMax !== null && (
          <g
            className="speed-max-marker"
            transform={`rotate(${needleAngle(displayMax)} 90 84)`}
          >
            <line x1="90" y1="21" x2="90" y2="36" />
            <circle cx="90" cy="17" r="2.6" />
          </g>
        )}
        <circle className="speed-gauge-hub" cx="90" cy="84" r="6" />
      </svg>
      <div className="speed-readouts">
        <div className="speed-reading speed-reading-stw">
          <span>STW</span>
          <strong>{displaySTW.toFixed(1)} <small>kn</small></strong>
        </div>
        <div className="speed-reading speed-reading-sog">
          <span>SOG</span>
          <strong>{displaySOG.toFixed(1)} <small>kn</small></strong>
        </div>
      </div>
      <div className="speed-max-row">
        <div className="speed-reading speed-reading-max">
          <span>MAX</span>
          <strong>{displayMax !== null ? `${displayMax.toFixed(1)}` : '--.-'} <small>kn</small></strong>
        </div>
        {onResetMaxSpeed && (
          <button
            type="button"
            className="speed-max-reset"
            onClick={onResetMaxSpeed}
            title="Reset session max speed"
          >
            RESET
          </button>
        )}
      </div>
    </div>
  );
};

export default Speedometer;
