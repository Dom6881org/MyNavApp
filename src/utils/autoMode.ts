/** Auto-switch du mode instruments (refonte instruments, Phase 4 — #164).
 *
 * Polissage final : quand l'alarme profondeur s'active, basculer
 * automatiquement vers COASTAL pour porter la profondeur sous les yeux.
 * Opt-in persisté (`mynav:ui-auto`, désactivé par défaut). Jamais de
 * ping-pong : la bascule ne va que vers COASTAL, rien ne revient en
 * arrière quand l'alarme disparaît — le skipper reprend la main. */

import type { UiMode } from './instrumentMode';

const AUTO_KEY = 'mynav:ui-auto';

/** Pur : mode imposé par les conditions, null = garder le mode courant.
 * Bascule uniquement vers COASTAL, seulement à l'activation d'alarme. */
export function decideAutoMode(
  current: UiMode,
  depthAlarm: boolean,
  autoEnabled: boolean
): UiMode | null {
  if (!autoEnabled || !depthAlarm) return null;
  if (current === 'coastal') return null;
  return 'coastal';
}

/** Lecture navigateur du opt-in auto-switch (désactivé par défaut). */
export function readAutoSwitch(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(AUTO_KEY) === '1';
  } catch {
    return false;
  }
}

/** Persiste le opt-in auto-switch ('1' = activé, absent = désactivé). */
export function writeAutoSwitch(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage.setItem(AUTO_KEY, '1');
    } else {
      window.localStorage.removeItem(AUTO_KEY);
    }
  } catch {
    // stockage indisponible : sans conséquence, l'état tient le temps de la session
  }
}
