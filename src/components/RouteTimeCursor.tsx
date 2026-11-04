import React from 'react';
import { cursorAtTimeS } from '../utils/routeCursor';

/** Curseur temporel de la route (A2, #154) : voyage dans le temps le long de
 * la route calculée — à quel instant le bateau sera où, sous quel cap et à
 * quelle vitesse. Phase a : lecture dans le panneau ; le marqueur carte est
 * le chantier suivant (b). */
interface RouteTimeCursorProps {
  coords: [number, number][];
  timesS: number[];
  sogKts?: number[];
  etaS: number;
}

const formatElapsedHours = (elapsedS: number): string => {
  const hours = elapsedS / 3600;
  return hours >= 10 ? `${hours.toFixed(0)} h` : `${hours.toFixed(1)} h`;
};

const formatClock = (epochS: number): string =>
  new Date(epochS * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const RouteTimeCursor: React.FC<RouteTimeCursorProps> = ({ coords, timesS, sogKts, etaS }) => {
  const [cursorS, setCursorS] = React.useState(0);

  // Nouvelle route calculée -> retour au départ.
  React.useEffect(() => {
    setCursorS(0);
  }, [coords]);

  if (coords.length < 2 || timesS.length !== coords.length || etaS <= 0) return null;

  const step = Math.max(etaS / 240, 1);
  const cursor = cursorAtTimeS(coords, timesS, sogKts, cursorS);

  return (
    <div className="routing-time-cursor">
      <label className="routing-time-cursor-label">
        <span>Time cursor</span>
        <input
          type="range"
          min={0}
          max={Math.round(etaS)}
          step={step}
          value={cursorS}
          aria-label="Time cursor"
          onChange={event => setCursorS(Number(event.target.value))}
        />
      </label>
      {cursor && (
        <p className="routing-time-cursor-readout">
          {`T+ ${formatElapsedHours(cursorS)} · ${formatClock(Date.now() / 1000 + cursorS)}`
            + (cursor.headingDeg !== null ? ` · ${cursor.headingDeg.toFixed(0)}°` : '')
            + (cursor.sogKts !== null ? ` · ${cursor.sogKts.toFixed(1)} kt` : '')}
        </p>
      )}
    </div>
  );
};

export default RouteTimeCursor;
