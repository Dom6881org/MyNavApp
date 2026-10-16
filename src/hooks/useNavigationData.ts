import { useState, useEffect, useCallback, useRef } from 'react';
import { useRealGPS } from './useRealGPS';
import { NavigationData, Position, SpeedData, WindData, CompassData, DepthData, GPSTime } from '../types';

// Type for data source
type DataSource = 'simulation' | 'gps';

const generateRandomPosition = (centerLat: number, centerLon: number): Position => {
  // Génère une position autour du point central
  return {
    latitude: centerLat + (Math.random() * 0.01 - 0.005),
    longitude: centerLon + (Math.random() * 0.02 - 0.01)
  };
};

const generateRandomSpeed = (): SpeedData => {
  const speed = 5 + Math.random() * 15; // 5-20 nœuds
  return {
    speed: parseFloat(speed.toFixed(1)),
    sog: parseFloat(speed.toFixed(1)), // In simulation, SOG = speed
    maxSpeed: parseFloat((speed * 1.2).toFixed(1)),
    averageSpeed: parseFloat((speed * 0.9).toFixed(1))
  };
};

const generateRandomWind = (): WindData => {
  const direction = Math.floor(Math.random() * 360);
  const speed = 5 + Math.random() * 25; // 5-30 nœuds
  const gust = speed * (1 + Math.random() * 0.3);
  
  return {
    direction,
    speed: parseFloat(speed.toFixed(1)),
    gust: parseFloat(gust.toFixed(1))
  };
};

const generateRandomCompass = (): CompassData => {
  const heading = Math.floor(Math.random() * 360);
  // In simulation, COG is close to heading with some variation
  const cogVariation = (Math.random() * 20 - 10); // -10 to +10 degrees
  const cog = (heading + cogVariation + 360) % 360;
  
  return {
    heading,
    cog: parseFloat(cog.toFixed(0)),
    magneticHeading: (heading + 5) % 360,
    deviation: 5
  };
};

const generateRandomDepth = (): DepthData => {
  const depth = 10 + Math.random() * 40; // 10-50 mètres
  return {
    depth: parseFloat(depth.toFixed(1)),
    temperature: 12 + Math.random() * 8, // 12-20°C
    alarm: depth > 45,
    alarmDepth: 45
  };
};

const generateRandomGPSTime = (): GPSTime => {
  const now = new Date();
  return {
    utcTime: now.toUTCString().split(' GMT')[0],
    localTime: now.toLocaleTimeString('fr-FR'),
    date: now.toLocaleDateString('fr-FR')
  };
};

const generateRandomNavigationData = (centerLat: number = 48.3858, centerLon: number = -4.4937): NavigationData => {
  return {
    position: generateRandomPosition(centerLat, centerLon),
    speed: generateRandomSpeed(),
    wind: generateRandomWind(),
    compass: generateRandomCompass(),
    depth: generateRandomDepth(),
    gpsTime: generateRandomGPSTime(),
    batteryVoltage: 12 + Math.random() * 1.5,
    signalStrength: Math.floor(70 + Math.random() * 30)
  };
};

export const useNavigationData = (updateInterval: number = 1000) => {
  // Use real GPS hook
  const { gpsData, isEnabled: isGPSEnabled, enableGPS, disableGPS, hasGPS } = useRealGPS(updateInterval);
  
  const [navigationData, setNavigationData] = useState<NavigationData>(generateRandomNavigationData());
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('simulation');

  // Center position for simulation (Bretagne)
  const centerPosition = useRef<Position>({ latitude: 48.3858, longitude: -4.4937 });

  const updateData = useCallback(() => {
    setNavigationData(prev => {
      // If using GPS, merge with simulated data for non-GPS fields
      if (dataSource === 'gps' && gpsData.position) {
        return {
          ...prev,
          position: gpsData.position,
          speed: {
            ...prev.speed,
            speed: gpsData.speed?.speed || prev.speed.speed,
            sog: gpsData.speed?.sog || prev.speed.speed,
            maxSpeed: gpsData.speed?.maxSpeed || prev.speed.maxSpeed
          },
          compass: {
            ...prev.compass,
            heading: gpsData.compass?.heading || prev.compass.heading,
            cog: gpsData.compass?.cog || prev.compass.heading,
            magneticHeading: gpsData.compass?.magneticHeading || prev.compass.magneticHeading
          },
          gpsTime: generateRandomGPSTime(),
          batteryVoltage: 12 + Math.random() * 1.5,
          signalStrength: gpsData.status.accuracy ? Math.min(100, Math.max(0, 100 - (gpsData.status.accuracy / 10))) : 100
        };
      }
      
      // Simulation mode - smooth transitions
      const newData = generateRandomNavigationData(centerPosition.current.latitude, centerPosition.current.longitude);
      return {
        ...newData,
        position: {
          latitude: prev.position.latitude + (newData.position.latitude - prev.position.latitude) * 0.3,
          longitude: prev.position.longitude + (newData.position.longitude - prev.position.longitude) * 0.3
        },
        compass: {
          ...newData.compass,
          heading: prev.compass.heading + (newData.compass.heading - prev.compass.heading) * 0.1,
          cog: prev.compass.cog + (newData.compass.cog - prev.compass.cog) * 0.1
        }
      };
    });
  }, [dataSource, gpsData]);

  // Toggle between simulation and GPS
  const toggleGPSConnection = useCallback(() => {
    if (dataSource === 'simulation') {
      if (!hasGPS) {
        setError('GPS non supporté par ce navigateur');
        return;
      }
      enableGPS();
      setDataSource('gps');
    } else {
      disableGPS();
      setDataSource('simulation');
      // Reset to center position
      setNavigationData(prev => ({
        ...prev,
        position: generateRandomPosition(centerPosition.current.latitude, centerPosition.current.longitude)
      }));
    }
  }, [dataSource, hasGPS, enableGPS, disableGPS]);

  const toggleConnection = useCallback(() => {
    setIsConnected(prev => !prev);
    if (isConnected) {
      // If disconnecting, also disable GPS
      if (dataSource === 'gps') {
        disableGPS();
        setDataSource('simulation');
      }
    }
  }, [isConnected, dataSource, disableGPS]);

  const resetData = useCallback(() => {
    setNavigationData(generateRandomNavigationData(centerPosition.current.latitude, centerPosition.current.longitude));
    setError(null);
  }, []);

  // Watch for GPS data changes and update navigation data
  useEffect(() => {
    if (dataSource === 'gps' && gpsData.position) {
      updateData();
    }
  }, [gpsData, dataSource, updateData]);

  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      try {
        updateData();
      } catch (err) {
        setError('Erreur de mise à jour des données');
        console.error(err);
      }
    }, updateInterval);

    return () => clearInterval(interval);
  }, [isConnected, updateInterval, updateData]);

  return {
    navigationData,
    isConnected,
    isGPSEnabled,
    dataSource,
    gpsStatus: gpsData.status,
    error,
    hasGPS,
    toggleConnection,
    toggleGPSConnection,
    resetData,
    updateData
  };
};

export default useNavigationData;
