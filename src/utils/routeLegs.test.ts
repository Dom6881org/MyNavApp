import { describe, expect, it } from 'vitest';

import { computeRouteLegs, haversineNm, headingDeltaDeg, initialBearingDeg } from './routeLegs';

describe('initialBearingDeg', () => {
  it('caps cardinaux exacts depuis l’équateur', () => {
    expect(initialBearingDeg(0, 0, 1, 0)).toBeCloseTo(0);
    expect(initialBearingDeg(0, 0, 0, 1)).toBeCloseTo(90);
    expect(initialBearingDeg(0, 0, -1, 0)).toBeCloseTo(180);
    expect(initialBearingDeg(0, 0, 0, -1)).toBeCloseTo(270);
  });
});

describe('headingDeltaDeg', () => {
  it('écart minimal, wrap 359°↔1° géré', () => {
    expect(headingDeltaDeg(10, 10)).toBe(0);
    expect(headingDeltaDeg(350, 5)).toBeCloseTo(15);
    expect(headingDeltaDeg(5, 350)).toBeCloseTo(15);
    expect(headingDeltaDeg(0, 180)).toBeCloseTo(180);
  });
});

describe('haversineNm', () => {
  it('un degré de latitude ≈ 60 MN', () => {
    expect(haversineNm(47, 0, 48, 0)).toBeCloseTo(60, 0);
  });
});

describe('computeRouteLegs', () => {
  it('cap constant, convention par tronçon (historique) : une seule jambe, moyenne des tronçons', () => {
    // 3 segments plein nord de ~0,6 MN chacun.
    const coords: [number, number][] = [
      [47.5, -4.5],
      [47.51, -4.5],
      [47.52, -4.5],
      [47.53, -4.5]
    ];
    const legs = computeRouteLegs(coords, [1800, 3600, 5400], [5, 4, 6]);

    expect(legs).toHaveLength(1);
    expect(legs[0].startIndex).toBe(0);
    expect(legs[0].endIndex).toBe(3);
    expect(legs[0].headingDeg).toBeCloseTo(0);
    expect(legs[0].distanceNm).toBeCloseTo(1.8, 0);
    expect(legs[0].durationS).toBe(5400);
    expect(legs[0].sogKts).toBeCloseTo(5);
  });

  it('convention moteur, une entrée par point (#123) : durée au point de fin de jambe, sogKts[0] artificiel exclu', () => {
    const coords: [number, number][] = [
      [47.5, -4.5],
      [47.51, -4.5],
      [47.52, -4.5]
    ];
    const legs = computeRouteLegs(coords, [0, 1800, 3600], [4.5, 5, 6]);

    expect(legs).toHaveLength(1);
    expect(legs[0].endIndex).toBe(2);
    expect(legs[0].durationS).toBe(3600);
    // Moyenne des points d'arrivée 1..2 : (5 + 6) / 2 = 5,5.
    expect(legs[0].sogKts).toBeCloseTo(5.5);
  });

  it('convention moteur par point, deux jambes : durées et SOG par jambe', () => {
    const coords: [number, number][] = [
      [47.5, -4.5],
      [47.51, -4.5],
      [47.51, -4.44]
    ];
    const legs = computeRouteLegs(coords, [0, 1800, 3600], [4.5, 5, 6]);

    expect(legs).toHaveLength(2);
    expect(legs[0].durationS).toBe(1800);
    expect(legs[0].sogKts).toBeCloseTo(5);
    expect(legs[1].durationS).toBe(3600);
    expect(legs[1].sogKts).toBeCloseTo(6);
  });

  it('changement de cap au-delà du seuil : deux jambes', () => {
    const coords: [number, number][] = [
      [47.5, -4.5],
      [47.51, -4.5],
      [47.51, -4.44]
    ];
    const legs = computeRouteLegs(coords);

    expect(legs).toHaveLength(2);
    expect(legs[0].endIndex).toBe(1);
    expect(legs[0].headingDeg).toBeCloseTo(0);
    expect(legs[1].startIndex).toBe(1);
    // Est à 47,51° N : cap initial 89,98° (le grand cercle n'est pas exactement 90).
    expect(legs[1].headingDeg).toBeCloseTo(90, 1);
  });

  it('écart sous le seuil : pas de nouvelle jambe', () => {
    // Nord strict, puis nord avec un très léger ouest : écart ~2° < seuil 5°.
    const coords: [number, number][] = [
      [47.5, -4.5],
      [47.51, -4.5],
      [47.52, -4.5005]
    ];
    const legs = computeRouteLegs(coords);

    expect(legs).toHaveLength(1);
    expect(legs[0].endIndex).toBe(2);
  });

  it('wrap : 350° puis 5° = écart de 15° → deux jambes (pas 345)', () => {
    const coords: [number, number][] = [
      [47.5, -4.5],
      [47.549, -4.513], // cap ≈ 350° (nord, léger ouest)
      [47.599, -4.506] // cap ≈ 5° (nord, léger est)
    ];
    const legs = computeRouteLegs(coords);

    expect(legs).toHaveLength(2);
    const delta = headingDeltaDeg(legs[0].headingDeg, legs[1].headingDeg);
    expect(delta).toBeGreaterThan(10);
    expect(delta).toBeLessThan(20);
  });

  it('sans timesS/sogKts : jambes avec caps et distances, temps et SOG à null', () => {
    const coords: [number, number][] = [
      [47.5, -4.5],
      [47.51, -4.5],
      [47.52, -4.5]
    ];
    const legs = computeRouteLegs(coords);

    expect(legs).toHaveLength(1);
    expect(legs[0].durationS).toBeNull();
    expect(legs[0].sogKts).toBeNull();
    expect(legs[0].distanceNm).toBeCloseTo(1.2, 0);
  });

  it('longueurs incohérentes de timesS/sogKts : tableaux ignorés (dégradation gracieuse)', () => {
    const coords: [number, number][] = [
      [47.5, -4.5],
      [47.51, -4.5],
      [47.52, -4.5]
    ];
    const legs = computeRouteLegs(coords, [1800], [5, 5, 5, 5]);

    expect(legs).toHaveLength(1);
    expect(legs[0].durationS).toBeNull();
    expect(legs[0].sogKts).toBeNull();
  });

  it('tracé trop court : aucune jambe', () => {
    expect(computeRouteLegs([])).toEqual([]);
    expect(computeRouteLegs([[47.5, -4.5]])).toEqual([]);
  });
});
