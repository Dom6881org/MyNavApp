import { useCallback, useEffect, useRef, useState } from 'react';
import { CompassData, GPSTime, Position, SpeedData } from '../types';

interface GpxReplayPoint {
  timestamp: string;
  position: Position;
  horizontalAccuracyMeters: number | null;
  navionicsSpeedRaw: number | null;
  sogKnots: number | null;
  calculatedSogKnots: number | null;
  cogDegrees: number | null;
}

interface GpxReplayFile {
  points: GpxReplayPoint[];
}

export interface GpxReplaySample {
  position: Position;
  speed: SpeedData;
  compass: CompassData;
  gpsTime: GPSTime;
  accuracy: number | null;
}

const isReplayFile = (value: unknown): value is GpxReplayFile => {
  if (typeof value !== 'object' || value === null || !('points' in value) || !Array.isArray(value.points)) {
    return false;
  }

  return value.points.every(point =>
    typeof point === 'object' &&
    point !== null &&
    'timestamp' in point && typeof point.timestamp === 'string' &&
    'position' in point && typeof point.position === 'object' && point.position !== null &&
    'latitude' in point.position && typeof point.position.latitude === 'number' &&
    'longitude' in point.position && typeof point.position.longitude === 'number' &&
    'navionicsSpeedRaw' in point && (point.navionicsSpeedRaw === null || typeof point.navionicsSpeedRaw === 'number') &&
    'sogKnots' in point && (point.sogKnots === null || typeof point.sogKnots === 'number') &&
    'calculatedSogKnots' in point && (point.calculatedSogKnots === null || typeof point.calculatedSogKnots === 'number') &&
    'cogDegrees' in point && (point.cogDegrees === null || typeof point.cogDegrees === 'number')
  );
};

const getReplaySample = (point: GpxReplayPoint): GpxReplaySample => {
  const timestamp = new Date(point.timestamp);
  const sog = point.sogKnots ?? point.calculatedSogKnots;

  return {
    position: point.position,
    speed: {
      speed: null,
      sog,
      stw: null,
      maxSpeed: sog,
      averageSpeed: sog
    },
    compass: {
      heading: null,
      cog: point.cogDegrees,
      magneticHeading: null,
      deviation: 0
    },
    gpsTime: {
      utcTime: timestamp.toISOString().slice(11, 19),
      localTime: timestamp.toLocaleTimeString('en-GB'),
      date: timestamp.toLocaleDateString('en-GB')
    },
    accuracy: point.horizontalAccuracyMeters
  };
};

export const useGpxReplay = () => {
  const [points, setPoints] = useState<GpxReplayPoint[]>([]);
  const [trackPositions, setTrackPositions] = useState<Position[]>([]);
  const [index, setIndex] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  const isActive = points.length > 0;
  const isPlaying = isActive && index < points.length - 1;
  const currentPoint = isActive ? points[index] : null;

  const start = useCallback(async () => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/__test-data/navionics-track.json', { signal: controller.signal });
      if (!response.ok) {
        throw new Error(response.status === 404
          ? 'Local fixture not found. Generate test-data/navionics-track.json first.'
          : `Replay fixture request failed (${response.status}).`);
      }

      const payload: unknown = await response.json();
      if (!isReplayFile(payload) || payload.points.length < 2) {
        throw new Error('Replay fixture has an invalid or incomplete format.');
      }

      setPoints(payload.points);
      setTrackPositions(payload.points.map(point => point.position));
      setIndex(0);
      setSpeedMultiplier(60);
      return true;
    } catch (cause) {
      if (controller.signal.aborted) return false;
      setError(cause instanceof Error ? cause.message : 'Unable to load the replay fixture.');
      return false;
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, []);

  const stop = useCallback(() => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setPoints([]);
    setTrackPositions([]);
    setIndex(0);
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isPlaying || points.length === 0) return;

    let nextIndex = index;
    const trackStart = Date.parse(points[index].timestamp);
    const wallClockStart = performance.now();
    const interval = window.setInterval(() => {
      const targetTimestamp = trackStart + (performance.now() - wallClockStart) * speedMultiplier;
      while (nextIndex < points.length - 1 && Date.parse(points[nextIndex + 1].timestamp) <= targetTimestamp) {
        nextIndex += 1;
      }
      setIndex(nextIndex);
    }, Math.max(50, Math.floor(1000 / speedMultiplier)));

    return () => window.clearInterval(interval);
  }, [index, isPlaying, points, speedMultiplier]);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  return {
    isActive,
    isPlaying,
    isLoading,
    error,
    trackPositions,
    trackIndex: index,
    progress: points.length > 0 ? index / (points.length - 1) : 0,
    speedMultiplier,
    currentSample: currentPoint ? getReplaySample(currentPoint) : null,
    start,
    stop,
    setSpeedMultiplier
  };
};
