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
  /**
   * B1 (#133) : la jambe contient au moins un tronçon moteur (relais sous le
   * seuil de vitesse voile). Une jambe mixte voile+moteur à cap constant est
   * marquée MOTOR — le badge signale la présence du moteur, pas l'uniformité.
   */
  motor: boolean;
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
 * timesS et sogKts sont optionnels ; leur convention est déduite de la
 * longueur : le moteur (router.py, _traceback) fournit une entrée PAR POINT
 * (len == len(coords), timesS[0] = 0, timesS[last] = etaS, sogKts[j] =
 * vitesse d'arrivée au point j, sogKts[0] artificiel) ; l'ancienne lecture
 * « par tronçon » (len == len(coords) - 1) reste acceptée. Toute autre
 * longueur est ignorée (dégradation gracieuse, colonnes absentes plutôt
 * que données fausses — bug #123).
 */
export const computeRouteLegs = (
  coords: [number, number][],
  timesS?: readonly number[] | null,
  sogKts?: readonly number[] | null,
  thresholdDeg: number = HEADING_LEG_THRESHOLD_DEG,
  motorFlags?: readonly boolean[] | null
): RouteLeg[] => {
  if (!Array.isArray(coords) || coords.length < 2) return [];
  const pointCount = coords.length;
  const segmentCount = pointCount - 1;

  // Narrowing fait dans chaque fonction (check et usage dans la même portée) :
  // une longueur incohérente renvoie null, jamais de données fausses.
  const timeAt = (endIndex: number): number | null => {
    if (Array.isArray(timesS) && timesS.length === pointCount) return timesS[endIndex];
    if (Array.isArray(timesS) && timesS.length === segmentCount) return timesS[endIndex - 1];
    return null;
  };
  // B1 (#133) : flag moteur du tronçon i (points i → i+1) — même déduction de
  // convention que sogKts : par point (len == len(coords), flag[j] = tronçon
  // d'arrivée au point j, index 0 miroir) ou par tronçon ; null = pur voile.
  const motorAt = (segmentIndex: number): boolean => {
    if (!Array.isArray(motorFlags)) return false;
    if (motorFlags.length === pointCount) return Boolean(motorFlags[segmentIndex + 1]);
    if (motorFlags.length === segmentCount) return Boolean(motorFlags[segmentIndex]);
    return false;
  };
  const sogMean = (start: number, end: number): number | null => {
    if (Array.isArray(sogKts) && sogKts.length === pointCount) {
      // Vitesses d'arrivée aux points start+1..end (sogKts[0] artificiel).
      let total = 0;
      for (let i = start + 1; i <= end; i += 1) total += sogKts[i];
      return total / (end - start);
    }
    if (Array.isArray(sogKts) && sogKts.length === segmentCount) {
      let total = 0;
      for (let i = start; i < end; i += 1) total += sogKts[i];
      return total / (end - start);
    }
    return null;
  };

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
    let motor = false;
    for (let i = start; i < end; i += 1) {
      distanceNm += distances[i];
      if (motorAt(i)) motor = true;
    }
    legs.push({
      startIndex: start,
      endIndex: end,
      headingDeg: headings[start],
      distanceNm,
      durationS: timeAt(end),
      sogKts: sogMean(start, end),
      motor
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
