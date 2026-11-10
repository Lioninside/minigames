/* ================= ASSETS: GEMEINSAMER KERN =================
   Jedes Fahrzeug-Asset (Bus, Tram, U-Bahn-Wagen) wird einmal gebaut und liefert:
     - Spieldaten: len, hw, floorY, roofY, doors [{zc, half, side}]
     - drei Detailstufen: near (mit Innenraum), mid (ohne Innenraum), far (ein Kasten)
     - Türflügel, zusammengefasst je Seite und Öffnungsrichtung (ein Mesh pro Gruppe)
   Gleich aussehende Teile teilen sich über Vertexfarben ein Material, statt je ein eigenes
   zu haben. Dadurch sinken die Draw-Calls pro Fahrzeug von rund 30 auf etwa 5–11 (nah)
   bzw. 1 (fern). Autos und Fussgänger: siehe car.js und pedestrian.js. */

const ASSETS = { list: {}, mats: null };

/* ---------- Materialien (für alle Assets gemeinsam) ---------- */
function initAssetMats() {
  if (ASSETS.mats) return ASSETS.mats;
  const fab = makeCanvas(64, 64); { const ctx = fab.getContext('2d'); ctx.fillStyle = '#26467f'; ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 300; i++) { ctx.fillStyle = pick(['#d23b3b', '#f2c94c', '#3a6fc4', '#1a2f5a']); ctx.fillRect(rnd() * 64, rnd() * 64, 2, 2); } }
  const moq = makeCanvas(64, 64); { const ctx = moq.getContext('2d'); ctx.fillStyle = '#7a1b2a'; ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#e5b33b'; ctx.lineWidth = 3; for (let i = -64; i < 128; i += 16) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 64, 64); ctx.stroke(); }
    ctx.strokeStyle = '#1f6fb2'; for (let i = -64; i < 128; i += 16) { ctx.beginPath(); ctx.moveTo(i + 8, 64); ctx.lineTo(i + 72, 0); ctx.stroke(); } }
  const ft = canvasTex(fab); ft.repeat.set(2, 2);
  const mt = canvasTex(moq); mt.repeat.set(3, 1);
  const light = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.4 });
  // Leuchtfarbe pro Vertex (Scheinwerfer weiss, Rücklicht rot, Innenlicht warm)
  light.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor;\n#endif'); };
  ASSETS.mats = {
    paint: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.12 }),
    matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.2 }),
    mid: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.15 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x1f3540, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.3, depthWrite: false, envMapIntensity: 1.6 }),
    light,
    seat: new THREE.MeshStandardMaterial({ map: ft, roughness: 0.9 }),
    moquette: new THREE.MeshStandardMaterial({ map: mt, roughness: 0.9 })
  };
  return ASSETS.mats;
}

/* Nachtbeleuchtung (wird von der Spielschleife gesetzt) */
function setAssetNight(n) { if (ASSETS.mats) ASSETS.mats.light.emissiveIntensity = 0.6 + n * 1.6; }

/* ---------- Teile-Schlüssel -> Ziel (Slot) und Farbe ----------
   Slot: paint (Lack), matte, glass, light, iMatte/iSeat/iMoq/iLight (Innenraum, nur Stufe „nah“) */
const ASSET_KEYS = {
  white: ['paint', 0xf1f1ee], blue: ['paint', 0x1d55a8],
  tramBlue: ['paint', 0x1b5db5], tramCream: ['paint', 0xf3efe3],
  tubeRed: ['paint', 0xd2131b], tubeBlue: ['paint', 0x173c8c], tubeWhite: ['paint', 0xe6e8ea], tubeGray: ['matte', 0x5f656b],
  glass: ['glass', 0xffffff], trim: ['matte', 0x18191b], rubber: ['matte', 0x121212], hub: ['matte', 0xbfc3c7], steel: ['matte', 0xaab0b6],
  head: ['light', 0xfffbe8], tail: ['light', 0xff1a1a],
  seat: ['iSeat', 0xffffff], moquette: ['iMoq', 0xffffff], floor: ['iMatte', 0x4a4d52], pole: ['iMatte', 0xf2c200],
  ilight: ['iLight', 0xfff3df], wall: ['iMatte', 0xe9e6dc], iTrim: ['iMatte', 0x18191b]
};

/* Proxy auf einen Slot-Baukasten mit fester Farbe (gleiche Methoden wie MB) */
class SlotMB {
  constructor(target, col) { this.t = target; this.col = col; }
  box(cx, cy, cz, sx, sy, sz, rot, _c, uvs, skipBottom) { this.t.box(cx, cy, cz, sx, sy, sz, rot, this.col, uvs, skipBottom); }
  cyl(cx, cy, cz, r0, r1, h, seg, _c, caps) { this.t.cyl(cx, cy, cz, r0, r1, h, seg, this.col, caps); }
  quad(a, b, c, d, uv, _c, nrm) { this.t.quad(a, b, c, d, uv, this.col, nrm); }
  addGeom(g, m) { this.t.addGeom(g, m, this.col); }
  empty() { return this.t.empty(); }
}
/* Baukasten-Sammlung: asset.k.white.box(...) schreibt in den Lack-Slot mit weisser Farbe */
function assetSlots() {
  const slots = {};
  const proxies = {};
  return new Proxy(proxies, {
    get(o, key) {
      if (key === '__slots') return slots;
      if (!o[key]) {
        const def = ASSET_KEYS[key];
        if (!def) throw new Error('Unbekannter Asset-Teil: ' + String(key));
        const [slot, hex] = def;
        if (!slots[slot]) slots[slot] = new MB();
        o[key] = new SlotMB(slots[slot], lin(hex));
      }
      return o[key];
    }
  });
}

function wheelGeo(r, w) { const g = new THREE.CylinderGeometry(r, r, w, 18); g.rotateZ(Math.PI / 2); return g; }

/* Geometrie mit Matrix übernehmen; bei Spiegelung (Determinante < 0) Dreiecke umdrehen */
function addGeomOriented(mb, g, m, col) {
  const start = mb.idx.length;
  mb.addGeom(g, m, col);
  if (m.determinant() < 0) for (let i = start; i < mb.idx.length; i += 3) { const t = mb.idx[i + 1]; mb.idx[i + 1] = mb.idx[i + 2]; mb.idx[i + 2] = t; }
}

/* Mehrere Baukästen zu einer Geometrie zusammenfügen */
function mergeMBs(list) {
  const out = new MB();
  for (const mb of list) {
    if (!mb || mb.empty()) continue;
    const base = out.vc;
    for (let i = 0; i < mb.p.length; i++) out.p.push(mb.p[i]);
    for (let i = 0; i < mb.n.length; i++) out.n.push(mb.n[i]);
    for (let i = 0; i < mb.uv.length; i++) out.uv.push(mb.uv[i]);
    for (let i = 0; i < mb.c.length; i++) out.c.push(mb.c[i]);
    for (let i = 0; i < mb.idx.length; i++) out.idx.push(mb.idx[i] + base);
    out.vc += mb.vc;
  }
  return out;
}

/* Fernversion: Kasten mit unterer Hälfte, dunklem Fensterband und Dach (ein Mesh) */
function farBoxMB(len, hw, spec) {
  const mb = new MB();
  const y0 = spec.base || 0.35, y1 = spec.band0, y2 = spec.band1, y3 = spec.top;
  mb.box(0, (y0 + y1) / 2, 0, hw * 2, y1 - y0, len, 0, lin(spec.lower), null, true);
  mb.box(0, (y1 + y2) / 2, 0, hw * 2 - 0.02, y2 - y1, len - 0.02, 0, lin(0x23313b), null, true);
  mb.box(0, (y2 + y3) / 2, 0, hw * 2, y3 - y2, len, 0, lin(spec.upper), null, false);
  if (spec.wheels) mb.box(0, y0 / 2, 0, hw * 2 - 0.3, y0, len * 0.8, 0, lin(0x151515), null, true);
  return mb;
}

/* Fertigstellen: aus Slots die drei Stufen und die Türgruppen bauen */
function finishAsset(name, k, data, leaf) {
  initAssetMats();
  const S = k.__slots;
  const M = ASSETS.mats;
  const geo = (mb) => (mb && !mb.empty()) ? mb.build() : null;
  const near = [], mid = [];
  const push = (arr, g, mat, key) => { if (g) arr.push({ geo: g, mat, key }); };
  push(near, geo(S.paint), M.paint, 'paint');
  push(near, geo(mergeMBs([S.matte, S.iMatte])), M.matte, 'matte');
  push(near, geo(S.glass), M.glass, 'glass');
  push(near, geo(mergeMBs([S.light, S.iLight])), M.light, 'light');
  push(near, geo(S.iSeat), M.seat, 'seat');
  push(near, geo(S.iMoq), M.moquette, 'moquette');
  push(mid, geo(mergeMBs([S.paint, S.matte])), M.mid, 'body');
  push(mid, geo(S.glass), M.glass, 'glass');
  push(mid, geo(S.light), M.light, 'light');
  const far = [{ geo: farBoxMB(data.len, data.hw, data.far).build(), mat: M.mid, key: 'far' }];
  // Türflügel: je (Seite, Richtung) ein Rahmen- und ein Glas-Mesh, in geschlossener Lage
  const doorGroups = [];
  const leafCol = lin(leaf.color);
  for (const side of [1, -1]) for (const dir of [1, -1]) {
    const ds = data.doors.filter(d => d.side === side);
    if (!ds.length) continue;
    const fr = new MB(), gl = new MB();
    for (const d of ds) {
      const m = new THREE.Matrix4().makeTranslation(side * leaf.x, 0, d.zc + dir * 0.02).multiply(new THREE.Matrix4().makeScale(1, 1, dir));
      addGeomOriented(fr, leaf.frame, m, leafCol);
      if (leaf.panel) addGeomOriented(fr, leaf.panel, m, leafCol);
      addGeomOriented(gl, leaf.glass, m, null);
    }
    doorGroups.push({ side, dir, frame: fr.build(), glass: gl.build() });
  }
  const asset = Object.assign({}, data, { name, near, mid, far, doorGroups, leafW: leaf.w, farSpec: data.far });
  asset.stats = assetStats(asset);
  ASSETS.list[name] = asset;
  return asset;
}

function triCount(g) { return (g.index ? g.index.count : g.attributes.position.count) / 3; }
function assetStats(a) {
  const s = {};
  for (const lv of ['near', 'mid', 'far']) {
    let tris = 0, calls = 0;
    for (const p of a[lv]) { tris += triCount(p.geo); calls++; }
    if (lv !== 'far') for (const d of a.doorGroups) { tris += triCount(d.frame); calls++; if (lv === 'near') { tris += triCount(d.glass); calls++; } }
    s[lv] = { tris: Math.round(tris), calls };
  }
  return s;
}

/* ---------- Instanz eines Fahrzeug-Assets ----------
   Liefert eine Gruppe mit den drei Stufen; setLOD() schaltet um, setDoors() bewegt die Türen. */
function instantiateAsset(a, opts) {
  opts = opts || {};
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const lv = { near: new THREE.Group(), mid: new THREE.Group(), far: new THREE.Group() };
  for (const k in lv) {
    for (const p of a[k]) {
      const m = new THREE.Mesh(p.geo, p.mat);
      m.castShadow = p.key !== 'glass' && p.key !== 'light';
      m.receiveShadow = k === 'near';
      lv[k].add(m);
    }
    g.add(lv[k]);
  }
  const doors = [];
  for (const d of a.doorGroups) {
    const dn = new THREE.Group(), dm = new THREE.Group();
    const f1 = new THREE.Mesh(d.frame, ASSETS.mats.matte); f1.castShadow = true; dn.add(f1);
    dn.add(new THREE.Mesh(d.glass, ASSETS.mats.glass));
    dm.add(new THREE.Mesh(d.frame, ASSETS.mats.mid));
    lv.near.add(dn); lv.mid.add(dm);
    doors.push({ side: d.side, dir: d.dir, groups: [dn, dm] });
  }
  // Zielanzeigen
  if (opts.signMat && a.signs) {
    for (const s of a.signs) {
      if (s.frontOnly && !opts.front) continue;
      for (const k of ['near', 'mid']) {
        const sm = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), opts.signMat);
        sm.position.set(s.x, s.y, s.z); sm.rotation.y = s.ry || 0;
        lv[k].add(sm);
      }
    }
  }
  const inst = {
    g, lv, doors, level: '',
    setLOD(level) {
      if (level === this.level) return;
      this.level = level;
      for (const k in lv) lv[k].visible = k === level;
    },
    setDoors(open, side) {
      for (const d of doors) {
        const o = d.side === side ? open : 0;
        for (const grp of d.groups) grp.position.set(d.side * o * 0.06, 0, d.dir * o * a.leafW * 0.95);
      }
    }
  };
  inst.setLOD(opts.level || 'near');
  return inst;
}

/* Zielanzeige als Textur */
function destTex(num, dest, color) {
  const cv = makeCanvas(512, 64), ctx = cv.getContext('2d');
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = color || '#ffb300'; ctx.font = 'bold 44px Arial'; ctx.textBaseline = 'middle';
  ctx.fillText(String(num), 14, 34);
  ctx.fillStyle = '#ffb300'; let fs = 38; ctx.font = `bold ${fs}px Arial`;
  while (ctx.measureText(dest).width > 380 && fs > 14) { fs -= 2; ctx.font = `bold ${fs}px Arial`; }
  ctx.fillText(dest, 110, 34);
  const t = canvasTex(cv, { clamp: true });
  return new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.0, map: t });
}

/* Detailstufe nach Entfernung (Grafikstufe skaliert die Grenzen) */
function vehicleLODLevel(dist, riding) {
  if (riding) return 'near';
  const f = (typeof QUALITY !== 'undefined' && QUALITY.cur && QUALITY.cur.vehScale) || 1;
  if (dist < 60 * f) return 'near';
  if (dist < 200 * f) return 'mid';
  return 'far';
}
