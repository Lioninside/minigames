/* ================= WELTEN-SCHNITTSTELLE =================
   Zusätzliche Welten als eigenständige Module (worlds/<id>/world.js), gebaut von anderen Agenten.
   - worlds/index.js listet die Welten (nur Metadaten, wird beim Start geladen).
   - Auf dem Stadtplatz im Zentrum steht pro Welt ein Tor. Wer hindurchgeht, lädt das Modul
     (einmalig, im Hintergrund) und wechselt in die Welt; ein Rücktor führt zurück.
   - Jede Welt liegt weit ausserhalb der Hauptwelt an einem eigenen Ursprung (ox, oz) und rechnet
     in lokalen Koordinaten. Spieler, Drache, Rakete, Fallschirm, Kamera, Himmel, Tageszeit und
     Pflanzen funktionieren unverändert, weil nur drei Abfragen umgeleitet werden:
     terrainH, groundAt, collideWorld (und gpSurfaceAt fürs Pflanzen).
   Vertrag für Weltmodule: worlds/AGENTS.md. */

const WELT = { index: [], mods: {}, loaded: {}, cur: null, gates: [], cool: 0, busy: false, FIRST: 20000, STEP: 12000 };

function weltRegister(def) { WELT.mods[def.id] = def; }

function weltLoadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Welt nicht ladbar: ' + src)); document.head.appendChild(s); });
}

/* ---------- Tor (Rahmen, leuchtende Fläche, Schild) ---------- */
function weltGate(parent, x, y, z, rot, color, label) {
  const mb = new MB(), c = lin(0x30363c);
  for (const s of [-1.5, 1.5]) mb.box(x + Math.cos(rot) * s, y + 1.9, z - Math.sin(rot) * s, 0.4, 3.8, 0.5, rot, c);
  mb.box(x, y + 3.95, z, 3.8, 0.5, 0.6, rot, c);
  const g = mb.build(); g.deleteAttribute('uv');
  const frame = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.6 }));
  frame.castShadow = true; parent.add(frame);
  const pm = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  pm.position.set(x, y + 1.85, z); pm.rotation.y = rot; pm.userData.dynamic = true; parent.add(pm);
  const rs = SIGNS.add('welt|' + label, 384, 80, (ctx, w, h) => { ctx.fillStyle = '#10202e'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; let f = 40; ctx.font = `bold ${f}px Arial`; while (ctx.measureText(label).width > w - 30 && f > 14) { f -= 2; ctx.font = `bold ${f}px Arial`; } ctx.fillText(label, w / 2, h / 2 + 2); });
  for (const r of [0, Math.PI]) { const sm = signMesh(rs, 'glow', 3.4, 0.7); sm.position.set(x + Math.sin(rot + r) * 0.32, y + 4.75, z + Math.cos(rot + r) * 0.32); sm.rotation.y = rot + r; parent.add(sm); }
  return pm;
}

/* ---------- Start: Tore auf dem Stadtplatz ---------- */
function weltInit(surf) {
  WELT.index = (window.WELT_INDEX || []).slice();
  const pz = ROADS.plazas.find(p => p.kind === 'center');
  const cx = pz ? pz.cell.cx : WS.CENTER.x, cz = pz ? pz.cell.cz : WS.CENTER.z;
  WELT.index.forEach((e, i) => {
    const a = -0.6 + i * 0.5, r = 21.5;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y = terrainH(x, z) + 0.04;
    const rot = Math.atan2(cx - x, cz - z); // Öffnung zeigt zur Platzmitte
    const pm = weltGate(surf, x, y, z, rot, new THREE.Color(e.color || 0x4fc3f7), '→ ' + e.name);
    nearVis(pm, 400);
    e.ox = WELT.FIRST + i * WELT.STEP; e.oz = 0;
    WELT.gates.push({ e, x, y, z, rot, pm });
  });
}

/* ---------- API für Weltmodule (lokale Koordinaten) ---------- */
function weltApi(W) {
  const def = W.def;
  return {
    group: W.group, size: def.size, half: W.half, seaLevel: WS.WATER_Y,
    rng: (() => { let s = (def.seed || 12345) >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(),
    /* Kollision und begehbare Flächen */
    addBox(cx, cz, rot, hw, hd, top, bottom) { const o = { obb: makeOBB(cx, cz, rot, hw, hd), top, bottom }; const b = obbBounds(o.obb, 0.5); W.boxes.insert(o, b[0], b[1], b[2], b[3]); },
    addPole(x, z, r, top, bottom) { W.poles.insert({ x, z, r, top, bottom }, x - r, z - r, x + r, z + r); },
    addDeck(d) { const m = d.hw + 1, x0 = d.ox + d.dx * d.a0, z0 = d.oz + d.dz * d.a0, x1 = d.ox + d.dx * d.a1, z1 = d.oz + d.dz * d.a1; W.decks.insert(d, Math.min(x0, x1) - m, Math.min(z0, z1) - m, Math.max(x0, x1) + m, Math.max(z0, z1) + m); },
    /* Bäume der Hauptwelt (instanziert, mit Wind und Kollision): kind 'deciduous' | 'conifer' | 'palm' */
    addTree(kind, x, z, s) { W.trees.push({ kind, x, z, s: s || 1 }); },
    /* Gelände-Mesh aus def.height; color(x, z, y, steil) → Hex-Farbe (optional) */
    buildTerrain(opts) {
      opts = opts || {};
      const seg = opts.seg || 128, g = new THREE.PlaneGeometry(def.size, def.size, seg, seg); g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) pos.setY(i, def.height(pos.getX(i), pos.getZ(i)));
      g.computeVertexNormals();
      const nor = g.attributes.normal;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i), steep = 1 - nor.getY(i);
        const hex = opts.color ? opts.color(pos.getX(i), pos.getZ(i), y, steep) : (y < WS.WATER_Y + 0.6 ? 0xd9c79a : steep > 0.22 ? 0x7f786c : y > 120 ? 0xe8ecef : 0x5b8636);
        c.setHex(hex).convertSRGBToLinear(); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const base = (typeof TERRAIN !== 'undefined' && TERRAIN.mesh) ? TERRAIN.mesh.material : null;
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: base ? base.map : null }));
      if (m.material.map) { g.attributes.uv.array.forEach((v, i, a) => { a[i] = v * def.size / 9; }); }
      m.receiveShadow = true; W.group.add(m);
      return m;
    },
    /* Wasserfläche auf Meereshöhe über die ganze Welt (plus Rand) */
    addWater(color) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(def.size * 3, def.size * 3), new THREE.MeshStandardMaterial({ color: color || 0x3a8fb0, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.86 }));
      m.rotation.x = -Math.PI / 2; m.position.y = WS.WATER_Y; W.group.add(m); return m;
    },
    toast(t) { if (typeof gpToast === 'function') gpToast(t); }
  };
}

/* ---------- Welt bauen (einmal) ---------- */
function weltBuild(e) {
  const def = WELT.mods[e.id];
  if (!def) throw new Error('Welt ' + e.id + ' hat sich nicht registriert (weltRegister fehlt)');
  const W = { def, e, ox: e.ox, oz: e.oz, half: def.size / 2, group: new THREE.Group(), boxes: new SHash(30), poles: new SHash(20), decks: new SHash(40), trees: [], buildMs: 0 };
  W.group.position.set(W.ox, 0, W.oz); W.group.name = 'welt:' + def.id;
  W.h = (x, z) => { const lx = x - W.ox, lz = z - W.oz; return (Math.abs(lx) > W.half || Math.abs(lz) > W.half) ? -8 : def.height(lx, lz); };
  W.surface = (x, z) => { const lx = x - W.ox, lz = z - W.oz; if (Math.abs(lx) > W.half - 2 || Math.abs(lz) > W.half - 2 || def.height(lx, lz) < WS.WATER_Y + 0.25) return null; if (W.boxes.query(lx - 1, lz - 1, lx + 1, lz + 1, (b) => obbContains(b.obb, lx, lz, 0.3))) return null; return def.surfaceAt ? def.surfaceAt(lx, lz) : 'meadow'; };
  const api = W.api = weltApi(W);
  const t0 = performance.now();
  def.build(api);
  // Bäume als Instanzlisten
  if (W.trees.length && NAT.treeBuild) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const grp of NAT.treeBuild.groups) {
      const list = W.trees.filter(t => t.kind === grp.name); if (!list.length) continue;
      for (const [geo, mat, colored] of grp.parts) {
        const im = new THREE.InstancedMesh(geo.clone(), mat, list.length);
        list.forEach((t, i) => {
          const y = def.height(t.x, t.z); q.setFromAxisAngle(up, hash2i(t.x * 3 | 0, t.z * 3 | 0) * 6.28); m4.compose(v.set(t.x, y - 0.1, t.z), q, sc.set(t.s, t.s * (0.9 + 0.2 * hash2i(t.x | 0, t.z | 0)), t.s)); im.setMatrixAt(i, m4);
          if (colored && grp.cols) im.setColorAt(i, grp.cols[Math.floor(hash2i(i, t.x | 0) * grp.cols.length)]);
        });
        im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; im.userData.dynamic = true; W.group.add(im);
      }
    }
    for (const t of W.trees) api.addPole(t.x, t.z, 0.35 * t.s, def.height(t.x, t.z) + 4);
  }
  // Rücktor hinter dem Startpunkt
  const sp = def.spawn, by = sp.yaw || 0;
  const gx = sp.x + Math.sin(by) * 5, gz = sp.z + Math.cos(by) * 5;
  weltGate(W.group, gx, def.height(gx, gz) + 0.04, gz, by, new THREE.Color(0xffc857), '← Neu-Zürich');
  W.back = { x: gx, z: gz };
  W.buildMs = Math.round(performance.now() - t0);
  WORLD.scene.add(W.group);
  WELT.loaded[e.id] = W;
  return W;
}

/* ---------- Betreten und Verlassen ---------- */
async function weltEnter(id) {
  const e = WELT.index.find(q => q.id === id); if (!e || WELT.busy) return null;
  WELT.busy = true;
  try {
    if (!WELT.mods[id]) { if (typeof gpToast === 'function') gpToast('Welt „' + e.name + '“ wird geladen …'); await weltLoadScript(e.file); }
    const W = WELT.loaded[id] || weltBuild(e);
    const sp = W.def.spawn;
    WELT.cur = W;
    P.x = W.ox + sp.x; P.z = W.oz + sp.z; P.y = W.def.height(sp.x, sp.z) + 0.05; P.vy = 0; P.yaw = sp.yaw || 0; P.pitch = 0;
    P.ride = null; P.rocket = false; P.chute = false; P.underground = false; P.onGround = true;
    WELT.cool = 1.5;
    if (typeof gpToast === 'function') gpToast('Willkommen in „' + W.def.name + '“');
    return W;
  } finally { WELT.busy = false; }
}
function weltLeave() {
  const W = WELT.cur; if (!W) return;
  const g = WELT.gates.find(q => q.e.id === W.def.id);
  WELT.cur = null;
  P.x = g.x + Math.sin(g.rot) * 4; P.z = g.z + Math.cos(g.rot) * 4; P.y = groundAt(P.x, P.z, terrainH(P.x, P.z) + 2); P.vy = 0; P.yaw = g.rot + Math.PI;
  P.rocket = false; P.chute = false; WELT.cool = 1.5;
}

/* ---------- pro Bild ---------- */
function weltUpdate(dt) {
  if (WELT.cool > 0) WELT.cool -= dt;
  const W = WELT.cur;
  for (const id in WELT.loaded) WELT.loaded[id].group.visible = WELT.loaded[id] === W;
  if (GAME.mode !== 'world' || P.ride) return;
  if (!W) {
    if (WELT.cool > 0 || WELT.busy) return;
    for (const g of WELT.gates) if (Math.abs(P.x - g.x) < 1.3 && Math.abs(P.z - g.z) < 1.3 && Math.abs(P.y - g.y) < 3) { weltEnter(g.e.id).catch(err => { console.error(err); if (typeof gpToast === 'function') gpToast('Welt konnte nicht geladen werden.'); WELT.cool = 3; }); break; }
    return;
  }
  const lx = P.x - W.ox, lz = P.z - W.oz;
  if (WELT.cool <= 0 && Math.abs(lx - W.back.x) < 1.3 && Math.abs(lz - W.back.z) < 1.3 && P.y - W.def.height(W.back.x, W.back.z) < 3) { weltLeave(); return; }
  if (W.def.update) W.def.update(dt, W.api, { x: lx, y: P.y, z: lz });
}

/* ---------- umgeleitete Abfragen (aus player.js) ---------- */
function weltGround(x, z, y) {
  const W = WELT.cur, lx = x - W.ox, lz = z - W.oz;
  const t = W.h(x, z);
  let g = -50;
  const cand = (h) => { if (h <= y + STEP && h > g) g = h; };
  cand(t);
  W.decks.query(lx - 0.5, lz - 0.5, lx + 0.5, lz + 0.5, (d) => { const rx = lx - d.ox, rz = lz - d.oz, a = rx * d.dx + rz * d.dz, q = rx * d.dz - rz * d.dx; if (a < d.a0 || a > d.a1 || Math.abs(q) > d.hw + 0.05) return; cand(d.h(a)); });
  W.boxes.query(lx - 0.5, lz - 0.5, lx + 0.5, lz + 0.5, (b) => { if (b.bottom === undefined && obbContains(b.obb, lx, lz, 0)) cand(b.top); });
  return g === -50 ? t : g;
}
function weltCollide(x, z, y, px, pz) {
  const W = WELT.cur; let lx = x - W.ox, lz = z - W.oz;
  W.boxes.query(lx - 1.5, lz - 1.5, lx + 1.5, lz + 1.5, (b) => {
    if (b.bottom !== undefined ? (y + 1.75 < b.bottom || y >= b.top - 0.1) : y + STEP >= b.top) return;
    const p = obbPushCircle(b.obb, lx, lz, PR); if (p) { lx = p[0]; lz = p[1]; }
  });
  W.poles.query(lx - 1, lz - 1, lx + 1, lz + 1, (o) => {
    if (y + STEP >= o.top || (o.bottom !== undefined && y + 1.7 < o.bottom)) return;
    const dx = lx - o.x, dz = lz - o.z, d = Math.hypot(dx, dz), r = o.r + PR;
    if (d < r && d > 1e-4) { lx = o.x + dx / d * r; lz = o.z + dz / d * r; }
  });
  const m = W.half - 3;
  return [W.ox + clamp(lx, -m, m), W.oz + clamp(lz, -m, m)];
}
