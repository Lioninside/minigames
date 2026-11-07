/* ================= INNENRÄUME & LIFT =================
   Jedes Stockwerk wird beim Betreten aus Gebäude-Nummer und Stockwerk erzeugt, deshalb sieht
   jede Etage anders aus und bleibt trotzdem bei jedem Besuch gleich.
   Kategorien: Luxushotel, Firmengebäude, normales Büro, ETH, Halle.
   Der Lift (Kabine mit Schiebetüren und Stockwerksanzeige) wird innen und auf dem Dach benutzt. */

const INT = { scene: null, group: null, b: null, floor: 0, W: 0, D: 0, H: 0, colliders: [], exit: null, lift: null, mats: null, viewMat: null, lights: [] };

function initInteriorMats() {
  const tex = (draw, w, h, rep) => { const cv = makeCanvas(w || 256, h || 256); draw(cv.getContext('2d'), cv.width, cv.height); const t = canvasTex(cv); if (rep) t.repeat.set(rep, rep); return t; };
  const marble = tex((c, w, h) => { c.fillStyle = '#ece8e1'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(120,110,100,0.25)'; for (let i = 0; i < 18; i++) { c.lineWidth = rr(0.5, 2); c.beginPath(); let x = rnd() * w, y = rnd() * h; c.moveTo(x, y); for (let k = 0; k < 10; k++) { x += rr(-30, 30); y += rr(-30, 30); c.lineTo(x, y); } c.stroke(); } c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, 0, w, 2); c.fillRect(0, 0, 2, h); });
  const parquet = tex((c, w, h) => { c.fillStyle = '#6e4a2c'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = -64; x < w + 64; x += 64) { const v = rr(-18, 18); c.fillStyle = `rgb(${150 + v | 0},${100 + v * 0.7 | 0},${62 + v * 0.5 | 0})`; c.fillRect(x + ((y / 16) % 2) * 32, y, 63, 15); } });
  const carpet = tex((c, w, h) => { c.fillStyle = '#5a5f66'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(${rnd() * 255 | 0},${rnd() * 255 | 0},${rnd() * 255 | 0},0.06)`; c.fillRect(rnd() * w, rnd() * h, 2, 2); } c.strokeStyle = 'rgba(0,0,0,0.15)'; for (let i = 0; i < w; i += 64) { c.strokeRect(i, 0, 64, h); } c.strokeRect(0, 0, w, 64); });
  const ceiling = tex((c, w, h) => { c.fillStyle = '#f2f2ef'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 2; for (let i = 0; i <= w; i += 64) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); } });
  const screen = tex((c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1d3d6b'); g.addColorStop(1, '#0c1a33'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(0, 0, w, 14); for (let i = 0; i < 12; i++) { c.fillStyle = `rgba(${150 + rnd() * 100 | 0},${180 + rnd() * 70 | 0},255,0.7)`; c.fillRect(20, 30 + i * 16, rr(60, 200), 8); } c.fillStyle = '#3fa9f5'; c.fillRect(150, 120, 80, 100); });
  const books = tex((c, w, h) => { c.fillStyle = '#3b2a1c'; c.fillRect(0, 0, w, h); for (let row = 0; row < 4; row++) { let x = 2; while (x < w - 4) { const bw = rr(5, 12); c.fillStyle = pick(['#7a1f1f', '#1f3f7a', '#2f5d3a', '#a07a2f', '#5a2f6b', '#d8cfb8', '#1a1a1a', '#8a4a20']); c.fillRect(x, row * 64 + 8, bw, 54); x += bw + 1; } c.fillStyle = '#5a3f28'; c.fillRect(0, row * 64 + 60, w, 4); } });
  const rug = (cols) => tex((c, w, h) => { c.fillStyle = cols[0]; c.fillRect(0, 0, w, h); c.strokeStyle = cols[1]; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28); c.lineWidth = 3; c.strokeRect(30, 30, w - 60, h - 60); c.fillStyle = cols[1]; c.beginPath(); c.ellipse(w / 2, h / 2, w * 0.22, h * 0.16, 0, 0, 7); c.fill(); c.fillStyle = cols[2]; c.beginPath(); c.ellipse(w / 2, h / 2, w * 0.12, h * 0.08, 0, 0, 7); c.fill(); for (let i = 0; i < 40; i++) { c.fillStyle = cols[2]; c.fillRect(rr(40, w - 40), rr(40, h - 40), 4, 4); } });
  const board = tex((c, w, h) => { c.fillStyle = '#2d3b33'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 2; c.font = '18px serif'; c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillText('∮ E·dA = Q/ε₀', 20, 50); c.fillText('∇×B = μ₀J + μ₀ε₀ ∂E/∂t', 20, 90); c.fillText('e^{iπ} + 1 = 0', 20, 130); c.beginPath(); c.arc(190, 190, 40, 0, 5); c.stroke(); c.fillText('f(x)=∑ aₙxⁿ', 20, 200); });
  const std = (o) => new THREE.MeshStandardMaterial(o);
  INT.mats = {
    marble: std({ map: marble, roughness: 0.15, metalness: 0.0 }), parquet: std({ map: parquet, roughness: 0.45 }), carpet: std({ map: carpet, roughness: 0.95 }),
    ceiling: std({ map: ceiling, roughness: 0.9 }), wall: std({ color: 0xf1eee8, roughness: 0.9 }),
    woodDark: std({ color: 0x4a2e1c, roughness: 0.45 }), woodLight: std({ color: 0xb98a5a, roughness: 0.5 }), white: std({ color: 0xf4f4f2, roughness: 0.5 }),
    black: std({ color: 0x16171a, roughness: 0.4 }), metal: std({ color: 0xa9afb5, roughness: 0.25, metalness: 0.9 }), gold: std({ color: 0xc9a042, roughness: 0.3, metalness: 0.9 }),
    screen: std({ map: screen, emissive: 0xffffff, emissiveMap: screen, emissiveIntensity: 0.8, roughness: 0.2 }),
    fabricRed: std({ color: 0x8c1d2a, roughness: 0.95 }), fabricBlue: std({ color: 0x23406e, roughness: 0.95 }), fabricGreen: std({ color: 0x2f5d43, roughness: 0.95 }),
    fabricBeige: std({ color: 0xd8c8a8, roughness: 0.95 }), fabricGray: std({ color: 0x5c6066, roughness: 0.95 }), leather: std({ color: 0x3a2418, roughness: 0.5 }),
    linen: std({ color: 0xfaf8f2, roughness: 0.9 }), lampshade: std({ color: 0xfff1d0, emissive: 0xffd9a0, emissiveIntensity: 0.9, roughness: 0.8 }),
    light: std({ color: 0xffffff, emissive: 0xfff8ec, emissiveIntensity: 1.2 }), glass: new THREE.MeshPhysicalMaterial({ color: 0xcfe6f0, roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false }),
    plant: std({ color: 0x3f7a35, roughness: 0.8 }), pot: std({ color: 0xc66a3e, roughness: 0.8 }), books: std({ map: books, roughness: 0.8 }),
    board: std({ map: board, roughness: 0.9 }), crystal: std({ color: 0xfff6e0, emissive: 0xffe6b0, emissiveIntensity: 1.1, roughness: 0.1, metalness: 0.3 }),
    rugs: [rug(['#7a1f2a', '#d8b56a', '#1f2f5a']), rug(['#1f3a5a', '#d8c8a0', '#7a2a1f']), rug(['#2f4a3a', '#e0d0a0', '#5a1f2f']), rug(['#c8b89a', '#6a3a2a', '#2a3a5a'])].map(t => std({ map: t, roughness: 0.95 })),
    clockFace: std({ map: tex((c, w, h) => { c.fillStyle = '#f6efdc'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, 7); c.fill(); c.strokeStyle = '#2a1c10'; c.lineWidth = 6; c.stroke(); c.fillStyle = '#2a1c10'; c.font = 'bold 26px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2 - Math.PI / 2; c.fillText(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][i - 1], w / 2 + Math.cos(a) * 92, h / 2 + Math.sin(a) * 92); } c.lineWidth = 5; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + 40, h / 2 - 40); c.stroke(); c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2, h / 2 - 80); c.stroke(); }), roughness: 0.4 }),
    led: std({ color: 0x22ff66, emissive: 0x22ff66, emissiveIntensity: 1.5 }),
    pingpong: std({ color: 0x1d4e8f, roughness: 0.6 }), beanbag: std({ color: 0xe0612a, roughness: 0.95 })
  };
  const vcv = makeCanvas(512, 256), vctx = vcv.getContext('2d');
  const g = vctx.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#9cc4e4'); g.addColorStop(0.65, '#dfe9f0'); g.addColorStop(1, '#b8c2c8'); vctx.fillStyle = g; vctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 40; i++) { const x = rnd() * 512, w = rr(10, 40), h = rr(30, 120); vctx.fillStyle = `rgba(${90 + rnd() * 50 | 0},${100 + rnd() * 50 | 0},${115 + rnd() * 40 | 0},0.85)`; vctx.fillRect(x, 256 - h, w, h); }
  const vt = canvasTex(vcv); vt.wrapS = THREE.RepeatWrapping;
  INT.viewMat = new THREE.MeshBasicMaterial({ map: vt, color: 0xffffff });
}

/* ---------- Möbel ---------- */
function F() { return INT.mats; }
function addBox(g, mat, x, y, z, sx, sy, sz, ry) { const m = new THREE.Mesh(INT_BOX, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); if (ry) m.rotation.y = ry; g.add(m); return m; }
function addCyl(g, mat, x, y, z, r, h, seg) { const m = new THREE.Mesh(seg === 6 ? INT_CYL6 : INT_CYL, mat); m.scale.set(r, h, r); m.position.set(x, y, z); g.add(m); return m; }
let INT_BOX, INT_CYL, INT_CYL6, INT_SPH;
function col(x0, z0, x1, z1) { INT.colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) }); }
/* Gruppe an Position/Rotation, Kollision als Rechteck (lokal hw, hd) */
function place(g, x, z, rot, hw, hd) {
  g.position.set(x, 0, z); g.rotation.y = rot || 0;
  INT.group.add(g);
  if (hw) {
    const c = Math.abs(Math.cos(rot || 0)), s = Math.abs(Math.sin(rot || 0));
    const ex = hw * c + hd * s, ez = hw * s + hd * c;
    col(x - ex, z - ez, x + ex, z + ez);
  }
  return g;
}
function mkChair(fab) {
  const g = new THREE.Group(), M = F();
  addBox(g, fab || M.fabricGray, 0, 0.48, 0, 0.5, 0.08, 0.5); addBox(g, fab || M.fabricGray, 0, 0.85, -0.23, 0.48, 0.6, 0.07);
  addCyl(g, M.black, 0, 0.25, 0, 0.04, 0.45); addBox(g, M.black, 0, 0.04, 0, 0.6, 0.04, 0.08); addBox(g, M.black, 0, 0.04, 0, 0.08, 0.04, 0.6);
  return g;
}
function mkDesk(w, d, big, monitors, wood) {
  const g = new THREE.Group(), M = F();
  addBox(g, wood || M.white, 0, 0.74, 0, w, 0.05, d);
  for (const [x, z] of [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]]) addBox(g, M.metal, x, 0.37, z, 0.05, 0.72, 0.05);
  const n = monitors || 1;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * (big ? 0.72 : 0.58);
    const mw = big ? 0.68 : 0.55, mh = big ? 0.42 : 0.34;
    addBox(g, M.black, x, 0.79 + 0.02, -d / 2 + 0.25, 0.22, 0.02, 0.16);
    addBox(g, M.black, x, 0.95, -d / 2 + 0.25, 0.04, 0.3, 0.04);
    const scr = addBox(g, M.black, x, 1.08 + mh / 2 - 0.1, -d / 2 + 0.22, mw, mh, 0.03);
    const face = new THREE.Mesh(INT_PLANE, M.screen); face.scale.set(mw - 0.04, mh - 0.04, 1); face.position.set(x, 1.08 + mh / 2 - 0.1, -d / 2 + 0.24); g.add(face);
  }
  addBox(g, M.black, 0, 0.78, 0.05, 0.45, 0.02, 0.15);
  if (big) { addBox(g, M.black, w / 2 - 0.25, 0.25, -d / 2 + 0.3, 0.2, 0.45, 0.42); const led = addBox(g, M.led, w / 2 - 0.25, 0.4, -d / 2 + 0.51, 0.02, 0.02, 0.01); }
  return g;
}
function mkPlant(h) {
  const g = new THREE.Group(), M = F();
  addCyl(g, M.pot, 0, 0.22, 0, 0.25, 0.44);
  for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(INT_SPH, M.plant); const s = rr(0.25, 0.4) * (h || 1); m.scale.set(s, s * 1.4, s); m.position.set(rr(-0.15, 0.15), 0.6 + i * 0.18 * (h || 1), rr(-0.15, 0.15)); g.add(m); }
  return g;
}
function mkSofa(fab, w) {
  const g = new THREE.Group(); w = w || 2.2;
  addBox(g, fab, 0, 0.25, 0, w, 0.4, 0.9); addBox(g, fab, 0, 0.55, -0.35, w, 0.6, 0.2);
  addBox(g, fab, -w / 2 + 0.1, 0.45, 0, 0.2, 0.45, 0.9); addBox(g, fab, w / 2 - 0.1, 0.45, 0, 0.2, 0.45, 0.9);
  for (let i = 0; i < Math.round(w / 0.8); i++) addBox(g, fab, -w / 2 + 0.4 + i * 0.75, 0.5, 0.05, 0.68, 0.12, 0.7);
  return g;
}
function mkArmchair(fab) {
  const g = new THREE.Group(), M = F();
  addBox(g, fab, 0, 0.28, 0, 0.85, 0.36, 0.85); addBox(g, fab, 0, 0.7, -0.34, 0.85, 0.75, 0.18);
  addBox(g, fab, -0.38, 0.55, 0, 0.12, 0.3, 0.85); addBox(g, fab, 0.38, 0.55, 0, 0.12, 0.3, 0.85);
  for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) addBox(g, M.woodDark, x, 0.05, z, 0.06, 0.1, 0.06);
  return g;
}
function mkBed(fabric) {
  const g = new THREE.Group(), M = F();
  addBox(g, M.woodDark, 0, 0.25, 0, 1.9, 0.3, 2.15); addBox(g, M.linen, 0, 0.5, 0.05, 1.8, 0.22, 2.0);
  addBox(g, fabric, 0, 0.63, 0.35, 1.84, 0.06, 1.35);
  addBox(g, M.linen, -0.45, 0.68, -0.7, 0.7, 0.16, 0.4); addBox(g, M.linen, 0.45, 0.68, -0.7, 0.7, 0.16, 0.4);
  addBox(g, M.woodDark, 0, 0.75, -1.08, 2.0, 1.2, 0.1);
  return g;
}
function mkNightstand() {
  const g = new THREE.Group(), M = F();
  addBox(g, M.woodDark, 0, 0.28, 0, 0.5, 0.56, 0.42);
  addCyl(g, M.gold, 0, 0.62, 0, 0.08, 0.1); addCyl(g, M.gold, 0, 0.8, 0, 0.015, 0.35);
  const sh = addCyl(g, M.lampshade, 0, 1.02, 0, 0.17, 0.22);
  return g;
}
function mkFloorLamp() {
  const g = new THREE.Group(), M = F();
  addCyl(g, M.gold, 0, 0.02, 0, 0.18, 0.04); addCyl(g, M.gold, 0, 0.8, 0, 0.02, 1.55); addCyl(g, M.lampshade, 0, 1.65, 0, 0.24, 0.32);
  return g;
}
function mkGrandfatherClock() {
  const g = new THREE.Group(), M = F();
  addBox(g, M.woodDark, 0, 0.9, 0, 0.55, 1.8, 0.35); addBox(g, M.woodDark, 0, 2.05, 0, 0.62, 0.5, 0.4);
  addBox(g, M.woodDark, 0, 2.36, 0, 0.7, 0.1, 0.44);
  const face = new THREE.Mesh(INT_PLANE, M.clockFace); face.scale.set(0.42, 0.42, 1); face.position.set(0, 2.05, 0.205); g.add(face);
  addBox(g, M.glass, 0, 1.0, 0.18, 0.4, 1.1, 0.02);
  const pend = addCyl(g, M.gold, 0, 0.75, 0.12, 0.09, 0.02); pend.rotation.x = Math.PI / 2; pend.userData.pendulum = true;
  addBox(g, M.gold, 0, 1.15, 0.12, 0.015, 0.75, 0.015).userData.pendulum = true;
  return g;
}
function mkWardrobe() { const g = new THREE.Group(), M = F(); addBox(g, M.woodDark, 0, 1.1, 0, 1.6, 2.2, 0.6); addBox(g, M.gold, -0.06, 1.1, 0.31, 0.02, 0.25, 0.02); addBox(g, M.gold, 0.06, 1.1, 0.31, 0.02, 0.25, 0.02); return g; }
function mkShelf(w) { const g = new THREE.Group(), M = F(); w = w || 2; addBox(g, M.woodDark, 0, 1.1, 0, w, 2.2, 0.4); const f = new THREE.Mesh(INT_PLANE, M.books); f.scale.set(w - 0.1, 2.05, 1); f.position.set(0, 1.12, 0.205); g.add(f); return g; }
function mkTable(w, d, mat, h) { const g = new THREE.Group(), M = F(); h = h || 0.75; addBox(g, mat || M.woodDark, 0, h, 0, w, 0.06, d); for (const [x, z] of [[-w / 2 + 0.1, -d / 2 + 0.1], [w / 2 - 0.1, -d / 2 + 0.1], [-w / 2 + 0.1, d / 2 - 0.1], [w / 2 - 0.1, d / 2 - 0.1]]) addBox(g, mat || M.woodDark, x, h / 2, z, 0.07, h, 0.07); return g; }
function mkRug(w, d) { const g = new THREE.Group(); const m = new THREE.Mesh(INT_PLANE, pick(F().rugs)); m.rotation.x = -Math.PI / 2; m.scale.set(w, d, 1); m.position.y = 0.012; g.add(m); return g; }
function mkChandelier(y) {
  const g = new THREE.Group(), M = F();
  addCyl(g, M.gold, 0, y - 0.4, 0, 0.02, 0.8); addCyl(g, M.gold, 0, y - 0.85, 0, 0.5, 0.06);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const m = new THREE.Mesh(INT_SPH, M.crystal); m.scale.setScalar(0.09); m.position.set(Math.cos(a) * 0.55, y - 1.0, Math.sin(a) * 0.55); g.add(m); }
  const c = new THREE.Mesh(INT_SPH, M.crystal); c.scale.set(0.25, 0.35, 0.25); c.position.set(0, y - 1.15, 0); g.add(c);
  return g;
}
function mkReception(w, mat) { const g = new THREE.Group(), M = F(); addBox(g, mat || M.woodDark, 0, 0.55, 0, w, 1.1, 0.8); addBox(g, M.marble, 0, 1.13, 0.05, w + 0.1, 0.06, 0.95); addBox(g, M.gold, 0, 0.9, 0.41, w, 0.04, 0.02); return g; }
function mkLecternRow(w, n) { const g = new THREE.Group(), M = F(); addBox(g, M.woodLight, 0, 0.8, 0, w, 0.05, 0.5); addBox(g, M.woodLight, 0, 0.4, 0.24, w, 0.8, 0.04); for (let i = 0; i < n; i++) { const x = -w / 2 + 0.35 + i * (w - 0.7) / Math.max(1, n - 1); addBox(g, M.woodLight, x, 0.45, 0.75, 0.45, 0.05, 0.4); addBox(g, M.woodLight, x, 0.7, 0.95, 0.45, 0.45, 0.04); } return g; }
function mkServerRack() { const g = new THREE.Group(), M = F(); addBox(g, M.black, 0, 1.0, 0, 0.6, 2.0, 1.0); for (let i = 0; i < 12; i++) addBox(g, i % 3 ? M.led : M.screen, rr(-0.2, 0.2), 0.3 + i * 0.13, 0.51, 0.03, 0.02, 0.01); return g; }
function mkPingPong() { const g = new THREE.Group(), M = F(); addBox(g, M.pingpong, 0, 0.76, 0, 1.52, 0.04, 2.74); addBox(g, M.white, 0, 0.85, 0, 1.6, 0.15, 0.02); for (const [x, z] of [[-0.6, -1.1], [0.6, -1.1], [-0.6, 1.1], [0.6, 1.1]]) addBox(g, M.black, x, 0.38, z, 0.06, 0.76, 0.06); return g; }
function mkBeanbag() { const g = new THREE.Group(); const m = new THREE.Mesh(INT_SPH, F().beanbag); m.scale.set(0.5, 0.35, 0.5); m.position.y = 0.3; g.add(m); return g; }
function mkWhiteboard() { const g = new THREE.Group(), M = F(); addBox(g, M.white, 0, 1.5, 0, 2.4, 1.2, 0.04); addBox(g, M.metal, 0, 0.9, 0.05, 2.4, 0.04, 0.08); return g; }
function mkWaterCooler() { const g = new THREE.Group(), M = F(); addBox(g, M.white, 0, 0.5, 0, 0.35, 1.0, 0.35); const b = addCyl(g, M.glass, 0, 1.2, 0, 0.15, 0.4); return g; }
function mkCabinet(w) { const g = new THREE.Group(), M = F(); addBox(g, M.metal, 0, 0.65, 0, w || 1.2, 1.3, 0.45); return g; }
function mkColumn(h, r, mat) { const g = new THREE.Group(), M = F(); addCyl(g, mat || M.marble, 0, h / 2, 0, r, h); addBox(g, M.gold, 0, h - 0.15, 0, r * 2.6, 0.3, r * 2.6); addBox(g, mat || M.marble, 0, 0.15, 0, r * 2.6, 0.3, r * 2.6); return g; }
function mkTV(w) { const g = new THREE.Group(), M = F(); addBox(g, M.black, 0, 0, 0, w, w * 0.56, 0.05); const f = new THREE.Mesh(INT_PLANE, M.screen); f.scale.set(w - 0.06, w * 0.56 - 0.06, 1); f.position.z = 0.03; g.add(f); return g; }
function mkTurnstile() { const g = new THREE.Group(), M = F(); addBox(g, M.metal, 0, 0.5, 0, 0.25, 1.0, 1.2); addBox(g, M.glass, 0.35, 0.8, 0, 0.5, 0.6, 0.02); return g; }

/* ---------- Lift-Kabine (innen und auf dem Dach) ---------- */
function makeCabin(withShell) {
  const M = F();
  const g = new THREE.Group();
  const wallM = new THREE.MeshStandardMaterial({ color: 0xb9bfc5, roughness: 0.25, metalness: 0.85, side: THREE.BackSide });
  const inner = new THREE.Mesh(new THREE.BoxGeometry(2.9, 2.75, 2.9), wallM);
  inner.position.set(0, 1.375, -0.05);
  g.add(inner);
  // Front mit Türöffnung (Innenseite)
  const frontM = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.3, metalness: 0.8 });
  addBox(g, frontM, -1.2, 1.375, 1.38, 0.8, 2.75, 0.06); addBox(g, frontM, 1.2, 1.375, 1.38, 0.8, 2.75, 0.06); addBox(g, frontM, 0, 2.5, 1.38, 1.6, 0.5, 0.06);
  addBox(g, M.light, 0, 2.72, -0.05, 1.6, 0.02, 1.6);
  addBox(g, new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 }), 0, 0.01, -0.05, 2.85, 0.02, 2.85);
  addBox(g, M.metal, -1.42, 1.0, -0.05, 0.04, 0.05, 2.6);
  // Spiegel hinten
  addBox(g, new THREE.MeshStandardMaterial({ color: 0xdfe8ee, roughness: 0.02, metalness: 1.0 }), 0, 1.5, -1.48, 1.8, 1.6, 0.02);
  // Bedienfeld
  addBox(g, M.black, 1.05, 1.3, 1.33, 0.25, 0.6, 0.03);
  // Anzeige über der Tür (innen und aussen)
  const cv = makeCanvas(128, 64);
  const tex = canvasTex(cv, { clamp: true });
  const dispM = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.0 });
  const dIn = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), dispM); dIn.position.set(0, 2.42, 1.34); dIn.rotation.y = Math.PI; g.add(dIn);
  const dOut = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), dispM); dOut.position.set(0, 2.55, 1.66); g.add(dOut);
  // Türen
  const doorM = new THREE.MeshStandardMaterial({ map: BLD.mats.liftdoor.map, roughness: 0.3, metalness: 0.85 });
  const dl = addBox(g, doorM, -0.4, 1.1, 1.5, 0.8, 2.2, 0.05), dr = addBox(g, doorM, 0.4, 1.1, 1.5, 0.8, 2.2, 0.05);
  if (withShell) {
    const shellM = new THREE.MeshStandardMaterial({ color: 0xcfcac0, roughness: 0.8 });
    addBox(g, shellM, 0, 1.5, -1.6, 3.2, 3.0, 0.1); addBox(g, shellM, -1.6, 1.5, 0, 0.1, 3.0, 3.2); addBox(g, shellM, 1.6, 1.5, 0, 0.1, 3.0, 3.2);
    addBox(g, shellM, -1.2, 1.5, 1.6, 0.8, 3.0, 0.1); addBox(g, shellM, 1.2, 1.5, 1.6, 0.8, 3.0, 0.1); addBox(g, shellM, 0, 2.6, 1.6, 1.6, 0.8, 0.1);
    addBox(g, new THREE.MeshStandardMaterial({ color: 0x8f8b84, roughness: 0.8 }), 0, 3.05, 0, 3.6, 0.15, 3.6);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  const cab = {
    g, dl, dr, open: 0, cv, tex, label: '',
    setOpen(f) { this.open = f; this.dl.position.x = -0.4 - f * 0.78; this.dr.position.x = 0.4 + f * 0.78; },
    setLabel(t, arrow) {
      if (t === this.label + (arrow || '')) return;
      this.label = t + (arrow || '');
      const c = this.cv.getContext('2d'); c.fillStyle = '#050505'; c.fillRect(0, 0, 128, 64);
      c.fillStyle = '#ff5a1f'; c.font = 'bold 40px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText((arrow || '') + t, 64, 34); this.tex.needsUpdate = true;
    }
  };
  cab.setOpen(0); cab.setLabel('EG');
  return cab;
}

/* ---------- Stockwerk erzeugen ---------- */
function floorLabel(b, f) { if (f >= b.floors) return 'Dach'; if (f === 0) return 'EG'; return f + '. OG'; }
function floorShort(b, f) { if (f >= b.floors) return 'D'; if (f === 0) return 'EG'; return String(f); }

function buildInterior(b, f) {
  if (!INT.mats) { initInteriorMats(); INT_BOX = new THREE.BoxGeometry(1, 1, 1); INT_CYL = new THREE.CylinderGeometry(1, 1, 1, 16); INT_CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6); INT_SPH = new THREE.SphereGeometry(1, 14, 10); INT_PLANE = new THREE.PlaneGeometry(1, 1); }
  if (!INT.scene) {
    INT.scene = new THREE.Scene();
    INT.hemi = new THREE.HemisphereLight(0xfff8ee, 0x8a7a6a, 0.55); INT.scene.add(INT.hemi);
    INT.amb = new THREE.AmbientLight(0xffffff, 0.25); INT.scene.add(INT.amb);
    INT.cab = makeCabin(false);
    INT.scene.add(INT.cab.g);
  }
  if (INT.group) { INT.scene.remove(INT.group); INT.group.traverse(o => { if (o.isMesh && o.geometry !== INT_BOX && o.geometry !== INT_CYL && o.geometry !== INT_SPH && o.geometry !== INT_PLANE && o.geometry !== INT_CYL6) o.geometry.dispose(); }); }
  for (const l of INT.lights) INT.scene.remove(l);
  INT.lights = [];
  INT.group = new THREE.Group(); INT.scene.add(INT.group);
  INT.colliders = [];
  INT.b = b; INT.floor = f;
  seedRng(b.id * 7919 + f * 104729 + 17);
  const big = b.cat === 'eth' || b.cat === 'halle';
  const W = clamp(Math.round(b.w - 1), 14, big ? 46 : 40), D = clamp(Math.round(b.d - 1), 12, big ? 32 : 30);
  const H = f === 0 ? (b.cat === 'hotel' ? 6 : big ? 8.5 : 4.2) : (big ? 4.6 : 3.3);
  INT.W = W; INT.D = D; INT.H = H;
  const M = F();
  // Boden und Decke je nach Kategorie
  let floorMat = M.carpet, wallCol = 0xf1eee8;
  if (b.cat === 'hotel') { floorMat = f === 0 ? M.marble : M.carpet; wallCol = pick([0xf2e8d5, 0xe8dcc8, 0xdfe6e2, 0xf0e1d8, 0xe6e0ef, 0xf3eddc]); }
  else if (b.cat === 'firma') { floorMat = f === 0 ? M.marble : pick([M.carpet, M.parquet]); wallCol = pick([0xf4f4f2, 0xe9eef2, 0xeef0ea]); }
  else if (big) { floorMat = f === 0 ? M.marble : M.parquet; wallCol = 0xf0e8d8; }
  else { floorMat = pick([M.carpet, M.parquet, M.carpet]); wallCol = pick([0xf1eee8, 0xeef1f3, 0xf3efe6]); }
  const wallMat = new THREE.MeshStandardMaterial({ color: wallCol, roughness: 0.9 });
  const fm = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat); fm.rotation.x = -Math.PI / 2;
  if (floorMat.map) { const k = floorMat === M.parquet ? 2.2 : 4; fm.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 ? D / k : W / k); }); }
  INT.group.add(fm);
  const cm = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.ceiling); cm.rotation.x = Math.PI / 2; cm.position.y = H;
  cm.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 ? D / 2.4 : W / 2.4); });
  INT.group.add(cm);
  // Lift hinten
  const liftX = W > 18 ? W / 2 - 3.2 : 0;
  INT.lift = { x: liftX, z: -D / 2 };
  INT.cab.g.position.set(liftX, 0, -D / 2 - 1.62); INT.cab.g.rotation.y = 0;
  INT.cab.setOpen(0); INT.cab.setLabel(floorShort(b, f));
  // Wände mit Fenstern
  const winTop = Math.min(H - 0.4, 2.6 + (H - 3.3) * 0.6), winBot = 0.85;
  const wall = (x0, z0, x1, z1, openings) => {
    // openings: [{a0,a1,y0,y1,win}] entlang der Wand (Meter ab x0/z0)
    const len = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / len, dz = (z1 - z0) / len;
    const rot = Math.atan2(dx, dz) - Math.PI / 2;
    const seg = (a0, a1, y0, y1, mat) => {
      if (a1 - a0 < 0.01 || y1 - y0 < 0.01) return;
      const m = new THREE.Mesh(INT_BOX, mat);
      const am = (a0 + a1) / 2;
      m.scale.set(a1 - a0, y1 - y0, 0.2); m.position.set(x0 + dx * am, (y0 + y1) / 2, z0 + dz * am); m.rotation.y = rot;
      INT.group.add(m);
    };
    const ops = (openings || []).slice().sort((p, q) => p.a0 - q.a0);
    let a = 0;
    for (const o of ops) {
      seg(a, o.a0, 0, H, wallMat);
      seg(o.a0, o.a1, 0, o.y0, wallMat); seg(o.a0, o.a1, o.y1, H, wallMat);
      if (o.win) {
        const v = new THREE.Mesh(INT_PLANE, INT.viewMat);
        const am = (o.a0 + o.a1) / 2;
        v.scale.set(o.a1 - o.a0, o.y1 - o.y0, 1);
        v.position.set(x0 + dx * am - dz * 0.12, (o.y0 + o.y1) / 2, z0 + dz * am + dx * 0.12);
        v.rotation.y = rot + Math.PI;
        // Blickrichtung nach aussen: Ebene zeigt nach innen
        INT.group.add(v);
        const mull = new THREE.Mesh(INT_BOX, M.black); mull.scale.set(0.06, o.y1 - o.y0, 0.1); mull.position.set(x0 + dx * am - dz * 0.06, (o.y0 + o.y1) / 2, z0 + dz * am + dx * 0.06); mull.rotation.y = rot; INT.group.add(mull);
        const sill = new THREE.Mesh(INT_BOX, M.white); sill.scale.set(o.a1 - o.a0, 0.05, 0.3); sill.position.set(x0 + dx * am - dz * 0.1, o.y0, z0 + dz * am + dx * 0.1); sill.rotation.y = rot; INT.group.add(sill);
      }
      a = o.a1;
    }
    seg(a, len, 0, H, wallMat);
  };
  const winOps = (len, skip) => {
    const ops = []; const step = 3.2;
    for (let a = 1.2; a + 1.8 < len - 0.8; a += step) {
      if (skip && skip.some(s => a + 2.2 > s[0] && a < s[1])) continue;
      ops.push({ a0: a, a1: a + 2.0, y0: winBot, y1: winTop, win: true });
    }
    return ops;
  };
  // Vorderwand (z = +D/2), von rechts nach links gesehen von innen
  const frontOps = [];
  if (f === 0) frontOps.push({ a0: W / 2 - 1.4, a1: W / 2 + 1.4, y0: 0, y1: 2.8, win: false, door: true });
  wall(-W / 2, D / 2, W / 2, D / 2, frontOps.concat(winOps(W, f === 0 ? [[W / 2 - 2.5, W / 2 + 2.5]] : null)));
  // Rückwand mit Lift
  const la = liftX + W / 2;
  wall(W / 2, -D / 2, -W / 2, -D / 2, [{ a0: W - la - 0.85, a1: W - la + 0.85, y0: 0, y1: 2.3, win: false }].concat(winOps(W, [[W - la - 2.8, W - la + 2.8]])));
  wall(-W / 2, -D / 2, -W / 2, D / 2, winOps(D));
  wall(W / 2, D / 2, W / 2, -D / 2, winOps(D));
  // Liftrahmen und Ruftaste
  addBox(INT.group, M.metal, liftX - 0.9, 1.15, -D / 2 + 0.11, 0.08, 2.3, 0.04);
  addBox(INT.group, M.metal, liftX + 0.9, 1.15, -D / 2 + 0.11, 0.08, 2.3, 0.04);
  addBox(INT.group, M.metal, liftX, 2.34, -D / 2 + 0.11, 1.88, 0.08, 0.04);
  addBox(INT.group, M.black, liftX + 1.25, 1.2, -D / 2 + 0.11, 0.15, 0.3, 0.02);
  addBox(INT.group, M.led, liftX + 1.25, 1.25, -D / 2 + 0.125, 0.05, 0.05, 0.01);
  // Eingangstür (Erdgeschoss)
  INT.exit = null;
  if (f === 0) {
    const glassDoor = (x) => { addBox(INT.group, M.glass, x, 1.4, D / 2, 1.3, 2.8, 0.04); addBox(INT.group, M.metal, x, 1.4, D / 2 - 0.03, 1.32, 2.8, 0.02).scale.set(0.06, 2.8, 0.02); };
    glassDoor(-0.66); glassDoor(0.66);
    addBox(INT.group, M.metal, 0, 2.82, D / 2, 2.8, 0.06, 0.1);
    addBox(INT.group, M.black, 0, 0.005, D / 2 - 1.2, 2.6, 0.01, 1.6);
    INT.exit = { x: 0, z: D / 2 };
    // Notausgang-Schild
    const sc = textCanvas('AUSGANG', 256, 64, { bg: '#0a7a3a', fg: '#fff' });
    const sm = new THREE.Mesh(INT_PLANE, new THREE.MeshStandardMaterial({ map: canvasTex(sc, { clamp: true }), emissive: 0xffffff, emissiveMap: canvasTex(sc, { clamp: true }), emissiveIntensity: 0.8 }));
    sm.scale.set(0.8, 0.2, 1); sm.position.set(0, 3.05, D / 2 - 0.12); sm.rotation.y = Math.PI; INT.group.add(sm);
  }
  // Deckenlichter
  for (let x = -W / 2 + 3; x < W / 2 - 1; x += 4.5) for (let z = -D / 2 + 3; z < D / 2 - 1; z += 4.5) {
    if (b.cat === 'hotel' && f === 0) continue;
    addBox(INT.group, M.light, x, H - 0.02, z, 1.2, 0.03, 0.6);
  }
  const nl = Math.min(4, Math.ceil(W * D / 220));
  for (let i = 0; i < nl; i++) {
    const pl = new THREE.PointLight(0xfff2e0, 0.55, Math.max(W, D) * 1.2, 1.6);
    pl.position.set(lerp(-W / 3, W / 3, nl > 1 ? i / (nl - 1) : 0.5), H - 0.5, (i % 2 ? -1 : 1) * D / 6);
    INT.scene.add(pl); INT.lights.push(pl);
  }
  // Freihalten: Bereich vor dem Lift und vor dem Eingang
  INT.keepFree = [{ x0: liftX - 1.6, z0: -D / 2, x1: liftX + 1.6, z1: -D / 2 + 3.2 }, { x0: -2, z0: D / 2 - 3.5, x1: 2, z1: D / 2 }];
  // Einrichtung
  if (b.cat === 'hotel') { if (f === 0) furnishHotelLobby(W, D, H, b); else furnishHotelFloor(W, D, H, b, f); }
  else if (b.cat === 'firma') { if (f === 0) furnishFirmLobby(W, D, H, b); else furnishFirmFloor(W, D, H, b, f); }
  else if (b.cat === 'eth' || b.cat === 'halle') { if (f === 0) furnishHall(W, D, H, b); else furnishEthFloor(W, D, H, b, f); }
  else { if (f === 0) furnishOfficeLobby(W, D, H, b); else furnishOfficeFloor(W, D, H, b, f); }
  // Lift-Kollision (Rückwand bleibt dicht ausser der Öffnung)
  seedRng(WS.SEED + Math.floor(performance.now()) % 1000);
  return { spawn: f === 0 ? { x: 0, z: D / 2 - 1.6, yaw: 0 } : { x: liftX, z: -D / 2 + 2.0, yaw: Math.PI } };
}
function free(x0, z0, x1, z1) {
  for (const k of INT.keepFree) if (x1 > k.x0 && x0 < k.x1 && z1 > k.z0 && z0 < k.z1) return false;
  for (const c of INT.colliders) if (x1 > c.x0 - 0.3 && x0 < c.x1 + 0.3 && z1 > c.z0 - 0.3 && z0 < c.z1 + 0.3) return false;
  return true;
}

function furnishHotelLobby(W, D, H, b) {
  const M = F();
  for (let x = -W / 2 + 4; x < W / 2 - 2; x += 6) for (const z of [-D / 4, D / 4]) { if (!free(x - 0.6, z - 0.6, x + 0.6, z + 0.6)) continue; place(mkColumn(H, 0.35), x, z, 0, 0.45, 0.45); }
  const rx = -W / 2 + 4;
  place(mkReception(5), rx, -D / 2 + 3.5, 0, 2.6, 0.5);
  place(mkShelf(4), rx, -D / 2 + 0.35, 0, 2, 0.2);
  for (let i = 0; i < 3; i++) { const ch = mkChandelier(H); ch.position.set(lerp(-W / 3, W / 3, i / 2), 0, 0); INT.group.add(ch); const pl = new THREE.PointLight(0xffe0b0, 0.6, 18, 1.5); pl.position.set(lerp(-W / 3, W / 3, i / 2), H - 1.3, 0); INT.scene.add(pl); INT.lights.push(pl); }
  // Sitzgruppen
  const groups = ri(2, 3);
  for (let i = 0; i < groups; i++) {
    const cx = rr(-W / 2 + 6, W / 2 - 6), cz = rr(-D / 2 + 6, D / 2 - 5);
    if (!free(cx - 3, cz - 3, cx + 3, cz + 3)) continue;
    place(mkRug(5, 4), cx, cz, 0);
    place(mkSofa(pick([M.fabricRed, M.fabricBlue, M.fabricGreen, M.fabricBeige]), 2.4), cx, cz - 1.4, 0, 1.2, 0.45);
    place(mkArmchair(M.leather), cx - 1.9, cz + 0.6, Math.PI / 2 + 0.3, 0.45, 0.45);
    place(mkArmchair(M.leather), cx + 1.9, cz + 0.6, -Math.PI / 2 - 0.3, 0.45, 0.45);
    place(mkTable(1.2, 0.7, M.woodDark, 0.42), cx, cz, 0, 0.6, 0.35);
    place(mkFloorLamp(), cx - 2.0, cz - 1.5, 0, 0.2, 0.2);
  }
  place(mkGrandfatherClock(), W / 2 - 0.5, rr(-D / 4, D / 4), -Math.PI / 2, 0.3, 0.2);
  for (let i = 0; i < 6; i++) { const x = rr(-W / 2 + 1, W / 2 - 1), z = pick([-D / 2 + 0.7, D / 2 - 0.7]); if (free(x - 0.4, z - 0.4, x + 0.4, z + 0.4)) place(mkPlant(1.4), x, z, 0, 0.3, 0.3); }
  const sign = textCanvas(b.name || 'Hotel', 512, 96, { bg: '#2a1f14', fg: '#e8c870', font: 'italic bold 56px Georgia' });
  const sm = new THREE.Mesh(INT_PLANE, new THREE.MeshStandardMaterial({ map: canvasTex(sign, { clamp: true }) })); sm.scale.set(4, 0.75, 1); sm.position.set(rx, 3.0, -D / 2 + 0.12); INT.group.add(sm);
}

function furnishHotelFloor(W, D, H, b, f) {
  const M = F();
  const cw = 2.6; // Korridor
  const fabs = [M.fabricRed, M.fabricBlue, M.fabricGreen, M.fabricBeige, M.fabricGray];
  const bedFab = pick(fabs), chairFab = pick(fabs);
  // Korridor-Teppich
  const rug = new THREE.Mesh(INT_PLANE, pick(M.rugs)); rug.rotation.x = -Math.PI / 2; rug.scale.set(W - 2, cw - 0.4, 1); rug.position.set(0, 0.012, 0); INT.group.add(rug);
  const wallMat = new THREE.MeshStandardMaterial({ color: pick([0xf2e8d5, 0xe8dcc8, 0xdfe6e2, 0xf0e1d8, 0xe6e0ef]), roughness: 0.9 });
  // Zimmer beidseitig mit variabler Breite
  for (const side of [-1, 1]) {
    let x = -W / 2;
    const zIn = side * cw / 2, zOut = side * D / 2;
    while (x < W / 2 - 3) {
      let rw = rr(5.2, 7.5); if (x + rw > W / 2 - 0.5) rw = W / 2 - x;
      if (rw < 3.5) break;
      const x0 = x, x1 = x + rw;
      // Trennwand
      if (x0 > -W / 2 + 0.1) { addBox(INT.group, wallMat, x0, H / 2, (zIn + zOut) / 2, 0.15, H, Math.abs(zOut - zIn)); col(x0 - 0.1, Math.min(zIn, zOut), x0 + 0.1, Math.max(zIn, zOut)); }
      // Korridorwand mit Türöffnung
      const doorX = x0 + rw * (chance(0.5) ? 0.25 : 0.75);
      const segW = (a, c) => { if (c - a < 0.05) return; addBox(INT.group, wallMat, (a + c) / 2, H / 2, zIn, c - a, H, 0.15); col(a, zIn - 0.1, c, zIn + 0.1); };
      const liftZone = side < 0 && (x1 > INT.lift.x - 2 && x0 < INT.lift.x + 2);
      if (liftZone) { x = x1; continue; }
      segW(x0, doorX - 0.55); segW(doorX + 0.55, x1);
      addBox(INT.group, wallMat, doorX, H - 0.4, zIn, 1.1, 0.8, 0.15);
      // Zimmernummer
      const no = f * 100 + Math.round((x0 + W / 2) / 3) + (side > 0 ? 50 : 0);
      const nt = textCanvas(String(no), 128, 64, { bg: '#3a2a1a', fg: '#e8c870', font: 'bold 40px Georgia' });
      const nm = new THREE.Mesh(INT_PLANE, new THREE.MeshStandardMaterial({ map: canvasTex(nt, { clamp: true }) })); nm.scale.set(0.3, 0.15, 1);
      nm.position.set(doorX + 0.8, 1.6, zIn - side * 0.09); nm.rotation.y = side > 0 ? Math.PI : 0; INT.group.add(nm);
      // Einrichtung des Zimmers
      const rcx = (x0 + x1) / 2, depth = Math.abs(zOut - zIn), rz = (zIn + zOut) / 2;
      const rugM = new THREE.Mesh(INT_PLANE, pick(M.rugs)); rugM.rotation.x = -Math.PI / 2; rugM.scale.set(rw * 0.6, depth * 0.5, 1); rugM.position.set(rcx, 0.013, rz); INT.group.add(rugM);
      const bedX = chance(0.5) ? x0 + 1.4 : x1 - 1.4;
      const bedRot = side > 0 ? Math.PI : 0;
      const bz = zOut - side * 1.25;
      place(mkBed(bedFab), bedX, bz, bedRot, 1.0, 1.1);
      for (const s of [-1, 1]) { const nx = bedX + s * 1.3; if (nx > x0 + 0.3 && nx < x1 - 0.3) place(mkNightstand(), nx, zOut - side * 0.35, bedRot, 0.25, 0.21); }
      const otherX = bedX < rcx ? x1 - 1.2 : x0 + 1.2;
      // Schreibtisch mit Flachbildschirm-PC
      const dz2 = zIn + side * 1.2;
      if (depth > 5) {
        place(mkDesk(1.5, 0.7, false, 1, M.woodDark), otherX, dz2 + side * 0.4, side > 0 ? 0 : Math.PI, 0.75, 0.35);
        place(mkChair(chairFab), otherX, dz2 + side * 1.0, side > 0 ? Math.PI : 0, 0.25, 0.25);
      }
      if (chance(0.75)) place(mkArmchair(chairFab), otherX, zOut - side * 1.3, bedRot + (bedX < rcx ? -0.6 : 0.6), 0.45, 0.45);
      if (chance(0.6)) place(mkGrandfatherClock(), otherX + (bedX < rcx ? 0.6 : -0.6) * 0 + (bedX < rcx ? 0.9 : -0.9), zOut - side * 0.3, bedRot, 0.3, 0.2);
      if (chance(0.7)) place(mkFloorLamp(), bedX < rcx ? x1 - 0.4 : x0 + 0.4, rz, 0, 0.2, 0.2);
      if (rw > 6 && chance(0.6)) place(mkWardrobe(), bedX < rcx ? x0 + 1.2 : x1 - 1.2, zIn + side * 0.4, side > 0 ? 0 : Math.PI, 0.8, 0.3);
      if (chance(0.5)) { const tv = mkTV(1.1); tv.position.set(bedX, 1.5, zIn + side * 0.12); tv.rotation.y = side > 0 ? 0 : Math.PI; INT.group.add(tv); }
      const pl = new THREE.PointLight(0xffd9a8, 0.35, 8, 1.8); pl.position.set(rcx, H - 0.6, rz); INT.scene.add(pl); INT.lights.push(pl);
      x = x1;
    }
  }
  for (let x = -W / 2 + 2; x < W / 2 - 2; x += 5) { const ch = mkChandelier(H); ch.scale.set(0.6, 0.6, 0.6); ch.position.set(x, H * 0.4, 0); INT.group.add(ch); }
}

function furnishOfficeLobby(W, D, H, b) {
  const M = F();
  place(mkReception(3.2, M.white), 0, -D / 2 + 4.5, 0, 1.6, 0.5);
  place(mkChair(M.fabricGray), 0, -D / 2 + 3.6, 0, 0.25, 0.25);
  for (let i = 0; i < 4; i++) place(mkChair(M.fabricBlue), -W / 2 + 1.0, -2 + i * 0.8, Math.PI / 2, 0.25, 0.25);
  place(mkTable(0.8, 1.6, M.white, 0.45), -W / 2 + 2.0, -0.8, 0, 0.4, 0.8);
  for (let i = 0; i < 5; i++) { const x = rr(-W / 2 + 1, W / 2 - 1), z = pick([-D / 2 + 0.6, D / 2 - 0.6]); if (free(x - 0.4, z - 0.4, x + 0.4, z + 0.4)) place(mkPlant(1.2), x, z, 0, 0.3, 0.3); }
  for (let i = 0; i < 6; i++) addBox(INT.group, M.metal, W / 2 - 0.2, 1.0 + (i % 3) * 0.35, -2 + Math.floor(i / 3) * 0.5, 0.2, 0.3, 0.45);
  place(mkWaterCooler(), W / 2 - 0.5, 2, 0, 0.2, 0.2);
  const sign = textCanvas(b.address || 'Bürohaus', 512, 96, { bg: '#ffffff', fg: '#203040' });
  const sm = new THREE.Mesh(INT_PLANE, new THREE.MeshStandardMaterial({ map: canvasTex(sign, { clamp: true }) })); sm.scale.set(3.4, 0.64, 1); sm.position.set(0, 2.8, -D / 2 + 0.12); INT.group.add(sm);
  if (W > 18) furnishDesks(W, D, H, b, 0.5, -D / 2 + 7);
}

function furnishDesks(W, D, H, b, density, zStart, big) {
  const M = F();
  const mode = ri(0, 2);
  const dw = big ? 1.9 : 1.6, dd = big ? 0.9 : 0.8;
  const chairFab = pick([M.fabricGray, M.fabricBlue, M.black, M.fabricGreen]);
  const wood = pick([M.white, M.woodLight, M.white]);
  if (mode === 0) { // Reihen
    for (let z = zStart; z < D / 2 - 2; z += 3.4) for (let x = -W / 2 + 2; x < W / 2 - 2; x += dw + 0.5) {
      if (!chance(density)) continue;
      if (!free(x - dw / 2, z - 0.8, x + dw / 2, z + 1.2)) continue;
      place(mkDesk(dw, dd, big, big ? ri(2, 3) : 1, wood), x, z, 0, dw / 2, dd / 2);
      place(mkChair(chairFab), x, z + 0.9, Math.PI, 0.25, 0.25);
    }
  } else if (mode === 1) { // Inseln zu viert
    for (let z = zStart + 1; z < D / 2 - 2.5; z += 5) for (let x = -W / 2 + 3; x < W / 2 - 3; x += dw * 2 + 2) {
      if (!chance(density + 0.2)) continue;
      if (!free(x - dw - 0.6, z - 1.8, x + dw + 0.6, z + 1.8)) continue;
      for (const [ox, oz, r] of [[-dw / 2, -dd / 2, Math.PI], [dw / 2, -dd / 2, Math.PI], [-dw / 2, dd / 2, 0], [dw / 2, dd / 2, 0]]) {
        place(mkDesk(dw, dd, big, big ? 2 : 1, wood), x + ox, z + oz, r, dw / 2, dd / 2);
        place(mkChair(chairFab), x + ox, z + oz + (r === 0 ? 0.9 : -0.9), r + Math.PI, 0.25, 0.25);
      }
    }
  } else { // entlang der Fenster
    for (const side of [-1, 1]) for (let z = zStart; z < D / 2 - 1.5; z += dw + 0.4) {
      const x = side * (W / 2 - 0.8);
      if (!free(x - 0.6, z - dw / 2, x + 0.6, z + dw / 2)) continue;
      place(mkDesk(dw, dd, big, big ? 2 : 1, wood), x, z, side > 0 ? -Math.PI / 2 : Math.PI / 2, dw / 2, dd / 2);
      place(mkChair(chairFab), x - side * 0.9, z, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0.25, 0.25);
    }
    furnishMeeting(0, zStart + 3, Math.min(W - 6, 8));
  }
}
function furnishMeeting(cx, cz, w) {
  const M = F();
  if (!free(cx - w / 2 - 1, cz - 2, cx + w / 2 + 1, cz + 2)) return;
  place(mkTable(w, 1.6, M.woodDark), cx, cz, 0, w / 2, 0.8);
  for (let x = -w / 2 + 0.6; x < w / 2 - 0.3; x += 1.0) { place(mkChair(M.leather), cx + x, cz - 1.2, 0, 0.25, 0.25); place(mkChair(M.leather), cx + x, cz + 1.2, Math.PI, 0.25, 0.25); }
}
function furnishOfficeFloor(W, D, H, b, f) {
  const M = F();
  // Besprechungsraum mit Glaswänden in einer Ecke
  const right = chance(0.5);
  const mw = Math.min(9, W * 0.35), md = Math.min(7, D * 0.4);
  const mx = right ? W / 2 - mw / 2 : -W / 2 + mw / 2, mz = D / 2 - md / 2;
  addBox(INT.group, M.glass, mx, H / 2, mz - md / 2, mw, H, 0.05); col(mx - mw / 2, mz - md / 2 - 0.05, mx + mw / 2 - 1.2, mz - md / 2 + 0.05);
  addBox(INT.group, M.glass, right ? mx - mw / 2 : mx + mw / 2, H / 2, mz, 0.05, H, md); col((right ? mx - mw / 2 : mx + mw / 2) - 0.05, mz - md / 2, (right ? mx - mw / 2 : mx + mw / 2) + 0.05, mz + md / 2);
  furnishMeeting(mx, mz + 0.3, Math.max(2.4, mw - 3));
  const wb = mkWhiteboard(); wb.position.set(mx, 0, D / 2 - 0.15); wb.rotation.y = Math.PI; INT.group.add(wb);
  // Teeküche
  const kx = right ? -W / 2 + 2.2 : W / 2 - 2.2;
  addBox(INT.group, M.white, kx, 0.45, -D / 2 + 3.6, 3.6, 0.9, 0.65); col(kx - 1.8, -D / 2 + 3.2, kx + 1.8, -D / 2 + 4.0);
  addBox(INT.group, M.black, kx - 1, 1.05, -D / 2 + 3.6, 0.4, 0.3, 0.35);
  place(mkWaterCooler(), kx + 2.3, -D / 2 + 3.6, 0, 0.2, 0.2);
  for (let i = 0; i < ri(2, 5); i++) place(mkCabinet(1.2), lerp(-W / 2 + 1.5, W / 2 - 1.5, rnd()), -D / 2 + 0.5, 0, 0.6, 0.25);
  furnishDesks(W, D, H, b, rr(0.65, 0.95), -D / 2 + 6, false);
  for (let i = 0; i < 6; i++) { const x = rr(-W / 2 + 1, W / 2 - 1), z = rr(-D / 2 + 1, D / 2 - 1); if (free(x - 0.4, z - 0.4, x + 0.4, z + 0.4)) place(mkPlant(rr(0.8, 1.5)), x, z, 0, 0.3, 0.3); }
}

function furnishFirmLobby(W, D, H, b) {
  const M = F();
  const logo = textCanvas(b.name || 'Firma', 1024, 192, { bg: '#10161d', fg: '#7fd3ff', font: 'bold 120px Arial' });
  const lm = new THREE.Mesh(INT_PLANE, new THREE.MeshStandardMaterial({ map: canvasTex(logo, { clamp: true }), emissive: 0xffffff, emissiveMap: canvasTex(logo, { clamp: true }), emissiveIntensity: 0.6 }));
  lm.scale.set(Math.min(W - 4, 9), Math.min(W - 4, 9) * 192 / 1024, 1); lm.position.set(-W / 2 + Math.min(W - 4, 9) / 2 + 1, H * 0.6, -D / 2 + 0.12); INT.group.add(lm);
  place(mkReception(4, M.black), -W / 4, -D / 2 + 4, 0, 2.1, 0.5);
  for (let i = 0; i < 3; i++) place(mkTurnstile(), -1.6 + i * 1.6, -2, 0, 0.15, 0.6);
  place(mkSofa(M.fabricGray, 3), W / 2 - 3, D / 2 - 4, Math.PI, 1.5, 0.45);
  place(mkSofa(M.fabricGray, 3), W / 2 - 3, D / 2 - 7.5, 0, 1.5, 0.45);
  place(mkTable(1.6, 0.8, M.white, 0.42), W / 2 - 3, D / 2 - 5.8, 0, 0.8, 0.4);
  const tv = mkTV(3.2); tv.position.set(W / 2 - 0.12, 2.2, 0); tv.rotation.y = -Math.PI / 2; INT.group.add(tv);
  for (let i = 0; i < 6; i++) { const x = rr(-W / 2 + 1, W / 2 - 1), z = pick([-D / 2 + 0.6, D / 2 - 0.6]); if (free(x - 0.4, z - 0.4, x + 0.4, z + 0.4)) place(mkPlant(1.6), x, z, 0, 0.3, 0.3); }
}
function furnishFirmFloor(W, D, H, b, f) {
  const M = F();
  const theme = ri(0, 3);
  if (theme === 0) { // Lounge + Pingpong
    const lx = chance(0.5) ? -W / 4 : W / 4;
    place(mkPingPong(), lx, D / 4, Math.PI / 2, 1.4, 0.8);
    for (let i = 0; i < 4; i++) place(mkBeanbag(), lx + rr(-3, 3), D / 4 - 3 + rr(-1, 1), 0, 0.45, 0.45);
    furnishDesks(W, D, H, b, 0.8, -D / 2 + 4, true);
  } else if (theme === 1) { // Serverraum
    for (let i = 0; i < Math.min(8, Math.floor(W / 2.5)); i++) place(mkServerRack(), -W / 2 + 2 + i * 1.2, D / 2 - 1.2, Math.PI, 0.3, 0.5);
    furnishDesks(W, D, H, b, 0.85, -D / 2 + 4, true);
  } else { // grosse Arbeitsplätze und Whiteboards
    for (let i = 0; i < 3; i++) { const wb = mkWhiteboard(); wb.position.set(-W / 2 + 0.15, 0, -D / 2 + 4 + i * 4); wb.rotation.y = Math.PI / 2; INT.group.add(wb); }
    furnishDesks(W, D, H, b, 0.9, -D / 2 + 4, true);
  }
  for (let i = 0; i < 8; i++) { const x = rr(-W / 2 + 1, W / 2 - 1), z = rr(-D / 2 + 1, D / 2 - 1); if (free(x - 0.4, z - 0.4, x + 0.4, z + 0.4)) place(mkPlant(rr(1, 1.8)), x, z, 0, 0.3, 0.3); }
}

function furnishHall(W, D, H, b) {
  const M = F();
  for (let x = -W / 2 + 4; x < W / 2 - 3; x += 5) for (const z of [-D / 2 + 4, D / 2 - 4]) { if (free(x - 0.7, z - 0.7, x + 0.7, z + 0.7)) place(mkColumn(H, 0.55, M.marble), x, z, 0, 0.7, 0.7); }
  for (let i = 0; i < 4; i++) { const ch = mkChandelier(H); ch.position.set(lerp(-W / 3, W / 3, i / 3), 0, 0); INT.group.add(ch); }
  if (b.cat === 'eth') {
    for (let x = -W / 2 + 6; x < W / 2 - 6; x += 7) for (const z of [-3, 3]) place(mkSofa(M.leather, 2.2), x, z, z < 0 ? 0 : Math.PI, 1.1, 0.45);
    for (let i = 0; i < 4; i++) { const sh = mkShelf(3); place(sh, -W / 2 + 0.3, -6 + i * 4, Math.PI / 2, 0.2, 1.5); }
    const sc = textCanvas('ETH ZÜRICH · HAUPTGEBÄUDE', 1024, 128, { bg: '#e9e0cc', fg: '#3a3020', font: 'bold 64px Georgia' });
    const sm = new THREE.Mesh(INT_PLANE, new THREE.MeshStandardMaterial({ map: canvasTex(sc, { clamp: true }) })); sm.scale.set(10, 1.25, 1); sm.position.set(0, H - 1.6, -D / 2 + 0.12); INT.group.add(sm);
  } else {
    for (let z = -D / 2 + 6; z < D / 2 - 4; z += 2.2) for (const x of [-W / 4, W / 4]) place(mkTable(W / 2 - 6, 0.5, M.woodDark, 0.45), x, z, 0, (W / 2 - 6) / 2, 0.25);
  }
  for (let i = 0; i < 6; i++) { const x = rr(-W / 2 + 1, W / 2 - 1), z = pick([-D / 2 + 0.7, D / 2 - 0.7]); if (free(x - 0.4, z - 0.4, x + 0.4, z + 0.4)) place(mkPlant(1.6), x, z, 0, 0.3, 0.3); }
}
function furnishEthFloor(W, D, H, b, f) {
  const M = F();
  const kind = f % 3;
  if (kind === 1) { // Hörsaal
    const bw = mkWhiteboard(); bw.scale.set(2.5, 1.6, 1); bw.position.set(0, -0.8, -D / 2 + 0.2); INT.group.add(bw);
    const board = new THREE.Mesh(INT_PLANE, M.board); board.scale.set(6, 2.2, 1); board.position.set(-3.5, 2.0, -D / 2 + 0.25); INT.group.add(board);
    place(mkTable(3, 0.8, M.woodLight, 1.05), 0, -D / 2 + 3, 0, 1.5, 0.4);
    for (let z = -D / 2 + 6; z < D / 2 - 2; z += 1.6) for (const x of [-W / 4 - 0.5, W / 4 + 0.5]) { if (!free(x - W / 5, z - 0.4, x + W / 5, z + 1.1)) continue; place(mkLecternRow(W / 2.6, Math.floor(W / 2.6 / 0.75)), x, z, Math.PI, W / 5.2, 0.6); }
  } else if (kind === 2) { // Bibliothek
    for (let z = -D / 2 + 4; z < D / 2 - 3; z += 2.6) for (let x = -W / 2 + 4; x < W / 2 - 3; x += 7) { if (free(x - 2.6, z - 0.4, x + 2.6, z + 0.4)) place(mkShelf(5), x, z, 0, 2.5, 0.2); }
    for (let i = 0; i < 4; i++) { const x = rr(-W / 3, W / 3); place(mkTable(2.4, 1.0, M.woodDark), x, D / 2 - 2.2, 0, 1.2, 0.5); }
  } else { // Rechnerraum
    furnishDesks(W, D, H, b, 0.95, -D / 2 + 4, false);
  }
}

/* Kollision im Innenraum: Kreis gegen Wände und Möbel */
function interiorCollide(x, z, r) {
  const W = INT.W, D = INT.D;
  x = clamp(x, -W / 2 + r + 0.1, W / 2 - r - 0.1);
  z = clamp(z, -D / 2 + r + 0.1, D / 2 - r - 0.1);
  for (const c of INT.colliders) {
    const qx = clamp(x, c.x0, c.x1), qz = clamp(z, c.z0, c.z1);
    const dx = x - qx, dz = z - qz, d = Math.hypot(dx, dz);
    if (d < r) {
      if (d > 1e-5) { x = qx + dx / d * r; z = qz + dz / d * r; }
      else { const l = x - c.x0, rr2 = c.x1 - x, t = z - c.z0, bt = c.z1 - z; const m = Math.min(l, rr2, t, bt); if (m === l) x = c.x0 - r; else if (m === rr2) x = c.x1 + r; else if (m === t) z = c.z0 - r; else z = c.z1 + r; }
    }
  }
  return [x, z];
}

function updateInterior(t) {
  if (!INT.group) return;
  INT.group.traverse(o => { if (o.userData.pendulum) o.rotation.z = Math.sin(t * 2.2) * 0.25; });
}
let INT_PLANE;
