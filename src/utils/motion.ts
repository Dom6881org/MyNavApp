// Capteurs de la tablette (issue #152) : calculs purs pour la gîte, le tangage
// et la période de roulis, dérivés du vecteur gravité de DeviceMotionEvent.
//
// Convention de montage (à confirmer au test terrain) : tablette en paysage,
// bord supérieur (axe y du device) vers l'avant du bateau, axe x vers tribord.
// HEEL_SIGN / PITCH_SIGN permettent d'inverser un signe sans toucher au reste.

export const HEEL_SIGN = 1;
export const PITCH_SIGN = 1;

// Gîte (degrés) depuis le vecteur gravité (accelerationIncludingGravity).
// HEEL_SIGN = 1 : positif = le bord tribord baisse.
export const heelFromGravity = (ax: number, ay: number, az: number): number =>
  HEEL_SIGN * (Math.atan2(ax, Math.hypot(ay, az)) * 180 / Math.PI);

// Tangage (degrés) : PITCH_SIGN = 1 : positif = l'avant baisse.
export const pitchFromGravity = (ax: number, ay: number, az: number): number =>
  PITCH_SIGN * (Math.atan2(ay, Math.hypot(ax, az)) * 180 / Math.PI);

export interface HeelSample {
  tMs: number;
  heel: number;
}

// Période de roulis (secondes) : les passages par zéro de la gîte espacent les
// demi-périodes. Il faut au moins 5 passages (>= 2 périodes) dans la fenêtre ;
// la moyenne des intervalles lisse le bruit. null = pas assez de données ou
// période invraisemblable (hors 1-20 s).
export const estimateRollPeriod = (samples: HeelSample[]): number | null => {
  if (samples.length < 5) return null;
  const crossings: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const previous = samples[i - 1].heel;
    const current = samples[i].heel;
    if (previous === 0 || current === 0) continue;
    if (Math.sign(previous) !== Math.sign(current)) {
      crossings.push(samples[i].tMs);
    }
  }
  if (crossings.length < 5) return null;
  let total = 0;
  for (let i = 1; i < crossings.length; i++) {
    total += crossings[i] - crossings[i - 1];
  }
  const meanIntervalMs = total / (crossings.length - 1);
  if (meanIntervalMs <= 0) return null;
  const periodS = (2 * meanIntervalMs) / 1000;
  if (periodS < 1 || periodS > 20) return null;
  return Math.round(periodS * 10) / 10;
};
