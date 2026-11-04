import { describe, expect, it } from 'vitest';
import {
  getUiMode,
  instrumentModeKey,
  parseStoredMode,
  parseUiMode,
  readInstrumentMode,
  setUiMode,
  writeInstrumentMode
} from './instrumentMode';

describe('instrumentMode (pur)', () => {
  describe('parseUiMode', () => {
    it('aucune source : null (legacy)', () => {
      expect(parseUiMode('', null, null)).toBeNull();
      expect(parseUiMode('', '0', '0')).toBeNull();
    });

    it('URL ?ui= prioritaire', () => {
      expect(parseUiMode('?ui=coastal', 'overview', '1')).toBe('coastal');
      expect(parseUiMode('?foo=1&ui=overview', null, null)).toBe('overview');
      expect(parseUiMode('?ui=helm', null, null)).toBe('helm');
    });

    it('storage mynav:ui-mode sans URL', () => {
      expect(parseUiMode('', 'coastal', null)).toBe('coastal');
      expect(parseUiMode('', 'bogus', null)).toBeNull();
    });

    it('URL ?ui=prep (Phase 3) prioritaire', () => {
      expect(parseUiMode('?ui=prep', 'overview', null)).toBe('prep');
      expect(parseUiMode('', 'prep', null)).toBe('prep');
    });

    it('URL ?ui=legacy (finalisation #166) : selection legacy', () => {
      expect(parseUiMode('?ui=legacy', 'coastal', null)).toBe('legacy');
    });

    it('retro-compat Phase 1 : ?helm=1 puis mynav:helm', () => {
      expect(parseUiMode('?helm=1', null, null)).toBe('helm');
      expect(parseUiMode('', null, '1')).toBe('helm');
    });
  });

  describe('parseStoredMode / instrumentModeKey', () => {
    it('valeurs valides, fallback sinon', () => {
      expect(parseStoredMode('dial', 'numeric')).toBe('dial');
      expect(parseStoredMode('numeric', 'dial')).toBe('numeric');
      expect(parseStoredMode(null, 'dial')).toBe('dial');
      expect(parseStoredMode('autre', 'numeric')).toBe('numeric');
    });

    it('cle normalisee sur le titre', () => {
      expect(instrumentModeKey('COMPASS')).toBe('mynav:instrument-mode:compass');
    });
  });
});

describe('instrumentMode (navigateur)', () => {
  it('getUiMode/setUiMode : defaut HELM depuis la finalisation (#166)', () => {
    window.localStorage.clear();
    expect(getUiMode()).toBe('helm'); // defaut, plus de vue legacy par defaut
    setUiMode('coastal');
    expect(getUiMode()).toBe('coastal');
    setUiMode(null);
    expect(getUiMode()).toBe('helm'); // selection effacee -> defaut
  });

  it('?ui=legacy : echappatoire explicite vers la vue historique (#166)', () => {
    window.localStorage.clear();
    window.localStorage.setItem('mynav:ui-mode', 'coastal');
    window.history.replaceState(null, '', '/?ui=legacy');
    expect(getUiMode()).toBeNull();
    window.history.replaceState(null, '', '/');
    window.localStorage.clear();
    expect(getUiMode()).toBe('helm');
  });

  it('readInstrumentMode/writeInstrumentMode par instrument', () => {
    window.localStorage.clear();
    expect(readInstrumentMode('WIND', 'dial')).toBe('dial');
    writeInstrumentMode('WIND', 'numeric');
    expect(readInstrumentMode('WIND', 'dial')).toBe('numeric');
    // isolation par titre
    expect(readInstrumentMode('SOG', 'dial')).toBe('dial');
  });
});
