/** Feature flag du panneau HELM (refonte instruments, Phase 1 — #158).
 *
 * Activé (dans l'ordre) :
 * 1. par l'URL : `?helm=1` (ou `helm=0` pour forcer l'ancien rendu) ;
 * 2. par localStorage : `mynav:helm` === '1'.
 *
 * Défaut : DÉSACTIVÉ — rendu actuel inchangé, zéro régression. */

const STORAGE_KEY = 'mynav:helm';

/** Pur : décide du flag depuis une query string et une valeur de stockage. */
export function parseHelmFlag(search: string, storageValue: string | null): boolean {
  const match = /[?&]helm=([^&#]*)/.exec(search);
  if (match) {
    const value = decodeURIComponent(match[1]);
    return value === '1' || value === 'true' || value === 'on';
  }
  return storageValue === '1';
}

/** Lecture navigateur du flag (garde jsdom/desktop : window peut être absent
 * dans les tests sans environnement DOM). */
export function isHelmEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null; // stockage indisponible (mode privé, etc.)
  }
  return parseHelmFlag(window.location.search, stored);
}

/** Persiste la préférence (sans recharger : l'app est relue au rendu suivant). */
export function setHelmEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // stockage indisponible : l'URL reste disponible
  }
}
