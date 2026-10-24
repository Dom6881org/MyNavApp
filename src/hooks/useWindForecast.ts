import { useCallback, useEffect, useRef, useState } from 'react';
import { Position, WindData, WindForecastPoint, WindForecastStatus } from '../types';

const emptyStatus: WindForecastStatus = {
  isLoading: false,
  error: null,
  updatedAt: null,
  gridError: null
};

const CACHE_TTL_MS = 20 * 60 * 1000;
const MAX_CACHE_ENTRIES = 2000;
const CHUNK_SIZE = 50;
const CHUNK_INTERVAL_MS = 300;
const ERROR_RETRY_MS = 30 * 1000;
const FORECAST_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1000;
const MAX_RATE_LIMIT_BACKOFF_MS = 60 * 60 * 1000;

interface CachedWind {
  wind: WindData;
  fetchedAt: number;
}

interface GridRequest {
  visible: Position[];
  prefetch: Position[];
}

const pointKey = (point: Position) => `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;
const normalizeLongitude = (longitude: number) => ((((longitude + 180) % 360) + 360) % 360) - 180;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readWindData = (payload: unknown): WindData => {
  if (!isRecord(payload) || !isRecord(payload.current)) {
    throw new Error('Invalid weather response.');
  }

  const current = payload.current;
  const { wind_speed_10m: speed, wind_direction_10m: direction, wind_gusts_10m: gust } = current;
  if (
    typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0 ||
    typeof direction !== 'number' || !Number.isFinite(direction) ||
    typeof gust !== 'number' || !Number.isFinite(gust) || gust < 0
  ) {
    throw new Error('Wind forecast data is incomplete.');
  }

  return {
    speed,
    direction: (direction + 360) % 360,
    gust,
    source: 'Open-Meteo'
  };
};

export const useWindForecast = (position: Position | null) => {
  const latitude = position ? Number(position.latitude.toFixed(2)) : null;
  const longitude = position ? Number(position.longitude.toFixed(2)) : null;
  const [wind, setWind] = useState<WindData | null>(null);
  const [windGrid, setWindGrid] = useState<WindForecastPoint[]>([]);
  const [status, setStatus] = useState<WindForecastStatus>(emptyStatus);
  const gridControllerRef = useRef<AbortController | null>(null);
  const gridRetryTimeoutRef = useRef<number | null>(null);
  const gridRetryAtRef = useRef(0);
  const gridRunningRef = useRef(false);
  const windCacheRef = useRef(new Map<string, CachedWind>());
  const latestGridRequestRef = useRef<GridRequest | null>(null);
  const rateLimitRetryAtRef = useRef(0);
  const rateLimitCountRef = useRef(0);
  const currentCoordinatesRef = useRef({ latitude, longitude });
  currentCoordinatesRef.current = { latitude, longitude };
  const hasPosition = latitude !== null && longitude !== null;

  const getResponseError = useCallback((response: Response) => {
    if (response.status !== 429) {
      return new Error(`Weather service returned status ${response.status}.`);
    }

    const now = Date.now();
    if (rateLimitRetryAtRef.current <= now) {
      rateLimitCountRef.current += 1;
      const backoff = Math.min(
        RATE_LIMIT_BACKOFF_MS * 2 ** (rateLimitCountRef.current - 1),
        MAX_RATE_LIMIT_BACKOFF_MS
      );
      const retryAfter = response.headers.get('Retry-After');
      const retryAfterDate = retryAfter && Number.isNaN(Number(retryAfter))
        ? Date.parse(retryAfter)
        : Number(retryAfter) * 1000 + now;
      const serverDelay = retryAfter
        ? Math.max(0, retryAfterDate - now)
        : 0;
      rateLimitRetryAtRef.current = now + Math.max(backoff, serverDelay);
    }

    const retryInMinutes = Math.max(1, Math.ceil((rateLimitRetryAtRef.current - now) / 60000));
    return new Error(`Weather service rate limit reached. Retrying in about ${retryInMinutes} min.`);
  }, []);

  const publishGrid = useCallback(() => {
    const request = latestGridRequestRef.current;
    if (!request) return;
    const grid: WindForecastPoint[] = [];
    for (const point of request.visible) {
      const entry = windCacheRef.current.get(pointKey(point));
      if (entry) grid.push({ position: point, wind: entry.wind });
    }
    setWindGrid(grid);
  }, []);

  const fetchWindChunk = useCallback(async (points: Position[], signal: AbortSignal) => {
    const params = new URLSearchParams({
      latitude: points.map(point => point.latitude.toFixed(4)).join(','),
      longitude: points.map(point => normalizeLongitude(point.longitude).toFixed(4)).join(','),
      current: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      wind_speed_unit: 'kn',
      timezone: 'UTC'
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
    if (!response.ok) {
      throw getResponseError(response);
    }

    const payload: unknown = await response.json();
    const forecasts = Array.isArray(payload) ? payload : [payload];
    if (forecasts.length !== points.length) {
      throw new Error('The number of forecasts does not match the map points.');
    }

    const fetchedAt = Date.now();
    forecasts.forEach((forecast, index) => {
      windCacheRef.current.set(pointKey(points[index]), { wind: readWindData(forecast), fetchedAt });
    });
    while (windCacheRef.current.size > MAX_CACHE_ENTRIES) {
      const oldest = windCacheRef.current.keys().next().value;
      if (oldest === undefined) break;
      windCacheRef.current.delete(oldest);
    }
  }, [getResponseError]);

  const processGridQueue = useCallback(async () => {
    if (gridRunningRef.current) return;
    gridRunningRef.current = true;
    const controller = new AbortController();
    gridControllerRef.current = controller;

    try {
      while (!controller.signal.aborted) {
        const request = latestGridRequestRef.current;
        if (!request) break;

        const now = Date.now();
        const missing: Position[] = [];
        const seen = new Set<string>();
        for (const point of [...request.visible, ...request.prefetch]) {
          const key = pointKey(point);
          if (seen.has(key)) continue;
          seen.add(key);
          const entry = windCacheRef.current.get(key);
          if (!entry || now - entry.fetchedAt > CACHE_TTL_MS) missing.push(point);
        }
        if (missing.length === 0) break;

        const wait = Math.max(0, gridRetryAtRef.current - now, rateLimitRetryAtRef.current - now);
        if (wait > 0) {
          gridRetryTimeoutRef.current = window.setTimeout(() => {
            gridRetryTimeoutRef.current = null;
            void processGridQueue();
          }, wait);
          break;
        }

        try {
          await fetchWindChunk(missing.slice(0, CHUNK_SIZE), controller.signal);
          if (controller.signal.aborted) break;
          publishGrid();
          setStatus(previous => ({ ...previous, gridError: null }));
          if (Date.now() >= rateLimitRetryAtRef.current) rateLimitCountRef.current = 0;
        } catch (error) {
          if (controller.signal.aborted) break;
          gridRetryAtRef.current = Date.now() + ERROR_RETRY_MS;
          const message = error instanceof Error ? error.message : 'Erreur inconnue.';
          setStatus(previous => ({
            ...previous,
            gridError: `Map wind forecasts unavailable: ${message}`
          }));
          gridRetryTimeoutRef.current = window.setTimeout(() => {
            gridRetryTimeoutRef.current = null;
            void processGridQueue();
          }, ERROR_RETRY_MS);
          break;
        }

        await new Promise(resolve => window.setTimeout(resolve, CHUNK_INTERVAL_MS));
      }
    } finally {
      gridRunningRef.current = false;
    }
  }, [fetchWindChunk, publishGrid]);

  const requestWindGrid = useCallback((visible: Position[], prefetch: Position[] = []) => {
    latestGridRequestRef.current = { visible, prefetch };
    publishGrid();
    void processGridQueue();
  }, [processGridQueue, publishGrid]);

  useEffect(() => {
    const refreshId = window.setInterval(() => void processGridQueue(), FORECAST_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(refreshId);
  }, [processGridQueue]);

  useEffect(() => {
    if (!hasPosition) {
      setWind(null);
      setWindGrid([]);
      setStatus(emptyStatus);
      return;
    }

    const controller = new AbortController();
    const loadForecast = async () => {
      const coordinates = currentCoordinatesRef.current;
      if (coordinates.latitude === null || coordinates.longitude === null) return;
      setStatus(previous => ({ ...previous, isLoading: true, error: null }));

      try {
        const params = new URLSearchParams({
          latitude: String(coordinates.latitude),
          longitude: String(coordinates.longitude),
          current: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
          wind_speed_unit: 'kn',
          timezone: 'UTC'
        });
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
          signal: controller.signal
        });
        if (!response.ok) {
          throw getResponseError(response);
        }

        const forecast = readWindData(await response.json());
        setWind(forecast);
        setStatus(previous => ({
          ...previous,
          isLoading: false,
          error: null,
          updatedAt: Date.now()
        }));
        if (Date.now() >= rateLimitRetryAtRef.current) rateLimitCountRef.current = 0;
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Erreur inconnue.';
        setStatus(previous => ({
          ...previous,
          isLoading: false,
          error: `Weather forecast unavailable: ${message}`
        }));
      }
    };

    const initialLoadId = window.setTimeout(() => void loadForecast(), 0);
    const refreshId = window.setInterval(() => void loadForecast(), FORECAST_REFRESH_INTERVAL_MS);

    return () => {
      controller.abort();
      window.clearTimeout(initialLoadId);
      window.clearInterval(refreshId);
    };
  }, [getResponseError, hasPosition]);

  useEffect(() => () => {
    if (gridRetryTimeoutRef.current !== null) {
      window.clearTimeout(gridRetryTimeoutRef.current);
    }
    gridControllerRef.current?.abort();
  }, []);

  return { wind, windGrid, status, requestWindGrid };
};
