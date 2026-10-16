import { useState, useEffect, useCallback } from 'react';
import { NavigationData, Position, SpeedData, WindData, CompassData, DepthData, GPSTime } from '../types';

const generateRandomPosition = (): Position => {
  // Génère une position autour de la Bretagne (pour l'exemple)
  const baseLat = 48.3858;
  const baseLon = -4.4937;
  
  return {
    latitude: baseLat + (Math.random() * 0.01 - 0.005),
    longitude: baseLon + (Math.random() * 0.02 - 0.01)
  };
};

const generateRandomSpeed = (): SpeedData => {
  const speed = 5 + Math.random() * 15; // 5-20 nœuds
  return {
    speed: parseFloat(speed.toFixed(1)),
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
  return {
    heading,
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
    utcTime: now.toUTCString(),
    localTime: now.toLocaleTimeString('fr-FR'),
    date: now.toLocaleDateString('fr-FR')
  };
};

const generateRandomNavigationData = (): NavigationData => {
  return {
    position: generateRandomPosition(),
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
  const [navigationData, setNavigationData] = useState<NavigationData>(generateRandomNavigationData());
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const updateData = useCallback(() => {
    setNavigationData(prev => {
      const newData = generateRandomNavigationData();
      // Conserver certaines valeurs pour une transition plus fluide
      return {
        ...newData,
        position: {
          latitude: prev.position.latitude + (newData.position.latitude - prev.position.latitude) * 0.3,
          longitude: prev.position.longitude + (newData.position.longitude - prev.position.longitude) * 0.3
        },
        compass: {
          ...newData.compass,
          heading: prev.compass.heading + (newData.compass.heading - prev.compass.heading) * 0.1
        }
      };
    });
  }, []);

  const toggleConnection = useCallback(() => {
    setIsConnected(prev => !prev);
  }, []);

  const resetData = useCallback(() => {
    setNavigationData(generateRandomNavigationData());
    setError(null);
  }, []);

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
    error,
    toggleConnection,
    resetData,
    updateData
  };
};

export default useNavigationData;
