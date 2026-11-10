/* ================= ASSET: ALTES ZÜRCHER TRAM (14 m, einteilig) =================
   Blau mit cremefarbenem Band, drei Türen rechts, Stromabnehmer, Hochflur. */

function buildTramAsset() {
  const mb = assetSlots();
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
  mb.tramCream.box(0, 3.19, hl - 0.3, W - 0.6, 0.08, 0.6, 0);
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
  mb.iTrim.box(0, FL + 0.5, hl - 0.9, 1.0, 0.9, 0.5, 0);
  const leaf = new MB(), leafG = new MB();
  leaf.box(0, FL + 1.05, 0, 0.05, 2.2, 0.06, 0); leaf.box(0, FL + 1.05, 0.5, 0.05, 2.2, 0.06, 0);
  leaf.box(0, FL - 0.0, 0.25, 0.05, 0.1, 0.56, 0); leaf.box(0, FL + 2.12, 0.25, 0.05, 0.08, 0.56, 0);
  leafG.box(0, FL + 1.45, 0.25, 0.02, 1.2, 0.46, 0);
  const leafB = new MB(); leafB.box(0, FL + 0.38, 0.25, 0.04, 0.8, 0.46, 0);
  return finishAsset('tram', mb, { kind: 'tram', label: 'Zürcher Tram', len: L, hw, doors, floorY: FL + 0.03, roofY: 3.1,
    far: { base: 0.5, band0: 1.9, band1: 2.85, top: 3.3, lower: 0x1b5db5, upper: 0xf3efe3, wheels: true },
    signs: [{ x: 0, y: 3.0, z: L / 2 + 0.07, w: hw * 1.5, h: 0.3 }] },
    { frame: leaf.build(), glass: leafG.build(), panel: leafB.build(), w: 0.55, x: hw - 0.02, color: 0x1b5db5 });
}
