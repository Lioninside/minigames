/* ================= FAHRZEUGE =================
   Autonome Fahrt der Linienfahrzeuge entlang ihrer Pfade, 10 Sekunden Halt mit offenen Türen,
   Hindernis-Erkennung. Die Modelle selbst liegen als Assets in js/assets/ (Bus, Tram, U-Bahn)
   und bringen drei Detailstufen mit; hier wird nur zwischen ihnen umgeschaltet. */

const VEH = { list: [], assets: null, obstacles: new SHash(25) };

/* ---------- Fahrzeug ---------- */
class Vehicle {
  constructor(kind, line, path, stops, opts) {
    this.kind = kind; this.line = line; this.path = path; this.stops = stops;
    this.vmax = opts.vmax; this.acc = opts.acc || 1.1; this.dec = opts.dec || 1.4;
    this.cars = [];
    this.s = opts.s0 || 0; this.v = 0; this.state = 'drive'; this.dwell = 0; this.dwellT = 0; this.door = 0;
    this.blockedT = 0; this.ignoreT = 0; this.label = opts.label || ''; this.dest = '';
    this.group = new THREE.Group();
    this.visibleFar = opts.visibleFar || 380;
    const assets = opts.assets;
    let z = 0;
    const gap = opts.gap || 0.8;
    this.totalLen = assets.reduce((a, t) => a + t.len, 0) + gap * (assets.length - 1);
    for (let i = 0; i < assets.length; i++) {
      const t = assets[i];
      const inst = instantiateAsset(t, { signMat: opts.signMat, front: i === 0, level: 'far' });
      const g = inst.g;
      this.group.add(g);
      const offset = this.totalLen / 2 - t.len / 2 - z;
      z += t.len + gap;
      this.cars.push({ g, inst, asset: t, offset, doors: t.doors, hw: t.hw, hl: t.len / 2, floorY: t.floorY, roofY: t.roofY, veh: this, idx: i });
    }
    this.nextStop = 0;
    this.syncNextStop();
    this.place();
  }
  syncNextStop() {
    if (!this.stops.length) return;
    const L = this.path.L;
    let best = 0, bd = 1e18;
    for (let i = 0; i < this.stops.length; i++) { const d = ((this.stops[i].s - this.s) % L + L) % L; if (d < bd) { bd = d; best = i; } }
    this.nextStop = best;
  }
  doorSide() { return this.kind === 'metro' ? 1 : -1; }
  currentStop() { return this.stops.length ? this.stops[this.nextStop] : null; }
  update(dt, obstacleFn) {
    const L = this.path.L;
    if (this.state === 'dwell') {
      this.dwell -= dt; this.dwellT += dt;
      const target = (this.dwellT > 0.5 && this.dwell > 1.7) ? 1 : 0;
      if (target === 0 && this.door > 0.99 && this.onDoorsClose) this.onDoorsClose(this);
      this.door = clamp(this.door + (target ? dt : -dt) / 1.1, 0, 1);
      if (this.dwell <= 0 && this.door <= 0.001) {
        this.state = 'drive';
        this.nextStop = (this.nextStop + 1) % this.stops.length;
      }
    } else {
      let vt = Math.min(this.vmax, this.path.speedAt(this.s + this.v * 1.5));
      let dist = 1e9;
      if (this.stops.length) {
        dist = ((this.stops[this.nextStop].s - this.s) % L + L) % L;
        if (dist > L - 3) dist = 0;
        vt = Math.min(vt, Math.sqrt(2 * this.dec * Math.max(0, dist - 0.05)) + 0.3);
      }
      if (obstacleFn) {
        const blocked = obstacleFn(this);
        if (blocked && this.ignoreT <= 0) { vt = 0; this.blockedT += dt; if (this.blockedT > 7 && blocked !== 'player') { this.ignoreT = 4; this.blockedT = 0; } }
        else this.blockedT = 0;
        if (this.ignoreT > 0) this.ignoreT -= dt;
      }
      if (vt > this.v) this.v = Math.min(vt, this.v + this.acc * dt);
      else this.v = Math.max(vt, this.v - 3.0 * dt);
      const ds = this.v * dt;
      if (this.stops.length && dist <= ds + 0.15 && dist < 2.5) {
        this.s = this.stops[this.nextStop].s; this.v = 0;
        this.state = 'dwell'; this.dwell = 10; this.dwellT = 0;
        if (this.onArrive) this.onArrive(this);
      } else this.s = (this.s + ds) % L;
    }
  }
  place() {
    const P = this.path;
    const f = {}, r = {};
    for (const c of this.cars) {
      const sc = this.s + c.offset;
      P.at(sc + c.hl * 0.62, f); P.at(sc - c.hl * 0.62, r);
      const x = (f.x + r.x) / 2, y = (f.y + r.y) / 2, z = (f.z + r.z) / 2;
      c.g.position.set(x, y, z);
      c.g.rotation.y = Math.atan2(f.x - r.x, f.z - r.z);
      c.g.rotation.x = -Math.atan2(f.y - r.y, Math.hypot(f.x - r.x, f.z - r.z));
      c.inst.setDoors(this.door, this.doorSide());
      c.g.updateMatrixWorld(true);
    }
  }
  /* Spieler-Kollision und Einsteigen: Weltpunkt -> lokale Koordinaten eines Wagens */
  toLocal(c, x, y, z) {
    const g = c.g;
    const dx = x - g.position.x, dz = z - g.position.z;
    const yaw = g.rotation.y, cs = Math.cos(yaw), sn = Math.sin(yaw);
    return [dx * cs - dz * sn, y - g.position.y, dx * sn + dz * cs];
  }
  toWorld(c, lx, ly, lz) {
    const g = c.g;
    const yaw = g.rotation.y, cs = Math.cos(yaw), sn = Math.sin(yaw);
    return [g.position.x + lx * cs + lz * sn, g.position.y + ly, g.position.z - lx * sn + lz * cs];
  }
  doorAt(c, lz, sideSign) {
    if (this.door < 0.75) return null;
    for (const d of c.doors) if (d.side === sideSign && d.side === this.doorSide() && Math.abs(lz - d.zc) < d.half - 0.15) return d;
    return null;
  }
}

/* ---------- Erzeugung aller Linienfahrzeuge ---------- */
function spawnTransitVehicles(scene) {
  initAssetMats();
  const bus = ASSETS.list.bus || buildBusAsset();
  const tram = ASSETS.list.tram || buildTramAsset();
  const tubeF = ASSETS.list.tube_front || buildTubeAsset('front'), tubeM = ASSETS.list.tube_none || buildTubeAsset('none'), tubeR = ASSETS.list.tube_rear || buildTubeAsset('rear');
  VEH.assets = { bus, tram, tubeF, tubeM, tubeR };
  for (const line of TRANSIT.busLines) {
    const n = line.path.L > 6000 ? 3 : 2;
    const sign = destTex(line.num, line.terminusB || 'Rundkurs', line.color);
    for (let k = 0; k < n; k++) {
      const v = new Vehicle('bus', line, line.path, line.stopList, { vmax: 12.5, acc: 1.2, dec: 1.4, s0: line.path.L * k / n, assets: [bus], signMat: sign, label: 'Bus ' + line.num, visibleFar: 800 });
      scene.add(v.group); VEH.list.push(v);
    }
  }
  if (TRANSIT.tram) {
    const T = TRANSIT.tram;
    const sign = destTex(6, 'ETH / Venezia', '#ffffff');
    for (let k = 0; k < 3; k++) {
      const v = new Vehicle('tram', { num: 6, color: '#1b5db5', name: 'Tram 6' }, T.path, T.stopList, { vmax: 11, acc: 0.9, dec: 1.1, s0: T.path.L * k / 3, assets: [tram], signMat: sign, label: 'Tram 6', visibleFar: 800 });
      scene.add(v.group); VEH.list.push(v);
    }
  }
  for (const line of TRANSIT.metro) {
    const n = 3;
    const sign = destTex(line.name, line.stations[line.stations.length - 1].name, line.color);
    for (let k = 0; k < n; k++) {
      const v = new Vehicle('metro', line, line.path, line.stopList, { vmax: 19, acc: 1.1, dec: 1.2, s0: line.path.L * k / n, assets: [tubeF, tubeM, tubeM, tubeR], gap: 0.7, signMat: sign, label: line.name, visibleFar: 450 });
      v.underground = true;
      TRANSIT.ugGroup.add(v.group); VEH.list.push(v);
    }
  }
}

/* Alle Hindernisse (Fahrzeuge, Autos, Spieler) in den Hash */
function rebuildObstacles(extra) {
  const H = VEH.obstacles;
  H.m.clear();
  for (const v of VEH.list) {
    if (v.kind === 'metro') continue;
    const c = v.cars[0];
    const p = c.g.position;
    const o = { x: p.x, z: p.z, r: c.hl, veh: v, yaw: c.g.rotation.y };
    H.insert(o, p.x - c.hl, p.z - c.hl, p.x + c.hl, p.z + c.hl);
  }
  if (extra) for (const o of extra) H.insert(o, o.x - o.r, o.z - o.r, o.x + o.r, o.z + o.r);
}

/* Steht etwas vor dem Fahrzeug? Gibt 'player', true oder false zurück. */
function obstacleAhead(v, px, pz, dx, dz, hl, range, selfObj) {
  let hit = false;
  const H = VEH.obstacles;
  const cx = px + dx * (hl + range / 2), cz = pz + dz * (hl + range / 2);
  const R = range / 2 + 3;
  H.query(cx - R, cz - R, cx + R, cz + R, (o) => {
    if (o.veh === v || o === selfObj) return;
    const rx = o.x - px, rz = o.z - pz;
    const along = rx * dx + rz * dz;
    const lat = Math.abs(rx * dz - rz * dx);
    const orr = o.player ? 0.4 : Math.min(o.r, 3);
    if (along > hl * 0.5 && along < hl + range + orr && lat < 1.5 + (o.player ? 0.5 : 1.0)) {
      // Gegenverkehr ignorieren (fährt entgegen und nicht in der eigenen Spur)
      if (o.yaw !== undefined && !o.player) {
        const odx = Math.sin(o.yaw), odz = Math.cos(o.yaw);
        if (odx * dx + odz * dz < -0.5) return;
      }
      hit = o.player ? 'player' : true;
      if (o.player) return true;
    }
  });
  return hit;
}

function updateTransit(dt, camPos, underground, playerObs) {
  for (const v of VEH.list) {
    const c = v.cars[0];
    const fn = v.kind === 'metro' ? null : (veh) => {
      const p = c.g.position;
      const range = Math.max(5, veh.v * veh.v / (2 * 2.5) + 4);
      return obstacleAhead(veh, p.x, p.z, Math.sin(c.g.rotation.y), Math.cos(c.g.rotation.y), c.hl, range, null);
    };
    v.update(dt, fn);
    const p = c.g.position;
    const d = Math.hypot(p.x - camPos.x, p.z - camPos.z);
    const vis = v.underground ? (underground && d < v.visibleFar) : d < v.visibleFar;
    v.group.visible = !!(vis || v.riding);
    if (vis || v.riding) {
      // Detailstufe pro Wagen (lange Züge: vorne nah, hinten schon mittel)
      for (const car of v.cars) {
        const cp = car.g.position;
        car.inst.setLOD(vehicleLODLevel(Math.hypot(cp.x - camPos.x, cp.z - camPos.z), v.riding));
      }
      v.place();
    }
    else { // Position grob aktualisieren für Hindernisse
      const P = v.path.at(v.s);
      c.g.position.set(P.x, P.y, P.z); c.g.rotation.y = Math.atan2(P.dx, P.dz);
    }
  }
}
