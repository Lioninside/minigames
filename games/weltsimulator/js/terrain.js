/* ================= TERRAIN & WASSER =================
   Höhenfunktion der Landschaft, Fluss, venezianische Kanäle, Meer und Strand,
   Gelände-Mesh (mit ausgeschnittenen Wasserläufen), Quaimauern und Wasserfläche. */

const WATER = { polys: [], segs: [], hash: null, river: null, maskTex: null };

function coastX(z) { return 2060 + 40 * Math.sin(z / 500) + 18 * Math.sin(z / 170 + 1); }
function inVeniceZ(z) { return z > WS.VENICE.z0 && z < WS.VENICE.z1; }
function veniceMask(x, z) {
  const V = WS.VENICE;
  return smooth(V.x0 - 60, V.x0, x) * smooth(V.z0 - 60, V.z0, z) * (1 - smooth(V.z1, V.z1 + 60, z));
}

function addWaterPoly(pts, hwFn, kind, id) {
  const poly = { id, kind, pts, hw: pts.map(p => hwFn(p[0], p[1])) };
  WATER.polys.push(poly);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const s = { ax: a[0], az: a[1], bx: b[0], bz: b[1], hw: (poly.hw[i] + poly.hw[i + 1]) / 2, poly: id, kind };
    WATER.segs.push(s);
    const m = s.hw + 80;
    WATER.hash.insert(s, Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m);
  }
  return poly;
}

function initWater() {
  WATER.hash = new SHash(60);
  const river = catmullSample([[-2750, -640], [-2250, -560], [-1800, -420], [-1350, -160], [-900, 10], [-450, 60],
    [-50, -10], [350, 120], [800, 230], [1250, 180], [1600, 330], [1900, 430], [2350, 470]], 8);
  WATER.river = addWaterPoly(river, (x) => 22 + smooth(1450, 2050, x) * 14, 'river', 0);
  // Klein-Venedig: Kanäle, die vom Meer herein- und wieder hinausführen
  const canal = (pts, hw, id) => addWaterPoly(catmullSample(pts, 5), () => hw, 'canal', id);
  canal([[2250, -1110], [1950, -1105], [1760, -1085], [1640, -1040], [1575, -950], [1565, -860], [1600, -760],
    [1580, -650], [1610, -560], [1700, -510], [1850, -495], [2000, -488], [2250, -480]], 11, 1);       // Canale Grande
  canal([[1725, -1082], [1712, -960], [1722, -840], [1710, -700], [1718, -560], [1715, -505]], 6.5, 2);
  canal([[1567, -880], [1650, -872], [1780, -878], [1880, -868], [2000, -876], [2250, -880]], 6.5, 3);
  canal([[1880, -1102], [1872, -1000], [1878, -930], [1875, -874]], 6, 4);
  canal([[1712, -700], [1780, -695], [1830, -665], [1842, -590], [1850, -497]], 6, 5);
  canal([[1580, -650], [1640, -640], [1714, -630]], 5.5, 6);
}

/* Abstand zur nächsten Wasserkante (negativ = im Fluss/Kanal). Meer separat über coastX. */
let WD_POLY = -1, WD_KIND = '';
function waterDist(x, z, exceptPoly) {
  let best = 1e9; WD_POLY = -1; WD_KIND = '';
  WATER.hash.query(x - 1, z - 1, x + 1, z + 1, (s) => {
    if (s.poly === exceptPoly) return;
    const d = segDist(x, z, s.ax, s.az, s.bx, s.bz) - s.hw;
    if (d < best) { best = d; WD_POLY = s.poly; WD_KIND = s.kind; }
  });
  return best;
}
function riverDist(x, z) {
  let best = 1e9;
  WATER.hash.query(x - 1, z - 1, x + 1, z + 1, (s) => {
    if (s.kind !== 'river') return;
    const d = segDist(x, z, s.ax, s.az, s.bx, s.bz) - s.hw;
    if (d < best) best = d;
  });
  if (best > 1e8) {
    // weit weg: grob über die Polylinie
    const p = WATER.river.pts;
    for (let i = 0; i < p.length - 1; i += 6) { const d = segDist(x, z, p[i][0], p[i][1], p[Math.min(p.length - 1, i + 6)][0], p[Math.min(p.length - 1, i + 6)][1]) - 30; if (d < best) best = d; }
  }
  return best;
}
function isWaterAt(x, z) { return waterDist(x, z) < -0.5 || terrainH(x, z) < WS.WATER_Y - 0.05; }

/* ---------- Höhenraster ----------
   Die Höhenformel ist teuer. Sie wird einmal pro Rasterpunkt gerechnet (genau die Punkte des
   Gelände-Meshes); danach liefert terrainH() dieselben Dreiecke, die auch gezeichnet werden. */
const TGRID = { seg: 560, step: 5000 / 560, h: null };
function buildHeightGrid() {
  const n = TGRID.seg + 1, h = new Float32Array(n * n), st = TGRID.step;
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) h[iz * n + ix] = terrainHRaw(-2500 + ix * st, -2500 + iz * st);
  TGRID.h = h;
}
function terrainH(x, z) {
  const H = TGRID.h;
  if (!H) return terrainHRaw(x, z);
  const n = TGRID.seg + 1;
  let fx = (x + 2500) / TGRID.step, fz = (z + 2500) / TGRID.step;
  if (fx < 0) fx = 0; else if (fx > TGRID.seg - 1e-6) fx = TGRID.seg - 1e-6;
  if (fz < 0) fz = 0; else if (fz > TGRID.seg - 1e-6) fz = TGRID.seg - 1e-6;
  const ix = fx | 0, iz = fz | 0, u = fx - ix, v = fz - iz;
  const a = H[iz * n + ix], b = H[(iz + 1) * n + ix], d = H[iz * n + ix + 1], c = H[(iz + 1) * n + ix + 1];
  // gleiche Diagonale wie PlaneGeometry (von (ix,iz+1) nach (ix+1,iz))
  if (u + v <= 1) return a + (d - a) * u + (b - a) * v;
  return c + (b - c) * (1 - u) + (d - c) * (1 - v);
}

/* ---------- Höhenfunktion ---------- */
function terrainHRaw(x, z) {
  let h = WS.CITY_Y + fbm(x * 0.0009 + 3, z * 0.0009 - 7, 3) * 1.2;
  const fadeE = 1 - smooth(1250, 1950, x);
  const mw = smooth(1750, 2450, -x), mn = smooth(1750, 2450, -z) * fadeE, ms = smooth(1750, 2450, z) * fadeE;
  const m = Math.max(mw, mn, ms);
  if (m > 0) h += m * m * (55 + 175 * (0.35 + 0.65 * ridged(x * 0.0017 + 11, z * 0.0017 - 4, 4)));
  for (let i = 0; i < INNER_HILLS.length; i++) {
    const b = INNER_HILLS[i], dx = x - b.x, dz = z - b.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 9 * b.s * b.s) h += b.h * Math.exp(-d2 / (2 * b.s * b.s)) * (0.85 + 0.15 * vnoise(x * 0.01, z * 0.01));
  }
  const H = WS.HILL;
  const r = Math.hypot(x - H.x, z - H.z);
  const rr2 = Math.max(0, r - H.plateau);
  h += H.h * Math.exp(-rr2 * rr2 / (2 * H.sigma * H.sigma));
  // Flusstal durch die Berge
  if (m > 0.01) {
    const rd = riverDist(x, z);
    if (rd < 320) h = lerp(h, WS.CITY_Y, 1 - smooth(25, 320, rd));
  }
  // Venedig liegt tiefer
  const v = veniceMask(x, z);
  if (v > 0) h = lerp(h, WS.VENICE_Y, v);
  // Strand / Quai zum Meer
  const dc = coastX(z) - x;
  if (dc < 170) {
    const beach = dc > 0 ? WS.WATER_Y + 0.05 + (WS.CITY_Y - WS.WATER_Y) * smooth(0, 150, dc) : WS.WATER_Y + 0.05 + dc * 0.06;
    const quay = dc > 0 ? WS.VENICE_Y : WS.VENICE_Y + dc * 0.9;
    let hb = lerp(beach, quay, v);
    hb = Math.max(hb, -9);
    h = dc < 0 ? hb : Math.min(h, lerp(hb, h, smooth(120, 170, dc)));
  }
  return h;
}

function terrainSlope(x, z) {
  const e = 3;
  const dx = terrainH(x + e, z) - terrainH(x - e, z), dz = terrainH(x, z + e) - terrainH(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

/* ---------- Maske der Wasserläufe (Gelände wird dort ausgeschnitten) ---------- */
function buildWaterMask() {
  const S = 2048, cv = makeCanvas(S, S), ctx = cv.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
  const k = S / 5000;
  ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const poly of WATER.polys) {
    for (let i = 0; i < poly.pts.length - 1; i++) {
      const a = poly.pts[i], b = poly.pts[i + 1];
      ctx.lineWidth = Math.max(1, (poly.hw[i] - 1.3) * 2 * k);
      ctx.beginPath(); ctx.moveTo((a[0] + 2500) * k, (a[1] + 2500) * k); ctx.lineTo((b[0] + 2500) * k, (b[1] + 2500) * k); ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.flipY = false; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  WATER.maskTex = t;
  WATER.maskCanvas = cv;
  return t;
}

/* ---------- Gelände-Mesh ---------- */
const TERRAIN = { mesh: null, mat: null, holes: [] };

function buildTerrain(scene) {
  const SEG = TGRID.seg, SIZE = 5000;
  const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  if (!TGRID.h) buildHeightGrid();
  for (let i = 0; i < pos.count; i++) pos.setY(i, TGRID.h[i]);
  g.computeVertexNormals();
  const nor = g.attributes.normal;
  const cGrass1 = lin(0x5b8636), cGrass2 = lin(0x7d9c45), cDry = lin(0x9c9a5c), cForest = lin(0x45652c),
    cRock = lin(0x7f786c), cSand = lin(0xd9c79a), cWetSand = lin(0xb19d73), cStone = lin(0xb4a891), cSnow = lin(0xe8ecef);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), ny = nor.getY(i);
    const n1 = vnoise(x * 0.004, z * 0.004), n2 = vnoise(x * 0.02 + 5, z * 0.02);
    c.copy(cGrass1).lerp(cGrass2, clamp(0.5 + n1 * 0.6, 0, 1));
    if (n2 > 0.45) c.lerp(cDry, (n2 - 0.45) * 1.2);
    const hillR = Math.hypot(x - WS.HILL.x, z - WS.HILL.z);
    if (y > 14 || hillR < 470) c.lerp(cForest, clamp((y - 8) / 30, 0, 0.7));
    if (ny < 0.82) c.lerp(cRock, clamp((0.82 - ny) * 5, 0, 1));
    if (y > 150) c.lerp(cRock, clamp((y - 150) / 40, 0, 0.8));
    if (y > 205) c.lerp(cSnow, clamp((y - 205) / 20, 0, 0.9));
    const dc = coastX(z) - x;
    const v = veniceMask(x, z);
    if (dc < 125 && v < 0.5) c.lerp(y < WS.WATER_Y + 0.4 ? cWetSand : cSand, clamp((125 - dc) / 20, 0, 1));
    if (v > 0) c.lerp(cStone, v);
    if (y < WS.WATER_Y - 0.3) c.copy(cWetSand).multiplyScalar(0.7);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));

  const det = noiseCanvas(256, 256, 0.62, 0.55, 3.0, 7);
  const tex = canvasTex(det, { linear: false });
  const ntex = canvasTex(normalFromHeight(det, 2.5), { linear: true });
  tex.repeat.set(SIZE / 9, SIZE / 9); ntex.repeat.copy(tex.repeat);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex, normalMap: ntex, roughness: 0.96, metalness: 0 });
  mat.normalScale.set(0.6, 0.6);
  const holesA = [], holesB = [];
  for (let i = 0; i < 48; i++) { holesA.push(new THREE.Vector4(99999, 99999, 1, 0)); holesB.push(new THREE.Vector2(0, 0)); }
  TERRAIN.holes.forEach((h, i) => { if (i < 48) { holesA[i].set(h.x, h.z, Math.cos(h.rot), Math.sin(h.rot)); holesB[i].set(h.hl, h.hw); } });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMask = { value: WATER.maskTex };
    sh.uniforms.uHoleA = { value: holesA };
    sh.uniforms.uHoleB = { value: holesB };
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform sampler2D uMask;\nuniform vec4 uHoleA[48];\nuniform vec2 uHoleB[48];\nvarying vec3 vWPos;\n' +
      sh.fragmentShader.replace('void main() {', `void main() {
        vec2 muv = (vWPos.xz + 2500.0) / 5000.0;
        if (texture2D(uMask, muv).r > 0.5) discard;
        for (int i = 0; i < 48; i++) {
          vec2 d = vWPos.xz - uHoleA[i].xy;
          float la = d.x * uHoleA[i].w + d.y * uHoleA[i].z;
          float ll = d.x * uHoleA[i].z - d.y * uHoleA[i].w;
          if (abs(la) < uHoleB[i].x && abs(ll) < uHoleB[i].y) discard;
        }`).replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 t1 = texture2D(map, vUv);
          vec4 t2 = texture2D(map, vUv * 0.113 + 0.37);
          diffuseColor.rgb *= mapTexelToLinear(mix(t1, t2, 0.45)) .rgb * 1.55;
        #endif`);
  };
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  scene.add(mesh);
  TERRAIN.mesh = mesh; TERRAIN.mat = mat;
  return mesh;
}

/* Lokale Achse der Löcher: rot wie Gebäude (lokal +z = (sin, cos)). In der Shader-Rechnung:
   la = d·(sin,cos), ll = d·(cos,-sin). */
function addTerrainHole(x, z, rot, hl, hw) { TERRAIN.holes.push({ x, z, rot, hl, hw }); }

/* ---------- Quaimauern ---------- */
function buildQuays(scene, mats) {
  const cm = new ChunkedMB(WS.CHUNK);
  const stoneCol = lin(0x9d9283), copeCol = lin(0xc2b8a6);
  for (const poly of WATER.polys) {
    const pts = poly.pts, nrm = polyNormals(pts);
    for (const side of [1, -1]) {
      let prev = null;
      for (let i = 0; i < pts.length; i++) {
        const hw = poly.hw[i] - 0.5;
        const x = pts[i][0] + nrm[i][0] * hw * side, z = pts[i][1] + nrm[i][1] * hw * side;
        const ok = x < coastX(z) - 1.5 && waterDist(x, z, poly.id) > 0.3 && Math.abs(x) < 2500 && Math.abs(z) < 2500;
        const cur = ok ? { x, z, y: terrainH(x, z) + 0.03, nx: nrm[i][0] * side, nz: nrm[i][1] * side } : null;
        if (prev && cur) {
          const mb = cm.get('quay', x, z);
          // Mauer (zeigt zum Wasser)
          mb.quad([cur.x, -2.5, cur.z], [prev.x, -2.5, prev.z], [prev.x, prev.y, prev.z], [cur.x, cur.y, cur.z],
            [0, 0, Math.hypot(cur.x - prev.x, cur.z - prev.z) / 3, (prev.y + 2.5) / 3], stoneCol);
          // Abdeckplatte
          const w0 = 1.3, w1 = -0.8; // Wasserseite / Landseite (Material ist beidseitig)
          const A = [prev.x - prev.nx * w0, prev.y + 0.03, prev.z - prev.nz * w0];
          const B = [cur.x - cur.nx * w0, cur.y + 0.03, cur.z - cur.nz * w0];
          const C = [cur.x - cur.nx * w1, cur.y + 0.03, cur.z - cur.nz * w1];
          const D = [prev.x - prev.nx * w1, prev.y + 0.03, prev.z - prev.nz * w1];
          if (side > 0) mb.quad(B, A, D, C, [0, 0, 1, 1], copeCol, [0, 1, 0]);
          else mb.quad(A, B, C, D, [0, 0, 1, 1], copeCol, [0, 1, 0]);
          // Kante der Platte
          mb.quad([cur.x - cur.nx * w0, cur.y - 0.25, cur.z - cur.nz * w0], [prev.x - prev.nx * w0, prev.y - 0.25, prev.z - prev.nz * w0], A, B, [0, 0, 1, 0.1], stoneCol);
        }
        prev = cur;
      }
    }
  }
  // Quai entlang der Meeresfront von Klein-Venedig
  let prev = null;
  for (let z = WS.VENICE.z0 + 30; z <= WS.VENICE.z1 - 30; z += 4) {
    const x = coastX(z) - 0.5;
    const ok = waterDist(x, z) > 0.3;
    const cur = ok ? { x, z, y: WS.VENICE_Y + 0.03 } : null;
    if (prev && cur) {
      const mb = cm.get('quay', x, z);
      mb.quad([prev.x, -3, prev.z], [cur.x, -3, cur.z], [cur.x, cur.y, cur.z], [prev.x, prev.y, prev.z], [0, 0, 1, 1], stoneCol);
      mb.quad([prev.x - 0.8, cur.y + 0.03, prev.z], [prev.x + 1.2, cur.y + 0.03, prev.z], [cur.x + 1.2, cur.y + 0.03, cur.z], [cur.x - 0.8, cur.y + 0.03, cur.z], [0, 0, 1, 1], copeCol, [0, 1, 0]);
    }
    prev = cur;
  }
  cm.finish(mats, scene, {});
}

/* ---------- Wasserfläche ---------- */
function buildWater(scene) {
  const cv = makeCanvas(256, 256), ctx = cv.getContext('2d');
  const h = noiseCanvas(256, 256, 0.5, 0.5, 4.0, 31);
  ctx.drawImage(h, 0, 0);
  const nt = canvasTex(normalFromHeight(cv, 3.0), { linear: true });
  nt.repeat.set(900, 900);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1b4a58, roughness: 0.06, metalness: 0.15, normalMap: nt, envMapIntensity: 1.2 });
  mat.normalScale.set(0.35, 0.35);
  const g = new THREE.PlaneGeometry(16000, 16000, 1, 1);
  g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.y = WS.WATER_Y;
  mesh.receiveShadow = false;
  scene.add(mesh);
  WATER.mesh = mesh; WATER.mat = mat; WATER.normal = nt;
  return mesh;
}
function updateWater(t) {
  if (!WATER.normal) return;
  WATER.normal.offset.set((t * 0.004) % 1, (t * 0.0027) % 1);
}
