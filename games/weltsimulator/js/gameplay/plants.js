/* ================= GAMEPLAY: PFLANZEN =================
   Taste P streut einen Samen der gewählten Art vor die Figur (nur am Boden, nicht aus der Luft).
   - Passt die Fläche (gpSurfaceAt + soil der Art), wächst ein Baum bzw. ein Blumenfleck.
   - Auf festem oder falschem Boden ist der Samen verbraucht und nichts passiert; der Zähler
     „Gepflanzte Bäume“ steigt dann nicht.
   Darstellung: Bäume nutzen Geometrie und Materialien (inkl. Wind) aus nature.js in eigenen
   Instanzlisten; Blumen sind zwei Instanzlisten (Stiele, Blüten). Wachstum = Skalierung.
   Datensatz: { k, x, y, z, t (Alter in s), r (Drehung), s (Grösse), c (Farb-/Zufallswert) } */

const GPL = { list: [], growing: [], trees: {}, stem: null, bloom: null, CAP_T: 700, CAP_F: 9000 };

function gplBuildMeshes(surf) {
  for (const grp of NAT.treeBuild.groups) {
    const parts = grp.parts.map(([geo, mat, colored]) => {
      const im = new THREE.InstancedMesh(geo.clone(), mat, GPL.CAP_T);
      im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; im.userData.dynamic = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (colored && grp.cols) { im.setColorAt(0, grp.cols[0]); }
      surf.add(im);
      return { im, colored: colored && !!grp.cols };
    });
    GPL.trees[grp.name] = { parts, cols: grp.cols, n: 0 };
  }
  const sg = new THREE.CylinderGeometry(0.012, 0.016, 0.3, 5); sg.translate(0, 0.15, 0);
  const bm = new MB();
  bm.addGeom(new THREE.IcosahedronGeometry(0.035, 0), new THREE.Matrix4().makeTranslation(0, 0.32, 0), lin(0xf2c230));
  for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; bm.addGeom(new THREE.IcosahedronGeometry(0.04, 0), new THREE.Matrix4().makeTranslation(Math.cos(a) * 0.06, 0.315, Math.sin(a) * 0.06).multiply(new THREE.Matrix4().makeScale(1, 0.45, 1)), null); }
  const bg = bm.build(); bg.deleteAttribute('uv');
  GPL.stem = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ color: 0x2a6e24, roughness: 0.8 }), GPL.CAP_F);
  GPL.bloom = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), GPL.CAP_F);
  GPL.bloom.setColorAt(0, new THREE.Color(1, 1, 1)); // Farb-Attribut von Anfang an, sonst fehlt es im Shader
  for (const m of [GPL.stem, GPL.bloom]) { m.count = 0; m.frustumCulled = false; m.userData.dynamic = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); surf.add(m); }
  GPL.nF = 0;
}
const gplEase = (u) => { u = clamp(u, 0, 1); return 0.06 + 0.94 * u * u * (3 - 2 * u); };
/* Instanzen eines Datensatzes anlegen (Slots vergeben) */
function gplAlloc(p) {
  const d = GP_DATA.kinds[p.k];
  if (d.type === 'tree') {
    const T = GPL.trees[d.model]; if (T.n >= GPL.CAP_T) return false;
    p.slot = T.n++;
    for (const q of T.parts) { q.im.count = T.n; if (q.colored) { q.im.setColorAt(p.slot, T.cols[Math.floor(p.c * T.cols.length) % T.cols.length]); q.im.instanceColor.needsUpdate = true; } }
    NAT.treeHash.insert({ x: p.x, z: p.z, r: 0.3 * p.s }, p.x - 1, p.z - 1, p.x + 1, p.z + 1);
  } else {
    if (GPL.nF + d.patch > GPL.CAP_F) return false;
    p.slot = GPL.nF; GPL.nF += d.patch;
    GPL.stem.count = GPL.bloom.count = GPL.nF;
    const c = new THREE.Color();
    for (let i = 0; i < d.patch; i++) { c.setHex(d.cols[Math.floor(hash2i(p.x * 10 + i | 0, p.z * 10 | 0) * d.cols.length) % d.cols.length]).convertSRGBToLinear(); GPL.bloom.setColorAt(p.slot + i, c); }
    GPL.bloom.instanceColor.needsUpdate = true;
  }
  gplPlace(p);
  return true;
}
/* Matrizen eines Datensatzes nach Alter setzen */
function gplPlace(p) {
  const d = GP_DATA.kinds[p.k], g = gplEase(p.t / d.grow);
  if (d.type === 'tree') {
    const T = GPL.trees[d.model];
    _gq.setFromAxisAngle(_gup, p.r); _gm4.compose(_gv.set(p.x, p.y - 0.1 * g, p.z), _gq, _gs.set(p.s * g, p.s * g, p.s * g));
    for (const q of T.parts) { q.im.setMatrixAt(p.slot, _gm4); q.im.instanceMatrix.needsUpdate = true; }
  } else {
    for (let i = 0; i < d.patch; i++) {
      const h1 = hash2i(p.x * 7 + i * 13 | 0, p.z * 7 | 0), h2 = hash2i(p.z * 5 + i * 29 | 0, p.x * 3 | 0);
      const a = h1 * 6.283, r = 0.15 + h2 * (d.size > 2 ? 0.9 : 0.7);
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r, sc = d.size * (0.8 + h2 * 0.5) * g;
      _gq.setFromAxisAngle(_gup, a); _gm4.compose(_gv.set(x, terrainH(x, z), z), _gq, _gs.set(sc, sc, sc));
      GPL.stem.setMatrixAt(p.slot + i, _gm4); GPL.bloom.setMatrixAt(p.slot + i, _gm4);
    }
    GPL.stem.instanceMatrix.needsUpdate = true; GPL.bloom.instanceMatrix.needsUpdate = true;
  }
}
/* Samen streuen */
function gplSow() {
  const k = GP.sel, d = GP_DATA.kinds[k];
  if (GAME.mode !== 'world' || P.ride || P.underground) return;
  if (!P.onGround || P.flying || P.swim) { gpToast('Säen geht nur am Boden.'); return; }
  if (!GP.inv[k]) { gpToast('Keine ' + d.label + '-Samen. Sammle Pakete!'); return; }
  const x = P.x - Math.sin(P.yaw) * GP_DATA.sowDist, z = P.z - Math.cos(P.yaw) * GP_DATA.sowDist;
  const y = terrainH(x, z);
  const onTerrain = Math.abs(P.y - terrainH(P.x, P.z)) < 1.2; // nicht von Brücke, Dach oder Perron
  const s = onTerrain ? gpSurfaceAt(x, z) : null;
  if (s && d.soil.includes(s) && d.type === 'tree') {
    // zu dicht an einem anderen Baum: nichts streuen, Samen behalten
    if (NAT.treeHash.query(x - 3, z - 3, x + 3, z + 3, (t) => Math.hypot(t.x - x, t.z - z) < GP_DATA.treeGap)) { gpToast('Zu dicht am nächsten Baum.'); return; }
  }
  if (GPL.list.length >= GP_DATA.maxPlants) { gpToast('Die Welt ist voll bepflanzt (' + GP_DATA.maxPlants + ').'); return; }
  GP.inv[k]--;
  if (!s) { gpToast('Die Samen fallen auf festen Boden. Nichts wächst.'); gpChanged(); return; }
  if (!d.soil.includes(s)) { gpToast(d.label + ' wächst hier nicht (' + ({ park: 'Park', meadow: 'Wiese', hill: 'Hügel', island: 'Insel' })[s] + ').'); gpChanged(); return; }
  const p = { k, x, y, z, t: 0, r: Math.random() * 6.283, s: 0.8 + Math.random() * 0.45, c: Math.random() };
  if (!gplAlloc(p)) { GP.inv[k]++; gpToast('Mehr geht hier nicht.'); return; }
  GPL.list.push(p); GPL.growing.push(p);
  if (d.type === 'tree') GP.stats.trees++; else GP.stats.flowers++;
  if (typeof sfxStep === 'function') sfxStep();
  gpToast(d.icon + ' ' + d.label + ' gesät');
  gpChanged();
}

gpRegister({
  name: 'plants',
  init(scene, surf, saved) {
    gplBuildMeshes(surf);
    if (saved && Array.isArray(saved)) for (const a of saved) {
      const k = GP_DATA.order[a[0]]; if (!k) continue;
      const p = { k, x: a[1], z: a[2], y: terrainH(a[1], a[2]), t: a[3], r: a[4], s: a[5], c: a[6] };
      if (!gplAlloc(p)) continue;
      GPL.list.push(p); if (p.t < GP_DATA.kinds[k].grow) GPL.growing.push(p);
    }
  },
  update(dt) {
    if (!GPL.growing.length) return;
    const f = GAME.timeScale > 1 ? GP_DATA.fastFactor : 1;
    for (let i = GPL.growing.length - 1; i >= 0; i--) {
      const p = GPL.growing[i];
      p.t += dt * f; gplPlace(p);
      if (p.t >= GP_DATA.kinds[p.k].grow) { GPL.growing.splice(i, 1); GP.dirty = true; }
    }
  },
  key(code) { if (code === 'KeyP') { gplSow(); return true; } return false; },
  save() { return GPL.list.map(p => [GP_DATA.order.indexOf(p.k), +p.x.toFixed(1), +p.z.toFixed(1), Math.round(p.t), +p.r.toFixed(2), +p.s.toFixed(2), +p.c.toFixed(2)]); }
});
