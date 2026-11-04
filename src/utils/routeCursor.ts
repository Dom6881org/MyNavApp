// Curseur temporel de la route (A2, issue #154) : interpolation pure de la
// position / cap / SOG à un instant donné de la route calculée.
// Conventions #123 : timesS et sogKts sont PAR POINT (len == len(coords),
// timesS[0] = 0, sogKts[j] = vitesse d'arrivée au point j).

export interface RouteCursor {
  index: number;
  latitude: number;
  longitude: number;
  headingDeg: number | null;
  sogKts: number | null;
}

/** Cap initial du segment a -> b (formule du cap initial, locale). */
export const segmentBearingDeg = (
  latA: number, lonA: number,
  latB: number, lonB: number
): number => {
  const toRad = Math.PI / 180;
  const y = Math.sin((lonB - lonA) * toRad) * Math.cos(latB * toRad);
  const x = Math.cos(latA * toRad) * Math.sin(latB * toRad)
    - Math.sin(latA * toRad) * Math.cos(latB * toRad) * Math.cos((lonB - lonA) * toRad);
  return (Math.atan2(y, x) / toRad + 360) % 360;
};

/** Position interpolée le long de la route à l'instant cursorS (secondes).
 * Hors bornes : clamp au départ / à l'arrivée. null si données incohérentes
 * (longueurs mismatch — leçon #123 : la convention se vérifie sur la longueur). */
export const cursorAtTimeS = (
  coords: [number, number][],
  timesS: number[],
  sogKts: (number | null)[] | undefined,
  cursorS: number
): RouteCursor | null => {
  if (coords.length === 0 || timesS.length !== coords.length) return null;
  const etaS = Math.max(timesS[coords.length - 1], 0);
  const t = Math.min(Math.max(cursorS, 0), etaS);

  // Segment contenant t : le plus petit i tel que timesS[i] >= t (>= 1 sauf
  // route à un point), en gardant [i-1, i] strictement dans la route.
  let end = coords.length - 1;
  for (let i = 1; i < coords.length; i++) {
    if (timesS[i] >= t) {
      end = i;
      break;
    }
  }
  if (coords.length === 1) {
    return { index: 0, latitude: coords[0][0], longitude: coords[0][1], headingDeg: null, sogKts: null };
  }
  let start = end - 1;
  if (start < 0) start = 0;

  const [latA, lonA] = coords[start];
  const [latB, lonB] = coords[end];
  const spanS = timesS[end] - timesS[start];
  const ratio = spanS > 0 ? Math.min(Math.max((t - timesS[start]) / spanS, 0), 1) : 1;
  const latitude = latA + (latB - latA) * ratio;
  const longitude = lonA + (lonB - lonA) * ratio;

  // Cap du segment courant ; points identiques (anti-zigzag moteur) -> segment
  // précédent ; départ -> premier segment.
  let headingDeg: number | null = null;
  if (latA === latB && lonA === lonB) {
    const back = start - 1 >= 0 ? start - 1 : 0;
    const fwd = back + 1 < coords.length ? back + 1 : back;
    if (back !== fwd) headingDeg = segmentBearingDeg(coords[back][0], coords[back][1], coords[fwd][0], coords[fwd][1]);
  } else {
    headingDeg = segmentBearingDeg(latA, lonA, latB, lonB);
  }

  // SOG du point d'arrivée du segment (convention #123).
  const sog = sogKts && sogKts.length === coords.length ? sogKts[end] : null;

  return { index: end, latitude, longitude, headingDeg, sogKts: sog ?? null };
};
