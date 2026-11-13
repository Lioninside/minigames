/* ================= S-BAHN UND INTERREGIO =================
   Oberirdische Bahnlinien S2, S5 und IR7 (Aussenring) nach js/network.js.
   - Linienführung: Knoten → Polylinie mit geraden Stationsabschnitten → Kreisbögen (Fillets).
   - Höhenprofil: mindestens 7,5 m über Gelände/Strasse (Strassen unterqueren das Viadukt),
     Steigung höchstens 6 % (S-Bahn) bzw. 4,5 % (IR), Stationen flach, Hönggerberg/Z fest auf
     ETH-Dachhöhe. Daraus folgt: Viadukt mit Pfeilern, wo Platz ist (nicht auf Strassen/Gleisen).
   - Doppelspur; an Endstationen läuft sie zu einem Stumpfgleis zusammen. Dort wendet der Zug
     (Vehicle: rev), ohne Ballonschleife.
   - Stationen: zwei lange Seitenperrons, Teil überdacht. Innenstadt: Treppe, sonst Lift.
   Häuser und Bäume weichen über Reservierungen (vor der Bebauung geplant). */

const RAIL = { lines: [], stations: [], group: null };
const RL = { TRK: 2.25, EDGE: 1.65, PLW: 4.0, PLH: 0.55, CLEAR: 7.5, PL_S: 170, PL_IR: 220, STUB: 190, MARGIN: 55, DS: 4, DECK_HW: 5.4 };

/* ---------- Linienführung ---------- */
function railPolyline(def) {
  const N = def.nodes, n = N.length, ring = !!def.ring;
  const PL = def.kind === 'ir' ? RL.PL_IR : RL.PL_S;
  const pts = [], lock = [];
  const at = (i) => N[ring ? (i + n) % n : clamp(i, 0, n - 1)];
  for (let i = 0; i < n; i++) {
    const nd = N[i];
    if (!nd.st) { pts.push([nd.x, nd.z]); lock.push(false); continue; }
    const prev = at(i - 1), next = at(i + 1);
    const tv = [next.x - prev.x, next.z - prev.z];
    let d = nd.dir ? nd.dir.slice() : tv.slice();
    let l = Math.hypot(d[0], d[1]); d = [d[0] / l, d[1] / l];
    if (d[0] * tv[0] + d[1] * tv[1] < 0) d = [-d[0], -d[1]];
    nd._d = d;
    const hIn = (nd.term && i === 0) ? PL / 2 + 20 : PL / 2 + RL.MARGIN + 5;
    const hOut = (nd.term && i === n - 1) ? PL / 2 + 20 : PL / 2 + RL.MARGIN + 5;
    pts.push([nd.x - d[0] * hIn, nd.z - d[1] * hIn]); lock.push(true);
    pts.push([nd.x + d[0] * hOut, nd.z + d[1] * hOut]); lock.push(false);
  }
  return { pts, lock };
}
/* Kreisbögen in die Ecken; Stationsgeraden (lock) bleiben gerade */
function railFillet(pts, lock, R, ring) {
  const n = pts.length, out = [];
  const V = (i) => pts[(i + n) % n];
  const segLen = (i) => { const a = V(i), b = V(i + 1); return Math.hypot(b[0] - a[0], b[1] - a[1]); };
  const isLock = (i) => lock[(i + n) % n];
  const corners = [];
  for (let i = 0; i < n; i++) {
    if (!ring && (i === 0 || i === n - 1)) { corners.push(null); continue; }
    const a = V(i - 1), b = V(i), c = V(i + 1);
    let ux = b[0] - a[0], uz = b[1] - a[1]; const lu = Math.hypot(ux, uz); ux /= lu; uz /= lu;
    let vx = c[0] - b[0], vz = c[1] - b[1]; const lv = Math.hypot(vx, vz); vx /= lv; vz /= lv;
    const phi = Math.acos(clamp(ux * vx + uz * vz, -1, 1));
    if (phi < 0.004) { corners.push(null); continue; }
    let t = R * Math.tan(phi / 2);
    t = Math.min(t, isLock(i - 1) ? RL.MARGIN : segLen(i - 1) * 0.5, isLock(i) ? RL.MARGIN : segLen(i) * 0.5);
    const r = t / Math.tan(phi / 2);
    const turn = Math.sign(ux * vz - uz * vx); // >0: Linkskurve (x→z)
    const p1 = [b[0] - ux * t, b[1] - uz * t], p2 = [b[0] + vx * t, b[1] + vz * t];
    // Mittelpunkt: senkrecht zur Einfahrrichtung, zur Kurveninnenseite
    const nx = -uz * turn, nz = ux * turn;
    const cx = p1[0] + nx * r, cz = p1[1] + nz * r;
    const a0 = Math.atan2(p1[1] - cz, p1[0] - cx), a1 = Math.atan2(p2[1] - cz, p2[0] - cx);
    let da = a1 - a0; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
    const steps = Math.max(2, Math.ceil(Math.abs(da) * r / RL.DS));
    const arc = [];
    for (let k = 0; k <= steps; k++) { const ang = a0 + da * k / steps; arc.push([cx + Math.cos(ang) * r, cz + Math.sin(ang) * r]); }
    corners.push(arc);
  }
  for (let i = 0; i < n; i++) {
    if (corners[i]) for (const p of corners[i]) out.push(p); else out.push(V(i).slice());
  }
  if (ring) out.push(out[0].slice());
  return out;
}
/* Gleichmässig neu abtasten (ds) */
function railResample(poly, ds) {
  const out = [poly[0].slice()];
  let carry = 0;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1], b = poly[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = ds - carry;
    while (t <= l) { out.push([a[0] + (b[0] - a[0]) * t / l, a[1] + (b[1] - a[1]) * t / l]); t += ds; }
    carry = l - (t - ds);
  }
  const last = poly[poly.length - 1], pl = out[out.length - 1];
  if (Math.hypot(last[0] - pl[0], last[1] - pl[1]) > ds * 0.3) out.push(last.slice());
  return out;
}

/* ---------- Planung (vor der Bebauung) ---------- */
function planRail() {
  for (const def of RAIL_DEF) {
    const isIR = def.kind === 'ir', ring = !!def.ring;
    const PL = isIR ? RL.PL_IR : RL.PL_S, G = isIR ? 0.045 : 0.06;
    const { pts, lock } = railPolyline(def);
    const fil = railFillet(pts, lock, isIR ? 420 : 300, ring);
    let C = railResample(fil, RL.DS);
    if (ring && Math.hypot(C[0][0] - C[C.length - 1][0], C[0][1] - C[C.length - 1][1]) < 1) C.pop();
    const N = C.length;
    const cum = new Float64Array(N); for (let i = 1; i < N; i++) cum[i] = cum[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]);
    const L = cum[N - 1] + (ring ? Math.hypot(C[0][0] - C[N - 1][0], C[0][1] - C[N - 1][1]) : 0);
    const nearest = (x, z) => { let bi = 0, bd = 1e18; for (let i = 0; i < N; i++) { const d = (C[i][0] - x) ** 2 + (C[i][1] - z) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
    // Stationen
    const stations = [];
    for (const nd of def.nodes) {
      if (!nd.st) continue;
      const i = nearest(nd.x, nd.z);
      const st = { name: nd.st, line: null, i, s: cum[i], x: C[i][0], z: C[i][1], dir: nd._d, term: !!nd.term, hub: nd.hub || null,
        wide: nd.wide || 0, yFix: nd.y, PL, first: i < N / 2 && nd.term };
      stations.push(st);
    }
    // Höhenprofil
    const hmin = new Float32Array(N), h = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const [x, z] = C[i];
      let g = Math.max(terrainH(x, z), WS.WATER_Y);
      const rd = roadClear(x, z, 3);
      if (RC_EDGE && rd < 2) { const e = RC_EDGE, A = ROADS.nodes[e.a]; const d = clamp((x - A.x) * e.dx + (z - A.z) * e.dz, 0, e.len); g = Math.max(g, edgeY(e, d)); }
      hmin[i] = g + RL.CLEAR;
    }
    const regions = stations.map(st => {
      const half = PL / 2 + 15;
      let i0 = st.i, i1 = st.i;
      while (i0 > 0 && cum[st.i] - cum[i0 - 1] < half) i0--;
      while (i1 < N - 1 && cum[i1 + 1] - cum[st.i] < half) i1++;
      if (st.term) { if (st.i < N / 2) i0 = 0; else i1 = N - 1; }
      return { st, i0, i1 };
    });
    for (let i = 0; i < N; i++) h[i] = hmin[i];
    const idx = (i) => ring ? (i + N) % N : clamp(i, 0, N - 1);
    const envelope = () => {
      for (let pass = 0; pass < 3; pass++) {
        for (let k = 1; k < N + (ring ? N : 0); k++) { const i = idx(k), p = idx(k - 1); const ds = RL.DS; h[i] = Math.max(h[i], h[p] - G * ds); }
        for (let k = N - 2 + (ring ? N : 0); k >= 0; k--) { const i = idx(k), p = idx(k + 1); h[i] = Math.max(h[i], h[p] - G * RL.DS); }
      }
    };
    const flatten = () => {
      for (const r of regions) {
        let v = -1e9; for (let i = r.i0; i <= r.i1; i++) v = Math.max(v, h[i]);
        if (r.st.yFix !== undefined) v = Math.max(v, r.st.yFix);
        for (let i = r.i0; i <= r.i1; i++) h[i] = v;
        r.y = v;
      }
    };
    for (const r of regions) if (r.st.yFix !== undefined) for (let i = r.i0; i <= r.i1; i++) h[i] = Math.max(h[i], r.st.yFix);
    envelope(); flatten(); envelope();
    // weiche Kuppen und Wannen
    for (let pass = 0; pass < 3; pass++) {
      const t = Float32Array.from(h);
      for (let i = 0; i < N; i++) {
        let s = 0, c = 0;
        for (let k = -6; k <= 6; k++) { const j = ring ? idx(i + k) : i + k; if (j < 0 || j >= N) continue; s += t[j]; c++; }
        h[i] = Math.max(s / c, hmin[i]);
      }
    }
    flatten();
    for (const r of regions) { r.st.y = r.y; r.st.i0 = r.i0; r.st.i1 = r.i1; }
    // Normalen (links) und Gleisversatz (an Endstationen auf ein Gleis zusammen)
    const nrm = [];
    for (let i = 0; i < N; i++) {
      const a = C[idx(i - 1)], b = C[idx(i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1;
      nrm.push([dz / l, -dx / l]);
    }
    const off = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (ring) { off[i] = RL.TRK; continue; }
      const dEnd = Math.min(cum[i], cum[N - 1] - cum[i]);
      off[i] = RL.TRK * smooth(RL.STUB, RL.STUB + 90, dEnd);
    }
    const line = { def, id: def.id, kind: def.kind, gen: def.gen, color: def.color, ring, C, cum, L, N, h, hmin, nrm, off, stations, PL };
    for (const st of stations) { st.line = line; RAIL.stations.push(st); }
    railPaths(line);
    railReserve(line);
    RAIL.lines.push(line);
  }
}

/* Fahrpfade der Züge: Gleis A (rechts) hin, Gleis B zurück; Halte; Wenden an Endstationen */
function railPaths(line) {
  const { C, N, h, nrm, off, ring } = line;
  const P3 = (i, side) => [C[i][0] - nrm[i][0] * off[i] * side, h[i], C[i][1] - nrm[i][1] * off[i] * side];
  line.paths = [];
  if (ring) {
    const A = [], B = [];
    for (let i = 0; i < N; i++) A.push(P3(i, 1));
    for (let i = N - 1; i >= 0; i--) B.push(P3(i, -1));
    const pA = new TPath(A, line.stations.map(s => s.i), { noSpeed: true, ds: 2 });
    const pB = new TPath(B, line.stations.map(s => N - 1 - s.i), { noSpeed: true, ds: 2 });
    for (const [p, k] of [[pA, 0], [pB, 1]]) {
      p.computeSpeed(0.9, 0.7);
      const stops = line.stations.map((st, j) => ({ s: p.markS[j], stop: st })).sort((a, b) => a.s - b.s);
      line.paths.push({ path: p, stops, dir: k });
    }
    return;
  }
  const loop = [];
  for (let i = 0; i < N; i++) loop.push(P3(i, 1));
  for (let i = N - 2; i >= 1; i--) loop.push(P3(i, -1));
  const marks = [N - 1];
  for (const st of line.stations) { marks.push(st.i); marks.push(2 * N - 2 - st.i); }
  const p = new TPath(loop, marks, { noSpeed: true, ds: 2 });
  p.computeSpeed(0.9, 0.7);
  const sEnd = p.markS[0];
  const stops = [];
  line.stations.forEach((st, j) => {
    const sA = p.markS[1 + j * 2], sB = p.markS[2 + j * 2];
    if (st.term && st.first) stops.push({ s: sB, stop: st, rev: p.L });   // Endstation am Anfang: auf Gleis B, dann wenden
    else if (st.term) stops.push({ s: sA, stop: st, rev: sEnd });          // Endstation am Ende: auf Gleis A, dann wenden
    else { stops.push({ s: sA, stop: st }); stops.push({ s: sB, stop: st }); }
  });
  stops.sort((a, b) => a.s - b.s);
  line.paths.push({ path: p, stops, dir: 0 });
}

/* Häuser und Bäume fernhalten */
function railReserve(line) {
  const { C, N, stations } = line;
  const pts = [];
  for (let i = 0; i < N; i += 3) pts.push(C[i]);
  if (line.ring) pts.push(C[0]);
  reservePoly(pts, 9);
  for (const st of stations) {
    const half = st.PL / 2 + 8, w = 13 + Math.abs(st.wide) * 6;
    for (let a = -half; a <= half; a += 12) reserveCircle(st.x + st.dir[0] * a, st.z + st.dir[1] * a, w);
    // Zugänge (Treppe/Lift) an beiden Enden, aussen
    for (const e of [1, -1]) reserveCircle(st.x + st.dir[0] * e * (st.PL / 2 + 12), st.z + st.dir[1] * e * (st.PL / 2 + 12), 16);
  }
}

/* Lokale Achsen einer Station: entlang d, quer r (links = +) */
function railStationFrame(st) {
  const d = st.dir, l = [d[1], -d[0]];
  return { d, l, W: (a, q) => [st.x + d[0] * a + l[0] * q, st.z + d[1] * a + l[1] * q] };
}

/* ---------- Geometrie ---------- */
function railTextures() {
  // Schotter mit Schwellen: eine Kachel = eine Schwelle (0,65 m)
  const cv = makeCanvas(64, 64), ctx = cv.getContext('2d');
  ctx.drawImage(noiseCanvas(64, 64, 0.45, 0.6, 14, 9), 0, 0);
  ctx.fillStyle = 'rgba(120,112,100,0.55)'; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#5a5047'; ctx.fillRect(6, 22, 52, 20);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(6, 40, 52, 2);
  const t = canvasTex(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function buildRail(surf) {
  if (!RAIL.lines.length) return;
  const cm = new ChunkedMB(WS.CHUNK);
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const mats = {
    concrete: S({ vertexColors: true, roughness: 0.88, map: MATS.bridge.map, side: THREE.DoubleSide }),
    ballast: S({ map: railTextures(), roughness: 0.95, side: THREE.DoubleSide }),
    rail: S({ color: 0xb4b6b9, metalness: 0.9, roughness: 0.28, side: THREE.DoubleSide }), cat: S({ color: 0x3a3f44, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide }),
    platform: MATS.platform, edge: S({ color: 0xf2f2f0, roughness: 0.6 }), yellow: MATS.yellow,
    roof: S({ vertexColors: true, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide }), glass: MATS.glass
  };
  const cConc = lin(0xb9b4aa), cConcD = lin(0x8f8a82), cPar = lin(0xc9c4ba);
  const pillarsAvoid = [];
  for (const T of [TRANSIT.tram, TRANSIT.tram18]) if (T && T.C) pillarsAvoid.push(T.C);
  const nearTram = (x, z) => { for (const C of pillarsAvoid) for (let i = 0; i < C.length; i += 2) if (Math.abs(C[i][0] - x) < 6 && Math.abs(C[i][1] - z) < 6) return true; return false; };
  for (const line of RAIL.lines) {
    const { C, N, h, nrm, off, ring } = line;
    // Abtastung für die Geometrie: in Kurven und an Stationen dicht, auf Geraden grob
    const keep = [0];
    for (let i = 1; i < N - 1; i++) {
      const k = keep[keep.length - 1];
      const dl = line.cum[i] - line.cum[k];
      const a = C[k], b = C[i], c = C[i + 1];
      const h1 = Math.atan2(b[1] - a[1], b[0] - a[0]), h2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      let dh = Math.abs(h2 - h1); if (dh > Math.PI) dh = Math.PI * 2 - dh;
      const gr1 = (h[i] - h[k]) / Math.max(1, dl), gr2 = (h[i + 1] - h[i]) / RL.DS;
      const inSt = line.stations.some(st => i >= st.i0 - 2 && i <= st.i1 + 2);
      if (dl >= (inSt ? 8 : 16) || dh > 0.012 || Math.abs(gr2 - gr1) > 0.004 || Math.abs(off[i] - off[k]) > 0.05) keep.push(i);
    }
    keep.push(N - 1);
    if (ring) keep.push(0);
    const stAt = (i) => line.stations.find(st => i >= st.i0 && i <= st.i1);
    // Deckbreite: an Stationen breiter (Perrons)
    const deckHW = (i) => { const st = stAt(i); if (!st) return RL.DECK_HW; return st.term ? RL.EDGE + RL.PLW + 0.4 : RL.TRK + RL.EDGE + RL.PLW + 0.4; };
    let lastPillar = -1e9;
    for (let k = 0; k < keep.length - 1; k++) {
      const i = keep[k], j = keep[k + 1];
      const p = C[i], q = C[j], np = nrm[i], nq = nrm[j];
      const yp = h[i], yq = h[j];
      const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
      const mbC = cm.get('concrete', mx, mz), mbB = cm.get('ballast', mx, mz), mbR = cm.get('rail', mx, mz), mbK = cm.get('cat', mx, mz);
      const wp = deckHW(i), wq = deckHW(j);
      const top = -0.55, bot = -1.8;
      const L = (pt, n, w, y) => [pt[0] + n[0] * w, y, pt[1] + n[1] * w];
      // Deck: Oberseite, Unterseite, Seiten
      mbC.quad(L(p, np, -wp, yp + top), L(q, nq, -wq, yq + top), L(q, nq, wq, yq + top), L(p, np, wp, yp + top), null, cConc);
      mbC.quad(L(p, np, wp, yp + bot), L(q, nq, wq, yq + bot), L(q, nq, -wq, yq + bot), L(p, np, -wp, yp + bot), null, cConcD);
      for (const s of [1, -1]) {
        const a = L(p, np, s * wp, yp + bot), b = L(q, nq, s * wq, yq + bot), c = L(q, nq, s * wq, yq + top + 1.05), d = L(p, np, s * wp, yp + top + 1.05);
        if (s > 0) mbC.quad(a, b, c, d, null, cPar); else mbC.quad(b, a, d, c, null, cPar);
        // Brüstung innen + Krone (ausser an Perrons)
        if (!stAt(i) || !stAt(j)) {
          const wi = 0.25;
          const e = L(p, np, s * (wp - wi), yp + top), f = L(q, nq, s * (wq - wi), yq + top), g2 = L(q, nq, s * (wq - wi), yq + top + 1.05), h2 = L(p, np, s * (wp - wi), yp + top + 1.05);
          if (s > 0) mbC.quad(f, e, h2, g2, null, cPar); else mbC.quad(e, f, g2, h2, null, cPar);
          mbC.quad(d, c, g2, h2, null, cPar);
        }
      }
      // Gleise: Schotterbett mit Schwellen-Textur, zwei Schienen je Gleis
      const sides = off[i] < 0.2 && off[j] < 0.2 ? [0] : [1, -1];
      const v0 = line.cum[i] / 0.65, v1 = (line.cum[j] + (j < i ? line.L : 0)) / 0.65;
      for (const sd of sides) {
        const op = -off[i] * sd, oq = -off[j] * sd;
        const bw = 1.55;
        mbB.quadUV(L(p, np, op - bw, yp - 0.25), L(q, nq, oq - bw, yq - 0.25), L(q, nq, oq + bw, yq - 0.25), L(p, np, op + bw, yp - 0.25), [0, v0], [0, v1], [1, v1], [1, v0], null, [0, 1, 0]);
        for (const s of [1, -1]) mbB.quadUV(L(p, np, op + s * bw, yp - 0.25), L(q, nq, oq + s * bw, yq - 0.25), L(q, nq, oq + s * (bw + 0.5), yq - 0.55), L(p, np, op + s * (bw + 0.5), yp - 0.55), [0, 0], [0, 0.3], [0.2, 0.3], [0.2, 0], null, null);
        for (const r of [-0.7175, 0.7175]) {
          const a = L(p, np, op + r - 0.035, yp), b = L(q, nq, oq + r - 0.035, yq), c = L(q, nq, oq + r + 0.035, yq), d = L(p, np, op + r + 0.035, yp);
          mbR.quad(a, b, c, d, null, null, [0, 1, 0]);
          mbR.quad(L(p, np, op + r - 0.035, yp - 0.17), L(q, nq, oq + r - 0.035, yq - 0.17), b, a, null, null);
          mbR.quad(d, c, L(q, nq, oq + r + 0.035, yq - 0.17), L(p, np, op + r + 0.035, yp - 0.17), null, null);
        }
        // Fahrdraht
        const wa = L(p, np, op - 0.04, yp + 5.6), wb = L(q, nq, oq - 0.04, yq + 5.6), wc = L(q, nq, oq + 0.04, yq + 5.6), wd = L(p, np, op + 0.04, yp + 5.6);
        mbK.quad(wa, wb, wc, wd, null, null, [0, -1, 0]); mbK.quad(wd, wc, wb, wa, null, null, [0, 1, 0]);
      }
      // walkbares Deck (Drache, Spieler auf dem Viadukt)
      {
        const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (len > 0.5) {
          const dx = (q[0] - p[0]) / len, dz = (q[1] - p[1]) / len;
          const y0 = yp - 0.25, y1 = yq - 0.25;
          addDeck({ kind: 'rail', ox: p[0], oz: p[1], dx, dz, a0: 0, a1: len, hw: Math.min(wp, wq) - 0.3, h: (a) => y0 + (y1 - y0) * a / len, rails: null });
        }
      }
      // Pfeiler und Fahrleitungsmasten
      const s0 = line.cum[i];
      if (s0 - lastPillar >= 30) {
        const g = Math.max(terrainH(p[0], p[1]), -9);
        const hh = yp + bot - g;
        if (hh > 0.8 && roadClear(p[0], p[1], 0) > 1.5 && !nearTram(p[0], p[1])) {
          lastPillar = s0;
          const rot = Math.atan2(q[0] - p[0], q[1] - p[1]);
          const pc = cm.get('concrete', p[0], p[1]);
          const wpil = Math.min(wp * 0.9, 3.2);
          pc.box(p[0], g + hh / 2 - 0.5, p[1], wpil * 2 * 0.62, hh + 1, 1.7, rot, cConcD, null, true);
          pc.box(p[0], yp + bot - 0.35, p[1], wp * 2 - 0.4, 0.7, 2.2, rot, cConcD, null, false);
          addCollider({ obb: makeOBB(p[0], p[1], rot, wpil * 0.62, 0.85), top: yp + bot });
        }
      }
      if (Math.floor(s0 / 48) !== Math.floor(line.cum[j] / 48) && !stAt(i)) {
        for (const s of [1, -1]) {
          const mp = L(p, np, s * (wp - 0.4), 0);
          mbK.box(mp[0], yp + top + 3.6, mp[2], 0.22, 7.2, 0.22, 0, null, null, true);
        }
        const rot = Math.atan2(q[0] - p[0], q[1] - p[1]);
        mbK.box(p[0], yp + 6.6, p[1], wp * 2 - 0.6, 0.2, 0.2, rot + Math.PI / 2 - Math.PI / 2, null, null, false);
      }
    }
    // Prellböcke an den Endstationen
    if (!ring) for (const e of [0, N - 1]) {
      const p = C[e], q = C[e === 0 ? 1 : N - 2];
      const rot = Math.atan2(q[0] - p[0], q[1] - p[1]);
      const mb = cm.get('concrete', p[0], p[1]);
      mb.box(p[0], h[e] + 0.3, p[1], 3.4, 1.2, 0.8, rot, lin(0xc62828));
      mb.box(p[0], h[e] + 0.05, p[1], 4.6, 0.6, 2.4, rot, cConcD);
    }
    for (const st of line.stations) buildRailStation(st, cm, surf);
  }
  const meshes = cm.finish(mats, surf, { cast: { concrete: true, roof: true, cat: false } });
  RAIL.meshes = meshes;
}

/* Station: zwei Seitenperrons (Endstation: am Stumpfgleis), Dach über der Mitte, Schilder, Zugang */
function buildRailStation(st, cm, surf) {
  const F = railStationFrame(st);
  const y = st.y, py = y + RL.PLH, half = st.PL / 2;
  const lat = st.term ? RL.EDGE + RL.PLW / 2 : RL.TRK + RL.EDGE + RL.PLW / 2;
  const rot = Math.atan2(F.d[0], F.d[1]);
  const isIR = st.line.kind === 'ir';
  const cPl = lin(0xbab4a8), cRoof = lin(0x9aa6b0), cCol = lin(0x6b747d);
  // Bei Hönggerberg/Z teilen sich S2 und S5 den Mittelperron (jeweils links = +1): nur S2 baut ihn
  const sides = st.wide < 0 ? [-1] : [1, -1];
  st.platforms = [];
  for (const s of sides) {
    const c = F.W(0, s * lat);
    const mb = cm.get('platform', c[0], c[1]);
    mb.box(c[0], (y - 0.55 + py) / 2, c[1], RL.PLW, py - (y - 0.55), st.PL, rot, null, null, true);
    const ed = F.W(0, s * (lat - RL.PLW / 2 + 0.25));
    cm.get('edge', ed[0], ed[1]).box(ed[0], py + 0.005, ed[1], 0.3, 0.012, st.PL, rot);
    const ty = F.W(0, s * (lat - RL.PLW / 2 + 0.75));
    cm.get('yellow', ty[0], ty[1]).box(ty[0], py + 0.006, ty[1], 0.12, 0.012, st.PL, rot);
    // Geländer aussen (ausser bei geteiltem Mittelperron)
    const outer = !(st.wide && s === 1);
    if (outer) { const gr = F.W(0, s * (lat + RL.PLW / 2 - 0.08)); cm.get('roof', gr[0], gr[1]).box(gr[0], py + 0.55, gr[1], 0.06, 1.1, st.PL - 8, rot, cCol); }
    // Dach über dem mittleren Drittel, Säulen, Bänke, Leuchten
    const rl = st.PL * (isIR ? 0.4 : 0.45);
    const rc = F.W(0, s * lat);
    const mr = cm.get('roof', rc[0], rc[1]);
    mr.box(rc[0], py + 3.55, rc[1], RL.PLW + 1.0, 0.18, rl, rot, cRoof);
    for (let a = -rl / 2 + 4; a <= rl / 2 - 4; a += 10) {
      const cp = F.W(a, s * lat);
      mr.box(cp[0], py + 1.75, cp[1], 0.2, 3.5, 0.2, rot, cCol, null, true);
      if (Math.round(a / 10) % 2 === 0) { const bp = F.W(a + 4, s * (lat + 0.6)); mr.box(bp[0], py + 0.45, bp[1], 0.45, 0.06, 2.0, rot, lin(0x8a6a48)); }
    }
    const pdeck = F.W(-half, s * lat);
    addDeck({ kind: 'platform', ox: pdeck[0], oz: pdeck[1], dx: F.d[0], dz: F.d[1], a0: 0, a1: st.PL, hw: RL.PLW / 2, h: () => py, rails: null });
    st.platforms.push({ s, lat, c });
    // Stationsschilder
    const key = (isIR ? 'ir|' : 'sb|') + st.name;
    const rs = SIGNS.add(key, 384, 72, (ctx, w, hh) => {
      ctx.fillStyle = '#123a7a'; ctx.fillRect(0, 0, w, hh);
      ctx.fillStyle = '#fff'; ctx.fillRect(6, 6, 60, hh - 12);
      ctx.fillStyle = st.line.color; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(isIR ? 'IR' : 'S', 36, hh / 2 + 1);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; let f = 38; ctx.font = `bold ${f}px Arial`;
      while (ctx.measureText(st.name).width > 290 && f > 14) { f -= 2; ctx.font = `bold ${f}px Arial`; }
      ctx.fillText(st.name, 80, hh / 2 + 1);
    });
    for (const a of [-half + 20, -10, half - 25]) {
      const sp = F.W(a, s * (lat + RL.PLW / 2 - 0.4));
      const m = signMesh(rs, 'glow', 3.2, 0.6);
      m.position.set(sp[0], py + 2.4, sp[1]); m.rotation.y = rot + (s > 0 ? Math.PI / 2 : -Math.PI / 2);
      surf.add(m); nearVis(m, 380);
    }
  }
  // Zugang: Innenstadt Treppe, sonst (und im Knoten, an hohen Stationen) Lift
  const ground0 = Math.max(terrainH(st.x, st.z), WS.WATER_Y);
  const inner = Math.abs(st.x - WS.CENTER.x) < 1500 && Math.abs(st.z - WS.CENTER.z) < 1500;
  st.access = (!st.hub && inner && py - ground0 < 16) ? 'stairs' : 'lift';
  for (const pl of st.platforms) {
    for (const e of (st.access === 'stairs' ? [1] : [1, -1])) {
      if (st.access === 'stairs') buildRailStair(st, F, pl, e, cm);
      else {
        const a = e * (half - 3.5), q = pl.s * (pl.lat + RL.PLW / 2 + 1.5);
        const lp = F.W(a, q);
        const gy = groundBelow(lp[0], lp[1], py);
        const levels = [{ y: gy, name: 'Strasse', ground: true }, { y: py, name: 'Perron ' + st.name + (st.term ? '' : (pl.s > 0 ? ' (Gleis 1)' : ' (Gleis 2)')) }];
        if (st.hub) levels.push({ y: HUB.TUN_Y, name: 'Fussgängertunnel', tunnel: true });
        addLift({ x: lp[0], z: lp[1], rot, levels, open: -pl.s, station: st.name, hub: st.hub });
      }
    }
  }
  // Wo das Deck auf Pfeilern steht, bleibt der Bodenbereich unter dem Perron frei
}
/* Boden unter einem Punkt (Gelände, Wasser) */
function groundBelow(x, z, yTop) {
  return Math.max(terrainH(x, z), WS.WATER_Y + 0.2);
}
/* Treppe vom Perronende nach unten, aussen neben dem Viadukt */
function buildRailStair(st, F, pl, e, cm) {
  const py = st.y + RL.PLH;
  const q = pl.s * (pl.lat + RL.PLW / 2 + 1.6);
  const a0 = e * (st.PL / 2 - 6);
  const top = F.W(a0, q);
  let gy = groundBelow(top[0], top[1], py);
  const rise = py - gy, run = rise / 0.58;
  const end = F.W(a0 + e * run, q);
  gy = groundBelow(end[0], end[1], py);
  const rot = Math.atan2(F.d[0], F.d[1]);
  const mb = cm.get('platform', top[0], top[1]), mr = cm.get('roof', top[0], top[1]);
  const n = Math.max(4, Math.ceil(rise / 0.18));
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n;
    const a = a0 + e * run * (t0 + t1) / 2;
    const p = F.W(a, q);
    const yS = py - rise * t1;
    mb.box(p[0], yS - 0.15 + 0.09, p[1], 2.8, 0.3, run / n + 0.02, rot, null, null, true);
  }
  // Brüstungen
  for (const s of [1, -1]) {
    const pa = F.W(a0, q + s * 1.45), pb = F.W(a0 + e * run, q + s * 1.45);
    const segs = 8;
    for (let k = 0; k < segs; k++) {
      const u0 = k / segs, u1 = (k + 1) / segs;
      const x0 = lerp(pa[0], pb[0], u0), z0 = lerp(pa[1], pb[1], u0), x1 = lerp(pa[0], pb[0], u1), z1 = lerp(pa[1], pb[1], u1);
      const y0 = py - rise * u0, y1 = py - rise * u1;
      mr.box((x0 + x1) / 2, (y0 + y1) / 2 + 0.95, (z0 + z1) / 2, 0.06, 0.06, run / segs + 0.05, rot, lin(0x6b747d));
    }
  }
  // Treppe als schräges Deck (begehbar)
  const st0 = F.W(a0, q);
  const dir = [F.d[0] * e, F.d[1] * e];
  addDeck({ kind: 'stair', ox: st0[0], oz: st0[1], dx: dir[0], dz: dir[1], a0: -1.6, a1: run + 0.5, hw: 1.35, h: (a) => clamp(py - rise * a / run, gy, py), rails: null });
  // Verbindung Perron → Treppe (kurzes Podest)
  const lp = F.W(a0 - e * 1.5, (pl.s * (pl.lat + RL.PLW / 2 + 0.6)));
  mb.box(lp[0], py - 0.1, lp[1], 2.4, 0.2, 3.2, rot);
  const ld = F.W(a0 - e * 2.6, pl.s * pl.lat);
  addDeck({ kind: 'landing', ox: ld[0], oz: ld[1], dx: pl.s * F.l[0], dz: pl.s * F.l[1], a0: 0, a1: RL.PLW / 2 + 3.2, hw: 2.0, h: () => py, rails: null });
  reserveCircle(end[0], end[1], 4);
}
