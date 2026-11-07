/* ================= NATUR & AUSSTATTUNG =================
   Bäume (instanziert, pro Kachel), Parks mit Wegen, Bänken und Springbrunnen, Wald auf dem
   ETH-Hügel und in den Bergen, Strand mit Palmen und Sonnenschirmen, Hotelpools, Jachten,
   Gondeln in Klein-Venedig, Bushaltestellen-Wartehäuschen. */

/* Kleinteile nur in der Nähe zeichnen (spart Draw-Calls) */
const NEARVIS = { list: [], t: 0 };
function nearVis(obj, r, moving) { NEARVIS.list.push({ obj, r, moving }); }
function updateNearVis(cx, cz, dt, force) {
  NEARVIS.t -= dt; if (NEARVIS.t > 0 && !force) return; NEARVIS.t = 0.4;
  for (const o of NEARVIS.list) { const p = o.obj.position; o.obj.visible = Math.abs(p.x - cx) < o.r && Math.abs(p.z - cz) < o.r; }
}

const NAT = { treeHash: null, fountains: [], jets: [], gondolas: [], boats: [], poles: [] };

function initNature() { NAT.treeHash = new SHash(20); }

/* ---------- Baum-Geometrien ---------- */
function jitterGeo(g, amt, seed, roundNormals) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (hash2i(Math.round(x * 50) + seed, Math.round(y * 50 + z * 31)) - 0.5) * amt;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  if (roundNormals) {
    // weiche Kugel-Normalen: Krone wirkt rund statt facettiert
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) * 0.8, z = p.getZ(i); const l = Math.hypot(x, y, z) || 1; n.setXYZ(i, x / l, y / l + 0.25, z / l); }
    for (let i = 0; i < p.count; i++) { const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i)); n.setXYZ(i, n.getX(i) / l, n.getY(i) / l, n.getZ(i) / l); }
  }
  return g;
}
function treeGeos() {
  const trunk = new THREE.CylinderGeometry(0.16, 0.26, 3.2, 7); trunk.translate(0, 1.6, 0);
  // Laubkrone aus mehreren Kugeln
  const parts = [];
  const blob = (x, y, z, r, det) => { const g = jitterGeo(new THREE.IcosahedronGeometry(r, det), 0.28, Math.round(x * 10 + y * 7), true); g.translate(x, y, z); parts.push(g); };
  blob(0, 4.7, 0, 2.4, 1); blob(0.7, 3.9, 0.4, 1.7, 1);
  const crown = mergeGeos(parts);
  const cTrunk = new THREE.CylinderGeometry(0.14, 0.24, 2.5, 6); cTrunk.translate(0, 1.25, 0);
  const cones = [];
  for (let i = 0; i < 3; i++) { const g = new THREE.ConeGeometry(2.6 - i * 0.7, 3.6, 8, 1, true); jitterGeo(g, 0.12, i); g.translate(0, 2.6 + i * 2.0, 0); cones.push(g); }
  const conifer = mergeGeos(cones);
  // Palme: geschwungener Stamm + Wedel
  const pTrunkParts = [];
  for (let i = 0; i < 8; i++) { const g = new THREE.CylinderGeometry(0.17 - i * 0.008, 0.2 - i * 0.008, 1.0, 7); g.translate(Math.pow(i / 8, 2) * 0.9, 0.5 + i * 0.98, 0); pTrunkParts.push(g); }
  const palmTrunk = mergeGeos(pTrunkParts);
  const fronds = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.PlaneGeometry(0.9, 3.6, 1, 4);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const y = p.getY(k) + 1.8; const t = y / 3.6; p.setXYZ(k, p.getX(k) * (1 - t * 0.6), y, -t * t * 1.6); }
    g.rotateX(-0.9); g.rotateY(i / 9 * Math.PI * 2); g.translate(0.9, 7.9, 0);
    g.computeVertexNormals();
    fronds.push(g);
  }
  const palmLeaves = mergeGeos(fronds);
  return { trunk, crown, cTrunk, conifer, palmTrunk, palmLeaves };
}
function mergeGeos(list) {
  const mb = new MB();
  for (const g of list) mb.addGeom(g.index ? g : g, new THREE.Matrix4(), null);
  const out = mb.build();
  out.deleteAttribute('color');
  return out;
}

/* ---------- Bäume sammeln ---------- */
const TREES = { deciduous: [], conifer: [], palm: [] };
function addTree(kind, x, z, s, col) {
  const y = terrainH(x, z);
  TREES[kind].push({ x, y, z, s: s || rr(0.8, 1.25), r: rnd() * Math.PI * 2, c: col });
  NAT.treeHash.insert({ x, z, r: 0.35 * (s || 1) }, x - 1, z - 1, x + 1, z + 1);
}
function treeSpotFree(x, z, roadM) {
  if (Math.abs(x) > 2480 || Math.abs(z) > 2480) return false;
  if (waterDist(x, z) < 4) return false;
  if (terrainH(x, z) < WS.WATER_Y + 0.6) return false;
  if (roadClear(x, z, 3) < (roadM || 1.5)) return false;
  if (isReserved(x, z, 1)) return false;
  if (!occFree(makeOBB(x, z, 0, 1.2, 1.2), 0.3)) return false;
  return true;
}

function genTrees() {
  const H = WS.HILL;
  // Parks
  for (const pk of ROADS.parks) {
    const q = cellPoly(pk.cell, 14);
    const area = 115 * 115;
    const n = Math.floor(area / 170);
    for (let i = 0; i < n; i++) {
      const u = rnd(), v = rnd();
      const L = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
      const p = L(L(q[0], q[1], u), L(q[3], q[2], u), v);
      const dc = Math.hypot(p[0] - pk.cell.cx, p[1] - pk.cell.cz);
      if (dc < 16) continue;
      // Wege freihalten (Diagonalen)
      if (distToDiag(p, pk.cell) < 3.5) continue;
      if (!treeSpotFree(p[0], p[1], 2)) continue;
      addTree('deciduous', p[0], p[1], rr(0.9, 1.5));
    }
  }
  // Alleen an Promenade, Tram- und Hauptstrassen
  for (const e of ROADS.edges) {
    if (e.dead || e.bridge || e.sw < 4.4 || e.type === 'street' || e.type === 'alley') continue;
    const A = ROADS.nodes[e.a];
    const kind = e.type === 'boulevard' ? 'palm' : 'deciduous';
    for (const side of [1, -1]) {
      for (let d = 22; d < e.len - 22; d += 19) {
        const l = side * (e.w / 2 + e.sw - 1.1);
        if (inBay(e, d - 4, d + 4, l)) continue;
        const x = A.x + e.dx * (d + 17) + e.nx * l, z = A.z + e.dz * (d + 17) + e.nz * l;
        if (d + 17 > e.len - 20) continue;
        if (roadClear(x, z, 3) > -0.2 && roadClear(x, z, 3) < -e.sw + 0.5) continue;
        if (isReserved(x, z, 0.5)) continue;
        addTree(kind, x, z, kind === 'palm' ? rr(0.9, 1.15) : rr(0.75, 0.95));
      }
    }
  }
  // Wald auf dem Hochschulhügel
  for (let i = 0; i < 4200; i++) {
    const th = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 520;
    const x = H.x + Math.cos(th) * r, z = H.z + Math.sin(th) * r;
    if (r < 110) continue;
    if (fbm(x * 0.01, z * 0.01, 2) < -0.25) continue; // Lichtungen
    if (!treeSpotFree(x, z, 3)) continue;
    addTree(chance(0.3) ? 'conifer' : 'deciduous', x, z, rr(0.9, 1.4));
  }
  // Berge und Hügel
  for (let i = 0; i < 26000; i++) {
    const x = rr(-2480, 2480), z = rr(-2480, 2480);
    const h = terrainH(x, z);
    if (h < WS.CITY_Y + 7) continue;
    if (Math.hypot(x - H.x, z - H.z) < 540) continue;
    if (h > 190) continue;
    const dens = fbm(x * 0.004, z * 0.004, 3);
    if (dens < -0.05) continue;
    if (terrainSlope(x, z) > 0.75) continue;
    if (!treeSpotFree(x, z, 3)) continue;
    addTree(h > 55 || chance(0.4) ? 'conifer' : 'deciduous', x, z, rr(0.85, 1.4));
  }
  // Gärten im äusseren Ring
  for (let i = 0; i < 6000; i++) {
    const x = rr(-1900, 1800), z = rr(-1900, 1900);
    const dC = Math.hypot(x - WS.CENTER.x, z - WS.CENTER.z);
    if (dC < 700) continue;
    if (terrainH(x, z) > WS.CITY_Y + 7) continue;
    if (x > WS.VENICE.x0 - 40 && z > WS.VENICE.z0 && z < WS.VENICE.z1) continue;
    if (coastX(z) - x < 110) continue;
    if (!treeSpotFree(x, z, 2.5)) continue;
    addTree('deciduous', x, z, rr(0.7, 1.15));
  }
  // Flussufer ausserhalb der Stadt
  for (const p of WATER.river.pts) {
    if (Math.abs(p[0]) < 1850 || !chance(0.5)) continue;
    for (const s of [1, -1]) {
      const x = p[0] + rr(-6, 6), z = p[1] + s * rr(32, 60);
      if (treeSpotFree(x, z, 2)) addTree(chance(0.5) ? 'deciduous' : 'conifer', x, z);
    }
  }
  // Palmen am Strand
  for (let z = -2450; z < 2450; z += rr(9, 16)) {
    if (inVeniceZ(z)) continue;
    const x = coastX(z) - rr(70, 115);
    if (waterDist(x, z) < 8 || isReserved(x, z, 1) || !occFree(makeOBB(x, z, 0, 1, 1), 2)) continue;
    addTree('palm', x, z, rr(0.85, 1.2));
  }
}
function distToDiag(p, cell) {
  const [a, b, c, d] = cell.c;
  return Math.min(segDist(p[0], p[1], a.x, a.z, c.x, c.z), segDist(p[0], p[1], b.x, b.z, d.x, d.z));
}

function buildTreeMeshes(scene) {
  const G = treeGeos();
  const leafTex = (() => {
    const cv = noiseCanvas(128, 128, 0.7, 0.5, 9, 77);
    return canvasTex(cv);
  })();
  const mats = {
    trunk: new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0xffffff, map: leafTex, roughness: 0.85 }),
    needle: new THREE.MeshStandardMaterial({ color: 0xffffff, map: leafTex, roughness: 0.9 }),
    palmTrunk: new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 0.95 }),
    palmLeaf: new THREE.MeshStandardMaterial({ color: 0x4f7d2e, roughness: 0.8, side: THREE.DoubleSide })
  };
  const leafCols = [0x4e7a2c, 0x5b8a33, 0x6a9338, 0x3f6b28, 0x76923a, 0x587f2f, 0x8a9a3c].map(c => lin(c));
  const needleCols = [0x2f5428, 0x2a4a24, 0x36602c, 0x3d5f30].map(c => lin(c));
  const groups = [
    { list: TREES.deciduous, parts: [[G.trunk, mats.trunk, false], [G.crown, mats.leaf, true]], cols: leafCols },
    { list: TREES.conifer, parts: [[G.cTrunk, mats.trunk, false], [G.conifer, mats.needle, true]], cols: needleCols },
    { list: TREES.palm, parts: [[G.palmTrunk, mats.palmTrunk, false], [G.palmLeaves, mats.palmLeaf, false]], cols: null }
  ];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const CH = 625;
  for (const grp of groups) {
    const buckets = new Map();
    for (const t of grp.list) {
      const k = Math.floor((t.x + 2500) / CH) + '_' + Math.floor((t.z + 2500) / CH);
      let a = buckets.get(k); if (!a) { a = []; buckets.set(k, a); } a.push(t);
    }
    for (const [k, arr] of buckets) {
      let cx = 0, cz = 0; for (const t of arr) { cx += t.x; cz += t.z; } cx /= arr.length; cz /= arr.length;
      let rad = 0, ymin = 1e9, ymax = -1e9; for (const t of arr) { rad = Math.max(rad, Math.hypot(t.x - cx, t.z - cz)); ymin = Math.min(ymin, t.y); ymax = Math.max(ymax, t.y); }
      for (const [geo, mat, colored] of grp.parts) {
        const g = geo.clone();
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, (ymin + ymax) / 2 + 5, cz), rad + 15 + (ymax - ymin) / 2);
        const im = new THREE.InstancedMesh(g, mat, arr.length);
        arr.forEach((t, i) => {
          q.setFromAxisAngle(up, t.r); sc.set(t.s, t.s * rr(0.9, 1.1), t.s); ps.set(t.x, t.y - 0.1, t.z);
          m4.compose(ps, q, sc); im.setMatrixAt(i, m4);
          if (colored && grp.cols) { const c = grp.cols[Math.floor(hash2i(i, t.x | 0) * grp.cols.length)]; im.setColorAt(i, c); }
        });
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.castShadow = true; im.receiveShadow = true;
        scene.add(im);
      }
    }
  }
}

/* ---------- Parks, Brunnen, Bänke, Strand ---------- */
function buildParksAndProps(scene) {
  const cm = new ChunkedMB(WS.CHUNK);
  const stone = lin(0xc8c0b0), wood = lin(0x7a5434), iron = lin(0x2e3236);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2f7f9a, roughness: 0.05, metalness: 0.2, envMapIntensity: 1.4 });
  const poolMat = new THREE.MeshStandardMaterial({ color: 0x3fc4d8, roughness: 0.05, metalness: 0.1, emissive: 0x0a3a44, emissiveIntensity: 0.4, envMapIntensity: 1.2 });
  const jetMat = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false });
  const fountain = (x, z, y, R, big) => {
    const mb = cm.get('stone', x, z);
    const wm = cm.get('fwater', x, z);
    mb.cyl(x, y, z, R, R, 0.6, 32, stone, false);
    mb.cyl(x, y, z, R - 0.4, R - 0.4, 0.6, 32, stone, false);
    mb.ring(x, z, y + 0.6, R - 0.4, R, 32, 1, stone);
    wm.disc(x, z, y + 0.45, R - 0.4, 32, 2, null);
    mb.cyl(x, y, z, big ? 1.4 : 0.9, big ? 1.0 : 0.6, big ? 1.6 : 1.1, 16, stone, true);
    if (big) { mb.cyl(x, y + 1.6, z, 2.6, 2.6, 0.25, 24, stone, true); mb.cyl(x, y + 1.85, z, 0.45, 0.3, 1.2, 12, stone, true); }
    const jet = new THREE.Mesh(new THREE.ConeGeometry(big ? 0.9 : 0.6, big ? 5 : 3, 12, 1, true), jetMat);
    jet.position.set(x, y + (big ? 3.05 : 1.1) + (big ? 2.5 : 1.5), z);
    jet.rotation.x = Math.PI;
    scene.add(jet); nearVis(jet, 450); NAT.jets.push({ m: jet, base: jet.position.y, big });
    NAT.fountains.push({ x, z, r: R + 0.2, top: y + 0.6 });
  };
  const bench = (x, z, y, rot) => {
    const mb = cm.get('props', x, z);
    const s = Math.sin(rot), c = Math.cos(rot);
    mb.box(x, y + 0.45, z, 1.8, 0.07, 0.5, rot, wood);
    mb.box(x - s * 0.24, y + 0.75, z - c * 0.24, 1.8, 0.45, 0.06, rot, wood);
    for (const k of [-0.75, 0.75]) mb.box(x + c * k, y + 0.22, z - s * k, 0.06, 0.44, 0.45, rot, iron);
  };
  // Parks: Wege, Brunnen, Bänke
  for (const pk of ROADS.parks) {
    const cell = pk.cell; const [a, b, c, d] = cell.c;
    const y = terrainH(cell.cx, cell.cz);
    const pm = cm.get('path', cell.cx, cell.cz);
    for (const [p, q2] of [[a, c], [b, d]]) {
      const dx = q2.x - p.x, dz = q2.z - p.z, l = Math.hypot(dx, dz), nx = -dz / l * 1.7, nz = dx / l * 1.7;
      const n = Math.ceil(l / 8);
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const x0 = lerp(p.x, q2.x, t0), z0 = lerp(p.z, q2.z, t0), x1 = lerp(p.x, q2.x, t1), z1 = lerp(p.z, q2.z, t1);
        const y0 = terrainH(x0, z0) + 0.05, y1 = terrainH(x1, z1) + 0.05;
        pm.quadUV([x0 - nx, y0, z0 - nz], [x1 - nx, y1, z1 - nz], [x1 + nx, y1, z1 + nz], [x0 + nx, y0, z0 + nz], [x0 / 3, -z0 / 3], [x1 / 3, -z1 / 3], [x1 / 3, -z1 / 3], [x0 / 3, -z0 / 3], null);
        pm.quadUV([x0 + nx, y0, z0 + nz], [x1 + nx, y1, z1 + nz], [x1 - nx, y1, z1 - nz], [x0 - nx, y0, z0 - nz], [x0 / 3, -z0 / 3], [x1 / 3, -z1 / 3], [x1 / 3, -z1 / 3], [x0 / 3, -z0 / 3], null);
        if (i % 3 === 1 && Math.hypot(x0 - cell.cx, z0 - cell.cz) > 15) bench(x0 + nx * 1.6, z0 + nz * 1.6, y0, Math.atan2(nx, nz) + Math.PI);
      }
    }
    pm.disc(cell.cx, cell.cz, y + 0.055, 12, 28, 3, null);
    fountain(cell.cx, cell.cz, y, pk.big ? 8 : 5.5, pk.big);
  }
  // Stadtplätze
  for (const pz of ROADS.plazas) {
    if (pz.round) { fountain(pz.x, pz.z, pz.round.y + 0.35, 5, false); continue; }
    if (!pz.cell) continue;
    const y = terrainH(pz.cell.cx, pz.cell.cz);
    fountain(pz.cell.cx, pz.cell.cz, y, 9, true);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; bench(pz.cell.cx + Math.cos(a) * 14, pz.cell.cz + Math.sin(a) * 14, y + 0.04, -a - Math.PI / 2); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.26; const x = pz.cell.cx + Math.cos(a) * 30, z = pz.cell.cz + Math.sin(a) * 30; cm.get('stone', x, z).cyl(x, y, z, 1.4, 1.4, 0.55, 16, stone, true); addTree('deciduous', x, z, 0.8); }
  }
  // Piazza: Brunnen
  fountain(WS.PIAZZA.x + 10, WS.PIAZZA.z + 20, WS.VENICE_Y + 0.04, 6, false);
  // ETH-Platz
  const H = WS.HILL;
  // Bushaltestellen-Wartehäuschen
  for (const st of TRANSIT.stops) {
    const sh = st.shelter;
    const y = st.y;
    const mb = cm.get('props', sh.x, sh.z), gm = cm.get('glass', sh.x, sh.z);
    const s = Math.sin(sh.rot), c = Math.cos(sh.rot);
    const P = (lx, lz) => [sh.x + lx * c + lz * s, sh.z - lx * s + lz * c];
    for (const lx of [-2.2, 2.2]) { const p = P(lx, -0.7); mb.box(p[0], y + 1.25, p[1], 0.1, 2.5, 0.1, sh.rot, iron); }
    const r = P(0, 0); mb.box(r[0], y + 2.55, r[1], 5, 0.12, 2.0, sh.rot, lin(0xdcdcd8));
    const g0 = P(0, -0.75); gm.box(g0[0], y + 1.3, g0[1], 4.4, 2.2, 0.04, sh.rot, null);
    const bb = P(0, -0.45); mb.box(bb[0], y + 0.48, bb[1], 3.0, 0.06, 0.4, sh.rot, wood);
    // Haltestellenmast
    const pp = P(2.8, 0.6); mb.box(pp[0], y + 1.5, pp[1], 0.08, 3.0, 0.08, sh.rot, iron);
    NAT.poles.push({ st, x: pp[0], z: pp[1], y, rot: sh.rot });
  }
  // Strand: Schirme und Liegen
  const umbCols = [0xe23b3b, 0x2f7fd8, 0xf2c230, 0x2fae6a, 0xf27a30, 0xffffff].map(c => lin(c));
  for (let z = -2450; z < 2450; z += 13) {
    if (inVeniceZ(z) || waterDist(coastX(z) - 40, z) < 60) continue;
    for (let row = 0; row < 3; row++) {
      if (!chance(0.55)) continue;
      const x = coastX(z) - 22 - row * 12 + rr(-2, 2), zz = z + rr(-3, 3);
      const y = terrainH(x, zz);
      if (y < WS.WATER_Y + 0.3) continue;
      const mb = cm.get('beach', x, zz);
      const col = pick(umbCols);
      mb.cyl(x, y, zz, 0.03, 0.03, 2.3, 6, lin(0xdddddd), false);
      mb.cyl(x, y + 2.0, zz, 1.6, 0.05, 0.5, 12, col, false);
      for (const k of [-0.9, 0.9]) {
        mb.box(x + 0.4, y + 0.3, zz + k, 1.9, 0.08, 0.6, Math.PI / 2, lin(0xf3f0e8));
        mb.box(x - 0.4, y + 0.5, zz + k, 0.5, 0.06, 0.6, Math.PI / 2 + 0, lin(0xf3f0e8));
      }
    }
    // Rettungsturm
    if (Math.abs(z % 400) < 13) {
      const x = coastX(z) - 55, y = terrainH(x, z);
      const mb = cm.get('beach', x, z);
      for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) mb.box(x + dx, y + 1.5, z + dz, 0.15, 3, 0.15, 0, lin(0xf0f0f0));
      mb.box(x, y + 3.2, z, 2.6, 1.4, 2.6, 0, lin(0xe23b3b)); mb.box(x, y + 4.1, z, 3, 0.15, 3, 0, lin(0xffffff));
    }
  }
  // Hotelpools hinter den Luxushotels
  for (const b of BLD.list) {
    if (!b.luxury) continue;
    const back = bLocal(b, 0, -b.d / 2 - 14);
    const y = terrainH(back[0], back[1]) + 0.05;
    const mb = cm.get('deck', back[0], back[1]);
    const pw = Math.min(b.w * 0.6, 30), pd = 9;
    mb.box(back[0], y, back[1], pd + 6, 0.1, pw + 6, 0, lin(0xf2efe8));
    const pm = cm.get('pool', back[0], back[1]);
    pm.flat([back[0] - pd / 2, back[1] + pw / 2], [back[0] + pd / 2, back[1] + pw / 2], [back[0] + pd / 2, back[1] - pw / 2], [back[0] - pd / 2, back[1] - pw / 2], y + 0.08, 2, null);
    for (let k = -pw / 2 + 1.5; k < pw / 2; k += 2.4) { mb.box(back[0] + pd / 2 + 1.8, y + 0.3, back[1] + k, 1.9, 0.1, 0.65, Math.PI / 2, lin(0xffffff)); }
  }
  const matsP = {
    stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
    fwater: waterMat, props: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
    path: new THREE.MeshStandardMaterial({ color: 0xc9b99a, roughness: 0.95, map: MATS.sidewalk.map }),
    glass: MATS.glass, beach: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }),
    deck: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), pool: poolMat
  };
  cm.finish(matsP, scene, { cast: { stone: true, props: true, beach: true } });
  // Schilder an den Haltestellen
  for (const p of NAT.poles) {
    const lines = [...p.st.lines].sort((a, b) => a - b).join(' · ');
    const cv = makeCanvas(256, 128), ctx = cv.getContext('2d');
    ctx.fillStyle = '#0b8f3a'; ctx.beginPath(); ctx.arc(128, 64, 62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(128, 64, 52, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b8f3a'; ctx.font = 'bold 40px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', 128, 50);
    ctx.font = 'bold 18px Arial'; ctx.fillText(lines || 'Bus', 128, 88);
    const tex = canvasTex(cv, { clamp: true });
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
    disc.position.set(p.x, p.y + 3.15, p.z); disc.rotation.y = p.rot + Math.PI / 2;
    scene.add(disc); nearVis(disc, 260);
    const nm = textCanvas(p.st.name, 512, 96, { bg: '#ffffff', fg: '#0b2a4a', font: 'bold 52px Arial' });
    const nmt = canvasTex(nm, { clamp: true });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshStandardMaterial({ map: nmt, side: THREE.DoubleSide }));
    plate.position.set(p.x, p.y + 2.7, p.z); plate.rotation.y = p.rot + Math.PI / 2;
    scene.add(plate); nearVis(plate, 260);
  }
}

/* ---------- Boote ---------- */
function buildBoats(scene) {
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.35, metalness: 0.2 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a1f1f, roughness: 0.6 });
  const yachtMat = new THREE.MeshPhysicalMaterial({ color: 0xf6f6f4, roughness: 0.25, clearcoat: 1 });
  const glassMat = MATS.glass;
  // Gondel-Geometrie
  const gondola = () => {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-5.5, 0.6); shape.quadraticCurveTo(-4, -0.1, 0, -0.2); shape.quadraticCurveTo(4, -0.1, 5.5, 0.9); shape.lineTo(5.2, 0.5); shape.quadraticCurveTo(0, 0.25, -5.2, 0.45); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.3, bevelEnabled: false });
    geo.translate(0, 0, -0.65); geo.rotateY(-Math.PI / 2);
    const hull = new THREE.Mesh(geo, hullMat); g.add(hull);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 1.4), woodMat); seat.position.set(0, 0.35, -0.5); g.add(seat);
    const ferro = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.4), MATS.metalLight); ferro.position.set(0, 1.0, 5.3); g.add(ferro);
    const gond = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.75, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    body.position.y = 1.15; gond.add(body);
    const stripes = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.225, 0.08, 8), new THREE.MeshStandardMaterial({ color: 0x1b2a6b })); stripes.position.y = 1.05; gond.add(stripes);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.2), new THREE.MeshStandardMaterial({ color: 0x111111 })); legs.position.y = 0.4; gond.add(legs);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8a986 })); head.position.y = 1.68; gond.add(head);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0xe8d89a })); hat.position.y = 1.8; gond.add(hat);
    const oar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 3.2), woodMat); oar.position.set(0.3, 1.2, -1.0); oar.rotation.x = 0.5; gond.add(oar);
    gond.position.set(0, 0.2, -4.0); g.add(gond);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  };
  for (const poly of WATER.polys) {
    if (poly.kind !== 'canal') continue;
    const n = poly.id === 1 ? 4 : 1;
    const pts = poly.pts.filter(p => p[0] < coastX(p[1]) - 5);
    if (pts.length < 10) continue;
    for (let k = 0; k < n; k++) {
      const g = gondola();
      scene.add(g); nearVis(g, 600, true);
      NAT.gondolas.push({ g, pts, t: rnd() * pts.length, dir: chance(0.5) ? 1 : -1, speed: rr(1.0, 1.6), lat: rr(-0.4, 0.4) * poly.hw[0] });
    }
  }
  // Jachten vor den Hotels
  const yacht = () => {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-12, 1.2); shape.lineTo(10, 1.2); shape.quadraticCurveTo(13.5, 1.0, 14, 2.6); shape.lineTo(-12, 2.6); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 6, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.4, bevelSegments: 2 });
    geo.translate(0, -1.4, -3); geo.rotateY(Math.PI / 2);
    g.add(new THREE.Mesh(geo, yachtMat));
    const deck = new THREE.Mesh(new THREE.BoxGeometry(5, 2.0, 12), yachtMat); deck.position.set(0, 2.2, -2); g.add(deck);
    const win = new THREE.Mesh(new THREE.BoxGeometry(5.05, 0.8, 11), glassMat); win.position.set(0, 2.4, -2); g.add(win);
    const top = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 6), yachtMat); top.position.set(0, 3.8, -3); g.add(top);
    const win2 = new THREE.Mesh(new THREE.BoxGeometry(4.05, 0.6, 5.5), glassMat); win2.position.set(0, 3.9, -3); g.add(win2);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  };
  for (let z = -2300; z < 2300; z += rr(260, 520)) {
    if (inVeniceZ(z)) continue;
    const g = yacht();
    const x = coastX(z) + rr(90, 260);
    g.position.set(x, WS.WATER_Y, z); g.rotation.y = rr(0, Math.PI * 2);
    scene.add(g); nearVis(g, 1600);
    NAT.boats.push({ g, ph: rnd() * 10 });
  }
}

function updateNature(t, dt) {
  for (const j of NAT.jets) { const k = 1 + Math.sin(t * 3 + j.base) * 0.06; j.m.scale.set(1, k, 1); }
  for (const g of NAT.gondolas) {
    g.t += g.dir * g.speed * dt / 5;
    if (g.t > g.pts.length - 2) { g.t = g.pts.length - 2; g.dir = -1; }
    if (g.t < 1) { g.t = 1; g.dir = 1; }
    const i = Math.floor(g.t), f = g.t - i;
    const a = g.pts[i], b = g.pts[i + 1];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const x = lerp(a[0], b[0], f) + dz * g.lat * g.dir, z = lerp(a[1], b[1], f) - dx * g.lat * g.dir;
    g.g.position.set(x, WS.WATER_Y + 0.05 + Math.sin(t * 1.3 + i) * 0.04, z);
    g.g.rotation.y = Math.atan2(dx * g.dir, dz * g.dir);
    g.g.rotation.z = Math.sin(t * 0.9 + i) * 0.03;
  }
  for (const b of NAT.boats) { b.g.position.y = WS.WATER_Y + Math.sin(t * 0.6 + b.ph) * 0.15; b.g.rotation.z = Math.sin(t * 0.5 + b.ph) * 0.02; }
}
