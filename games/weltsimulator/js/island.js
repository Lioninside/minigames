/* ================= ISLA VENEZIA =================
   Kleine Insel im Meer östlich von Venedig:
   - Palmen, Strand, Leuchtturm, Bänke
   - Fussgänger-Viadukt (weisser Steinbogen) vom Quai in Venedig auf die Insel
   - riesige, begehbare Ölplattform auf vier Beinen: Hauptdeck, Oberdeck, Helideck,
     Bohrturm, Kran, Fackelausleger; Treppen zwischen den Decks, Steg zur Insel
   - U-Bahnhof (U3, Endstation) und IR-Bahnhof (IR7, Aussenring) */

const ISLE = { walk: null, oil: null };

/* Planung (vor den Bäumen): Palmen, Flächen freihalten */
function planIsland() {
  const I = ISLAND;
  for (let k = 0; k < 26; k++) {
    const a = k * 2.399, r = 18 + (k * 37 % 41);
    const x = I.x + Math.cos(a) * r, z = I.z + Math.sin(a) * r;
    if (Math.hypot(x - (I.x - 55), z - I.z) < 18) continue; // Platz am Bahnhof
    addTree('palm', x, z, 0.85 + (k % 5) * 0.08);
  }
  // Viadukt-Endpunkte
  const z0 = I.z + 25, x0 = coastX(z0) - 6, x1 = I.x - I.r + 8;
  ISLE.walk = { x0, x1, z: z0 };
  reserveSeg(x0 - 20, z0, x0 + 5, z0, 8);
}

function buildIsland(surf) {
  const I = ISLAND, cm = new ChunkedMB(WS.CHUNK);
  const stone = lin(0xf1ece2), stoneD = lin(0xd8d0c2), steel = lin(0x5a6168), yellow = lin(0xf2b705), orange = lin(0xe8642c), white = lin(0xf2f2f2), red = lin(0xc62828), grey = lin(0x8a9096);
  // ---------- Fussgänger-Viadukt Venedig → Insel ----------
  const W = ISLE.walk;
  if (W) {
    const L = W.x1 - W.x0, hw = 2.2;
    const y0 = WS.VENICE_Y + 0.1, y1 = terrainH(W.x1, W.z) + 0.1, top = 7.5;
    const yAt = (a) => { const t = a / L; return lerp(y0, y1, t) + (top - lerp(y0, y1, 0.5)) * Math.sin(Math.PI * t) ; };
    const mb = cm.get('stone', (W.x0 + W.x1) / 2, W.z);
    const n = Math.ceil(L / 4);
    for (let k = 0; k < n; k++) {
      const a0 = k * L / n, a1 = (k + 1) * L / n, ya = yAt(a0), yb = yAt(a1);
      const xa = W.x0 + a0, xb = W.x0 + a1;
      mb.quad([xa, ya, W.z + hw], [xb, yb, W.z + hw], [xb, yb, W.z - hw], [xa, ya, W.z - hw], null, stone, [0, 1, 0]);
      mb.quad([xa, ya - 0.9, W.z - hw], [xb, yb - 0.9, W.z - hw], [xb, yb - 0.9, W.z + hw], [xa, ya - 0.9, W.z + hw], null, stoneD, [0, -1, 0]);
      for (const s of [1, -1]) {
        const z = W.z + s * hw;
        const q = [[xa, ya - 0.9, z], [xb, yb - 0.9, z], [xb, yb + 1.0, z], [xa, ya + 1.0, z]];
        if (s > 0) mb.quad(q[0], q[1], q[2], q[3], null, stone); else mb.quad(q[1], q[0], q[3], q[2], null, stone);
        mb.box((xa + xb) / 2, (ya + yb) / 2 + 1.05, z, a1 - a0 + 0.02, 0.12, 0.35, 0, stoneD);
      }
    }
    // Bögen (Pfeiler) alle 24 m
    for (let a = 12; a < L - 6; a += 24) {
      const x = W.x0 + a, y = yAt(a);
      mb.box(x, (y - 0.9 - 9) / 2, W.z, 2.2, y - 0.9 + 9, hw * 2 + 0.8, 0, stoneD, null, true);
    }
    for (let k = 0; k < n; k++) {
      const a0 = k * L / n, a1 = (k + 1) * L / n, len = a1 - a0;
      addDeck({ kind: 'bridge', ox: W.x0 + a0, oz: W.z, dx: 1, dz: 0, a0: 0, a1: len + 0.05, hw: hw - 0.25, h: ((A0) => (a) => yAt(A0 + a))(a0), rails: null });
    }
    // Laternen
    for (let a = 20; a < L; a += 40) for (const s of [1, -1]) {
      const x = W.x0 + a, y = yAt(a);
      mb.cyl(x, y, W.z + s * (hw - 0.2), 0.06, 0.06, 3.2, 6, steel, false);
      cm.get('lamp', x, W.z).box(x, y + 3.25, W.z + s * (hw - 0.2), 0.35, 0.3, 0.35, 0);
    }
  }
  // ---------- Insel: Leuchtturm, Bänke, Schild ----------
  {
    const lx = I.x + 52, lz = I.z - 30, ly = terrainH(lx, lz);
    const mb = cm.get('stone', lx, lz);
    for (let k = 0; k < 6; k++) mb.cyl(lx, ly + k * 3, lz, 2.4 - k * 0.18, 2.4 - (k + 1) * 0.18, 3, 16, k % 2 ? red : white, false);
    mb.cyl(lx, ly + 18, lz, 1.6, 1.6, 0.3, 16, steel, true);
    cm.get('lamp', lx, lz).cyl(lx, ly + 18.3, lz, 1.0, 1.0, 1.8, 12, null, true);
    mb.cyl(lx, ly + 20.1, lz, 1.3, 0.1, 1.2, 12, red, false);
    for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.4; const bx = I.x + Math.cos(a) * 30, bz = I.z + Math.sin(a) * 30, by = terrainH(bx, bz); mb.box(bx, by + 0.45, bz, 1.8, 0.07, 0.5, -a, lin(0x7a5434)); NAT.benches.push({ x: bx, y: by, z: bz, rot: -a + Math.PI / 2, seatY: by + 0.485 }); }
    const rs = SIGNS.add('isla', 384, 96, (ctx, w, h) => { ctx.fillStyle = '#0d3b6e'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fff'; ctx.font = 'bold 44px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Isla Venezia', w / 2, h / 2); });
    const sm = signMesh(rs, 'plain', 4.4, 1.1); sm.position.set(W ? W.x1 + 6 : I.x - 40, terrainH(I.x - 50, I.z + 25) + 2.4, W ? W.z + 4 : I.z); sm.rotation.y = -Math.PI / 2; surf.add(sm); nearVis(sm, 500);
  }
  // ---------- Ölplattform ----------
  const O = ISLAND.oil, D1 = 14, D2 = 24, D3 = 31, hx = 30, hz = 22;
  ISLE.oil = { x: O.x, z: O.z, decks: [D1, D2, D3] };
  {
    const mb = cm.get('steel', O.x, O.z);
    // Beine mit Querstreben
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = O.x + sx * (hx - 4), z = O.z + sz * (hz - 4);
      mb.cyl(x, -10, z, 2.4, 2.0, D1 + 10, 16, yellow, false);
      addCollider({ obb: makeOBB(x, z, 0, 2.4, 2.4), top: D1 - 0.5 });
    }
    for (const y of [2, 8]) {
      mb.box(O.x, y, O.z - hz + 4, hx * 2 - 8, 0.8, 0.8, 0, yellow);
      mb.box(O.x, y, O.z + hz - 4, hx * 2 - 8, 0.8, 0.8, 0, yellow);
      mb.box(O.x - hx + 4, y, O.z, 0.8, 0.8, hz * 2 - 8, 0, yellow);
      mb.box(O.x + hx - 4, y, O.z, 0.8, 0.8, hz * 2 - 8, 0, yellow);
    }
    // Hauptdeck
    mb.box(O.x, D1 - 0.6, O.z, hx * 2, 1.2, hz * 2, 0, grey);
    mb.box(O.x, D1 - 1.8, O.z, hx * 2 - 2, 1.2, hz * 2 - 2, 0, yellow);
    // Geländer
    for (const [x, z, w, d] of [[O.x, O.z - hz, hx * 2, 0.08], [O.x, O.z + hz, hx * 2, 0.08], [O.x - hx, O.z + 3, 0.08, hz * 2 - 6], [O.x + hx, O.z, 0.08, hz * 2]]) mb.box(x, D1 + 0.55, z, w, 1.1, d, 0, yellow);
    // Module: Unterkunft (weiss, Fenster), Prozessanlage (orange Tanks)
    const qx = O.x + 14, qz = O.z + 10;
    mb.box(qx, D1 + 5, qz, 22, 10, 14, 0, white);
    for (let k = 0; k < 3; k++) for (let j = -4; j <= 4; j++) cm.get('lamp', qx, qz).box(qx + j * 2.2, D1 + 2 + k * 3.2, qz - 7.05, 1.2, 0.9, 0.05, 0);
    for (let k = 0; k < 4; k++) mb.cyl(O.x - 20 + k * 6, D1, O.z + 12, 2.2, 2.2, 7, 14, orange, true);
    // Oberdeck auf Stützen
    mb.box(O.x - 6, D2 - 0.5, O.z - 6, 32, 1.0, 24, 0, grey);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mb.box(O.x - 6 + sx * 15, (D1 + D2) / 2, O.z - 6 + sz * 11, 0.7, D2 - D1, 0.7, 0, yellow);
    // Helideck über der Unterkunft
    mb.cyl(qx, D3 - 0.4, qz, 11, 11, 0.4, 24, lin(0x3d4a44), true);
    mb.cyl(qx, D3, qz, 9.5, 9.5, 0.02, 24, null, true);
    for (const s of [1, -1]) { mb.box(qx + s * 2.2, D3 + 0.03, qz, 0.9, 0.02, 7, 0, white); }
    mb.box(qx, D3 + 0.03, qz, 3.6, 0.02, 0.9, 0, white);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mb.box(qx + sx * 7, (D1 + 10 + D3) / 2, qz + sz * 5, 0.6, D3 - D1 - 10, 0.6, 0, yellow);
    // Bohrturm (Gitter)
    const bx = O.x - 10, bz = O.z - 8, H = 46;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const n2 = 8;
      for (let k = 0; k < n2; k++) {
        const t0 = k / n2, t1 = (k + 1) / n2, w0 = lerp(5, 1.2, t0), w1 = lerp(5, 1.2, t1);
        const p0 = [bx + sx * w0, D2 + H * t0, bz + sz * w0], p1 = [bx + sx * w1, D2 + H * t1, bz + sz * w1];
        const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
        const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...p0), new THREE.Vector3(...p1), new THREE.Vector3(0, 1, 0));
        m.setPosition((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2);
        mb.addGeom(new THREE.BoxGeometry(0.35, 0.35, len), m, red);
      }
    }
    for (let k = 1; k < 8; k++) { const t = k / 8, w = lerp(5, 1.2, t); mb.box(bx, D2 + H * t, bz, w * 2, 0.25, w * 2, 0, red); }
    mb.box(bx, D2 + H + 0.6, bz, 3, 1.2, 3, 0, red);
    // Kran und Fackelausleger
    mb.cyl(O.x + 24, D1, O.z - 14, 1.0, 0.8, 9, 10, yellow, false);
    mb.addGeom(new THREE.BoxGeometry(0.7, 0.7, 26), new THREE.Matrix4().makeRotationY(-0.6).multiply(new THREE.Matrix4().makeRotationX(-0.45)).setPosition(O.x + 30, D1 + 13, O.z - 22), yellow);
    mb.addGeom(new THREE.BoxGeometry(0.8, 0.8, 30), new THREE.Matrix4().makeRotationY(Math.PI * 0.75).multiply(new THREE.Matrix4().makeRotationX(-0.3)).setPosition(O.x + hx + 8, D1 + 8, O.z + hz + 8), steel);
    cm.get('flame', O.x, O.z).cyl(O.x + hx + 18.5, D1 + 12, O.z + hz + 18.5, 0.6, 0.05, 4, 8, null, false);
    // begehbar: Hauptdeck, Oberdeck, Helideck
    addDeck({ kind: 'oil', ox: O.x - hx, oz: O.z, dx: 1, dz: 0, a0: 0, a1: hx * 2, hw: hz - 0.2, h: () => D1, rails: null });
    addDeck({ kind: 'oil', ox: O.x - 6 - 16, oz: O.z - 6, dx: 1, dz: 0, a0: 0, a1: 32, hw: 12, h: () => D2, rails: null });
    addDeck({ kind: 'oil', ox: qx - 10.5, oz: qz, dx: 1, dz: 0, a0: 0, a1: 21, hw: 9.5, h: () => D3, rails: null });
    addCollider({ obb: makeOBB(qx, qz, 0, 11, 7), top: D1 + 10, bottom: D1 });
    // Treppen: Hauptdeck → Oberdeck (an der Nordseite), Oberdeck → Helideck
    const stair = (x0, z0, dx, dz, len, ya, yb, w) => {
      for (let k = 0; k < Math.ceil((yb - ya) / 0.2); k++) {
        const n3 = Math.ceil((yb - ya) / 0.2), t = (k + 0.5) / n3;
        mb.box(x0 + dx * len * t, ya + (yb - ya) * (k + 1) / n3 - 0.1, z0 + dz * len * t, Math.abs(dz) > 0.5 ? w : len / n3 + 0.02, 0.2, Math.abs(dz) > 0.5 ? len / n3 + 0.02 : w, 0, steel);
      }
      addDeck({ kind: 'stair', ox: x0, oz: z0, dx, dz, a0: -0.6, a1: len + 0.6, hw: w / 2, h: (a) => clamp(ya + (yb - ya) * a / len, ya, yb), rails: null });
    };
    stair(O.x - 21, O.z - 20, 1, 0, 17, D1, D2, 2.2);
    stair(O.x + 5, O.z + 1.5, 1, 0, 9, D2, D3, 2.0);
    // Steg von der Insel zum Hauptdeck
    const sx0 = I.x + 32, sz0 = I.z - 52, sy0 = terrainH(sx0, sz0) + 0.1;
    const ex = O.x - hx + 0.5, ez = O.z - 2, dxs = ex - sx0, dzs = ez - sz0, ls = Math.hypot(dxs, dzs);
    const ux = dxs / ls, uz = dzs / ls, rotS = Math.atan2(ux, uz);
    for (let k = 0; k < Math.ceil(ls / 2); k++) {
      const t0 = k / Math.ceil(ls / 2), t1 = (k + 1) / Math.ceil(ls / 2);
      const x = sx0 + dxs * (t0 + t1) / 2, z = sz0 + dzs * (t0 + t1) / 2, y = lerp(sy0, D1, (t0 + t1) / 2);
      mb.box(x, y - 0.15, z, 2.6, 0.3, ls / Math.ceil(ls / 2) + 0.05, rotS, grey);
      for (const s of [1, -1]) mb.box(x + uz * s * 1.3, y + 0.55, z - ux * s * 1.3, 0.06, 1.1, ls / Math.ceil(ls / 2) + 0.05, rotS, yellow);
    }
    addDeck({ kind: 'bridge', ox: sx0, oz: sz0, dx: ux, dz: uz, a0: -0.5, a1: ls + 1.5, hw: 1.2, h: (a) => clamp(lerp(sy0, D1, a / ls), sy0, D1), rails: null });
  }
  const mats = {
    stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }),
    steel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.35, side: THREE.DoubleSide }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xfff4dd, emissive: 0xffd9a0, emissiveIntensity: 0.9 }),
    flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.0, 0.25), transparent: true, opacity: 0.85, toneMapped: false })
  };
  cm.finish(mats, surf, { cast: { stone: true, steel: true } });
}
