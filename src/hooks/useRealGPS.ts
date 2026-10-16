import { useState, useEffect, useCallback, useRef } from 'react';
import { Position, SpeedData, CompassData } from '../types';

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
  status: GPSStatus;
}

export const useRealGPS = (_updateInterval: number = 1000) => {
  const [gpsData, setGpsData] = useState<RealGPSData>({
    position: null,
    speed: null,
    compass: null,
    status: {
      isConnected: false,
      error: null,
      accuracy: null,
      lastUpdate: null
    }
  });

  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<GeolocationPosition | null>(null);
  const speedHistoryRef = useRef<number[]>([]);
  const lastUpdateRef = useRef<number | null>(null);

  // Calculate COG (Course Over Ground) from position changes
  const calculateCOG = useCallback((
    prevPos: GeolocationPosition | null,
    currentPos: GeolocationPosition
  ): number => {
    if (!prevPos) {
      return currentPos.coords.heading || 0;
    }

    const lat1 = prevPos.coords.latitude;
    const lon1 = prevPos.coords.longitude;
    const lat2 = currentPos.coords.latitude;
    const lon2 = currentPos.coords.longitude;

    // Calculate the bearing between two points
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    
    let bearing = Math.atan2(y, x);
    bearing = bearing * 180 / Math.PI;
    bearing = (bearing + 360) % 360; // Normalize to 0-360
    
    return bearing;
  }, []);

  // Calculate speed from position changes
  const calculateSpeed = useCallback((
    prevPos: GeolocationPosition | null,
    currentPos: GeolocationPosition
  ): SpeedData => {
    if (!prevPos || !prevPos.timestamp) {
      return {
        speed: 0,
        sog: 0,
        maxSpeed: 0,
        averageSpeed: 0
      };
    }

    const timeDiffMs = currentPos.timestamp - prevPos.timestamp;
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
    
    if (timeDiffHours <= 0) {
      return {
        speed: 0,
        sog: 0,
        maxSpeed: 0,
        averageSpeed: 0
      };
    }

    // Calculate distance in meters using Haversine formula
    const lat1 = prevPos.coords.latitude;
    const lon1 = prevPos.coords.longitude;
    const lat2 = currentPos.coords.latitude;
    const lon2 = currentPos.coords.longitude;

    const R = 6371000; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in meters

    // Speed in meters per hour, then convert to knots (1 knot = 1.852 km/h = 1852 meters/hour)
    const speedKnots = (distance / timeDiffHours) / 1852;

    // SOG (Speed Over Ground) is the speed calculated from GPS position changes
    const sog = parseFloat(speedKnots.toFixed(1));

    // Update speed history for average calculation
    speedHistoryRef.current.push(sog);
    if (speedHistoryRef.current.length > 10) {
      speedHistoryRef.current.shift();
    }

    const maxSpeed = Math.max(...speedHistoryRef.current, sog);
    const avgSpeed = speedHistoryRef.current.reduce((a, b) => a + b, 0) / speedHistoryRef.current.length;

    // For GPS mode, speed and SOG are the same (both from GPS)
    return {
      speed: parseFloat(speedKnots.toFixed(1)),
      sog: sog,
      maxSpeed: parseFloat(maxSpeed.toFixed(1)),
      averageSpeed: parseFloat(avgSpeed.toFixed(1))
    };
  }, []);

  // Success callback for geolocation
  const handleSuccess = useCallback((position: GeolocationPosition) => {
    const now = Date.now();
    
    // Calculate speed and COG if we have a previous position
    const speedData = calculateSpeed(lastPositionRef.current, position);
    const cog = calculateCOG(lastPositionRef.current, position);
    
    lastPositionRef.current = position;
    lastUpdateRef.current = now;

    // Get heading from device if available, otherwise use COG
    const deviceHeading = position.coords.heading || null;

    setGpsData(prev => ({
      ...prev,
      position: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      },
      speed: speedData,
      compass: {
        heading: deviceHeading !== null ? deviceHeading : cog,
        cog: cog,
        magneticHeading: deviceHeading !== null ? deviceHeading : cog,
        deviation: 0
      },
      status: {
        ...prev.status,
        isConnected: true,
        error: null,
        accuracy: position.coords.accuracy || null,
        lastUpdate: now
      }
    }));
  }, [calculateSpeed, calculateCOG]);

  // Error callback for geolocation
  const handleError = useCallback((error: GeolocationPositionError) => {
    setGpsData(prev => ({
      ...prev,
      status: {
        ...prev.status,
        isConnected: false,
        error: `Erreur GPS: ${error.message}`,
        accuracy: null
      }
    }));
  }, []);

  // Enable real GPS
  const enableGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsData(prev => ({
        ...prev,
        status: {
          ...prev.status,
          isConnected: false,
          error: 'GPS non supporté par ce navigateur',
          accuracy: null
        }
      }));
      return;
    }

    setIsEnabled(true);
    speedHistoryRef.current = [];
    lastPositionRef.current = null;
    lastUpdateRef.current = null;

    // Request high accuracy for marine navigation
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    // Clear any existing watch
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    // Watch position changes
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      options
    );

    // Also get immediate position
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      options
    );

    setGpsData(prev => ({
      ...prev,
      status: {
        ...prev.status,
        isConnected: false, // Will be set to true on first success
        error: null
      }
    }));
  }, [handleSuccess, handleError]);

  // Disable real GPS
  const disableGPS = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsEnabled(false);
    lastPositionRef.current = null;
    lastUpdateRef.current = null;
    speedHistoryRef.current = [];

    setGpsData({
      position: null,
      speed: null,
      compass: null,
      status: {
        isConnected: false,
        error: null,
        accuracy: null,
        lastUpdate: null
      }
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    gpsData,
    isEnabled,
    enableGPS,
    disableGPS,
    hasGPS: !!navigator.geolocation
  };
};

export default useRealGPS;
