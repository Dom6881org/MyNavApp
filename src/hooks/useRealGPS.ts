import { useState, useEffect, useCallback, useRef } from 'react';
import { CompassData, GPSTime, Position, SpeedData } from '../types';

interface GPSStatus {
  isConnected: boolean;
  error: string | null;
  accuracy: number | null;
  lastUpdate: number | null;
}

interface RealGPSData {
  position: Position | null;
  speed: SpeedData | null;
  compass: CompassData | null;
  gpsTime: GPSTime | null;
  status: GPSStatus;
}

const emptyGPSData: RealGPSData = {
  position: null,
  speed: null,
  compass: null,
  gpsTime: null,
  status: {
    isConnected: false,
    error: null,
    accuracy: null,
    lastUpdate: null
  }
};

const toRadians = (degrees: number) => degrees * Math.PI / 180;

export const useRealGPS = () => {
  const [gpsData, setGpsData] = useState<RealGPSData>(emptyGPSData);
  const [isEnabled, setIsEnabled] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<GeolocationPosition | null>(null);
  const speedHistoryRef = useRef<number[]>([]);

  const handleSuccess = useCallback((position: GeolocationPosition) => {
    const previous = lastPositionRef.current;
    const { latitude, longitude, speed: deviceSpeed, heading, accuracy } = position.coords;
    let cog: number | null = null;
    let calculatedSpeed: number | null = null;

    if (previous) {
      const lat1 = toRadians(previous.coords.latitude);
      const lat2 = toRadians(latitude);
      const deltaLat = lat2 - lat1;
      const deltaLon = toRadians(longitude - previous.coords.longitude);
      const haversine = Math.sin(deltaLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
      const distanceMeters = 2 * 6_371_000 * Math.atan2(
        Math.sqrt(haversine),
        Math.sqrt(1 - haversine)
      );
      const movementThreshold = Math.max(5, Math.hypot(previous.coords.accuracy, accuracy));

      if (distanceMeters > movementThreshold) {
        const y = Math.sin(deltaLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
          Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
        cog = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

        const elapsedHours = (position.timestamp - previous.timestamp) / 3_600_000;
        if (elapsedHours > 0) {
          calculatedSpeed = (distanceMeters - movementThreshold) / elapsedHours / 1852;
        }
      }
    }

    lastPositionRef.current = position;

    const speedFromDevice = typeof deviceSpeed === 'number' && Number.isFinite(deviceSpeed) && deviceSpeed >= 0
      ? deviceSpeed * 3600 / 1852
      : null;
    const sog = speedFromDevice ?? calculatedSpeed;
    if (sog !== null) {
      speedHistoryRef.current.push(sog);
      if (speedHistoryRef.current.length > 10) speedHistoryRef.current.shift();
    }

    const speed: SpeedData = {
      speed: speedFromDevice,
      sog,
      maxSpeed: speedHistoryRef.current.length ? Math.max(...speedHistoryRef.current) : null,
      averageSpeed: speedHistoryRef.current.length
        ? speedHistoryRef.current.reduce((total, value) => total + value, 0) / speedHistoryRef.current.length
        : null
    };
    const deviceHeading = typeof heading === 'number' && Number.isFinite(heading) ? heading : null;
    const compass: CompassData = {
      heading: deviceHeading,
      cog,
      magneticHeading: null,
      deviation: 0
    };
    const timestamp = new Date(position.timestamp);

    setGpsData({
      position: { latitude, longitude },
      speed,
      compass,
      gpsTime: {
        utcTime: timestamp.toISOString().slice(11, 19),
        localTime: timestamp.toLocaleTimeString('fr-FR'),
        date: timestamp.toLocaleDateString('fr-FR')
      },
      status: {
        isConnected: true,
        error: null,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        lastUpdate: Date.now()
      }
    });
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    if (error.code === error.PERMISSION_DENIED) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setIsEnabled(false);
    }
    setGpsData(prev => ({
      ...prev,
      status: {
        ...prev.status,
        isConnected: false,
        accuracy: null,
        error: error.message || 'La position GPS est temporairement indisponible.'
      }
    }));
  }, []);

  const enableGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsData(prev => ({
        ...prev,
        status: {
          ...prev.status,
          isConnected: false,
          error: 'La géolocalisation n’est pas prise en charge par ce navigateur.',
          accuracy: null
        }
      }));
      return;
    }

    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    speedHistoryRef.current = [];
    lastPositionRef.current = null;
    setIsEnabled(true);
    setGpsData(emptyGPSData);

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } catch (error) {
      setIsEnabled(false);
      setGpsData(prev => ({
        ...prev,
        status: {
          ...prev.status,
          isConnected: false,
          error: error instanceof Error ? error.message : 'Impossible de démarrer le GPS.',
          accuracy: null
        }
      }));
    }
  }, [handleSuccess, handleError]);

  const disableGPS = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    lastPositionRef.current = null;
    speedHistoryRef.current = [];
    setIsEnabled(false);
    setGpsData(emptyGPSData);
  }, []);

  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
  }, []);

  return {
    gpsData,
    isEnabled,
    enableGPS,
    disableGPS,
    hasGPS: typeof navigator !== 'undefined' && 'geolocation' in navigator
  };
};

export default useRealGPS;
