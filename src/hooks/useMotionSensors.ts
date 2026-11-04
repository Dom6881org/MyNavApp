import { useEffect, useRef, useState } from 'react';
import { estimateRollPeriod, heelFromGravity, pitchFromGravity } from '../utils/motion';

// Capteurs de mouvement de la tablette (issue #152, phase 1).
// Firefox Android expose DeviceMotionEvent (pas de Generic Sensor API) : la
// gîte et le tangage sont dérivés du vecteur gravité, la période de roulis des
// passages par zéro de la gîte lissée.

export interface MotionSensors {
  motionAvailable: boolean;
  heel: number | null;
  pitch: number | null;
  rollPeriod: number | null;
}

const UI_INTERVAL_MS = 500;     // rafraîchissement de l'UI (~2 Hz)
const EMA_ALPHA = 0.2;           // lissage exponentiel de la gîte/tangage
const ROLL_WINDOW_MS = 12_000;   // fenêtre d'estimation de la période de roulis
const MIN_SAMPLES_FOR_PERIOD = 5;

// window.DeviceMotionEvent n'est pas typé partout : accès défensif, zéro throw.
const getDeviceMotionEvent = (): unknown =>
  typeof window === 'undefined'
    ? undefined
    : (window as Window & { DeviceMotionEvent?: unknown }).DeviceMotionEvent;

export const areMotionSensorsAvailable = (): boolean =>
  typeof getDeviceMotionEvent() === 'function';

export const useMotionSensors = (): MotionSensors => {
  const [state, setState] = useState<MotionSensors>(() => ({
    motionAvailable: areMotionSensorsAvailable(),
    heel: null,
    pitch: null,
    rollPeriod: null
  }));

  // Refs persistantes (leçon #50) : les événements capteur écrivent dans les
  // refs, seul le rendu UI est throttlé — pas d'état recréé à chaque événement.
  const latestRef = useRef<{ heel: number; pitch: number } | null>(null);
  const samplesRef = useRef<{ tMs: number; heel: number }[]>([]);
  const lastEmitRef = useRef(0);

  useEffect(() => {
    if (!areMotionSensorsAvailable()) return;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

      // Lissage exponentiel de la gîte et du tangage.
      const rawHeel = heelFromGravity(acc.x, acc.y, acc.z);
      const rawPitch = pitchFromGravity(acc.x, acc.y, acc.z);
      const previous = latestRef.current;
      const heel = previous === null
        ? rawHeel
        : previous.heel + EMA_ALPHA * (rawHeel - previous.heel);
      const pitch = previous === null
        ? rawPitch
        : previous.pitch + EMA_ALPHA * (rawPitch - previous.pitch);
      latestRef.current = { heel, pitch };

      // Fenêtre glissante de gîte pour la période de roulis.
      const now = event.timeStamp || Date.now();
      const samples = samplesRef.current;
      samples.push({ tMs: now, heel });
      const cutoff = now - ROLL_WINDOW_MS;
      while (samples.length > 0 && samples[0].tMs < cutoff) samples.shift();

      if (now - lastEmitRef.current >= UI_INTERVAL_MS) {
        lastEmitRef.current = now;
        const rollPeriod = samples.length >= MIN_SAMPLES_FOR_PERIOD
          ? estimateRollPeriod(samples)
          : null;
        setState({ motionAvailable: true, heel, pitch, rollPeriod });
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, []);

  return state;
};

export default useMotionSensors;
