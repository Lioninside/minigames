/* ================= ASSET: LONDONER U-BAHN-WAGEN (16 m) =================
   Rundes Tube-Profil, rote Türen auf beiden Seiten, Längssitze mit Moquette.
   Varianten: Führerwagen vorne/hinten und Mittelwagen. */

function buildTubeAsset(cab) {
  const mb = assetSlots();
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
      mb.iTrim.box(s * (hw - 0.45), FL + 0.22, (z0 + z1) / 2, 0.42, 0.42, z1 - z0, 0);
    }
  }
  for (let z = -6.8; z <= 6.8; z += 1.7) for (const s of [1, -1]) if (!inDoor(z)) mb.pole.cyl(s * 0.75, FL, z, 0.025, 0.025, 2.0, 8, null, false);
  mb.pole.box(0.6, FL + 2.0, 0, 0.04, 0.04, L - 1, 0); mb.pole.box(-0.6, FL + 2.0, 0, 0.04, 0.04, L - 1, 0);
  mb.ilight.box(0.55, 3.45, 0, 0.22, 0.03, L - 1, 0); mb.ilight.box(-0.55, 3.45, 0, 0.22, 0.03, L - 1, 0);
  mb.wall.box(0, 3.5, 0, 1.0, 0.03, L - 0.4, 0);
  const leaf = new MB(), leafG = new MB();
  leaf.box(0, FL + 0.55, 0.35, 0.05, 1.1, 0.7, 0); leaf.box(0, FL + 1.75, 0.06, 0.05, 1.3, 0.12, 0); leaf.box(0, FL + 1.75, 0.64, 0.05, 1.3, 0.12, 0); leaf.box(0, FL + 2.35, 0.35, 0.05, 0.1, 0.7, 0);
  leafG.box(0, FL + 1.75, 0.35, 0.02, 1.2, 0.46, 0);
  return finishAsset('tube_' + cab, mb, { kind: 'metro', label: 'U-Bahn-Wagen (' + ({ front: 'Führerwagen vorne', rear: 'Führerwagen hinten', none: 'Mittelwagen', both: 'beidseitig' })[cab] + ')', len: L, hw, doors, floorY: FL + 0.03, roofY: 3.5,
    far: { base: 0.45, band0: 1.85, band1: 2.75, top: 3.55, lower: 0xe6e8ea, upper: 0xe6e8ea, wheels: true },
    signs: cab === 'front' ? [{ x: 0, y: 3.1, z: L / 2 + 0.32, w: hw * 1.5, h: 0.3 }] : [] },
    { frame: leaf.build(), glass: leafG.build(), w: 0.7, x: hw - 0.01, color: 0xd2131b });
}
