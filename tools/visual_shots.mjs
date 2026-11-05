/**
 * Captures d'écran de la CI visuelle (#178).
 *
 * Ouvre l'app servie par le serveur Python (dist/ + flux NMEA UDP) et prend
 * une capture par vue (helm/helm-wind/helm-wind-small/coastal/overview/prep/legacy) x thème
 * (dark/light) — 1440x900, ~8 s d'attente pour laisser arriver les données
 * NMEA et Leaflet s'initialiser.
 *
 * Usage (CI uniquement, playwright installé via npm i --no-save) :
 *   node tools/visual_shots.mjs
 * Variables : BASE_URL (défaut http://127.0.0.1:3001), WAIT_MS (défaut 8000).
 */

import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3001';
const WAIT_MS = Number(process.env.WAIT_MS ?? 8000);
const OUT = 'shots';

const VIEWS = ['helm', 'helm-half', 'helm-numeric', 'helm-wind', 'helm-wind-small', 'helm-speed', 'helm-speed-numeric', 'helm-time', 'helm-depth', 'helm-position', 'coastal', 'overview', 'prep', 'legacy'];
const THEMES = ['dark', 'light'];

// Vues dérivées : capture d'un état interactif de la vue HELM.
// 'helm-wind' = onglet VENT du central (reprise HELM #180, retour n°6 :
// Dom valide la vue VENT sur captures, pas seulement le compas).
const DERIVED = {
  // #182 : plus d'onglets sous le central — la vue VENT s'obtient en
  // cliquant la tuile digitale TWS de la colonne droite.
  'helm-wind': async (page) => {
    await page.getByTestId('helm-compact-wind').click();
    await page.waitForTimeout(500);
  },
  // #184 retour n°21-quater : segment 1/2 CADRAN du switch compas ->
  // demi-cadran legacy en grand au central.
  'helm-half': async (page) => {
    await page
      .getByTestId('helm-mode-switch')
      .getByRole('button', { name: '1/2 CADRAN' })
      .click();
    await page.waitForTimeout(500);
  },
  // #184 retour n°21-quater : segment NUMÉRIQUE du switch compas ->
  // vue cadrée COG/HDG (lignes label/valeur).
  'helm-numeric': async (page) => {
    await page
      .getByTestId('helm-mode-switch')
      .getByRole('button', { name: 'NUMÉRIQUE' })
      .click();
    await page.waitForTimeout(500);
  },
  // #184 retour n°21-quater : vitesse au central en jauge legacy
  // (aiguilles STW/SOG, marque MAX, readouts + RESET).
  'helm-speed': async (page) => {
    await page.getByTestId('helm-compact-sog').click();
    await page.waitForTimeout(500);
  },
  // #184 retour n°21-quater : vitesse au central en vue cadrée
  // STW/SOG/MAX + RESET.
  'helm-speed-numeric': async (page) => {
    await page.getByTestId('helm-compact-sog').click();
    await page.waitForTimeout(300);
    await page
      .getByTestId('helm-mode-switch')
      .getByRole('button', { name: 'NUMÉRIQUE' })
      .click();
    await page.waitForTimeout(500);
  },
  // #184 retour n°21-quater : heure au central — lignes cadrées
  // LOCAL / TU (pas de switch).
  'helm-time': async (page) => {
    await page.getByTestId('helm-compact-time').click();
    await page.waitForTimeout(500);
  },
  // #184 retour n°21-quater : profondeur au central — lignes cadrées
  // DEPTH / TEMP (pas de switch).
  'helm-depth': async (page) => {
    await page.getByTestId('helm-compact-depth').click();
    await page.waitForTimeout(500);
  },
  // #184 retour n°21-quater : position au central — lignes cadrées
  // LAT / LON / GPS (qualité du signal, pas de switch).
  'helm-position': async (page) => {
    await page.getByTestId('helm-compact-position').click();
    await page.waitForTimeout(500);
  },
  // #180 retour n°11 : fenêtre réduite (écran du bord) — le cadran doit
  // se réduire pour rester ENTIER (pas de rognage, pas d'onglets perdus).
  'helm-wind-small': { viewport: { width: 1100, height: 600 }, click: 'helm-compact-wind' },
};

// Derivées simples : { viewport, click } — capture d'une vue HELM dans un
// viewport donné après clic sur un onglet du central.
const SIMPLE_DERIVED = Object.fromEntries(
  Object.entries(DERIVED)
    .filter(([, v]) => typeof v === 'object')
    .map(([k, v]) => [k, v])
);

// Layout minimal pour injecter le thème (useDashboardLayout fusionne avec
// les défauts ; instruments vide = les vues refondues n'utilisent pas ce
// layout, legacy retombe sur ses défauts).
const layoutFor = (theme) => JSON.stringify({
  instruments: [],
  theme,
  units: { speed: 'knots', depth: 'meters', temperature: 'celsius' },
});

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const view of VIEWS) {
    for (const theme of THEMES) {
      const simple = SIMPLE_DERIVED[view];
      const context = await browser.newContext({
        viewport: simple?.viewport ?? { width: 1440, height: 900 },
      });
      const page = await context.newPage();
      await page.addInitScript((layout) => {
        try { window.localStorage.setItem('dashboardLayout', layout); } catch { /* noop */ }
      }, layoutFor(theme));
      const derived = DERIVED[view];
      await page.goto(BASE + '/?ui=' + (derived ? 'helm' : view), { waitUntil: 'load' });
      await page.waitForTimeout(WAIT_MS);
      if (typeof derived === 'function') {
        await derived(page);
      } else if (simple?.click) {
        await page.getByTestId(simple.click).click();
        await page.waitForTimeout(500);
      }
      const file = OUT + '/' + view + '-' + theme + '.png';
      await page.screenshot({ path: file });
      console.log('capture: ' + file);
      await context.close();
    }
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
