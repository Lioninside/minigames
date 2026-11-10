/* ================= UTIL =================
   Zufall (reproduzierbar), Rauschen, Geometrie-Helfer, räumlicher Hash, Mesh-Baukasten
   und Canvas-Texturen. Definiert nur Funktionen und Klassen. */

/* ---------- Reproduzierbarer Zufall ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let _rng = mulberry32(1);
function seedRng(s) { _rng = mulberry32(s); }
function rnd() { return _rng(); }
function rr(a, b) { return a + (b - a) * _rng(); }
function ri(a, b) { return a + Math.floor((b - a + 1) * _rng()); }
function pick(a) { return a[Math.floor(_rng() * a.length)]; }
function chance(p) { return _rng() < p; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(_rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

/* ---------- Mathe ---------- */
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smooth(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

function hash2i(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2i(xi, yi), b = hash2i(xi + 1, yi), c = hash2i(xi, yi + 1), d = hash2i(xi + 1, yi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x, y, oct) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f + i * 17.3, y * f - i * 9.1); f *= 2.03; a *= 0.5; }
  return s;
}
function ridged(x, y, oct) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(vnoise(x * f + i * 7.7, y * f + i * 3.1))); f *= 2.0; a *= 0.5; }
  return s;
}

/* Abstand Punkt-Strecke; der Parameter t landet in SEG_T. */
let SEG_T = 0;
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  SEG_T = t;
  const qx = ax + dx * t - px, qz = az + dz * t - pz;
  return Math.sqrt(qx * qx + qz * qz);
}

/* Catmull-Rom durch Punkte [[x,z],...], liefert dichte Punktliste mit Abstand ~step. */
function catmullSample(pts, step) {
  const out = [];
  const P = (i) => pts[clamp(i, 0, pts.length - 1)];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(2, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

/* Hermite-Kurve zwischen p1 (Richtung d1) und p2 (Richtung d2). */
function hermite(p1, d1, p2, d2, k, n) {
  const out = [];
  for (let i = 1; i < n; i++) {
    const t = i / n, t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    out.push([
      h00 * p1[0] + h10 * d1[0] * k + h01 * p2[0] + h11 * d2[0] * k,
      h00 * p1[1] + h10 * d1[1] * k + h01 * p2[1] + h11 * d2[1] * k
    ]);
  }
  return out;
}

/* Polylinie mit runden Ecken (Radius r) – für Tramgleise. */
function filletPolyline(pts, r, step) {
  if (pts.length < 3) return densify(pts, step);
  const out = [pts[0].slice()];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    let d1x = b[0] - a[0], d1z = b[1] - a[1]; const l1 = Math.hypot(d1x, d1z); d1x /= l1; d1z /= l1;
    let d2x = c[0] - b[0], d2z = c[1] - b[1]; const l2 = Math.hypot(d2x, d2z); d2x /= l2; d2z /= l2;
    const cosT = clamp(d1x * d2x + d1z * d2z, -1, 1);
    const theta = Math.acos(cosT);
    if (theta < 0.02) { out.push(b.slice()); continue; }
    let rr0 = r;
    let tl = rr0 * Math.tan(theta / 2);
    const maxT = Math.min(l1, l2) * 0.48;
    if (tl > maxT) { tl = maxT; rr0 = tl / Math.tan(theta / 2); }
    const s = [b[0] - d1x * tl, b[1] - d1z * tl];
    const e = [b[0] + d2x * tl, b[1] + d2z * tl];
    out.push(s);
    const n = Math.max(3, Math.ceil(rr0 * theta / Math.max(1, step * 0.5)));
    const arc = hermite(s, [d1x, d1z], e, [d2x, d2z], tl * 1.1, n);
    for (const p of arc) out.push(p);
    out.push(e);
  }
  out.push(pts[pts.length - 1].slice());
  return densify(out, step);
}

function densify(pts, step) {
  const out = [pts[0].slice()];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(l / step));
    for (let k = 1; k <= n; k++) out.push([lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)]);
  }
  return out;
}

function polyLength(pts) { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; }

/* Senkrechte (links) je Punkt einer Polylinie. */
function polyNormals(pts) {
  const n = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    n.push([dz, -dx]); // links von der Fahrtrichtung
  }
  return n;
}

/* ---------- Räumlicher Hash ---------- */
let _shashN = 0;
class SHash {
  constructor(cell) { this.c = cell; this.m = new Map(); this.q = 0; this.tag = '_h' + (_shashN++); }
  key(ix, iz) { return (ix + 4000) * 8000 + (iz + 4000); }
  insert(o, x0, z0, x1, z1) {
    const c = this.c;
    const ax = Math.floor(x0 / c), bx = Math.floor(x1 / c), az = Math.floor(z0 / c), bz = Math.floor(z1 / c);
    for (let ix = ax; ix <= bx; ix++) for (let iz = az; iz <= bz; iz++) {
      const k = this.key(ix, iz); let a = this.m.get(k);
      if (!a) { a = []; this.m.set(k, a); }
      a.push(o);
    }
  }
  query(x0, z0, x1, z1, fn) {
    const c = this.c, q = ++this.q, tag = this.tag;
    const ax = Math.floor(x0 / c), bx = Math.floor(x1 / c), az = Math.floor(z0 / c), bz = Math.floor(z1 / c);
    for (let ix = ax; ix <= bx; ix++) for (let iz = az; iz <= bz; iz++) {
      const a = this.m.get(this.key(ix, iz));
      if (!a) continue;
      for (let i = 0; i < a.length; i++) {
        const o = a[i];
        if (o[tag] === q) continue;
        o[tag] = q;
        if (fn(o) === true) return true;
      }
    }
    return false;
  }
}

/* ---------- Orientierte Rechtecke (Grundrisse) ----------
   rot = Drehung um Y (three.js-Konvention): lokale +z-Achse zeigt nach (sin rot, cos rot). */
function makeOBB(cx, cz, rot, hw, hd) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return { cx, cz, rot, hw, hd, ax: c, az: -s, bx: s, bz: c };
}
function obbLocal(o, px, pz) {
  const dx = px - o.cx, dz = pz - o.cz;
  return [dx * o.ax + dz * o.az, dx * o.bx + dz * o.bz];
}
function obbContains(o, px, pz, m) {
  const dx = px - o.cx, dz = pz - o.cz;
  const lx = dx * o.ax + dz * o.az, lz = dx * o.bx + dz * o.bz;
  return Math.abs(lx) <= o.hw + (m || 0) && Math.abs(lz) <= o.hd + (m || 0);
}
function obbCorners(o, m) {
  const hw = o.hw + (m || 0), hd = o.hd + (m || 0), r = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    r.push([o.cx + o.ax * hw * sx + o.bx * hd * sz, o.cz + o.az * hw * sx + o.bz * hd * sz]);
  }
  return r;
}
function obbBounds(o, m) {
  const r = Math.abs(o.ax) * o.hw + Math.abs(o.bx) * o.hd + (m || 0);
  const r2 = Math.abs(o.az) * o.hw + Math.abs(o.bz) * o.hd + (m || 0);
  return [o.cx - r, o.cz - r2, o.cx + r, o.cz + r2];
}
function obbOverlap(a, b, m) {
  const axes = [[a.ax, a.az], [a.bx, a.bz], [b.ax, b.az], [b.bx, b.bz]];
  const dx = b.cx - a.cx, dz = b.cz - a.cz;
  for (const [x, z] of axes) {
    const ra = a.hw * Math.abs(a.ax * x + a.az * z) + a.hd * Math.abs(a.bx * x + a.bz * z);
    const rb = b.hw * Math.abs(b.ax * x + b.az * z) + b.hd * Math.abs(b.bx * x + b.bz * z);
    if (Math.abs(dx * x + dz * z) > ra + rb + m) return false;
  }
  return true;
}
/* Kreis (Spieler) aus Rechteck schieben. Gibt [nx,nz] oder null zurück. */
function obbPushCircle(o, px, pz, r) {
  const dx = px - o.cx, dz = pz - o.cz;
  const lx = dx * o.ax + dz * o.az, lz = dx * o.bx + dz * o.bz;
  if (Math.abs(lx) > o.hw + r || Math.abs(lz) > o.hd + r) return null;
  const qx = clamp(lx, -o.hw, o.hw), qz = clamp(lz, -o.hd, o.hd);
  let ox = lx - qx, oz = lz - qz;
  const d = Math.hypot(ox, oz);
  let nlx, nlz;
  if (d > 1e-6) {
    if (d >= r) return null;
    nlx = qx + ox / d * r; nlz = qz + oz / d * r;
  } else {
    const px1 = o.hw - Math.abs(lx), pz1 = o.hd - Math.abs(lz);
    if (px1 < pz1) { nlx = Math.sign(lx || 1) * (o.hw + r); nlz = lz; }
    else { nlz = Math.sign(lz || 1) * (o.hd + r); nlx = lx; }
  }
  return [o.cx + o.ax * nlx + o.bx * nlz, o.cz + o.az * nlx + o.bz * nlz];
}

/* ---------- Farben ---------- */
const _tmpCol = new THREE.Color();
function lin(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
function linMix(h1, h2, t) { return lin(h1).lerp(lin(h2), t); }
function varyCol(c, amt) {
  const k = 1 + (rnd() - 0.5) * amt;
  return new THREE.Color(c.r * k, c.g * k, c.b * k);
}

/* ---------- Mesh-Baukasten ----------
   Sammelt Dreiecke mit Normale, UV und Vertexfarbe; am Ende eine BufferGeometry. */
const _WHITE = new THREE.Color(1, 1, 1);
class MB {
  /* Feste Zahlen-Arrays, die bei Bedarf verdoppelt werden (statt wachsender JS-Listen):
     schneller und ohne viel Müll für die Speicherbereinigung. */
  constructor(cap) {
    cap = cap || 256;
    this.cap = cap; this.vc = 0; this.ic = 0;
    this._p = new Float32Array(cap * 3); this._n = new Float32Array(cap * 3); this._uv = new Float32Array(cap * 2); this._c = new Float32Array(cap * 3);
    this._i = new Uint32Array(cap * 2);
  }
  get p() { return this._p.subarray(0, this.vc * 3); }
  get n() { return this._n.subarray(0, this.vc * 3); }
  get uv() { return this._uv.subarray(0, this.vc * 2); }
  get c() { return this._c.subarray(0, this.vc * 3); }
  get idx() { return this._i.subarray(0, this.ic); }
  _growV(need) {
    let cap = this.cap; while (cap < need) cap *= 2;
    const g = (a, k) => { const b = new Float32Array(cap * k); b.set(a.subarray(0, this.vc * k)); return b; };
    this._p = g(this._p, 3); this._n = g(this._n, 3); this._uv = g(this._uv, 2); this._c = g(this._c, 3);
    this.cap = cap;
  }
  tri(a, b, c) {
    if (this.ic + 3 > this._i.length) { const b2 = new Uint32Array(Math.max(this._i.length * 2, this.ic + 3)); b2.set(this._i.subarray(0, this.ic)); this._i = b2; }
    const I = this._i; I[this.ic++] = a; I[this.ic++] = b; I[this.ic++] = c;
  }
  vert(x, y, z, nx, ny, nz, u, v, col) {
    const k = this.vc;
    if (k >= this.cap) this._growV(k + 1);
    const c = col || _WHITE;
    const P = this._p, N = this._n, C = this._c, k3 = k * 3, k2 = k * 2;
    P[k3] = x; P[k3 + 1] = y; P[k3 + 2] = z; N[k3] = nx; N[k3 + 1] = ny; N[k3 + 2] = nz;
    C[k3] = c.r; C[k3 + 1] = c.g; C[k3 + 2] = c.b; this._uv[k2] = u; this._uv[k2 + 1] = v;
    return this.vc++;
  }
  /* Einen anderen Baukasten anhängen */
  append(mb) {
    if (!mb || mb.vc === 0) return;
    const base = this.vc;
    if (this.vc + mb.vc > this.cap) this._growV(this.vc + mb.vc);
    this._p.set(mb.p, base * 3); this._n.set(mb.n, base * 3); this._uv.set(mb.uv, base * 2); this._c.set(mb.c, base * 3);
    this.vc += mb.vc;
    const src = mb.idx;
    if (this.ic + src.length > this._i.length) { const b2 = new Uint32Array(Math.max(this._i.length * 2, this.ic + src.length)); b2.set(this._i.subarray(0, this.ic)); this._i = b2; }
    for (let i = 0; i < src.length; i++) this._i[this.ic + i] = src[i] + base;
    this.ic += src.length;
  }
  /* Viereck a-b-c-d gegen den Uhrzeigersinn von vorne gesehen. uv: [u0,v0,u1,v1] für a..c */
  quad(a, b, c, d, uv, col, nrm) {
    let n = nrm;
    if (!n) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; n = [nx / l, ny / l, nz / l];
    }
    const u0 = uv ? uv[0] : 0, v0 = uv ? uv[1] : 0, u1 = uv ? uv[2] : 1, v1 = uv ? uv[3] : 1;
    const i0 = this.vert(a[0], a[1], a[2], n[0], n[1], n[2], u0, v0, col);
    const i1 = this.vert(b[0], b[1], b[2], n[0], n[1], n[2], u1, v0, col);
    const i2 = this.vert(c[0], c[1], c[2], n[0], n[1], n[2], u1, v1, col);
    const i3 = this.vert(d[0], d[1], d[2], n[0], n[1], n[2], u0, v1, col);
    this.tri(i0, i1, i2); this.tri(i0, i2, i3);
  }
  /* Viereck mit eigenen UVs je Ecke */
  quadUV(a, b, c, d, ua, ub, uc, ud, col, nrm) {
    let n = nrm;
    if (!n) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; n = [nx / l, ny / l, nz / l];
    }
    const i0 = this.vert(a[0], a[1], a[2], n[0], n[1], n[2], ua[0], ua[1], col);
    const i1 = this.vert(b[0], b[1], b[2], n[0], n[1], n[2], ub[0], ub[1], col);
    const i2 = this.vert(c[0], c[1], c[2], n[0], n[1], n[2], uc[0], uc[1], col);
    const i3 = this.vert(d[0], d[1], d[2], n[0], n[1], n[2], ud[0], ud[1], col);
    this.tri(i0, i1, i2); this.tri(i0, i2, i3);
  }
  /* Horizontales Viereck mit Welt-UV (für Boden-Ebenen, damit Überlappungen nicht flimmern) */
  flat(a, b, c, d, y, scale, col) {
    const s = 1 / scale;
    this.quadUV([a[0], y, a[1]], [b[0], y, b[1]], [c[0], y, c[1]], [d[0], y, d[1]],
      [a[0] * s, -a[1] * s], [b[0] * s, -b[1] * s], [c[0] * s, -c[1] * s], [d[0] * s, -d[1] * s], col, [0, 1, 0]);
  }
  /* Streifen entlang Punkten mit Höhen: links/rechts-Versatz l0..l1 (positiv = links) */
  ribbon(pts, nrm, ys, l0, l1, scale, col, yOff) {
    const s = 1 / scale;
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], n0 = nrm[i], n1 = nrm[i + 1];
      const y0 = ys[i] + yOff, y1 = ys[i + 1] + yOff;
      const a = [p[0] + n0[0] * l1, y0, p[1] + n0[1] * l1];
      const b = [p[0] + n0[0] * l0, y0, p[1] + n0[1] * l0];
      const c = [q[0] + n1[0] * l0, y1, q[1] + n1[1] * l0];
      const d = [q[0] + n1[0] * l1, y1, q[1] + n1[1] * l1];
      this.quadUV(a, b, c, d, [a[0] * s, -a[2] * s], [b[0] * s, -b[2] * s], [c[0] * s, -c[2] * s], [d[0] * s, -d[2] * s], col);
    }
  }
  disc(cx, cz, y, r, seg, scale, col) {
    const s = 1 / scale;
    const c0 = this.vert(cx, y, cz, 0, 1, 0, cx * s, -cz * s, col);
    const first = this.vc;
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      this.vert(x, y, z, 0, 1, 0, x * s, -z * s, col);
    }
    for (let i = 0; i < seg; i++) this.tri(c0, first + i + 1, first + i);
  }
  ring(cx, cz, y, r0, r1, seg, scale, col) {
    const s = 1 / scale;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const p = (r, a) => [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
      const A = p(r1, a0), B = p(r0, a0), C = p(r0, a1), D = p(r1, a1);
      this.quadUV(A, B, C, D, [A[0] * s, -A[2] * s], [B[0] * s, -B[2] * s], [C[0] * s, -C[2] * s], [D[0] * s, -D[2] * s], col, [0, 1, 0]);
    }
  }
  /* Quader, um Y gedreht. UV in Metern / uvs. */
  box(cx, cy, cz, sx, sy, sz, rot, col, uvs, skipBottom) {
    const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const P = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const N = (x, y, z) => [x * c + z * s, y, -x * s + z * c];
    const k = uvs ? 1 / uvs : 1;
    const U = (a, b) => uvs ? [0, 0, a * k, b * k] : [0, 0, 1, 1];
    // +z
    this.quad(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz), U(sx, sy), col, N(0, 0, 1));
    // -z
    this.quad(P(hx, -hy, -hz), P(-hx, -hy, -hz), P(-hx, hy, -hz), P(hx, hy, -hz), U(sx, sy), col, N(0, 0, -1));
    // +x
    this.quad(P(hx, -hy, hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), U(sz, sy), col, N(1, 0, 0));
    // -x
    this.quad(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz), U(sz, sy), col, N(-1, 0, 0));
    // oben
    this.quad(P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz), P(-hx, hy, -hz), U(sx, sz), col, N(0, 1, 0));
    if (!skipBottom) this.quad(P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz), U(sx, sz), col, N(0, -1, 0));
  }
  /* Zylinder (stehend) */
  cyl(cx, cy, cz, r0, r1, h, seg, col, caps) {
    const base = this.vc;
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const slope = (r0 - r1) / h; const l = Math.hypot(1, slope);
      this.vert(cx + ca * r0, cy, cz + sa * r0, ca / l, slope / l, sa / l, i / seg, 0, col);
      this.vert(cx + ca * r1, cy + h, cz + sa * r1, ca / l, slope / l, sa / l, i / seg, 1, col);
    }
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2;
      this.tri(a, a + 1, a + 3); this.tri(a, a + 3, a + 2);
    }
    if (caps !== false && r1 > 0.001) {
      const c0 = this.vert(cx, cy + h, cz, 0, 1, 0, 0.5, 0.5, col);
      const f = this.vc;
      for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; this.vert(cx + Math.cos(a) * r1, cy + h, cz + Math.sin(a) * r1, 0, 1, 0, 0.5, 0.5, col); }
      for (let i = 0; i < seg; i++) this.tri(c0, f + i + 1, f + i);
    }
  }
  /* Fremde Geometrie mit Matrix übernehmen */
  addGeom(g, m, col) {
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    const base = this.vc;
    const colAttr = g.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (nor) n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); else n.set(0, 1, 0);
      let cc = col;
      if (colAttr && !col) { _tmpCol.setRGB(colAttr.getX(i), colAttr.getY(i), colAttr.getZ(i)); cc = _tmpCol; }
      this.vert(v.x, v.y, v.z, n.x, n.y, n.z, uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0, cc);
    }
    if (g.index) { const ix = g.index.array; for (let i = 0; i + 2 < ix.length; i += 3) this.tri(base + ix[i], base + ix[i + 1], base + ix[i + 2]); }
    else for (let i = 0; i + 2 < pos.count; i += 3) this.tri(base + i, base + i + 1, base + i + 2);
  }
  empty() { return this.vc === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p.slice(), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.n.slice(), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.slice(), 2));
    g.setAttribute('color', new THREE.BufferAttribute(this.c.slice(), 3));
    const ix = this.idx;
    g.setIndex(new THREE.BufferAttribute(this.vc > 65535 ? ix.slice() : Uint16Array.from(ix), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/* ---------- Speicher sparen ----------
   compactGeometry: Normalen als 8-Bit-Ganzzahlen (statt 3 x 32 Bit), Vertexfarben als 8 Bit
   oder ganz weg, wenn das Material sie nicht nutzt. Positionen und UVs bleiben 32 Bit
   (Weltkoordinaten bzw. fortlaufende Fassaden-UVs brauchen die Genauigkeit). */
function compactGeometry(g, keepColor) {
  const col = g.attributes.color;
  if (col && !keepColor) g.deleteAttribute('color');
  else if (col && col.array instanceof Float32Array) {
    const a = col.array, u = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) { const v = a[i] * 255 + 0.5; u[i] = v < 0 ? 0 : v > 255 ? 255 : v; }
    g.setAttribute('color', new THREE.BufferAttribute(u, col.itemSize, true));
  }
  const nor = g.attributes.normal;
  if (nor && nor.array instanceof Float32Array && !nor.isInstancedBufferAttribute) {
    const a = nor.array, q = new Int8Array(a.length);
    for (let i = 0; i < a.length; i++) { const v = Math.round(a[i] * 127); q[i] = v < -127 ? -127 : v > 127 ? 127 : v; }
    g.setAttribute('normal', new THREE.BufferAttribute(q, 3, true));
  }
  return g;
}
/* Nach dem Hochladen zur Grafikkarte die CPU-Kopie verwerfen (nur für unveränderliche Geometrie). */
function _dropArray() { this.__bpe = this.array.BYTES_PER_ELEMENT; this.array = null; }
function freeAfterUpload(g) {
  if (!g || g.userData.keepCpu) return;
  // Begrenzungen jetzt berechnen: später fehlen die Daten dafür
  if (!g.boundingSphere && g.attributes.position && g.attributes.position.array) g.computeBoundingSphere();
  if (!g.boundingBox && g.attributes.position && g.attributes.position.array) g.computeBoundingBox();
  for (const k in g.attributes) { const a = g.attributes[k]; if (!a.isInstancedBufferAttribute && !a.onUploadCallbackSet) { a.onUpload(_dropArray); a.onUploadCallbackSet = true; } }
  if (g.index && !g.index.onUploadCallbackSet) { g.index.onUpload(_dropArray); g.index.onUploadCallbackSet = true; }
}
/* Alle statischen Geometrien einer Szene markieren. Dynamisches (Instanz-Attribute,
   Instanz-Matrizen von Autos/Fussgängern) bleibt erhalten. */
function releaseStaticGeometry(root) {
  let n = 0;
  root.traverse(o => {
    if (!o.geometry || o.userData.dynamic) return;
    freeAfterUpload(o.geometry); n++;
    if (o.isInstancedMesh && o.userData.staticInstances) { o.instanceMatrix.onUpload(_dropArray); if (o.instanceColor) o.instanceColor.onUpload(_dropArray); }
  });
  return n;
}

/* Alle Geometrien einmal zur Grafikkarte schicken (unsichtbar, 1x1 Pixel), damit die
   CPU-Kopien sofort freigegeben werden und nicht erst, wenn ein Objekt ins Bild kommt. */
function uploadAllGeometry(renderer, scene, camera) {
  const changed = [];
  scene.traverse(o => {
    if (o.visible === false) { changed.push([o, 'visible', false]); o.visible = true; }
    if (o.frustumCulled) { changed.push([o, 'frustumCulled', true]); o.frustumCulled = false; }
  });
  const rt = new THREE.WebGLRenderTarget(1, 1);
  const sm = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false;
  renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null);
  renderer.shadowMap.enabled = sm;
  rt.dispose();
  for (const [o, k, v] of changed) o[k] = v;
}

/* Baukasten pro Kachel (für Sichtbarkeits-Culling grosser Mengen statischer Geometrie). */
class ChunkedMB {
  constructor(size) { this.size = size || 625; this.map = new Map(); }
  get(key, x, z) {
    const cx = Math.floor((x + 2500) / this.size), cz = Math.floor((z + 2500) / this.size);
    const k = key + '|' + cx + '|' + cz;
    let mb = this.map.get(k);
    if (!mb) { mb = new MB(); mb.key = key; this.map.set(k, mb); }
    return mb;
  }
  finish(materials, parent, opts) {
    const meshes = [];
    for (const mb of this.map.values()) {
      if (mb.empty()) continue;
      const mat = materials[mb.key];
      if (!mat) continue;
      const m = new THREE.Mesh(compactGeometry(mb.build(), !!mat.vertexColors), mat);
      m.name = 'chunk:' + mb.key;
      m.castShadow = !!(opts && opts.cast && opts.cast[mb.key]);
      m.receiveShadow = !(opts && opts.noReceive);
      m.matrixAutoUpdate = false;
      parent.add(m);
      meshes.push(m);
    }
    this.map.clear();
    return meshes;
  }
}

/* ---------- Canvas-Texturen ---------- */
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(cv, opts) {
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = (opts && opts.clamp) ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.anisotropy = (opts && opts.aniso) || 8;
  if (!(opts && opts.linear)) t.encoding = THREE.sRGBEncoding;
  if (opts && opts.nomip) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  return t;
}
/* Normal-Map aus Graustufen-Höhe */
function normalFromHeight(src, strength) {
  const w = src.width, h = src.height;
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const out = makeCanvas(w, h), ctx = out.getContext('2d');
  const od = ctx.createImageData(w, h);
  const H = (x, y) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
    const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz);
    const i = (y * w + x) * 4;
    od.data[i] = (nx / l * 0.5 + 0.5) * 255; od.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; od.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; od.data[i + 3] = 255;
  }
  ctx.putImageData(od, 0, 0);
  return out;
}
function noiseCanvas(w, h, base, amp, scale, seed) {
  const cv = makeCanvas(w, h), ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // kachelbares Rauschen über Torus-Abbildung
    const a = x / w * Math.PI * 2, b = y / h * Math.PI * 2;
    const nx = Math.cos(a) * scale, ny = Math.sin(a) * scale, nz = Math.cos(b) * scale, nw = Math.sin(b) * scale;
    let v = fbm(nx + nz * 0.7 + seed, ny + nw * 0.7 - seed, 4) * 0.7 + fbm(nz * 2.1 + seed * 3, nw * 2.1 + nx, 3) * 0.3;
    v = base + v * amp + (hash2i(x + seed * 13, y) - 0.5) * amp * 0.6;
    const i = (y * w + x) * 4;
    const c = clamp(v * 255, 0, 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = c; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
/* ---------- Textur-Atlas für Schilder ----------
   Viele kleine Schilder (Haltestellen, Stationen, Hotels) teilen sich wenige 1024er-Seiten.
   Gleiche Inhalte (gleicher Schlüssel) werden nur einmal gezeichnet. */
class TexAtlas {
  constructor(size) { this.size = size || 1024; this.pages = []; this.cache = new Map(); }
  _page() {
    const cv = makeCanvas(this.size, this.size), ctx = cv.getContext('2d');
    const tex = canvasTex(cv, { clamp: true });
    const pg = { cv, ctx, tex, x: 0, y: 0, rowH: 0, mats: {} };
    this.pages.push(pg); return pg;
  }
  /* Platz reservieren und mit draw(ctx, w, h) bemalen; liefert eine Region */
  add(key, w, h, draw) {
    if (key && this.cache.has(key)) return this.cache.get(key);
    const S = this.size, pad = 6;
    let pg = this.pages[this.pages.length - 1] || this._page();
    if (pg.x + w + pad > S) { pg.x = 0; pg.y += pg.rowH + pad; pg.rowH = 0; }
    if (pg.y + h + pad > S) { pg = this._page(); }
    const x = pg.x + pad / 2, y = pg.y + pad / 2;
    const ctx = pg.ctx;
    ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    draw(ctx, w, h);
    ctx.restore();
    pg.x += w + pad; pg.rowH = Math.max(pg.rowH, h);
    pg.tex.needsUpdate = true;
    const r = { page: pg, u0: x / S, u1: (x + w) / S, v0: 1 - (y + h) / S, v1: 1 - y / S };
    if (key) this.cache.set(key, r);
    return r;
  }
  /* Rechteck-Geometrie (Breite x Höhe in Metern) mit den UVs der Region */
  plane(r, w, h) {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(r.u0, r.u1, uv.getX(i)), lerp(r.v0, r.v1, uv.getY(i)));
    return g;
  }
  /* Ein Material pro Seite und Art */
  material(r, kind, make) {
    const pg = r.page;
    if (!pg.mats[kind]) pg.mats[kind] = make(pg.tex);
    return pg.mats[kind];
  }
}
const SIGNS = new TexAtlas(1024);

/* Gemeinsame Animationszeit für Shader (Wind in Bäumen, Fahnen, Vögel); main.js setzt sie pro Bild */
const AMB_T = { value: 0 };
function signMaterial(r, kind) {
  return SIGNS.material(r, kind, (tex) => kind === 'glow'
    ? new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.4, roughness: 0.5, alphaTest: 0.5, side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, alphaTest: 0.5, side: THREE.DoubleSide }));
}
function signMesh(r, kind, w, h) { return new THREE.Mesh(SIGNS.plane(r, w, h), signMaterial(r, kind)); }

/* Text in einen Zeichenbereich schreiben (Hintergrund, Rahmen, automatische Schriftgrösse) */
function drawText(ctx, w, h, text, opts) {
  if (opts.bg) { ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, w, h); }
  if (opts.border) { ctx.strokeStyle = opts.border; ctx.lineWidth = opts.borderW || 6; ctx.strokeRect(3, 3, w - 6, h - 6); }
  ctx.fillStyle = opts.fg || '#fff';
  ctx.font = opts.font || ('bold ' + Math.floor(h * 0.55) + 'px Arial');
  ctx.textAlign = opts.align || 'center'; ctx.textBaseline = 'middle';
  let size = parseInt(ctx.font.match(/(\d+)px/)[1], 10);
  while (ctx.measureText(text).width > w * 0.92 && size > 8) { size -= 2; ctx.font = ctx.font.replace(/\d+px/, size + 'px'); }
  ctx.fillText(text, opts.align === 'left' ? w * 0.05 : w / 2, h / 2 + (opts.dy || 0));
}

function textCanvas(text, w, h, opts) {
  const cv = makeCanvas(w, h), ctx = cv.getContext('2d');
  ctx.fillStyle = opts.bg || '#000'; ctx.fillRect(0, 0, w, h);
  if (opts.border) { ctx.strokeStyle = opts.border; ctx.lineWidth = opts.borderW || 6; ctx.strokeRect(3, 3, w - 6, h - 6); }
  ctx.fillStyle = opts.fg || '#fff';
  ctx.font = opts.font || ('bold ' + Math.floor(h * 0.55) + 'px Arial');
  ctx.textAlign = opts.align || 'center'; ctx.textBaseline = 'middle';
  let size = parseInt(ctx.font.match(/(\d+)px/)[1], 10);
  while (ctx.measureText(text).width > w * 0.92 && size > 8) { size -= 2; ctx.font = ctx.font.replace(/\d+px/, size + 'px'); }
  ctx.fillText(text, opts.align === 'left' ? w * 0.05 : w / 2, h / 2 + (opts.dy || 0));
  return cv;
}
