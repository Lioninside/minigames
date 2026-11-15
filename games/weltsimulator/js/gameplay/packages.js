/* ================= GAMEPLAY: PAKETE =================
   Vereinzelte Pakete liegen in der Welt, bei jedem Spielstart an zufälligen Orten.
   Darüberlaufen sammelt ein (Samen einer Art, Menge zufällig). Ein eingesammeltes Paket
   erscheint nach einiger Zeit an einem neuen Ort. Zwei instanzierte Meshes (Kiste, Lichtsäule). */

const GPP = { list: [], box: null, ribbon: null, beam: null, t: 0, queue: [] };
const _gm4 = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _gv = new THREE.Vector3(), _gs = new THREE.Vector3(), _gup = new THREE.Vector3(0, 1, 0);

function gpPackageSpot() {
  for (let t = 0; t < 60; t++) {
    let x, z;
    if (Math.random() < 0.05) { const a = Math.random() * 6.28, r = Math.random() * (ISLAND.r - 20); x = ISLAND.x + Math.cos(a) * r; z = ISLAND.z + Math.sin(a) * r; }
    else { x = (Math.random() * 2 - 1) * 1880; z = (Math.random() * 2 - 1) * 1880; }
    const y = terrainH(x, z);
    if (y < WS.WATER_Y + 0.3 || waterDist(x, z) < 3 || roadClear(x, z, 3) < 0.6) continue;
    if (BLD.hash.query(x - 2, z - 2, x + 2, z + 2, (b) => obbContains(b.obb, x, z, 1.2))) continue;
    // Inhalt je nach Fundort
    const s = gpSurfaceAt(x, z), r = Math.random();
    let kind;
    if (s === 'island' || coastX(z) - x < 320) kind = r < 0.6 ? 'palm' : r < 0.8 ? 'sun' : 'flower';
    else if (s === 'hill') kind = r < 0.55 ? 'fir' : r < 0.8 ? 'oak' : 'flower';
    else if (s === 'park') kind = r < 0.4 ? 'flower' : r < 0.7 ? 'oak' : r < 0.85 ? 'sun' : 'fir';
    else kind = GP_DATA.order[Math.floor(r * GP_DATA.order.length)];
    const D = GP_DATA.packages;
    const BOX = [0xff2d55, 0xffb300, 0x16c75a, 0x1e88ff, 0xa84dff, 0xff6a00, 0x00c2c7, 0xff4fd8], RIB = [0xffffff, 0xffe14d, 0x00e5ff, 0xff2d55, 0x7cff6b];
    const c1 = BOX[Math.floor(Math.random() * BOX.length)]; let c2 = RIB[Math.floor(Math.random() * RIB.length)]; if (c2 === c1) c2 = 0xffffff;
    return { x, y, z, kind, c1, c2, n: D.min + Math.floor(Math.random() * (D.max - D.min + 1)), ph: Math.random() * 6.28 };
  }
  return null;
}

gpRegister({
  name: 'packages',
  init(scene, surf) {
    const N = GP_DATA.packages.count;
    // Kiste und Band als zwei Instanzlisten: jede mit eigener kräftiger Farbe pro Paket
    const W = lin(0xffffff);
    const mb = new MB(); mb.box(0, 0.36, 0, 0.72, 0.72, 0.72, 0, W);
    const rb = new MB();
    rb.box(0, 0.36, 0, 0.745, 0.745, 0.17, 0, W); rb.box(0, 0.36, 0, 0.17, 0.745, 0.745, 0, W);
    rb.box(0.13, 0.82, 0, 0.3, 0.16, 0.12, 0.5, W); rb.box(-0.13, 0.82, 0, 0.3, 0.16, 0.12, -0.5, W); rb.box(0, 0.77, 0, 0.14, 0.12, 0.14, 0, W);
    const glow = () => { const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.1 });
      // Eigenleuchten in der Paketfarbe: auch im Schatten und nachts gut zu sehen
      m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance += vColor * 0.5;\n#endif'); };
      m.customProgramCacheKey = () => 'gp-glow'; return m; };
    const g = mb.build(); g.deleteAttribute('uv'); const g2 = rb.build(); g2.deleteAttribute('uv');
    GPP.box = new THREE.InstancedMesh(g, glow(), N);
    GPP.ribbon = new THREE.InstancedMesh(g2, glow(), N);
    const bg = new THREE.CylinderGeometry(0.16, 0.3, 16, 8, 1, true); bg.translate(0, 8, 0);
    GPP.beam = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), N);
    for (const m of [GPP.box, GPP.ribbon, GPP.beam]) { m.frustumCulled = false; m.userData.dynamic = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); surf.add(m); }
    GPP.box.castShadow = true; GPP.ribbon.castShadow = true; GPP.beam.renderOrder = 4;
    for (let i = 0; i < N; i++) { const p = gpPackageSpot(); if (p) GPP.list.push(p); }
    this.colors();
  },
  colors() {
    const c = new THREE.Color();
    GPP.list.forEach((p, i) => {
      c.setHex(p.c1).convertSRGBToLinear(); GPP.box.setColorAt(i, c);
      c.setHex(p.c2).convertSRGBToLinear(); GPP.ribbon.setColorAt(i, c);
      c.setHex(GP_DATA.kinds[p.kind].col); GPP.beam.setColorAt(i, c); // Lichtsäule = Samenart
    });
    for (const m of [GPP.box, GPP.ribbon, GPP.beam]) m.instanceColor.needsUpdate = true;
  },
  update(dt) {
    GPP.t += dt;
    const D = GP_DATA.packages, can = GAME.mode === 'world' && !P.ride && !P.underground;
    let got = false;
    for (let i = GPP.list.length - 1; i >= 0; i--) {
      const p = GPP.list[i];
      if (can && Math.abs(p.x - P.x) < D.pickR && Math.abs(p.z - P.z) < D.pickR && Math.abs(P.y - p.y) < 2.5) {
        const d = GP_DATA.kinds[p.kind];
        GP.inv[p.kind] += p.n; GP.stats.packs++; if (!GP.inv[GP.sel]) GP.sel = p.kind;
        gpToast('Paket: +' + p.n + ' ' + d.icon + ' ' + d.label + '-Samen');
        if (typeof sfxDing === 'function') sfxDing();
        GPP.list.splice(i, 1); GPP.queue.push(GPP.t + D.respawn); got = true;
      }
    }
    while (GPP.queue.length && GPP.queue[0] <= GPP.t) { GPP.queue.shift(); const p = gpPackageSpot(); if (p) { GPP.list.push(p); got = true; } }
    if (got) { this.colors(); gpChanged(); }
    // Kisten drehen und schweben
    GPP.list.forEach((p, i) => {
      _gq.setFromAxisAngle(_gup, GPP.t * 1.2 + p.ph);
      _gm4.compose(_gv.set(p.x, p.y + 0.45 + Math.sin(GPP.t * 2 + p.ph) * 0.12, p.z), _gq, _gs.set(1, 1, 1));
      GPP.box.setMatrixAt(i, _gm4); GPP.ribbon.setMatrixAt(i, _gm4);
      _gm4.makeTranslation(p.x, p.y, p.z); GPP.beam.setMatrixAt(i, _gm4);
    });
    for (const m of [GPP.box, GPP.ribbon, GPP.beam]) { m.count = GPP.list.length; m.instanceMatrix.needsUpdate = true; }
  },
  minimap(c, toMini) {
    for (const p of GPP.list) {
      const m = toMini(p.x, p.z); if (!m) continue;
      c.fillStyle = '#' + GP_DATA.kinds[p.kind].col.toString(16).padStart(6, '0'); c.strokeStyle = '#fff'; c.lineWidth = 1.5;
      c.fillRect(m[0] - 3.5, m[1] - 3.5, 7, 7); c.strokeRect(m[0] - 3.5, m[1] - 3.5, 7, 7);
    }
  }
});
