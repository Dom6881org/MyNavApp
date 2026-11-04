import { describe, expect, it } from 'vitest';
import { isHelmEnabled, parseHelmFlag, setHelmEnabled } from './helmFlag';

describe('helmFlag', () => {
  describe('parseHelmFlag (pur)', () => {
    it('desactive par defaut (pas d URL, pas de stockage)', () => {
      expect(parseHelmFlag('', null)).toBe(false);
      expect(parseHelmFlag('', '0')).toBe(false);
    });

    it('URL ?helm=1 active', () => {
      expect(parseHelmFlag('?helm=1', null)).toBe(true);
      expect(parseHelmFlag('?foo=2&helm=1', null)).toBe(true);
      expect(parseHelmFlag('?helm=on', null)).toBe(true);
    });

    it('URL helm=0 force le desactive meme si stockage a 1', () => {
      expect(parseHelmFlag('?helm=0', '1')).toBe(false);
    });

    it('stockage localStorage = 1 active sans URL', () => {
      expect(parseHelmFlag('', '1')).toBe(true);
    });
  });

  describe('isHelmEnabled / setHelmEnabled (navigateur)', () => {
    it('active et desactive via localStorage', () => {
      window.localStorage.removeItem('mynav:helm');
      expect(isHelmEnabled()).toBe(false);
      setHelmEnabled(true);
      expect(isHelmEnabled()).toBe(true);
      setHelmEnabled(false);
      expect(isHelmEnabled()).toBe(false);
    });

    it('URL prioritaire sur le stockage (jsdom location par defaut)', () => {
      setHelmEnabled(true);
      // location.search vide dans jsdom : le stockage fait foi
      expect(isHelmEnabled()).toBe(true);
      window.localStorage.removeItem('mynav:helm');
      expect(isHelmEnabled()).toBe(false);
    });
  });
});
