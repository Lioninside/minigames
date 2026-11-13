/* ================= PRIVATVERKEHR & FUSSGÄNGER =================
   Fahrlogik für Autos und Fussgänger. Die Modelle kommen aus js/assets/car.js und
   js/assets/pedestrian.js; hier wird jedes Bild nach Entfernung auf nah/fern verteilt. */

const TRAFFIC = { cars: [], peds: [], carLOD: null, crowd: null, obs: [] };

function spawnTraffic(scene) {
  const nodes = ROADS.nodes.filter(n => !n.dead && n.adj.length >= 2);
  const NC = 170;
  for (let i = 0; i < NC; i++) {
    let r = null;
    for (let t = 0; t < 10 && !r; t++) { const rt = randomRoute(pick(nodes), 1200, 2600, false); if (rt.len > 700) r = rt; }
    if (!r) continue;
    const p = buildRoadPath(r.seq, 'car');
    const path = new TPath(p.pts, [], { ds: 2 });
    TRAFFIC.cars.push({ path, s: rnd() * path.L, v: 0, vmax: rr(10, 14), blockedT: 0, ignoreT: 0, x: 0, z: 0, yaw: 0 });
  }
  const carAsset = buildCarAsset();
  TRAFFIC.carLOD = new InstancedLOD(scene, carAsset, TRAFFIC.cars.length);
  const cols = [0xf2f2f2, 0x111111, 0x8a8f96, 0xb5b9bf, 0x1d3f7a, 0x8a1515, 0x2d5a3a, 0xc9b28a, 0x3a3f48, 0xd8d8d8, 0x5a0f1a, 0x0f4c75, 0xe0a020, 0xffffff].map(c => lin(c));
  for (const c of TRAFFIC.cars) c.col = pick(cols);

  // Fussgänger
  const NP = 1680; // viermal so viele wie früher
  for (let i = 0; i < NP; i++) {
    const start = pick(nodes);
    const r = randomRoute(start, 250, 800, true);
    if (r.seq.length < 2) continue;
    const p = buildRoadPath(r.seq, 'ped');
    const path = new TPath(p.pts, [], { ds: 2, noSpeed: true });
    const ped = { path, s: rnd() * path.L, v: rr(1.1, 1.6), ph: rnd() * 6, lat: rr(-0.5, 0.5), h: rr(0.92, 1.08) };
    // einige joggen (Hash statt Zufall: die übrige Welt bleibt gleich)
    if (hash2i(i, 991) < 0.06) { ped.run = true; ped.v = 2.6 + hash2i(i, 992) * 0.7; }
    ped.look = crowdLook(i * 7 + 3);
    TRAFFIC.peds.push(ped);
  }
  const shirts = [0x2b4c7e, 0xb03a2e, 0xe8e2d0, 0x2f6f4f, 0x333333, 0xd9a441, 0x6b3fa0, 0x1e90a0, 0xf0f0f0, 0x8a5a3a].map(c => lin(c));
  const pants = [0x1d2633, 0x3a3a3a, 0x4a5a7a, 0x6b5a45, 0x1a1a1a, 0x7a7a72].map(c => lin(c));
  const skin = [0xf1c9a5, 0xe0ac87, 0xc68863, 0x8d5a3b, 0x5c3a24, 0xf5d7bf].map(c => lin(c));
  for (const p of TRAFFIC.peds) { p.shirt = pick(shirts); p.pants = pick(pants); p.skin = pick(skin); }
  // Platz für die Fussgänger plus ruhende Leute (Haltestellen, Bänke …) in der Ferne
  TRAFFIC.crowd = new PedCrowd(scene, buildPedestrianAsset(), TRAFFIC.peds.length + 400);
}

const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _off = new THREE.Vector3();
const _pt = {};
function updateTraffic(dt, camPos) {
  const dtFrame = dt;
  const L = TRAFFIC.carLOD;
  if (!L) return;
  const f = (typeof QUALITY !== 'undefined' && QUALITY.cur && QUALITY.cur.vehScale) || 1;
  const carNear2 = (110 * f) ** 2, pedNear2 = (80 * f) ** 2, pedFar = 450;
  L.begin();
  const fr = TRAFFIC.frame = (TRAFFIC.frame || 0) + 1;
  for (let i = 0; i < TRAFFIC.cars.length; i++) {
    const c = TRAFFIC.cars[i];
    const P = c.path;
    // Weit weg (über 300 m): nur jedes dritte Bild rechnen, dafür mit der aufgelaufenen Zeit
    c.acc = (c.acc || 0) + dtFrame;
    const farC = c.m4 && ((c.x - camPos.x) ** 2 + (c.z - camPos.z) ** 2) > 90000;
    if (farC && (fr + i) % 3 !== 0) { L.add(c.m4, c.col, false); continue; }
    dt = c.acc; c.acc = 0;
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
    const d2 = (_pt.x - camPos.x) ** 2 + (_pt.z - camPos.z) ** 2;
    if (!c.m4) c.m4 = new THREE.Matrix4();
    c.m4.copy(_m4);
    L.add(_m4, c.col, d2 < carNear2);
  }
  dt = dtFrame;
  L.end();
  const C = TRAFFIC.crowd;
  C.begin();
  // Nahe Fussgänger als animierte Figuren (falls die Daten schon geladen sind)
  const SK = (typeof LIFE !== 'undefined' && LIFE.sk && LIFE.on) ? LIFE.sk : null;
  const skNear2 = (42 * f) ** 2, skWalkMax = Math.round(70 * Math.min(1.3, f));
  if (SK) SK.begin();
  for (let i = 0; i < TRAFFIC.peds.length; i++) {
    const p = TRAFFIC.peds[i];
    p.s = (p.s + p.v * dt) % p.path.L;
    p.ph += p.v * dt * 4.2;
    // weit weg: nur weiterzählen, nicht zeichnen (Position vom letzten Mal genügt für den Test)
    if (p.lx !== undefined && (Math.abs(p.lx - camPos.x) > pedFar + 30 || Math.abs(p.lz - camPos.z) > pedFar + 30) && (fr + i) % 8 !== 0) continue;
    p.path.at(p.s, _pt);
    p.lx = _pt.x; p.lz = _pt.z;
    const dx = _pt.x - camPos.x, dz = _pt.z - camPos.z;
    if (Math.abs(dx) > pedFar || Math.abs(dz) > pedFar) continue; // weit weg: nicht zeichnen
    const yaw = Math.atan2(_pt.dx, _pt.dz);
    _q.setFromAxisAngle(_v.set(0, 1, 0), yaw);
    _m4.compose(_off.set(_pt.x + _pt.dz * p.lat, _pt.y - 0.03, _pt.z - _pt.dx * p.lat), _q, _s.set(p.h, p.h, p.h));
    const d2p = dx * dx + dz * dz;
    if (SK && d2p < skNear2 && SK.n < skWalkMax) {
      const S = 1.68 * p.h;
      _m4.compose(_off.set(_pt.x + _pt.dz * p.lat, _pt.y - 0.03, _pt.z - _pt.dx * p.lat), _q, _s.set(S, S, S));
      const cl = p.run ? SK.asset.clips.run : SK.asset.clips.walk;
      if (SK.add(_m4, cl, p.ph / 6.2832 * (p.run ? 0.72 : 1), p.look)) continue;
    }
    C.add(_m4, p.ph, p.shirt, p.pants, p.skin, d2p < pedNear2);
  }
  if (typeof updateLife === 'function') updateLife(dt, camPos, C, SK);
  if (SK) SK.end();
  C.end();
}

/* Hindernisse dieses Frames: Autos und Spieler */
function trafficObstacles(px, pz, playerActive) {
  const list = TRAFFIC.obs; list.length = 0;
  for (const c of TRAFFIC.cars) { if (!c.obj) c.obj = { r: 2.3 }; c.obj.x = c.x; c.obj.z = c.z; c.obj.yaw = c.yaw; c.obj.veh = c; list.push(c.obj); }
  if (playerActive) list.push({ x: px, z: pz, r: 0.4, player: true });
  return list;
}
