/* ================= ASSET: SPIELFIGUREN (Mensch, Drache) =================
   Beide Figuren sind aus Grundkörpern gebaut und pro beweglichem Teil (Rumpf, Arme, Beine,
   Flügel, Schwanz) zu je einem Mesh zusammengefasst (Farben über Vertexfarben).
   Blickrichtung ist lokal -z, die Füsse stehen auf y = 0.
   animateCharacter() bewegt die Teile je nach Zustand: stehen, gehen, flattern, gleiten. */

const CHAR = { mats: null, geo: {} };

function charMats() {
  if (CHAR.mats) return CHAR.mats;
  // Bauchplatten: cremefarben mit feinen Querlinien
  const cv = makeCanvas(256, 256), ctx = cv.getContext('2d');
  ctx.fillStyle = '#f4ead1'; ctx.fillRect(0, 0, 256, 256);
  const g = ctx.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(200,170,130,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(200,170,130,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(150,120,90,0.55)'; ctx.lineWidth = 2;
  for (let y = 30; y < 236; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(128, y + 7, 256, y); ctx.stroke(); }
  const bt = canvasTex(cv);
  CHAR.mats = {
    skin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0 }),
    belly: new THREE.MeshStandardMaterial({ map: bt, roughness: 0.7 }),
    wing: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, side: THREE.DoubleSide }),
    cloth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })
  };
  return CHAR.mats;
}

/* Grundkörper mit Lage, Drehung, Skalierung in einen Baukasten */
const _cm = new THREE.Matrix4(), _cq = new THREE.Quaternion(), _ce = new THREE.Euler(), _cp = new THREE.Vector3(), _cs = new THREE.Vector3();
function cgeo(key, make) { return CHAR.geo[key] || (CHAR.geo[key] = make()); }
function prim(mb, geo, x, y, z, sx, sy, sz, col, rx, ry, rz) {
  _ce.set(rx || 0, ry || 0, rz || 0); _cq.setFromEuler(_ce);
  _cm.compose(_cp.set(x, y, z), _cq, _cs.set(sx, sy, sz));
  mb.addGeom(geo, _cm, col);
}
const SPH = () => cgeo('sph', () => new THREE.SphereGeometry(1, 22, 16));
const SPHs = () => cgeo('sphs', () => new THREE.SphereGeometry(1, 10, 8));
const CYL = () => cgeo('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 14));
const CONE = () => cgeo('cone', () => new THREE.ConeGeometry(1, 1, 12));
function sph(mb, r, x, y, z, sx, sy, sz, col, rx, ry, rz, small) { prim(mb, small ? SPHs() : SPH(), x, y, z, r * sx, r * sy, r * sz, col, rx, ry, rz); }
/* Zylinder/Kegel zwischen zwei Punkten */
function limb(mb, geo, a, b, r0, r1, col) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
  const g = geo === 'cone' ? CONE() : new THREE.CylinderGeometry(r1, r0, 1, 14);
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  _cq.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const sc = geo === 'cone' ? _cs.set(r0, len, r0) : _cs.set(1, len, 1);
  _cm.compose(_cp.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _cq, sc);
  mb.addGeom(g, _cm, col);
}
/* Schlauch mit abnehmender Dicke entlang einer Kurve (Schwanz) */
function taperTube(points, r0, r1, seg) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, seg, 1, 12, false);
  const pos = g.attributes.position, rad = 13;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, c = curve.getPointAt(t), r = lerp(r0, r1, Math.pow(t, 0.9));
    for (let j = 0; j < rad; j++) {
      const k = i * rad + j;
      pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * r, c.y + (pos.getY(k) - c.y) * r, c.z + (pos.getZ(k) - c.z) * r);
    }
  }
  g.computeVertexNormals();
  return g;
}
function partMesh(mb, mat, cast) { const m = new THREE.Mesh(mb.build(), mat); m.castShadow = cast !== false; m.receiveShadow = true; return m; }
function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

/* ---------- Mensch ---------- */
function buildHumanModel() {
  const M = charMats();
  const skin = lin(0xe9bf9a), shirt = lin(0x2f5fa8), pants = lin(0x23262b), shoe = lin(0x111111), hair = lin(0x3a2618), dark = lin(0x111111);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mb = new MB();
  prim(mb, new THREE.CylinderGeometry(0.2, 0.17, 0.62, 12), 0, 1.22, 0, 1, 1, 1, shirt);
  sph(mb, 0.2, 0, 1.5, 0, 1.1, 0.5, 0.75, shirt);
  prim(mb, CYL(), 0, 1.6, 0, 0.06, 0.1, 0.06, skin);
  sph(mb, 0.13, 0, 1.73, 0, 1, 1.15, 1.05, skin);
  prim(mb, new THREE.SphereGeometry(0.135, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.76, 0, 1, 1, 1, hair);
  sph(mb, 0.025, 0.045, 1.75, -0.12, 1, 1, 1, dark, 0, 0, 0, true); sph(mb, 0.025, -0.045, 1.75, -0.12, 1, 1, 1, dark, 0, 0, 0, true);
  body.add(partMesh(mb, M.cloth));
  const mkLimb = (x, y, len, r, col, foot) => {
    const pv = pivot(body, x, y, 0), m = new MB();
    prim(m, new THREE.CylinderGeometry(r, r * 0.85, len, 10), 0, -len / 2, 0, 1, 1, 1, col);
    if (foot) prim(m, new THREE.BoxGeometry(0.11, 0.08, 0.26), 0, -len - 0.02, -0.05, 1, 1, 1, shoe);
    else sph(m, 0.05, 0, -len - 0.03, 0, 1, 1, 1, skin, 0, 0, 0, true);
    pv.add(partMesh(m, M.cloth)); return pv;
  };
  const legL = mkLimb(0.1, 0.92, 0.86, 0.075, pants, true), legR = mkLimb(-0.1, 0.92, 0.86, 0.075, pants, true);
  const armL = mkLimb(0.26, 1.48, 0.62, 0.05, shirt), armR = mkLimb(-0.26, 1.48, 0.62, 0.05, shirt);
  root.userData = { kind: 'human', body, legL, legR, armL, armR, ph: 0, eye: 1.68, camDist: 4.0 };
  return root;
}

/* ---------- Drache ---------- */
function buildDragonModel() {
  const M = charMats();
  const RED = lin(0xd8323b), RED2 = lin(0xc42a33), CREAM = lin(0xf3ead3), HORN = lin(0xf1e8d6), SPOT = lin(0xef8a3c),
    WHITE = lin(0xffffff), IRIS = lin(0xb3121c), PUPIL = lin(0x140507), MOUTH = lin(0x5e1216), WINGC = lin(0xdde1e6), BONE = lin(0xaeb4bb), CLAW = lin(0xf5efe4);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  // Rumpf und Kopf
  const mb = new MB();
  sph(mb, 0.46, 0, 0.98, 0.03, 1, 1.32, 0.88, RED);
  prim(mb, new THREE.CylinderGeometry(0.15, 0.2, 0.42, 16), 0, 1.6, 0.0, 1, 1, 1, RED, 0.12);
  sph(mb, 0.16, 0, 1.56, -0.1, 1.05, 1.45, 0.8, CREAM);
  sph(mb, 0.27, 0, 1.98, -0.04, 1, 1.0, 0.96, RED);                    // Schädel
  sph(mb, 0.07, 0.11, 2.15, -0.2, 1.15, 0.55, 0.9, RED2); sph(mb, 0.07, -0.11, 2.15, -0.2, 1.15, 0.55, 0.9, RED2); // Brauen
  sph(mb, 0.24, 0, 1.86, -0.27, 1.22, 0.72, 1.06, RED);                // Schnauze
  sph(mb, 0.2, 0, 1.775, -0.31, 1.16, 0.26, 0.98, MOUTH);              // Maul
  sph(mb, 0.21, 0, 1.70, -0.23, 1.12, 0.55, 1.0, CREAM);               // Unterkiefer
  for (const s of [1, -1]) {
    sph(mb, 0.026, s * 0.07, 1.94, -0.47, 1, 0.7, 1, PUPIL, 0, 0, 0, true);                      // Nasenloch
    for (const [x, y, z] of [[0.17, 1.86, -0.38], [0.2, 1.83, -0.32], [0.15, 1.81, -0.42]]) sph(mb, 0.017, s * x, y, z, 1, 1, 0.5, SPOT, 0, 0, 0, true);
    sph(mb, 0.085, s * 0.105, 2.07, -0.26, 1, 1.3, 0.75, WHITE);         // Auge
    sph(mb, 0.05, s * 0.105, 2.06, -0.318, 1, 1.25, 0.55, IRIS);
    sph(mb, 0.028, s * 0.105, 2.06, -0.345, 1, 1.2, 0.5, PUPIL, 0, 0, 0, true);
    sph(mb, 0.012, s * 0.09, 2.09, -0.355, 1, 1, 1, WHITE, 0, 0, 0, true);
    prim(mb, CONE(), s * 0.12, 2.32, 0.06, 0.055, 0.28, 0.055, HORN, 0.45, 0, -s * 0.28); // Horn
    for (const [x, y, z] of [[0.43, 1.15, -0.05], [0.44, 0.98, 0.05], [0.41, 0.82, -0.02], [0.38, 1.3, 0.1], [0.4, 0.72, 0.12]]) sph(mb, 0.028, s * x, y, z, 0.5, 1, 1, SPOT, 0, 0, 0, true);
  }
  body.add(partMesh(mb, M.skin));
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.43, 24, 18), M.belly);
  belly.position.set(0, 0.93, -0.165); belly.scale.set(0.8, 1.18, 0.62); belly.castShadow = true;
  body.add(belly);
  // Arme (in T-Haltung gebaut, entlang ±x; Ruhehaltung über die Drehung)
  const mkArm = (s) => {
    const pv = pivot(body, s * 0.38, 1.3, -0.04), m = new MB();
    limb(m, 'cyl', [0, 0, 0], [s * 0.3, 0, 0], 0.085, 0.07, RED);
    sph(m, 0.075, s * 0.3, 0, 0, 1, 1, 1, RED);
    limb(m, 'cyl', [s * 0.3, 0, 0], [s * 0.55, 0, -0.02], 0.07, 0.055, RED);
    sph(m, 0.065, s * 0.6, 0, -0.02, 1.2, 0.6, 1.1, RED);
    for (const dz of [-0.05, 0, 0.05]) limb(m, 'cone', [s * 0.64, 0, -0.02 + dz], [s * 0.76, -0.01, -0.02 + dz * 1.6], 0.025, 0, RED);
    for (const x of [0.12, 0.22, 0.42]) sph(m, 0.022, s * x, 0.07, 0, 1, 0.45, 1, SPOT, 0, 0, 0, true);
    pv.add(partMesh(m, M.skin)); return pv;
  };
  const armL = mkArm(1), armR = mkArm(-1);
  // Beine
  const mkLeg = (s) => {
    const pv = pivot(body, s * 0.21, 0.62, 0.02), m = new MB();
    sph(m, 0.2, s * 0.02, -0.08, 0.02, 0.95, 1.25, 1.1, RED);
    limb(m, 'cyl', [0, -0.25, 0.04], [0, -0.52, 0.0], 0.1, 0.085, RED);
    sph(m, 0.13, 0, -0.58, -0.06, 1.1, 0.42, 1.55, RED);
    for (const dx of [-0.065, 0, 0.065]) { sph(m, 0.045, dx, -0.59, -0.24, 0.9, 0.7, 1.2, RED, 0, 0, 0, true); limb(m, 'cone', [dx, -0.6, -0.28], [dx, -0.61, -0.33], 0.018, 0, CLAW); }
    for (const [x, y, z] of [[0.17, -0.02, -0.1], [0.19, -0.15, -0.02], [0.08, -0.4, -0.08]]) sph(m, 0.024, s * x, y, z, 0.5, 1, 1, SPOT, 0, 0, 0, true);
    pv.add(partMesh(m, M.skin)); return pv;
  };
  const legL = mkLeg(1), legR = mkLeg(-1);
  // Schwanz (nach hinten = +z)
  const tail = pivot(body, 0, 0.52, 0.32);
  const tm = new MB();
  tm.addGeom(taperTube([[0, 0.04, -0.06], [0, -0.16, 0.3], [0, -0.3, 0.68], [0.05, -0.24, 1.0], [0.12, -0.08, 1.22]], 0.18, 0.035, 24), new THREE.Matrix4(), RED);
  for (const [y, z] of [[-0.12, 0.25], [-0.27, 0.6], [-0.24, 0.92]]) sph(tm, 0.026, 0.12 - z * 0.05, y + 0.06, z, 0.6, 1, 1, SPOT, 0, 0, 0, true);
  tail.add(partMesh(tm, M.skin));
  // Flügel: Fledermausflügel mit drei Fingern und gewellter Hinterkante
  const shape = new THREE.Shape();
  const F1 = [1.04, 0.8], F2 = [1.0, 0.1], F3 = [0.62, -0.16];
  shape.moveTo(0, 0.08); shape.lineTo(0.12, 0.3);
  shape.quadraticCurveTo(0.42, 0.66, 0.66, 0.68); shape.lineTo(F1[0], F1[1]);
  shape.quadraticCurveTo(0.84, 0.42, F2[0], F2[1]);
  shape.quadraticCurveTo(0.78, 0.06, F3[0], F3[1]);
  shape.quadraticCurveTo(0.36, 0.0, 0.02, -0.12);
  shape.closePath();
  const memb = new THREE.ShapeGeometry(shape, 10);
  const wm = new MB();
  wm.addGeom(memb, new THREE.Matrix4(), WINGC);
  const W0 = [0.06, 0.16, 0], WR = [0.66, 0.66, 0];
  limb(wm, 'cyl', [0.0, 0.1, 0], W0, 0.04, 0.035, RED);
  limb(wm, 'cyl', W0, WR, 0.035, 0.026, BONE);
  for (const F of [F1, F2, F3]) limb(wm, 'cyl', WR, [F[0], F[1], 0], 0.02, 0.008, BONE);
  sph(wm, 0.035, WR[0], WR[1], 0, 1, 1, 1, BONE, 0, 0, 0, true);
  limb(wm, 'cone', [WR[0], WR[1], 0], [WR[0] + 0.03, WR[1] + 0.09, 0], 0.025, 0, CLAW);
  const wingGeo = wm.build();
  const mkWing = (s) => {
    const pv = pivot(body, s * 0.14, 1.38, 0.3);
    const inner = new THREE.Group(); pv.add(inner);
    const mesh = new THREE.Mesh(wingGeo, M.wing); mesh.castShadow = true; mesh.receiveShadow = true;
    inner.add(mesh); inner.scale.x = s;
    return pv;
  };
  const wingL = mkWing(1), wingR = mkWing(-1);
  root.userData = { kind: 'dragon', body, legL, legR, armL, armR, wingL, wingR, tail, belly, ph: 0, flap: 0, eye: 1.95, camDist: 5.5,
    pose: { armZ: 1.05, armX: 0, legX: 0, wingY: -1.0, wingZ: 0.3, pitch: 0 } };
  animateCharacter(root, 0, { moving: false });
  return root;
}

/* ---------- Animation ----------
   st: { moving, run, flying, flapping } */
function animateCharacter(model, dt, st) {
  const u = model.userData;
  const speed = st.moving ? (st.run ? 13 : 9) : 0;
  u.ph += dt * (st.flying ? 0 : speed);
  const sw = st.moving && !st.flying ? Math.sin(u.ph) * 0.6 : 0;
  if (u.kind === 'human') {
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw * 0.8; u.armR.rotation.x = sw * 0.8;
    return;
  }
  // Drache: Zielhaltung je nach Zustand, weich überblendet
  const p = u.pose, k = Math.min(1, dt * 6);
  const T = st.flying
    ? { armZ: 0.55, armX: -0.5, legX: 0.75, wingY: -0.18, wingZ: st.flapping ? 0.15 : 0.32, pitch: st.moving ? -0.3 : -0.08 }
    : { armZ: 1.05, armX: 0, legX: 0, wingY: -1.0, wingZ: 0.3, pitch: 0 };
  for (const key in T) p[key] += (T[key] - p[key]) * k;
  u.flap += dt * (st.flapping ? 11 : st.flying ? 1.5 : 1.2);
  const flapA = st.flying ? (st.flapping ? Math.sin(u.flap) * 0.75 : Math.sin(u.flap) * 0.06) : Math.sin(u.flap) * 0.03;
  u.wingL.rotation.set(0, p.wingY, p.wingZ + flapA);
  u.wingR.rotation.set(0, -p.wingY, -(p.wingZ + flapA));
  u.armL.rotation.set(p.armX + (st.flying ? 0 : -sw * 0.4), 0, -p.armZ);
  u.armR.rotation.set(p.armX + (st.flying ? 0 : sw * 0.4), 0, p.armZ);
  u.legL.rotation.x = p.legX + sw * 0.75; u.legR.rotation.x = p.legX - sw * 0.75;
  u.tail.rotation.y = Math.sin(u.flap * 0.35 + u.ph * 0.25) * (st.moving ? 0.3 : 0.15);
  u.tail.rotation.x = st.flying ? -0.25 : 0;
  u.body.rotation.x = p.pitch;
  const bob = st.moving && !st.flying ? Math.abs(Math.sin(u.ph)) * 0.05 : (st.flying ? Math.sin(u.flap) * 0.05 : 0);
  u.body.position.y = bob;
  const br = 1 + Math.sin(u.flap * 0.8) * 0.012;
  u.belly.scale.set(0.8 * br, 1.18, 0.62 * br);
}

/* Statistik für die Asset-Testseite */
function characterStats(model) {
  let tris = 0, calls = 0;
  model.traverse(o => { if (o.isMesh) { calls++; tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } });
  return { tris: Math.round(tris), calls };
}
