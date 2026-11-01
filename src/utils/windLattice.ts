import { Position } from '../types';

export interface LatticeBounds {
  getSouth(): number;
  getNorth(): number;
  getWest(): number;
  getEast(): number;
}

/** Le pas d'affichage ne change que par paliers de 2 niveaux de zoom (#62) :
 * les barbes existantes sont réutilisées aux zooms intra-palier (pas de churn). */
export const WIND_ZOOM_BUCKET = 2;
export const getEffectiveWindZoom = (zoom: number) => {
  const clamped = Math.min(Math.max(Math.floor(zoom), 0), 18);
  return WIND_ZOOM_BUCKET * Math.floor(clamped / WIND_ZOOM_BUCKET);
};

// Constant screen density across zoom levels: this step keeps roughly 85 px
// between barbs at the equator (~62 px at Mediterranean latitudes), fixes #21.
export const getWindLatticeStep = (zoom: number) => 120 / 2 ** getEffectiveWindZoom(zoom);

/** Lattice ancré sur des coordonnées géographiques (points exacts, stables au pan). */
export const buildWindLattice = (bounds: LatticeBounds, zoom: number): Position[] => {
  const step = getWindLatticeStep(zoom);
  const south = Math.max(bounds.getSouth(), -85);
  const north = Math.min(bounds.getNorth(), 85);
  const points: Position[] = [];
  for (let lat = Math.ceil(south / step); lat <= Math.floor(north / step); lat++) {
    for (let lng = Math.ceil(bounds.getWest() / step); lng <= Math.floor(bounds.getEast() / step); lng++) {
      points.push({ latitude: lat * step, longitude: lng * step });
    }
  }
  return points;
};

/** Clé de cache granulaire (~1 km) : évite l'explosion de points inédits à fort zoom (#62). */
export const windPointKey = (point: Position) => `${point.latitude.toFixed(2)},${point.longitude.toFixed(2)}`;

export const barbPositionKey = (point: { position: Position }) =>
  `${point.position.latitude.toFixed(5)},${point.position.longitude.toFixed(5)}`;

/** Churn des barbes entre deux grilles (mêmes compteurs que [map-perf] wind-barb-sync). */
export const diffBarbKeys = (previous: Iterable<string>, next: Iterable<string>) => {
  const before = new Set(previous);
  const after = new Set(next);
  let added = 0;
  let removed = 0;
  for (const key of after) if (!before.has(key)) added += 1;
  for (const key of before) if (!after.has(key)) removed += 1;
  return { added, removed };
};
