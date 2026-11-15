#!/usr/bin/env node
/* Spieltest ohne Handarbeit: lädt die Welt im Headless-Browser, startet, führt ein Testskript
   in der Seite aus und gibt dessen Rückgabewert als Text aus.

   Aufruf (Server im Repo-Wurzelordner: python3 -m http.server 8765):
     node tools/play-test.cjs <skript.js> [--shot bild.png] [--start zentrum|hoengg|venedig|riviera|isla] [--port 8765]

   Das Skript ist der Rumpf einer (async) Funktion in der Seite. Helfer:
     step(n)            n Simulationsschritte à 0,05 s (Spiel ist pausiert, Logik läuft von Hand)
     key('KeyP')        Tastendruck
     tp(x, z, y?)       Spieler versetzen (y Standard: Boden)
     hold('ArrowUp', n) Taste n Schritte lang halten
   Beispiel: tp(250, -300); key('KeyP'); step(20); return GP.stats;
   Playwright: global installiert (require('playwright')). */
const { chromium } = require('playwright'); const fs = require('fs');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
(async () => {
  const script = fs.readFileSync(process.argv[2], 'utf8'), port = arg('--port', '8765'), shot = arg('--shot', null), startLoc = arg('--start', 'zentrum');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 560 } });
  const logs = [];
  page.on('pageerror', e => logs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  page.on('console', m => { if (m.type() === 'error') logs.push('console: ' + m.text().slice(0, 400)); });
  await page.addInitScript((s) => { try { localStorage.setItem('weltsimulator.start.v1', s); } catch (e) { } }, startLoc);
  await page.goto('http://localhost:' + port + '/games/weltsimulator/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  for (let i = 0; i < 300; i++) { if (await page.evaluate(() => typeof WORLD !== 'undefined' && (!!WORLD.allMs || /Fehler/.test(document.getElementById('loadtxt').textContent)))) break; await page.waitForTimeout(500); }
  await page.evaluate(() => {
    document.getElementById('btnStart').click(); GAME.paused = true;
    window.step = (n) => { for (let i = 0; i < (n || 1); i++) { const dt = 0.05; WORLD.t += dt; AMB_T.value = WORLD.t;
      rebuildObstacles(trafficObstacles(P.x, P.z, GAME.mode === 'world' && !P.ride && !P.underground));
      updateTransit(dt, WORLD.camera.position, !!(P.underground || (P.ride && P.ride.veh.underground))); updateTraffic(dt, WORLD.camera.position);
      if (!liftsUpdate(dt)) { if (GAME.mode === 'world') updatePlayerWorld(dt); else updatePlayerInterior(dt); }
      updateElevator(dt); gpUpdate(dt); } updateHUD(); };
    window.key = (c) => { window.dispatchEvent(new KeyboardEvent('keydown', { code: c })); window.dispatchEvent(new KeyboardEvent('keyup', { code: c })); };
    window.tp = (x, z, y) => { P.x = x; P.z = z; P.y = y !== undefined ? y : groundAt(x, z, terrainH(x, z) + 2); P.vy = 0; P.onGround = true; P.ride = null; P.underground = false; step(1); };
    window.hold = (c, n) => { KEYS[c] = true; step(n); KEYS[c] = false; };
  });
  const out = await page.evaluate('(async () => {' + script + '\n})()');
  console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
  if (shot) { await page.waitForTimeout(2500); await page.screenshot({ path: shot }); console.log('Bild: ' + shot); }
  if (logs.length) console.log(logs.slice(0, 15).join('\n'));
  await browser.close();
})();
