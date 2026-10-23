import { useCallback, useEffect } from 'react';
import { useRealGPS } from './useRealGPS';
import { useGpxReplay } from './useGpxReplay';
import { useWindForecast } from './useWindForecast';
import { NavigationData } from '../types';

export const useNavigationData = () => {
  const { gpsData, isEnabled: isGPSEnabled, enableGPS, disableGPS, hasGPS } = useRealGPS();

  useEffect(() => {
    enableGPS();
  }, [enableGPS]);

  const replay = useGpxReplay();
  const activeSample = replay.currentSample;
  const position = activeSample?.position ?? gpsData.position;
  const { wind, windGrid, status: windForecastStatus, requestWindGrid } = useWindForecast(position);
  const navigationData: NavigationData = {
    position,
    speed: activeSample?.speed ?? gpsData.speed,
    wind,
    windGrid,
    windForecastStatus,
    compass: activeSample?.compass ?? gpsData.compass,
    depth: null,
    gpsTime: activeSample?.gpsTime ?? gpsData.gpsTime,
    gpsAccuracy: activeSample?.accuracy ?? gpsData.status.accuracy
  };

  const startGpxReplay = useCallback(async () => {
    disableGPS();
    const started = await replay.start();
    if (!started) enableGPS();
    return started;
  }, [disableGPS, enableGPS, replay.start]);

  const stopGpxReplay = useCallback(() => {
    replay.stop();
    enableGPS();
  }, [enableGPS, replay.stop]);

  const toggleGPS = useCallback(() => {
    if (replay.isActive) {
      stopGpxReplay();
    } else if (isGPSEnabled && !gpsData.status.error) {
      disableGPS();
    } else {
      enableGPS();
    }
  }, [disableGPS, enableGPS, gpsData.status.error, isGPSEnabled, replay.isActive, stopGpxReplay]);

  return {
    navigationData,
    isConnected: replay.isActive || gpsData.status.isConnected,
    isGPSEnabled: replay.isActive || isGPSEnabled,
    gpsStatus: replay.isActive && activeSample
      ? { isConnected: true, error: null, accuracy: activeSample.accuracy, lastUpdate: Date.now() }
      : gpsData.status,
    hasGPS,
    requestWindGrid,
    toggleGPSConnection: toggleGPS,
    gpxReplay: {
      isActive: replay.isActive,
      isPlaying: replay.isPlaying,
      isLoading: replay.isLoading,
      error: replay.error,
      trackPositions: replay.trackPositions,
      trackIndex: replay.trackIndex,
      progress: replay.progress,
      speedMultiplier: replay.speedMultiplier,
      start: startGpxReplay,
      stop: stopGpxReplay,
      setSpeedMultiplier: replay.setSpeedMultiplier
    }
  };
};

export default useNavigationData;
