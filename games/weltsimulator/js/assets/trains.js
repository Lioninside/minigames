/* ================= ASSETS: S-BAHN, INTERREGIO, FORCHBAHN =================
   - S5: Zürcher S-Bahn 1. Generation (DPZ): Lok Re 450 + drei Doppelstockwagen, der letzte mit
     Führerstand (Steuerwagen).
   - S2: Zürcher S-Bahn 2. Generation (DTZ): vierteiliger Doppelstock-Triebzug mit runder Front.
   - IR7: Lok Re 460 + fünf einstöckige Reisezugwagen.
   - T18: rote Forchbahn (zweiteiliges Gelenktram).
   Alle über den Asset-Kern (drei Detailstufen, Türgruppen, Vertexfarben-Slots). */

Object.assign(ASSET_KEYS, {
  sbWhite: ['paint', 0xf3f3f0], sbBlue: ['paint', 0x1f4196], sbGrey: ['paint', 0x7f8890], sbRed: ['paint', 0xd0212a], sbDark: ['matte', 0x23272c],
  reRed: ['paint', 0xd8111b], irGrey: ['paint', 0xe1e3e4], irRed: ['paint', 0xc8141c], roofGrey: ['matte', 0x7c838a], panto: ['matte', 0x3b3f43],
  forchRed: ['paint', 0xc4122f], forchCream: ['paint', 0xf1ece2]
});

/* Fensterreihe einer Wagenseite: Glas mit Pfeilern (Pfeiler in der Wagenfarbe) */
function windowRow(mb, colKey, s, hw, z0, z1, y0, y1, pitch, skip) {
  for (let z = z0; z < z1 - 0.05; z += pitch) {
    const za = z, zb = Math.min(z + pitch, z1), zc = (za + zb) / 2;
    if (skip && skip(zc)) { mb[colKey].box(s * (hw - 0.03), (y0 + y1) / 2, zc, 0.06, y1 - y0, zb - za + 0.01, 0); continue; }
    const pier = 0.22;
    mb.glass.box(s * (hw - 0.02), (y0 + y1) / 2, zc, 0.03, y1 - y0, zb - za - pier, 0);
    mb[colKey].box(s * (hw - 0.03), (y0 + y1) / 2, zb - pier / 2, 0.06, y1 - y0, pier, 0);
  }
}
function bogies(mb, hl, r) {
  const wg = wheelGeo(r, 0.16);
  for (const zc of [hl - 2.6, -(hl - 2.6)]) {
    mb.trim.box(0, r + 0.1, zc, 2.2, 0.35, 3.0, 0);
    for (const dz of [-1.25, 1.25]) for (const s of [1, -1]) mb.rubber.addGeom(wg, new THREE.Matrix4().makeTranslation(s * 0.75, r, zc + dz), null);
  }
}
function pantograph(mb, z, roofY) {
  mb.panto.box(0, roofY + 0.12, z, 1.2, 0.18, 1.0, 0);
  mb.steel.addGeom(new THREE.BoxGeometry(0.05, 0.05, 1.5), new THREE.Matrix4().makeRotationX(0.6).setPosition(0, roofY + 0.62, z - 0.2), null);
  mb.steel.addGeom(new THREE.BoxGeometry(0.05, 0.05, 1.5), new THREE.Matrix4().makeRotationX(-0.6).setPosition(0, roofY + 1.28, z - 0.2), null);
  mb.steel.box(0, roofY + 1.66, z, 1.7, 0.05, 0.12, 0);
}
/* Türflügel (Rahmen + Glas), wie beim Tube-Wagen */
function doorLeaf(FL, h, w, color) {
  const leaf = new MB(), leafG = new MB();
  leaf.box(0, FL + h / 2, 0.04, 0.05, h, 0.08, 0); leaf.box(0, FL + h / 2, w - 0.04, 0.05, h, 0.08, 0);
  leaf.box(0, FL + 0.05, w / 2, 0.05, 0.1, w, 0); leaf.box(0, FL + h - 0.05, w / 2, 0.05, 0.1, w, 0);
  leaf.box(0, FL + h * 0.3, w / 2, 0.05, h * 0.45, w - 0.12, 0);
  leafG.box(0, FL + h * 0.72, w / 2, 0.02, h * 0.42, w - 0.12, 0);
  return { frame: leaf.build(), glass: leafG.build(), w, color };
}

/* ---------- Doppelstockwagen (S-Bahn) ----------
   gen 1: weiss mit blauem Fensterband unten, grauer Schürze; gen 2: weiss, blaue Türen, dunkle Front.
   cab: 'none' | 'front' (+z) | 'rear' (-z) */
function buildDoubleDeckAsset(gen, cab) {
  const name = 'dd' + gen + '_' + cab;
  if (ASSETS.list[name]) return ASSETS.list[name];
  const mb = assetSlots();
  const L = gen === 2 ? 25.0 : 26.8, W = 2.8, hw = W / 2, hl = L / 2, FL = 0.6, UP = 2.55, TOP = 4.45;
  const dz = hl - 5.0;
  const doors = [];
  for (const zc of [dz, -dz]) for (const side of [1, -1]) doors.push({ zc, half: 0.8, side });
  const inDoor = (z) => Math.abs(Math.abs(z) - dz) < 0.82;
  const body = gen === 2 ? 'sbWhite' : 'sbWhite', band = gen === 2 ? 'sbGrey' : 'sbBlue', skirt = gen === 2 ? 'sbBlue' : 'sbGrey';
  const endLen = 3.6; // einstöckige Enden über den Drehgestellen
  for (const s of [1, -1]) {
    // Schürze und Rahmen
    mb[skirt].box(s * (hw - 0.03), 0.62, 0, 0.06, 0.55, L - 0.2, 0);
    // unteres Fensterband (im Mittelteil tief, an den Enden höher)
    windowRow(mb, band, s, hw, -hl + endLen, hl - endLen, 1.0, 2.05, 1.85, inDoor);
    mb[band].box(s * (hw - 0.03), 0.92, 0, 0.06, 0.2, L - 2 * endLen, 0);
    // Zwischenband (Boden des Oberdecks)
    mb[body].box(s * (hw - 0.03), 2.45, 0, 0.06, 0.8, L - 0.3, 0);
    // oberes Fensterband
    windowRow(mb, body, s, hw, -hl + endLen, hl - endLen, 2.95, 3.85, 1.85, null);
    mb[body].box(s * (hw - 0.03), 4.15, 0, 0.06, 0.6, L - 0.3, 0);
    // Enden: ein Fenster, sonst Wagenfarbe
    for (const e of [1, -1]) {
      const zc = e * (hl - endLen / 2 - 0.1);
      mb[body].box(s * (hw - 0.03), 1.45, zc, 0.06, 1.1, endLen - 0.2, 0);
      if (!(cab !== 'none' && ((cab === 'front' && e > 0) || (cab === 'rear' && e < 0)))) mb.glass.box(s * (hw - 0.02), 2.5, zc, 0.03, 0.8, 1.6, 0);
      else mb[body].box(s * (hw - 0.03), 2.5, zc, 0.06, 0.8, endLen - 0.2, 0);
      mb[body].box(s * (hw - 0.03), 3.4, zc, 0.06, 1.1, endLen - 0.2, 0);
    }
    // Türbereiche: über der Tür Wagenfarbe
    for (const zc of [dz, -dz]) mb[gen === 2 ? 'sbBlue' : body].box(s * (hw - 0.03), 2.3, zc, 0.065, 0.5, 1.7, 0);
    // ZVV-Logoband
    mb.sbRed.box(s * (hw - 0.01), 3.98, hl * 0.35, 0.03, 0.14, 1.2, 0);
  }
  // Dach
  mb.roofGrey.box(0, TOP + 0.08, 0, W - 0.12, 0.16, L - 0.25, 0);
  mb[body].box(0, TOP - 0.02, 0, W - 0.04, 0.08, L - 0.2, 0);
  // Stirnseiten
  for (const e of [1, -1]) {
    const z1 = e * (hl - 0.05);
    const isCab = (cab === 'front' && e > 0) || (cab === 'rear' && e < 0);
    if (isCab) {
      if (gen === 2) {
        // runde Front: dunkle Maske mit grosser Scheibe, schräg
        mb.sbDark.box(0, 2.5, z1 + e * 0.35, W - 0.3, 3.0, 0.6, 0);
        mb.glass.addGeom(new THREE.BoxGeometry(W - 0.5, 1.5, 0.05), new THREE.Matrix4().makeRotationX(-e * 0.35).setPosition(0, 3.0, z1 + e * 0.62), null);
        mb.sbWhite.box(0, 1.1, z1 + e * 0.45, W - 0.2, 1.2, 0.8, 0);
        mb.sbBlue.box(0, 0.62, z1 + e * 0.5, W - 0.25, 0.4, 0.9, 0);
        mb.sbWhite.box(0, 4.2, z1 + e * 0.15, W - 0.2, 0.5, 0.4, 0);
      } else {
        mb.sbWhite.box(0, 2.0, z1 + e * 0.12, W - 0.1, 3.2, 0.24, 0);
        mb.glass.box(0, 3.15, z1 + e * 0.25, W - 0.6, 0.85, 0.04, 0);
        mb.sbRed.box(0, 1.25, z1 + e * 0.25, W - 0.2, 0.3, 0.04, 0);
        mb.sbBlue.box(0, 0.75, z1 + e * 0.25, W - 0.2, 0.5, 0.04, 0);
      }
      const zl = z1 + e * (gen === 2 ? 0.86 : 0.27);
      mb.head.box(0.85, 1.25, zl, 0.3, 0.14, 0.02, 0); mb.head.box(-0.85, 1.25, zl, 0.3, 0.14, 0.02, 0); mb.head.box(0, 4.0, zl - e * 0.3, 0.25, 0.12, 0.02, 0);
      mb.tail.box(0.62, 1.0, zl, 0.16, 0.1, 0.02, 0); mb.tail.box(-0.62, 1.0, zl, 0.16, 0.1, 0.02, 0);
    } else {
      mb.sbGrey.box(0, 2.3, z1, W - 0.1, 4.1, 0.08, 0);
      mb.trim.box(0, 2.0, z1 + e * 0.18, 1.2, 2.6, 0.35, 0);
    }
  }
  bogies(mb, hl, 0.46);
  mb.trim.box(0, 0.3, 0, W - 0.5, 0.3, L - 6.5, 0);
  // Innen: Boden, Oberdeck, Sitze, Licht
  mb.floor.box(0, FL, 0, W - 0.12, 0.06, L - 0.3, 0);
  mb.floor.box(0, UP, 0, W - 0.12, 0.08, L - 2 * endLen - 0.4, 0);
  for (let z = -hl + endLen + 0.8; z < hl - endLen - 0.5; z += 1.85) {
    if (inDoor(z) || inDoor(z + 0.5) || inDoor(z - 0.5)) continue;
    for (const x of [-0.85, -0.4, 0.4, 0.85]) {
      mb.seat.box(x, FL + 0.45, z, 0.42, 0.1, 0.46, 0); mb.seat.box(x, FL + 0.82, z - 0.22, 0.42, 0.65, 0.07, 0);
      mb.seat.box(x, UP + 0.45, z, 0.42, 0.1, 0.46, 0); mb.seat.box(x, UP + 0.82, z - 0.22, 0.42, 0.65, 0.07, 0);
    }
  }
  mb.ilight.box(0, UP - 0.08, 0, 0.3, 0.03, L - 2 * endLen - 1, 0);
  mb.ilight.box(0, TOP - 0.1, 0, 0.3, 0.03, L - 1.5, 0);
  mb.wall.box(0, TOP - 0.06, 0, W - 0.2, 0.03, L - 0.6, 0);
  if (cab === 'front' && gen === 1) pantograph(mb, hl - 6, TOP + 0.16);
  if (gen === 2 && cab === 'none') pantograph(mb, 0, TOP + 0.16);
  const lab = gen === 1 ? 'S-Bahn 1. Generation, Doppelstockwagen' : 'S-Bahn 2. Generation, Doppelstock-Triebwagen';
  return finishAsset(name, mb, { kind: 'sbahn', label: lab + (cab === 'none' ? '' : ' mit Führerstand'), len: L, hw, doors, floorY: FL + 0.03, roofY: TOP,
    far: { base: 0.4, band0: 0.95, band1: 3.85, top: 4.55, lower: gen === 2 ? 0x1f4196 : 0x7f8890, upper: 0xf3f3f0, wheels: true },
    signs: cab !== 'none' ? [{ x: 0, y: 4.05, z: (cab === 'front' ? 1 : -1) * (hl + (gen === 2 ? 0.66 : 0.3)), w: hw * 1.3, h: 0.28, ry: cab === 'front' ? 0 : Math.PI }] : [] },
    Object.assign(doorLeaf(FL, 2.05, 0.8, gen === 2 ? 0x1f4196 : 0xd0212a), { x: hw - 0.01 }));
}

/* ---------- Lokomotiven ---------- */
function buildLocoAsset(type) {
  const name = 'loco_' + type;
  if (ASSETS.list[name]) return ASSETS.list[name];
  const mb = assetSlots();
  const L = 18.5, W = 2.95, hw = W / 2, hl = L / 2, TOP = 4.2;
  const ir = type === 're460', main = ir ? 'reRed' : 'sbWhite', low = ir ? 'reRed' : 'sbBlue';
  for (const s of [1, -1]) {
    mb[low].box(s * (hw - 0.03), 1.2, 0, 0.06, 1.3, L - 2.6, 0);
    mb[main].box(s * (hw - 0.03), 2.7, 0, 0.06, 1.7, L - 2.6, 0);
    for (const e of [1, -1]) { mb.glass.box(s * (hw - 0.02), 2.8, e * (hl - 2.4), 0.03, 0.8, 0.9, 0); mb.trim.box(s * (hw - 0.02), 2.0, e * (hl - 2.9), 0.03, 1.9, 0.75, 0); }
    if (ir) mb.white.box(s * (hw - 0.01), 1.55, 0, 0.03, 0.12, L - 3, 0);
    else mb.sbRed.box(s * (hw - 0.01), 2.0, 0, 0.03, 0.12, L - 3, 0);
    for (let z = -4; z <= 4; z += 1.4) mb.sbDark.box(s * (hw - 0.01), 3.2, z, 0.03, 0.5, 1.0, 0);
  }
  mb.roofGrey.box(0, TOP - 0.25, 0, W - 0.1, 0.5, L - 2.4, 0);
  for (const e of [1, -1]) {
    const z1 = e * (hl - 1.3);
    if (ir) {
      // windschnittige Front
      mb.reRed.addGeom(new THREE.BoxGeometry(W - 0.1, 2.0, 1.6), new THREE.Matrix4().makeRotationX(e * 0.42).setPosition(0, 2.9, z1 + e * 0.35), null);
      mb.glass.addGeom(new THREE.BoxGeometry(W - 0.5, 0.95, 0.05), new THREE.Matrix4().makeRotationX(e * 0.42).setPosition(0, 3.05, z1 + e * 1.1), null);
      mb.reRed.box(0, 1.25, z1 + e * 0.6, W - 0.15, 1.5, 1.2, 0);
      mb.white.box(0, 1.55, z1 + e * 1.21, W - 0.3, 0.12, 0.02, 0);
    } else {
      mb.sbWhite.box(0, 2.4, z1 + e * 0.6, W - 0.1, 3.4, 1.2, 0);
      mb.glass.box(0, 3.1, z1 + e * 1.21, W - 0.6, 0.85, 0.04, 0);
      mb.sbBlue.box(0, 1.0, z1 + e * 1.21, W - 0.2, 0.9, 0.04, 0);
      mb.sbRed.box(0, 1.6, z1 + e * 1.22, W - 0.2, 0.18, 0.04, 0);
    }
    const zl = z1 + e * 1.25;
    mb.head.box(0.9, 1.15, zl, 0.3, 0.16, 0.02, 0); mb.head.box(-0.9, 1.15, zl, 0.3, 0.16, 0.02, 0); mb.head.box(0, 3.75, zl - e * 0.1, 0.25, 0.12, 0.02, 0);
    mb.tail.box(0.62, 0.9, zl, 0.16, 0.1, 0.02, 0); mb.tail.box(-0.62, 0.9, zl, 0.16, 0.1, 0.02, 0);
    pantograph(mb, e * 4.2, TOP);
  }
  bogies(mb, hl, 0.62);
  mb.trim.box(0, 0.55, 0, W - 0.3, 0.5, L - 3, 0);
  mb.iTrim.box(0, 1.5, hl - 2.2, W - 0.4, 0.8, 0.8, 0);
  return finishAsset(name, mb, { kind: ir ? 'ir' : 'sbahn', label: ir ? 'Lok Re 460 (InterRegio)' : 'Lok Re 450 (S-Bahn 1. Generation)', len: L, hw, doors: [], floorY: 1.3, roofY: TOP,
    far: { base: 0.6, band0: 2.4, band1: 3.4, top: 4.2, lower: ir ? 0xd8111b : 0x1f4196, upper: ir ? 0xd8111b : 0xf3f3f0, wheels: true },
    signs: [] }, Object.assign(doorLeaf(1.3, 1.9, 0.6, 0x333333), { x: hw - 0.01 }));
}

/* ---------- InterRegio-Wagen (einstöckig) ---------- */
function buildIRCoachAsset() {
  if (ASSETS.list.ir_coach) return ASSETS.list.ir_coach;
  const mb = assetSlots();
  const L = 26.4, W = 2.82, hw = W / 2, hl = L / 2, FL = 1.2, TOP = 4.0;
  const dz = hl - 1.3;
  const doors = [];
  for (const zc of [dz, -dz]) for (const side of [1, -1]) doors.push({ zc, half: 0.45, side });
  const inDoor = (z) => Math.abs(Math.abs(z) - dz) < 0.5;
  for (const s of [1, -1]) {
    mb.irGrey.box(s * (hw - 0.03), 1.05, 0, 0.06, 0.9, L - 0.3, 0);
    mb.irRed.box(s * (hw - 0.02), 0.72, 0, 0.03, 0.16, L - 0.4, 0);
    windowRow(mb, 'irGrey', s, hw, -hl + 2.0, hl - 2.0, 1.6, 2.6, 2.0, null);
    for (const e of [1, -1]) mb.irGrey.box(s * (hw - 0.03), 2.1, e * (hl - 1.0), 0.06, 1.0, 1.6, 0);
    mb.irGrey.box(s * (hw - 0.03), 3.25, 0, 0.06, 1.3, L - 0.3, 0);
    mb.irGrey.box(s * (hw - 0.03), 1.4, 0, 0.06, 0.2, L - 0.3, 0);
  }
  mb.roofGrey.box(0, TOP, 0, W - 0.1, 0.12, L - 0.2, 0);
  for (const e of [1, -1]) { mb.sbGrey.box(0, 2.2, e * (hl - 0.05), W - 0.1, 3.6, 0.08, 0); mb.trim.box(0, 2.2, e * (hl + 0.15), 1.2, 2.6, 0.35, 0); }
  bogies(mb, hl, 0.46);
  mb.trim.box(0, 0.45, 0, W - 0.5, 0.4, L - 6.5, 0);
  mb.floor.box(0, FL, 0, W - 0.12, 0.06, L - 0.3, 0);
  for (let z = -hl + 2.6; z < hl - 2.4; z += 1.0) for (const x of [-0.95, -0.5, 0.5, 0.95]) { mb.moquette.box(x, FL + 0.45, z, 0.42, 0.1, 0.46, 0); mb.moquette.box(x, FL + 0.82, z - 0.22, 0.42, 0.65, 0.07, 0); }
  mb.ilight.box(0, TOP - 0.15, 0, 0.3, 0.03, L - 1, 0);
  mb.wall.box(0, TOP - 0.1, 0, W - 0.2, 0.03, L - 0.6, 0);
  return finishAsset('ir_coach', mb, { kind: 'ir', label: 'InterRegio-Wagen', len: L, hw, doors, floorY: FL + 0.03, roofY: TOP,
    far: { base: 0.5, band0: 1.6, band1: 2.6, top: 4.05, lower: 0xe1e3e4, upper: 0xe1e3e4, wheels: true }, signs: [] },
    Object.assign(doorLeaf(FL, 2.0, 0.45, 0xc8141c), { x: hw - 0.01 }));
}

/* ---------- Forchbahn (T18): rotes zweiteiliges Gelenktram ---------- */
function buildForchbahnAsset() {
  if (ASSETS.list.forchbahn) return ASSETS.list.forchbahn;
  const mb = assetSlots();
  const L = 22.0, W = 2.4, hw = W / 2, hl = L / 2, FL = 0.86;
  const doorZ = [8.6, 3.2, -3.2, -8.6];
  const doors = doorZ.map(zc => ({ zc, half: 0.6, side: -1 }));
  const inDoor = (z) => doorZ.some(d => Math.abs(z - d) < 0.64);
  const gap = (z) => Math.abs(z) < 0.35; // Gelenk
  for (const s of [1, -1]) {
    for (let z = -hl + 0.7; z < hl - 0.7; z += 0.3) {
      const zc = z + 0.15;
      if (gap(zc) || (s < 0 && inDoor(zc))) continue;
      mb.forchRed.box(s * (hw - 0.03), 1.2, zc, 0.06, 1.3, 0.31, 0);
      mb.forchCream.box(s * (hw - 0.03), 1.92, zc, 0.06, 0.14, 0.31, 0);
    }
    windowRow(mb, 'forchRed', s, hw, -hl + 0.8, -0.4, 2.05, 2.85, 1.3, (z) => s < 0 && inDoor(z));
    windowRow(mb, 'forchRed', s, hw, 0.4, hl - 0.8, 2.05, 2.85, 1.3, (z) => s < 0 && inDoor(z));
    mb.forchRed.box(s * (hw - 0.03), 3.05, -hl / 2, 0.06, 0.4, hl - 1.2, 0);
    mb.forchRed.box(s * (hw - 0.03), 3.05, hl / 2, 0.06, 0.4, hl - 1.2, 0);
    mb.trim.box(s * (hw - 0.02), 0.5, 0, 0.05, 0.2, L - 1.2, 0);
    mb.sbDark.box(s * (hw - 0.1), 1.9, 0, 0.05, 2.6, 0.7, 0);
  }
  for (const e of [1, -1]) {
    const z1 = e * hl;
    mb.forchRed.box(0, 1.2, z1 - e * 0.35, W - 0.3, 1.3, 0.7, 0);
    mb.glass.box(0, 2.45, z1 - e * 0.32, W - 0.4, 0.95, 0.04, 0);
    mb.forchCream.box(0, 1.92, z1 - e * 0.3, W - 0.3, 0.14, 0.72, 0);
    mb.forchRed.box(0, 3.05, z1 - e * 0.35, W - 0.3, 0.4, 0.7, 0);
    mb.head.box(0.6, 0.95, z1 + e * 0.02, 0.22, 0.2, 0.03, 0); mb.head.box(-0.6, 0.95, z1 + e * 0.02, 0.22, 0.2, 0.03, 0);
    mb.trim.box(0, 3.05, z1 + e * 0.0, 0.8, 0.3, 0.04, 0);
  }
  mb.forchCream.box(0, 3.3, 0, W - 0.1, 0.12, L - 0.8, 0);
  mb.trim.box(0, 3.5, -4, 1.4, 0.3, 3.0, 0); mb.trim.box(0, 3.5, 4, 1.4, 0.3, 3.0, 0);
  pantograph(mb, 4, 3.6);
  mb.floor.box(0, FL, 0, W - 0.1, 0.06, L - 0.3, 0);
  mb.white.box(0, 3.22, 0, W - 0.12, 0.02, L - 0.4, 0);
  mb.trim.box(0, 0.6, 0, W - 0.2, 0.5, L - 0.6, 0);
  const wg = wheelGeo(0.36, 0.14);
  for (const z of [8.4, 7.1, 0.65, -0.65, -7.1, -8.4]) for (const s of [1, -1]) mb.rubber.addGeom(wg, new THREE.Matrix4().makeTranslation(s * 0.72, 0.36, z), null);
  for (let z = -9.5; z < 9.6; z += 0.95) {
    if (inDoor(z) || inDoor(z + 0.5) || inDoor(z - 0.5) || gap(z)) continue;
    for (const x of [0.75, 0.3, -0.7]) { mb.seat.box(x, FL + 0.45, z, 0.42, 0.1, 0.44, 0); mb.seat.box(x, FL + 0.8, z - 0.2, 0.42, 0.6, 0.06, 0); }
  }
  for (let z = -9; z < 9.5; z += 2.2) mb.pole.cyl(-0.1, FL, z, 0.025, 0.025, 2.28, 8, null, false);
  mb.ilight.box(0, 3.12, 0, 0.25, 0.03, L - 2, 0);
  return finishAsset('forchbahn', mb, { kind: 'tram', label: 'Forchbahn (T18)', len: L, hw, doors, floorY: FL + 0.03, roofY: 3.1,
    far: { base: 0.5, band0: 1.95, band1: 2.85, top: 3.35, lower: 0xc4122f, upper: 0xc4122f, wheels: true },
    signs: [{ x: 0, y: 3.05, z: L / 2 + 0.05, w: hw * 1.4, h: 0.28 }] },
    Object.assign(doorLeaf(FL, 2.1, 0.6, 0xc4122f), { x: hw - 0.02 }));
}
