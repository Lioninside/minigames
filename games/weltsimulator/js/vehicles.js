/* ================= FAHRZEUGE =================
   Modelle (Stadtbus, altes Zürcher Tram, mehrteilige Londoner U-Bahn), autonome Fahrt entlang
   ihrer Pfade, 10 Sekunden Halt mit offenen Türen, Hindernis-Erkennung. */

const VEH = { list: [], mats: null, templates: {}, obstacles: new SHash(25) };

function initVehicleMats() {
  const phys = (c, r, m, cc) => new THREE.MeshPhysicalMaterial({ color: c, roughness: r, metalness: m || 0, clearcoat: cc || 0, clearcoatRoughness: 0.12 });
  const fab = makeCanvas(64, 64); { const ctx = fab.getContext('2d'); ctx.fillStyle = '#26467f'; ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 300; i++) { ctx.fillStyle = pick(['#d23b3b', '#f2c94c', '#3a6fc4', '#1a2f5a']); ctx.fillRect(rnd() * 64, rnd() * 64, 2, 2); } }
  const moq = makeCanvas(64, 64); { const ctx = moq.getContext('2d'); ctx.fillStyle = '#7a1b2a'; ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#e5b33b'; ctx.lineWidth = 3; for (let i = -64; i < 128; i += 16) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 64, 64); ctx.stroke(); }
    ctx.strokeStyle = '#1f6fb2'; for (let i = -64; i < 128; i += 16) { ctx.beginPath(); ctx.moveTo(i + 8, 64); ctx.lineTo(i + 72, 0); ctx.stroke(); } }
  const ft = canvasTex(fab); ft.repeat.set(2, 2);
  const mt = canvasTex(moq); mt.repeat.set(3, 1);
  VEH.mats = {
    white: phys(0xf1f1ee, 0.28, 0.1, 1), blue: phys(0x1d55a8, 0.3, 0.15, 1),
    tramBlue: phys(0x1b5db5, 0.35, 0.1, 0.8), tramCream: phys(0xf3efe3, 0.4, 0.05, 0.6),
    tubeRed: phys(0xd2131b, 0.3, 0.1, 1), tubeBlue: phys(0x173c8c, 0.3, 0.1, 1), tubeWhite: phys(0xe6e8ea, 0.3, 0.3, 1), tubeGray: phys(0x5f656b, 0.5, 0.3, 0.3),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x1f3540, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.3, depthWrite: false, envMapIntensity: 1.6 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.55 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.92 }),
    hub: new THREE.MeshStandardMaterial({ color: 0xbfc3c7, roughness: 0.25, metalness: 0.9 }),
    seat: new THREE.MeshStandardMaterial({ map: ft, roughness: 0.9 }),
    moquette: new THREE.MeshStandardMaterial({ map: mt, roughness: 0.9 }),
    floor: new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.8 }),
    pole: new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.3, metalness: 0.4 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xaab0b6, roughness: 0.3, metalness: 0.85 }),
    ilight: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3df, emissiveIntensity: 1.3 }),
    head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffbe8, emissiveIntensity: 0.4 }),
    tail: new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0.6 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.6 })
  };
}

function wheelGeo(r, w) { const g = new THREE.CylinderGeometry(r, r, w, 18); g.rotateZ(Math.PI / 2); return g; }

/* Baut aus Teil-Baukästen eine Vorlage {parts:[{geo,mat}], ...} */
function finishTemplate(mbs, extra) {
  const parts = [];
  for (const k in mbs) if (!mbs[k].empty()) parts.push({ geo: mbs[k].build(), mat: VEH.mats[k], key: k });
  return Object.assign({ parts }, extra);
}
function newMBs(keys) { const o = {}; for (const k of keys) o[k] = new MB(); return o; }

/* ---------- Stadtbus (12 m, Niederflur) ---------- */
function buildBusTemplate() {
  const mb = newMBs(['white', 'blue', 'glass', 'trim', 'rubber', 'hub', 'seat', 'floor', 'pole', 'ilight', 'head', 'tail']);
  const L = 12, W = 2.55, hw = W / 2, hl = L / 2;
  const doors = [{ zc: 4.45, half: 0.62, side: -1 }, { zc: 0.1, half: 0.62, side: -1 }, { zc: -3.7, half: 0.62, side: -1 }];
  const inDoor = (z) => doors.some(d => Math.abs(z - d.zc) < d.half + 0.04);
  // Unterer Rand (blau) und Seitenwände unten
  for (const s of [1, -1]) {
    let z = -hl + 0.12;
    while (z < hl - 0.12) {
      const z2 = Math.min(z + 0.25, hl - 0.12);
      if (!(s < 0 && inDoor((z + z2) / 2))) {
        mb.blue.box(s * (hw - 0.03), 0.62, (z + z2) / 2, 0.06, 0.58, z2 - z + 0.01, 0);
        mb.white.box(s * (hw - 0.03), 1.02, (z + z2) / 2, 0.06, 0.22, z2 - z + 0.01, 0);
      }
      z = z2;
    }
    // Fensterband: Pfosten und Scheiben
    for (let zz = -hl + 0.3; zz < hl - 0.3; zz += 1.45) if (!(s < 0 && inDoor(zz))) mb.trim.box(s * (hw - 0.03), 1.8, zz, 0.07, 1.4, 0.12, 0);
    z = -hl + 0.2;
    let segStart = z;
    const flush = (a, b) => { if (b - a > 0.1) mb.glass.box(s * (hw - 0.02), 1.8, (a + b) / 2, 0.03, 1.4, b - a, 0); };
    for (; z < hl - 0.2; z += 0.1) { if (s < 0 && inDoor(z)) { flush(segStart, z); segStart = z + 0.1; } }
    flush(segStart, hl - 0.2);
    mb.white.box(s * (hw - 0.03), 2.78, 0, 0.06, 0.46, L - 0.1, 0);
  }
  // Dach, Front, Heck, Boden
  mb.white.box(0, 3.03, 0, W, 0.08, L, 0);
  mb.white.box(0, 3.2, -0.5, 1.8, 0.3, 4.2, 0);
  mb.trim.box(0, 0.38, 0, W - 0.1, 0.06, L - 0.1, 0);
  mb.floor.box(0, 0.42, 0, W - 0.14, 0.02, L - 0.2, 0);
  mb.white.box(0, 2.98, 0, W - 0.14, 0.02, L - 0.2, 0);
  // Front
  mb.blue.box(0, 0.62, hl - 0.03, W, 0.58, 0.06, 0);
  mb.white.box(0, 1.0, hl - 0.03, W, 0.2, 0.06, 0);
  mb.glass.box(0, 1.82, hl - 0.02, W - 0.15, 1.45, 0.03, 0);
  mb.trim.box(0, 2.78, hl - 0.02, W - 0.1, 0.42, 0.06, 0);
  mb.head.box(0.92, 0.72, hl + 0.01, 0.42, 0.14, 0.03, 0); mb.head.box(-0.92, 0.72, hl + 0.01, 0.42, 0.14, 0.03, 0);
  mb.trim.box(0, 0.45, hl + 0.02, W - 0.2, 0.18, 0.06, 0);
  // Spiegel
  for (const s of [1, -1]) { mb.trim.box(s * (hw + 0.25), 2.3, hl - 0.2, 0.06, 0.06, 0.45, 0); mb.trim.box(s * (hw + 0.4), 2.0, hl - 0.05, 0.08, 0.4, 0.22, 0); }
  // Heck
  mb.white.box(0, 1.65, -hl + 0.03, W, 2.7, 0.06, 0);
  mb.glass.box(0, 2.1, -hl + 0.01, W - 0.6, 0.7, 0.03, 0);
  mb.tail.box(0.95, 0.9, -hl - 0.01, 0.3, 0.45, 0.03, 0); mb.tail.box(-0.95, 0.9, -hl - 0.01, 0.3, 0.45, 0.03, 0);
  mb.trim.box(0, 0.45, -hl - 0.02, W - 0.2, 0.2, 0.06, 0);
  // Räder
  const wg = wheelGeo(0.5, 0.32), hg = wheelGeo(0.3, 0.34);
  for (const z of [3.75, -3.2]) for (const s of [1, -1]) {
    mb.rubber.addGeom(wg, new THREE.Matrix4().makeTranslation(s * 1.08, 0.5, z), null);
    mb.hub.addGeom(hg, new THREE.Matrix4().makeTranslation(s * 1.09, 0.5, z), null);
    mb.trim.box(s * (hw - 0.02), 1.0, z, 0.07, 0.12, 1.25, 0);
  }
  // Innenraum
  const seat = (x, z) => { mb.seat.box(x, 0.86, z, 0.46, 0.12, 0.44, 0); mb.seat.box(x, 1.2, z - 0.2, 0.46, 0.6, 0.08, 0); mb.trim.box(x, 0.62, z, 0.3, 0.42, 0.3, 0); };
  for (let z = -5.2; z < 3.6; z += 0.82) { if (Math.abs(z - 0.1) < 0.9) continue; seat(0.95, z); seat(0.48, z); }
  for (let z = -5.2; z < 3.6; z += 0.82) { if (inDoor(z) || inDoor(z - 0.5) || inDoor(z + 0.5)) continue; seat(-0.95, z); }
  for (let z = -5; z < 5; z += 1.6) { mb.pole.cyl(0.18, 0.42, z, 0.025, 0.025, 2.56, 8, null, false); mb.pole.cyl(-0.45, 0.42, z + 0.8, 0.025, 0.025, 2.56, 8, null, false); }
  mb.pole.box(0.18, 2.75, 0, 0.04, 0.04, 10, 0); mb.pole.box(-0.45, 2.75, 0, 0.04, 0.04, 10, 0);
  mb.ilight.box(0.75, 2.95, 0, 0.18, 0.03, 10.5, 0); mb.ilight.box(-0.75, 2.95, 0, 0.18, 0.03, 10.5, 0);
  // Fahrerplatz
  mb.trim.box(0.7, 0.9, 5.1, 0.9, 0.9, 0.9, 0); mb.trim.box(0.7, 1.35, 5.6, 0.6, 0.06, 0.4, 0);
  // Türflügel (Glas mit Rahmen)
  const leaf = new MB(), leafG = new MB();
  leaf.box(0, 1.5, 0, 0.05, 2.15, 0.06, 0); leaf.box(0, 1.5, 0.56, 0.05, 2.15, 0.06, 0);
  leaf.box(0, 0.45, 0.28, 0.05, 0.06, 0.6, 0); leaf.box(0, 2.55, 0.28, 0.05, 0.06, 0.6, 0);
  leafG.box(0, 1.5, 0.28, 0.02, 2.05, 0.52, 0);
  return finishTemplate(mb, { len: L, hw, doors, floorY: 0.43, roofY: 2.95, leaf: leaf.build(), leafG: leafG.build(), leafW: 0.62, leafX: hw - 0.01 });
}

/* ---------- Altes Zürcher Tram (14 m, einteilig) ---------- */
function buildTramTemplate() {
  const mb = newMBs(['tramBlue', 'tramCream', 'glass', 'trim', 'rubber', 'steel', 'seat', 'floor', 'pole', 'ilight', 'head', 'tail', 'white']);
  const L = 14.2, W = 2.2, hw = W / 2, hl = L / 2;
  const doors = [{ zc: 5.45, half: 0.55, side: -1 }, { zc: 0.0, half: 0.55, side: -1 }, { zc: -5.45, half: 0.55, side: -1 }];
  const inDoor = (z) => doors.some(d => Math.abs(z - d.zc) < d.half + 0.04);
  const FL = 0.86;
  for (const s of [1, -1]) {
    for (let z = -hl + 0.6; z < hl - 0.6; z += 0.25) {
      const zc = z + 0.125;
      if (s < 0 && inDoor(zc)) continue;
      mb.tramBlue.box(s * (hw - 0.03), 1.2, zc, 0.06, 1.3, 0.26, 0);
      mb.tramCream.box(s * (hw - 0.03), 1.92, zc, 0.06, 0.14, 0.26, 0);
    }
    for (let z = -hl + 0.8; z < hl - 0.7; z += 1.1) if (!(s < 0 && inDoor(z))) mb.tramBlue.box(s * (hw - 0.03), 2.4, z, 0.07, 0.85, 0.12, 0);
    let a = -hl + 0.6;
    for (let z = a; z < hl - 0.6; z += 0.1) if (s < 0 && inDoor(z)) { if (z - a > 0.1) mb.glass.box(s * (hw - 0.02), 2.4, (a + z) / 2, 0.03, 0.85, z - a, 0); a = z + 0.1; }
    if (hl - 0.6 - a > 0.1) mb.glass.box(s * (hw - 0.02), 2.4, (a + hl - 0.6) / 2, 0.03, 0.85, hl - 0.6 - a, 0);
    mb.tramCream.box(s * (hw - 0.03), 3.0, 0, 0.06, 0.36, L - 1.1, 0);
    mb.trim.box(s * (hw - 0.02), 0.5, 0, 0.05, 0.2, L - 1.2, 0);
  }
  // Abgerundete Enden (schmaler)
  for (const e of [1, -1]) {
    const z0 = e * (hl - 0.6), z1 = e * hl;
    for (const s of [1, -1]) {
      const mbx = mb;
      const x0 = s * (hw - 0.03), x1 = s * (hw - 0.4);
      const mid = [(x0 + x1) / 2, (z0 + z1) / 2]; const len = Math.hypot(x1 - x0, z1 - z0); const rot = Math.atan2(x1 - x0, z1 - z0);
      mbx.tramBlue.box(mid[0], 1.2, mid[1], 0.06, 1.3, len, rot);
      mbx.glass.box(mid[0], 2.4, mid[1], 0.03, 0.85, len, rot);
      mbx.tramCream.box(mid[0], 3.0, mid[1], 0.06, 0.36, len, rot);
    }
    mb.tramBlue.box(0, 1.2, z1, W - 0.8, 1.3, 0.06, 0);
    mb.glass.box(0, 2.38, z1, W - 0.8, 0.95, 0.03, 0);
    mb.tramCream.box(0, 3.0, z1, W - 0.8, 0.36, 0.06, 0);
    mb.tramCream.box(0, 1.92, z1 + e * 0.01, W - 0.8, 0.14, 0.06, 0);
    mb.head.box(0.42, 0.95, z1 + e * 0.03, 0.22, 0.22, 0.03, 0); mb.head.box(-0.42, 0.95, z1 + e * 0.03, 0.22, 0.22, 0.03, 0);
    mb.trim.box(0, 0.55, z1, W - 0.9, 0.3, 0.1, 0);
    // Liniennummer-Kasten
    mb.trim.box(0, 3.0, z1 + e * 0.04, 0.7, 0.3, 0.04, 0);
  }
  // Dach
  mb.white.box(0, 3.22, 0, W - 0.1, 0.1, L - 0.8, 0);
  mb.tramCream.box(0, 3.19, e2(hl - 0.3), W - 0.6, 0.08, 0.6, 0);
  mb.tramCream.box(0, 3.19, -(hl - 0.3), W - 0.6, 0.08, 0.6, 0);
  mb.trim.box(0, 3.4, 1.5, 1.2, 0.3, 3.0, 0);
  // Stromabnehmer
  mb.steel.box(0, 3.75, 1.5, 0.05, 0.05, 1.6, 0.0);
  mb.steel.addGeom(new THREE.BoxGeometry(0.05, 0.05, 1.7), new THREE.Matrix4().makeRotationX(0.55).setPosition(0, 4.2, 1.2), null);
  mb.steel.addGeom(new THREE.BoxGeometry(0.05, 0.05, 1.7), new THREE.Matrix4().makeRotationX(-0.55).setPosition(0, 4.95, 1.2), null);
  mb.steel.box(0, 5.4, 1.5, 1.6, 0.05, 0.1, 0);
  // Boden, Decke, Drehgestelle
  mb.floor.box(0, FL, 0, W - 0.1, 0.06, L - 0.3, 0);
  mb.white.box(0, 3.15, 0, W - 0.12, 0.02, L - 0.4, 0);
  mb.trim.box(0, 0.6, 0, W - 0.2, 0.5, L - 0.6, 0);
  const wg = wheelGeo(0.36, 0.14);
  for (const z of [4.3, 3.0, -3.0, -4.3]) for (const s of [1, -1]) mb.rubber.addGeom(wg, new THREE.Matrix4().makeTranslation(s * 0.72, 0.36, z), null);
  // Sitze (Holzbänke-Look in Blau)
  const seat = (x, z, dir) => { mb.seat.box(x, FL + 0.45, z, 0.45, 0.1, 0.44, 0); mb.seat.box(x, FL + 0.8, z - dir * 0.2, 0.45, 0.6, 0.06, 0); };
  for (let z = -4.5; z < 4.6; z += 0.9) { if (Math.abs(z) < 1.0) continue; seat(0.72, z, 1); seat(0.28, z, 1); if (!inDoor(z) && !inDoor(z - 0.5) && !inDoor(z + 0.5)) seat(-0.7, z, 1); }
  for (let z = -6; z < 6.5; z += 2) mb.pole.cyl(-0.1, FL, z, 0.025, 0.025, 2.28, 8, null, false);
  mb.ilight.box(0, 3.12, 0, 0.25, 0.03, 12, 0);
  // Führerstand vorne
  mb.trim.box(0, FL + 0.5, hl - 0.9, 1.0, 0.9, 0.5, 0);
  const leaf = new MB(), leafG = new MB();
  leaf.box(0, FL + 1.05, 0, 0.05, 2.2, 0.06, 0); leaf.box(0, FL + 1.05, 0.5, 0.05, 2.2, 0.06, 0);
  leaf.box(0, FL - 0.0, 0.25, 0.05, 0.1, 0.56, 0); leaf.box(0, FL + 2.12, 0.25, 0.05, 0.08, 0.56, 0);
  leafG.box(0, FL + 1.45, 0.25, 0.02, 1.2, 0.46, 0);
  const leafB = new MB(); leafB.box(0, FL + 0.38, 0.25, 0.04, 0.8, 0.46, 0);
  const t = finishTemplate(mb, { len: L, hw, doors, floorY: FL + 0.03, roofY: 3.1, leaf: leaf.build(), leafG: leafG.build(), leafB: leafB.build(), leafW: 0.55, leafX: hw - 0.02, leafMat: 'tramBlue' });
  return t;
}
function e2(v) { return v; }

/* ---------- Londoner U-Bahn-Wagen (16 m) ---------- */
function buildTubeTemplate(cab) {
  const mb = newMBs(['tubeWhite', 'tubeRed', 'tubeBlue', 'tubeGray', 'glass', 'trim', 'moquette', 'floor', 'pole', 'ilight', 'head', 'tail', 'rubber', 'wall']);
  const L = 16, W = 2.62, hw = W / 2, hl = L / 2;
  const FL = 1.05;
  const doors = [];
  for (const zc of [-5.2, 0, 5.2]) for (const side of [1, -1]) doors.push({ zc, half: 0.7, side });
  const inDoor = (z) => Math.abs(z + 5.2) < 0.75 || Math.abs(z) < 0.75 || Math.abs(z - 5.2) < 0.75;
  // Querschnitt: senkrechte Wand bis 2.0, dann Rundung bis 2.95
  const arc = [];
  for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI / 2; arc.push([Math.cos(a) * hw, 2.75 + Math.sin(a) * 0.8, a]); }
  for (let z = -hl + 0.2; z < hl - 0.2; z += 0.5) {
    const z2 = Math.min(z + 0.5, hl - 0.2), zc = (z + z2) / 2, dz = z2 - z;
    for (const s of [1, -1]) {
      if (!inDoor(zc)) {
        mb.tubeBlue.box(s * (hw - 0.03), 0.75, zc, 0.06, 0.6, dz + 0.01, 0);
        mb.tubeWhite.box(s * (hw - 0.03), 1.45, zc, 0.06, 0.8, dz + 0.01, 0);
        if ((Math.round((zc + hl) * 2) % 4) === 0) mb.tubeWhite.box(s * (hw - 0.03), 2.3, zc, 0.07, 0.9, dz + 0.01, 0);
        else mb.glass.box(s * (hw - 0.02), 2.3, zc, 0.03, 0.9, dz + 0.01, 0);
      } else {
        mb.tubeBlue.box(s * (hw - 0.03), 0.62, zc, 0.06, 0.34, dz + 0.01, 0);
        mb.tubeRed.box(s * (hw - 0.03), 3.0 - 0.25, zc, 0.06, 0.5, dz + 0.01, 0);
      }
      // Rundung
      for (let k = 0; k < arc.length - 1; k++) {
        const p = arc[k], q = arc[k + 1];
        const A = [s * p[0], p[1], z], B = [s * q[0], q[1], z], C = [s * q[0], q[1], z2], D = [s * p[0], p[1], z2];
        const nx = s * Math.cos((p[2] + q[2]) / 2), ny = Math.sin((p[2] + q[2]) / 2);
        const mat = k < 2 && !inDoor(zc) ? mb.glass : (k < 2 ? mb.tubeRed : mb.tubeWhite);
        if (s > 0) mat.quad(A, B, C, D, null, null, [nx, ny, 0]); else mat.quad(A, D, C, B, null, null, [nx, ny, 0]);
        // Innenseite
        const im = k < 2 ? null : mb.wall;
        if (im) { if (s > 0) im.quad(A, D, C, B, null, null, [-nx, -ny, 0]); else im.quad(A, B, C, D, null, null, [-nx, -ny, 0]); }
      }
    }
  }
  // Boden, Unterbau, Drehgestelle
  mb.floor.box(0, FL, 0, W - 0.12, 0.06, L - 0.3, 0);
  mb.tubeGray.box(0, 0.6, 0, W - 0.3, 0.7, L - 1.0, 0);
  const wg = wheelGeo(0.38, 0.16);
  for (const z of [6.2, 4.9, -4.9, -6.2]) for (const s of [1, -1]) mb.rubber.addGeom(wg, new THREE.Matrix4().makeTranslation(s * 0.72, 0.38, z), null);
  // Stirnseiten
  for (const e of [1, -1]) {
    const z1 = e * (hl - 0.05);
    const isCab = (cab === 'front' && e > 0) || (cab === 'rear' && e < 0) || cab === 'both';
    if (isCab) {
      mb.tubeRed.box(0, 1.1, z1 + e * 0.15, W - 0.1, 1.2, 0.3, 0);
      mb.glass.box(0, 2.25, z1 + e * 0.12, W - 0.5, 1.05, 0.04, 0);
      mb.tubeRed.box(0, 3.1, z1 + e * 0.1, W - 0.3, 0.65, 0.2, 0);
      mb.head.box(0.85, 1.25, z1 + e * 0.31, 0.25, 0.12, 0.02, 0); mb.head.box(-0.85, 1.25, z1 + e * 0.31, 0.25, 0.12, 0.02, 0);
      mb.tail.box(0.85, 1.05, z1 + e * 0.31, 0.2, 0.08, 0.02, 0); mb.tail.box(-0.85, 1.05, z1 + e * 0.31, 0.2, 0.08, 0.02, 0);
      mb.trim.box(0, 0.5, z1 + e * 0.2, W - 0.4, 0.3, 0.3, 0);
    } else {
      mb.tubeGray.box(0, 2.2, z1, W - 0.1, 2.6, 0.08, 0);
      mb.glass.box(0, 2.2, z1 + e * 0.01, 0.7, 1.0, 0.03, 0);
      mb.trim.box(0, 2.0, z1 + e * 0.15, 1.1, 2.4, 0.3, 0);
    }
  }
  // Innen: Längssitze, Haltestangen, Licht
  for (const s of [1, -1]) {
    for (const [z0, z1] of [[-hl + 0.6, -5.95], [-4.45, -0.75], [0.75, 4.45], [5.95, hl - 0.6]]) {
      if (z1 - z0 < 0.4) continue;
      mb.moquette.box(s * (hw - 0.45), FL + 0.45, (z0 + z1) / 2, 0.5, 0.1, z1 - z0, 0);
      mb.moquette.box(s * (hw - 0.17), FL + 0.8, (z0 + z1) / 2, 0.08, 0.6, z1 - z0, 0);
      mb.trim.box(s * (hw - 0.45), FL + 0.22, (z0 + z1) / 2, 0.42, 0.42, z1 - z0, 0);
    }
  }
  for (let z = -6.8; z <= 6.8; z += 1.7) for (const s of [1, -1]) if (!inDoor(z)) mb.pole.cyl(s * 0.75, FL, z, 0.025, 0.025, 2.0, 8, null, false);
  mb.pole.box(0.6, FL + 2.0, 0, 0.04, 0.04, L - 1, 0); mb.pole.box(-0.6, FL + 2.0, 0, 0.04, 0.04, L - 1, 0);
  mb.ilight.box(0.55, 3.45, 0, 0.22, 0.03, L - 1, 0); mb.ilight.box(-0.55, 3.45, 0, 0.22, 0.03, L - 1, 0);
  mb.wall.box(0, 3.5, 0, 1.0, 0.03, L - 0.4, 0);
  const leaf = new MB(), leafG = new MB();
  leaf.box(0, FL + 0.55, 0.35, 0.05, 1.1, 0.7, 0); leaf.box(0, FL + 1.75, 0.06, 0.05, 1.3, 0.12, 0); leaf.box(0, FL + 1.75, 0.64, 0.05, 1.3, 0.12, 0); leaf.box(0, FL + 2.35, 0.35, 0.05, 0.1, 0.7, 0);
  leafG.box(0, FL + 1.75, 0.35, 0.02, 1.2, 0.46, 0);
  return finishTemplate(mb, { len: L, hw, doors, floorY: FL + 0.03, roofY: 3.5, leaf: leaf.build(), leafG: leafG.build(), leafW: 0.7, leafX: hw - 0.01, leafMat: 'tubeRed' });
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

/* ---------- Fahrzeug ---------- */
class Vehicle {
  constructor(kind, line, path, stops, opts) {
    this.kind = kind; this.line = line; this.path = path; this.stops = stops;
    this.vmax = opts.vmax; this.acc = opts.acc || 1.1; this.dec = opts.dec || 1.4;
    this.cars = [];
    this.s = opts.s0 || 0; this.v = 0; this.state = 'drive'; this.dwell = 0; this.dwellT = 0; this.door = 0;
    this.blockedT = 0; this.ignoreT = 0; this.label = opts.label || ''; this.dest = '';
    this.group = new THREE.Group();
    this.visibleFar = opts.visibleFar || 380;
    const tpl = opts.templates;
    let z = 0;
    const gap = opts.gap || 0.8;
    this.totalLen = tpl.reduce((a, t) => a + t.len, 0) + gap * (tpl.length - 1);
    for (let i = 0; i < tpl.length; i++) {
      const t = tpl[i];
      const g = new THREE.Group();
      for (const p of t.parts) {
        const m = new THREE.Mesh(p.geo, p.mat);
        m.castShadow = p.key !== 'glass' && p.key !== 'ilight';
        g.add(m);
      }
      const doors = [];
      for (const d of t.doors) {
        const leaves = [];
        for (const dir of [1, -1]) {
          const lg = new THREE.Group();
          const lm = new THREE.Mesh(t.leaf, VEH.mats[t.leafMat || 'trim']);
          const lgl = new THREE.Mesh(t.leafG, VEH.mats.glass);
          lg.add(lm); lg.add(lgl);
          if (t.leafB) lg.add(new THREE.Mesh(t.leafB, VEH.mats[t.leafMat || 'trim']));
          // Flügel: dir=+1 nach vorne, -1 nach hinten
          lg.scale.z = dir;
          lg.userData = { dir, zc: d.zc };
          g.add(lg);
          leaves.push(lg);
        }
        doors.push({ zc: d.zc, half: d.half, side: d.side, leaves, leafW: t.leafW, leafX: t.leafX });
      }
      if (opts.signMat) {
        const sm = new THREE.Mesh(new THREE.PlaneGeometry(t.hw * 1.5, 0.3), opts.signMat);
        if (kind === 'bus') sm.position.set(0, 2.78, t.len / 2 + 0.02);
        else if (kind === 'tram') sm.position.set(0, 3.0, t.len / 2 + 0.07);
        else sm.position.set(0, 3.1, t.len / 2 + 0.32);
        if (kind !== 'metro' || i === 0) g.add(sm);
        if (kind === 'bus') { const s2 = sm.clone(); s2.scale.set(0.8, 1, 1); s2.position.set(-t.hw - 0.01, 2.75, 2.5); s2.rotation.y = -Math.PI / 2; g.add(s2); }
      }
      g.rotation.order = 'YXZ';
      this.group.add(g);
      const offset = this.totalLen / 2 - t.len / 2 - z;
      z += t.len + gap;
      this.cars.push({ g, tpl: t, offset, doors, hw: t.hw, hl: t.len / 2, floorY: t.floorY, roofY: t.roofY, veh: this, idx: i });
    }
    this.nextStop = 0;
    this.syncNextStop();
    this.place();
  }
  syncNextStop() {
    if (!this.stops.length) return;
    const L = this.path.L;
    let best = 0, bd = 1e18;
    for (let i = 0; i < this.stops.length; i++) { const d = ((this.stops[i].s - this.s) % L + L) % L; if (d < bd) { bd = d; best = i; } }
    this.nextStop = best;
  }
  doorSide() { return this.kind === 'metro' ? 1 : -1; }
  currentStop() { return this.stops.length ? this.stops[this.nextStop] : null; }
  update(dt, obstacleFn) {
    const L = this.path.L;
    if (this.state === 'dwell') {
      this.dwell -= dt; this.dwellT += dt;
      const target = (this.dwellT > 0.5 && this.dwell > 1.7) ? 1 : 0;
      if (target === 0 && this.door > 0.99 && this.onDoorsClose) this.onDoorsClose(this);
      this.door = clamp(this.door + (target ? dt : -dt) / 1.1, 0, 1);
      if (this.dwell <= 0 && this.door <= 0.001) {
        this.state = 'drive';
        this.nextStop = (this.nextStop + 1) % this.stops.length;
      }
    } else {
      let vt = Math.min(this.vmax, this.path.speedAt(this.s + this.v * 1.5));
      let dist = 1e9;
      if (this.stops.length) {
        dist = ((this.stops[this.nextStop].s - this.s) % L + L) % L;
        if (dist > L - 3) dist = 0;
        vt = Math.min(vt, Math.sqrt(2 * this.dec * Math.max(0, dist - 0.05)) + 0.3);
      }
      if (obstacleFn) {
        const blocked = obstacleFn(this);
        if (blocked && this.ignoreT <= 0) { vt = 0; this.blockedT += dt; if (this.blockedT > 7 && blocked !== 'player') { this.ignoreT = 4; this.blockedT = 0; } }
        else this.blockedT = 0;
        if (this.ignoreT > 0) this.ignoreT -= dt;
      }
      if (vt > this.v) this.v = Math.min(vt, this.v + this.acc * dt);
      else this.v = Math.max(vt, this.v - 3.0 * dt);
      const ds = this.v * dt;
      if (this.stops.length && dist <= ds + 0.15 && dist < 2.5) {
        this.s = this.stops[this.nextStop].s; this.v = 0;
        this.state = 'dwell'; this.dwell = 10; this.dwellT = 0;
        if (this.onArrive) this.onArrive(this);
      } else this.s = (this.s + ds) % L;
    }
  }
  place() {
    const P = this.path;
    const f = {}, r = {};
    for (const c of this.cars) {
      const sc = this.s + c.offset;
      P.at(sc + c.hl * 0.62, f); P.at(sc - c.hl * 0.62, r);
      const x = (f.x + r.x) / 2, y = (f.y + r.y) / 2, z = (f.z + r.z) / 2;
      c.g.position.set(x, y, z);
      c.g.rotation.y = Math.atan2(f.x - r.x, f.z - r.z);
      c.g.rotation.x = -Math.atan2(f.y - r.y, Math.hypot(f.x - r.x, f.z - r.z));
      // Türen
      const side = this.doorSide();
      for (const d of c.doors) {
        const open = d.side === side ? this.door : 0;
        for (const lg of d.leaves) {
          const dir = lg.userData.dir;
          lg.position.set(d.side * (d.leafX + open * 0.06), 0, d.zc + dir * (0.02 + open * d.leafW * 0.95));
        }
      }
      c.g.updateMatrixWorld(true);
    }
  }
  /* Spieler-Kollision und Einsteigen: Weltpunkt -> lokale Koordinaten eines Wagens */
  toLocal(c, x, y, z) {
    const g = c.g;
    const dx = x - g.position.x, dz = z - g.position.z;
    const yaw = g.rotation.y, cs = Math.cos(yaw), sn = Math.sin(yaw);
    return [dx * cs - dz * sn, y - g.position.y, dx * sn + dz * cs];
  }
  toWorld(c, lx, ly, lz) {
    const g = c.g;
    const yaw = g.rotation.y, cs = Math.cos(yaw), sn = Math.sin(yaw);
    return [g.position.x + lx * cs + lz * sn, g.position.y + ly, g.position.z - lx * sn + lz * cs];
  }
  doorAt(c, lz, sideSign) {
    if (this.door < 0.75) return null;
    for (const d of c.doors) if (d.side === sideSign && d.side === this.doorSide() && Math.abs(lz - d.zc) < d.half - 0.15) return d;
    return null;
  }
}

/* ---------- Erzeugung aller Linienfahrzeuge ---------- */
function spawnTransitVehicles(scene) {
  initVehicleMats();
  const busT = buildBusTemplate();
  const tramT = buildTramTemplate();
  const tubeF = buildTubeTemplate('front'), tubeM = buildTubeTemplate('none'), tubeR = buildTubeTemplate('rear');
  VEH.templates = { busT, tramT };
  for (const line of TRANSIT.busLines) {
    const n = line.path.L > 6000 ? 3 : 2;
    const sign = destTex(line.num, line.terminusB || 'Rundkurs', line.color);
    for (let k = 0; k < n; k++) {
      const v = new Vehicle('bus', line, line.path, line.stopList, { vmax: 12.5, acc: 1.2, dec: 1.4, s0: line.path.L * k / n, templates: [busT], signMat: sign, label: 'Bus ' + line.num });
      scene.add(v.group); VEH.list.push(v);
    }
  }
  const tram = TRANSIT.tram;
  if (tram) {
    const sign = destTex(6, 'ETH / Venezia', '#ffffff');
    for (let k = 0; k < 3; k++) {
      const v = new Vehicle('tram', { num: 6, color: '#1b5db5', name: 'Tram 6' }, tram.path, tram.stopList, { vmax: 11, acc: 0.9, dec: 1.1, s0: tram.path.L * k / 3, templates: [tramT], signMat: sign, label: 'Tram 6' });
      scene.add(v.group); VEH.list.push(v);
    }
  }
  for (const line of TRANSIT.metro) {
    const n = 3;
    const sign = destTex(line.name, line.stations[line.stations.length - 1].name, line.color);
    for (let k = 0; k < n; k++) {
      const v = new Vehicle('metro', line, line.path, line.stopList, { vmax: 19, acc: 1.1, dec: 1.2, s0: line.path.L * k / n, templates: [tubeF, tubeM, tubeM, tubeR], gap: 0.7, signMat: sign, label: line.name, visibleFar: 400 });
      v.underground = true;
      TRANSIT.ugGroup.add(v.group); VEH.list.push(v);
    }
  }
  VEH.obstacles = new SHash(25);
}

/* Alle Hindernisse (Fahrzeuge, Autos, Spieler) in den Hash */
function rebuildObstacles(extra) {
  const H = VEH.obstacles;
  H.m.clear();
  for (const v of VEH.list) {
    if (v.kind === 'metro') continue;
    const c = v.cars[0];
    const p = c.g.position;
    const o = { x: p.x, z: p.z, r: c.hl, veh: v, yaw: c.g.rotation.y };
    H.insert(o, p.x - c.hl, p.z - c.hl, p.x + c.hl, p.z + c.hl);
  }
  if (extra) for (const o of extra) H.insert(o, o.x - o.r, o.z - o.r, o.x + o.r, o.z + o.r);
}

/* Steht etwas vor dem Fahrzeug? Gibt 'player', true oder false zurück. */
function obstacleAhead(v, px, pz, dx, dz, hl, range, selfObj) {
  let hit = false;
  const H = VEH.obstacles;
  const cx = px + dx * (hl + range / 2), cz = pz + dz * (hl + range / 2);
  const R = range / 2 + 3;
  H.query(cx - R, cz - R, cx + R, cz + R, (o) => {
    if (o.veh === v || o === selfObj) return;
    const rx = o.x - px, rz = o.z - pz;
    const along = rx * dx + rz * dz;
    const lat = Math.abs(rx * dz - rz * dx);
    const orr = o.player ? 0.4 : Math.min(o.r, 3);
    if (along > hl * 0.5 && along < hl + range + orr && lat < 1.5 + (o.player ? 0.5 : 1.0)) {
      // Gegenverkehr ignorieren (fährt entgegen und nicht in der eigenen Spur)
      if (o.yaw !== undefined && !o.player) {
        const odx = Math.sin(o.yaw), odz = Math.cos(o.yaw);
        if (odx * dx + odz * dz < -0.5) return;
      }
      hit = o.player ? 'player' : true;
      if (o.player) return true;
    }
  });
  return hit;
}

function updateTransit(dt, camPos, underground, playerObs) {
  for (const v of VEH.list) {
    const c = v.cars[0];
    const fn = v.kind === 'metro' ? null : (veh) => {
      const p = c.g.position;
      const range = Math.max(5, veh.v * veh.v / (2 * 2.5) + 4);
      return obstacleAhead(veh, p.x, p.z, Math.sin(c.g.rotation.y), Math.cos(c.g.rotation.y), c.hl, range, null);
    };
    v.update(dt, fn);
    const p = c.g.position;
    const d = Math.hypot(p.x - camPos.x, p.z - camPos.z);
    const vis = v.underground ? (underground && d < v.visibleFar) : d < v.visibleFar;
    v.group.visible = !!(vis || v.riding);
    if (vis || v.riding) v.place();
    else { // Position grob aktualisieren für Hindernisse
      const P = v.path.at(v.s);
      c.g.position.set(P.x, P.y, P.z); c.g.rotation.y = Math.atan2(P.dx, P.dz);
    }
  }
}
