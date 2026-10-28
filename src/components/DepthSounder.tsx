import React from 'react';
import { DepthData } from '../types';
import useDisplayMode from '../hooks/useDisplayMode';

interface DepthSounderProps {
  data: DepthData | null;
  unit: 'meters' | 'feet' | 'fathoms';
  size?: number;
}

const DEPTH_SCALE_MAX = 100;

const DepthSounder: React.FC<DepthSounderProps> = ({ data, unit, size = 200 }) => {
  const { displayMode, toggleDisplayMode } = useDisplayMode('depth-sounder-display-mode');
  const isDigital = displayMode === 'digital';

  const convertDepth = (depth: number): number => {
    switch (unit) {
      case 'feet': return depth * 3.28084;
      case 'fathoms': return depth / 1.8288;
      default: return depth;
    }
  };

  const getUnitLabel = () => {
    switch (unit) {
      case 'feet': return 'ft';
      case 'fathoms': return 'fath';
      default: return 'm';
    }
  };

  const displayDepth = data ? convertDepth(data.depth) : null;
  const unitLabel = getUnitLabel();

  const getDepthColor = () => {
    if (!data || displayDepth === null) return 'var(--text-secondary)';
    if (data.alarm) return 'var(--danger-color)';
    if (displayDepth < 15) return 'var(--warning-color)';
    if (displayDepth < 30) return 'var(--accent-color)';
    return '#00ff88';
  };

  const depthColor = getDepthColor();

  const needleAngle = (depth: number) =>
    -135 + Math.min(Math.max(depth, 0), DEPTH_SCALE_MAX) / DEPTH_SCALE_MAX * 270;
  const ticks = Array.from({ length: 11 }, (_, index) => {
    const angle = (-135 + index * 27) * Math.PI / 180;
    const innerRadius = index % 5 === 0 ? 53 : 57;
    const outerRadius = 63;
    const point = (radius: number) => ({
      x: 90 + Math.sin(angle) * radius,
      y: 84 - Math.cos(angle) * radius
    });
    return {
      value: index * (DEPTH_SCALE_MAX / 10),
      start: point(innerRadius),
      end: point(outerRadius),
      label: point(43)
    };
  });

  if (!data || displayDepth === null) {
    return <div className="instrument-unavailable">No depth data · connect a depth sounder</div>;
  }

  return (
    <div className="instrument depth-sounder depth-instrument" style={{ '--depth-size': `${size}px` } as React.CSSProperties}>
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
          <div className="instrument-digital-row instrument-digital-depth">
            <span>DEPTH</span>
            <strong style={{ color: depthColor }}>{displayDepth.toFixed(1)}</strong>
            <small>{unitLabel}</small>
          </div>
          <div className="instrument-digital-row instrument-digital-secondary instrument-digital-temp">
            <span>TEMP</span>
            <strong>{data.temperature.toFixed(1)}°C</strong>
          </div>
          {data.alarm && (
            <span className="depth-alarm-note">SHALLOW ALARM</span>
          )}
        </div>
      ) : (
        <>
          <svg
            className="speed-gauge"
            viewBox="0 0 180 132"
            role="img"
            aria-label={`Depth ${displayDepth.toFixed(1)} ${unitLabel}; water temperature ${data.temperature.toFixed(1)} degrees Celsius`}
          >
            <path className="speed-gauge-track" d="M 44.75 129.25 A 64 64 0 1 1 135.25 129.25" />
            {ticks.map(tick => (
              <g key={tick.value}>
                <line
                  className={`speed-gauge-tick${tick.value % 50 === 0 ? ' speed-gauge-tick-major' : ''}`}
                  x1={tick.start.x}
                  y1={tick.start.y}
                  x2={tick.end.x}
                  y2={tick.end.y}
                />
                {tick.value % 50 === 0 && (
                  <text className="speed-gauge-mark" x={tick.label.x} y={tick.label.y + 3}>
                    {tick.value}
                  </text>
                )}
              </g>
            ))}
            <line
              className="speed-needle speed-needle-depth"
              style={{ stroke: depthColor }}
              x1="90"
              y1="84"
              x2="90"
              y2="35"
              transform={`rotate(${needleAngle(displayDepth)} 90 84)`}
            />
            <circle className="speed-gauge-hub" cx="90" cy="84" r="6" />
          </svg>
          <div className="speed-readouts">
            <div className="speed-reading speed-reading-depth">
              <span>DEPTH</span>
              <strong style={{ color: depthColor }}>{displayDepth.toFixed(1)} <small>{unitLabel}</small></strong>
            </div>
            <div className="speed-reading speed-reading-temp">
              <span>TEMP</span>
              <strong>{data.temperature.toFixed(1)} <small>°C</small></strong>
            </div>
          </div>
          {data.alarm && (
            <div className="speed-max-row">
              <span className="depth-alarm-note">SHALLOW ALARM</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DepthSounder;
