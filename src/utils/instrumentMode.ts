/** Modes d'affichage des instruments (refonte instruments, Phase 2 — #160,
 * Phase 3 — #162, finalisation #166).
 *
 * Quatre panneaux : HELM (#159), COASTAL, OVERVIEW, PREP ROUTING (#162).
 * Depuis la finalisation (#166), les nouveaux rendus sont le DÉFAUT :
 * sans choix connu, l'app ouvre sur HELM. La vue historique reste
 * accessible en échappatoire via `?ui=legacy`. Rétro-compatibilité
 * Phase 1 : `?helm=1` / `localStorage mynav:helm = '1'` continuent
 * d'ouvrir le HELM. */

import type { InstrumentMode } from './instrumentPrimitives';

export type UiMode = 'helm' | 'coastal' | 'overview' | 'prep';

/** Sélection lue : un mode, ou 'legacy' pour la vue historique. */
export type UiModeSelection = UiMode | 'legacy';

const UI_MODE_KEY = 'mynav:ui-mode';
const HELM_KEY = 'mynav:helm'; // rétro-compat Phase 1
const INSTRUMENT_MODE_PREFIX = 'mynav:instrument-mode:';

const UI_MODES: UiMode[] = ['helm', 'coastal', 'overview', 'prep'];

/** Pur : décide du mode actif. Ordre : URL ?ui= (modes + legacy) >
 * mynav:ui-mode > ?helm=1 > mynav:helm (Phase 1) > null (aucune sélection
 * connue — getUiMode appliquera le défaut HELM). */
export function parseUiMode(
  search: string,
  uiStorage: string | null,
  helmStorage: string | null
): UiModeSelection | null {
  const urlUi = /[?&]ui=(helm|coastal|overview|prep|legacy)/.exec(search);
  if (urlUi) return urlUi[1] as UiModeSelection;
  if (uiStorage !== null && UI_MODES.includes(uiStorage as UiMode)) {
    return uiStorage as UiMode;
  }
  const urlHelm = /[?&]helm=(1|true|on)/.exec(search);
  if (urlHelm) return 'helm';
  if (helmStorage === '1') return 'helm';
  return null;
}

/** Pur : mode stocké par instrument (123/◉) avec fallback. */
export function parseStoredMode(
  value: string | null,
  fallback: InstrumentMode
): InstrumentMode {
  if (value === 'dial' || value === 'numeric') return value;
  return fallback;
}

/** Clé de persistance du mode d'un instrument (titre normalisé). */
export function instrumentModeKey(title: string): string {
  return INSTRUMENT_MODE_PREFIX + title.toLowerCase();
}

/** Lecture navigateur du mode UI actif (null = legacy explicite ; défaut HELM). */
export function getUiMode(): UiMode | null {
  if (typeof window === 'undefined') return null;
  let ui: string | null = null;
  let helm: string | null = null;
  try {
    ui = window.localStorage.getItem(UI_MODE_KEY);
    helm = window.localStorage.getItem(HELM_KEY);
  } catch {
    // stockage indisponible : null, l'URL reste disponible
  }
  const selection = parseUiMode(window.location.search, ui, helm);
  // Finalisation (#166) : HELM par défaut, la vue legacy reste une
  // échappatoire explicite (?ui=legacy).
  if (selection === 'legacy') return null;
  return selection ?? 'helm';
}

/** Persiste le mode UI (null = efface la sélection ; défaut HELM au prochain getUiMode). */
export function setUiMode(mode: UiMode | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (mode === null) {
      window.localStorage.removeItem(UI_MODE_KEY);
    } else {
      window.localStorage.setItem(UI_MODE_KEY, mode);
    }
  } catch {
    // stockage indisponible : l'URL reste disponible
  }
}

/** Lit le mode (cadran/numérique) persisté d'un instrument. */
export function readInstrumentMode(
  title: string,
  fallback: InstrumentMode
): InstrumentMode {
  if (typeof window === 'undefined') return fallback;
  try {
    return parseStoredMode(
      window.localStorage.getItem(instrumentModeKey(title)),
      fallback
    );
  } catch {
    return fallback;
  }
}

/** Persiste le mode d'un instrument. */
export function writeInstrumentMode(title: string, mode: InstrumentMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(instrumentModeKey(title), mode);
  } catch {
    // stockage indisponible : sans conséquence
  }
}
