import { useCallback, useState } from 'react';

/** Mouillage — v1 du reset COASTAL (#186).
 *
 * La position au moment du mouillage est persistée en localStorage :
 * un clic sur « ⚓ MOUILLAGE FAIT » (ou « NOUVEAU MOUILLAGE ») REMPLACE
 * l'ancien mouillage — pas d'historique (suivi de position au mouillage
 * : plus tard). */

export interface AnchorRecord {
  latitude: number;
  longitude: number;
  /** ISO timestamp du moment du mouillage. */
  timestamp: string;
}

const STORAGE_KEY = 'coastal-anchor';

const readAnchor = (): AnchorRecord | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AnchorRecord>;
    if (
      typeof parsed.latitude !== 'number' ||
      typeof parsed.longitude !== 'number' ||
      typeof parsed.timestamp !== 'string'
    ) {
      return null;
    }
    return parsed as AnchorRecord;
  } catch {
    return null;
  }
};

/** Format d'affichage de la barre de mouillage : « 05/11 18:42 ». */
export const formatAnchorTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '--/-- --:--';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const useAnchor = (): {
  anchor: AnchorRecord | null;
  saveAnchor: (latitude: number, longitude: number) => void;
} => {
  const [anchor, setAnchor] = useState<AnchorRecord | null>(() => readAnchor());

  const saveAnchor = useCallback((latitude: number, longitude: number) => {
    const record: AnchorRecord = {
      latitude,
      longitude,
      timestamp: new Date().toISOString()
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch {
      /* localStorage indisponible : le mouillage reste en mémoire */
    }
    setAnchor(record);
  }, []);

  return { anchor, saveAnchor };
};

export default useAnchor;
