/* ================= SMOKE-TEST =================
   Lädt die Startseite und jedes Spiel unter games/ in einem echten Browser und prüft:

     - keine JavaScript-Fehler
     - keine fehlenden Dateien (404)
     - angeforderte Three.js-Skripte sind verfügbar
     - ein <canvas> oder <svg> wurde erzeugt (das Spiel rendert also tatsächlich)

   Die Spiele werden aus dem Dateisystem ermittelt: Ein neuer Ordner unter games/ wird
   automatisch mitgetestet, ohne dass hier etwas eingetragen werden muss.

   Aufruf:  npm test
*/

import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8123;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/* Kleiner statischer Server - hält den Test frei von zusätzlichen Abhängigkeiten. */
function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      let filePath = join(ROOT, urlPath);
      if (urlPath.endsWith('/')) filePath = join(filePath, 'index.html');
      if (!filePath.startsWith(ROOT)) { res.writeHead(403).end(); return; }

      const info = await stat(filePath).catch(() => null);
      if (!info || info.isDirectory()) { res.writeHead(404).end('not found'); return; }

      const body = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(500).end('error');
    }
  });
  return new Promise(ok => server.listen(PORT, () => ok(server)));
}

/* Alle Spielordner ermitteln (jeder Ordner unter games/ mit einer index.html). */
async function findGames() {
  const entries = await readdir(join(ROOT, 'games'), { withFileTypes: true });
  const games = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const hasIndex = await stat(join(ROOT, 'games', e.name, 'index.html')).catch(() => null);
    if (hasIndex) games.push(e.name);
  }
  return games.sort();
}

async function checkPage(browser, label, url, expect3d) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const problems = [];

  page.on('pageerror', err => problems.push(`JavaScript-Fehler: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') problems.push(`Konsolenfehler: ${msg.text()}`);
  });
  page.on('response', res => {
    if (res.status() === 404) problems.push(`Datei fehlt (404): ${res.url()}`);
  });

  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  // Zeit für Ladebildschirme und den Aufbau der 3D-Szene
  await page.waitForTimeout(6000);

  const state = await page.evaluate(() => ({
    three: !!window.THREE,
    threeScript: Array.from(document.scripts).some(s => /three/i.test(s.src)),
    canvas: !!document.querySelector('canvas'),
    svg: !!document.querySelector('svg'),
    title: document.title
  }));

  // Nur Spielseiten muessen etwas Renderbares aufbauen; die Startseite ist reines HTML.
  if (expect3d) {
    if (state.threeScript && !state.three) problems.push('Three.js wurde angefordert, aber nicht geladen (window.THREE fehlt)');
    if (!state.canvas && !state.svg) problems.push('Kein <canvas> oder <svg> vorhanden - es wird nichts gerendert');
  }

  await page.close();
  return { label, url, title: state.title, problems };
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  const base = `http://localhost:${PORT}`;

  const games = await findGames();
  console.log(`Gefundene Spiele: ${games.join(', ')}\n`);

  const targets = [
    { label: 'Startseite', url: `${base}/`, expect3d: false },
    ...games.map(name => ({ label: `games/${name}`, url: `${base}/games/${name}/`, expect3d: true }))
  ];

  const results = [];
  for (const t of targets) {
    process.stdout.write(`Prüfe ${t.label} … `);
    try {
      const r = await checkPage(browser, t.label, t.url, t.expect3d);
      console.log(r.problems.length === 0 ? 'OK' : `${r.problems.length} Problem(e)`);
      results.push(r);
    } catch (err) {
      console.log('FEHLER');
      results.push({ label: t.label, url: t.url, problems: [`Seite nicht ladbar: ${err.message}`] });
    }
  }

  await browser.close();
  server.close();

  const failed = results.filter(r => r.problems.length > 0);
  console.log('\n' + '-'.repeat(60));
  if (failed.length === 0) {
    console.log(`Alle ${results.length} Seiten fehlerfrei.`);
    process.exit(0);
  }
  for (const r of failed) {
    console.log(`\n${r.label} (${r.url})`);
    for (const p of r.problems) console.log(`  - ${p}`);
  }
  console.log(`\n${failed.length} von ${results.length} Seiten mit Problemen.`);
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
