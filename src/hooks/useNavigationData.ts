import { useCallback, useEffect, useState } from 'react';
import { useRealGPS } from './useRealGPS';
import { useWindForecast } from './useWindForecast';
import { useNavigationBackend } from './useNavigationBackend';
import { NavigationData } from '../types';

export const useNavigationData = () => {
  const { gpsData, isEnabled: isGPSEnabled, enableGPS, disableGPS, hasGPS } = useRealGPS();

  useEffect(() => {
    enableGPS();
  }, [enableGPS]);

  const { snapshot: backendSnapshot, status: backendStatus, postBrowserNavigation } = useNavigationBackend();
  const nmeaNavigation = backendSnapshot?.nmeaConnected ? backendSnapshot.navigation : null;
  const navigationSource: 'nmea' | 'browser' | 'none' = nmeaNavigation
    ? 'nmea'
    : gpsData.status.isConnected
      ? 'browser'
      : 'none';

  useEffect(() => {
    if (!gpsData.position || !gpsData.status.lastUpdate) return;
    void postBrowserNavigation({
      position: gpsData.position,
      speed: gpsData.speed,
      compass: gpsData.compass,
      gpsTime: gpsData.gpsTime,
      gpsAccuracy: gpsData.status.accuracy,
      receivedAt: gpsData.status.lastUpdate
    });
  }, [gpsData, postBrowserNavigation]);

  const backendNavigation = backendSnapshot?.source !== 'none' ? backendSnapshot?.navigation : null;
  const position = nmeaNavigation?.position ?? backendNavigation?.position ?? gpsData.position;
  const { wind, windGrid, status: windForecastStatus, requestWindGrid } = useWindForecast(position);
  const liveSpeed = nmeaNavigation?.speed ?? backendNavigation?.speed ?? gpsData.speed;
  const currentSog = liveSpeed?.sog ?? liveSpeed?.speed ?? null;
  const [sessionMaxSpeed, setSessionMaxSpeed] = useState<number | null>(null);

  useEffect(() => {
    if (currentSog === null) return;
    setSessionMaxSpeed(prev => prev === null || currentSog > prev ? currentSog : prev);
  }, [currentSog]);

  const resetMaxSpeed = useCallback(() => {
    setSessionMaxSpeed(null);
  }, []);

  const navigationData: NavigationData = {
    position,
    speed: liveSpeed ? { ...liveSpeed, maxSpeed: sessionMaxSpeed } : null,
    wind,
    apparentWind: nmeaNavigation?.apparentWind ?? backendNavigation?.apparentWind ?? null,
    trueWind: nmeaNavigation?.trueWind ?? backendNavigation?.trueWind ?? null,
    windGrid,
    windForecastStatus,
    compass: nmeaNavigation?.compass ?? backendNavigation?.compass ?? gpsData.compass,
    depth: nmeaNavigation?.depth ?? backendNavigation?.depth ?? null,
    gpsTime: nmeaNavigation?.gpsTime ?? backendNavigation?.gpsTime ?? gpsData.gpsTime,
    gpsAccuracy: nmeaNavigation?.gpsAccuracy ?? backendNavigation?.gpsAccuracy ?? gpsData.status.accuracy
  };

  const toggleGPS = useCallback(() => {
    if (isGPSEnabled && !gpsData.status.error) {
      disableGPS();
    } else {
      enableGPS();
    }
  }, [disableGPS, enableGPS, gpsData.status.error, isGPSEnabled]);

  return {
    navigationData,
    resetMaxSpeed,
    isConnected: Boolean(nmeaNavigation) || gpsData.status.isConnected,
    isGPSEnabled,
    navigationSource,
    backendStatus,
    aisState: backendSnapshot?.ais ?? null,
    gpsStatus: gpsData.status,
    hasGPS,
    requestWindGrid,
    toggleGPSConnection: toggleGPS
  };
};

export default useNavigationData;
