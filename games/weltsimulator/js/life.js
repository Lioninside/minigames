/* ================= LEBEN IN DER STADT =================
   Alles, was die Welt belebt, ohne die Bildrate zu drücken:
   - Leute, die etwas tun: warten an Bus-, Tram- und U-Bahn-Haltestellen, sitzen auf Bänken,
     in Cafés auf der Piazza, stehen am Strand, plaudern in Gruppen. Hält ein Fahrzeug,
     steigen Wartende ein und andere aus. Wie viele unterwegs sind, hängt von der Uhrzeit ab.
     Gezeichnet werden sie mit der animierten Menge (js/assets/crowd.js, 1 Draw-Call),
     weiter weg als einfache Figuren der bestehenden Fussgänger-Menge.
   - Vögel: Möwen über dem Strand, Schwärme über der Stadt (Bahn komplett im Shader),
     Tauben auf der Piazza, die auffliegen, wenn man ihnen zu nahe kommt.
   - Wasser: Motorboote auf dem Fluss, ein Ausflugsschiff vor der Küste.
   - Fahnen vor den Luxushotels und der ETH (Wehen im Shader).
   Gesucht wird nur in einem Raster um die Kamera; ferne Bereiche kosten nichts. */

const LIFE = {
  on: true, sk: null, people: [], grid: new Map(), byStop: new Map(), temps: [], t: 0,
  birds: null, pigeons: [], pigeonMesh: null, boats: [], flags: null, cafes: null, stats: { near: 0, far: 0 }
};
const LCELL = 100;
const _lm4 = new THREE.Matrix4(), _lq = new THREE.Quaternion(), _lv = new THREE.Vector3(), _ls = new THREE.Vector3(), _lup = new THREE.Vector3(0, 1, 0), _le = new THREE.Euler();

function lifeHash(i, k) { return hash2i(i * 13 + 7, k); }
function bump(x, c, w) { const d = (x - c) / w; return Math.max(0, 1 - d * d); }

/* Anteil der Leute je Art und Uhrzeit */
function lifeDensity(kind, h) {
  const day = smooth(6, 9, h) * (1 - smooth(20, 23.5, h));
  const rush = Math.max(bump(h, 7.8, 1.4), bump(h, 17.5, 1.7));
  switch (kind) {
    case 'stop': return 0.1 + 0.45 * day + 0.4 * rush;
    case 'metro': return 0.12 + 0.4 * day + 0.45 * rush;
    case 'bench': return 0.04 + 0.6 * day * (1 - 0.3 * rush);
    case 'cafe': return 0.06 + 0.5 * day + 0.35 * bump(h, 19.5, 2.6);
    case 'beach': return 0.8 * smooth(8.5, 11, h) * (1 - smooth(18.5, 20.5, h));
    case 'stroll': return 0.05 + 0.4 * day + 0.3 * smooth(9, 11, h) * (1 - smooth(18, 21, h));
    default: return 0.06 + 0.5 * day + 0.25 * bump(h, 21, 2);
  }
}

/* ---------- Erzeugung ---------- */
function lifeAdd(p) {
  p.i = LIFE.people.length;
  p.u = lifeHash(p.i, 5);
  p.ph = lifeHash(p.i, 9) * 10;
  p.look = crowdLook(p.i * 3 + 101);
  p.st = 'idle'; p.hx = p.x; p.hz = p.z; p.hyaw = p.yaw;
  LIFE.people.push(p);
  const k = Math.floor(p.x / LCELL) + '|' + Math.floor(p.z / LCELL);
  let a = LIFE.grid.get(k); if (!a) { a = []; LIFE.grid.set(k, a); } a.push(p);
  if (p.key) { let b = LIFE.byStop.get(p.key); if (!b) { b = []; LIFE.byStop.set(p.key, b); } b.push(p); }
  return p;
}
const yawOf = (dx, dz) => Math.atan2(dx, dz);

function initLife(surf, scene) {
  // Bushaltestellen: auf der Bank im Häuschen sitzen, daneben stehen; Blick zur Strasse
  for (const st of TRANSIT.stops) {
    const sh = st.shelter; if (!sh) continue;
    const s = Math.sin(sh.rot), c = Math.cos(sh.rot);
    const Pt = (lx, lz) => [sh.x + lx * c + lz * s, sh.z - lx * s + lz * c];
    for (const lx of [-0.95, 0.15, 1.1]) { const p = Pt(lx, -0.4); lifeAdd({ kind: 'stop', x: p[0], z: p[1], yaw: sh.rot, sit: true, seatY: st.y + 0.51, yHint: st.y, key: st }); }
    for (const [lx, lz] of [[-3.3, 0.5], [-2.3, 1.1], [1.7, 1.0], [3.5, 0.2], [0.1, 1.35]]) { const p = Pt(lx, lz); lifeAdd({ kind: 'stop', x: p[0], z: p[1], yaw: sh.rot + (lifeHash(lx * 10 | 0, lz * 10 | 0) - 0.5) * 0.8, yHint: st.y, key: st }); }
  }
  // Tram-Perrons
  for (const T of [TRANSIT.tram, TRANSIT.tram18]) if (T) for (const pl of T.platforms) {
    const yaw = yawOf(-pl.rx, -pl.rz), y = pl.y + 0.32;
    for (const k of [-9, -6.5, -4, -2.2, 2.4, 4.5, 7, 9.5]) lifeAdd({ kind: 'stop', x: pl.x + pl.dx * k + pl.rx * 0.15, z: pl.z + pl.dz * k + pl.rz * 0.15, y, yaw: yaw + (lifeHash(k * 10 | 0, 3) - 0.5) * 0.7, key: pl.stop });
    for (const k of [-0.7, 0.6]) lifeAdd({ kind: 'stop', x: pl.x - pl.rx * 0.25 + pl.dx * k, z: pl.z - pl.rz * 0.25 + pl.dz * k, yaw, sit: true, seatY: pl.y + 0.80, key: pl.stop });
  }
  // U-Bahn-Perrons (Mittelperron, Blick zum Gleis)
  for (const st of TRANSIT.stations) {
    const cr = Math.cos(st.rot), sr = Math.sin(st.rot);
    const W = (lx, lz) => [st.x + lx * cr + lz * sr, st.z - lx * sr + lz * cr];
    for (let lz = -56; lz <= 56; lz += 6.5) for (const sg of [1, -1]) {
      const j = lifeHash(lz + 100, sg + 5);
      const lx = sg * (3.3 + j * 0.6), p = W(lx, lz + (j - 0.5) * 3);
      lifeAdd({ kind: 'metro', x: p[0], z: p[1], y: st.platY, yaw: yawOf(cr * sg, -sr * sg) + (j - 0.5) * 0.9, ug: true, key: st });
    }
  }
  // Parkbänke
  for (const b of NAT.benches) {
    const s = Math.sin(b.rot), c = Math.cos(b.rot);
    for (const lx of [-0.45, 0.45]) lifeAdd({ kind: 'bench', x: b.x + c * lx + s * 0.06, z: b.z - s * lx + c * 0.06, yaw: b.rot, sit: true, seatY: b.seatY });
  }
  // Cafés auf der Piazza (Tische, Stühle, Schirme als ein Mesh)
  buildCafes(surf);
  // Strand: bei den Schirmen stehen, aufs Meer schauen
  NAT.umbrellas.forEach((u, i) => {
    const n = lifeHash(i, 1) < 0.5 ? 1 : 2;
    for (let k = 0; k < n; k++) lifeAdd({ kind: 'beach', x: u.x + 1.6 + k * 0.4, z: u.z + (k ? 0.75 : -0.6), yaw: Math.PI / 2 + (lifeHash(i, k + 2) - 0.5) * 1.2, yHint: u.y });
  });
  // Spaziergänger am Strand (hin und her, nur tagsüber)
  for (let z = -2300; z < 2400; z += 130) {
    if (z > -1250 && z < -350) continue;
    const x = coastX(z) - 12;
    if (waterDist(x, z) < 6 || terrainH(x, z) < WS.WATER_Y + 0.3) continue;
    for (let k = 0; k < 2; k++) lifeAdd({ kind: 'stroll', x: x - k * 0.7, z: z + k * 0.2, yaw: 0, stroll: { z0: z, len: 70, v: 1.1, off: lifeHash(z | 0, 4) * 140, lat: -k * 0.7 } });
  }
  // Gruppen auf Plätzen, vor Hotels und vor der ETH
  const group = (gx, gz, n, key) => {
    const a0 = lifeHash(gx | 0, gz | 0) * 6.28;
    for (let i = 0; i < n; i++) {
      const a = a0 + i / n * Math.PI * 2, r = n === 2 ? 0.55 : 0.8;
      lifeAdd({ kind: 'group', x: gx + Math.cos(a) * r, z: gz + Math.sin(a) * r, yaw: yawOf(-Math.cos(a), -Math.sin(a)) });
    }
  };
  for (const pz of ROADS.plazas) {
    if (!pz.cell) continue;
    for (let k = 0; k < 4; k++) { const a = k * 1.7 + 0.4, r = 17 + k * 2.5; group(pz.cell.cx + Math.cos(a) * r, pz.cell.cz + Math.sin(a) * r, 2 + (k % 3)); }
  }
  for (const b of BLD.list) {
    if (!(b.luxury || b.cat === 'eth') || !b.door) continue;
    let ox = b.door.ox - b.door.x, oz = b.door.oz - b.door.z; const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l;
    const n = b.cat === 'eth' ? 5 : 1;
    for (let k = 0; k < n; k++) { const side = (k - (n - 1) / 2) * 9, out = b.cat === 'eth' ? 14 + (k % 2) * 6 : 9; group(b.door.x + ox * out - oz * side, b.door.z + oz * out + ox * side, 2 + (k % 3)); }
  }
  const PZ = WS.PIAZZA;
  for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.3, r = 16 + (k % 3) * 7; group(PZ.x + 10 + Math.cos(a) * r, PZ.z + 20 + Math.sin(a) * r, 2 + (k % 3)); }
  // Spaziergänger auf der Piazza
  for (let k = 0; k < 4; k++) lifeAdd({ kind: 'stroll', x: PZ.x - 18 + k * 12, z: PZ.z, yaw: 0, stroll: { z0: PZ.z - 10, len: 55, v: 1.0, off: k * 37, lat: 0 } });
  // S-Bahn- und IR-Perrons: Wartende entlang der Bahnsteige (Blick zum Gleis)
  for (const st of RAIL.stations) {
    if (!st.platforms) continue;
    const F = railStationFrame(st), py = st.y + RL.PLH;
    for (const pl of st.platforms) {
      const step = st.hub ? 4.5 : 8;
      for (let a = -st.PL / 2 + 6; a < st.PL / 2 - 6; a += step) {
        const j = lifeHash((a * 10) | 0, (st.x | 0) + pl.s);
        const q = pl.s * (pl.lat + (j - 0.5) * 1.6);
        const p = F.W(a + (j - 0.5) * 2, q);
        const fx = -pl.s * F.l[0], fz = -pl.s * F.l[1];
        lifeAdd({ kind: 'stop', x: p[0], z: p[1], y: py, yaw: Math.atan2(fx, fz) + (j - 0.5) * 1.2, key: st });
      }
    }
  }
  // Knoten Hönggerberg: Busbahnhof, Gruppen bei den Liften, Passanten im Fussgängertunnel
  if (TRANSIT.busHub && typeof hubBusTerminal === 'function') {
    const bt = hubBusTerminal(), c = Math.cos(bt.rot), s = Math.sin(bt.rot);
    for (let k = 0; k < 26; k++) { const a = -14 + k * 1.1, q = ((k * 7) % 5 - 2) * 0.8; lifeAdd({ kind: 'stop', x: bt.x + a * s + q * c, z: bt.z + a * c - q * s, yaw: bt.rot + Math.PI / 2 + (lifeHash(k, 3) - 0.5) }); }
  }
  for (const o of LIFTS.list) {
    if (!o.hub) continue;
    const gl = o.levels.find(l => l.ground); if (!gl) continue;
    const a = lifeHash(o.id, 1) * 6.28; group(o.x + Math.cos(a) * 7, o.z + Math.sin(a) * 7, 2 + (o.id % 3));
  }
  for (const sg of HUBT.segs) {
    const dx = sg.bx - sg.ax, dz = sg.bz - sg.az, len = Math.hypot(dx, dz);
    if (len < 16) continue;
    for (let a = 6; a < len - 6; a += 22) {
      const L2 = Math.min(50, len - a - 3), lat = (lifeHash(a | 0, len | 0) - 0.5) * 2.6;
      const x0 = sg.ax + dx / len * a + dz / len * lat, z0 = sg.az + dz / len * a - dx / len * lat;
      lifeAdd({ kind: 'metro', x: x0, z: z0, y: HUB.TUN_Y, ug: true, yaw: 0, stroll: { x0, z0, dx: dx / len, dz: dz / len, len: L2, v: 1.2, off: lifeHash(a | 0, 7) * 80, lat: 0 } });
    }
  }
  for (const n of HUBT.nodes) if (n.hall) for (let k = 0; k < 6; k++) { const a = k * 1.05; lifeAdd({ kind: 'metro', x: n.x + Math.cos(a) * 4.5, z: n.z + Math.sin(a) * 4.5, y: HUB.TUN_Y, ug: true, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) + (k % 2 ? 0.5 : -0.5) }); }
  LIFE.hubCount = LIFE.people.filter(p => Math.hypot(p.x - WS.HILL.x, p.z - WS.HILL.z) < 800).length;
  // Vögel, Tauben, Boote, Fahnen
  buildBirds(scene);
  buildPigeons(surf);
  buildLifeBoats(surf);
  buildFlags(surf);
  // Animierte Figuren nachladen (blockiert den Start nicht)
  loadCrowdData((ok) => {
    if (!ok) return;
    const a = buildCrowdAsset(); if (!a) return;
    LIFE.sk = new SkinCrowd(scene, a, 170);
  });
}

/* ---------- Cafés ---------- */
function buildCafes(surf) {
  const PZ = WS.PIAZZA, y = WS.VENICE_Y + 0.04;
  const mb = new MB();
  const chairC = lin(0x2b2f33), tableC = lin(0xf2efe8), umbC = [lin(0xf3ead8), lin(0x7a1f1f), lin(0x1d3b5c)];
  const fx = PZ.x + 10, fz = PZ.z + 20;
  let ti = 0;
  for (const side of [-1, 1]) for (const row of [5.5, 10.5]) {
    const x = PZ.x + side * (PZ.hw - row);
    for (let z = PZ.z - PZ.hd + 8; z < PZ.z + PZ.hd - 6; z += 5.2) {
      ti++;
      if (lifeHash(ti, 17) < 0.25) continue;
      if (Math.hypot(x - fx, z - fz) < 11) continue;
      if (typeof occFree === 'function' && !occFree(makeOBB(x, z, 0, 1.9, 1.9), 0.3)) continue;
      mb.cyl(x, y, z, 0.05, 0.05, 0.72, 6, chairC, false);
      mb.cyl(x, y + 0.72, z, 0.38, 0.38, 0.04, 14, tableC, true);
      mb.cyl(x, y, z, 0.25, 0.25, 0.03, 10, chairC, true);
      if (ti % 2 === 0) { mb.cyl(x, y + 0.76, z, 0.03, 0.03, 1.7, 6, lin(0xcccccc), false); mb.cyl(x, y + 2.2, z, 1.5, 0.05, 0.45, 12, umbC[ti % 3], false); }
      const nC = 2 + Math.floor(lifeHash(ti, 3) * 3);
      for (let k = 0; k < nC; k++) {
        const a = k / nC * Math.PI * 2 + lifeHash(ti, 4);
        const cx = x + Math.cos(a) * 0.72, cz = z + Math.sin(a) * 0.72;
        const yaw = yawOf(-Math.cos(a), -Math.sin(a)), fs = Math.sin(yaw), fc = Math.cos(yaw);
        mb.box(cx, y + 0.44, cz, 0.42, 0.04, 0.42, yaw, chairC);
        mb.box(cx - fs * 0.2, y + 0.68, cz - fc * 0.2, 0.42, 0.45, 0.04, yaw, chairC);
        for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
          const px = cx + lx * fc + lz * fs, pz = cz - lx * fs + lz * fc;
          mb.box(px, y + 0.21, pz, 0.03, 0.42, 0.03, yaw, chairC);
        }
        lifeAdd({ kind: 'cafe', x: cx + fs * 0.04, z: cz + fc * 0.04, yaw, sit: true, seatY: y + 0.46 });
      }
    }
  }
  if (mb.empty()) return;
  const geo = mb.build(); geo.translate(-PZ.x, 0, -PZ.z); compactGeometry(geo, true);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  m.position.set(PZ.x, 0, PZ.z); // Position = Piazza, damit nearVis den Abstand richtig misst
  m.castShadow = true; m.receiveShadow = true; m.name = 'cafes';
  surf.add(m); nearVis(m, 500);
  LIFE.cafes = m;
}

/* ---------- Sichtbarkeit (für Ein- und Ausblenden ohne „Plopp“ vor der Kamera) ---------- */
const _cf = new THREE.Vector3();
function lifeInView(x, z) {
  const c = WORLD.camera.position;
  const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
  if (d > 160) return false;
  if (d < 4) return true;
  WORLD.camera.getWorldDirection(_cf);
  return (dx * _cf.x + dz * _cf.z) / d > 0.35;
}

/* ---------- Ein- und Aussteigen ---------- */
function vehicleDoorPoints(v, x, z) {
  // nächste offene Tür: Punkt aussen vor der Tür und innen
  let best = null, bd = 1e9;
  const dsd = v.doorSide();
  for (const c of v.cars) for (const d of c.doors) {
    if (dsd !== 0 && d.side !== dsd) continue;
    const o = v.toWorld(c, d.side * (c.hw + 0.45), 0, d.zc), dd = (o[0] - x) ** 2 + (o[2] - z) ** 2;
    if (dd < bd) { bd = dd; best = { out: o, inn: v.toWorld(c, d.side * (c.hw - 0.7), 0, d.zc), c, d }; }
  }
  return best;
}
function lifeVehicles(ug) {
  const cam = WORLD.camera.position;
  for (const v of VEH.list) {
    if (v.state !== 'dwell') { v._lifeArr = false; continue; }
    if (!!v.underground !== ug || v.door < 0.9 || v._lifeArr) continue;
    const p0 = v.cars[0].g.position;
    if ((p0.x - cam.x) ** 2 + (p0.z - cam.z) ** 2 > 140 * 140) continue;
    v._lifeArr = true;
    const entry = v.stops[v.nextStop]; if (!entry) continue;
    const key = v.kind === 'tram' ? entry : entry.stop;
    const kind = v.kind === 'metro' ? 'metro' : 'stop';
    const dens = lifeDensity(kind, GAME.hour);
    // Einsteigen: Wartende dieser Haltestelle gehen zur nächsten Tür
    const list = LIFE.byStop.get(key) || [];
    for (const p of list) {
      if (p.st !== 'idle' || !p.act || lifeHash(p.i, (LIFE.t * 10) | 0) > 0.8) continue;
      const dp = vehicleDoorPoints(v, p.x, p.z); if (!dp) continue;
      if (Math.hypot(dp.out[0] - p.x, dp.out[2] - p.z) > 45) continue;
      p.st = 'board'; p.veh = v; p.way = [[dp.out[0], dp.out[2]], [dp.inn[0], dp.inn[2]]]; p.wi = 0; p.wc = 0;
      p.sitNow = false;
    }
    // Aussteigen: je nach Tageszeit 0–3 Leute
    const n = Math.min(3, Math.floor(dens * 3.2 + lifeHash(LIFE.temps.length, (LIFE.t | 0)) * 1.2));
    for (let k = 0; k < n && LIFE.temps.length < 16; k++) {
      const c = v.cars[Math.min(v.cars.length - 1, k % v.cars.length)];
      const dsd = v.doorSide(), ds = c.doors.filter(d => dsd === 0 || d.side === dsd); if (!ds.length) continue;
      const d = ds[(k * 7 + (LIFE.t | 0)) % ds.length];
      const inn = v.toWorld(c, d.side * (c.hw - 0.7), 0, d.zc), out = v.toWorld(c, d.side * (c.hw + 1.2), 0, d.zc), far = v.toWorld(c, d.side * (c.hw + 3.5), 0, d.zc);
      const way = [[out[0], out[2]], [far[0], far[2]]];
      const yaw = c.g.rotation.y, fwdx = Math.sin(yaw), fwdz = Math.cos(yaw), sg = lifeHash(k, LIFE.t | 0) < 0.5 ? 1 : -1;
      let y = inn[1] + (v.kind === 'metro' ? 0 : 0);
      if (v.kind === 'metro') {
        const st = entry.stop, cr = Math.cos(st.rot), sr = Math.sin(st.rot);
        const W = (lx, lz) => [st.x + lx * cr + lz * sr, st.z - lx * sr + lz * cr];
        const a = W(0.6 * sg, st.aBot - 2), b = W(0.6 * sg, st.aTop - 4);
        way.push([a[0], a[1], st.platY], [b[0], b[1], st.surfY - 2]);
        y = st.platY;
      } else {
        way.push([far[0] + fwdx * 30 * sg, far[2] + fwdz * 30 * sg]);
        y = (v.kind === 'sbahn' || v.kind === 'ir') ? inn[1] + RL.PLH : null; // Perron auf dem Viadukt
      }
      LIFE.temps.push({ x: inn[0], z: inn[2], y, way, wi: 0, wc: lifeHash(k, 77), yaw: 0, look: crowdLook(9000 + ((LIFE.t * 31) | 0) + k), ug, age: 0, delay: k * 0.7 });
    }
  }
}

/* ---------- pro Bild (aus updateTraffic) ---------- */
function updateLife(dt, camPos, C, SK) {
  LIFE.t += dt;
  if (!LIFE.on || GAME.mode !== 'world') { if (LIFE.sk) LIFE.sk.mesh.visible = GAME.mode === 'world'; return; }
  if (LIFE.sk) LIFE.sk.mesh.visible = true;
  const ug = !!P.underground;
  const f = (typeof QUALITY !== 'undefined' && QUALITY.cur && QUALITY.cur.vehScale) || 1;
  const skR2 = (58 * f) ** 2, nearR2 = (80 * f) ** 2, farR2 = 230 * 230;
  const h = GAME.hour, A = SK ? SK.asset : null;
  const dens = {}; for (const k of ['stop', 'metro', 'bench', 'cafe', 'beach', 'stroll', 'group']) dens[k] = lifeDensity(k, h);
  lifeVehicles(ug);
  let nNear = 0, nFar = 0;
  const cx = Math.floor(camPos.x / LCELL), cz = Math.floor(camPos.z / LCELL);
  for (let gx = cx - 2; gx <= cx + 2; gx++) for (let gz = cz - 2; gz <= cz + 2; gz++) {
    const arr = LIFE.grid.get(gx + '|' + gz); if (!arr) continue;
    for (const p of arr) {
      if (!!p.ug !== ug) continue;
      // aktiv je nach Uhrzeit; umschalten nur, wenn niemand hinschaut
      const want = p.u < dens[p.kind];
      if (p.act === undefined) p.act = want;
      else if (want !== p.act && p.st === 'idle' && !lifeInView(p.x, p.z)) p.act = want;
      if (p.st === 'gone') { if (LIFE.t > p.back && !lifeInView(p.hx, p.hz)) lifeReset(p); else continue; }
      if (!p.act && p.st === 'idle') continue;
      let clip = 'idle', cyc = 0, x = p.x, z = p.z, yaw = p.yaw;
      if (p.stroll) {
        const S = p.stroll, u = ((LIFE.t * S.v + S.off) % (S.len * 2)), back = u > S.len, a = back ? S.len * 2 - u : u;
        if (S.dx !== undefined) { p.x = x = S.x0 + S.dx * a; p.z = z = S.z0 + S.dz * a; yaw = back ? Math.atan2(-S.dx, -S.dz) : Math.atan2(S.dx, S.dz); }
        else { p.z = z = S.z0 + a; yaw = back ? Math.PI : 0; }
        clip = 'walk'; cyc = (LIFE.t * S.v + S.off) / 1.52;
      } else if (p.st === 'board' || p.st === 'return') {
        if (p.st === 'board' && (p.veh.state !== 'dwell' || p.veh.door < 0.5)) { p.st = 'return'; p.way = [[p.hx, p.hz]]; p.wi = 0; }
        const w = p.way[p.wi], dx = w[0] - p.x, dz = w[1] - p.z, d = Math.hypot(dx, dz), stp = 1.35 * dt;
        if (d <= stp) {
          p.x = w[0]; p.z = w[1]; p.wi++;
          if (p.wi >= p.way.length) { if (p.st === 'board') { p.st = 'gone'; p.back = LIFE.t + 50 + lifeHash(p.i, LIFE.t | 0) * 110; continue; } p.st = 'idle'; p.x = p.hx; p.z = p.hz; p.yaw = p.hyaw; }
        } else { p.x += dx / d * stp; p.z += dz / d * stp; p.yaw = yawOf(dx, dz); }
        p.wc += stp / 1.52; x = p.x; z = p.z; yaw = p.yaw;
        if (p.st !== 'idle') { clip = 'walk'; cyc = p.wc; }
      }
      const sitting = p.sit && p.st === 'idle' && !p.stroll;
      if (sitting) { clip = 'sit'; }
      if (clip !== 'walk') cyc = LIFE.t / (A ? A.clips[clip].dur : 6) + p.ph;
      const ddx = x - camPos.x, ddz = z - camPos.z, d2 = ddx * ddx + ddz * ddz;
      if (d2 > farR2) continue;
      if (p.y === undefined) p.y = p.yHint !== undefined ? groundAt(p.x, p.z, p.yHint + 1.5) : (p.sit ? null : groundAt(p.x, p.z, terrainH(p.x, p.z) + 3));
      let y = p.y;
      if (p.stroll || p.st !== 'idle') y = p.ug ? p.y : groundAt(x, z, (p.y || terrainH(x, z)) + 1.5);
      const S = 1.68 * p.look.h;
      if (sitting) y = p.seatY - (A ? A.hipY : 0.318) * S + 0.075;
      if (y === null || y === undefined) continue;
      _lq.setFromAxisAngle(_lup, yaw);
      if (SK && d2 < skR2 && !SK.full()) {
        _lm4.compose(_lv.set(x, y, z), _lq, _ls.set(S, S, S));
        SK.add(_lm4, A.clips[clip], cyc, p.look); nNear++;
      } else if (!sitting) {
        const k = p.look.h * 1.0;
        _lm4.compose(_lv.set(x, y - 0.03, z), _lq, _ls.set(k, k, k));
        C.add(_lm4, clip === 'walk' ? cyc * 6.2832 : 0, p.look.shirt, p.look.pants, p.look.skin, d2 < nearR2); nFar++;
      }
    }
  }
  // Aussteigende
  for (let i = LIFE.temps.length - 1; i >= 0; i--) {
    const q = LIFE.temps[i];
    q.age += dt;
    if (q.ug !== ug) { LIFE.temps.splice(i, 1); continue; }
    if (q.delay > 0) { q.delay -= dt; continue; }
    let clip = 'walk';
    if (q.wi < q.way.length) {
      const w = q.way[q.wi], dx = w[0] - q.x, dz = w[1] - q.z, d = Math.hypot(dx, dz), stp = 1.4 * dt;
      if (w[2] !== undefined && q.y !== null) q.y += (w[2] - q.y) * Math.min(1, stp / Math.max(d, 0.01));
      if (d <= stp) { q.x = w[0]; q.z = w[1]; q.wi++; } else { q.x += dx / d * stp; q.z += dz / d * stp; q.yaw = yawOf(dx, dz); }
      q.wc += stp / 1.52;
    } else clip = 'idle';
    const vis = lifeInView(q.x, q.z);
    if ((q.wi >= q.way.length && (!vis || q.age > 50)) || q.age > 120) { LIFE.temps.splice(i, 1); continue; }
    const y = q.y !== null ? q.y : groundAt(q.x, q.z, terrainH(q.x, q.z) + 2.5);
    const S = 1.68 * q.look.h, ddx = q.x - camPos.x, ddz = q.z - camPos.z, d2 = ddx * ddx + ddz * ddz;
    _lq.setFromAxisAngle(_lup, q.yaw);
    if (SK && d2 < skR2 && !SK.full()) { _lm4.compose(_lv.set(q.x, y, q.z), _lq, _ls.set(S, S, S)); SK.add(_lm4, A.clips[clip], clip === 'walk' ? q.wc : LIFE.t / 8.33, q.look); nNear++; }
    else if (d2 < farR2) { _lm4.compose(_lv.set(q.x, y - 0.03, q.z), _lq, _ls.set(q.look.h, q.look.h, q.look.h)); C.add(_lm4, q.wc * 6.2832, q.look.shirt, q.look.pants, q.look.skin, d2 < nearR2); nFar++; }
  }
  LIFE.stats.near = nNear; LIFE.stats.far = nFar;
}
function lifeReset(p) { p.st = 'idle'; p.x = p.hx; p.z = p.hz; p.yaw = p.hyaw; p.veh = null; }

/* ================= VÖGEL =================
   Ein instanziertes Mesh. Modus 0 (Möwen, Schwärme): die ganze Flugbahn (Kreis mit Auf und Ab,
   Schräglage, Flügelschlag mit Gleitphasen) rechnet der Vertex-Shader aus der Zeit → 0 CPU.
   Modus 1 (Tauben): Position aus der Instanzmatrix, Flügel angelegt oder schlagend. */
function birdGeometry() {
  const mb = new MB();
  const body = lin(0xf4f4f2), wing = lin(0xc9ced4), tip = lin(0x3a3d42), beak = lin(0xe8a33a);
  mb.box(0, 0, 0, 0.13, 0.12, 0.46, 0, body);
  mb.box(0, 0.05, 0.25, 0.1, 0.1, 0.12, 0, body);
  mb.box(0, 0.04, 0.34, 0.03, 0.03, 0.07, 0, beak);
  mb.box(0, 0.01, -0.28, 0.16, 0.02, 0.12, 0, body);
  // Flügel: zwei dünne Flächen nach aussen, Spitzen dunkel
  for (const s of [1, -1]) {
    mb.box(s * 0.22, 0.02, 0.0, 0.32, 0.015, 0.2, 0, wing);
    mb.box(s * 0.48, 0.02, -0.03, 0.22, 0.012, 0.14, 0, tip);
  }
  const g = mb.build(); g.deleteAttribute('uv');
  const pos = g.attributes.position, aw = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) aw[i] = Math.abs(pos.getX(i)) > 0.08 ? 1 : 0;
  g.setAttribute('aW', new THREE.BufferAttribute(aw, 1));
  return g;
}
function birdMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uAmbT = AMB_T;
    sh.vertexShader = 'uniform float uAmbT;\nattribute float aW;\nattribute vec4 iA;\nattribute vec4 iB;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position);
      {
        float mode = iB.w;
        float flapT = uAmbT * (mode < 0.5 ? 6.5 : 13.0) + iB.y * 10.0;
        float glide = mode < 0.5 ? smoothstep(-0.3, 0.5, sin(uAmbT * 0.45 + iB.y * 3.0)) : step(0.5, iB.x);
        float fold = mode > 0.5 ? mix(0.3, 1.0, step(0.5, iB.x)) : 1.0;
        transformed.x *= mix(1.0, fold, aW);
        transformed.y += aW * abs(transformed.x) * sin(flapT) * 0.95 * glide;
        if (mode < 0.5) {
          float a = iB.y + uAmbT * iB.x;
          vec3 c = iA.xyz + vec3(cos(a) * iA.w, sin(uAmbT * 0.23 + iB.y * 5.0) * 3.0, sin(a) * iA.w);
          vec2 t = vec2(-sin(a), cos(a)) * sign(iB.x);
          float yaw = atan(t.x, t.y), bank = -0.35 * sign(iB.x);
          vec3 p = transformed * iB.z;
          p = vec3(p.x * cos(bank) - p.y * sin(bank), p.x * sin(bank) + p.y * cos(bank), p.z);
          p = vec3(p.x * cos(yaw) + p.z * sin(yaw), p.y, -p.x * sin(yaw) + p.z * cos(yaw));
          transformed = c + p;
        }
      }`);
  };
  m.customProgramCacheKey = () => 'birds';
  return m;
}
function buildBirds(scene) {
  const flocks = [];
  // Möwen über dem Strand und dem Hafen
  for (let z = -2200; z < 2300; z += 520) flocks.push({ x: coastX(z) - 10, z, y: 18, R: 45, n: 6, sc: 1.0, col: 0xffffff, sp: 0.16 });
  flocks.push({ x: WS.PIAZZA.x + 60, z: WS.PIAZZA.z, y: 22, R: 60, n: 8, sc: 1.0, col: 0xffffff, sp: 0.13 });
  // Schwärme über der Stadt (kleiner, dunkler, schneller)
  const C = WS.CENTER;
  for (const [dx, dz, y] of [[0, 0, 45], [-600, 400, 38], [500, -300, 52], [-300, -700, 40], [700, 600, 48], [WS.HILL.x - C.x, WS.HILL.z - C.z, 60]]) flocks.push({ x: C.x + dx, z: C.z + dz, y: terrainH(C.x + dx, C.z + dz) + y, R: 70, n: 14, sc: 0.42, col: 0x3a3a40, sp: 0.32, tight: true });
  let n = 0; for (const f of flocks) n += f.n;
  const g = birdGeometry();
  const iA = new Float32Array(n * 4), iB = new Float32Array(n * 4);
  const im = new THREE.InstancedMesh(g, birdMaterial(), n);
  let i = 0;
  for (const f of flocks) for (let k = 0; k < f.n; k++, i++) {
    const h1 = lifeHash(i, 31), h2 = lifeHash(i, 32), h3 = lifeHash(i, 33);
    const spread = f.tight ? 4 : 14;
    iA.set([f.x + (h1 - 0.5) * spread, f.y + (h2 - 0.5) * (f.tight ? 3 : 8), f.z + (h3 - 0.5) * spread, f.R + (h2 - 0.5) * (f.tight ? 6 : 20)], i * 4);
    const dir = (Math.floor(flocks.indexOf(f)) % 2) ? -1 : 1;
    iB.set([dir * f.sp * (f.tight ? 1 : 0.8 + h3 * 0.4), (f.tight ? k * 0.07 : h1 * 6.28), f.sc * (0.9 + h2 * 0.2), 0], i * 4);
    im.setColorAt(i, new THREE.Color(f.col));
    im.setMatrixAt(i, _lm4.identity());
  }
  g.setAttribute('iA', new THREE.InstancedBufferAttribute(iA, 4));
  g.setAttribute('iB', new THREE.InstancedBufferAttribute(iB, 4));
  im.frustumCulled = false; im.name = 'birds';
  scene.add(im);
  LIFE.birds = im;
}

/* ---------- Tauben (Piazza und Hauptplatz) ---------- */
function buildPigeons(surf) {
  const areas = [{ x: WS.PIAZZA.x - 5, z: WS.PIAZZA.z - 5, r: 30, y: WS.VENICE_Y + 0.04, n: 34 }];
  const cp = ROADS.plazas.find(p => p.kind === 'center' && p.cell);
  if (cp) areas.push({ x: cp.cell.cx, z: cp.cell.cz, r: 26, y: terrainH(cp.cell.cx, cp.cell.cz) + 0.04, n: 22, fountainR: 10.5 });
  let n = 0; for (const a of areas) n += a.n;
  const g = birdGeometry();
  const iA = new Float32Array(n * 4), iB = new Float32Array(n * 4);
  const im = new THREE.InstancedMesh(g, birdMaterial(), n);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const greys = [0x8a8f99, 0x6f747e, 0x9ea3ab, 0x5d6068, 0xb9b4aa];
  let i = 0;
  for (const a of areas) for (let k = 0; k < a.n; k++, i++) {
    const pg = { area: a, idx: i, x: 0, y: a.y, z: 0, yaw: lifeHash(i, 41) * 6.28, mode: 'ground', t: 0, next: lifeHash(i, 42) * 3 };
    pigeonSpot(pg, i * 3 + 1); pg.x = pg.tx; pg.z = pg.tz;
    LIFE.pigeons.push(pg);
    iB.set([0, lifeHash(i, 43) * 6.28, 0.55, 1], i * 4);
    im.setColorAt(i, new THREE.Color(greys[i % greys.length]));
  }
  g.setAttribute('iA', new THREE.InstancedBufferAttribute(iA, 4));
  const ib = new THREE.InstancedBufferAttribute(iB, 4); ib.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iB', ib);
  im.frustumCulled = false; im.castShadow = false; im.name = 'pigeons'; im.userData.dynamic = true;
  surf.add(im);
  LIFE.pigeonMesh = im;
  for (const pg of LIFE.pigeons) pigeonMatrix(pg);
  im.instanceMatrix.needsUpdate = true;
}
function pigeonSpot(pg, seed) {
  const a = pg.area;
  for (let tries = 0; tries < 8; tries++) {
    const ang = lifeHash(seed, tries) * 6.28, r = Math.sqrt(lifeHash(seed, tries + 20)) * a.r;
    const x = a.x + Math.cos(ang) * r, z = a.z + Math.sin(ang) * r;
    if (a.fountainR && Math.hypot(x - a.x, z - a.z) < a.fountainR) continue;
    pg.tx = x; pg.tz = z; return;
  }
  pg.tx = a.x + a.r * 0.8; pg.tz = a.z;
}
function pigeonMatrix(pg) {
  const peck = pg.mode === 'ground' ? Math.max(0, Math.sin(LIFE.t * 5 + pg.idx)) * 0.5 * (pg.idx % 3 === 0 ? 1 : 0.3) : 0;
  _le.set(peck, pg.yaw, 0, 'YXZ'); _lq.setFromEuler(_le);
  _lm4.compose(_lv.set(pg.x, pg.y + (pg.mode === 'ground' ? 0.07 : 0), pg.z), _lq, _ls.set(1, 1, 1));
  LIFE.pigeonMesh.setMatrixAt(pg.idx, _lm4);
}
function updatePigeons(dt) {
  const im = LIFE.pigeonMesh; if (!im) return;
  const cam = WORLD.camera.position;
  let any = false;
  const ib = im.geometry.attributes.iB;
  for (const pg of LIFE.pigeons) {
    const a = pg.area;
    if ((a.x - cam.x) ** 2 + (a.z - cam.z) ** 2 > 200 * 200) continue;
    any = true;
    const px = P.x, pz = P.z;
    if (pg.mode === 'ground') {
      // aufscheuchen: Spieler (oder Drache) zu nahe
      if (GAME.mode === 'world' && !P.ride && (pg.x - px) ** 2 + (pg.z - pz) ** 2 < (P.char === 'dragon' ? 49 : 16) && Math.abs(P.y - pg.y) < 4) {
        pg.mode = 'fly'; pg.t = 0; pg.T = 4 + lifeHash(pg.idx, LIFE.t | 0) * 3;
        pg.sx = pg.x; pg.sz = pg.z; pg.sy = pg.y;
        pigeonSpot(pg, (pg.idx * 17 + (LIFE.t * 7 | 0)) | 0);
        // weg vom Spieler
        if ((pg.tx - px) ** 2 + (pg.tz - pz) ** 2 < 100) { pg.tx = a.x + (a.x - px) * 0.5; pg.tz = a.z + (a.z - pz) * 0.5; }
        pg.apex = 5 + lifeHash(pg.idx, 5) * 7;
        ib.array[pg.idx * 4] = 1; ib.needsUpdate = true;
      } else {
        // trippeln
        pg.next -= dt;
        if (pg.next <= 0) { pg.next = 1.5 + lifeHash(pg.idx, LIFE.t * 3 | 0) * 4; pg.yaw += (lifeHash(pg.idx, LIFE.t * 5 | 0) - 0.5) * 2.4; }
        const w = (pg.idx % 4 === 0) ? 0.25 : 0;
        pg.x += Math.sin(pg.yaw) * w * dt; pg.z += Math.cos(pg.yaw) * w * dt;
        if (Math.hypot(pg.x - a.x, pg.z - a.z) > a.r) pg.yaw = Math.atan2(a.x - pg.x, a.z - pg.z);
      }
    } else {
      pg.t += dt;
      const u = Math.min(1, pg.t / pg.T), e = u * u * (3 - 2 * u);
      const nx = lerp(pg.sx, pg.tx, e), nz = lerp(pg.sz, pg.tz, e);
      const dx = nx - pg.x, dz = nz - pg.z;
      if (dx * dx + dz * dz > 1e-6) pg.yaw = Math.atan2(dx, dz);
      pg.x = nx; pg.z = nz; pg.y = lerp(pg.sy, a.y, u) + Math.sin(u * Math.PI) * pg.apex;
      if (u >= 1) { pg.mode = 'ground'; pg.y = a.y; ib.array[pg.idx * 4] = 0; ib.needsUpdate = true; }
    }
    pigeonMatrix(pg);
  }
  if (any) im.instanceMatrix.needsUpdate = true;
}

/* ================= BOOTE ================= */
function boatMesh(len, wid, hullCol, cabin) {
  const mb = new MB();
  mb.box(0, 0.3, 0, wid, 0.8, len * 0.8, 0, lin(hullCol));
  mb.box(0, 0.3, len * 0.45, wid * 0.6, 0.78, len * 0.12, 0, lin(hullCol));
  mb.box(0, 0.72, 0, wid * 1.01, 0.1, len * 0.8, 0, lin(0xf2f2f2));
  for (const c of cabin) mb.box(c[0], c[1], c[2], c[3], c[4], c[5], 0, lin(c[6]));
  const g = mb.build(); compactGeometry(g, true);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
  m.castShadow = true;
  return m;
}
function buildLifeBoats(surf) {
  // Flussboote: Schleife flussaufwärts auf der einen, flussabwärts auf der anderen Seite
  const R = WATER.river;
  if (R && R.pts) {
    const pts = R.pts.filter(p => p[0] > -2100 && p[0] < coastX(p[1]) - 60);
    if (pts.length > 4) {
      const off = (sg) => pts.map((p, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1;
        return [p[0] - dz / l * 6 * sg, WS.WATER_Y, p[1] + dx / l * 6 * sg];
      });
      const loop = off(1).concat(off(-1).reverse());
      const path = new TPath(loop, [], { noSpeed: true, ds: 2 });
      const cols = [0xffffff, 0x1d3b5c, 0x7a1f1f, 0x2f6f4f];
      for (let k = 0; k < 4; k++) {
        const m = boatMesh(6.5, 2.3, cols[k], [[0, 1.15, -0.4, 1.7, 0.75, 2.2, 0xe8eef2], [0, 1.15, 0.75, 1.6, 0.6, 0.06, 0x1a2a38]]);
        surf.add(m); nearVis(m, 900);
        LIFE.boats.push({ m, path, s: path.L * k / 4, v: 4 + k * 0.6, ph: k * 1.7 });
      }
    }
  }
  // Ausflugsschiff vor der Küste
  const loop = [];
  for (let z = -250; z <= 2350; z += 50) loop.push([coastX(z) + 110, WS.WATER_Y, z]);
  for (let a = 0; a <= Math.PI; a += Math.PI / 8) loop.push([coastX(2350) + 140 - Math.cos(a) * 30, WS.WATER_Y, 2350 + Math.sin(a) * 30]);
  for (let z = 2350; z >= -250; z -= 50) loop.push([coastX(z) + 170, WS.WATER_Y, z]);
  for (let a = 0; a <= Math.PI; a += Math.PI / 8) loop.push([coastX(-250) + 140 + Math.cos(a) * 30, WS.WATER_Y, -250 - Math.sin(a) * 30]);
  const fp = new TPath(loop, [], { noSpeed: true, ds: 3 });
  const ferry = boatMesh(30, 7, 0xf4f4f4, [
    [0, 1.9, -1.5, 6.2, 1.8, 18, 0xf8f8f8], [0, 1.9, -1.5, 6.25, 0.9, 17, 0x1f3550],
    [0, 3.4, -2.5, 5.2, 1.4, 12, 0xffffff], [0, 3.4, -2.5, 5.25, 0.6, 11, 0x1f3550],
    [0, 4.6, 3.2, 3, 1.1, 2.6, 0xffffff], [0, 5.4, -6, 1, 2.2, 1.4, 0xc62828]
  ]);
  surf.add(ferry); nearVis(ferry, 2000);
  LIFE.boats.push({ m: ferry, path: fp, s: 0, v: 5.5, ph: 0, big: true });
}
const _bp = {};
function updateLifeBoats(t, dt) {
  for (const b of LIFE.boats) {
    b.s = (b.s + b.v * dt) % b.path.L;
    b.path.at(b.s, _bp);
    b.m.position.set(_bp.x, WS.WATER_Y + Math.sin(t * 0.9 + b.ph) * (b.big ? 0.06 : 0.1) - (b.big ? 0.35 : 0.2), _bp.z);
    b.m.rotation.set(Math.sin(t * 0.7 + b.ph) * 0.015, Math.atan2(_bp.dx, _bp.dz), Math.sin(t * 0.8 + b.ph) * (b.big ? 0.01 : 0.03));
  }
}

/* ================= FAHNEN ================= */
function flagTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const c = cv.getContext('2d');
  // 4 Motive nebeneinander, je 64 × 64 (Fahne 3:2 wird gestreckt)
  c.fillStyle = '#d52b1e'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#fff'; c.fillRect(26, 14, 12, 36); c.fillRect(14, 26, 36, 12);
  c.fillStyle = '#ffffff'; c.fillRect(64, 0, 64, 64); c.fillStyle = '#1f63b5'; c.beginPath(); c.moveTo(64, 64); c.lineTo(128, 0); c.lineTo(128, 64); c.fill();
  c.fillStyle = '#1b2a4a'; c.fillRect(128, 0, 64, 64); c.fillStyle = '#d8b45a'; c.font = 'bold 34px Georgia'; c.textAlign = 'center'; c.fillText('H', 160, 46); c.fillRect(132, 4, 56, 3); c.fillRect(132, 57, 56, 3);
  c.fillStyle = '#ffffff'; c.fillRect(192, 0, 64, 64); c.fillStyle = '#1a1a1a'; c.font = 'bold 22px Arial'; c.fillText('ETH', 224, 40);
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
  return tex;
}
function buildFlags(surf) {
  const list = [];
  for (const b of BLD.list) {
    if (!(b.luxury || b.cat === 'eth') || !b.door) continue;
    let ox = b.door.ox - b.door.x, oz = b.door.oz - b.door.z; const l = Math.hypot(ox, oz) || 1; ox /= l; oz /= l;
    const eth = b.cat === 'eth', n = eth ? 4 : 3, out = eth ? 8 : 6.5, gap = eth ? 7 : 3.2;
    for (let k = 0; k < n; k++) {
      const side = (k - (n - 1) / 2) * gap + (eth ? Math.sign(k - (n - 1) / 2) * 6 : 0);
      const x = b.door.x + ox * out - oz * side, z = b.door.z + oz * out + ox * side;
      const y = groundAt(x, z, b.door.oy + 2);
      list.push({ x, y, z, motif: eth ? (k % 2 ? 3 : 0) : [0, 2, 1][k % 3] });
    }
  }
  if (!list.length) return;
  const pm = new MB();
  for (const f of list) { pm.cyl(f.x, f.y, f.z, 0.07, 0.05, 8.2, 8, lin(0xe8e8e8), true); pm.cyl(f.x, f.y + 8.2, f.z, 0.1, 0.1, 0.12, 8, lin(0xd8b45a), true); }
  const pg = pm.build(); compactGeometry(pg, true);
  const poles = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.6 }));
  poles.castShadow = true; surf.add(poles);
  const g = new THREE.PlaneGeometry(2.4, 1.6, 12, 4); g.translate(1.2, 0, 0);
  const n = list.length, iM = new Float32Array(n);
  list.forEach((f, i) => { iM[i] = f.motif; });
  g.setAttribute('iMotif', new THREE.InstancedBufferAttribute(iM, 1));
  const mat = new THREE.MeshStandardMaterial({ map: flagTexture(), side: THREE.DoubleSide, roughness: 0.8 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uAmbT = AMB_T;
    sh.vertexShader = 'uniform float uAmbT;\nattribute float iMotif;\n' + sh.vertexShader
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vUv.x = (vUv.x + iMotif) / 4.0;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.17;
          float k = transformed.x / 2.4;
          float gust = 0.75 + 0.25 * sin(uAmbT * 0.6 + ph);
          transformed.z += (sin(uAmbT * 5.2 - transformed.x * 3.0 + ph) * 0.17 + sin(uAmbT * 8.1 - transformed.x * 5.0 + ph) * 0.05) * k * gust;
          transformed.y -= 0.12 * k * k * (1.2 - gust);
        }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        {
          float ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.17;
          float sl = cos(uAmbT * 5.2 - position.x * 3.0 + ph) * 0.17 * 3.0 * (position.x / 2.4);
          objectNormal = normalize(vec3(sl, 0.0, 1.0));
        }`);
  };
  mat.customProgramCacheKey = () => 'flags';
  const im = new THREE.InstancedMesh(g, mat, n);
  list.forEach((f, i) => { _lm4.makeTranslation(f.x + 0.06, f.y + 7.3, f.z); im.setMatrixAt(i, _lm4); });
  im.castShadow = true; im.frustumCulled = false; im.name = 'flags';
  surf.add(im);
  LIFE.flags = im;
}

/* ---------- pro Bild (aus updateNature) ---------- */
function updateAmbientLife(t, dt) {
  if (!LIFE.birds) return;
  const out = GAME.mode === 'world' && !P.underground;
  LIFE.birds.visible = out && SKY.night < 0.6;
  updatePigeons(dt);
  updateLifeBoats(t, dt);
}
