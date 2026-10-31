import React from 'react';
import { ApparentWindData, WindData, WindForecastStatus } from '../types';
import useDisplayMode from '../hooks/useDisplayMode';

interface WindIndicatorProps {
  apparentWind: ApparentWindData | null;
  trueWind: ApparentWindData | null;
  forecastWind: WindData | null;
  forecastStatus: WindForecastStatus;
  headingDegrees: number | null;
  unit: 'knots' | 'kmh' | 'mph';
  boatSpeedKnots?: number | null;
  size?: number;
}

const WindIndicator: React.FC<WindIndicatorProps> = ({
  apparentWind,
  trueWind: measuredTrueWind = null,
  forecastWind,
  forecastStatus,
  headingDegrees,
  unit,
  boatSpeedKnots = null,
  size = 200
}) => {
  const usesForecast = apparentWind === null;
  const isForecast = usesForecast && forecastWind !== null;
  const speedKnots = apparentWind?.speedKnots ?? forecastWind?.speed ?? null;
  const speed = speedKnots === null
    ? null
    : speedKnots * (unit === 'kmh' ? 1.852 : unit === 'mph' ? 1.15078 : 1);
  const unitLabel = unit === 'kmh' ? 'km/h' : unit === 'mph' ? 'mph' : 'kn';
  const relativeWindAngle = apparentWind
    ? apparentWind.angleDegrees
    : forecastWind
      ? forecastWind.direction - (headingDegrees ?? 0)
      : null;
  const dialAngle = relativeWindAngle === null
    ? null
    : ((relativeWindAngle + 180) % 360 + 360) % 360 - 180;
  const computedTrueWind = apparentWind && boatSpeedKnots !== null
    ? (() => {
        const awa = (apparentWind.angleDegrees * Math.PI) / 180;
        const vx = boatSpeedKnots - apparentWind.speedKnots * Math.cos(awa);
        const vy = -apparentWind.speedKnots * Math.sin(awa);
        const speedKnots = Math.hypot(vx, vy);
        const angleDegrees = ((Math.atan2(-vy, -vx) * 180) / Math.PI + 540) % 360 - 180;
        return { speedKnots, angleDegrees };
      })()
    : null;
  const trueWind = measuredTrueWind ?? computedTrueWind;
  const trueSpeed = trueWind === null
    ? null
    : trueWind.speedKnots * (unit === 'kmh' ? 1.852 : unit === 'mph' ? 1.15078 : 1);
  // WIMWV 'T' = TWD absolu (nord vrai) ; le repli calculé depuis le vent apparent
  // est déjà relatif (TWA). On ramène tout en TWA = TWD - cap quand le cap est connu.
  const trueWindAngleDegrees = trueWind === null
    ? null
    : measuredTrueWind !== null && headingDegrees !== null
      ? (((measuredTrueWind.angleDegrees - headingDegrees) % 360) + 360) % 360
      : trueWind.angleDegrees;
  const trueDialAngle = trueWindAngleDegrees === null
    ? null
    : ((trueWindAngleDegrees + 180) % 360 + 360) % 360 - 180;
  const trueAngleDisplay = trueWindAngleDegrees === null
    ? null
    : ((trueWindAngleDegrees % 360) + 360) % 360;
  const dialLabel = apparentWind
    ? `Apparent wind angle ${apparentWind.angleDegrees.toFixed(0)} degrees relative to the boat${trueWind ? `; true wind ${trueWind.speedKnots.toFixed(1)} knots at ${trueAngleDisplay?.toFixed(0)} degrees relative to the boat` : ''}`
    : forecastWind && dialAngle !== null && headingDegrees !== null
      ? `Forecast wind ${Math.abs(dialAngle).toFixed(0)} degrees ${dialAngle < 0 ? 'to port' : 'to starboard'} relative to the boat`
      : forecastWind
        ? `Forecast wind from ${forecastWind.direction.toFixed(0)} degrees true; boat heading is unavailable, so the needle is shown relative to north`
      : 'Wind direction unavailable';
  const sourceLabel = apparentWind
    ? 'ONBOARD'
    : forecastWind
      ? `FORECAST · ${forecastWind.source}`
      : forecastStatus.isLoading
        ? 'LOADING FORECAST'
        : forecastStatus.error
          ? 'FORECAST UNAVAILABLE'
          : 'NO WIND DATA';
  const point = (angle: number, radius: number) => ({
    x: 120 + radius * Math.sin((angle * Math.PI) / 180),
    y: 120 - radius * Math.cos((angle * Math.PI) / 180)
  });
  const arc = (start: number, end: number, radius: number) => {
    const from = point(start, radius);
    const to = point(end, radius);
    return `M ${from.x} ${from.y} A ${radius} ${radius} 0 0 1 ${to.x} ${to.y}`;
  };
  const { displayMode, toggleDisplayMode } = useDisplayMode('wind-indicator-display-mode');
  const isDigital = displayMode === 'digital';
  const angleValue = apparentWind
    ? apparentWind.angleDegrees
    : forecastWind
      ? forecastWind.direction
      : null;

  return (
    <div className={`instrument wind-indicator wind-instrument${isForecast ? ' wind-instrument-forecast' : ''}`} style={{ '--wind-size': `${size}px` } as React.CSSProperties}>
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
          <div className="instrument-digital-row instrument-digital-wind">
            <span>{apparentWind ? 'AWS' : 'WIND'}</span>
            <strong>{speed === null ? '--.-' : speed.toFixed(1)}</strong>
            <small>{unitLabel}</small>
          </div>
          <div className="instrument-digital-row instrument-digital-secondary instrument-digital-angle">
            <span>{apparentWind ? 'AWA' : 'DIR'}</span>
            <strong>{angleValue === null ? '--' : angleValue.toFixed(0)}°</strong>
          </div>
          {trueWind && (
            <>
              <div className="instrument-digital-row instrument-digital-wind">
                <span>TWS</span>
                <strong>{trueSpeed === null ? '--.-' : trueSpeed.toFixed(1)}</strong>
                <small>{unitLabel}</small>
              </div>
              <div className="instrument-digital-row instrument-digital-secondary instrument-digital-angle">
                <span>TWA</span>
                <strong>{trueAngleDisplay === null ? '--' : `${trueAngleDisplay.toFixed(0)}°`}</strong>
              </div>
            </>
          )}
          <span className="wind-forecast-note">{sourceLabel}</span>
        </div>
      ) : (
        <div className="wind-gauge-column">
          <svg className="wind-gauge" viewBox="0 0 240 240" role="img" aria-label={dialLabel}>
            <circle className="wind-gauge-face" cx="120" cy="120" r="108" />
            <circle className="wind-gauge-track" cx="120" cy="120" r="98" />
            <path className="wind-gauge-sector wind-gauge-sector-port" d={arc(-35, 0, 98)} />
            <path className="wind-gauge-sector wind-gauge-sector-starboard" d={arc(0, 35, 98)} />
            {Array.from({ length: 36 }, (_, index) => {
              const angle = -180 + index * 10;
              const major = index % 3 === 0;
              const tickStart = point(angle, major ? 78 : 83);
              const tickEnd = point(angle, 91);
              const label = major ? point(angle, 66) : null;
              return (
                <g key={angle}>
                  <line
                    className={`wind-gauge-tick${major ? ' wind-gauge-tick-major' : ''}`}
                    x1={tickStart.x}
                    y1={tickStart.y}
                    x2={tickEnd.x}
                    y2={tickEnd.y}
                  />
                  {label && (
                    <text className="wind-gauge-number" x={label.x} y={label.y + 4} textAnchor="middle">
                      {Math.abs(angle)}
                    </text>
                  )}
                </g>
              );
            })}
            {dialAngle !== null && (
              <g className="wind-gauge-needle" transform={`rotate(${dialAngle} 120 120)`}>
                <line x1="120" y1="120" x2="120" y2="43" />
                <path d="M120 36 L115 50 L120 46 L125 50 Z" />
              </g>
            )}
            <circle className="wind-gauge-pivot" cx="120" cy="120" r="5" />
            <path className="wind-gauge-hull" d="M120 91 L127 112 L120 108 L113 112 Z" />
            {trueDialAngle !== null && (
              <g className="wind-gauge-needle wind-gauge-needle-true" transform={`rotate(${trueDialAngle} 120 120)`}>
                <line x1="120" y1="120" x2="120" y2="37" />
                <path d="M120 30 L115.5 44 L120 41 L124.5 44 Z" />
              </g>
            )}
            <rect
              className="wind-gauge-lcd"
              x={trueWind ? 84 : 90}
              y={trueWind ? 122 : 134}
              width={trueWind ? 72 : 60}
              height={trueWind ? 52 : 31}
              rx="3"
            />
            <text className="wind-gauge-mode" x="120" y={trueWind ? 131 : 143} textAnchor="middle">
              {apparentWind ? 'AWS' : forecastWind ? 'WIND' : '—'}
            </text>
            <text
              className={`wind-gauge-speed${trueWind ? ' wind-gauge-speed-compact' : ''}`}
              x="114"
              y={trueWind ? 144 : 160}
              textAnchor="middle"
            >
              {speed === null ? '—' : speed.toFixed(1)}
            </text>
            <text className="wind-gauge-unit" x="141" y={trueWind ? 144 : 160} textAnchor="middle">{unitLabel}</text>
            {trueWind && (
              <>
                <text className="wind-gauge-mode" x="120" y="155" textAnchor="middle">TWS</text>
                <text className="wind-gauge-speed wind-gauge-speed-compact" x="114" y="168" textAnchor="middle">
                  {trueSpeed === null ? '—' : trueSpeed.toFixed(1)}
                </text>
                <text className="wind-gauge-unit" x="141" y="168" textAnchor="middle">{unitLabel}</text>
              </>
            )}
          </svg>
          <span className="wind-forecast-note">{sourceLabel}</span>
        </div>
      )}
    </div>
  );
};

export default WindIndicator;
