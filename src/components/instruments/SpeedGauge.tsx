import React from 'react';

/** Jauge de vitesse « legacy » (#184, retour n°21-quater de Dom) —
 * extraction du dial de Speedometer.tsx SANS son bouton interne ni
 * useDisplayMode : le panneau HELM pilote le format (switch CADRAN /
 * NUMÉRIQUE), ce composant ne rend QUE la jauge (aiguilles STW/SOG,
 * marque MAX, readouts) + la ligne MAX avec son bouton RESET.
 *
 * Géométrie legacy fidèle (Speedometer.tsx) : viewBox 0 0 180 132,
 * pivot (90,84), arc r=64 balayant 270°, 16 graduations tous les 18°
 * (majeures %5 avec label), aiguille = -135° + clamp(v,0,15)/15·270° —
 * STW #ffb454 → (90,35), SOG #36c7d0 → (90,43), marque MAX #ff4d4f,
 * hub r=6. Réutilise les classes globales .speed-* d'App.css. */

interface SpeedGaugeProps {
  /** Vitesse sur le fond (SOG). */
  sog: number | null;
  /** Vitesse sur l'eau (STW) — repli SOG si absente (jauge, legacy). */
  stw: number | null;
  /** Max de vitesse de session (marque + ligne MAX). */
  maxSpeed: number | null;
  /** Bouton RESET de la ligne MAX (masqué si absent). */
  onResetMaxSpeed?: () => void;
}

const SpeedGauge: React.FC<SpeedGaugeProps> = ({ sog, stw, maxSpeed, onResetMaxSpeed }) => {
  // Legacy : STW repli SOG, SOG repli 0 — l'aiguille a besoin d'un angle.
  const displayStw = stw ?? sog ?? 0;
  const displaySog = sog ?? 0;
  const displayMax = maxSpeed ?? null;
  const maxText = displayMax !== null ? displayMax.toFixed(1) : '--.-';
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
    <div className="instrument speedometer speed-instrument" data-testid="speed-gauge">
      <svg
        className="speed-gauge"
        viewBox="0 0 180 132"
        role="img"
        aria-label={`Speed over water ${displayStw.toFixed(1)} knots; speed over ground ${displaySog.toFixed(1)} knots`}
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
          transform={`rotate(${needleAngle(displayStw)} 90 84)`}
        />
        <line
          className="speed-needle speed-needle-sog"
          x1="90"
          y1="84"
          x2="90"
          y2="43"
          transform={`rotate(${needleAngle(displaySog)} 90 84)`}
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
          <strong>{displayStw.toFixed(1)} <small>kn</small></strong>
        </div>
        <div className="speed-reading speed-reading-sog">
          <span>SOG</span>
          <strong>{displaySog.toFixed(1)} <small>kn</small></strong>
        </div>
      </div>
      <div className="speed-max-row">
        <div className="speed-reading speed-reading-max">
          <span>MAX</span>
          <strong>{maxText} <small>kn</small></strong>
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

export default SpeedGauge;
