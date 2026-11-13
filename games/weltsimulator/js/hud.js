/* ================= ANZEIGE, KARTEN, LIFT-TABELLE, TÖNE ================= */

const HUD = { el: {}, map: null, mapScale: 0, mini: null, mapOpen: false, lastInfo: '' };

function initHUD() {
  for (const id of ['hud', 'clock', 'place', 'info', 'prompt', 'minimap', 'mapOverlay', 'bigmap', 'liftMenu', 'liftGrid', 'liftTitle', 'speedTag']) HUD.el[id] = document.getElementById(id);
  HUD.mini = HUD.el.minimap.getContext('2d');
}

/* Grundkarte einmal zeichnen */
function buildMapImage() {
  const S = 1400, cv = makeCanvas(S, S), ctx = cv.getContext('2d');
  const k = S / 5000;
  const X = (x) => (x + 2500) * k, Z = (z) => (z + 2500) * k;
  // Gelände
  const G = 175, cs = S / G;
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const x = -2500 + (i + 0.5) * 5000 / G, z = -2500 + (j + 0.5) * 5000 / G;
    const h = terrainH(x, z);
    let c;
    if (h < WS.WATER_Y) c = '#7fb3d0';
    else if (coastX(z) - x < 110 && veniceMask(x, z) < 0.5) c = '#eadcb2';
    else if (veniceMask(x, z) > 0.5) c = '#d8cfbf';
    else { const t = clamp((h - 3) / 160, 0, 1); const g = Math.round(lerp(205, 150, t)), r = Math.round(lerp(216, 170, t)); c = `rgb(${r},${g + 12},${Math.round(lerp(190, 140, t))})`; }
    ctx.fillStyle = c; ctx.fillRect(i * cs, j * cs, cs + 1, cs + 1);
  }
  // Parks
  ctx.fillStyle = '#a9d18e';
  for (const pk of ROADS.parks) { ctx.beginPath(); pk.poly.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Z(p[1])) : ctx.moveTo(X(p[0]), Z(p[1]))); ctx.fill(); }
  // Wasserläufe
  ctx.strokeStyle = '#7fb3d0'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const poly of WATER.polys) { ctx.lineWidth = poly.hw[0] * 2 * k; ctx.beginPath(); poly.pts.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Z(p[1])) : ctx.moveTo(X(p[0]), Z(p[1]))); ctx.stroke(); }
  // Gebäude
  ctx.fillStyle = '#c4beb4';
  for (const b of BLD.list) { const c = obbCorners(b.obb, 0); ctx.beginPath(); c.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Z(p[1])) : ctx.moveTo(X(p[0]), Z(p[1]))); ctx.fill(); }
  // Strassen
  for (const pass of [0, 1]) for (const e of ROADS.edges) {
    if (e.dead) continue;
    const A = ROADS.nodes[e.a], B = ROADS.nodes[e.b];
    ctx.strokeStyle = pass ? (e.type === 'alley' ? '#f4f1ea' : '#ffffff') : '#a9a49a';
    ctx.lineWidth = Math.max(1, (e.w + (pass ? 0 : 3)) * k);
    ctx.beginPath(); ctx.moveTo(X(A.x), Z(A.z)); ctx.lineTo(X(B.x), Z(B.z)); ctx.stroke();
  }
  // Bahnviadukte in der Grundkarte
  ctx.strokeStyle = '#7d7a73'; ctx.lineWidth = Math.max(2, 11 * k); ctx.lineCap = 'round';
  for (const line of RAIL.lines) { ctx.beginPath(); line.C.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Z(p[1])) : ctx.moveTo(X(p[0]), Z(p[1]))); if (line.ring) ctx.closePath(); ctx.stroke(); }
  if (typeof ISLE !== 'undefined' && ISLE.walk) { ctx.strokeStyle = '#f1ece2'; ctx.lineWidth = 4 * k + 1; ctx.beginPath(); ctx.moveTo(X(ISLE.walk.x0), Z(ISLE.walk.z)); ctx.lineTo(X(ISLE.walk.x1), Z(ISLE.walk.z)); ctx.stroke(); }
  HUD.base = cv; HUD.mapScale = k;
  // Netzplan-Ebene
  const net = makeCanvas(S, S), n = net.getContext('2d');
  n.drawImage(cv, 0, 0);
  n.fillStyle = 'rgba(255,255,255,0.35)'; n.fillRect(0, 0, S, S);
  for (const line of TRANSIT.busLines) {
    n.strokeStyle = line.color; n.globalAlpha = 0.55; n.lineWidth = 2; n.setLineDash([6, 4]);
    n.beginPath(); line.seq.forEach((p, i) => i ? n.lineTo(X(p.x), Z(p.z)) : n.moveTo(X(p.x), Z(p.z))); n.stroke();
  }
  n.setLineDash([]); n.globalAlpha = 1;
  if (TRANSIT.tram) { n.strokeStyle = '#1b5db5'; n.lineWidth = 5; n.beginPath(); TRANSIT.tram.C.forEach((p, i) => i ? n.lineTo(X(p[0]), Z(p[1])) : n.moveTo(X(p[0]), Z(p[1]))); n.stroke(); }
  if (TRANSIT.tram18) { n.strokeStyle = T18_DEF.color; n.lineWidth = 5; n.beginPath(); TRANSIT.tram18.C.forEach((p, i) => i ? n.lineTo(X(p[0]), Z(p[1])) : n.moveTo(X(p[0]), Z(p[1]))); n.stroke(); }
  // S-Bahn (doppelte dünne Linie) und IR (dicke Linie)
  for (const line of RAIL.lines) {
    const ir = line.kind === 'ir';
    n.lineCap = 'round';
    for (const [w, c] of ir ? [[11, '#ffffff'], [7, line.color]] : [[7, '#ffffff'], [4, line.color]]) {
      n.strokeStyle = c; n.lineWidth = w; n.beginPath(); line.C.forEach((p, i) => i ? n.lineTo(X(p[0]), Z(p[1])) : n.moveTo(X(p[0]), Z(p[1]))); if (line.ring) n.closePath(); n.stroke();
    }
  }
  for (const line of TRANSIT.metro) {
    n.strokeStyle = line.color; n.lineWidth = 8;
    n.beginPath(); line.C.forEach((p, i) => i ? n.lineTo(X(p[0]), Z(p[1])) : n.moveTo(X(p[0]), Z(p[1]))); n.stroke();
  }
  n.font = 'bold 13px Arial'; n.textBaseline = 'middle';
  const named = new Map();
  for (const st of TRANSIT.stations) { const k = st.name; if (!named.has(k)) named.set(k, { x: st.x, z: st.z, lines: [] }); named.get(k).lines.push(st.line.name); }
  for (const st of RAIL.stations) { const k = st.name; if (!named.has(k)) named.set(k, { x: st.x, z: st.z, lines: [] }); const o = named.get(k); if (!o.lines.includes(st.line.id)) o.lines.push(st.line.id); }
  for (const st of TRANSIT.stations) { n.fillStyle = '#fff'; n.strokeStyle = '#111'; n.lineWidth = 2.5; n.beginPath(); n.arc(X(st.x), Z(st.z), 6, 0, 7); n.fill(); n.stroke(); }
  for (const st of RAIL.stations) { n.fillStyle = '#fff'; n.strokeStyle = st.line.color; n.lineWidth = 3; n.fillRect(X(st.x) - 6, Z(st.z) - 6, 12, 12); n.strokeRect(X(st.x) - 6, Z(st.z) - 6, 12, 12); }
  for (const [name, o] of named) {
    if (name.startsWith('Hönggerberg/')) continue;
    n.fillStyle = '#111'; n.strokeStyle = 'rgba(255,255,255,0.9)'; n.lineWidth = 4; const t = o.lines.join('/') + ' ' + name;
    n.strokeText(t, X(o.x) + 10, Z(o.z)); n.fillText(t, X(o.x) + 10, Z(o.z));
  }
  // Knoten Hönggerberg: Abteile mit Buchstaben
  for (const k of ['S', 'Z', 'F', 'U', 'G', 'B', 'T', 'V', 'H']) {
    const h = HUB[k]; const x = X(k === 'B' && TRANSIT.busHub ? TRANSIT.busHub.x : h.x), z = Z(k === 'B' && TRANSIT.busHub ? TRANSIT.busHub.z : h.z);
    n.fillStyle = '#ffd400'; n.strokeStyle = '#123a7a'; n.lineWidth = 3; n.beginPath(); n.arc(x, z, 11, 0, 7); n.fill(); n.stroke();
    n.fillStyle = '#123a7a'; n.font = 'bold 14px Arial'; n.textAlign = 'center'; n.fillText(k, x, z + 1); n.textAlign = 'left'; n.font = 'bold 13px Arial';
  }
  n.font = 'bold 16px Arial'; n.fillStyle = '#123a7a'; n.strokeStyle = 'rgba(255,255,255,0.95)'; n.lineWidth = 5;
  n.strokeText('Hönggerberg', X(WS.HILL.x - 160), Z(WS.HILL.z - 230)); n.fillText('Hönggerberg', X(WS.HILL.x - 160), Z(WS.HILL.z - 230)); n.font = 'bold 13px Arial';
  for (const T of [TRANSIT.tram, TRANSIT.tram18]) if (T) for (const pl of T.platforms) { n.fillStyle = T === TRANSIT.tram ? '#1b5db5' : T18_DEF.color; n.fillRect(X(pl.x) - 3, Z(pl.z) - 3, 6, 6); }
  const seenT = new Set();
  for (const T of [TRANSIT.tram, TRANSIT.tram18]) if (T) for (const st of T.stations) {
    const pl = T.platforms.find(p => p.name === st.name); if (!pl || seenT.has(st.name) || st.name.startsWith('Hönggerberg/')) continue; seenT.add(st.name);
    const lab = (T === TRANSIT.tram ? 'T6 ' : 'T18 ') + st.name;
    n.font = 'italic 12px Arial'; n.fillStyle = T === TRANSIT.tram ? '#0d3b8c' : '#1d6b6d'; n.strokeStyle = 'rgba(255,255,255,0.9)'; n.lineWidth = 3; n.strokeText(lab, X(pl.x) + 6, Z(pl.z) - 9); n.fillText(lab, X(pl.x) + 6, Z(pl.z) - 9);
  }
  // Orte
  n.font = 'bold 22px Georgia'; n.fillStyle = 'rgba(40,40,40,0.75)';
  for (const [t, x, z] of [['Klein-Venedig', 1780, -1180], ['Riviera', 1820, 1100], ['ETH', WS.HILL.x - 20, WS.HILL.z - 90], ['Zentrum', WS.CENTER.x, WS.CENTER.z - 80], ['Meer', 2250, 300], ['Isla Venezia', ISLAND.x, ISLAND.z + 110]]) { n.textAlign = 'center'; n.fillText(t, X(x), Z(z)); }
  n.textAlign = 'left';
  HUD.net = net;
  HUD.el.bigmap.width = S; HUD.el.bigmap.height = S;
}

function drawBigMap() {
  const c = HUD.el.bigmap.getContext('2d');
  c.drawImage(HUD.net, 0, 0);
  const k = HUD.mapScale;
  let px = P.x, pz = P.z;
  if (GAME.mode === 'interior' && INT.b) { px = INT.b.x; pz = INT.b.z; }
  drawArrow(c, (px + 2500) * k, (pz + 2500) * k, P.yaw, 14, '#e8001c');
}
function drawArrow(c, x, y, yaw, s, col) {
  c.save(); c.translate(x, y); c.rotate(-yaw);
  c.fillStyle = col; c.strokeStyle = '#fff'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.65, s * 0.7); c.lineTo(0, s * 0.35); c.lineTo(-s * 0.65, s * 0.7); c.closePath(); c.fill(); c.stroke();
  c.restore();
}
function drawMinimap() {
  const c = HUD.mini, W = 210;
  const k = HUD.mapScale;
  let px = P.x, pz = P.z;
  if (GAME.mode === 'interior' && INT.b) { px = INT.b.x; pz = INT.b.z; }
  c.save();
  c.clearRect(0, 0, W, W);
  c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 2, 0, 7); c.clip();
  c.fillStyle = '#9bb'; c.fillRect(0, 0, W, W);
  c.translate(W / 2, W / 2);
  c.rotate(P.yaw);
  const zoom = 2.2;
  c.scale(zoom, zoom);
  c.drawImage(HUD.net, -(px + 2500) * k, -(pz + 2500) * k);
  c.restore();
  drawArrow(c, W / 2, W / 2, 0, 9, '#e8001c');
  c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 3; c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 2, 0, 7); c.stroke();
  // Nordpfeil
  const na = P.yaw;
  c.fillStyle = '#fff'; c.font = 'bold 13px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('N', W / 2 + Math.sin(na) * (W / 2 - 14), W / 2 - Math.cos(na) * (W / 2 - 14));
}

function fmtTime(h) { const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }

function updateHUD() {
  HUD.el.clock.textContent = fmtTime(GAME.hour) + (GAME.timeScale > 1 ? '  ⏩' : '');
  let place;
  if (GAME.mode === 'interior' && INT.b) place = buildingLabel(INT.b) + ' · ' + floorLabel(INT.b, INT.floor);
  else if (ELEV.ctx === 'roof' && ELEV.state !== 'none') place = buildingLabel(ELEV.b) + ' · Dach';
  else if (P.underground && !P.ride) {
    let nm = 'U-Bahn'; stationsNear(P.x, P.z, (st, lx, lz) => { if (Math.abs(lz) < 90) nm = 'Station ' + st.name + ' (' + st.line.name + ')'; }); place = nm;
  } else {
    const q = quarterAt(P.x, P.z), s = streetNameAt(P.x, P.z);
    place = WS.CITY_NAME + ' · ' + q + (s ? ' · ' + s : '');
    const rb = liftNear(P.x, P.z, P.y, 30); if (rb && P.y > rb.lift.y - 1) place = buildingLabel(rb) + ' · Dach';
  }
  if (P.char === 'dragon' && GAME.mode === 'world') place += P.rocket ? ' · 🚀 Raketenmodus ' + Math.round(P.rspd * 3.6) + ' km/h, Höhe ' + Math.max(0, Math.round(P.y - Math.max(terrainH(P.x, P.z), WS.WATER_Y))) + ' m'
    : P.flying ? ' · Drache, Flughöhe ' + Math.max(0, Math.round(P.y - terrainH(P.x, P.z))) + ' m' : ' · Drache';
  HUD.el.place.textContent = place;
  // Fahrzeug-Info
  let info = '';
  if (P.ride) {
    const v = P.ride.veh; const st = v.currentStop();
    const name = v.kind === 'metro' ? 'U-Bahn ' + v.line.name : (v.label || ('Bus ' + v.line.num));
    info = 'Du fährst mit: ' + name + (st ? ' · ' + (v.state === 'dwell' ? 'Halt: ' : 'nächster Halt: ') + st.stop.name : '');
    if (v.state === 'dwell') info += ' · Türen ' + (v.door > 0.5 ? 'offen' : 'schliessen') + ' (' + Math.max(0, Math.ceil(v.dwell)) + ' s)';
  } else if (GAME.mode === 'world') {
    let best = null, bd = 22;
    for (const v of VEH.list) {
      if (v.state !== 'dwell' || !!v.underground !== P.underground) continue;
      const p = v.cars[0].g.position; const d = Math.hypot(p.x - P.x, p.z - P.z) - v.totalLen / 2;
      if (d < bd) { bd = d; best = v; }
    }
    if (best) {
      const st = best.currentStop();
      const name = best.kind === 'metro' ? 'U-Bahn ' + best.line.name : (best.label || ('Bus ' + best.line.num));
      info = name + ' hält' + (st ? ' an „' + st.stop.name + '“' : '') + ' · Türen ' + (best.door > 0.5 ? 'offen – einsteigen!' : '…') + ' (' + Math.max(0, Math.ceil(best.dwell)) + ' s)';
    }
  }
  if (info !== HUD.lastInfo) { HUD.el.info.textContent = info; HUD.el.info.style.display = info ? 'block' : 'none'; HUD.lastInfo = info; }
  const pr = currentPrompt();
  HUD.el.prompt.textContent = pr; HUD.el.prompt.style.display = pr ? 'block' : 'none';
  drawMinimap();
  if (HUD.mapOpen) drawBigMap();
}

function toggleMap(force) {
  HUD.mapOpen = force !== undefined ? force : !HUD.mapOpen;
  HUD.el.mapOverlay.classList.toggle('hidden', !HUD.mapOpen);
  if (HUD.mapOpen) { drawBigMap(); if (document.pointerLockElement) document.exitPointerLock(); }
}

/* ---------- Lift-Tabelle ---------- */
let LIFT_SEL = 0, LIFT_LIST = [];
function showLiftMenu(b, cur) {
  const grid = HUD.el.liftGrid; grid.innerHTML = '';
  HUD.el.liftTitle.textContent = buildingLabel(b);
  LIFT_LIST = [];
  for (let f = b.floors; f >= 0; f--) LIFT_LIST.push(f);
  LIFT_LIST.forEach((f, i) => {
    const btn = document.createElement('button');
    btn.className = 'liftBtn' + (f === cur ? ' cur' : '');
    btn.innerHTML = '<b>' + floorShort(b, f) + '</b><span>' + floorLabel(b, f) + '</span>';
    btn.onclick = () => chooseFloor(f);
    grid.appendChild(btn);
  });
  LIFT_SEL = LIFT_LIST.indexOf(cur === b.floors ? 0 : b.floors);
  if (LIFT_SEL < 0) LIFT_SEL = 0;
  markLiftSel();
  HUD.el.liftMenu.classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}
function markLiftSel() { [...HUD.el.liftGrid.children].forEach((c, i) => c.classList.toggle('sel', i === LIFT_SEL)); const el = HUD.el.liftGrid.children[LIFT_SEL]; if (el) el.scrollIntoView({ block: 'nearest' }); }
function liftMenuKey(code) {
  const cols = Math.max(1, Math.round(HUD.el.liftGrid.clientWidth / 96));
  if (code === 'ArrowDown') LIFT_SEL = Math.min(LIFT_LIST.length - 1, LIFT_SEL + cols);
  else if (code === 'ArrowUp') LIFT_SEL = Math.max(0, LIFT_SEL - cols);
  else if (code === 'ArrowRight') LIFT_SEL = Math.min(LIFT_LIST.length - 1, LIFT_SEL + 1);
  else if (code === 'ArrowLeft') LIFT_SEL = Math.max(0, LIFT_SEL - 1);
  else if (code === 'Enter' || code === 'Space') { if (LIFTS.menu) stationLiftChoose(LIFT_LIST[LIFT_SEL]); else chooseFloor(LIFT_LIST[LIFT_SEL]); return; }
  else if (code === 'Escape') { if (LIFTS.menu) stationLiftCancel(); else cancelLift(); return; }
  markLiftSel();
}
function hideLiftMenu() { HUD.el.liftMenu.classList.add('hidden'); }

/* ---------- Töne (WebAudio, ohne Dateien) ---------- */
const AUD = { ctx: null, hum: null };
function audioCtx() {
  if (!AUD.ctx) { try { AUD.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AUD.ctx = null; } }
  if (AUD.ctx && AUD.ctx.state === 'suspended') AUD.ctx.resume();
  return AUD.ctx;
}
function tone(freq, t0, dur, vol, type) {
  const c = audioCtx(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + t0); g.gain.linearRampToValueAtTime(vol, c.currentTime + t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur);
  o.connect(g); g.connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.05);
}
function sfxDing() { tone(1318, 0, 0.6, 0.12); tone(1046, 0.18, 0.9, 0.1); }
function sfxDoor() { tone(180, 0, 0.18, 0.08, 'triangle'); tone(120, 0.08, 0.25, 0.06, 'triangle'); }
function sfxStep() { tone(220, 0, 0.08, 0.05, 'triangle'); }
function sfxRocket() {
  const c = audioCtx(); if (!c) return;
  // Zündung: tiefer Knall und aufsteigendes Fauchen
  tone(70, 0, 0.5, 0.18, 'sawtooth'); tone(110, 0.02, 0.4, 0.1, 'square');
  const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(90, c.currentTime); o.frequency.exponentialRampToValueAtTime(420, c.currentTime + 0.7);
  g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.linearRampToValueAtTime(0.06, c.currentTime + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.9);
  o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 1);
}
function sfxMorph() { tone(392, 0, 0.15, 0.08, 'triangle'); tone(587, 0.08, 0.2, 0.08, 'triangle'); tone(880, 0.16, 0.35, 0.07, 'sine'); }
function sfxChime() { tone(784, 0, 0.35, 0.08); tone(659, 0.3, 0.35, 0.08); tone(523, 0.6, 0.6, 0.08); }
function sfxHum(on) {
  const c = audioCtx(); if (!c) return;
  if (on && !AUD.hum) {
    const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 55; f.type = 'lowpass'; f.frequency.value = 180; g.gain.value = 0.0;
    g.gain.linearRampToValueAtTime(0.05, c.currentTime + 0.5);
    o.connect(f); f.connect(g); g.connect(c.destination); o.start(); AUD.hum = { o, g };
  } else if (!on && AUD.hum) { const h = AUD.hum; h.g.gain.linearRampToValueAtTime(0, c.currentTime + 0.3); h.o.stop(c.currentTime + 0.35); AUD.hum = null; }
}
