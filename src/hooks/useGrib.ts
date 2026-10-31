import { useCallback, useEffect, useState } from 'react';
import { GribBounds, GribStatus } from '../types';

export interface GribApi {
  status: GribStatus | null;
  isDownloading: boolean;
  error: string | null;
  download: (bounds: GribBounds, horizonH: number) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * GRIB à terre (issue #16) : état du cache local (fraîcheur, zone) et
 * téléchargement d'une zone + horizon via le backend. En navigation sans
 * réseau, le statut reste consultable et le routage retombe sur le vent
 * constant côté serveur.
 */
export const useGrib = (): GribApi => {
  const [status, setStatus] = useState<GribStatus | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/grib/status');
      const value = await response.json() as GribStatus;
      if (response.ok) {
        setStatus(value);
        setError(null);
      }
    } catch {
      // Backend hors ligne : on garde le dernier état connu.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const download = useCallback(async (bounds: GribBounds, horizonH: number) => {
    setIsDownloading(true);
    setError(null);
    try {
      const response = await fetch('/api/grib/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bounds, horizonH })
      });
      const value = await response.json() as GribStatus & { error?: string };
      if (!response.ok) {
        setError(value.error ?? 'GRIB download failed.');
        return;
      }
      setStatus(value);
    } catch {
      setError('Backend unreachable: GRIB download unavailable.');
    } finally {
      setIsDownloading(false);
    }
  }, []);

  return { status, isDownloading, error, download, refresh };
};

export default useGrib;
