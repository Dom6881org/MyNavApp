import { useEffect } from 'react';
import { useRealGPS } from './useRealGPS';
import { useWindForecast } from './useWindForecast';
import { NavigationData } from '../types';

export const useNavigationData = () => {
  const { gpsData, isEnabled: isGPSEnabled, enableGPS, disableGPS, hasGPS } = useRealGPS();

  useEffect(() => {
    enableGPS();
  }, [enableGPS]);

  const { wind, windGrid, status: windForecastStatus, requestWindGrid } = useWindForecast(gpsData.position);
  const navigationData: NavigationData = {
    position: gpsData.position,
    speed: gpsData.speed,
    wind,
    windGrid,
    windForecastStatus,
    compass: gpsData.compass,
    depth: null,
    gpsTime: gpsData.gpsTime,
    gpsAccuracy: gpsData.status.accuracy
  };

  return {
    navigationData,
    isConnected: gpsData.status.isConnected,
    isGPSEnabled,
    gpsStatus: gpsData.status,
    hasGPS,
    requestWindGrid,
    toggleGPSConnection: isGPSEnabled && !gpsData.status.error ? disableGPS : enableGPS
  };
};

export default useNavigationData;
