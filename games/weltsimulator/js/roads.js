/* ================= STRASSEN =================
   Unregelmässiges Strassenraster mit Hauptstrassen, Quartierstrassen, Gassen, Kreiseln,
   Brücken über den Fluss, Seepromenade; danach Geometrie (Belag, Trottoir, Markierungen,
   Fussgängerstreifen, Bushaltebuchten, Brücken, Strassenlaternen). */

const ETYPE = {
  main:      { w: 16, lane: 4.0, sw: 4.5 },
  street:    { w: 10, lane: 2.6, sw: 3.5 },
  alley:     { w: 5.5, lane: 1.4, sw: 0.9 },
  boulevard: { w: 18, lane: 4.6, sw: 6.5 },
  tram:      { w: 24, lane: 8.0, sw: 4.5 }
};

const ROADS = {
  nodes: [], edges: [], pairs: new Map(), grid: new Map(), cells: new Map(),
  hash: null, decks: [], deckHash: null, parks: [], plazas: [], lamps: [], tramRoute: null
};

function rnode(x, z, extra) {
  const n = { id: ROADS.nodes.length, x, z, y: terrainH(x, z), adj: [], round: false, r: 0, dead: false };
  if (extra) Object.assign(n, extra);
  ROADS.nodes.push(n);
  return n;
}
function pairKey(a, b) { return a < b ? a + '_' + b : b + '_' + a; }
function setEdgeType(e, t) { const T = ETYPE[t]; e.type = t; e.w = T.w; e.lane = T.lane; e.sw = T.sw; }
function redge(a, b, type, name) {
  const e = { id: ROADS.edges.length, a: a.id, b: b.id, name, dead: false, bridge: false, stops: [] };
  setEdgeType(e, type);
  ROADS.edges.push(e);
  a.adj.push(e.id); b.adj.push(e.id);
  ROADS.pairs.set(pairKey(a.id, b.id), e);
  return e;
}
function killEdge(e) {
  e.dead = true;
  const A = ROADS.nodes[e.a], B = ROADS.nodes[e.b];
  A.adj = A.adj.filter(i => i !== e.id); B.adj = B.adj.filter(i => i !== e.id);
  ROADS.pairs.delete(pairKey(e.a, e.b));
}
function otherNode(e, nid) { return ROADS.nodes[e.a === nid ? e.b : e.a]; }
function edgeBetween(a, b) { return ROADS.pairs.get(pairKey(a.id, b.id)); }

function nodeOK(x, z) {
  if (Math.abs(x) > 1890 || Math.abs(z) > 1890) return false;
  if (coastX(z) - x < 300) return false;
  const V = WS.VENICE;
  if (x > V.x0 - 70 && z > V.z0 - 70 && z < V.z1 + 70) return false;
  if (Math.hypot(x - WS.TRAM_V.x, z - WS.TRAM_V.z) < 85) return false;
  const hr = Math.hypot(x - WS.HILL.x, z - WS.HILL.z);
  if (hr < 255) return false;
  if (waterDist(x, z) < 34) return false;
  if (terrainH(x, z) > WS.CITY_Y + 7 && hr > 560) return false;
  return true;
}

/* Prüft, ob eine Strasse zwischen a und b gebaut werden darf (inkl. Brückenerkennung). */
function edgeCheck(a, b, T, allowBridge) {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const H = WS.HILL;
  if (segDist(H.x, H.z, a.x, a.z, b.x, b.z) < 240) return null;
  if (Math.abs(b.y - a.y) / len > 0.17) return null;
  const V = WS.VENICE;
  const n = Math.ceil(len / 3);
  let inW = false, intervals = 0, d0 = -1, d1 = -1, minClear = 1e9;
  for (let k = 0; k <= n; k++) {
    const t = k / n, x = lerp(a.x, b.x, t), z = lerp(a.z, b.z, t);
    if (x > V.x0 - 30 && z > V.z0 - 30 && z < V.z1 + 30) return null;
    if (x > coastX(z) - 20) return null;
    const wd = waterDist(x, z);
    if (wd < 1.5) {
      if (!inW) { intervals++; inW = true; if (d0 < 0) d0 = t * len; }
      d1 = t * len;
    } else { inW = false; if (wd < minClear) minClear = wd; }
  }
  if (intervals === 0) {
    if (minClear < T.w / 2 + T.sw + 2) return null;
    return { bridge: false };
  }
  if (intervals > 1 || !allowBridge) return null;
  if (d1 - d0 > 110 || d0 < 22 || len - d1 < 22) return null;
  // nur annähernd rechtwinklig über den Fluss
  const mx = lerp(a.x, b.x, (d0 + d1) / 2 / len), mz = lerp(a.z, b.z, (d0 + d1) / 2 / len);
  let best = 1e9, sd = null;
  WATER.hash.query(mx - 1, mz - 1, mx + 1, mz + 1, (s) => { const d = segDist(mx, mz, s.ax, s.az, s.bx, s.bz); if (d < best) { best = d; sd = s; } });
  if (!sd || sd.kind !== 'river') return null;
  const wx = sd.bx - sd.ax, wz = sd.bz - sd.az, wl = Math.hypot(wx, wz);
  const dot = Math.abs(((b.x - a.x) * wx + (b.z - a.z) * wz) / (len * wl));
  if (dot > 0.6) return null;
  return { bridge: true, d0: d0 - 3, d1: d1 + 3 };
}

/* ---------- Netz erzeugen ---------- */
function genRoads(beforeAlleys) {
  ROADS.hash = new SHash(60);
  ROADS.deckHash = new SHash(40);
  const S = WS.GRID, N = 14;
  const grid = ROADS.grid;
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
    let x = i * S, z = j * S;
    const x2 = x + 30 * Math.sin(z / 610 + 0.7) + rr(-15, 15);
    const z2 = z + 27 * Math.sin(x / 700 + 1.3) + rr(-15, 15);
    if (!nodeOK(x2, z2)) continue;
    grid.set(i + ',' + j, rnode(x2, z2, { gi: i, gj: j }));
  }
  for (const n of grid.values()) {
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      const m = grid.get((n.gi + di) + ',' + (n.gj + dj));
      if (!m) continue;
      const main = di === 1 ? (n.gj % 4 === 0) : (n.gi % 4 === 0);
      const type = main ? 'main' : 'street';
      const name = di === 1 ? STREETS_H[(n.gj + N) % STREETS_H.length] : STREETS_V[(n.gi + N) % STREETS_V.length];
      if (!main && chance(0.06)) continue;
      const chk = edgeCheck(n, m, ETYPE[type], true);
      if (!chk) continue;
      if (chk.bridge && !main && !chance(0.45)) continue;
      const e = redge(n, m, type, name);
      if (chk.bridge) { e.bridge = true; e.wd0 = chk.d0; e.wd1 = chk.d1; }
    }
  }
  pruneGraph();
  planTramRoute();
  buildCells();
  choosePlazasAndParks();
  if (beforeAlleys) beforeAlleys();
  addAlleys();
  addRoundabouts();
  addBoulevard();
  pruneGraph();
  finalizeRoads();
}

function pruneGraph() {
  // grösste zusammenhängende Komponente behalten
  const alive = ROADS.nodes.filter(n => !n.dead && n.adj.length > 0);
  for (const n of ROADS.nodes) if (n.adj.length === 0) n.dead = true;
  const comp = new Map(); let bestC = -1, bestN = 0, cid = 0;
  for (const n of alive) {
    if (comp.has(n.id)) continue;
    const st = [n]; comp.set(n.id, cid); let cnt = 0;
    while (st.length) {
      const c = st.pop(); cnt++;
      for (const eid of c.adj) { const o = otherNode(ROADS.edges[eid], c.id); if (!comp.has(o.id)) { comp.set(o.id, cid); st.push(o); } }
    }
    if (cnt > bestN) { bestN = cnt; bestC = cid; }
    cid++;
  }
  for (const n of alive) if (comp.get(n.id) !== bestC) {
    for (const eid of n.adj.slice()) killEdge(ROADS.edges[eid]);
    n.dead = true;
  }
  for (const [k, n] of ROADS.grid) if (n.dead) ROADS.grid.delete(k);
}

function nearestNode(x, z, filter) {
  let best = null, bd = 1e18;
  for (const n of ROADS.nodes) {
    if (n.dead || n.adj.length === 0) continue;
    if (filter && !filter(n)) continue;
    const d = (n.x - x) ** 2 + (n.z - z) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}

/* Tramroute: Dijkstra über gerichtete Kanten, bevorzugt Hauptstrassen und wenige Abbiegungen. */
function planTramRoute() {
  const start = nearestNode(WS.TRAM_V.x - 120, WS.TRAM_V.z, n => n.x < WS.TRAM_V.x - 60);
  const H = WS.HILL;
  const goal = nearestNode(H.x + 275, H.z + 250);
  const E = ROADS.edges;
  const nState = E.length * 2;
  const dist = new Float64Array(nState).fill(Infinity), prev = new Int32Array(nState).fill(-1), done = new Uint8Array(nState);
  const sFrom = (s) => { const e = E[s >> 1]; return (s & 1) ? e.b : e.a; };
  const sTo = (s) => { const e = E[s >> 1]; return (s & 1) ? e.a : e.b; };
  const cost = (e) => {
    const A = ROADS.nodes[e.a], B = ROADS.nodes[e.b];
    const l = Math.hypot(A.x - B.x, A.z - B.z);
    return l * (e.type === 'main' ? 1 : 2.4) + (e.bridge ? 400 : 0);
  };
  const dirOf = (s) => { const A = ROADS.nodes[sFrom(s)], B = ROADS.nodes[sTo(s)]; const l = Math.hypot(B.x - A.x, B.z - A.z); return [(B.x - A.x) / l, (B.z - A.z) / l]; };
  const open = [];
  for (const eid of start.adj) { const e = E[eid]; const s = eid * 2 + (e.a === start.id ? 0 : 1); dist[s] = cost(e); open.push(s); }
  let found = -1;
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
    const s = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (done[s]) continue; done[s] = 1;
    const node = ROADS.nodes[sTo(s)];
    if (node.id === goal.id) { found = s; break; }
    const d1 = dirOf(s);
    for (const eid of node.adj) {
      const e = E[eid]; const t = eid * 2 + (e.a === node.id ? 0 : 1);
      if ((t >> 1) === (s >> 1) || done[t]) continue;
      const d2 = dirOf(t);
      const turn = (d1[0] * d2[0] + d1[1] * d2[1]) < 0.85 ? 260 : 0;
      const nd = dist[s] + cost(e) + turn;
      if (nd < dist[t]) { dist[t] = nd; prev[t] = s; open.push(t); }
    }
  }
  const route = [];
  if (found >= 0) {
    let s = found;
    while (s >= 0) { route.push(s); s = prev[s]; }
    route.reverse();
  }
  const nodes = [start];
  for (const s of route) { const e = E[s >> 1]; setEdgeType(e, 'tram'); e.tram = true; nodes.push(ROADS.nodes[sTo(s)]); }
  for (const n of nodes) n.tram = true;
  ROADS.tramRoute = nodes;
}

function buildCells() {
  for (const n of ROADS.grid.values()) {
    const i = n.gi, j = n.gj;
    const n10 = ROADS.grid.get((i + 1) + ',' + j), n01 = ROADS.grid.get(i + ',' + (j + 1)), n11 = ROADS.grid.get((i + 1) + ',' + (j + 1));
    if (!n10 || !n01 || !n11) continue;
    if (!edgeBetween(n, n10) || !edgeBetween(n01, n11) || !edgeBetween(n, n01) || !edgeBetween(n10, n11)) continue;
    const c = { i, j, c: [n, n10, n11, n01], cx: (n.x + n10.x + n11.x + n01.x) / 4, cz: (n.z + n10.z + n11.z + n01.z) / 4, use: null };
    ROADS.cells.set(i + ',' + j, c);
  }
}

function pointInQuad(px, pz, q) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const cr = (b[0] - a[0]) * (pz - a[1]) - (b[1] - a[1]) * (px - a[0]);
    if (cr !== 0) { const s = cr > 0 ? 1 : -1; if (sign === 0) sign = s; else if (s !== sign) return false; }
  }
  return true;
}
function cellPoly(cell, inset) {
  return cell.c.map(n => {
    const dx = cell.cx - n.x, dz = cell.cz - n.z, l = Math.hypot(dx, dz);
    return [n.x + dx / l * inset, n.z + dz / l * inset];
  });
}

function choosePlazasAndParks() {
  const cells = [...ROADS.cells.values()];
  shuffle(cells);
  const C = WS.CENTER;
  // Stadtpark im Zentrum (2x2 wenn möglich)
  const near = cells.filter(c => !c.use).sort((a, b) => Math.hypot(a.cx - C.x - 260, a.cz - C.z - 120) - Math.hypot(b.cx - C.x - 260, b.cz - C.z - 120));
  let parks = 0;
  const tryPark = (c, grow) => {
    if (c.use) return false;
    const group = [c];
    if (grow) for (const [di, dj] of [[1, 0], [0, 1], [1, 1]]) { const o = ROADS.cells.get((c.i + di) + ',' + (c.j + dj)); if (o && !o.use) group.push(o); }
    for (const g of group) { g.use = 'park'; ROADS.parks.push({ cell: g, poly: cellPoly(g, 0), big: group.length > 1 }); }
    parks++;
    return true;
  };
  if (near.length) tryPark(near[0], true);
  for (const c of cells) {
    if (parks >= 14) break;
    if (c.use) continue;
    const dC = Math.hypot(c.cx - C.x, c.cz - C.z);
    if (dC < 300) continue;
    // nicht zu nah an anderem Park
    if (ROADS.parks.some(p => Math.hypot(p.cell.cx - c.cx, p.cell.cz - c.cz) < 480)) continue;
    tryPark(c, chance(0.35));
  }
  // Stadtplatz im Zentrum
  const cz = cells.filter(c => !c.use).sort((a, b) => Math.hypot(a.cx - C.x, a.cz - C.z) - Math.hypot(b.cx - C.x, b.cz - C.z))[0];
  if (cz) { cz.use = 'plaza'; ROADS.plazas.push({ cell: cz, poly: cellPoly(cz, 0), kind: 'center' }); }
}

function splitEdge(e) {
  const A = ROADS.nodes[e.a], B = ROADS.nodes[e.b];
  const m = rnode((A.x + B.x) / 2, (A.z + B.z) / 2);
  const type = e.type, name = e.name;
  killEdge(e);
  const e1 = redge(A, m, type, name), e2 = redge(m, B, type, name);
  e1.split = e2.split = true;
  return m;
}

function addAlleys() {
  let ai = 0;
  for (const cell of ROADS.cells.values()) {
    if (cell.use || !chance(0.24)) continue;
    const [n00, n10, n11, n01] = cell.c;
    const vertical = chance(0.5);
    const e1 = vertical ? edgeBetween(n00, n10) : edgeBetween(n00, n01);
    const e2 = vertical ? edgeBetween(n01, n11) : edgeBetween(n10, n11);
    if (!e1 || !e2 || e1.split || e2.split || e1.bridge || e2.bridge || e1.tram || e2.tram) continue;
    const m1 = splitEdge(e1), m2 = splitEdge(e2);
    const chk = edgeCheck(m1, m2, ETYPE.alley, false);
    if (!chk) continue;
    redge(m1, m2, 'alley', ALLEYS[ai++ % ALLEYS.length]);
    cell.alley = true;
  }
}

function addRoundabouts() {
  const list = [];
  for (const n of ROADS.nodes) {
    if (n.dead || n.adj.length !== 4 || n.tram) continue;
    const mains = n.adj.filter(id => ROADS.edges[id].type === 'main').length;
    if (mains < 2) continue;
    if (n.adj.some(id => ROADS.edges[id].bridge)) continue;
    if (list.some(o => Math.hypot(o.x - n.x, o.z - n.z) < 420)) continue;
    if (!chance(0.45)) continue;
    n.round = true; n.ringR = 24;
    list.push(n);
  }
}

function addBoulevard() {
  const chains = [];
  let chain = [];
  for (let z = -1880; z <= 1880; z += 125) {
    const x = coastX(z) - 205;
    const inV = z > WS.VENICE.z0 - 50 && z < WS.VENICE.z1 + 50;
    if (inV || waterDist(x, z) < 28) { if (chain.length) chains.push(chain); chain = []; if (inV) continue; else continue; }
    chain.push(rnode(x, z, { blvd: true }));
  }
  if (chain.length) chains.push(chain);
  // Ketten verbinden (auch über die Flussmündung)
  const allB = [];
  for (const ch of chains) for (const n of ch) allB.push(n);
  allB.sort((a, b) => a.z - b.z);
  for (let i = 0; i < allB.length - 1; i++) {
    const a = allB[i], b = allB[i + 1];
    if (b.z - a.z > 300) continue;
    if (a.z < WS.VENICE.z1 + 50 && b.z > WS.VENICE.z0 - 50 && (a.z < WS.VENICE.z0 || b.z > WS.VENICE.z1) && b.z - a.z > 200) continue;
    const chk = edgeCheck(a, b, ETYPE.boulevard, true);
    if (!chk) continue;
    const e = redge(a, b, 'boulevard', 'Seepromenade');
    if (chk.bridge) { e.bridge = true; e.wd0 = chk.d0; e.wd1 = chk.d1; }
  }
  // Querverbindungen ins Raster
  for (const b of allB) {
    let best = null, bd = 1e9;
    for (const n of ROADS.grid.values()) {
      if (n.dead) continue;
      const d = Math.hypot(n.x - b.x, n.z - b.z);
      if (d < bd && n.x < b.x - 40 && Math.abs(n.z - b.z) < 110) { bd = d; best = n; }
    }
    if (!best || bd > 280) continue;
    const chk = edgeCheck(best, b, ETYPE.street, false);
    if (!chk) continue;
    redge(best, b, 'street', 'Strandweg');
  }
}

function finalizeRoads() {
  for (const e of ROADS.edges) {
    if (e.dead) continue;
    const A = ROADS.nodes[e.a], B = ROADS.nodes[e.b];
    e.len = Math.hypot(B.x - A.x, B.z - A.z);
    e.dx = (B.x - A.x) / e.len; e.dz = (B.z - A.z) / e.len;
    e.nx = e.dz; e.nz = -e.dx;            // links der Richtung a->b
    if (e.bridge) e.ramp = clamp(Math.min(38, e.wd0 - 6, e.len - e.wd1 - 6), 8, 38);
    const m = e.w / 2 + e.sw + 3;
    ROADS.hash.insert(e, Math.min(A.x, B.x) - m, Math.min(A.z, B.z) - m, Math.max(A.x, B.x) + m, Math.max(A.z, B.z) + m);
  }
  for (const n of ROADS.nodes) {
    if (n.dead) continue;
    let r = 0, sw = 0;
    for (const id of n.adj) { const e = ROADS.edges[id]; r = Math.max(r, e.w / 2); sw = Math.max(sw, e.sw); }
    n.r = r + 0.5; n.sw = sw;
    if (n.round) n.r = n.ringR;
  }
}

function edgeY(e, d) {
  const A = ROADS.nodes[e.a];
  const x = A.x + e.dx * d, z = A.z + e.dz * d;
  if (!e.bridge) {
    // Kreuzungen flach auf Knotenhöhe halten
    const B = ROADS.nodes[e.b];
    const ta = 1 - smooth(0, 14, d), tb = 1 - smooth(0, 14, e.len - d);
    let y = terrainH(x, z);
    y = lerp(y, A.y, ta); y = lerp(y, B.y, tb);
    return y;
  }
  const dist = d < e.wd0 ? e.wd0 - d : d > e.wd1 ? d - e.wd1 : 0;
  const f = 1 - smooth(0, e.ramp, dist);
  const B = ROADS.nodes[e.b];
  const deck = Math.max(A.y, B.y) + 1.9;
  const base = lerp(A.y, B.y, d / e.len);
  return lerp(base, deck, f);
}

/* Abstand eines Punktes zum nächsten Strassenrand inkl. Trottoir (negativ = auf der Strasse). */
let RC_EDGE = null;
function roadClear(x, z, extra) {
  let best = 1e9; RC_EDGE = null;
  const m = extra || 0;
  ROADS.hash.query(x - m - 1, z - m - 1, x + m + 1, z + m + 1, (e) => {
    const A = ROADS.nodes[e.a], B = ROADS.nodes[e.b];
    const d = segDist(x, z, A.x, A.z, B.x, B.z) - (e.w / 2 + e.sw);
    if (d < best) { best = d; RC_EDGE = e; }
  });
  return best;
}
function nearestRoundabout(x, z, r) {
  for (const n of ROADS.nodes) if (n.round && Math.hypot(n.x - x, n.z - z) < r) return n;
  return null;
}

/* ---------- Decks (begehbare Flächen über dem Gelände: Brücken, Perrons, Rampen) ---------- */
function addDeck(d) {
  // d: {ox,oz,dx,dz,a0,a1,hw,h(a),rails:[a0,a1]|null}
  ROADS.decks.push(d);
  const pts = [[d.ox + d.dx * d.a0, d.oz + d.dz * d.a0], [d.ox + d.dx * d.a1, d.oz + d.dz * d.a1]];
  const m = d.hw + 1;
  ROADS.deckHash.insert(d, Math.min(pts[0][0], pts[1][0]) - m, Math.min(pts[0][1], pts[1][1]) - m, Math.max(pts[0][0], pts[1][0]) + m, Math.max(pts[0][1], pts[1][1]) + m);
  return d;
}
function deckLocal(d, x, z) {
  const rx = x - d.ox, rz = z - d.oz;
  return [rx * d.dx + rz * d.dz, rx * d.dz - rz * d.dx]; // entlang, quer (links positiv)
}

/* ---------- Geometrie ---------- */
function roadTextures() {
  const asph = noiseCanvas(256, 256, 0.32, 0.22, 6.0, 3);
  { const ctx = asph.getContext('2d');
    for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(${200 + rnd() * 55 | 0},${200 + rnd() * 55 | 0},${200 + rnd() * 55 | 0},${rnd() * 0.25})`; ctx.fillRect(rnd() * 256, rnd() * 256, 1, 1); }
    ctx.strokeStyle = 'rgba(20,20,20,0.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); let x = rnd() * 256, y = rnd() * 256; ctx.moveTo(x, y); for (let k = 0; k < 8; k++) { x += rr(-14, 14); y += rr(-14, 14); ctx.lineTo(x, y); } ctx.stroke(); }
  }
  const pave = makeCanvas(256, 256);
  { const ctx = pave.getContext('2d');
    ctx.fillStyle = '#8f8a82'; ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
      const v = 150 + rnd() * 40 | 0;
      ctx.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
      ctx.fillRect(x * 64 + (y % 2) * 32 + 2, y * 32 + 2, 60, 28);
    }
    ctx.drawImage(noiseCanvas(256, 256, 0.5, 0.3, 8, 9), 0, 0, 256, 256);
    ctx.globalCompositeOperation = 'multiply';
  }
  // Pflaster neu zeichnen (das Rauschen oben überdeckt sonst die Platten)
  { const ctx = pave.getContext('2d'); ctx.globalCompositeOperation = 'source-over';
    const nz = noiseCanvas(256, 256, 0.85, 0.25, 8, 9);
    ctx.fillStyle = '#7d786f'; ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 5; x++) {
      const v = 160 + rnd() * 35 | 0;
      ctx.fillStyle = `rgb(${v},${v - 3},${v - 9})`;
      ctx.fillRect(x * 64 + (y % 2) * 32 - 32 + 2, y * 32 + 2, 60, 28);
    }
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(nz, 0, 0); ctx.globalCompositeOperation = 'source-over';
  }
  const at = canvasTex(asph); const an = canvasTex(normalFromHeight(asph, 1.5), { linear: true });
  const pt = canvasTex(pave); const pn = canvasTex(normalFromHeight(pave, 2.0), { linear: true });
  return { at, an, pt, pn };
}

function buildRoadMeshes(scene, mats) {
  const cm = new ChunkedMB(WS.CHUNK);
  const lampMB = new ChunkedMB(WS.CHUNK);
  const N = ROADS.nodes;
  const white = null;
  const lampSpacing = 34;
  for (const e of ROADS.edges) {
    if (e.dead) continue;
    const A = N[e.a], B = N[e.b];
    const tA = A.round ? A.ringR - 1 : 0, tB = B.round ? B.ringR - 1 : 0;
    const d0 = tA, d1 = e.len - tB;
    const step = e.bridge ? 3 : 6;
    const n = Math.max(1, Math.ceil((d1 - d0) / step));
    const pts = [], ys = [], nrm = [];
    for (let k = 0; k <= n; k++) {
      const d = lerp(d0, d1, k / n);
      pts.push([A.x + e.dx * d, A.z + e.dz * d]); ys.push(edgeY(e, d)); nrm.push([e.nx, e.nz]);
    }
    const mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2;
    const mbA = cm.get('asphalt', mx, mz), mbS = cm.get('sidewalk', mx, mz), mbM = cm.get('marking', mx, mz);
    mbA.ribbon(pts, nrm, ys, -e.w / 2, e.w / 2, 7, null, 0.09);
    mbS.ribbon(pts, nrm, ys, e.w / 2 - 0.2, e.w / 2 + e.sw, 2.5, null, 0.06);
    mbS.ribbon(pts, nrm, ys, -e.w / 2 - e.sw, -e.w / 2 + 0.2, 2.5, null, 0.06);
    // Bordstein (feiner heller Streifen)
    mbM.ribbon(pts, nrm, ys, e.w / 2, e.w / 2 + 0.22, 1, lin(0xb9b6ae), 0.075);
    mbM.ribbon(pts, nrm, ys, -e.w / 2 - 0.22, -e.w / 2, 1, lin(0xb9b6ae), 0.075);

    // Markierungen
    const ra = A.round ? A.ringR + 2 : A.r + 2, rb = B.round ? B.ringR + 2 : B.r + 2;
    const P = (d, l, yo) => [A.x + e.dx * d + e.nx * l, edgeY(e, d) + yo, A.z + e.dz * d + e.nz * l];
    const markLine = (l, w, dash, gap, col) => {
      let d = ra;
      while (d < e.len - rb) {
        const dEnd = Math.min(d + dash, e.len - rb);
        if (!inBay(e, d, dEnd, l)) {
          mbM.quad(P(d, l - w / 2, 0.11), P(dEnd, l - w / 2, 0.11), P(dEnd, l + w / 2, 0.11), P(d, l + w / 2, 0.11), null, col, [0, 1, 0]);
        }
        d = dEnd + gap;
      }
    };
    if (e.type === 'street') markLine(0, 0.14, 3, 6, white);
    if (e.type === 'main' || e.type === 'boulevard') {
      markLine(0, 0.15, 4, 5, white);
      markLine(e.w / 2 - 0.45, 0.15, 999, 0, white); markLine(-e.w / 2 + 0.45, 0.15, 999, 0, white);
    }
    if (e.type === 'tram') { markLine(e.w / 2 - 0.45, 0.15, 999, 0, white); markLine(-e.w / 2 + 0.45, 0.15, 999, 0, white); markLine(4.2, 0.15, 3, 3, white); markLine(-4.2, 0.15, 3, 3, white); }
    // Fussgängerstreifen
    if (e.type !== 'alley' && e.type !== 'street' && !e.bridge) {
      for (const [dd, node] of [[A.round ? A.ringR + 3 : A.r + 1.5, A], [e.len - (B.round ? B.ringR + 7 : B.r + 5.5), B]]) {
        if (dd < 0 || dd + 4 > e.len) continue;
        for (let l = -e.w / 2 + 0.8; l < e.w / 2 - 0.8; l += 1.1) mbM.quad(P(dd, l, 0.11), P(dd + 4, l, 0.11), P(dd + 4, l + 0.55, 0.11), P(dd, l + 0.55, 0.11), null, white, [0, 1, 0]);
      }
    }
    // Bushaltebuchten
    for (const st of e.stops) buildBay(e, st, cm);
    // Brücke
    if (e.bridge) buildBridge(e, cm, pts, ys);
    // Strassenlaternen
    if (e.type !== 'alley') {
      let side = 1;
      for (let d = ra + 6; d < e.len - rb - 4; d += lampSpacing) {
        const l = side * (e.w / 2 + Math.min(e.sw - 0.5, 1.0));
        if (inBay(e, d - 4, d + 4, l)) { side = -side; continue; }
        const x = A.x + e.dx * d + e.nx * l, z = A.z + e.dz * d + e.nz * l, y = edgeY(e, d);
        addLamp(lampMB, x, y, z, Math.atan2(-e.nx * side, -e.nz * side), e.bridge && d > e.wd0 && d < e.wd1);
        side = -side;
      }
    }
  }
  // Knoten
  for (const n of N) {
    if (n.dead || n.adj.length === 0) continue;
    const mbA = cm.get('asphalt', n.x, n.z), mbS = cm.get('sidewalk', n.x, n.z);
    if (n.round) {
      mbA.ring(n.x, n.z, n.y + 0.09, 11.5, n.ringR, 40, 7, null);
      mbS.ring(n.x, n.z, n.y + 0.06, n.ringR - 0.5, n.ringR + n.sw, 40, 2.5, null);
      const isl = cm.get('grass', n.x, n.z);
      isl.cyl(n.x, n.y, n.z, 11.5, 11.5, 0.35, 32, lin(0x5b8a3a), true);
      cm.get('marking', n.x, n.z).cyl(n.x, n.y + 0.05, n.z, 11.8, 11.8, 0.32, 32, lin(0xc8c4bb), false);
      ROADS.plazas.push({ round: n, x: n.x, z: n.z, r: 12 });
    } else {
      let maxW = 0; for (const id of n.adj) maxW = Math.max(maxW, ROADS.edges[id].w);
      mbA.disc(n.x, n.z, n.y + 0.09, maxW / 2, 20, 7, null);
      mbS.disc(n.x, n.z, n.y + 0.06, maxW / 2 + n.sw, 20, 2.5, null);
    }
  }
  const meshes = cm.finish(mats, scene, {});
  lampMB.finish(mats, scene, {});
  return meshes;
}

function inBay(e, da, db, l) {
  for (const st of e.stops) {
    if (Math.sign(l) !== st.side || Math.abs(l) < e.w / 2 - 1.5) continue;
    if (db > st.d - 23 && da < st.d + 23) return true;
  }
  return false;
}

/* Bushaltebucht: Aussparung im Trottoir mit gelbem Zickzack */
function buildBay(e, st, cm) {
  const A = ROADS.nodes[e.a];
  const s = st.side, w = e.w / 2;
  const P = (d, l, yo) => [A.x + e.dx * d + e.nx * l * s, edgeY(e, d) + yo, A.z + e.dz * d + e.nz * l * s];
  const mbA = cm.get('asphalt', st.x, st.z), mbY = cm.get('yellow', st.x, st.z);
  const depth = 3.0, half = 14, taper = 8;
  const segs = [[st.d - half - taper, 0], [st.d - half, depth], [st.d + half, depth], [st.d + half + taper, 0]];
  for (let i = 0; i < segs.length - 1; i++) {
    const [da, la] = segs[i], [db, lb] = segs[i + 1];
    const q = [P(da, w - 0.3, 0.095), P(db, w - 0.3, 0.095), P(db, w + lb, 0.095), P(da, w + la, 0.095)];
    const sc = 1 / 7;
    const uv = q.map(p => [p[0] * sc, -p[2] * sc]);
    if (s > 0) mbA.quadUV(q[0], q[1], q[2], q[3], uv[0], uv[1], uv[2], uv[3], null, [0, 1, 0]);
    else mbA.quadUV(q[3], q[2], q[1], q[0], uv[3], uv[2], uv[1], uv[0], null, [0, 1, 0]);
  }
  // Bordstein der Bucht
  const curb = cm.get('marking', st.x, st.z);
  for (let i = 0; i < segs.length - 1; i++) {
    const [da, la] = segs[i], [db, lb] = segs[i + 1];
    const q = [P(da, w + la, 0.1), P(db, w + lb, 0.1), P(db, w + lb + 0.22, 0.1), P(da, w + la + 0.22, 0.1)];
    if (s > 0) curb.quad(q[0], q[1], q[2], q[3], null, lin(0xb9b6ae), [0, 1, 0]);
    else curb.quad(q[3], q[2], q[1], q[0], null, lin(0xb9b6ae), [0, 1, 0]);
  }
  // Zickzack
  const zz = [];
  for (let d = st.d - half - 4, k = 0; d <= st.d + half + 4; d += 2, k++) {
    const inner = Math.abs(d - st.d) <= half ? depth - 0.35 : depth * (1 - (Math.abs(d - st.d) - half) / taper) - 0.35;
    zz.push([d, k % 2 ? w + 0.25 : w + Math.max(0.3, inner)]);
  }
  const lw = 0.16;
  const thick = (p0, p1) => {
    const a = P(p0[0], p0[1], 0.115), b = P(p1[0], p1[1], 0.115);
    let dx = b[0] - a[0], dz = b[2] - a[2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const ox = -dz * lw / 2, oz = dx * lw / 2;
    mbY.quad([a[0] + ox, a[1], a[2] + oz], [b[0] + ox, b[1], b[2] + oz], [b[0] - ox, b[1], b[2] - oz], [a[0] - ox, a[1], a[2] - oz], null, null, [0, 1, 0]);
  };
  for (let i = 0; i < zz.length - 1; i++) thick(zz[i], zz[i + 1]);
  thick([st.d - half - 4, w + 0.12], [st.d + half + 4, w + 0.12]);
}

function buildBridge(e, cm, pts, ys) {
  const A = ROADS.nodes[e.a];
  const hw = e.w / 2 + e.sw + 0.35;
  const stone = lin(0xa89f8f), rail = lin(0xd6d0c4);
  const a0 = e.wd0 - e.ramp, a1 = e.wd1 + e.ramp;
  const mbB = cm.get('bridge', A.x + e.dx * (a0 + a1) / 2, A.z + e.dz * (a0 + a1) / 2);
  const span = e.wd1 - e.wd0;
  const P = (d, l, y) => [A.x + e.dx * d + e.nx * l, y, A.z + e.dz * d + e.nz * l];
  const n = Math.ceil((a1 - a0) / 2);
  let prev = null;
  for (let k = 0; k <= n; k++) {
    const d = lerp(a0, a1, k / n);
    const yTop = edgeY(e, d) + 0.09;
    let under;
    if (d < e.wd0 || d > e.wd1) under = Math.max(yTop - 1.0, terrainH(A.x + e.dx * d, A.z + e.dz * d) - 0.5);
    else { const u = (d - e.wd0) / span; under = lerp(WS.WATER_Y - 1.0, yTop - 0.9, Math.pow(Math.sin(Math.PI * u), 0.45)); }
    const cur = { d, yTop, under };
    if (prev) {
      for (const s of [1, -1]) {
        const l = s * hw;
        // Seitenwand
        const q = [P(prev.d, l, prev.under), P(cur.d, l, cur.under), P(cur.d, l, cur.yTop + 0.02), P(prev.d, l, prev.yTop + 0.02)];
        if (s > 0) mbB.quad(q[1], q[0], q[3], q[2], [0, 0, 1, 1], stone); else mbB.quad(q[0], q[1], q[2], q[3], [0, 0, 1, 1], stone);
        // Brüstung
        const r0 = P(prev.d, l, prev.yTop), r1 = P(cur.d, l, cur.yTop);
        const ox = e.nx * s * 0.25, oz = e.nz * s * 0.25;
        mbB.quad([r0[0] - ox, r0[1] + 1.05, r0[2] - oz], [r1[0] - ox, r1[1] + 1.05, r1[2] - oz], [r1[0] + ox * 0.2, r1[1] + 1.05, r1[2] + oz * 0.2], [r0[0] + ox * 0.2, r0[1] + 1.05, r0[2] + oz * 0.2], null, rail, [0, 1, 0]);
        const wq = [[r0[0] - ox, r0[1], r0[2] - oz], [r1[0] - ox, r1[1], r1[2] - oz], [r1[0] - ox, r1[1] + 1.05, r1[2] - oz], [r0[0] - ox, r0[1] + 1.05, r0[2] - oz]];
        if (s > 0) mbB.quad(wq[0], wq[1], wq[2], wq[3], null, rail); else mbB.quad(wq[1], wq[0], wq[3], wq[2], null, rail);
        const wq2 = [[r0[0] + ox * 0.2, r0[1] - 0.1, r0[2] + oz * 0.2], [r1[0] + ox * 0.2, r1[1] - 0.1, r1[2] + oz * 0.2], [r1[0] + ox * 0.2, r1[1] + 1.05, r1[2] + oz * 0.2], [r0[0] + ox * 0.2, r0[1] + 1.05, r0[2] + oz * 0.2]];
        if (s > 0) mbB.quad(wq2[1], wq2[0], wq2[3], wq2[2], null, rail); else mbB.quad(wq2[0], wq2[1], wq2[2], wq2[3], null, rail);
      }
      // Unterseite (Bogen)
      const u = [P(prev.d, -hw, prev.under), P(prev.d, hw, prev.under), P(cur.d, hw, cur.under), P(cur.d, -hw, cur.under)];
      mbB.quad(u[1], u[0], u[3], u[2], [0, 0, 1, 1], stone);
    }
    prev = cur;
  }
  addDeck({ kind: 'bridge', edge: e, ox: A.x, oz: A.z, dx: e.dx, dz: e.dz, a0, a1, hw: hw - 0.35, h: (a) => edgeY(e, a) + 0.09, rails: [e.wd0 - 4, e.wd1 + 4] });
}

const LAMP_GEO = {};
function addLamp(cm, x, y, z, rot, onBridge) {
  const mb = cm.get('metal', x, z), hb = cm.get('lamphead', x, z);
  const H = onBridge ? 4.5 : 7.5;
  mb.cyl(x, y, z, 0.13, 0.08, H, 6, null, false);
  const s = Math.sin(rot), c = Math.cos(rot);
  const ax = x + s * 1.4, az = z + c * 1.4;
  mb.box((x + ax) / 2, y + H - 0.05, (z + az) / 2, 0.1, 0.1, 1.5, rot, null);
  mb.box(ax, y + H - 0.1, az, 0.45, 0.18, 0.9, rot, null);
  hb.box(ax, y + H - 0.22, az, 0.36, 0.05, 0.75, rot, null);
  ROADS.lamps.push({ x: ax, y: y + H - 0.25, z: az, gx: ax, gz: az, gy: y });
}

/* Lichtkegel der Laternen auf dem Boden (nur nachts sichtbar). */
function buildLightPools(scene) {
  const cv = makeCanvas(128, 128), ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,200,130,0.95)'); g.addColorStop(0.4, 'rgba(255,175,95,0.45)'); g.addColorStop(1, 'rgba(255,160,80,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const tex = canvasTex(cv, { clamp: true });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: true });
  const cm = new ChunkedMB(WS.CHUNK);
  for (const L of ROADS.lamps) {
    const mb = cm.get('pool', L.gx, L.gz);
    const r = 10, y = L.gy + 0.13;
    mb.quadUV([L.gx - r, y, L.gz + r], [L.gx + r, y, L.gz + r], [L.gx + r, y, L.gz - r], [L.gx - r, y, L.gz - r], [0, 0], [1, 0], [1, 1], [0, 1], null, [0, 1, 0]);
  }
  const meshes = cm.finish({ pool: mat }, scene, { noReceive: true });
  meshes.forEach(m => { m.renderOrder = 2; });
  return mat;
}

/* Strassenname am Punkt (für die Anzeige) */
function streetNameAt(x, z) {
  const d = roadClear(x, z, 25);
  if (RC_EDGE && d < 15) return RC_EDGE.name;
  return '';
}
