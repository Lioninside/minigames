/* ================= SPIELER =================
   Ego-Perspektive (V schaltet auf Verfolgerkamera), Pfeiltasten: vor/zurück und drehen,
   Leertaste springt. Kollision mit Gebäuden, Bäumen, Fahrzeugen, U-Bahn-Stationen,
   Mitfahren in Bus/Tram/U-Bahn, Gebäude betreten (E) und Lift (L). */

const STEP = 0.65, PR = 0.33, EYE = 1.68, GRAV = 22, JUMP = 7.4;
const P = { x: 0, y: 3, z: 0, vy: 0, yaw: 0, pitch: 0, onGround: true, ride: null, swim: false, underground: false, bob: 0, third: false, moving: false, char: 'human', flying: false, flapping: false };
const DRAGON = { climb: 6.5, flapAcc: 20, glideSink: 3.2, airSpeed: 10, airRun: 19, ceiling: 420 };
/* Raketenmodus des Drachen (Taste R): Reiseflug, Turbo, Bremsen in m/s */
const ROCKET = { cruise: 70, turbo: 170, slow: 22, acc: 42, turn: 1.45, climb: 32, ceiling: 900, launch: 22, bound: 2700 };
const GAME = { mode: 'world', hour: 9.5, timeScale: 1, paused: true, started: false };
const KEYS = {};
const ELEV = { state: 'none', t: 0, ctx: null, b: null, floor: 0, target: 0, from: null, to: null, dur: 0, startYaw: 0 };
let ROOFCAB = null, ROOFCAB_B = null;

/* ---------- Bodenhöhe ---------- */
function stationsNear(x, z, fn) {
  for (const st of TRANSIT.stations) {
    if (Math.abs(st.x - x) > 110 || Math.abs(st.z - z) > 110) continue;
    const l = stWorldToLocal(st, x, z);
    fn(st, l[0], l[1]);
  }
}
function boxSurf(box, x, z) {
  if (!box.hip) return box.top;
  const l = obbLocal(box.obb, x, z);
  const e = Math.min(box.obb.hw - Math.abs(l[0]), box.obb.hd - Math.abs(l[1])) + 0.45;
  return box.top - box.hipH + box.hipH * clamp(e / box.hip, 0, 1);
}
function groundAt(x, z, y) {
  let inHole = false;
  let g = -50;
  const cand = (h) => { if (h <= y + STEP && h > g) g = h; };
  stationsNear(x, z, (st, lx, lz) => {
    if (Math.abs(lx) < 2.4 && lz > st.aTop - 5.8 && lz < st.aTop + 0.05) inHole = true;
    if (Math.abs(lx) <= 2.35 && lz >= st.aBot - 0.05 && lz <= st.aTop + 0.05) cand(clamp(st.platY + (lz - st.aBot) / 1.7320508, st.platY, st.surfY));
    if (Math.abs(lz) <= M.SL && Math.abs(lx) <= M.WALL) cand(Math.abs(lx) <= M.PW ? st.platY : st.trackY + 0.02);
  });
  // Fussgängertunnel und Stationslift (vor dem Gelände-Ersatzwert prüfen)
  if (hubTunnelBand(y) && inHubTunnel(x, z, 0)) cand(HUB.TUN_Y);
  { const o = liftAt(x, z, y, 0); if (o) cand(o.cabY); }
  if (!inHole) {
    const wd = waterDist(x, z);
    cand(wd < -0.5 ? -2.2 : terrainH(x, z));
    if (g === -50) g = wd < -0.5 ? -2.2 : terrainH(x, z) - 30; // unter dem Gelände: nicht hochspringen
  }
  ROADS.deckHash.query(x - 0.5, z - 0.5, x + 0.5, z + 0.5, (d) => {
    const l = deckLocal(d, x, z);
    if (l[0] < d.a0 || l[0] > d.a1 || Math.abs(l[1]) > d.hw + 0.05) return;
    cand(d.h(l[0]));
  });
  BLD.hash.query(x - 0.5, z - 0.5, x + 0.5, z + 0.5, (box) => {
    if (!obbContains(box.obb, x, z, 0)) return;
    cand(boxSurf(box, x, z));
  });
  for (const f of NAT.fountains) if (Math.hypot(f.x - x, f.z - z) < f.r) cand(f.top);
  return g;
}

/* ---------- Horizontale Kollision ---------- */
function collideWorld(x, z, y, px, pz) {
  // Fussgängertunnel Hönggerberg: nur innerhalb der Gänge, keine Gebäude darüber
  if (hubTunnelBand(y) && inHubTunnel(px, pz, 0)) return hubTunnelClamp(x, z, px, pz);
  // Gebäude
  BLD.hash.query(x - 1.5, z - 1.5, x + 1.5, z + 1.5, (box) => {
    if (box.bottom !== undefined && y + 1.75 < box.bottom) return;
    const solidTop = box.hip ? box.top - box.hipH * 0.5 : box.top;
    if (y + STEP >= solidTop && box.bottom === undefined) return;
    if (box.bottom !== undefined && y >= box.top - 0.1) return;
    const p = obbPushCircle(box.obb, x, z, PR);
    if (p) { x = p[0]; z = p[1]; }
  });
  // Pavillons der U-Bahn
  stationsNear(x, z, (st, lx, lz) => {
    for (const w of (st.pavWalls || [])) {
      if (y > w.top || y + 1.8 < st.surfY - 0.3) continue;
      const p = obbPushCircle(w.obb, x, z, PR); if (p) { x = p[0]; z = p[1]; }
    }
  });
  // Bäume
  NAT.treeHash.query(x - 1, z - 1, x + 1, z + 1, (t) => {
    const dx = x - t.x, dz = z - t.z, d = Math.hypot(dx, dz), r = t.r + PR;
    if (d < r && d > 1e-4 && y < terrainH(t.x, t.z) + 4) { x = t.x + dx / d * r; z = t.z + dz / d * r; }
  });
  // Brunnenrand
  for (const f of NAT.fountains) {
    const dx = x - f.x, dz = z - f.z, d = Math.hypot(dx, dz);
    if (y + STEP < f.top && d < f.r + PR && d > 1e-4) { x = f.x + dx / d * (f.r + PR); z = f.z + dz / d * (f.r + PR); }
  }
  // Brückengeländer
  ROADS.deckHash.query(x - 0.5, z - 0.5, x + 0.5, z + 0.5, (d) => {
    if (!d.rails) return;
    const lp = deckLocal(d, px, pz), l = deckLocal(d, x, z);
    if (lp[0] < d.rails[0] || lp[0] > d.rails[1] || Math.abs(lp[1]) > d.hw) return;
    if (Math.abs(y - d.h(lp[0])) > 1.0) return;
    if (Math.abs(l[1]) > d.hw - PR) {
      const lc = Math.sign(l[1]) * (d.hw - PR);
      x = d.ox + d.dx * l[0] + d.dz * lc; z = d.oz + d.dz * l[0] - d.dx * lc;
    }
  });
  // Stationen und Treppenschacht
  stationsNear(x, z, (st, lx, lz) => {
    let clx = lx, clz = lz, ch = false;
    const inStation = Math.abs(lz) < M.SL + 1 && Math.abs(lx) < M.WALL + 1 && y < st.ceilY - 0.5;
    if (inStation) {
      if (Math.abs(clx) > M.WALL - PR) { clx = Math.sign(clx) * (M.WALL - PR); ch = true; }
      if (Math.abs(clz) > M.SL - PR) { clz = Math.sign(clz) * (M.SL - PR); ch = true; }
      for (const c of (st.columns || [])) { const dx = clx - c[0], dz = clz - c[1], d = Math.hypot(dx, dz); if (d < 0.35 + PR && d > 1e-4) { clx = c[0] + dx / d * (0.35 + PR); clz = c[1] + dz / d * (0.35 + PR); ch = true; } }
    } else if (y < st.surfY - 0.4 && y > st.ceilY - 1.0 && lz > st.aBot && lz < st.aTop + 0.5 && Math.abs(lx) < 3) {
      if (Math.abs(clx) > 2.3 - PR) { clx = Math.sign(clx) * (2.3 - PR); ch = true; }
      if (clz < st.aTop - 5.6 && y > st.surfY - 3.2) { /* Kopfhöhe unter dem Pavillon */ }
    }
    if (ch) { const w = stLocalToWorld(st, clx, clz); x = w[0]; z = w[1]; }
  });
  x = clamp(x, -2490, 2490); z = clamp(z, -2490, 2490);
  return [x, z];
}

/* ---------- Fahrzeuge: Kollision und Einsteigen ---------- */
function vehicleInteract(x, z, y, moving) {
  for (const v of VEH.list) {
    const vu = !!v.underground;
    if (vu !== P.underground && !(vu && y < -2)) continue;
    const c0 = v.cars[0].g.position;
    if (Math.abs(c0.x - x) > 60 || Math.abs(c0.z - z) > 60) continue;
    for (const c of v.cars) {
      const l = v.toLocal(c, x, y, z);
      if (Math.abs(l[2]) > c.hl + 0.6 || Math.abs(l[0]) > c.hw + 0.6) continue;
      if (l[1] < -1.4 || l[1] > c.roofY) continue;
      const side = l[0] > 0 ? 1 : -1;
      const door = v.doorAt(c, l[2], side);
      if (door && Math.abs(l[0]) < c.hw + 0.55) {
        if (Math.abs(l[0]) < c.hw - 0.15 && Math.abs(l[1] - c.floorY) < 1.0) {
          P.ride = { veh: v, car: c, lx: l[0], lz: l[2], jy: 0, vy: 0, lyaw: angDiff(c.g.rotation.y, P.yaw) };
          v.riding = true;
          sfxStep();
          return null;
        }
        continue;
      }
      // hinausschieben
      let lx = l[0], lz = l[2];
      const px = c.hw + PR - Math.abs(lx), pz = c.hl + PR - Math.abs(lz);
      if (px <= 0 || pz <= 0) continue;
      if (px < pz) lx = Math.sign(lx || 1) * (c.hw + PR); else lz = Math.sign(lz || 1) * (c.hl + PR);
      const w = v.toWorld(c, lx, 0, lz);
      x = w[0]; z = w[2];
    }
  }
  return [x, z];
}

function updateRide(dt, input) {
  const R = P.ride, v = R.veh, c = R.car;
  R.lyaw += input.turn * 2.2 * dt;
  const spd = (input.run ? 4.5 : 2.6) * input.move;
  let nlx = R.lx - Math.sin(R.lyaw) * spd * dt, nlz = R.lz - Math.cos(R.lyaw) * spd * dt;
  nlz = clamp(nlz, -c.hl + 0.4, c.hl - 0.4);
  const side = nlx > 0 ? 1 : -1;
  const door = v.doorAt(c, nlz, side);
  if (door) {
    if (Math.abs(nlx) > c.hw + 0.2) {
      // aussteigen
      const w = v.toWorld(c, Math.sign(nlx) * (c.hw + 0.45), c.floorY, nlz);
      P.x = w[0]; P.z = w[2]; P.y = w[1]; P.vy = 0;
      P.yaw = c.g.rotation.y + R.lyaw;
      v.riding = false; P.ride = null;
      return;
    }
  } else nlx = clamp(nlx, -c.hw + 0.4, c.hw - 0.4);
  R.lx = nlx; R.lz = nlz;
  if (input.jump && R.jy <= 0) R.vy = 4.5;
  R.vy -= GRAV * dt; R.jy = Math.max(0, R.jy + R.vy * dt); if (R.jy <= 0) R.vy = 0;
  const w = v.toWorld(c, R.lx, c.floorY + R.jy, R.lz);
  P.x = w[0]; P.y = w[1]; P.z = w[2];
  P.yaw = c.g.rotation.y + R.lyaw;
  P.underground = !!v.underground;
}

/* ---------- Welt-Update ---------- */
function readInput() {
  const k = KEYS;
  return {
    move: (k.ArrowUp || k.KeyW ? 1 : 0) - (k.ArrowDown || k.KeyS ? 1 : 0),
    turn: (k.ArrowLeft || k.KeyA ? 1 : 0) - (k.ArrowRight || k.KeyD ? 1 : 0),
    run: !!(k.ShiftLeft || k.ShiftRight), jump: !!k.Space
  };
}

function updatePlayerWorld(dt) {
  if (ELEV.state !== 'none') { P.vy = 0; P.moving = false; P.flying = P.flapping = false; return; } // der Lift steuert die Position
  const input = readInput();
  if (P.ride) { P.flying = P.flapping = false; P.rocket = false; updateRide(dt, input); return; }
  if (P.rocket) { updateRocket(dt, input); return; }
  P.yaw += input.turn * 2.2 * dt;
  const dragon = P.char === 'dragon';
  let spd = P.swim ? 2.2 : (input.run ? 8.5 : 4.4);
  if (dragon && P.flying) spd = input.run ? DRAGON.airRun : DRAGON.airSpeed;
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  let nx = P.x + fx * input.move * spd * dt, nz = P.z + fz * input.move * spd * dt;
  P.moving = input.move !== 0;
  [nx, nz] = collideWorld(nx, nz, P.y, P.x, P.z);
  const vr = vehicleInteract(nx, nz, P.y, P.moving);
  if (!vr) return;
  [nx, nz] = vr;
  let g = groundAt(nx, nz, P.y);
  if (g > P.y + STEP) { nx = P.x; nz = P.z; g = groundAt(nx, nz, P.y); }
  P.x = nx; P.z = nz;
  // Schwimmen
  const deepWater = g < WS.WATER_Y - 1.1;
  P.flapping = false;
  if (dragon && deepWater && P.swim && input.jump) { P.swim = false; P.y = WS.WATER_Y + 0.3; P.vy = 3; } // aus dem Wasser auffliegen
  if (deepWater && P.y < WS.WATER_Y - 1.0 && !P.underground) {
    P.swim = true;
    P.y = Math.max(P.y + P.vy * dt, WS.WATER_Y - 1.3);
    P.vy = Math.max(P.vy - GRAV * dt, -2);
    if (P.y <= WS.WATER_Y - 1.3) { P.y = WS.WATER_Y - 1.3; P.vy = 0; }
    if (input.jump) {
      // ans Ufer klettern
      const ax = P.x + fx * 1.3, az = P.z + fz * 1.3;
      const ga = groundAt(ax, az, WS.WATER_Y + 4);
      if (ga > WS.WATER_Y) { P.x = ax; P.z = az; P.y = ga; P.vy = 0; P.swim = false; }
    }
  } else {
    P.swim = false;
    if (dragon && !P.onGround) {
      // Drache in der Luft: Leertaste gehalten = flattern und steigen, sonst gleiten
      if (input.jump) { P.vy = Math.min(DRAGON.climb, P.vy + DRAGON.flapAcc * dt); P.flapping = true; }
      else P.vy = Math.max(-DRAGON.glideSink, P.vy - GRAV * 0.35 * dt);
    } else P.vy -= GRAV * dt;
    P.y += P.vy * dt;
    // Decke: unter der Erde nicht durch die Stationsdecke, oben eine Höchstgrenze
    const ceil = P.underground ? g + 3.2 : DRAGON.ceiling;
    if (P.y > ceil) { P.y = ceil; P.vy = Math.min(P.vy, 0); }
    if (P.y <= g) { P.y = g; P.vy = 0; P.onGround = true; } else P.onGround = P.y - g < 0.06;
    if (input.jump && P.onGround) { P.vy = JUMP; P.onGround = false; }
    if (P.y < g - 0.01) P.y = g;
  }
  P.flying = dragon && !P.onGround && !P.swim && P.y - g > 0.6;
  // Untergrund?
  let ug = false;
  stationsNear(P.x, P.z, (st, lx, lz) => {
    if (P.y < st.surfY - 2.4 && ((Math.abs(lz) < M.SL + 2 && Math.abs(lx) < M.WALL + 2) || (Math.abs(lx) < 3 && lz > st.aBot - 1 && lz < st.aTop + 1))) ug = true;
  });
  if (hubTunnelBand(P.y) && inHubTunnel(P.x, P.z, 0)) ug = true;
  if (!ug) { const lo = liftAt(P.x, P.z, P.y, 0); if (lo && P.y < terrainH(P.x, P.z) - 2) ug = true; }
  P.underground = ug;
  if (P.y < -60) respawn();
}

/* ---------- Raketenmodus ---------- */
function toggleRocket() {
  if (P.char !== 'dragon' || P.ride || GAME.mode !== 'world' || ELEV.state !== 'none') return false;
  if (!P.rocket && P.underground) return false; // im Tunnel nicht zünden
  P.rocket = !P.rocket;
  if (P.rocket) {
    P.rspd = Math.max(18, P.rspd || 0); P.vy = ROCKET.launch; P.onGround = false; P.swim = false; P.third = true; P.bank = 0;
    P.launchT = P.y - Math.max(groundAt(P.x, P.z, P.y + 1), WS.WATER_Y) < 20 ? 1.6 : 0; // vom Boden: erst steil hoch
    if (typeof sfxRocket === 'function') sfxRocket();
  } else { P.vy = Math.min(P.vy, 4); P.rspd = 0; P.bank = 0; }
  return true;
}
function updateRocket(dt, input) {
  if (P.char !== 'dragon') { P.rocket = false; return; }
  // Lenken mit Schräglage
  P.yaw += input.turn * ROCKET.turn * dt;
  P.bank = (P.bank || 0) + (input.turn * 0.6 - (P.bank || 0)) * Math.min(1, dt * 4);
  // Tempo: ↑ Turbo, ↓ bremsen, sonst Reiseflug
  const target = input.move > 0 ? ROCKET.turbo : input.move < 0 ? ROCKET.slow : ROCKET.cruise;
  const dv = target - P.rspd;
  P.rspd += clamp(dv, -ROCKET.acc * 1.6 * dt, ROCKET.acc * dt);
  // Steigen/Sinken: Leertaste hoch, Shift Sturzflug, Maus-Neigung zusätzlich
  let vyT = (input.jump ? ROCKET.climb : 0) - (input.run ? ROCKET.climb * 1.3 : 0) + Math.sin(P.pitch) * P.rspd * 0.7;
  if (P.launchT > 0) { P.launchT -= dt; vyT = Math.max(vyT, ROCKET.launch); }
  P.vy += (vyT - P.vy) * Math.min(1, dt * 2.5);
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  // in Schritten von höchstens 2 m, damit nichts durchtunnelt wird
  const dist = P.rspd * dt, n = Math.max(1, Math.ceil(dist / 2));
  for (let i = 0; i < n; i++) {
    let nx = P.x + fx * dist / n, nz = P.z + fz * dist / n, ny = P.y + P.vy * dt / n;
    const wx = nx, wz = nz;
    [nx, nz] = collideWorld(nx, nz, ny, P.x, P.z);
    // gegen eine Wand geprallt: kräftig abbremsen statt mit vollem Tempo entlangzuschrammen
    if ((nx - wx) ** 2 + (nz - wz) ** 2 > (dist / n) ** 2 * 0.25) { P.rspd = Math.max(ROCKET.slow, P.rspd * 0.55); }
    nx = clamp(nx, -ROCKET.bound, ROCKET.bound); nz = clamp(nz, -ROCKET.bound, ROCKET.bound);
    const g = groundAt(nx, nz, ny + 1.5);
    const floor = Math.max(g, terrainH(nx, nz), WS.WATER_Y) + 1.4;
    if (ny < floor) { ny = floor; if (P.vy < 0) P.vy *= 0.3; }
    P.x = nx; P.z = nz; P.y = Math.min(ny, ROCKET.ceiling);
  }
  if (P.y >= ROCKET.ceiling) P.vy = Math.min(P.vy, 0);
  P.onGround = false; P.swim = false; P.flying = true; P.flapping = false; P.moving = true; P.underground = false;
}

function respawn() {
  P.rocket = false;
  P.x = SPAWN.x; P.z = SPAWN.z; P.y = groundAt(P.x, P.z, 500) + 0.1; P.vy = 0; P.ride = null;
}

/* ---------- Innenraum ---------- */
function updatePlayerInterior(dt) {
  const input = ELEV.state === 'none' ? readInput() : { move: 0, turn: 0, run: false, jump: false };
  P.yaw += input.turn * 2.2 * dt;
  const spd = input.run ? 6 : 3.6;
  const nx = P.x - Math.sin(P.yaw) * input.move * spd * dt, nz = P.z - Math.cos(P.yaw) * input.move * spd * dt;
  P.moving = input.move !== 0;
  if (ELEV.state === 'none') { const r = interiorCollide(nx, nz, PR); P.x = r[0]; P.z = r[1]; }
  P.vy -= GRAV * dt; P.y += P.vy * dt;
  if (P.y <= 0) { P.y = 0; P.vy = 0; P.onGround = true; }
  if (input.jump && P.onGround && ELEV.state === 'none') { P.vy = 5.5; P.onGround = false; }
}

/* ---------- Gebäude betreten / verlassen ---------- */
function enterBuilding(b) {
  const sp = buildInterior(b, 0);
  GAME.mode = 'interior'; GAME.building = b;
  P.x = sp.spawn.x; P.z = sp.spawn.z; P.y = 0; P.vy = 0; P.yaw = 0; P.pitch = 0;
  sfxDoor();
  hideRoofCab();
}
function exitBuilding() {
  const b = INT.b;
  GAME.mode = 'world';
  P.x = b.door.ox; P.z = b.door.oz; P.y = groundAt(P.x, P.z, b.door.oy + 1.5); P.vy = 0;
  P.yaw = Math.atan2(-Math.sin(b.rot), -Math.cos(b.rot));
  sfxDoor();
}

/* ---------- Lift ---------- */
function placeRoofCab(b) {
  if (!ROOFCAB) { ROOFCAB = makeCabin(true); WORLD.scene.add(ROOFCAB.g); }
  const L = b.lift;
  ROOFCAB.g.position.set(L.x, L.y, L.z); ROOFCAB.g.rotation.y = b.rot;
  ROOFCAB.g.visible = true;
  ROOFCAB_B = b;
  LIFTCUT.value.set(L.x, L.y, L.z, b.rot);
  ROOFCAB.setLabel('D');
}
function hideRoofCab() {
  if (ROOFCAB) ROOFCAB.g.visible = false;
  ROOFCAB_B = null;
  LIFTCUT.value.set(0, -9999, 0, 0);
}
function cabFor(ctx) { return ctx === 'interior' ? INT.cab : ROOFCAB; }
function cabPoints(ctx, b) {
  if (ctx === 'interior') {
    const lx = INT.lift.x, D = INT.D;
    return { inside: [lx, -D / 2 - 1.62], outside: [lx, -D / 2 + 1.5], yawIn: Math.PI, yawOut: 0 };
  }
  const L = b.lift;
  const yawIn = Math.atan2(-Math.sin(b.rot), -Math.cos(b.rot));
  return { inside: [L.x, L.z], outside: [L.ox, L.oz], yawIn, yawOut: yawIn };
}
function startLift(ctx, b, floor) {
  if (ELEV.state !== 'none') return;
  if (ctx === 'roof') placeRoofCab(b);
  Object.assign(ELEV, { state: 'opening', t: 0, ctx, b, floor });
  sfxDing();
}
function chooseFloor(f) {
  if (ELEV.state !== 'select') return;
  hideLiftMenu();
  if (f === ELEV.floor) { ELEV.state = 'exitOpen'; ELEV.t = 0; return; }
  ELEV.target = f; ELEV.state = 'travel'; ELEV.t = 0;
  ELEV.dur = Math.min(16, 2.2 + 0.45 * Math.abs(f - ELEV.floor));
  sfxHum(true);
}
function cancelLift() { if (ELEV.state === 'select') { hideLiftMenu(); ELEV.state = 'exitOpen'; ELEV.t = 0; } }

function updateElevator(dt) {
  if (ELEV.state === 'none') return;
  const E = ELEV; E.t += dt;
  const cab = cabFor(E.ctx);
  const pts = cabPoints(E.ctx, E.b);
  switch (E.state) {
    case 'opening':
      cab.setOpen(Math.min(1, E.t / 1.0));
      if (E.t >= 1.0) { E.state = 'enter'; E.t = 0; E.from = [P.x, P.z]; E.startYaw = P.yaw; }
      break;
    case 'enter': {
      const k = smooth(0, 1, E.t / 1.0);
      P.x = lerp(E.from[0], pts.inside[0], k); P.z = lerp(E.from[1], pts.inside[1], k);
      P.yaw = E.startYaw + angDiff(E.startYaw, pts.yawIn) * k; P.pitch *= 0.9;
      if (E.ctx === 'roof') P.y = E.b.lift.y;
      if (E.t >= 1.0) { E.state = 'closing'; E.t = 0; }
      break;
    }
    case 'closing':
      cab.setOpen(1 - Math.min(1, E.t / 1.0));
      if (E.t >= 1.0) { E.state = 'select'; E.t = 0; showLiftMenu(E.b, E.floor); }
      break;
    case 'travel': {
      const k = E.t / E.dur;
      const cur = Math.round(lerp(E.floor, E.target, smooth(0, 1, k)));
      cab.setLabel(floorShort(E.b, cur), E.target > E.floor ? '▲' : '▼');
      P.camShake = 0.004 * Math.sin(E.t * 40) * (k < 0.15 || k > 0.85 ? 2 : 1);
      if (E.t >= E.dur) arriveFloor(E.target);
      break;
    }
    case 'exitOpen':
      cab.setOpen(Math.min(1, E.t / 1.0));
      if (E.t >= 1.0) { E.state = 'exiting'; E.t = 0; E.from = [P.x, P.z]; }
      break;
    case 'exiting': {
      const k = smooth(0, 1, E.t / 0.9);
      P.x = lerp(E.from[0], pts.outside[0], k); P.z = lerp(E.from[1], pts.outside[1], k);
      if (E.t >= 0.9) { E.state = 'exitClose'; E.t = 0; }
      break;
    }
    case 'exitClose':
      cab.setOpen(1 - Math.min(1, E.t / 1.0));
      if (E.t >= 1.0) { E.state = 'none'; E.t = 0; }
      break;
  }
}
function arriveFloor(f) {
  const E = ELEV, b = E.b;
  sfxHum(false); sfxDing(); P.camShake = 0;
  if (f >= b.floors) {
    GAME.mode = 'world';
    placeRoofCab(b);
    E.ctx = 'roof';
    P.x = b.lift.x; P.z = b.lift.z; P.y = b.lift.y; P.vy = 0;
    P.yaw = cabPoints('roof', b).yawIn;
  } else {
    buildInterior(b, f);
    GAME.mode = 'interior'; GAME.building = b;
    E.ctx = 'interior';
    hideRoofCab();
    const p = cabPoints('interior', b);
    P.x = p.inside[0]; P.z = p.inside[1]; P.y = 0; P.vy = 0; P.yaw = p.yawIn;
  }
  E.floor = f;
  cabFor(E.ctx).setOpen(0);
  cabFor(E.ctx).setLabel(floorShort(b, f));
  E.state = 'arrived'; E.t = 0;
}

/* ---------- Tasten E und L ---------- */
function actionE() {
  if (ELEV.state !== 'none') return;
  if (GAME.mode === 'interior') {
    if (INT.exit && Math.abs(P.x - INT.exit.x) < 1.8 && P.z > INT.exit.z - 2.4) exitBuilding();
    return;
  }
  if (P.ride) return;
  const b = doorNear(P.x, P.z, 2.6);
  if (b && Math.abs(P.y - b.door.y) < 1.6) enterBuilding(b);
}
function actionL() {
  if (GAME.mode === 'world' && ELEV.state === 'none' && stationLiftAction()) return; // Stationslift
  if (ELEV.state === 'arrived') { ELEV.state = 'exitOpen'; ELEV.t = 0; sfxDing(); return; }
  if (ELEV.state !== 'none') return;
  if (GAME.mode === 'interior') {
    if (Math.abs(P.x - INT.lift.x) < 1.8 && P.z < INT.lift.z + 2.6) startLift('interior', INT.b, INT.floor);
    return;
  }
  if (P.ride) return;
  const b = liftNear(P.x, P.z, P.y, 2.4);
  if (b) startLift('roof', b, b.floors);
}

/* Hinweis, was gerade möglich ist */
function currentPrompt() {
  if (ELEV.state === 'arrived') return 'L – Aussteigen (' + floorLabel(ELEV.b, ELEV.floor) + ')';
  if (ELEV.state === 'select') return 'Stockwerk wählen';
  if (ELEV.state !== 'none') return '';
  if (GAME.mode === 'interior') {
    if (INT.exit && Math.abs(P.x - INT.exit.x) < 1.8 && P.z > INT.exit.z - 2.4) return 'E – Gebäude verlassen';
    if (Math.abs(P.x - INT.lift.x) < 1.8 && P.z < INT.lift.z + 2.6) return 'L – Lift rufen';
    return '';
  }
  if (P.ride) {
    const v = P.ride.veh;
    if (v.state === 'dwell' && v.door > 0.7) return 'Türen offen – durch die Tür hinausgehen zum Aussteigen';
    return '';
  }
  const b = doorNear(P.x, P.z, 2.6);
  if (b && Math.abs(P.y - b.door.y) < 1.6) return 'E – Eintreten: ' + buildingLabel(b);
  const lb = liftNear(P.x, P.z, P.y, 2.4);
  if (lb) return 'L – Lift (' + buildingLabel(lb) + ')';
  return '';
}

/* Dachkabine bei Bedarf einblenden */
function updateRoofCab() {
  if (GAME.mode !== 'world' || ELEV.state !== 'none') return;
  const b = liftNear(P.x, P.z, P.y, 30);
  if (b) { if (ROOFCAB_B !== b) placeRoofCab(b); }
  else if (ROOFCAB_B) hideRoofCab();
}
