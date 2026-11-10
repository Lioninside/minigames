/* ================= ÖFFENTLICHER VERKEHR: NETZ =================
   Fahrpfade (Bus, Auto, Fussgänger entlang der Strassen), Buslinien mit Haltebuchten,
   Tramlinie Venedig – Zentrum – ETH mit stark gerundeten Kurven, vier U-Bahn-Linien mit
   beleuchteten Stationen, Treppenabgängen und Tunneln. */

const TRANSIT = { busLines: [], stops: [], tram: null, metro: [], stations: [], reserves: null, shelters: [] };

/* ---------- Reservierte Flächen (keine Gebäude/Bäume) ---------- */
function initReserves() { TRANSIT.reserves = new SHash(40); }
function reserveCircle(x, z, r) { const o = { t: 'c', x, z, r }; TRANSIT.reserves.insert(o, x - r, z - r, x + r, z + r); }
function reserveSeg(ax, az, bx, bz, r) { const o = { t: 's', ax, az, bx, bz, r }; TRANSIT.reserves.insert(o, Math.min(ax, bx) - r, Math.min(az, bz) - r, Math.max(ax, bx) + r, Math.max(az, bz) + r); }
function reservePoly(pts, r) { for (let i = 0; i < pts.length - 1; i++) reserveSeg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r); }
function reserveOBB(o) { const b = obbBounds(o, 0); const r = { t: 'o', o }; TRANSIT.reserves.insert(r, b[0], b[1], b[2], b[3]); }
function isReserved(x, z, m) {
  m = m || 0;
  return TRANSIT.reserves.query(x - m - 1, z - m - 1, x + m + 1, z + m + 1, (o) => {
    if (o.t === 'c') return Math.hypot(x - o.x, z - o.z) < o.r + m;
    if (o.t === 's') return segDist(x, z, o.ax, o.az, o.bx, o.bz) < o.r + m;
    return obbContains(o.o, x, z, m);
  });
}

/* ---------- Pfad mit 1-m-Stützstellen ---------- */
class TPath {
  constructor(pts, marks, opts) {
    // pts: [[x,y,z],...] geschlossene Schleife. marks: Indizes in pts, deren s gesucht ist.
    // opts.ds: Stützstellen-Abstand (Standard 1 m), opts.noSpeed: kein Geschwindigkeitsprofil
    const n = pts.length;
    const cum = new Float64Array(n + 1);
    for (let i = 1; i <= n; i++) {
      const a = pts[i - 1], b = pts[i % n];
      cum[i] = cum[i - 1] + Math.hypot(b[0] - a[0], b[2] - a[2]);
    }
    this.L = cum[n];
    this.markS = (marks || []).map(i => cum[i]);
    const m = Math.max(2, Math.ceil(this.L / ((opts && opts.ds) || 1)));
    this.n = m; this.ds = this.L / m;
    this.X = new Float32Array(m); this.Y = new Float32Array(m); this.Z = new Float32Array(m);
    let j = 0;
    for (let k = 0; k < m; k++) {
      const s = k * this.ds;
      while (j < n - 1 && cum[j + 1] < s) j++;
      const a = pts[j], b = pts[(j + 1) % n];
      const seg = cum[j + 1] - cum[j];
      const f = seg > 1e-6 ? (s - cum[j]) / seg : 0;
      this.X[k] = lerp(a[0], b[0], f); this.Y[k] = lerp(a[1], b[1], f); this.Z[k] = lerp(a[2], b[2], f);
    }
    if (!(opts && opts.noSpeed)) this.computeSpeed(1.6, 1.1);
  }
  idx(s) { let t = s / this.ds; t = ((t % this.n) + this.n) % this.n; return t; }
  at(s, out) {
    const t = this.idx(s), i = Math.floor(t), f = t - i, j = (i + 1) % this.n;
    const o = out || {};
    o.x = lerp(this.X[i], this.X[j], f); o.y = lerp(this.Y[i], this.Y[j], f); o.z = lerp(this.Z[i], this.Z[j], f);
    const a = (i - 2 + this.n) % this.n, b = (i + 3) % this.n;
    let dx = this.X[b] - this.X[a], dz = this.Z[b] - this.Z[a]; const l = Math.hypot(dx, dz) || 1;
    o.dx = dx / l; o.dz = dz / l;
    return o;
  }
  computeSpeed(alat, dec) {
    const n = this.n, v = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i - 3 + n) % n, b = i, c = (i + 3) % n;
      const ax = this.X[b] - this.X[a], az = this.Z[b] - this.Z[a], bx = this.X[c] - this.X[b], bz = this.Z[c] - this.Z[b];
      const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1;
      const ang = Math.acos(clamp((ax * bx + az * bz) / (la * lb), -1, 1));
      const k = ang / ((la + lb) / 2);
      v[i] = k > 1e-4 ? Math.sqrt(alat / k) : 99;
    }
    for (let pass = 0; pass < 2; pass++) for (let i = n - 1; i >= 0; i--) { const nx = v[(i + 1) % n]; v[i] = Math.min(v[i], Math.sqrt(nx * nx + 2 * dec * this.ds)); }
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) { const pv = v[(i - 1 + n) % n]; v[i] = Math.min(v[i], Math.sqrt(pv * pv + 2 * 1.2 * this.ds)); }
    this.vmax = v;
  }
  speedAt(s) { return this.vmax[Math.floor(this.idx(s))]; }
  nearestS(x, z) {
    let best = 1e18, bi = 0;
    for (let i = 0; i < this.n; i++) { const d = (this.X[i] - x) ** 2 + (this.Z[i] - z) ** 2; if (d < best) { best = d; bi = i; } }
    return bi * this.ds;
  }
}

/* ---------- Strassenpfade ---------- */
function routeLoop(seq) {
  const dirs = [];
  for (let i = 0; i < seq.length - 1; i++) dirs.push([seq[i], seq[i + 1]]);
  for (let i = seq.length - 1; i > 0; i--) dirs.push([seq[i], seq[i - 1]]);
  return dirs;
}

/* kind: 'bus' | 'car' | 'ped'. Liefert {pts, marks, stops[]} */
function buildRoadPath(seq, kind, line) {
  const trav = routeLoop(seq);
  const pts = [], marks = [], stops = [];
  const segs = [];
  for (const [u, v] of trav) {
    const e = edgeBetween(u, v);
    const sg = e.a === u.id ? 1 : -1;
    const tdx = e.dx * sg, tdz = e.dz * sg, lnx = e.nx * sg, lnz = e.nz * sg;
    const trimU = u.round ? u.ringR + 3 : u.r + (kind === 'ped' ? 1 : 3);
    const trimV = v.round ? v.ringR + 3 : v.r + (kind === 'ped' ? 1 : 3);
    const lenUse = e.len - trimU - trimV;
    const list = [];
    const baseLat = kind === 'ped' ? -(e.w / 2 + Math.max(0.6, e.sw * 0.55)) : -e.lane;
    const stop = kind === 'bus' ? e.stops.find(s => s.side === -sg) : null;
    const latAt = (dd) => {
      if (!stop) return baseLat;
      const de = sg > 0 ? dd : e.len - dd;       // Abstand ab Knoten a
      const k = 1 - smooth(11, 30, Math.abs(de - stop.d));
      return lerp(baseLat, -(e.w / 2 + 1.5), k);
    };
    if (lenUse > 1) {
      const n = Math.max(1, Math.ceil(lenUse / 4));
      let stopK = -1;
      for (let k = 0; k <= n; k++) {
        const dd = trimU + lenUse * k / n;      // ab u
        const de = sg > 0 ? dd : e.len - dd;
        const lat = latAt(dd);
        list.push([u.x + tdx * dd + lnx * lat, edgeY(e, de) + 0.09, u.z + tdz * dd + lnz * lat]);
        if (stop) {
          const sd = sg > 0 ? stop.d : e.len - stop.d;
          if (stopK < 0 && dd >= sd) { stopK = list.length - 1; }
        }
      }
      if (stop && stopK >= 0) {
        // genauen Haltepunkt einsetzen
        const sd = sg > 0 ? stop.d : e.len - stop.d;
        const lat = latAt(sd);
        list.splice(stopK, 0, [u.x + tdx * sd + lnx * lat, edgeY(e, stop.d) + 0.09, u.z + tdz * sd + lnz * lat]);
        list._stop = { k: stopK, stop };
      }
    } else {
      const dd = e.len / 2, de = sg > 0 ? dd : e.len - dd;
      list.push([u.x + tdx * dd + lnx * baseLat, edgeY(e, de) + 0.09, u.z + tdz * dd + lnz * baseLat]);
    }
    segs.push({ u, v, e, list, dir: [tdx, tdz] });
  }
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i], nx = segs[(i + 1) % segs.length];
    const base = pts.length;
    for (const p of s.list) pts.push(p);
    if (s.list._stop) { marks.push(base + s.list._stop.k); stops.push(s.list._stop.stop); }
    // Übergang am Knoten s.v
    const node = s.v;
    const p1 = s.list[s.list.length - 1], p2 = nx.list[0];
    const d1 = s.dir, d2 = nx.dir;
    const uturn = nx.v === s.u;
    const y = node.y + 0.09;
    if (node.round && !uturn && kind !== 'ped') {
      const R = 17.5;
      const th1 = Math.atan2(p1[2] - node.z, p1[0] - node.x) - 0.3;
      let th2 = Math.atan2(p2[2] - node.z, p2[0] - node.x) + 0.3;
      while (th2 > th1 - 0.4) th2 -= Math.PI * 2;
      const ring = [];
      const steps = Math.max(4, Math.ceil((th1 - th2) * R / 3));
      for (let k = 0; k <= steps; k++) { const th = lerp(th1, th2, k / steps); ring.push([node.x + Math.cos(th) * R, node.z + Math.sin(th) * R, th]); }
      const r0 = ring[0], rN = ring[ring.length - 1];
      const tin = [Math.sin(r0[2]), -Math.cos(r0[2])], tout = [Math.sin(rN[2]), -Math.cos(rN[2])];
      for (const q of hermite([p1[0], p1[2]], d1, [r0[0], r0[1]], tin, Math.hypot(r0[0] - p1[0], r0[1] - p1[2]), 5)) pts.push([q[0], y, q[1]]);
      for (const q of ring) pts.push([q[0], y, q[1]]);
      for (const q of hermite([rN[0], rN[1]], tout, [p2[0], p2[2]], d2, Math.hypot(rN[0] - p2[0], rN[1] - p2[2]), 5)) pts.push([q[0], y, q[1]]);
    } else {
      const dist = Math.hypot(p2[0] - p1[0], p2[2] - p1[2]);
      const k = uturn ? Math.max(10, dist * 1.4) : dist * 0.9;
      const n = Math.max(3, Math.ceil(dist / 2.5) + (uturn ? 6 : 0));
      for (const q of hermite([p1[0], p1[2]], d1, [p2[0], p2[2]], d2, k, n)) pts.push([q[0], y, q[1]]);
    }
  }
  return { pts, marks, stops };
}

/* Zufällige Route über das Strassennetz */
function randomRoute(start, minLen, maxLen, allowAlley) {
  const seq = [start]; const used = new Set([start.id]);
  let len = 0, prevDir = null;
  const target = rr(minLen, maxLen);
  while (len < target) {
    const cur = seq[seq.length - 1];
    const cands = [];
    for (const id of cur.adj) {
      const e = ROADS.edges[id];
      if (e.dead || (!allowAlley && e.type === 'alley')) continue;
      const o = otherNode(e, cur.id);
      if (used.has(o.id)) continue;
      const dx = (o.x - cur.x) / e.len, dz = (o.z - cur.z) / e.len;
      cands.push({ o, e, dot: prevDir ? dx * prevDir[0] + dz * prevDir[1] : 0, dx, dz });
    }
    if (!cands.length) break;
    let c;
    if (chance(0.6)) c = cands.reduce((a, b) => (b.dot > a.dot ? b : a)); else c = pick(cands);
    seq.push(c.o); used.add(c.o.id); len += c.e.len; prevDir = [c.dx, c.dz];
  }
  return { seq, len };
}

/* ---------- Buslinien ---------- */
const BUS_NUMBERS = [31, 32, 33, 46, 61, 62, 72, 75, 80, 89, 91, 94];
const BUS_COLORS = ['#e2001a', '#00923f', '#009ee0', '#f39200', '#7b2482', '#a5027d', '#5aa034', '#d0a700', '#00a3a6', '#c2185b', '#6d4c41', '#3949ab'];
function planBusLines() {
  const nodes = ROADS.nodes.filter(n => !n.dead && n.adj.length >= 3);
  let stopName = 0;
  for (let k = 0; k < BUS_NUMBERS.length; k++) {
    let best = null;
    for (let t = 0; t < 40; t++) {
      const r = randomRoute(pick(nodes), 2600, 4200, false);
      if (r.len > 2000 && (!best || r.len > best.len)) { best = r; if (r.len > 2600) break; }
    }
    if (!best) continue;
    const line = { num: BUS_NUMBERS[k], color: BUS_COLORS[k], seq: best.seq, stops: [] };
    // Haltestellen
    let acc = 220;
    for (let i = 1; i < best.seq.length; i++) {
      const e = edgeBetween(best.seq[i - 1], best.seq[i]);
      acc += e.len;
      if (acc < 360 || e.len < 85 || e.bridge || e.type === 'alley' || e.sw < 3) continue;
      if (i === 1 || i === best.seq.length - 1) continue;
      acc = 0;
      if (!e.stops.length) {
        const name = BUS_STOPS[stopName++ % BUS_STOPS.length];
        for (const side of [1, -1]) {
          const A = ROADS.nodes[e.a];
          const d = e.len / 2;
          const st = { id: TRANSIT.stops.length, edge: e, side, d, name, lines: new Set(),
            x: A.x + e.dx * d + e.nx * side * (e.w / 2 + 1.5), z: A.z + e.dz * d + e.nz * side * (e.w / 2 + 1.5), y: edgeY(e, d) };
          e.stops.push(st); TRANSIT.stops.push(st);
        }
      }
    }
    TRANSIT.busLines.push(line);
  }
  // Pfade erst bauen, wenn alle Haltestellen feststehen (Linien teilen Buchten)
  for (const line of TRANSIT.busLines) {
    const p = buildRoadPath(line.seq, 'bus', line);
    line.path = new TPath(p.pts, p.marks);
    line.stopList = p.stops.map((st, i) => ({ s: line.path.markS[i], stop: st }));
    line.stopList.sort((a, b) => a.s - b.s);
    for (const st of p.stops) st.lines.add(line.num);
    line.terminusA = line.stopList.length ? line.stopList[0].stop.name : '';
    line.terminusB = line.stopList.length ? line.stopList[line.stopList.length - 1].stop.name : '';
  }
  // Wartehäuschen-Flächen reservieren
  for (const st of TRANSIT.stops) {
    const e = st.edge, A = ROADS.nodes[e.a];
    const l = st.side * (e.w / 2 + e.sw + 1.6);
    const x = A.x + e.dx * st.d + e.nx * l, z = A.z + e.dz * st.d + e.nz * l;
    st.shelter = { x, z, rot: Math.atan2(-e.nx * st.side, -e.nz * st.side) };
    reserveCircle(x, z, 4.5);
  }
}

/* ---------- Tram ---------- */
function balloonPts(P_end, t, r, P_start, E, fwd1, lat, tip) {
  return [
    P_end,
    [P_end[0] + t[0] * fwd1, P_end[1] + t[1] * fwd1],
    [E[0] + t[0] * tip * 0.55 + r[0] * lat, E[1] + t[1] * tip * 0.55 + r[1] * lat],
    [E[0] + t[0] * tip, E[1] + t[1] * tip],
    [E[0] + t[0] * tip * 0.55 - r[0] * lat, E[1] + t[1] * tip * 0.55 - r[1] * lat],
    [P_start[0] + t[0] * fwd1, P_start[1] + t[1] * fwd1],
    P_start
  ];
}

/* Doppelgleis-Schleife aus Mittellinie C (2D). Rechtsverkehr, Schleifen an beiden Enden. */
function trackLoop(C, off, fwd1, lat, tip) {
  const nrm = polyNormals(C);
  const A = C.map((p, i) => [p[0] - nrm[i][0] * off, p[1] - nrm[i][1] * off]);
  const Cr = C.slice().reverse(), nr = polyNormals(Cr);
  const B = Cr.map((p, i) => [p[0] - nr[i][0] * off, p[1] - nr[i][1] * off]);
  const last = C.length - 1;
  const tE = [C[last][0] - C[last - 1][0], C[last][1] - C[last - 1][1]]; let l = Math.hypot(tE[0], tE[1]); tE[0] /= l; tE[1] /= l;
  const rE = [-tE[1], tE[0]];
  const tS = [C[0][0] - C[1][0], C[0][1] - C[1][1]]; l = Math.hypot(tS[0], tS[1]); tS[0] /= l; tS[1] /= l;
  const rS = [-tS[1], tS[0]];
  const balE = catmullSample(balloonPts(A[A.length - 1], tE, rE, B[0], C[last], fwd1, lat, tip), 2);
  const balS = catmullSample(balloonPts(B[B.length - 1], tS, rS, A[0], C[0], fwd1, lat, tip), 2);
  const loop = [];
  for (const p of A) loop.push(p);
  for (let i = 1; i < balE.length - 1; i++) loop.push(balE[i]);
  for (const p of B) loop.push(p);
  for (let i = 1; i < balS.length - 1; i++) loop.push(balS[i]);
  return { loop, A, B, balE, balS, nA: A.length, nBalE: balE.length - 2, nB: B.length };
}

function planTram() {
  const H = WS.HILL, V = WS.TRAM_V;
  const route = ROADS.tramRoute;
  if (!route || route.length < 2) return;
  const n0 = route[0];
  const toN0 = [n0.x - V.x, n0.z - V.z]; const l0 = Math.hypot(toN0[0], toN0[1]);
  const vEntry = [V.x + toN0[0] / l0 * 22, V.z + toN0[1] / l0 * 22];
  const graphPts = [vEntry];
  for (const n of route) graphPts.push([n.x, n.z]);
  // Bergstrecke zur ETH: Bogen am Hang, Kehre, dann auf das Plateau
  const last = route[route.length - 1];
  const th0 = Math.atan2(last.z - H.z, last.x - H.x), r0 = Math.hypot(last.x - H.x, last.z - H.z);
  const hill = [];
  const P = (th, r) => [H.x + Math.cos(th) * r, H.z + Math.sin(th) * r];
  for (let k = 1; k <= 6; k++) hill.push(P(th0 - k * 0.26, lerp(r0, 225, k / 6)));
  const thK = th0 - 6 * 0.26;
  hill.push(P(thK - 0.22, 196));
  hill.push(P(thK - 0.12, 165));
  for (let k = 1; k <= 7; k++) hill.push(P(thK + k * 0.3, lerp(160, 112, k / 7)));
  const plaza = [H.x, H.z + 62];
  const lastHill = hill[hill.length - 1];
  const dpl = [plaza[0] - lastHill[0], plaza[1] - lastHill[1]]; const ldp = Math.hypot(dpl[0], dpl[1]);
  const eEntry = [plaza[0] - dpl[0] / ldp * 16, plaza[1] - dpl[1] / ldp * 16];
  // Mittellinie zusammensetzen
  const gpFull = filletPolyline(graphPts.concat([hill[0]]), 26, 2);
  const gp = gpFull.slice(0, -4);
  const hp = catmullSample([gpFull[gpFull.length - 4]].concat(hill, [eEntry]), 2);
  const C = gp.concat(hp.slice(1));
  // doppelte Punkte entfernen
  const Cc = [C[0]];
  for (let i = 1; i < C.length; i++) if (Math.hypot(C[i][0] - Cc[Cc.length - 1][0], C[i][1] - Cc[Cc.length - 1][1]) > 0.5) Cc.push(C[i]);
  const tl = trackLoop(Cc, 1.6, 8, 15, 34);
  const graphLen = polyLength(filletPolyline(graphPts, 26, 2));
  // Höhe: auf der Strasse = Strassenhöhe, am Hang = Gelände + Schotterbett
  const yAt = (x, z, onRoad) => {
    if (onRoad) { const d = roadClear(x, z, 4); if (RC_EDGE && d < 0) { const e = RC_EDGE, A = ROADS.nodes[e.a]; const dd = clamp((x - A.x) * e.dx + (z - A.z) * e.dz, 0, e.len); return edgeY(e, dd) + 0.09; } }
    return terrainH(x, z) + 0.3;
  };
  // Welche Punkte der Mittellinie liegen auf der Strasse?
  const cum = [0]; for (let i = 1; i < Cc.length; i++) cum.push(cum[i - 1] + Math.hypot(Cc[i][0] - Cc[i - 1][0], Cc[i][1] - Cc[i - 1][1]));
  const onRoadC = Cc.map((p, i) => cum[i] > 25 && cum[i] < graphLen - 10);
  const tram = { C: Cc, cum, onRoadC, loop: tl, graphLen, plazaV: [V.x, V.z], plazaE: plaza, yAt };
  // Schleife mit Höhen
  const pts3 = [];
  const nearC = (x, z) => { let bi = 0, bd = 1e18; for (let i = 0; i < Cc.length; i += 2) { const d = (Cc[i][0] - x) ** 2 + (Cc[i][1] - z) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
  for (const p of tl.loop) { const ci = nearC(p[0], p[1]); const onR = onRoadC[ci] && Math.hypot(Cc[ci][0] - p[0], Cc[ci][1] - p[1]) < 6; pts3.push([p[0], yAt(p[0], p[1], onR), p[1]]); }
  // Plätze an den Schleifen glätten (flach auf Platzhöhe)
  for (const p of pts3) {
    if (Math.hypot(p[0] - V.x, p[2] - V.z) < 50) p[1] = terrainH(V.x, V.z) + 0.12;
    if (Math.hypot(p[0] - plaza[0], p[2] - plaza[1]) < 48) p[1] = terrainH(plaza[0], plaza[1]) + 0.12;
  }
  tram.pts3 = pts3;
  tram.onRoad3 = tl.loop.map((p) => { const ci = nearC(p[0], p[1]); return onRoadC[ci]; });
  // Stationen
  const stations = [];
  let name = 0;
  stations.push({ name: TRAM_STATIONS[name++], term: 'V' });
  let acc = 0;
  for (let i = 1; i < route.length; i++) {
    const e = edgeBetween(route[i - 1], route[i]);
    acc += e.len;
    if (acc > 330 && e.len > 100) {
      acc = 0;
      const A = ROADS.nodes[e.a];
      const d = e.len / 2;
      const sx = A.x + e.dx * d, sz = A.z + e.dz * d;
      stations.push({ name: TRAM_STATIONS[name++ % TRAM_STATIONS.length], x: sx, z: sz, edge: e, d });
    }
  }
  const mid = hill[8];
  stations.push({ name: 'Waldhaus', x: mid[0], z: mid[1], hill: true });
  stations.push({ name: 'ETH Zentrum', term: 'E' });
  tram.stations = stations;
  // Endstationen in den Schleifen: am Scheitelpunkt
  const balStart = tl.nA, balEnd = tl.nA + tl.nBalE;
  const tipE = Math.floor((balStart + balEnd) / 2);
  const bs2 = tl.nA + tl.nBalE + tl.nB;
  const tipV = Math.floor((bs2 + tl.loop.length) / 2);
  // Pfad
  const marks = [];
  const stopInfo = [];
  for (const st of stations) {
    if (st.term === 'E') { marks.push(tipE); stopInfo.push({ st, track: 'E' }); continue; }
    if (st.term === 'V') { marks.push(tipV); stopInfo.push({ st, track: 'V' }); continue; }
    // Gleis A (Hinweg) und B (Rückweg): nächster Punkt
    let ba = 0, bda = 1e18, bb = 0, bdb = 1e18;
    for (let i = 0; i < tl.loop.length; i++) {
      const d = (tl.loop[i][0] - st.x) ** 2 + (tl.loop[i][1] - st.z) ** 2;
      if (i < tl.nA) { if (d < bda) { bda = d; ba = i; } }
      else if (i >= balEnd && i < balEnd + tl.nB) { if (d < bdb) { bdb = d; bb = i; } }
    }
    marks.push(ba); stopInfo.push({ st, track: 'A', i: ba });
    marks.push(bb); stopInfo.push({ st, track: 'B', i: bb });
  }
  tram.path = new TPath(pts3, marks, { noSpeed: true });
  tram.path.computeSpeed(1.2, 0.9);
  tram.stopList = stopInfo.map((o, k) => ({ s: tram.path.markS[k], stop: o.st, track: o.track, i: marks[k] }));
  tram.stopList.sort((a, b) => a.s - b.s);
  // Perrons: rechts der Fahrtrichtung
  tram.platforms = [];
  for (const so of tram.stopList) {
    const p = tram.path.at(so.s);
    const rx = -p.dz, rz = p.dx; // rechts
    const off = 1.1 + 0.3 + 1.25;
    tram.platforms.push({ x: p.x + rx * off, z: p.z + rz * off, y: p.y, dx: p.dx, dz: p.dz, rx, rz, name: so.stop.name, stop: so });
  }
  // Freihalten
  reserveCircle(V.x, V.z, 52);
  reserveCircle(plaza[0], plaza[1], 46);
  reservePoly(hp, 9);
  reservePoly(gp.slice(0, 20), 8);
  for (const pl of tram.platforms) reserveCircle(pl.x, pl.z, 6);
  TRANSIT.tram = tram;
}

/* ---------- U-Bahn ---------- */
const METRO_DEF = [
  { name: 'U1', color: '#e30613', depth: -12, wp: [[-1650, 220], [-1150, 330], [-650, 430], [-120, 260], [380, -120], [880, -300], [1320, -160]] },
  { name: 'U2', color: '#0069b4', depth: -19, wp: [[180, -1650], [240, -1120], [300, -620], [120, -200], [180, 380], [100, 950], [40, 1580]] },
  { name: 'U3', color: '#00963f', depth: -26, wp: [[-1450, -1050], [-1000, -480], [-420, -260], [620, -700], [1150, -820], [1330, -1250]] },
  { name: 'U4', color: '#f29400', depth: -33, wp: [[-1300, 1450], [-700, 1120], [-80, 820], [560, 620], [1100, 420], [1420, -330]] }
];
const M = { SL: 65, PW: 5, TL: 6.55, WALL: 8.8, CEIL: 5.2, aTop: 26 };

function planMetroStations() {
  const used = [];
  let ni = 0;
  for (const def of METRO_DEF) {
    const line = { name: def.name, color: def.color, trackY: def.depth, platY: def.depth + 1.05, stations: [] };
    for (const wp of def.wp) {
      let best = null, bd = 260;
      for (const c of ROADS.cells.values()) {
        if (c.use) continue;
        const d = Math.hypot(c.cx - wp[0], c.cz - wp[1]);
        if (d >= bd) continue;
        if (waterDist(c.cx, c.cz) < 70) continue;
        if (used.some(u => Math.hypot(u.cx - c.cx, u.cz - c.cz) < 150)) continue;
        bd = d; best = c;
      }
      if (!best) continue;
      best.use = 'station'; used.push(best);
      line.stations.push({ cell: best, x: best.cx, z: best.cz, name: METRO_STATIONS[ni++ % METRO_STATIONS.length], line });
    }
    if (line.stations.length >= 2) TRANSIT.metro.push(line);
  }
}

function planMetroLines() {
  for (const line of TRANSIT.metro) {
    const S = line.stations;
    for (let i = 0; i < S.length; i++) {
      const p = S[Math.max(0, i - 1)], n = S[Math.min(S.length - 1, i + 1)];
      let dx = n.x - p.x, dz = n.z - p.z; const l = Math.hypot(dx, dz); dx /= l; dz /= l;
      const st = S[i];
      st.dx = dx; st.dz = dz; st.rot = Math.atan2(dx, dz);
      st.surfY = terrainH(st.x + dx * (M.aTop - 3), st.z + dz * (M.aTop - 3));
      st.trackY = line.trackY; st.platY = line.platY;
      st.aTop = M.aTop;
      st.aBot = M.aTop - (st.surfY - st.platY) * 1.7320508;
      st.ceilY = st.platY + M.CEIL;
      TRANSIT.stations.push(st);
    }
    // Mittellinie: gerade durch die Stationen, dazwischen Hermite-Bögen
    const C = [];
    for (let i = 0; i < S.length; i++) {
      const st = S[i];
      const a = [st.x - st.dx * 75, st.z - st.dz * 75], b = [st.x + st.dx * 75, st.z + st.dz * 75];
      if (i > 0) {
        const pv = C[C.length - 1], pst = S[i - 1];
        const dist = Math.hypot(a[0] - pv[0], a[1] - pv[1]);
        for (const q of hermite(pv, [pst.dx, pst.dz], a, [st.dx, st.dz], dist * 0.9, Math.max(4, Math.ceil(dist / 6)))) C.push(q);
      }
      for (const q of densify([a, b], 3)) C.push(q);
    }
    line.C = C;
    const tl = trackLoop(C, M.TL, 25, 48, 130);
    line.tl = tl;
    line.path = new TPath(tl.loop.map(p => [p[0], line.trackY, p[1]]), [], { noSpeed: true });
    line.path.computeSpeed(1.4, 1.0);
    // Halte: Zugmitte auf Stationsmitte, Gleis A und B
    line.stopList = [];
    for (const st of S) {
      const r = [-st.dz, st.dx];
      for (const sgn of [1, -1]) {
        const tx = st.x + r[0] * M.TL * sgn, tz = st.z + r[1] * M.TL * sgn;
        line.stopList.push({ s: line.path.nearestS(tx, tz), stop: st });
      }
    }
    line.stopList.sort((a, b) => a.s - b.s);
    // Treppenöffnung und Pavillon an der Oberfläche
    for (const st of S) {
      const holeA = st.aTop - 2.6;
      addTerrainHole(st.x + st.dx * holeA, st.z + st.dz * holeA, st.rot, 3.0, 2.35);
      const pc = M.aTop - 2.5;
      reserveCircle(st.x + st.dx * pc, st.z + st.dz * pc, 9);
      reserveCircle(st.x + st.dx * (M.aTop + 6), st.z + st.dz * (M.aTop + 6), 4);
    }
  }
}

/* Lokal -> Welt für Stationen (lokal x = quer (links +), z = entlang) */
function stLocalToWorld(st, lx, lz) {
  const c = Math.cos(st.rot), s = Math.sin(st.rot);
  return [st.x + lx * c + lz * s, st.z - lx * s + lz * c];
}
function stWorldToLocal(st, x, z) {
  const c = Math.cos(st.rot), s = Math.sin(st.rot);
  const dx = x - st.x, dz = z - st.z;
  return [dx * c - dz * s, dx * s + dz * c];
}

function metroTextures() {
  const tiles = makeCanvas(256, 256);
  { const ctx = tiles.getContext('2d'); ctx.fillStyle = '#c9ccc9'; ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) { const v = 228 + rnd() * 20 | 0; ctx.fillStyle = `rgb(${v},${v},${v - 2})`; ctx.fillRect(x * 32 + 1, y * 16 + 1, 30, 14); } }
  const floor = makeCanvas(256, 256);
  { const ctx = floor.getContext('2d'); ctx.fillStyle = '#8b8d90'; ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = 150 + rnd() * 30 | 0; ctx.fillStyle = `rgb(${v},${v},${v + 4})`; ctx.fillRect(x * 64 + 1, y * 64 + 1, 62, 62); }
    ctx.globalAlpha = 0.25; ctx.drawImage(noiseCanvas(256, 256, 0.5, 0.4, 6, 4), 0, 0); ctx.globalAlpha = 1; }
  const gravel = noiseCanvas(128, 128, 0.35, 0.5, 14, 8);
  return { tiles: canvasTex(tiles), floor: canvasTex(floor), gravel: canvasTex(gravel) };
}

function stationSign(name, color) {
  const cv = makeCanvas(512, 128), ctx = cv.getContext('2d');
  ctx.fillStyle = '#123a7a'; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, 496, 112);
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(70, 64, 40, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 44px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('U', 70, 66);
  ctx.textAlign = 'left'; let size = 58; ctx.font = `bold ${size}px Arial`;
  while (ctx.measureText(name).width > 380 && size > 20) { size -= 2; ctx.font = `bold ${size}px Arial`; }
  ctx.fillText(name, 128, 66);
  return canvasTex(cv, { clamp: true });
}

/* Stationen, Treppen, Pavillons und Tunnel erzeugen */
function buildMetro(scene, surfaceGroup, mats) {
  const ug = new THREE.Group(); ug.name = 'underground';
  scene.add(ug);
  const tex = metroTextures();
  const wallMat = new THREE.MeshStandardMaterial({ map: tex.tiles, roughness: 0.35, metalness: 0.0 });
  tex.tiles.repeat.set(1, 1);
  const floorMat = new THREE.MeshStandardMaterial({ map: tex.floor, roughness: 0.55 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x3c3a38, roughness: 0.95, map: tex.gravel });
  const tunnelMat = new THREE.MeshStandardMaterial({ color: 0x6d6a66, roughness: 0.95, side: THREE.DoubleSide });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.7 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e8, emissiveIntensity: 1.6 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.6 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.3, metalness: 0.8 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8d8f92, roughness: 0.3, metalness: 0.9 });
  const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x5b5148, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fc3d6, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.35 });
  const M2 = { wall: wallMat, floor: floorMat, dark: darkMat, ceil: ceilMat, light: lightMat, yellow: yellowMat, steel: steelMat, sleeper: sleeperMat, rail: railMat, tunnel: tunnelMat };
  TRANSIT.ugGroup = ug;
  const colMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d2, roughness: 0.4 });
  for (const line of TRANSIT.metro) {
    const lineCol = new THREE.Color(line.color).convertSRGBToLinear();
    const bandMat = new THREE.MeshStandardMaterial({ color: lineCol, roughness: 0.4 });
    for (const st of line.stations) {
      const g = new THREE.Group();
      g.position.set(st.x, 0, st.z); g.rotation.y = st.rot;
      const mb = { wall: new MB(), floor: new MB(), dark: new MB(), ceil: new MB(), light: new MB(), yellow: new MB(), steel: new MB(), band: new MB(), col: new MB(), sleeper: new MB(), rail: new MB() };
      const { SL, PW, TL, WALL } = M;
      const tY = st.trackY, pY = st.platY, cY = st.ceilY;
      // Gleisbett
      mb.dark.box(0, tY - 0.25, 0, WALL * 2, 0.5, SL * 2, 0, null, 2);
      // Perron
      mb.floor.box(0, (tY + pY) / 2, 0, PW * 2, pY - tY, SL * 2, 0, null, 3);
      mb.yellow.box(PW - 0.35, pY + 0.005, 0, 0.3, 0.01, SL * 2, 0); mb.yellow.box(-PW + 0.35, pY + 0.005, 0, 0.3, 0.01, SL * 2, 0);
      // Wände mit Farbband
      for (const s of [1, -1]) {
        mb.wall.box(s * (WALL + 0.25), (tY + cY) / 2, 0, 0.5, cY - tY, SL * 2, 0, null, 3);
        mb.band.box(s * (WALL - 0.01), pY + 2.6, 0, 0.04, 0.35, SL * 2, 0);
        mb.dark.box(s * (WALL - 0.02), tY + 0.6, 0, 0.05, 1.2, SL * 2, 0);
      }
      // Decke mit Loch für die Treppe
      const hole0 = st.aBot + 3.4, hole1 = st.aTop + 0.5, hw = 2.35;
      const ceilPiece = (x0, x1, z0, z1) => { if (x1 - x0 < 0.05 || z1 - z0 < 0.05) return; mb.ceil.box((x0 + x1) / 2, cY + 0.15, (z0 + z1) / 2, x1 - x0, 0.3, z1 - z0, 0); };
      ceilPiece(-WALL - 0.5, WALL + 0.5, -SL, hole0);
      ceilPiece(-WALL - 0.5, WALL + 0.5, Math.min(hole1, SL), SL);
      ceilPiece(-WALL - 0.5, -hw, hole0, Math.min(hole1, SL));
      ceilPiece(hw, WALL + 0.5, hole0, Math.min(hole1, SL));
      // Lichtbänder
      for (const lx of [-7.2, -3.6, 3.6, 7.2]) {
        for (let z = -SL + 2; z < SL - 2; z += 6) {
          if (Math.abs(lx) < 4 && z > hole0 - 1 && z < hole1 + 1) continue;
          mb.light.box(lx, cY - 0.04, z + 2, 0.35, 0.06, 4.2, 0);
        }
      }
      // Stirnwände über den Tunnelportalen
      for (const s of [1, -1]) mb.wall.box(0, (tY + 6.0 + cY + 0.3) / 2, s * (SL + 0.25), WALL * 2 + 1, cY + 0.3 - tY - 6.0, 0.5, 0, null, 3);
      // Säulen
      st.columns = [];
      for (let z = -SL + 8; z < SL - 6; z += 12) {
        if (z > st.aBot - 2 && z < hole1 + 2) continue;
        for (const x of [-2.6, 2.6]) { mb.col.cyl(x, pY, z, 0.35, 0.35, cY - pY, 12, null, false); st.columns.push([x, z]); }
      }
      // Bänke
      for (let z = -SL + 14; z < SL - 10; z += 24) {
        if (z > st.aBot - 4 && z < hole1 + 3) continue;
        mb.steel.box(0, pY + 0.45, z, 0.5, 0.06, 2.4, 0); mb.steel.box(0, pY + 0.22, z - 1, 0.08, 0.44, 0.08, 0); mb.steel.box(0, pY + 0.22, z + 1, 0.08, 0.44, 0.08, 0);
      }
      // Gleise in der Station
      for (const s of [1, -1]) {
        for (let z = -SL; z < SL; z += 0.7) mb.sleeper.box(s * TL, tY + 0.06, z, 2.4, 0.12, 0.25, 0);
        for (const r of [-0.7175, 0.7175]) mb.rail.box(s * TL + r, tY + 0.2, 0, 0.07, 0.15, SL * 2, 0);
      }
      // Treppe
      buildStair(st, mb, g);
      for (const k in mb) {
        if (mb[k].empty()) continue;
        const mat = k === 'band' ? bandMat : k === 'col' ? colMat : M2[k];
        const m = new THREE.Mesh(mb[k].build(), mat);
        g.add(m);
      }
      // Stationsschilder
      const sign = stationSign(st.name, line.color);
      const signMat = new THREE.MeshStandardMaterial({ map: sign, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 0.35, roughness: 0.4 });
      for (const s of [1, -1]) for (let z = -SL + 10; z < SL - 5; z += 20) {
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), signMat);
        pl.position.set(s * (WALL - 0.03), pY + 2.6, z);
        pl.rotation.y = -s * Math.PI / 2;
        g.add(pl);
      }
      // Hängeschild über dem Perron
      for (const z of [-30, 45]) {
        if (z > st.aBot - 2 && z < hole1 + 2) continue;
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.7), signMat);
        pl.position.set(0, cY - 0.9, z); g.add(pl);
        const pl2 = pl.clone(); pl2.rotation.y = Math.PI; g.add(pl2);
      }
      ug.add(g);
      st.group = g;
      // Pavillon an der Oberfläche
      buildPavilion(st, surfaceGroup, line, sign);
    }
    // Tunnel
    buildTunnels(line, ug, M2);
  }
  ug.visible = false;
  return ug;
}

function buildStair(st, mb, g) {
  const pY = st.platY, sY = st.surfY;
  const a0 = st.aBot, a1 = st.aTop;
  const hw = 2.2;
  const nSteps = Math.ceil((sY - pY) / 0.18);
  const run = (a1 - a0) / nSteps, rise = (sY - pY) / nSteps;
  for (let i = 0; i < nSteps; i++) {
    const y = pY + rise * (i + 1), z = a0 + run * (i + 0.5);
    mb.floor.box(0, y - rise / 2 - 0.15, z, hw * 2, rise + 0.3, run, 0);
  }
  // Seitenwände des Schachts und schräge Decke
  const ceilA = st.aBot + (st.ceilY - 2.4 - pY) * 1.732;
  const n = 24;
  for (let i = 0; i < n; i++) {
    const za = lerp(a0, a1 + 0.5, i / n), zb = lerp(a0, a1 + 0.5, (i + 1) / n);
    const ya = pY + (za - a0) / 1.732, yb = pY + (zb - a0) / 1.732;
    for (const s of [1, -1]) {
      const x = s * (hw + 0.15);
      if (zb > ceilA) {
        const top = Math.min(Math.max(ya + 3.2, st.ceilY), sY - 0.05), topb = Math.min(Math.max(yb + 3.2, st.ceilY), sY - 0.05);
        if (top > ya - 0.3 + 0.05 || topb > yb - 0.3 + 0.05) {
          mb.wall.quad([x, ya - 0.3, za], [x, yb - 0.3, zb], [x, Math.max(topb, yb - 0.3), zb], [x, Math.max(top, ya - 0.3), za], null, null, [-s, 0, 0]);
          mb.wall.quad([x, yb - 0.3, zb], [x, ya - 0.3, za], [x, Math.max(top, ya - 0.3), za], [x, Math.max(topb, yb - 0.3), zb], null, null, [s, 0, 0]);
        }
      } else {
        // Geländer im Stationsraum
        mb.steel.box(x, (ya + yb) / 2 + 1.0, (za + zb) / 2, 0.06, 0.06, Math.hypot(zb - za, yb - ya) + 0.02, 0);
        mb.steel.box(x, ya + 0.5, za, 0.05, 1.0, 0.05, 0);
      }
    }
    if (zb > ceilA && ya + 3.2 < sY + 0.2) {
      mb.ceil.quad([-hw - 0.2, ya + 3.2, za], [hw + 0.2, ya + 3.2, za], [hw + 0.2, yb + 3.2, zb], [-hw - 0.2, yb + 3.2, zb], null, null, [0, -1, 0]);
      if (i % 3 === 0) mb.light.box(0, ya + 3.15, za, 0.3, 0.05, 1.2, 0);
    }
  }
  // Rückwand an der Oberfläche (unterhalb des Pavillons)
  mb.wall.box(0, sY - 1.5, a1 - 5.8, hw * 2 + 0.6, 3.5, 0.3, 0);
}

function buildPavilion(st, group, line, signTex) {
  const mbG = new MB(), mbF = new MB(), mbS = new MB();
  const sY = st.surfY;
  const a0 = st.aTop - 6.2, a1 = st.aTop + 1.2, hw = 2.75, H = 3.2;
  // Säulen + Dach
  for (const [x, z] of [[-hw, a0], [hw, a0], [-hw, a1], [hw, a1]]) mbF.box(x, sY + H / 2, z, 0.18, H, 0.18, 0);
  mbF.box(0, sY + H + 0.12, (a0 + a1) / 2, hw * 2 + 0.8, 0.24, a1 - a0 + 0.8, 0);
  // Glaswände
  mbG.box(-hw, sY + H / 2, (a0 + a1) / 2, 0.05, H, a1 - a0, 0);
  mbG.box(hw, sY + H / 2, (a0 + a1) / 2, 0.05, H, a1 - a0, 0);
  mbG.box(0, sY + H / 2, a0, hw * 2, H, 0.05, 0);
  // Brüstung um die Öffnung
  mbF.box(-2.32, sY + 0.5, st.aTop - 3.2, 0.12, 1.0, 6.0, 0);
  mbF.box(2.32, sY + 0.5, st.aTop - 3.2, 0.12, 1.0, 6.0, 0);
  const g = new THREE.Group();
  g.position.set(st.x, 0, st.z); g.rotation.y = st.rot;
  const frame = new THREE.Mesh(mbF.build(), MATS.metalDark); frame.castShadow = true; g.add(frame);
  const glass = new THREE.Mesh(mbG.build(), MATS.glass); g.add(glass);
  // Mast mit U-Würfel
  const cv = makeCanvas(128, 128), ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 128, 128); ctx.fillStyle = line.color; ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 80px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('U', 64, 70);
  const ut = canvasTex(cv);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshStandardMaterial({ map: ut, emissive: 0xffffff, emissiveMap: ut, emissiveIntensity: 0.6 }));
  cube.position.set(hw + 1.2, sY + 4.2, st.aTop + 1.0); g.add(cube);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.8, 8), MATS.metalDark); pole.position.set(hw + 1.2, sY + 1.9, st.aTop + 1.0); g.add(pole);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15), new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.4 }));
  sign.position.set(0, sY + H + 0.9, a1 + 0.42); g.add(sign);
  const sb = sign.clone(); sb.rotation.y = Math.PI; sb.position.z = a1 + 0.38; g.add(sb);
  group.add(g); nearVis(g, 450);
  // Kollision: Glaswände
  st.pavWalls = [];
  const addW = (lx, lz, hwx, hdz) => {
    const p = stLocalToWorld(st, lx, lz);
    st.pavWalls.push({ obb: makeOBB(p[0], p[1], st.rot, hwx, hdz), top: sY + H });
  };
  addW(-hw, (a0 + a1) / 2, 0.12, (a1 - a0) / 2);
  addW(hw, (a0 + a1) / 2, 0.12, (a1 - a0) / 2);
  addW(0, a0, hw, 0.12);
  addW(-2.32, st.aTop - 3.2, 0.1, 3.0);
  addW(2.32, st.aTop - 3.2, 0.1, 3.0);
}

function buildTunnels(line, ug, M2) {
  const tl = line.tl;
  const y0 = line.trackY;
  const mbT = new MB(), mbL = new MB(), mbS = new MB(), mbR = new MB(), mbD = new MB();
  const inStation = (x, z) => line.stations.some(st => { const l = stWorldToLocal(st, x, z); return Math.abs(l[1]) < M.SL - 0.2 && Math.abs(l[0]) < 12; });
  const segInStation = (a, b) => line.stations.some(st => { const la = stWorldToLocal(st, a[0], a[1]), lb = stWorldToLocal(st, b[0], b[1]); return Math.abs(la[1]) < M.SL + 0.1 && Math.abs(lb[1]) < M.SL + 0.1 && Math.abs(la[0]) < 12 && Math.abs(lb[0]) < 12; });
  // Doppelspur-Tunnel entlang der Mittellinie
  const tube = (pts, hw, H) => {
    const nrm = polyNormals(pts);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (segInStation(a, b)) continue;
      const na = nrm[i], nb = nrm[i + 1];
      const L = (p, n, l, y) => [p[0] + n[0] * l, y, p[1] + n[1] * l];
      mbT.quad(L(a, na, hw, y0 - 0.2), L(b, nb, hw, y0 - 0.2), L(b, nb, hw, y0 + H), L(a, na, hw, y0 + H), null, null);
      mbT.quad(L(a, na, -hw, y0 - 0.2), L(b, nb, -hw, y0 - 0.2), L(b, nb, -hw, y0 + H), L(a, na, -hw, y0 + H), null, null);
      mbT.quad(L(a, na, -hw, y0 + H), L(b, nb, -hw, y0 + H), L(b, nb, hw, y0 + H), L(a, na, hw, y0 + H), null, null);
      mbD.quad(L(a, na, -hw, y0 - 0.02), L(b, nb, -hw, y0 - 0.02), L(b, nb, hw, y0 - 0.02), L(a, na, hw, y0 - 0.02), null, null, [0, 1, 0]);
      if (i % 30 === 0) for (const s of [1, -1]) { const p = L(a, na, s * (hw - 0.1), y0 + H - 1.2); mbL.box(p[0], p[1], p[2], 0.15, 0.15, 0.6, Math.atan2(b[0] - a[0], b[1] - a[1])); }
    }
  };
  tube(densify(line.C, 2), M.WALL, 6.0);
  tube(densify(tl.balE, 6), 3.4, 5.4);
  tube(densify(tl.balS, 6), 3.4, 5.4);
  // Schienen und Schwellen entlang der ganzen Schleife (ausserhalb der Stationen)
  const loop = densify(tl.loop.concat([tl.loop[0]]), 2);
  const nrm = polyNormals(loop);
  for (let i = 0; i < loop.length - 1; i++) {
    const a = loop[i], b = loop[i + 1];
    if (inStation(a[0], a[1])) continue;
    const rot = Math.atan2(b[0] - a[0], b[1] - a[1]);
    if (i % 1 === 0) mbS.box(a[0], y0 + 0.06, a[1], 2.4, 0.12, 0.25, rot);
    for (const r of [-0.7175, 0.7175]) {
      const na = nrm[i], nb = nrm[i + 1];
      const p0 = [a[0] + na[0] * r, a[1] + na[1] * r], p1 = [b[0] + nb[0] * r, b[1] + nb[1] * r];
      mbR.box((p0[0] + p1[0]) / 2, y0 + 0.2, (p0[1] + p1[1]) / 2, 0.07, 0.15, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 0.02, rot);
    }
  }
  const add = (mb, mat) => { if (!mb.empty()) { const m = new THREE.Mesh(mb.build(), mat); m.frustumCulled = true; ug.add(m); } };
  add(mbT, M2.tunnel); add(mbL, M2.light); add(mbS, M2.sleeper); add(mbR, M2.rail); add(mbD, M2.dark);
}

/* ---------- Tram-Geometrie ---------- */
function buildTramTracks(scene) {
  const tram = TRANSIT.tram;
  if (!tram) return;
  const cm = new ChunkedMB(WS.CHUNK);
  const loop = tram.loop.loop;
  const pts3 = tram.pts3;
  const N = loop.length;
  const nrm = polyNormals(loop.concat([loop[0]]));
  for (let i = 0; i < N; i++) {
    const a = loop[i], b = loop[(i + 1) % N];
    const ya = pts3[i][1], yb = pts3[(i + 1) % N][1];
    const na = nrm[i], nb = nrm[i + 1];
    const onRoad = tram.onRoad3[i];
    const P = (p, n, l, y) => [p[0] + n[0] * l, y, p[1] + n[1] * l];
    const mbR = cm.get('rail', a[0], a[1]);
    const mbG = cm.get(onRoad ? 'groove' : 'ballast', a[0], a[1]);
    const lift = onRoad ? 0.03 : 0.18;
    if (!onRoad) {
      mbG.quad(P(a, na, -1.6, ya - 0.05), P(b, nb, -1.6, yb - 0.05), P(b, nb, 1.6, yb - 0.05), P(a, na, 1.6, ya - 0.05), null, null);
      if (i % 1 === 0) {
        const rot = Math.atan2(b[0] - a[0], b[1] - a[1]);
        cm.get('sleeper', a[0], a[1]).box(a[0], ya + 0.02, a[1], 2.3, 0.12, 0.22, rot);
      }
    }
    for (const r of [-0.7175, 0.7175]) {
      if (onRoad) mbG.quad(P(a, na, r - 0.16, ya + 0.025), P(b, nb, r - 0.16, yb + 0.025), P(b, nb, r + 0.16, yb + 0.025), P(a, na, r + 0.16, ya + 0.025), null, null);
      mbR.quad(P(a, na, r - 0.04, ya + lift), P(b, nb, r - 0.04, yb + lift), P(b, nb, r + 0.04, yb + lift), P(a, na, r + 0.04, ya + lift), null, null);
      if (!onRoad) {
        mbR.quad(P(a, na, r - 0.04, ya), P(b, nb, r - 0.04, yb), P(b, nb, r - 0.04, yb + lift), P(a, na, r - 0.04, ya + lift), null, null);
        mbR.quad(P(b, nb, r + 0.04, yb), P(a, na, r + 0.04, ya), P(a, na, r + 0.04, ya + lift), P(b, nb, r + 0.04, yb + lift), null, null);
      }
    }
  }
  // Fahrleitung: Masten und Drähte
  const wirePos = [];
  const C = tram.C;
  const cn = polyNormals(C);
  let acc = 0;
  for (let i = 1; i < C.length; i++) {
    acc += Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]);
    if (acc < 34) continue;
    acc = 0;
    const onRoad = tram.onRoadC[i];
    const y = tram.yAt(C[i][0], C[i][1], onRoad);
    const mb = cm.get('metal', C[i][0], C[i][1]);
    const poles = onRoad ? [0] : [-3.4, 3.4];
    for (const l of poles) mb.cyl(C[i][0] + cn[i][0] * l, y, C[i][1] + cn[i][1] * l, 0.14, 0.11, 6.6, 8, null, false);
    const ax = C[i][0] - cn[i][0] * 3.0, az = C[i][1] - cn[i][1] * 3.0, bx = C[i][0] + cn[i][0] * 3.0, bz = C[i][1] + cn[i][1] * 3.0;
    wirePos.push(ax, y + 6.3, az, bx, y + 6.3, bz);
  }
  // Fahrdraht über den Gleisen
  for (let i = 0; i < N; i += 3) {
    const a = loop[i], b = loop[(i + 3) % N];
    wirePos.push(a[0], pts3[i][1] + 5.9, a[1], b[0], pts3[(i + 3) % N][1] + 5.9, b[1]);
  }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wirePos, 3));
  const wires = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x222222 }));
  scene.add(wires);
  // Plätze an den Schleifen
  for (const [px, pz, r] of [[tram.plazaV[0], tram.plazaV[1], 50], [tram.plazaE[0], tram.plazaE[1], 46]]) {
    const y = terrainH(px, pz) + 0.07;
    cm.get('plaza', px, pz).disc(px, pz, y, r, 40, 3, null);
  }
  // Haltestellen: erhöhter Perron + Überdachung
  for (const pl of tram.platforms) {
    const rot = Math.atan2(pl.dx, pl.dz);
    const mb = cm.get('platform', pl.x, pl.z);
    const L = 24, W = 2.5, H = 0.32;
    mb.box(pl.x, pl.y + H / 2 - 0.05, pl.z, W, H + 0.1, L, rot, null, 2);
    const mk = cm.get('yellow', pl.x, pl.z);
    const ex = -pl.rx * (W / 2 - 0.25), ez = -pl.rz * (W / 2 - 0.25);
    mk.box(pl.x + ex, pl.y + H + 0.006, pl.z + ez, 0.25, 0.01, L, rot);
    // Dach
    const mt = cm.get('metal', pl.x, pl.z);
    const bx = pl.rx * 0.8, bz = pl.rz * 0.8;
    for (const s of [-5, 5]) mt.box(pl.x + bx + pl.dx * s, pl.y + H + 1.4, pl.z + bz + pl.dz * s, 0.12, 2.8, 0.12, rot);
    mt.box(pl.x, pl.y + H + 2.85, pl.z, 2.9, 0.12, 13, rot);
    cm.get('glass', pl.x, pl.z).box(pl.x + pl.rx * 1.15, pl.y + H + 1.35, pl.z + pl.rz * 1.15, 0.04, 2.3, 10, rot);
    mt.box(pl.x - pl.rx * 0.2, pl.y + H + 0.45, pl.z - pl.rz * 0.2, 0.45, 0.06, 2.6, rot);
    // Schild
    const st = makeCanvas(256, 64);
    const ctx = st.getContext('2d'); ctx.fillStyle = '#0d3b8c'; ctx.fillRect(0, 0, 256, 64); ctx.fillStyle = '#fff'; ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = 30; while (ctx.measureText(pl.name).width > 236 && fs > 12) { fs -= 2; ctx.font = `bold ${fs}px Arial`; }
    ctx.fillText(pl.name, 128, 34);
    const tex = canvasTex(st, { clamp: true });
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3, side: THREE.DoubleSide }));
    sm.position.set(pl.x + pl.dx * 6.3 + pl.rx * 0.6, pl.y + H + 2.4, pl.z + pl.dz * 6.3 + pl.rz * 0.6);
    sm.rotation.y = rot + Math.PI / 2;
    scene.add(sm); nearVis(sm, 300);
    // begehbar
    addDeck({ kind: 'platform', ox: pl.x - pl.dx * L / 2, oz: pl.z - pl.dz * L / 2, dx: pl.dx, dz: pl.dz, a0: 0, a1: L, hw: W / 2, h: () => pl.y + H, rails: null });
  }
  cm.finish(MATS, scene, { cast: { metal: true, platform: true } });
}
