/**
 * Captures d'écran de la CI visuelle (#178).
 *
 * Ouvre l'app servie par le serveur Python (dist/ + flux NMEA UDP) et prend
 * une capture par vue (helm/coastal/overview/prep/legacy) x thème
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

const VIEWS = ['helm', 'coastal', 'overview', 'prep', 'legacy'];
const THEMES = ['dark', 'light'];

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
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
      });
      const page = await context.newPage();
      await page.addInitScript((layout) => {
        try { window.localStorage.setItem('dashboardLayout', layout); } catch { /* noop */ }
      }, layoutFor(theme));
      await page.goto(BASE + '/?ui=' + view, { waitUntil: 'load' });
      await page.waitForTimeout(WAIT_MS);
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
