import { useCallback, useEffect, useRef, useState } from 'react';
import { useRealGPS } from './useRealGPS';
import { useGpxReplay } from './useGpxReplay';
import { useWindForecast } from './useWindForecast';
import { useNavigationBackend } from './useNavigationBackend';
import { NavigationData, Position } from '../types';

export const useNavigationData = () => {
  const { gpsData, isEnabled: isGPSEnabled, enableGPS, disableGPS, hasGPS } = useRealGPS();

  useEffect(() => {
    enableGPS();
  }, [enableGPS]);

  const replay = useGpxReplay();
  const activeSample = replay.currentSample;
  const { snapshot: backendSnapshot, status: backendStatus, postBrowserNavigation, postAISReplayPosition } = useNavigationBackend();
  const replayPositionRef = useRef<Position | null>(null);
  replayPositionRef.current = replay.isActive ? activeSample?.position ?? null : null;
  const nmeaNavigation = backendSnapshot?.nmeaConnected ? backendSnapshot.navigation : null;
  const navigationSource: 'replay' | 'nmea' | 'browser' | 'none' = replay.isActive
    ? 'replay'
    : nmeaNavigation
      ? 'nmea'
      : gpsData.status.isConnected
        ? 'browser'
        : 'none';

  useEffect(() => {
    if (!gpsData.position || !gpsData.status.lastUpdate || replay.isActive) return;
    void postBrowserNavigation({
      position: gpsData.position,
      speed: gpsData.speed,
      compass: gpsData.compass,
      gpsTime: gpsData.gpsTime,
      gpsAccuracy: gpsData.status.accuracy,
      receivedAt: gpsData.status.lastUpdate
    });
  }, [gpsData, postBrowserNavigation, replay.isActive]);

  useEffect(() => {
    if (!replay.isActive) return;

    const sendReplayPosition = () => {
      const position = replayPositionRef.current;
      if (position) void postAISReplayPosition(position);
    };
    sendReplayPosition();
    const interval = window.setInterval(sendReplayPosition, 1000);

    return () => {
      window.clearInterval(interval);
      void postAISReplayPosition(null);
    };
  }, [replay.isActive, postAISReplayPosition]);

  const backendNavigation = backendSnapshot?.source !== 'none' ? backendSnapshot?.navigation : null;
  const livePosition = nmeaNavigation?.position ?? backendNavigation?.position ?? gpsData.position;
  const position = activeSample?.position ?? livePosition;
  const { wind, windGrid, status: windForecastStatus, requestWindGrid } = useWindForecast(position);
  const liveSpeed = activeSample?.speed ?? nmeaNavigation?.speed ?? backendNavigation?.speed ?? gpsData.speed;
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
    compass: activeSample?.compass ?? nmeaNavigation?.compass ?? backendNavigation?.compass ?? gpsData.compass,
    depth: nmeaNavigation?.depth ?? backendNavigation?.depth ?? null,
    gpsTime: activeSample?.gpsTime ?? nmeaNavigation?.gpsTime ?? backendNavigation?.gpsTime ?? gpsData.gpsTime,
    gpsAccuracy: activeSample?.accuracy ?? nmeaNavigation?.gpsAccuracy ?? backendNavigation?.gpsAccuracy ?? gpsData.status.accuracy
  };

  const { start: startReplay, stop: stopReplay } = replay;

  const startGpxReplay = useCallback(async () => {
    disableGPS();
    const started = await startReplay();
    if (!started) enableGPS();
    return started;
  }, [disableGPS, enableGPS, startReplay]);

  const stopGpxReplay = useCallback(() => {
    stopReplay();
    enableGPS();
  }, [enableGPS, stopReplay]);

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
    resetMaxSpeed,
    isConnected: replay.isActive || Boolean(nmeaNavigation) || gpsData.status.isConnected,
    isGPSEnabled: replay.isActive || isGPSEnabled,
    navigationSource,
    backendStatus,
    aisState: backendSnapshot?.ais ?? null,
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
