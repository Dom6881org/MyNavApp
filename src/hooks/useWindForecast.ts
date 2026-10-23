import { useCallback, useEffect, useRef, useState } from 'react';
import { Position, WindData, WindForecastPoint, WindForecastStatus } from '../types';

const emptyStatus: WindForecastStatus = {
  isLoading: false,
  error: null,
  updatedAt: null,
  gridError: null
};

const GRID_REQUEST_INTERVAL_MS = 60 * 1000;
const FORECAST_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1000;
const MAX_RATE_LIMIT_BACKOFF_MS = 60 * 60 * 1000;

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
  const gridRequestTimeoutRef = useRef<number | null>(null);
  const pendingGridPointsRef = useRef<Position[] | null>(null);
  const lastGridRequestAtRef = useRef(0);
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

  const loadWindGrid = useCallback(async (points: Position[]) => {
    if (points.length === 0) {
      setWindGrid([]);
      return;
    }

    const controller = new AbortController();
    gridControllerRef.current = controller;
    const params = new URLSearchParams({
      latitude: points.map(point => point.latitude.toFixed(4)).join(','),
      longitude: points.map(point => point.longitude.toFixed(4)).join(','),
      current: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      wind_speed_unit: 'kn',
      timezone: 'UTC'
    });

    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
        signal: controller.signal
      });
      if (!response.ok) {
        throw getResponseError(response);
      }

      const payload: unknown = await response.json();
      const forecasts = Array.isArray(payload) ? payload : [payload];
      if (forecasts.length !== points.length) {
        throw new Error('The number of forecasts does not match the map points.');
      }

      const grid = forecasts.map((forecast, index) => ({
        position: points[index],
        wind: readWindData(forecast)
      }));
      setWindGrid(grid);
      setStatus(previous => ({ ...previous, gridError: null }));
      if (Date.now() >= rateLimitRetryAtRef.current) rateLimitCountRef.current = 0;
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'Erreur inconnue.';
      setStatus(previous => ({
        ...previous,
        gridError: `Map wind forecasts unavailable: ${message}`
      }));
    }
  }, [getResponseError]);

  const requestWindGrid = useCallback((points: Position[]) => {
    pendingGridPointsRef.current = points;
    if (gridRequestTimeoutRef.current !== null) return;

    const wait = Math.max(
      0,
      lastGridRequestAtRef.current + GRID_REQUEST_INTERVAL_MS - Date.now(),
      rateLimitRetryAtRef.current - Date.now()
    );
    gridRequestTimeoutRef.current = window.setTimeout(() => {
      gridRequestTimeoutRef.current = null;
      const latestPoints = pendingGridPointsRef.current;
      pendingGridPointsRef.current = null;
      if (!latestPoints) return;

      lastGridRequestAtRef.current = Date.now();
      void loadWindGrid(latestPoints);
    }, wait);
  }, [loadWindGrid]);

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
    if (gridRequestTimeoutRef.current !== null) {
      window.clearTimeout(gridRequestTimeoutRef.current);
    }
    gridControllerRef.current?.abort();
  }, []);

  return { wind, windGrid, status, requestWindGrid };
};
