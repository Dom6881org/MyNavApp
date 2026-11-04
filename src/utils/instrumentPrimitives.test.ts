import { describe, expect, it } from 'vitest';
import {
  describeArc,
  formatInstrumentValue,
  needlePoints,
  normalizeDeg,
  polarToXY,
  roseRotationDeg,
  tickMarks
} from './instrumentPrimitives';

describe('instrumentPrimitives', () => {
  describe('normalizeDeg', () => {
    it('normalise dans [0, 360)', () => {
      expect(normalizeDeg(0)).toBe(0);
      expect(normalizeDeg(360)).toBe(0);
      expect(normalizeDeg(720)).toBe(0);
      expect(normalizeDeg(-90)).toBe(270);
      expect(normalizeDeg(-1)).toBeCloseTo(359, 5);
    });
  });

  describe('polarToXY', () => {
    it('0 deg en haut, sens horaire', () => {
      const top = polarToXY(100, 100, 50, 0);
      expect(top.x).toBeCloseTo(100, 5);
      expect(top.y).toBeCloseTo(50, 5);
      const east = polarToXY(100, 100, 50, 90);
      expect(east.x).toBeCloseTo(150, 5);
      expect(east.y).toBeCloseTo(100, 5);
      const south = polarToXY(100, 100, 50, 180);
      expect(south.y).toBeCloseTo(150, 5);
    });

    it('wrap 360 = 0', () => {
      expect(polarToXY(0, 0, 10, 360)).toEqual(polarToXY(0, 0, 10, 0));
    });
  });

  describe('describeArc', () => {
    it('petit arc : pas de large-arc-flag', () => {
      const path = describeArc(100, 100, 50, 0, 90);
      expect(path.startsWith('M 100.00 50.00')).toBe(true);
      expect(path).toContain('A 50 50 0 0 1');
    });

    it('arc > 180 deg : large-arc-flag actif', () => {
      const path = describeArc(0, 0, 10, 0, 270);
      expect(path).toContain('A 10 10 0 1 1');
    });

    it('delta normalise : 350 -> 10 balaye 20 deg, pas -340', () => {
      const path = describeArc(0, 0, 10, 350, 10);
      expect(path).toContain('A 10 10 0 0 1');
    });

    it('arc complet nul : un seul point, pas de A', () => {
      expect(describeArc(0, 0, 10, 45, 45)).not.toContain('A ');
    });
  });

  describe('roseRotationDeg (compas COURSE-UP)', () => {
    it('cap au nord : rose immobile', () => {
      expect(roseRotationDeg(0)).toBe(0);
    });

    it('cap 90 : rose tournee de -90 (le 270 passe en haut)', () => {
      expect(roseRotationDeg(90)).toBe(270);
    });

    it('toujours dans [0, 360)', () => {
      const r = roseRotationDeg(-15);
      expect(r).toBeCloseTo(15, 5);
    });
  });

  describe('needlePoints', () => {
    it('triangle pointe en haut', () => {
      const points = needlePoints(50, 60, 40);
      expect(points).toContain('50,20');   // pointe (cy - length)
      expect(points).toContain('54,70');   // base droite (+halfWidth, +tail)
      expect(points).toContain('46,70');   // base gauche
    });
  });

  describe('formatInstrumentValue', () => {
    it('null/undefined -> --', () => {
      expect(formatInstrumentValue(null, 'kt')).toBe('--');
      expect(formatInstrumentValue(undefined)).toBe('--');
    });

    it('valeur avec unite et decimales', () => {
      expect(formatInstrumentValue(4.84, 'kt', 1)).toBe('4.8 kt');
      expect(formatInstrumentValue(12, '', 0)).toBe('12');
    });

    it('neutralise -0.0', () => {
      expect(formatInstrumentValue(-0.0, '°')).toBe('0 °');
    });
  });

  describe('tickMarks', () => {
    it('mineurs et majeurs sur 360', () => {
      const marks = tickMarks(0, 360, 30, 10);
      expect(marks).toHaveLength(36);
      expect(marks.filter((m) => m.major)).toHaveLength(12);
    });

    it('secteur partiel respecte le span normalise', () => {
      const marks = tickMarks(350, 10, 10, 5);
      expect(marks.map((m) => m.angle)).toEqual([350, 355, 0, 5]);
      expect(marks[2].major).toBe(true); // 0 est un multiple de 10
    });
  });
});
