// Abnahmeprüfung einer Zusatzwelt:  node tools/play-test.cjs tools/welt-check.js --welt <id> [--shot bild.png]
const W = WELT.cur, def = W.def, out = { welt: def.id + ' „' + def.name + '“', fehler: [], hinweise: [] };
const bad = (t) => out.fehler.push(t), note = (t) => out.hinweise.push(t);
// 1. Vertrag
for (const k of ['id', 'name', 'size', 'spawn', 'height', 'build']) if (def[k] === undefined) bad('Feld fehlt: ' + k);
if (def.size > 3000) bad('size > 3000 m'); if (def.size < 200) bad('size < 200 m');
// 2. Budget
let tris = 0, calls = 0;
W.group.traverse(o => { if ((o.isMesh || o.isPoints || o.isLine) && o.visible) { calls++; const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3; tris += n * (o.isInstancedMesh ? o.count : 1); } });
out.budget = { bauzeitMs: W.buildMs, drawCalls: calls, dreiecke: Math.round(tris) };
if (W.buildMs > 400) bad('Bauzeit ' + W.buildMs + ' ms > 400 ms'); if (calls > 80) bad(calls + ' Draw-Calls > 80'); if (tris > 500000) bad(Math.round(tris) + ' Dreiecke > 500000');
// 3. Höhenfunktion: schnell, endlich, stetig
let t0 = performance.now(); for (let i = 0; i < 20000; i++) def.height((i * 7.3) % def.size - def.size / 2, (i * 3.1) % def.size - def.size / 2);
const us = (performance.now() - t0) / 20000 * 1000; out.hoeheMikrosekunden = +us.toFixed(2); if (us > 5) bad('height() zu langsam: ' + us.toFixed(1) + ' µs (Grenze 5)');
let jump = 0; for (let i = 0; i < 4000; i++) { const x = (i * 13.7) % (def.size - 20) - def.size / 2 + 10, z = (i * 5.9) % (def.size - 20) - def.size / 2 + 10; const h = def.height(x, z); if (!isFinite(h)) { bad('height() liefert NaN/Infinity bei ' + [x | 0, z | 0]); break; } jump = Math.max(jump, Math.abs(def.height(x + 0.5, z) - h)); }
if (jump > 2.5) note('height() springt um ' + jump.toFixed(1) + ' m auf 0,5 m (Klippe? Spieler kann hängen bleiben)');
// 4. Startpunkt und Rücktor
const sp = def.spawn, hs = def.height(sp.x, sp.z);
if (hs < WS.WATER_Y + 0.3) bad('Startpunkt liegt im Wasser (Höhe ' + hs.toFixed(1) + ')');
if (def.height(W.back.x, W.back.z) < WS.WATER_Y + 0.3) bad('Rücktor (5 m hinter dem Startpunkt) liegt im Wasser');
out.start = { hoehe: +hs.toFixed(2), boden: +groundAt(P.x, P.z, P.y + 1).toFixed(2), ort: document.getElementById('place').textContent };
// 5. Gehen: 8 Richtungen je 6 s; bleibt der Spieler in der Welt und fällt nicht durch?
let minY = 1e9, stuck = 0;
for (let k = 0; k < 8; k++) {
  WELT.cool = 999; // Rücktor während des Gehtests sperren
  tp(W.ox + sp.x, W.oz + sp.z, hs + 0.05); P.yaw = k * Math.PI / 4; const x0 = P.x, z0 = P.z;
  hold('ArrowUp', 120); minY = Math.min(minY, P.y);
  if (Math.hypot(P.x - x0, P.z - z0) < 3) stuck++;
  if (Math.abs(P.x - W.ox) > W.half || Math.abs(P.z - W.oz) > W.half) bad('Spieler hat die Welt verlassen (Richtung ' + k + ')');
}
if (minY < -40) bad('Spieler fällt durch den Boden (y ' + minY.toFixed(0) + ')');
if (stuck > 4) note('vom Startpunkt aus in ' + stuck + ' von 8 Richtungen blockiert');
// 6. Rücktor
tp(W.ox + W.back.x, W.oz + W.back.z); WELT.cool = 0; step(3);
out.ruecktor = WELT.cur ? 'FEHLER: kein Wechsel' : 'ok (zurück in Neu-Zürich)'; if (WELT.cur) bad('Rücktor funktioniert nicht');
await weltEnter(def.id); step(1); P.pitch = -0.08;
out.ergebnis = out.fehler.length ? 'NICHT BESTANDEN' : 'BESTANDEN';
return out;
