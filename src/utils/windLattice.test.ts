import { describe, expect, it } from 'vitest';
import {
  barbPositionKey,
  buildWindLattice,
  diffBarbKeys,
  getEffectiveWindZoom,
  windPointKey
} from './windLattice';

const makeBounds = (lat: number, lng: number, zoom: number) => {
  // ~1000x700 px viewport at 256*2^zoom px per 360°
  const degPerPx = 360 / (256 * 2 ** zoom);
  const halfLat = 350 * degPerPx;
  const halfLng = 500 * degPerPx;
  return {
    getSouth: () => lat - halfLat,
    getNorth: () => lat + halfLat,
    getWest: () => lng - halfLng,
    getEast: () => lng + halfLng
  };
};

describe('windPointKey', () => {
  it('quantizes to 2 decimals', () => {
    expect(windPointKey({ latitude: 43.12345, longitude: 5.98765 })).toBe('43.12,5.99');
  });

  it('merges points closer than the cache granularity', () => {
    expect(windPointKey({ latitude: 43.1201, longitude: 5.9801 }))
      .toBe(windPointKey({ latitude: 43.1249, longitude: 5.9849 }));
  });
});

describe('getEffectiveWindZoom', () => {
  it('buckets zoom by steps of 2 and clamps', () => {
    expect([4, 5, 6, 7].map(getEffectiveWindZoom)).toEqual([4, 4, 6, 6]);
    expect(getEffectiveWindZoom(-3)).toBe(0);
    expect(getEffectiveWindZoom(40)).toBe(18);
  });
});

describe('lattice z4→z16', () => {
  it('keeps the number of distinct cache keys bounded', () => {
    const keys = new Set<string>();
    for (let zoom = 4; zoom <= 16; zoom++) {
      const lattice = buildWindLattice(makeBounds(43.1, 5.9, zoom), zoom);
      expect(lattice.length).toBeLessThan(400);
      lattice.forEach(point => keys.add(windPointKey(point)));
    }
    expect(keys.size).toBeLessThan(1500);
  });

  it('collapses the number of cache keys at high zoom vs 5-decimal keys', () => {
    const lattice = buildWindLattice(makeBounds(43.1, 5.9, 16), 16);
    const precise = new Set(lattice.map(p => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`));
    const quantized = new Set(lattice.map(windPointKey));
    expect(quantized.size).toBeLessThan(precise.size);
  });
});

describe('barb churn on zoom change', () => {
  const keysAt = (zoom: number) => buildWindLattice(makeBounds(43.1, 5.9, 8), zoom)
    .map(point => barbPositionKey({ position: point }));

  it('reuses all barbs for a ±1 zoom within the same bucket', () => {
    expect(diffBarbKeys(keysAt(8), keysAt(9))).toEqual({ added: 0, removed: 0 });
    expect(diffBarbKeys(keysAt(9), keysAt(8))).toEqual({ added: 0, removed: 0 });
  });

  it('only renews barbs when crossing a bucket boundary', () => {
    const { added, removed } = diffBarbKeys(keysAt(9), keysAt(10));
    expect(added + removed).toBeGreaterThan(0);
  });
});
