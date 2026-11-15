// Prüft je Objektart, ob man hindurchlaufen kann: aus 4 Richtungen auf die Mitte zugehen.
const T = [];
const add = (kind, x, z, r, y) => T.push({ kind, x, z, r: r || 0.3, y });
const some = (arr, n) => arr.filter((_, i) => i % Math.max(1, Math.floor(arr.length / n)) === 0).slice(0, n);
for (const t of some(TREES.deciduous, 3)) add('Baum (Laub)', t.x, t.z, 0.3);
for (const t of some(TREES.conifer, 2)) add('Baum (Tanne)', t.x, t.z, 0.3);
for (const t of some(TREES.palm, 2)) add('Palme', t.x, t.z, 0.3);
for (const f of some(NAT.fountains, 2)) add('Brunnen', f.x, f.z, f.r * 0.6);
for (const b of some(NAT.benches, 3)) add('Parkbank', b.x, b.z, 0.25);
for (const p of some(NAT.poles, 2)) add('Haltestellenmast', p.x, p.z, 0.15);
for (const s of some(TRANSIT.stops, 3)) add('Wartehäuschen (Rückwand)', s.shelter.x - Math.sin(s.shelter.rot) * 0.75, s.shelter.z - Math.cos(s.shelter.rot) * 0.75, 0.2);
if (ROADS.lamps) for (const l of some(ROADS.lamps, 3)) add('Strassenlaterne', l.x !== undefined ? l.x : l[0], l.z !== undefined ? l.z : l[2], 0.15);
for (const u of some(NAT.umbrellas, 2)) add('Sonnenschirm', u.x, u.z, 0.15);
for (const o of some(LIFTS.list.filter(o => !o.hub), 2)) { const g = o.levels.find(l => l.ground); add('Liftschacht (Rückwand)', o.x - 1.25 * (o.open || 1) * o.s, o.z - 1.25 * (o.open || 1) * o.c, 0.3, g.y); }
for (const st of some(RAIL.stations.filter(s => s.access === 'stairs'), 1)) { const F = railStationFrame(st); const pl = st.platforms[0]; const p = F.W(-st.PL * 0.45 / 2 + 4, pl.s * pl.lat); add('Perrondach-Säule', p[0], p[1], 0.15, st.y + RL.PLH); }
for (const pl of some(TRANSIT.tram.platforms, 2)) add('Tramhalt Glaswand', pl.x + pl.rx * 1.15, pl.z + pl.rz * 1.15, 0.15, pl.y + 0.32);
{ const D = hubDepot(); add('Werkhalle Serviceanlage', D.x + 8.5, D.z + 40, 5); add('Abgestellter Zug', D.x - 14, D.z - 20, 1.0); }
{ const bt = hubBusTerminal(); add('Busbahnhof-Stütze', bt.x + (-15) * Math.sin(bt.rot) + 2.5 * Math.cos(bt.rot), bt.z + (-15) * Math.cos(bt.rot) - 2.5 * Math.sin(bt.rot), 0.15); }
add('Leuchtturm', ISLAND.x + 52, ISLAND.z - 30, 1.5);
add('Öltank (Plattform)', ISLAND.oil.x - 20, ISLAND.oil.z + 12, 1.5, 14);
add('Bohrturm-Fuss', ISLAND.oil.x - 10 - 5, ISLAND.oil.z - 8 - 5, 0.3, 24);
{ const c = LIFE.people.find(p => p.kind === 'cafe'); if (c) add('Café-Stuhl', c.x, c.z, 0.2); }
if (LIFE.flags) { const m = new THREE.Matrix4(); LIFE.flags.getMatrixAt(0, m); add('Fahnenmast', m.elements[12] - 0.06, m.elements[14], 0.1); }
{ const b = BLD.list.find(b => b.cat === 'buero'); add('Gebäude', b.x, b.z, 3); }
{ const st = TRANSIT.stations.find(s => !s.noStairs); const p = stLocalToWorld(st, 2.75, st.aTop - 2.5); add('U-Bahn-Pavillon Glas', p[0], p[1], 0.15); }
{ const l = RAIL.lines[0]; let found = null; BLD.hash.query(l.C[200][0] - 60, l.C[200][1] - 60, l.C[200][0] + 60, l.C[200][1] + 60, (b) => { if (!b.b && b.obb && b.obb.hw < 3 && !found) found = b; }); if (found) add('Viadukt-Pfeiler', found.obb.cx !== undefined ? found.obb.cx : found.obb.x, found.obb.cz !== undefined ? found.obb.cz : found.obb.z, 0.5); }
{ const c = TRAFFIC.cars[0]; add('Auto (stehend)', c.x, c.z, 0.6); }
{ const pg = GPP.list[0]; }
const res = {};
for (const t of T) {
  let through = 0;
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + 0.3, d0 = t.r + 2.2;
    const sx = t.x + Math.cos(a) * d0, sz = t.z + Math.sin(a) * d0;
    P.x = sx; P.z = sz; P.y = t.y !== undefined ? t.y : groundAt(sx, sz, terrainH(sx, sz) + 2); P.vy = 0; P.onGround = true; P.ride = null; P.underground = false; P.char = 'human'; P.rocket = false;
    P.yaw = Math.atan2(sx - t.x, sz - t.z); // vorwärts = zur Mitte
    KEYS.ArrowUp = true; let dmin = 1e9;
    for (let i = 0; i < 30; i++) { updatePlayerWorld(0.05); dmin = Math.min(dmin, Math.hypot(P.x - t.x, P.z - t.z)); if (P.ride) break; }
    KEYS.ArrowUp = false;
    if (dmin < Math.max(0.12, t.r * 0.35)) through++;
  }
  (res[t.kind] = res[t.kind] || []).push(through);
}
return Object.keys(res).map(k => (res[k].some(v => v > 0) ? 'DURCHLÄSSIG ' : 'fest        ') + k + '  (' + res[k].join(',') + ' von 4 Richtungen)').sort().join('\n');
