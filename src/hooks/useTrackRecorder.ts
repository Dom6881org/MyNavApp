import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackRecorderStatus, TrackSummary, TracksResponse } from '../types';

const fetchTracks = async (input: RequestInfo, init?: RequestInit): Promise<TracksResponse> => {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(`Local navigation backend returned status ${response.status}.`);
  }
  const value: unknown = await response.json();
  if (typeof value !== 'object' || value === null || !('recorder' in value) || !('tracks' in value)) {
    throw new Error('Local navigation backend sent an invalid tracks response.');
  }
  return value as TracksResponse;
};

/**
 * Enregistrement de traces côté backend : état de l'enregistreur,
 * liste des traces sauvegardées et actions de démarrage/arrêt/suppression.
 */
export const useTrackRecorder = () => {
  const [status, setStatus] = useState<TrackRecorderStatus | null>(null);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const lastError = useRef<string | null>(null);

  const applyResponse = useCallback((value: TracksResponse) => {
    setStatus(value.recorder);
    setTracks(value.tracks);
  }, []);

  const refresh = useCallback(async () => {
    try {
      applyResponse(await fetchTracks('/api/tracks'));
      lastError.current = null;
      setError(null);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Unable to load saved tracks.';
      if (lastError.current !== message) {
        lastError.current = message;
        setError(message);
        console.error(message, fetchError);
      }
    }
  }, [applyResponse]);

  // L'enregistrement vit dans le backend : l'état est relu au démarrage,
  // il survit donc aux rechargements du navigateur.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = useCallback(async (path: '/api/tracks/start' | '/api/tracks/stop') => {
    setIsBusy(true);
    try {
      applyResponse(await fetchTracks(path, { method: 'POST' }));
      lastError.current = null;
      setError(null);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Unable to change track recording.';
      lastError.current = message;
      setError(message);
      console.error(message, fetchError);
    } finally {
      setIsBusy(false);
    }
  }, [applyResponse]);

  const start = useCallback(() => toggle('/api/tracks/start'), [toggle]);
  const stop = useCallback(() => toggle('/api/tracks/stop'), [toggle]);

  const remove = useCallback(async (trackId: string) => {
    try {
      applyResponse(await fetchTracks(`/api/tracks/${trackId}`, { method: 'DELETE' }));
      lastError.current = null;
      setError(null);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Unable to delete the track.';
      lastError.current = message;
      setError(message);
      console.error(message, fetchError);
    }
  }, [applyResponse]);

  return { status, tracks, error, isBusy, refresh, start, stop, remove };
};

export default useTrackRecorder;
