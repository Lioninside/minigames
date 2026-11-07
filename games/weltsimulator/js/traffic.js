/* ================= PRIVATVERKEHR & FUSSGÄNGER =================
   Autos und Fussgänger als instanzierte Meshes: wenige Draw-Calls trotz vieler Objekte. */

const TRAFFIC = { cars: [], peds: [], carMeshes: null, pedMeshes: null, obs: [] };

function carGeometries() {
  const body = new THREE.Shape();
  body.moveTo(-2.25, 0.3); body.lineTo(2.18, 0.3); body.quadraticCurveTo(2.32, 0.32, 2.32, 0.58); body.lineTo(2.25, 0.8);
  body.quadraticCurveTo(1.7, 0.88, 1.0, 0.93); body.lineTo(-1.65, 0.96); body.quadraticCurveTo(-2.2, 0.92, -2.28, 0.78); body.lineTo(-2.3, 0.45); body.closePath();
  const bg = new THREE.ExtrudeGeometry(body, { depth: 1.72, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 6 });
  bg.translate(0, 0, -0.86);
  const cab = new THREE.Shape();
  cab.moveTo(1.0, 0.9); cab.quadraticCurveTo(0.55, 1.3, 0.25, 1.42); cab.lineTo(-1.15, 1.45); cab.quadraticCurveTo(-1.55, 1.3, -1.75, 0.93); cab.closePath();
  const cg = new THREE.ExtrudeGeometry(cab, { depth: 1.56, bevelEnabled: false, curveSegments: 6 });
  cg.translate(0, 0, -0.78);
  const roof = new THREE.BoxGeometry(1.3, 0.05, 1.5); roof.translate(-0.45, 1.46, 0);
  const mbBody = new MB(); mbBody.addGeom(bg, new THREE.Matrix4(), null); mbBody.addGeom(roof, new THREE.Matrix4(), null);
  const mbTrim = new MB();
  const wg = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14); wg.rotateX(Math.PI / 2);
  for (const x of [1.42, -1.38]) for (const z of [0.8, -0.8]) mbTrim.addGeom(wg, new THREE.Matrix4().makeTranslation(x, 0.33, z), null);
  mbTrim.box(2.33, 0.4, 0, 0.06, 0.18, 1.6, 0, null); mbTrim.box(-2.32, 0.4, 0, 0.06, 0.18, 1.6, 0, null);
  const mbHead = new MB(); mbHead.box(2.3, 0.66, 0.6, 0.05, 0.12, 0.32, 0, null); mbHead.box(2.3, 0.66, -0.6, 0.05, 0.12, 0.32, 0, null);
  const mbTail = new MB(); mbTail.box(-2.3, 0.7, 0.62, 0.05, 0.14, 0.3, 0, null); mbTail.box(-2.3, 0.7, -0.62, 0.05, 0.14, 0.3, 0, null);
  const out = {};
  const rot = new THREE.Matrix4().makeRotationY(-Math.PI / 2);
  for (const [k, g] of [['body', mbBody.build()], ['glass', cg], ['trim', mbTrim.build()], ['head', mbHead.build()], ['tail', mbTail.build()]]) { g.applyMatrix4(rot); if (g.attributes.color) g.deleteAttribute('color'); out[k] = g; }
  return out;
}

function spawnTraffic(scene) {
  const nodes = ROADS.nodes.filter(n => !n.dead && n.adj.length >= 2);
  const NC = 170;
  for (let i = 0; i < NC; i++) {
    let r = null;
    for (let t = 0; t < 10 && !r; t++) { const rt = randomRoute(pick(nodes), 1200, 2600, false); if (rt.len > 700) r = rt; }
    if (!r) continue;
    const p = buildRoadPath(r.seq, 'car');
    const path = new TPath(p.pts, []);
    TRAFFIC.cars.push({ path, s: rnd() * path.L, v: 0, vmax: rr(10, 14), blockedT: 0, ignoreT: 0, x: 0, z: 0, yaw: 0 });
  }
  const G = carGeometries();
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x14202a, roughness: 0.05, metalness: 0.3, envMapIntensity: 1.5 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7 });
  TRAFFIC.headMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xfff6dc, emissiveIntensity: 0.2 });
  TRAFFIC.tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a1a, emissiveIntensity: 0.3 });
  const n = TRAFFIC.cars.length;
  const mk = (g, m, cast) => { const im = new THREE.InstancedMesh(g, m, n); im.frustumCulled = false; im.castShadow = cast; im.receiveShadow = true; scene.add(im); return im; };
  TRAFFIC.carMeshes = [mk(G.body, paint, true), mk(G.glass, glass, false), mk(G.trim, trim, true), mk(G.head, TRAFFIC.headMat, false), mk(G.tail, TRAFFIC.tailMat, false)];
  const cols = [0xf2f2f2, 0x111111, 0x8a8f96, 0xb5b9bf, 0x1d3f7a, 0x8a1515, 0x2d5a3a, 0xc9b28a, 0x3a3f48, 0xd8d8d8, 0x5a0f1a, 0x0f4c75, 0xe0a020, 0xffffff].map(c => lin(c));
  for (let i = 0; i < n; i++) TRAFFIC.carMeshes[0].setColorAt(i, pick(cols));
  TRAFFIC.carMeshes[0].instanceColor.needsUpdate = true;

  // Fussgänger
  const NP = 420;
  for (let i = 0; i < NP; i++) {
    const start = pick(nodes);
    const r = randomRoute(start, 250, 800, true);
    if (r.seq.length < 2) continue;
    const p = buildRoadPath(r.seq, 'ped');
    const path = new TPath(p.pts, []);
    TRAFFIC.peds.push({ path, s: rnd() * path.L, v: rr(1.1, 1.6), ph: rnd() * 6, lat: rr(-0.5, 0.5), h: rr(0.92, 1.08) });
  }
  const box = (w, h, d, y) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, y, 0); return g; };
  const torso = box(0.42, 0.62, 0.24, 0); const head = new THREE.SphereGeometry(0.12, 12, 10);
  const leg = box(0.15, 0.82, 0.16, -0.41); const arm = box(0.11, 0.62, 0.12, -0.31);
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const np = TRAFFIC.peds.length;
  const mkP = (g) => { const im = new THREE.InstancedMesh(g, m, np); im.frustumCulled = false; im.castShadow = true; scene.add(im); return im; };
  TRAFFIC.pedMeshes = { torso: mkP(torso), head: mkP(head), legL: mkP(leg), legR: mkP(leg), armL: mkP(arm), armR: mkP(arm) };
  const shirts = [0x2b4c7e, 0xb03a2e, 0xe8e2d0, 0x2f6f4f, 0x333333, 0xd9a441, 0x6b3fa0, 0x1e90a0, 0xf0f0f0, 0x8a5a3a].map(c => lin(c));
  const pants = [0x1d2633, 0x3a3a3a, 0x4a5a7a, 0x6b5a45, 0x1a1a1a, 0x7a7a72].map(c => lin(c));
  const skin = [0xf1c9a5, 0xe0ac87, 0xc68863, 0x8d5a3b, 0x5c3a24, 0xf5d7bf].map(c => lin(c));
  TRAFFIC.peds.forEach((p, i) => {
    const sh = pick(shirts), pa = pick(pants), sk = pick(skin);
    const P2 = TRAFFIC.pedMeshes;
    P2.torso.setColorAt(i, sh); P2.armL.setColorAt(i, sh); P2.armR.setColorAt(i, sh); P2.legL.setColorAt(i, pa); P2.legR.setColorAt(i, pa); P2.head.setColorAt(i, sk);
  });
  for (const k in TRAFFIC.pedMeshes) TRAFFIC.pedMeshes[k].instanceColor.needsUpdate = true;
}

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _off = new THREE.Vector3();
const _pt = {};
function updateTraffic(dt, camPos) {
  const cm = TRAFFIC.carMeshes;
  for (let i = 0; i < TRAFFIC.cars.length; i++) {
    const c = TRAFFIC.cars[i];
    const P = c.path;
    let vt = Math.min(c.vmax, P.speedAt(c.s + c.v * 1.2));
    const range = Math.max(5, c.v * c.v / 5 + 4);
    const blocked = obstacleAhead(c, c.x, c.z, Math.sin(c.yaw), Math.cos(c.yaw), 2.3, range, c.obj);
    if (blocked && c.ignoreT <= 0) { vt = 0; c.blockedT += dt; if (c.blockedT > 6 && blocked !== 'player') { c.ignoreT = 3; c.blockedT = 0; } } else c.blockedT = 0;
    if (c.ignoreT > 0) c.ignoreT -= dt;
    if (vt > c.v) c.v = Math.min(vt, c.v + 2.2 * dt); else c.v = Math.max(vt, c.v - 6 * dt);
    c.s = (c.s + c.v * dt) % P.L;
    P.at(c.s, _pt);
    c.x = _pt.x; c.z = _pt.z; c.yaw = Math.atan2(_pt.dx, _pt.dz);
    _q.setFromAxisAngle(_v.set(0, 1, 0), c.yaw);
    _m4.compose(_off.set(_pt.x, _pt.y, _pt.z), _q, _s.set(1, 1, 1));
    for (const im of cm) im.setMatrixAt(i, _m4);
  }
  for (const im of cm) im.instanceMatrix.needsUpdate = true;
  const pm = TRAFFIC.pedMeshes;
  const near = 450;
  for (let i = 0; i < TRAFFIC.peds.length; i++) {
    const p = TRAFFIC.peds[i];
    p.s = (p.s + p.v * dt) % p.path.L;
    p.path.at(p.s, _pt);
    const far = Math.abs(_pt.x - camPos.x) > near || Math.abs(_pt.z - camPos.z) > near;
    p.ph += p.v * dt * 4.2;
    const yaw = Math.atan2(_pt.dx, _pt.dz);
    const x = _pt.x + _pt.dz * p.lat, z = _pt.z - _pt.dx * p.lat, y = _pt.y - 0.03;
    const sw = far ? 0 : Math.sin(p.ph) * 0.5;
    const set = (im, ox, oy, oz, rx) => {
      _e.set(rx, yaw, 0, 'YXZ'); _q.setFromEuler(_e);
      const c = Math.cos(yaw), s = Math.sin(yaw);
      _off.set(x + ox * c + oz * s, y + oy * p.h, z - ox * s + oz * c);
      _m4.compose(_off, _q, _s.set(p.h, p.h, p.h));
      im.setMatrixAt(i, _m4);
    };
    set(pm.torso, 0, 1.2, 0, 0);
    set(pm.head, 0, 1.66, 0, 0);
    set(pm.legL, 0.11, 0.86, 0, sw);
    set(pm.legR, -0.11, 0.86, 0, -sw);
    set(pm.armL, 0.28, 1.48, 0, -sw * 0.8);
    set(pm.armR, -0.28, 1.48, 0, sw * 0.8);
  }
  for (const k in pm) pm[k].instanceMatrix.needsUpdate = true;
}

/* Hindernisse dieses Frames: Autos und Spieler */
function trafficObstacles(px, pz, playerActive) {
  const list = TRAFFIC.obs; list.length = 0;
  for (const c of TRAFFIC.cars) { if (!c.obj) c.obj = { r: 2.3 }; c.obj.x = c.x; c.obj.z = c.z; c.obj.yaw = c.yaw; c.obj.veh = c; list.push(c.obj); }
  if (playerActive) list.push({ x: px, z: pz, r: 0.4, player: true });
  return list;
}
