import { describe, expect, it } from 'vitest';
import {
  decideAutoMode,
  readAutoSwitch,
  writeAutoSwitch
} from './autoMode';

describe('autoMode (pur)', () => {
  describe('decideAutoMode', () => {
    it('sans opt-in ou sans alarme : aucun changement (null)', () => {
      expect(decideAutoMode('helm', true, false)).toBeNull();
      expect(decideAutoMode('helm', false, true)).toBeNull();
      expect(decideAutoMode('overview', false, false)).toBeNull();
    });

    it('alarme active + opt-in : bascule vers coastal', () => {
      expect(decideAutoMode('helm', true, true)).toBe('coastal');
      expect(decideAutoMode('overview', true, true)).toBe('coastal');
      expect(decideAutoMode('prep', true, true)).toBe('coastal');
    });

    it('deja en coastal : null (pas de re-render inutile)', () => {
      expect(decideAutoMode('coastal', true, true)).toBeNull();
    });
  });
});

describe('autoMode (navigateur)', () => {
  it('readAutoSwitch desactive par defaut, writeAutoSwitch persiste', () => {
    window.localStorage.clear();
    expect(readAutoSwitch()).toBe(false);
    writeAutoSwitch(true);
    expect(window.localStorage.getItem('mynav:ui-auto')).toBe('1');
    expect(readAutoSwitch()).toBe(true);
    writeAutoSwitch(false);
    expect(window.localStorage.getItem('mynav:ui-auto')).toBeNull();
    expect(readAutoSwitch()).toBe(false);
  });
});
