/** Primitives SVG purement mathématiques pour les cadrans d'instruments
 * (refonte instruments, Phase 0 — issue #156). Zéro dépendance, zéro React :
 * toutes les fonctions sont testables isolément.
 *
 * Conventions d'angle : 0° en HAUT, sens HORAIRE (convention compas
 * nautique), cohérente avec les caps (COG/HDG/TWA) de l'app. */

export type InstrumentMode = 'dial' | 'numeric';

/** Normalise un angle dans [0, 360). */
export function normalizeDeg(value: number): number {
  return ((value % 360) + 360) % 360;
}

/** Point sur un cercle : 0° en haut, sens horaire. */
export function polarToXY(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = (normalizeDeg(angleDeg) * Math.PI) / 180;
  return { x: cx + radius * Math.sin(rad), y: cy - radius * Math.cos(rad) };
}

/** Chemin d'arc SVG (sens horaire), de startDeg vers endDeg.
 *
 * Le delta est normalisé : un arc de 350° vers 10° balaye 20°, pas -340°.
 * Retourne un `path` "M ... A ..." exploitable tel quel dans un <path>. */
export function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number
): string {
  const delta = normalizeDeg(endDeg - startDeg);
  const start = polarToXY(cx, cy, radius, startDeg);
  const end = polarToXY(cx, cy, radius, startDeg + delta);
  const largeArc = delta > 180 ? 1 : 0;
  if (delta === 0) return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;
  return (
    `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} ` +
    `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
  );
}

/** Rotation de la rose pour un compas COURSE-UP (#design revue 2) :
 * le cap du bateau reste TOUJOURS en haut, la rose tourne de -COG. */
export function roseRotationDeg(cogDeg: number): number {
  return normalizeDeg(-cogDeg);
}

/** Points du polygone "aiguille" verticale pointée vers le haut. */
export function needlePoints(
  cx: number,
  cy: number,
  length: number,
  halfWidth: number = 4,
  tail: number = 10
): string {
  return [
    `${cx},${cy - length}`,
    `${cx + halfWidth},${cy + tail}`,
    `${cx - halfWidth},${cy + tail}`
  ].join(' ');
}

/** Formattage valeur d'instrument : null/undefined -> '--', sinon
 * `value.toFixed(digits) unit` (le signe -0.0 est neutralisé). */
export function formatInstrumentValue(
  value: number | null | undefined,
  unit: string = '',
  digits: number = 1
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }
  const fixed = value === 0 ? 0 : value.toFixed(digits);
  return unit ? `${fixed} ${unit}` : `${fixed}`;
}

/** Graduations d'un cadran : liste d'angles majeurs/mineurs.
 * Ex. tickMarks(0, 360, 30, 5) -> tous les multiples de 30 (majeurs) plus
 * les intermédiaires tous les 5° (mineurs) à trier en dehors. */
export function tickMarks(
  fromDeg: number,
  toDeg: number,
  majorEvery: number,
  minorEvery: number
): { angle: number; major: boolean }[] {
  const marks: { angle: number; major: boolean }[] = [];
  let span = normalizeDeg(toDeg - fromDeg);
  if (span === 0) span = 360; // tour complet : 350->350 ou 0->360 balaye 360, pas 0
  for (let a = 0; a < span; a += minorEvery) {
    const angle = normalizeDeg(fromDeg + a);
    marks.push({ angle, major: angle % majorEvery === 0 });
  }
  return marks;
}
