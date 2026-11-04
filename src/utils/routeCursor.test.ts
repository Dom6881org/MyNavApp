import { describe, expect, it } from 'vitest';
import { cursorAtTimeS, segmentBearingDeg } from './routeCursor';

const COORDS: [number, number][] = [
  [42.5, 3.1],
  [42.5, 3.2],
  [42.6, 3.3]
];
const TIMES = [0, 3600, 7200];
const SOG: (number | null)[] = [0, 4.0, 5.0];

describe('routeCursor', () => {
  it('cap initial : vers l est a 42.5 N = ~90 deg', () => {
    expect(segmentBearingDeg(42.5, 3.1, 42.5, 3.2)).toBeCloseTo(90, 0);
  });

  it('curseur au depart : position du point 0', () => {
    const cursor = cursorAtTimeS(COORDS, TIMES, SOG, 0);
    expect(cursor).not.toBeNull();
    expect(cursor!.latitude).toBeCloseTo(42.5, 5);
    expect(cursor!.longitude).toBeCloseTo(3.1, 5);
    expect(cursor!.headingDeg).toBeCloseTo(90, 0);
  });

  it('curseur au milieu du 1er segment : interpolation lineaire', () => {
    const cursor = cursorAtTimeS(COORDS, TIMES, SOG, 1800);
    expect(cursor!.latitude).toBeCloseTo(42.5, 5);
    expect(cursor!.longitude).toBeCloseTo(3.15, 5);
    expect(cursor!.headingDeg).toBeCloseTo(90, 0);
    expect(cursor!.sogKts).toBeCloseTo(4.0, 5);
  });

  it('curseur au dela de l ETA : clamp a l arrivee, dernier segment', () => {
    const cursor = cursorAtTimeS(COORDS, TIMES, SOG, 999999);
    expect(cursor!.latitude).toBeCloseTo(42.6, 5);
    expect(cursor!.longitude).toBeCloseTo(3.3, 5);
    expect(cursor!.sogKts).toBeCloseTo(5.0, 5);
  });

  it('curseur negatif : clamp au depart', () => {
    const cursor = cursorAtTimeS(COORDS, TIMES, SOG, -50);
    expect(cursor!.longitude).toBeCloseTo(3.1, 5);
  });

  it('route a un seul point : position sans cap ni SOG', () => {
    const cursor = cursorAtTimeS([[42.5, 3.1]], [0], undefined, 0);
    expect(cursor!.latitude).toBeCloseTo(42.5, 5);
    expect(cursor!.headingDeg).toBeNull();
    expect(cursor!.sogKts).toBeNull();
  });

  it('conventions incoherentes (lecon #123) : null sans throw', () => {
    expect(cursorAtTimeS(COORDS, [0, 3600], SOG, 0)).toBeNull();
    expect(cursorAtTimeS([], [], undefined, 0)).toBeNull();
  });
});
