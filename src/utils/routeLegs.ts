/**
 * Découpage d'une route en jambes (issue #121 — fiche route détaillée).
 *
 * Une « jambe » regroupe les tronçons consécutifs dont le cap reste quasi
 * constant (|Δcap| ≤ seuil, défaut 5°, wrap 359°↔1° géré). Un changement de
 * jambe = une manœuvre affichée. Fonctions pures : tout est dérivé des
 * données déjà remontées par le moteur (coords, timesS, sogKts), sans appel
 * réseau ni changement serveur.
 */

export interface RouteLeg {
  /** Index du premier point de la jambe dans le tracé complet. */
  startIndex: number;
  /** Index du dernier point de la jambe (segments startIndex..endIndex-1). */
  endIndex: number;
  /** Cap de la jambe (degrés vrai) — cap initial de son premier segment. */
  headingDeg: number;
  /** Longueur totale de la jambe (NM). */
  distanceNm: number;
  /** Temps cumulé depuis le départ de la route (s) — null sans timesS. */
  durationS: number | null;
  /** SOG moyen de la jambe (kt) — null sans sogKts. */
  sogKts: number | null;
}

/** Seuil par défaut : un changement de cap affiché au-delà de 5°. */
export const HEADING_LEG_THRESHOLD_DEG = 5;

/** Cap initial (grand cercle) entre deux points, en degrés vrai [0, 360). */
export const initialBearingDeg = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const rad = Math.PI / 180;
  const phi1 = lat1 * rad;
  const phi2 = lat2 * rad;
  const dLambda = (lon2 - lon1) * rad;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return (Math.atan2(y, x) / rad + 360) % 360;
};

/** Distance haversine entre deux points (MN). */
export const haversineNm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 3437.75 * Math.asin(Math.sqrt(a));
};

/** Écart de cap absolu minimal [0, 180], wrap 359°↔1° géré. */
export const headingDeltaDeg = (a: number, b: number): number => {
  const delta = Math.abs(a - b) % 360;
  return delta > 180 ? 360 - delta : delta;
};

/**
 * Regroupe les tronçons d'une route en jambes à cap quasi constant.
 * timesS (temps cumulés par tronçon) et sogKts (SOG par tronçon) sont
 * optionnels : une longueur incohérente avec le tracé est ignorée
 * (dégradation gracieuse, colonnes absentes plutôt que données fausses).
 */
export const computeRouteLegs = (
  coords: [number, number][],
  timesS?: readonly number[] | null,
  sogKts?: readonly number[] | null,
  thresholdDeg: number = HEADING_LEG_THRESHOLD_DEG
): RouteLeg[] => {
  if (!Array.isArray(coords) || coords.length < 2) return [];
  const segmentCount = coords.length - 1;
  // Rétrécis avant la fermeture pushLeg : une longueur incohérente avec le
  // tracé est ignorée (dégradation gracieuse, colonnes absentes plutôt que
  // données fausses).
  const timesArr =
    Array.isArray(timesS) && timesS.length === segmentCount ? timesS : null;
  const sogsArr =
    Array.isArray(sogKts) && sogKts.length === segmentCount ? sogKts : null;

  const headings: number[] = [];
  const distances: number[] = [];
  for (let i = 1; i < coords.length; i += 1) {
    const [lat1, lon1] = coords[i - 1];
    const [lat2, lon2] = coords[i];
    headings.push(initialBearingDeg(lat1, lon1, lat2, lon2));
    distances.push(haversineNm(lat1, lon1, lat2, lon2));
  }

  const legs: RouteLeg[] = [];
  const pushLeg = (start: number, end: number): void => {
    let distanceNm = 0;
    for (let i = start; i < end; i += 1) distanceNm += distances[i];
    let sogMean: number | null = null;
    if (sogsArr !== null) {
      let total = 0;
      for (let i = start; i < end; i += 1) total += sogsArr[i];
      sogMean = total / (end - start);
    }
    legs.push({
      startIndex: start,
      endIndex: end,
      headingDeg: headings[start],
      distanceNm,
      durationS: timesArr !== null ? timesArr[end - 1] : null,
      sogKts: sogMean
    });
  };

  let start = 0;
  for (let i = 1; i < segmentCount; i += 1) {
    if (headingDeltaDeg(headings[i], headings[start]) > thresholdDeg) {
      pushLeg(start, i);
      start = i;
    }
  }
  pushLeg(start, segmentCount);
  return legs;
};
