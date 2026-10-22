import { useCallback, useEffect, useRef, useState } from 'react';
import { Position, WindData, WindForecastPoint, WindForecastStatus } from '../types';

const emptyStatus: WindForecastStatus = {
  isLoading: false,
  error: null,
  updatedAt: null,
  gridError: null
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readWindData = (payload: unknown): WindData => {
  if (!isRecord(payload) || !isRecord(payload.current)) {
    throw new Error('Réponse météo invalide.');
  }

  const current = payload.current;
  const { wind_speed_10m: speed, wind_direction_10m: direction, wind_gusts_10m: gust } = current;
  if (
    typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0 ||
    typeof direction !== 'number' || !Number.isFinite(direction) ||
    typeof gust !== 'number' || !Number.isFinite(gust) || gust < 0
  ) {
    throw new Error('Les données de vent reçues sont incomplètes.');
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

  const requestWindGrid = useCallback(async (points: Position[]) => {
    gridControllerRef.current?.abort();
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
        throw new Error(`Le service météo a répondu avec le statut ${response.status}.`);
      }

      const payload: unknown = await response.json();
      const forecasts = Array.isArray(payload) ? payload : [payload];
      if (forecasts.length !== points.length) {
        throw new Error('Le nombre de prévisions reçues ne correspond pas aux points de la carte.');
      }

      const grid = forecasts.map((forecast, index) => ({
        position: points[index],
        wind: readWindData(forecast)
      }));
      setWindGrid(grid);
      setStatus(previous => ({ ...previous, gridError: null }));
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'Erreur inconnue.';
      setStatus(previous => ({
        ...previous,
        gridError: `Prévisions de la carte indisponibles : ${message}`
      }));
    }
  }, []);

  useEffect(() => {
    if (latitude === null || longitude === null) {
      setWind(null);
      setWindGrid([]);
      setStatus(emptyStatus);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      wind_speed_unit: 'kn',
      timezone: 'UTC'
    });

    const loadForecast = async () => {
      setStatus(previous => ({ ...previous, isLoading: true, error: null }));

      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(`Le service météo a répondu avec le statut ${response.status}.`);
        }

        const forecast = readWindData(await response.json());
        setWind(forecast);
        setStatus(previous => ({
          ...previous,
          isLoading: false,
          error: null,
          updatedAt: Date.now()
        }));
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Erreur inconnue.';
        setStatus(previous => ({
          ...previous,
          isLoading: false,
          error: `Prévision météo indisponible : ${message}`
        }));
      }
    };

    void loadForecast();
    const refreshId = window.setInterval(() => void loadForecast(), 15 * 60 * 1000);

    return () => {
      controller.abort();
      window.clearInterval(refreshId);
    };
  }, [latitude, longitude]);

  useEffect(() => () => gridControllerRef.current?.abort(), []);

  return { wind, windGrid, status, requestWindGrid };
};
