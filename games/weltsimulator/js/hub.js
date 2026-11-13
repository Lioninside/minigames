/* ================= STATIONSLIFTE UND KNOTEN HÖNGGERBERG =================
   Stationslifte: gläserne Kabine im Stahlgerüst. Steht man in der Kabine und drückt L, erscheint
   die Etagenliste (Strasse, Perron, im Knoten auch Fussgängertunnel). Die Kabine fährt sichtbar,
   der Spieler fährt mit. Ruft man den Lift auf einer Etage, steht die Kabine dort bereit.
   Knoten Hönggerberg: unterirdischer Fussgängertunnel (Boden HUB.TUN_Y), der die Lifte aller
   neun Abteile verbindet; Busbahnhof; Serviceanlage mit abgestellten Zügen. */

const LIFTS = { list: [], hash: new SHash(30), ride: null, menu: null, cabGeo: null };

function addLift(o) {
  o.levels.sort((a, b) => a.y - b.y);
  o.cur = Math.max(0, o.levels.findIndex(l => l.ground));
  o.cabY = o.levels[o.cur].y;
  o.c = Math.cos(o.rot); o.s = Math.sin(o.rot);
  o.id = LIFTS.list.length;
  LIFTS.list.push(o);
  LIFTS.hash.insert(o, o.x - 2, o.z - 2, o.x + 2, o.z + 2);
  return o;
}
/* lokale Koordinaten: x quer, z entlang der Lift-Ausrichtung */
function liftLocal(o, x, z) { const dx = x - o.x, dz = z - o.z; return [dx * o.c - dz * o.s, dx * o.s + dz * o.c]; }
function liftAt(x, z, y, pad) {
  let best = null;
  LIFTS.hash.query(x - 2, z - 2, x + 2, z + 2, (o) => {
    const l = liftLocal(o, x, z);
    if (Math.abs(l[0]) < 1.15 + (pad || 0) && Math.abs(l[1]) < 1.15 + (pad || 0) && y > o.levels[0].y - 2 && y < o.levels[o.levels.length - 1].y + 3) best = o;
  });
  return best;
}
/* Kabine dorthin holen, wo der Spieler gerade steht (ausser während einer Fahrt) */
function liftsUpdate(dt) {
  const R = LIFTS.ride;
  if (R) {
    const o = R.lift, tgt = o.levels[R.to].y;
    const dir = Math.sign(tgt - o.cabY), v = Math.min(9, 1.5 + Math.abs(tgt - o.cabY) * 0.6);
    o.cabY += dir * v * dt;
    if ((dir > 0 && o.cabY >= tgt) || (dir < 0 && o.cabY <= tgt) || dir === 0) {
      o.cabY = tgt; o.cur = R.to; LIFTS.ride = null;
      P.underground = !!(o.levels[R.to].tunnel || o.levels[R.to].ug);
      if (typeof sfxDing === 'function') sfxDing();
    }
    P.x = o.x + R.lx * o.c + R.lz * o.s; P.z = o.z - R.lx * o.s + R.lz * o.c; P.y = o.cabY; P.vy = 0; P.onGround = true;
    if (o.mesh) o.mesh.position.y = o.cabY;
    return true;
  }
  if (GAME.mode !== 'world' || P.ride) return false;
  const o = liftAt(P.x, P.z, P.y, 2.5);
  if (o) {
    let bi = -1, bd = 2.2;
    o.levels.forEach((l, i) => { const d = Math.abs(P.y - l.y); if (d < bd) { bd = d; bi = i; } });
    if (bi >= 0 && bi !== o.cur) { o.cur = bi; o.cabY = o.levels[bi].y; if (o.mesh) o.mesh.position.y = o.cabY; }
  }
  return false;
}
/* Taste L in einer Kabine: Etagenliste */
function stationLiftAction() {
  if (LIFTS.ride) return true;
  const o = liftAt(P.x, P.z, P.y, 0);
  if (!o || Math.abs(P.y - o.cabY) > 1.2) return false;
  LIFTS.menu = o;
  showStationLiftMenu(o);
  return true;
}
function stationLiftChoose(i) {
  const o = LIFTS.menu; LIFTS.menu = null;
  hideLiftMenu();
  if (!o || i === o.cur) return;
  const l = liftLocal(o, P.x, P.z);
  LIFTS.ride = { lift: o, to: i, lx: clamp(l[0], -0.8, 0.8), lz: clamp(l[1], -0.8, 0.8) };
  if (typeof sfxDoor === 'function') sfxDoor();
}
function stationLiftCancel() { LIFTS.menu = null; hideLiftMenu(); }

/* Geometrie: Gerüst (statisch, zusammengefasst) und Kabinen (je eine Gruppe, bewegt) */
function buildLifts(surf, scene) {
  const cm = new ChunkedMB(WS.CHUNK);
  const steel = lin(0x5d6670), cGlass = null;
  const cabGeo = (() => {
    const fr = new MB(), gl = new MB();
    fr.box(0, 0.04, 0, 2.2, 0.08, 2.2, 0, lin(0x8a9096));
    fr.box(0, 2.45, 0, 2.2, 0.1, 2.2, 0, lin(0x8a9096));
    for (const [x, z] of [[-1.08, -1.08], [1.08, -1.08], [-1.08, 1.08], [1.08, 1.08]]) fr.box(x, 1.25, z, 0.08, 2.4, 0.08, 0, lin(0x4b535b));
    fr.box(0, 1.0, -1.08, 2.1, 0.05, 0.05, 0, lin(0x4b535b));
    gl.box(-1.08, 1.25, 0, 0.03, 2.3, 2.1, 0); gl.box(1.08, 1.25, 0, 0.03, 2.3, 2.1, 0); gl.box(0, 1.25, -1.08, 2.1, 2.3, 0.03, 0);
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4dd, emissiveIntensity: 1.2 });
    const lt = new MB(); lt.box(0, 2.38, 0, 1.2, 0.04, 1.2, 0);
    return { fr: compactGeometry(fr.build(), true), gl: compactGeometry(gl.build(), false), lt: compactGeometry(lt.build(), false), lightMat };
  })();
  const frMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.6 });
  for (const o of LIFTS.list) {
    const y0 = o.levels[0].y, y1 = o.levels[o.levels.length - 1].y;
    const surfY = o.levels.find(l => l.ground) ? o.levels.find(l => l.ground).y : y0;
    // Gerüst über dem Boden sichtbar (unter dem Boden steckt es im Erdreich)
    const a = Math.max(y0, surfY - 0.5), b = y1 + 2.8;
    if (b - a > 3) {
      const mb = cm.get('frame', o.x, o.z), gm = cm.get('glass', o.x, o.z);
      for (const [lx, lz] of [[-1.25, -1.25], [1.25, -1.25], [-1.25, 1.25], [1.25, 1.25]]) {
        const p = [o.x + lx * o.c + lz * o.s, o.z - lx * o.s + lz * o.c];
        mb.box(p[0], (a + b) / 2, p[1], 0.16, b - a, 0.16, o.rot, steel, null, true);
      }
      for (let yy = a + 3; yy < b; yy += 3.2) mb.box(o.x, yy, o.z, 2.66, 0.12, 2.66, o.rot, steel, null, false);
      // Glas auf drei Seiten (Öffnungsseite zeigt zum Perron: lokal +z * open)
      for (const [lx, lz, w, d] of [[-1.25, 0, 0.03, 2.5], [1.25, 0, 0.03, 2.5], [0, -1.25 * (o.open || 1), 2.5, 0.03]]) {
        const p = [o.x + lx * o.c + lz * o.s, o.z - lx * o.s + lz * o.c];
        gm.box(p[0], (a + b) / 2, p[1], w, b - a, d, o.rot, cGlass, null, true);
      }
      mb.box(o.x, b + 0.15, o.z, 3.0, 0.3, 3.0, o.rot, lin(0x3d444b));
    }
    const g = new THREE.Group();
    g.position.set(o.x, o.cabY, o.z); g.rotation.y = o.rot + ((o.open || 1) < 0 ? Math.PI : 0);
    const f = new THREE.Mesh(cabGeo.fr, frMat); f.castShadow = true; g.add(f);
    g.add(new THREE.Mesh(cabGeo.gl, MATS.glass));
    g.add(new THREE.Mesh(cabGeo.lt, cabGeo.lightMat));
    g.userData.dynamic = true;
    (scene || surf).add(g); // in der Szene: auch unter der Erde sichtbar
    nearVis(g, 350);
    o.mesh = g;
  }
  cm.finish({ frame: frMat, glass: MATS.glass }, surf, { cast: { frame: true } });
}

/* Liftmenü (nutzt das Etagenmenü der Gebäude) */
function showStationLiftMenu(o) {
  const grid = HUD.el.liftGrid; grid.innerHTML = '';
  HUD.el.liftTitle.textContent = 'Lift · ' + (o.station || 'Station');
  LIFT_LIST = [];
  for (let i = o.levels.length - 1; i >= 0; i--) LIFT_LIST.push(i);
  LIFT_LIST.forEach((i) => {
    const l = o.levels[i];
    const btn = document.createElement('button');
    btn.className = 'liftBtn' + (i === o.cur ? ' cur' : '');
    const short = l.tunnel ? 'T' : l.ground ? '0' : (l.y > o.levels.find(q => q.ground).y ? '↑' : '↓');
    btn.innerHTML = '<b>' + short + '</b><span>' + l.name + '</span>';
    btn.onclick = () => stationLiftChoose(i);
    grid.appendChild(btn);
  });
  LIFT_SEL = Math.max(0, LIFT_LIST.findIndex(i => i !== o.cur));
  markLiftSel();
  HUD.el.liftMenu.classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}

/* ================= KNOTEN HÖNGGERBERG ================= */
const HUBT = { segs: [], nodes: [], group: null, hash: new SHash(40) };

/* Planung (vor der Bebauung): Flächen für Serviceanlage und Busbahnhof freihalten */
function planHub() {
  const D = hubDepot();
  for (let a = -D.len / 2; a <= D.len / 2; a += 15) reserveCircle(D.x + D.d[0] * a, D.z + D.d[1] * a, 26);
  const b = TRANSIT.busHub; if (b) reserveCircle(b.x, b.z, 18);
}
function hubDepot() { return { x: HUB.S.x - 95, z: HUB.S.z - 40, d: [0, 1], len: 230 }; }

/* Lifte der Bahnhofsabteile, die nicht schon an einem Perron sitzen */
function hubAccessLifts() {
  // U-Bahn-Hallen: Lift auf dem Mittelperron (Perron, Tunnel, Strasse)
  for (const st of TRANSIT.stations) {
    if (!st.hub) continue;
    const p = stLocalToWorld(st, 0, -40);
    const gy = terrainH(p[0], p[1]);
    addLift({ x: p[0], z: p[1], rot: st.rot, open: 1, station: st.name + ' ' + st.line.name, hub: st.hub,
      levels: [{ y: st.platY, name: 'Perron ' + st.line.name, ug: true }, { y: HUB.TUN_Y, name: 'Fussgängertunnel', tunnel: true }, { y: gy, name: 'Strasse', ground: true }] });
  }
  // Tramhalte, Busbahnhof: Zugang vom Strassenniveau in den Tunnel
  const kiosk = (x, z, rot, name, hub) => addLift({ x, z, rot, open: 1, station: name, hub, levels: [{ y: HUB.TUN_Y, name: 'Fussgängertunnel', tunnel: true }, { y: terrainH(x, z), name: 'Strasse', ground: true }] });
  const tp = (T, name) => T && T.platforms.find(p => p.name === name);
  for (const [T, k] of [[TRANSIT.tram18, 'S'], [TRANSIT.tram18, 'F'], [TRANSIT.tram18, 'H'], [TRANSIT.tram, 'T']]) {
    const pl = tp(T, hubName(k)); if (!pl) continue;
    kiosk(pl.x + pl.rx * 5.5, pl.z + pl.rz * 5.5, Math.atan2(pl.dx, pl.dz), hubName(k) + ' (Tram)', k);
  }
  const b = TRANSIT.busHub;
  if (b) { const bt = hubBusTerminal(); kiosk(bt.kx, bt.kz, bt.rot, hubName('B'), 'B'); }
}
function hubBusTerminal() {
  const b = TRANSIT.busHub;
  // neben dem Startknoten, abseits der Fahrbahnen
  let best = { x: b.x + 14, z: b.z, a: 0 }, bd = -1e9;
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, x = b.x + Math.cos(a) * 14, z = b.z + Math.sin(a) * 14;
    const c = Math.min(roadClear(x, z, 4), 30);
    if (c > bd) { bd = c; best = { x, z, a }; }
  }
  const rot = best.a + Math.PI / 2;
  return { x: best.x, z: best.z, rot, kx: best.x + Math.cos(best.a) * 4, kz: best.z + Math.sin(best.a) * 4 };
}

/* Fussgängertunnel: alle Lifte mit Tunnelhalt über einen minimalen Spannbaum verbinden */
function buildHub(surf, scene) {
  hubAccessLifts();
  const pts = LIFTS.list.filter(o => o.levels.some(l => l.tunnel)).map(o => ({ x: o.x, z: o.z, lift: o }));
  // Knotenhallen pro Abteil (Mittelpunkt der Lifte dieses Abteils) als Verteiler
  const byHub = {};
  for (const p of pts) { const k = p.lift.hub || '?'; (byHub[k] = byHub[k] || []).push(p); }
  const halls = Object.keys(byHub).map(k => { const a = byHub[k]; return { x: a.reduce((s, p) => s + p.x, 0) / a.length, z: a.reduce((s, p) => s + p.z, 0) / a.length, hub: k, hall: true }; });
  const all = halls.concat(pts);
  const edges = [];
  // je Lift: Gang zur Halle seines Abteils
  for (const p of pts) { const h = halls.find(q => q.hub === (p.lift.hub || '?')); edges.push([h, p]); }
  // Hallen untereinander: Spannbaum (Prim)
  const inT = [halls[0]], rest = halls.slice(1);
  while (rest.length) {
    let bi = 0, bj = 0, bd = 1e18;
    for (let i = 0; i < inT.length; i++) for (let j = 0; j < rest.length; j++) { const d = Math.hypot(inT[i].x - rest[j].x, inT[i].z - rest[j].z); if (d < bd) { bd = d; bi = i; bj = j; } }
    edges.push([inT[bi], rest[bj]]); inT.push(rest[bj]); rest.splice(bj, 1);
  }
  const Y = HUB.TUN_Y, HW = 2.6, H = 3.4;
  for (const [a, b] of edges) { const s = { ax: a.x, az: a.z, bx: b.x, bz: b.z, hw: HW }; HUBT.segs.push(s); HUBT.hash.insert(s, Math.min(a.x, b.x) - 6, Math.min(a.z, b.z) - 6, Math.max(a.x, b.x) + 6, Math.max(a.z, b.z) + 6); }
  for (const p of all) { const n = { x: p.x, z: p.z, r: p.hall ? 7 : 2.4, hall: !!p.hall, hub: p.hub }; HUBT.nodes.push(n); HUBT.hash.insert(n, p.x - 8, p.z - 8, p.x + 8, p.z + 8); }
  // Geometrie
  const g = new THREE.Group(); g.name = 'hubTunnel';
  const tex = metroTextures();
  const mats = { wall: new THREE.MeshStandardMaterial({ map: tex.tiles, roughness: 0.4 }), floor: new THREE.MeshStandardMaterial({ map: tex.floor, roughness: 0.55 }),
    ceil: new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.7 }), light: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e8, emissiveIntensity: 1.6 }),
    band: new THREE.MeshStandardMaterial({ color: 0x2a8a8c, roughness: 0.5 }) };
  const mb = { wall: new MB(), floor: new MB(), ceil: new MB(), light: new MB(), band: new MB() };
  for (const s of HUBT.segs) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, len = Math.hypot(dx, dz); if (len < 0.5) continue;
    const rot = Math.atan2(dx, dz), cx = (s.ax + s.bx) / 2, cz = (s.az + s.bz) / 2;
    mb.floor.box(cx, Y - 0.15, cz, s.hw * 2, 0.3, len, rot, null, 3);
    mb.ceil.box(cx, Y + H + 0.15, cz, s.hw * 2 + 0.6, 0.3, len, rot);
    for (const side of [1, -1]) {
      const ox = Math.cos(rot) * side * (s.hw + 0.15), oz = -Math.sin(rot) * side * (s.hw + 0.15);
      mb.wall.box(cx + ox, Y + H / 2, cz + oz, 0.3, H, len, rot, null, 3);
      mb.band.box(cx + ox * 0.97, Y + 1.6, cz + oz * 0.97, 0.05, 0.3, len, rot);
    }
    for (let a = -len / 2 + 3; a < len / 2 - 2; a += 6) mb.light.box(cx + Math.sin(rot) * a, Y + H - 0.03, cz + Math.cos(rot) * a, 0.5, 0.05, 3.5, rot);
  }
  for (const n of HUBT.nodes) {
    const r = n.r + 0.4;
    mb.floor.box(n.x, Y - 0.14, n.z, r * 2, 0.28, r * 2, 0, null, 3);
    mb.ceil.box(n.x, Y + H + 0.16, n.z, r * 2 + 0.6, 0.3, r * 2 + 0.6, 0);
    if (n.hall) mb.light.box(n.x, Y + H - 0.03, n.z, 3, 0.05, 3, 0);
  }
  for (const k in mb) if (!mb[k].empty()) { const m = new THREE.Mesh(compactGeometry(mb[k].build(), false), mats[k]); m.receiveShadow = true; g.add(m); }
  // Wegweiser in den Hallen: Abteil und Liste der Abteile
  for (const n of HUBT.nodes) {
    if (!n.hall) continue;
    const key = 'hubsign|' + n.hub;
    const rs = SIGNS.add(key, 512, 96, (ctx, w, h) => {
      ctx.fillStyle = '#123a7a'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.arc(48, h / 2, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#123a7a'; ctx.font = 'bold 46px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n.hub, 48, h / 2 + 2);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = 'bold 34px Arial'; ctx.fillText('Hönggerberg/' + n.hub, 96, 34);
      ctx.font = '22px Arial'; ctx.fillText((HUB.NAMES[n.hub] || '') + ' · Lift L', 96, 72);
    });
    for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const m = signMesh(rs, 'glow', 3.6, 0.68);
      m.position.set(n.x + Math.sin(r) * (n.r - 0.2), Y + 2.6, n.z + Math.cos(r) * (n.r - 0.2)); m.rotation.y = r + Math.PI;
      g.add(m);
    }
  }
  g.visible = false;
  scene.add(g);
  HUBT.group = g;
  buildHubSurface(surf);
}
/* im Tunnel? (2D) */
function inHubTunnel(x, z, m) {
  m = m || 0;
  return HUBT.hash.query(x - 1, z - 1, x + 1, z + 1, (o) => {
    if (o.r !== undefined) return Math.abs(x - o.x) < o.r + 0.4 - m && Math.abs(z - o.z) < o.r + 0.4 - m;
    return segDist(x, z, o.ax, o.az, o.bx, o.bz) < o.hw - m;
  });
}
function hubTunnelBand(y) { return y > HUB.TUN_Y - 1.5 && y < HUB.TUN_Y + 2.6; }
/* Bewegung im Tunnel: nur innerhalb der Gänge */
function hubTunnelClamp(x, z, px, pz) {
  if (inHubTunnel(x, z, PR)) return [x, z];
  if (inHubTunnel(x, pz, PR)) return [x, pz];
  if (inHubTunnel(px, z, PR)) return [px, z];
  return [px, pz];
}

/* Oberfläche: Busbahnhof, Serviceanlage, Abteil-Schilder */
function buildHubSurface(surf) {
  const cm = new ChunkedMB(WS.CHUNK);
  const steel = lin(0x4b535b), roofC = lin(0xdfe3e6), conc = lin(0xb9b4aa);
  // Busbahnhof
  if (TRANSIT.busHub) {
    const bt = hubBusTerminal(), y = terrainH(bt.x, bt.z);
    const mb = cm.get('mat', bt.x, bt.z);
    const c = Math.cos(bt.rot), s = Math.sin(bt.rot);
    for (let a = -15; a <= 15; a += 6) for (const q of [-2.5, 2.5]) mb.box(bt.x + a * s + q * c, y + 2, bt.z + a * c - q * s, 0.2, 4, 0.2, bt.rot, steel);
    mb.box(bt.x, y + 4.1, bt.z, 7.5, 0.25, 34, bt.rot, roofC);
    mb.box(bt.x, y + 0.08, bt.z, 7, 0.16, 32, bt.rot, conc);
    const rs = SIGNS.add('bushub', 512, 96, (ctx, w, h) => {
      ctx.fillStyle = '#123a7a'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.arc(48, h / 2, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#123a7a'; ctx.font = 'bold 46px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('B', 48, h / 2 + 2);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = 'bold 32px Arial'; ctx.fillText('Busbahnhof Hönggerberg/B', 96, 34);
      ctx.font = '24px Arial'; ctx.fillText('Linien ' + BUS_DEF.hubLines.join(' · '), 96, 72);
    });
    const m = signMesh(rs, 'glow', 7, 1.3); m.position.set(bt.x, y + 5.0, bt.z); m.rotation.y = bt.rot + Math.PI / 2; surf.add(m); nearVis(m, 400);
    const m2 = m.clone(); m2.rotation.y += Math.PI; surf.add(m2); nearVis(m2, 400);
  }
  // Serviceanlage: Abstellgleise mit Zügen und Werkhalle
  const D = hubDepot();
  const tracks = [-14, -9, -4, 6, 11];
  const yBase = (a, q) => terrainH(D.x + q, D.z + a) + 0.3;
  const mbB = cm.get('ballast', D.x, D.z), mbR = cm.get('rail', D.x, D.z);
  for (const q of tracks) {
    for (let a = -D.len / 2; a < D.len / 2; a += 6) {
      const y0 = yBase(a, q), y1 = yBase(a + 6, q);
      mbB.quad([D.x + q - 1.5, y0 - 0.15, D.z + a], [D.x + q - 1.5, y1 - 0.15, D.z + a + 6], [D.x + q + 1.5, y1 - 0.15, D.z + a + 6], [D.x + q + 1.5, y0 - 0.15, D.z + a], null, null, [0, 1, 0]);
      for (const r of [-0.72, 0.72]) mbR.box(D.x + q + r, (y0 + y1) / 2 + 0.05, D.z + a + 3, 0.07, 0.15, 6.05, Math.atan2(0, 1));
    }
  }
  // Werkhalle über zwei Gleisen
  const hy = yBase(40, 8.5);
  const hm = cm.get('mat', D.x, D.z);
  hm.box(D.x + 8.5, hy + 5, D.z + 40, 16, 10, 70, 0, lin(0xc2b8a3));
  hm.box(D.x + 8.5, hy + 10.4, D.z + 40, 17, 0.8, 71, 0, lin(0x6d6a66));
  const rsS = SIGNS.add('depot', 512, 96, (ctx, w, h) => { ctx.fillStyle = '#123a7a'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fff'; ctx.font = 'bold 36px Arial'; ctx.textBaseline = 'middle'; ctx.fillText('Serviceanlage Hönggerberg/S', 22, h / 2); });
  const ms = signMesh(rsS, 'glow', 9, 1.7); ms.position.set(D.x + 8.5, hy + 8, D.z + 40 - 35.6); ms.rotation.y = Math.PI; surf.add(ms); nearVis(ms, 500);
  const mats = { mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), ballast: new THREE.MeshStandardMaterial({ map: railTextures(), roughness: 0.95 }), rail: MATS.rail };
  cm.finish(mats, surf, { cast: { mat: true } });
  // abgestellte Züge (mittlere Detailstufe genügt)
  const parked = [[-14, [buildLocoAsset('re450'), buildDoubleDeckAsset(1, 'none'), buildDoubleDeckAsset(1, 'rear')], -40],
    [-9, [buildDoubleDeckAsset(2, 'front'), buildDoubleDeckAsset(2, 'none'), buildDoubleDeckAsset(2, 'rear')], 10],
    [-4, [buildLocoAsset('re460'), buildIRCoachAsset(), buildIRCoachAsset()], -60], [6, [buildForchbahnAsset()], 30], [11, [buildDoubleDeckAsset(2, 'front'), buildDoubleDeckAsset(2, 'rear')], 45]];
  for (const [q, cons, a0] of parked) {
    let a = a0;
    for (const asset of cons) {
      const inst = instantiateAsset(asset, { level: 'mid' });
      a += asset.len / 2;
      inst.g.position.set(D.x + q, yBase(a, q), D.z + a);
      inst.g.rotation.y = 0;
      surf.add(inst.g); nearVis(inst.g, 600);
      a += asset.len / 2 + 0.9;
    }
  }
}
