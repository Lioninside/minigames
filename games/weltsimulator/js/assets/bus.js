/* ================= ASSET: STADTBUS (12 m, Niederflur) =================
   Blau-weiss, drei Doppeltüren rechts, Innenraum mit Sitzen und Haltestangen. */

function buildBusAsset() {
  const mb = assetSlots();
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
  const seat = (x, z) => { mb.seat.box(x, 0.86, z, 0.46, 0.12, 0.44, 0); mb.seat.box(x, 1.2, z - 0.2, 0.46, 0.6, 0.08, 0); mb.iTrim.box(x, 0.62, z, 0.3, 0.42, 0.3, 0); };
  for (let z = -5.2; z < 3.6; z += 0.82) { if (Math.abs(z - 0.1) < 0.9) continue; seat(0.95, z); seat(0.48, z); }
  for (let z = -5.2; z < 3.6; z += 0.82) { if (inDoor(z) || inDoor(z - 0.5) || inDoor(z + 0.5)) continue; seat(-0.95, z); }
  for (let z = -5; z < 5; z += 1.6) { mb.pole.cyl(0.18, 0.42, z, 0.025, 0.025, 2.56, 8, null, false); mb.pole.cyl(-0.45, 0.42, z + 0.8, 0.025, 0.025, 2.56, 8, null, false); }
  mb.pole.box(0.18, 2.75, 0, 0.04, 0.04, 10, 0); mb.pole.box(-0.45, 2.75, 0, 0.04, 0.04, 10, 0);
  mb.ilight.box(0.75, 2.95, 0, 0.18, 0.03, 10.5, 0); mb.ilight.box(-0.75, 2.95, 0, 0.18, 0.03, 10.5, 0);
  // Fahrerplatz
  mb.iTrim.box(0.7, 0.9, 5.1, 0.9, 0.9, 0.9, 0); mb.iTrim.box(0.7, 1.35, 5.6, 0.6, 0.06, 0.4, 0);
  // Türflügel (Glas mit Rahmen)
  const leaf = new MB(), leafG = new MB();
  leaf.box(0, 1.5, 0, 0.05, 2.15, 0.06, 0); leaf.box(0, 1.5, 0.56, 0.05, 2.15, 0.06, 0);
  leaf.box(0, 0.45, 0.28, 0.05, 0.06, 0.6, 0); leaf.box(0, 2.55, 0.28, 0.05, 0.06, 0.6, 0);
  leafG.box(0, 1.5, 0.28, 0.02, 2.05, 0.52, 0);
  return finishAsset('bus', mb, { kind: 'bus', label: 'Stadtbus', len: L, hw, doors, floorY: 0.43, roofY: 2.95,
    far: { base: 0.35, band0: 1.1, band1: 2.55, top: 3.05, lower: 0x1d55a8, upper: 0xf1f1ee, wheels: true },
    signs: [{ x: 0, y: 2.78, z: L / 2 + 0.02, w: hw * 1.5, h: 0.3 }, { x: -hw - 0.01, y: 2.75, z: 2.5, w: hw * 1.2, h: 0.3, ry: -Math.PI / 2 }] },
    { frame: leaf.build(), glass: leafG.build(), w: 0.62, x: hw - 0.01, color: 0x18191b });
}
