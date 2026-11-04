import { describe, expect, it } from 'vitest';
import { estimateRollPeriod, heelFromGravity, pitchFromGravity } from './motion';

describe('motion (capteurs tablette)', () => {
  it('gîte depuis le vecteur gravité : à plat = 0, gîte pure = atan2(x, z)', () => {
    expect(heelFromGravity(0, 0, 9.81)).toBeCloseTo(0, 5);
    expect(heelFromGravity(3, 0, 9.81)).toBeCloseTo(17.05, 1);
    expect(heelFromGravity(-3, 0, 9.81)).toBeCloseTo(-17.05, 1);
  });

  it('tangage depuis le vecteur gravité', () => {
    expect(pitchFromGravity(0, 0, 9.81)).toBeCloseTo(0, 5);
    expect(pitchFromGravity(0, 2, 9.81)).toBeCloseTo(11.5, 1);
  });

  it('période de roulis : sinusoïde de 6 s -> 6,0 s', () => {
    const samples = [];
    for (let i = 0; i <= 180; i++) {
      samples.push({ tMs: i * 100, heel: 10 * Math.sin((2 * Math.PI * i) / 60) });
    }
    expect(estimateRollPeriod(samples)).toBeCloseTo(6.0, 1);
  });

  it('période de roulis : pas assez de passages par zéro -> null', () => {
    const samples = [
      { tMs: 0, heel: 5 },
      { tMs: 100, heel: 2 },
      { tMs: 200, heel: 0 }
    ];
    expect(estimateRollPeriod(samples)).toBeNull();
  });
});
