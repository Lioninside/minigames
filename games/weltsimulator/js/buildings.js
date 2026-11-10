/* ================= GEBÄUDE =================
   Fassaden (prozedurale Texturen, nachts zufällig beleuchtete Fenster), Stadthäuser entlang
   der Strassen, Luxushotels an der Küste, Klein-Venedig mit Piazza und Campanile,
   Firmensitze auf dem Hügel und die ETH mit Kuppel. Jedes Gebäude hat eine Haupttür,
   Stockwerke, ein Dach mit Lifthaus und Kollisionsquader. */

const BLD = { list: [], occ: null, hash: null, doorHash: null, mats: null, signs: [] };
const NIGHT_U = { value: 0 };
const STYLE = {
  plaster: { bay: 3.4 }, plaster2: { bay: 3.4 }, brick: { bay: 3.2 }, glass: { bay: 1.8 }, office: { bay: 4.0 },
  hotel: { bay: 3.8 }, venice: { bay: 3.0 }, stone: { bay: 3.6 }, shop: { bay: 5.0 }, lobby: { bay: 4.0 }
};

/* ---------- Texturen ---------- */
function facadeCanvas(style) {
  const S = 256, cv = makeCanvas(S, S), ctx = cv.getContext('2d');
  const noise = (alpha) => { ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(noiseCanvas(128, 128, 0.85, 0.25, 6, style.length), 0, 0, S, S); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; };
  const glassFill = (x, y, w, h, tone) => {
    ctx.clearRect(x, y, w, h);
    const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
    const t = tone || [118, 146, 168];
    g.addColorStop(0, `rgba(${t[0]},${t[1]},${t[2]},0.6)`);
    g.addColorStop(0.55, `rgba(${t[0] * 0.55 | 0},${t[1] * 0.6 | 0},${t[2] * 0.65 | 0},0.6)`);
    g.addColorStop(1, `rgba(${t[0] * 0.35 | 0},${t[1] * 0.4 | 0},${t[2] * 0.45 | 0},0.6)`);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  };
  const frame = (x, y, w, h, col, t) => { ctx.fillStyle = col; ctx.fillRect(x - t, y - t, w + 2 * t, h + 2 * t); };
  switch (style) {
    case 'plaster': case 'plaster2': {
      ctx.fillStyle = '#ece8e0'; ctx.fillRect(0, 0, S, S); noise(0.5);
      ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(0, 236, S, 20);
      frame(78, 52, 100, 150, '#f8f8f5', 9);
      ctx.fillStyle = '#d8d4cc'; ctx.fillRect(66, 208, 124, 10);
      glassFill(78, 52, 100, 150);
      ctx.fillStyle = '#f2f2ee'; ctx.fillRect(125, 52, 6, 150); ctx.fillRect(78, 105, 100, 5);
      if (style === 'plaster2') { ctx.fillStyle = '#4f7350'; ctx.fillRect(34, 46, 34, 162); ctx.fillRect(188, 46, 34, 162);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 52; y < 205; y += 9) { ctx.fillRect(36, y, 30, 2); ctx.fillRect(190, y, 30, 2); } }
      break;
    }
    case 'brick': {
      ctx.fillStyle = '#8e4a36'; ctx.fillRect(0, 0, S, S);
      for (let y = 0; y < S; y += 12) for (let x = -20; x < S; x += 32) { const v = rr(-18, 18); ctx.fillStyle = `rgb(${150 + v | 0},${78 + v * 0.6 | 0},${58 + v * 0.5 | 0})`; ctx.fillRect(x + ((y / 12) % 2) * 16 + 1, y + 1, 30, 10); }
      noise(0.35);
      frame(80, 56, 96, 146, '#efede6', 7);
      ctx.fillStyle = '#cdbfa8'; ctx.fillRect(70, 40, 116, 12); ctx.fillRect(70, 208, 116, 10);
      glassFill(80, 56, 96, 146);
      ctx.fillStyle = '#efede6'; ctx.fillRect(125, 56, 6, 146);
      break;
    }
    case 'glass': {
      ctx.fillStyle = '#3d4650'; ctx.fillRect(0, 0, S, S);
      glassFill(6, 0, 244, 214, [130, 165, 190]);
      ctx.fillStyle = '#2b3138'; ctx.fillRect(0, 214, S, 42); ctx.fillRect(0, 0, 6, S); ctx.fillRect(250, 0, 6, S);
      ctx.fillStyle = 'rgba(200,220,235,0.6)'; ctx.fillRect(126, 0, 4, 214);
      break;
    }
    case 'office': {
      ctx.fillStyle = '#cbc7bf'; ctx.fillRect(0, 0, S, S); noise(0.4);
      glassFill(0, 62, S, 128, [110, 135, 150]);
      ctx.fillStyle = '#5a6066'; for (let x = 0; x < S; x += 64) ctx.fillRect(x, 62, 5, 128);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 190, S, 8);
      break;
    }
    case 'hotel': {
      ctx.fillStyle = '#f3f1ec'; ctx.fillRect(0, 0, S, S); noise(0.25);
      glassFill(22, 26, 212, 178, [120, 160, 185]);
      ctx.fillStyle = 'rgba(240,248,255,0.6)'; ctx.clearRect(14, 170, 228, 6); ctx.fillRect(14, 170, 228, 6);
      ctx.fillStyle = '#e8e6e0'; ctx.fillRect(0, 204, S, 30);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, 234, S, 6);
      ctx.fillStyle = '#d9d6cf'; ctx.fillRect(0, 0, 14, S); ctx.fillRect(242, 0, 14, S);
      break;
    }
    case 'venice': {
      ctx.fillStyle = '#efe7da'; ctx.fillRect(0, 0, S, S); noise(0.6);
      ctx.fillStyle = 'rgba(80,60,40,0.12)'; ctx.fillRect(0, 226, S, 30);
      ctx.fillStyle = '#f6f2ea';
      ctx.beginPath(); ctx.moveTo(84, 212); ctx.lineTo(84, 92); ctx.quadraticCurveTo(84, 44, 128, 30); ctx.quadraticCurveTo(172, 44, 172, 92); ctx.lineTo(172, 212); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.moveTo(94, 204); ctx.lineTo(94, 96); ctx.quadraticCurveTo(94, 58, 128, 44); ctx.quadraticCurveTo(162, 58, 162, 96); ctx.lineTo(162, 204); ctx.closePath(); ctx.clip();
      glassFill(90, 40, 76, 170, [110, 120, 135]); ctx.restore();
      ctx.fillStyle = '#7a4d33'; ctx.fillRect(52, 70, 28, 140); ctx.fillRect(176, 70, 28, 140);
      ctx.fillStyle = '#d7cfc2'; ctx.fillRect(74, 212, 108, 10);
      break;
    }
    case 'stone': {
      ctx.fillStyle = '#d9cdb4'; ctx.fillRect(0, 0, S, S);
      for (let y = 0; y < S; y += 32) { ctx.fillStyle = 'rgba(90,75,55,0.25)'; ctx.fillRect(0, y, S, 2); for (let x = (y / 32) % 2 * 48; x < S; x += 96) ctx.fillRect(x, y, 2, 32); }
      noise(0.4);
      ctx.fillStyle = '#c9bc9f'; ctx.beginPath(); ctx.moveTo(70, 50); ctx.lineTo(128, 26); ctx.lineTo(186, 50); ctx.closePath(); ctx.fill();
      frame(86, 60, 84, 150, '#e6dcc6', 8);
      glassFill(86, 60, 84, 150, [105, 120, 130]);
      ctx.fillStyle = '#e6dcc6'; ctx.fillRect(125, 60, 6, 150); ctx.fillRect(86, 120, 84, 5);
      ctx.fillStyle = '#c9bc9f'; ctx.fillRect(72, 214, 112, 10);
      break;
    }
    case 'shop': {
      ctx.fillStyle = '#3b3f44'; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = pick(['#7a1f1f', '#1f4a7a', '#2f5d3a', '#6b4a1f', '#444']); ctx.fillRect(0, 0, S, 46);
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(40, 16, 176, 12);
      glassFill(14, 58, 228, 190, [150, 160, 165]);
      for (let i = 0; i < 6; i++) { const c = pick(['120,60,50', '60,80,120', '150,130,90', '70,100,70', '160,150,140']); ctx.clearRect(24 + i * 36, 196, 26, 40); ctx.fillStyle = `rgba(${c},0.6)`; ctx.fillRect(24 + i * 36, 196, 26, 40); }
      ctx.fillStyle = '#25282c'; ctx.fillRect(126, 58, 5, 190); ctx.fillRect(0, 248, S, 8);
      break;
    }
    case 'lobby': {
      ctx.fillStyle = '#e9e3d5'; ctx.fillRect(0, 0, S, S);
      glassFill(18, 20, 220, 224, [170, 160, 140]);
      ctx.fillStyle = '#b8964a'; ctx.fillRect(14, 16, 228, 6); ctx.fillRect(14, 16, 6, 232); ctx.fillRect(236, 16, 6, 232); ctx.fillRect(125, 20, 6, 224);
      break;
    }
    case 'door': {
      ctx.fillStyle = '#2a2d31'; ctx.fillRect(0, 0, S, S);
      glassFill(22, 22, 98, 224, [150, 165, 175]); glassFill(136, 22, 98, 224, [150, 165, 175]);
      ctx.fillStyle = '#b9bec4'; ctx.fillRect(104, 100, 6, 70); ctx.fillRect(146, 100, 6, 70);
      break;
    }
    case 'wooddoor': {
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#6e4a2c'; ctx.fillRect(16, 16, 108, 230); ctx.fillRect(132, 16, 108, 230);
      ctx.fillStyle = '#c8a050'; ctx.beginPath(); ctx.arc(116, 140, 7, 0, 7); ctx.arc(140, 140, 7, 0, 7); ctx.fill();
      break;
    }
    case 'liftdoor': {
      const g = ctx.createLinearGradient(0, 0, S, 0); g.addColorStop(0, '#9aa1a8'); g.addColorStop(0.5, '#d6dade'); g.addColorStop(1, '#8f969d');
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S); ctx.fillStyle = '#555b61'; ctx.fillRect(126, 0, 4, S); ctx.fillRect(0, 0, S, 8); ctx.fillRect(0, 0, 8, S); ctx.fillRect(248, 0, 8, S);
      break;
    }
  }
  return cv;
}

function makeFacadeMat(cv, opts) {
  const t = canvasTex(cv);
  const m = new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: (opts && opts.rough) || 0.85, metalness: 0, envMapIntensity: 1.0 });
  m.onBeforeCompile = facadeShaderPatch;
  return m;
}
function facadeShaderPatch(sh) {
  sh.uniforms.uNight = NIGHT_U;
  sh.fragmentShader = 'uniform float uNight;\nfloat winMask = 0.0;\n' + sh.fragmentShader
    .replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 texelColor = texture2D( map, vUv );
        winMask = clamp((0.9 - texelColor.a) / 0.22, 0.0, 1.0);
        texelColor.a = 1.0;
        texelColor = mapTexelToLinear( texelColor );
        diffuseColor *= texelColor;
      #endif`)
    .replace('#include <color_fragment>', `
      #ifdef USE_COLOR
        diffuseColor.rgb *= mix(vColor, vec3(1.0), winMask);
      #endif`)
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(roughness, 0.07, winMask);')
    .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = mix(metalness, 0.55, winMask);')
    .replace('#include <emissivemap_fragment>', `
      #ifdef USE_MAP
      {
        vec2 cell = floor(vUv + vec2(0.003));
        float hsh = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
        float lit = step(hsh, 0.30);
        float dim = 0.55 + 0.45 * fract(hsh * 13.7);
        vec3 lc = mix(vec3(1.0, 0.68, 0.38), vec3(0.78, 0.86, 1.0), step(0.75, fract(hsh * 7.31)));
        // manchmal steht jemand am Fenster: Silhouette aus Kopf und Schultern
        vec2 fc = fract(vUv + vec2(0.003));
        float px = 0.34 + 0.32 * fract(hsh * 37.1);
        vec2 hd = vec2(fc.x - px, (fc.y - 0.47) * 1.15);
        float sil = step(fract(hsh * 91.7), 0.45) * max(step(abs(fc.x - px), 0.06 + 0.02 * step(fc.y, 0.38)) * step(fc.y, 0.42), step(dot(hd, hd), 0.0021));
        totalEmissiveRadiance += winMask * lit * uNight * lc * 1.05 * dim * (1.0 - 0.85 * sil);
      }
      #endif`);
}

function makeBuildingMaterials() {
  const M = {};
  for (const s of Object.keys(STYLE)) M['f_' + s] = makeFacadeMat(facadeCanvas(s), { rough: s === 'glass' ? 0.4 : 0.85 });
  M.door = makeFacadeMat(facadeCanvas('door'), { rough: 0.4 });
  M.wooddoor = makeFacadeMat(facadeCanvas('wooddoor'), { rough: 0.7 });
  M.liftdoor = new THREE.MeshStandardMaterial({ map: canvasTex(facadeCanvas('liftdoor')), roughness: 0.3, metalness: 0.8 });
  const gravel = noiseCanvas(128, 128, 0.55, 0.35, 12, 21);
  const gt = canvasTex(gravel); gt.repeat.set(1, 1);
  M.roof = new THREE.MeshStandardMaterial({ map: gt, vertexColors: true, roughness: 0.95 });
  const tile = makeCanvas(128, 128); { const ctx = tile.getContext('2d'); ctx.fillStyle = '#9b4a2f'; ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 16) for (let x = 0; x < 128; x += 16) { const v = rr(-20, 20); ctx.fillStyle = `rgb(${165 + v | 0},${80 + v * 0.5 | 0},${52 + v * 0.4 | 0})`; ctx.beginPath(); ctx.arc(x + 8 + ((y / 16) % 2) * 8, y + 10, 8, 0, Math.PI); ctx.fill(); }
    ctx.globalAlpha = 0.3; ctx.drawImage(noiseCanvas(128, 128, 0.5, 0.4, 5, 3), 0, 0); }
  M.tile = new THREE.MeshStandardMaterial({ map: canvasTex(tile), vertexColors: true, roughness: 0.8 });
  M.trim = new THREE.MeshStandardMaterial({ color: 0xd9d4ca, vertexColors: true, roughness: 0.8 });
  M.trim.onBeforeCompile = liftCutPatch; M.liftdoor.onBeforeCompile = liftCutPatch;
  M.copper = new THREE.MeshStandardMaterial({ color: 0x5e9c8a, roughness: 0.55, metalness: 0.35 });
  M.stoneTrim = new THREE.MeshStandardMaterial({ color: 0xe2d8c2, roughness: 0.75 });
  M.ground = new THREE.MeshStandardMaterial({ map: MATS.sidewalk.map, normalMap: MATS.sidewalk.normalMap, roughness: 0.9, color: 0xd8d2c4 });
  M.metalDark = MATS.metalDark;
  return M;
}

/* Das aktive Lifthaus auf einem Dach wird ausgeblendet und durch die bewegliche Kabine ersetzt. */
const LIFTCUT = { value: new THREE.Vector4(0, -9999, 0, 0) };
function liftCutPatch(sh) {
  sh.uniforms.uLiftCut = LIFTCUT;
  sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = 'uniform vec4 uLiftCut;\nvarying vec3 vWP;\n' + sh.fragmentShader.replace('void main() {', `void main() {
    {
      vec3 d = vWP - uLiftCut.xyz;
      float c = cos(uLiftCut.w), s = sin(uLiftCut.w);
      float lx = d.x * c - d.z * s, lz = d.x * s + d.z * c;
      if (abs(lx) < 1.86 && abs(lz) < 1.86 && d.y > -0.05 && d.y < 3.25) discard;
    }`);
}

/* ---------- Registry ---------- */
function initBuildings() { BLD.occ = new SHash(30); BLD.hash = new SHash(30); BLD.doorHash = new SHash(40); }

function occFree(obb, m) {
  const b = obbBounds(obb, m + 1);
  return !BLD.occ.query(b[0], b[1], b[2], b[3], (o) => obbOverlap(o, obb, m));
}
function occAdd(obb) { const b = obbBounds(obb, 0); BLD.occ.insert(obb, b[0], b[1], b[2], b[3]); }
function addCollider(box) {
  // box: {obb, top, bottom?, hip?, b(building)}
  const bb = obbBounds(box.obb, 0.5);
  BLD.hash.insert(box, bb[0], bb[1], bb[2], bb[3]);
}

const PLASTER_COLS = ['#efe5cf', '#e9d3ad', '#dcc6a0', '#f3e2c3', '#e5cfbd', '#d7dfe2', '#e9c7a6', '#cfd9c3', '#f0d8bf', '#e7e2d7', '#d9c1a6', '#cab89e', '#f1ece2', '#e6d9b8', '#d4b896', '#c9d2d8'];
const VENICE_COLS = ['#d98b5f', '#e0a96d', '#c9604a', '#e8c17a', '#d7765c', '#e3b98e', '#c97b63', '#f0d39a', '#b65c4a', '#e6a07c', '#d89a8a', '#efc7a0'];

/* Gebäude-Datensatz anlegen */
function makeBuilding(o) {
  const b = Object.assign({ id: BLD.list.length, tiers: [], floors: 3, fh: 3.3, gh: 3.3, shop: false, roofType: 'flat', uOff: ri(0, 400), vOff: ri(0, 60) }, o);
  b.obb = makeOBB(b.x, b.z, b.rot, b.w / 2, b.d / 2);
  if (b.base === undefined) {
    let mn = 1e9; for (const c of obbCorners(b.obb, 0)) mn = Math.min(mn, terrainH(c[0], c[1]));
    mn = Math.min(mn, terrainH(b.x, b.z));
    b.base = mn;
  }
  b.height = b.gh + (b.floors - 1) * b.fh;
  if (!b.tiers.length) b.tiers = [{ ox: 0, oz: 0, w: b.w, d: b.d, y0: 0, y1: b.height }];
  const top = b.tiers[b.tiers.length - 1];
  b.roofY = b.base + top.y1;
  BLD.list.push(b);
  occAdd(b.obb);
  return b;
}

function bLocal(b, lx, lz) { const c = Math.cos(b.rot), s = Math.sin(b.rot); return [b.x + lx * c + lz * s, b.z - lx * s + lz * c]; }

/* Tür, Lifthaus, Kollision fertigstellen */
function finishBuilding(b) {
  const doorW = b.cat === 'hotel' ? 3.6 : b.cat === 'eth' ? 5 : 2.2;
  b.doorW = doorW;
  const dl = b.doorLocal || [b.doorOff || 0, b.d / 2];
  const dp = bLocal(b, dl[0], dl[1] + 0.05);
  const outP = bLocal(b, dl[0], dl[1] + 1.4);
  const ground = terrainH(outP[0], outP[1]);
  b.door = { x: dp[0], z: dp[1], y: b.base, ox: outP[0], oz: outP[1], oy: Math.max(ground, b.base), rot: b.rot };
  BLD.doorHash.insert(b, dp[0] - 3, dp[1] - 3, dp[0] + 3, dp[1] + 3);
  // Lifthaus auf dem obersten Teil
  const t = b.tiers[b.tiers.length - 1];
  let roofTop = b.base + t.y1;
  let lz = t.oz - t.d / 2 + 2.4, lx = t.ox;
  if (b.liftLocal) { lx = b.liftLocal[0]; lz = b.liftLocal[1]; }
  if (b.roofType === 'hip') { lz = t.oz; lx = t.ox; roofTop = b.base + t.y1 + b.hipH; }
  if (b.roofYOverride !== undefined) roofTop = b.roofYOverride;
  const lp = bLocal(b, lx, lz);
  const ldp = bLocal(b, lx, lz + 1.62);
  const lop = bLocal(b, lx, lz + 3.2);
  b.lift = { x: lp[0], z: lp[1], y: roofTop, rot: b.rot, dx: ldp[0], dz: ldp[1], ox: lop[0], oz: lop[1], lx, lz };
  // Kollision
  for (const tt of b.tiers) {
    const c = bLocal(b, tt.ox, tt.oz);
    const box = { obb: makeOBB(c[0], c[1], b.rot, tt.w / 2, tt.d / 2), top: b.base + tt.y1, b };
    if (b.roofType === 'hip' && tt === t) { box.hip = b.hipA; box.hipH = b.hipH; }
    if (tt.noCollide) continue;
    addCollider(box);
  }
  if (!b.noLiftHouse) addCollider({ obb: makeOBB(lp[0], lp[1], b.rot, 1.6, 1.6), top: roofTop + 3.0, b, lift: true });
  if (b.extraColliders) for (const c of b.extraColliders) addCollider(c);
}

/* ---------- Geometrie eines Gebäudes ---------- */
function emitBuilding(cm, b, lod) {
  const st = STYLE[b.style] || STYLE.plaster;
  const bay = st.bay;
  const col = b.color;
  const fKey = 'f_' + b.style;
  const P = (lx, y, lz) => { const p = bLocal(b, lx, lz); return [p[0], y, p[1]]; };
  const mbF = cm.get(fKey, b.x, b.z);
  const mbShop = b.shop ? cm.get(b.shopStyle === 'lobby' ? 'f_lobby' : 'f_shop', b.x, b.z) : null;
  const mbR = cm.get('roof', b.x, b.z), mbT = cm.get('trim', b.x, b.z);
  const trimCol = lin(0xd8d3c9);
  for (let ti = 0; ti < b.tiers.length; ti++) {
    const t = b.tiers[ti];
    if (t.skipWalls) continue;
    const hw = t.w / 2, hd = t.d / 2;
    const corners = [[t.ox - hw, t.oz + hd], [t.ox + hw, t.oz + hd], [t.ox + hw, t.oz - hd], [t.ox - hw, t.oz - hd]];
    const yBottom = ti === 0 ? b.base - 3 : b.base + t.y0;
    const yTop = b.base + t.y1;
    let uAcc = b.uOff;
    for (let k = 0; k < 4; k++) {
      const a = corners[k], c = corners[(k + 1) % 4];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const u0 = uAcc, u1 = uAcc + Math.max(1, Math.round(len / bay));
      uAcc = u1 + 3;
      const yShop = b.base + b.gh;
      if (mbShop && ti === 0) {
        const su0 = 0, su1 = Math.max(1, Math.round(len / STYLE.shop.bay));
        mbShop.quadUV(P(a[0], yBottom, a[1]), P(c[0], yBottom, c[1]), P(c[0], yShop, c[1]), P(a[0], yShop, a[1]),
          [su0, (yBottom - b.base) / b.gh], [su1, (yBottom - b.base) / b.gh], [su1, 1], [su0, 1], null);
        const y0 = yShop;
        const v0 = 0 + b.vOff, v1 = (yTop - yShop) / b.fh + b.vOff;
        if (yTop > y0 + 0.1) mbF.quadUV(P(a[0], y0, a[1]), P(c[0], y0, c[1]), P(c[0], yTop, c[1]), P(a[0], yTop, a[1]), [u0, v0], [u1, v0], [u1, v1], [u0, v1], col);
        // Gesims über dem Erdgeschoss
        if (!lod) mbT.quad(P(a[0], yShop - 0.05, a[1]), P(c[0], yShop - 0.05, c[1]), P(c[0], yShop + 0.3, c[1]), P(a[0], yShop + 0.3, a[1]), null, trimCol);
      } else {
        const v0 = (yBottom - b.base) / b.fh + b.vOff, v1 = (yTop - b.base) / b.fh + b.vOff;
        mbF.quadUV(P(a[0], yBottom, a[1]), P(c[0], yBottom, c[1]), P(c[0], yTop, c[1]), P(a[0], yTop, a[1]), [u0, v0], [u1, v0], [u1, v1], [u0, v1], col);
      }
    }
    // Dach
    const isTop = ti === b.tiers.length - 1;
    if (isTop && b.roofType === 'hip') {
      emitHipRoof(cm, b, t, yTop);
    } else {
      const rc = lin(0x9a9790);
      mbR.quadUV(P(corners[0][0], yTop, corners[0][1]), P(corners[1][0], yTop, corners[1][1]), P(corners[2][0], yTop, corners[2][1]), P(corners[3][0], yTop, corners[3][1]),
        [0, 0], [t.w / 4, 0], [t.w / 4, t.d / 4], [0, t.d / 4], rc, [0, 1, 0]);
      // Brüstung
      const ph = 0.9, pt = 0.25;
      for (let k = 0; k < (lod ? 0 : 4); k++) {
        const a = corners[k], c = corners[(k + 1) % 4];
        mbT.quad(P(a[0], yTop - 0.1, a[1]), P(c[0], yTop - 0.1, c[1]), P(c[0], yTop + ph, c[1]), P(a[0], yTop + ph, a[1]), null, col);
        // Innenseite
        const ia = [a[0] + Math.sign(t.ox - a[0]) * pt, a[1] + Math.sign(t.oz - a[1]) * pt], ic = [c[0] + Math.sign(t.ox - c[0]) * pt, c[1] + Math.sign(t.oz - c[1]) * pt];
        mbT.quad(P(ic[0], yTop, ic[1]), P(ia[0], yTop, ia[1]), P(ia[0], yTop + ph, ia[1]), P(ic[0], yTop + ph, ic[1]), null, col);
        mbT.quad(P(a[0], yTop + ph, a[1]), P(c[0], yTop + ph, c[1]), P(ic[0], yTop + ph, ic[1]), P(ia[0], yTop + ph, ia[1]), null, trimCol);
      }
      // Dachaufbauten
      if (!lod && isTop && t.w > 12 && t.d > 10 && !b.noClutter) {
        const n = ri(1, 3);
        for (let i = 0; i < n; i++) {
          const lx = t.ox + rr(-hw + 3, hw - 3), lz = t.oz + rr(-hd + 5, hd - 3);
          const p = bLocal(b, lx, lz);
          mbT.box(p[0], yTop + 0.6, p[1], rr(1.5, 3), 1.2, rr(1.5, 3), b.rot, lin(0xb4b4b0));
        }
      }
    }
  }
  if (lod) return; // Fernversion: nur Wände und Dach
  // Lifthaus
  if (!b.noLiftHouse) {
    const L = b.lift;
    mbT.box(L.x, L.y + 1.5, L.z, 3.2, 3.0, 3.2, b.rot, lin(0xcfcac0));
    mbT.box(L.x, L.y + 3.05, L.z, 3.6, 0.15, 3.6, b.rot, lin(0x8f8b84));
    const ld = cm.get('liftdoor', b.x, b.z);
    const fx = L.lx, fz = L.lz + 1.61;
    ld.quad(P(fx - 0.8, L.y + 0.02, fz), P(fx + 0.8, L.y + 0.02, fz), P(fx + 0.8, L.y + 2.2, fz), P(fx - 0.8, L.y + 2.2, fz), [0, 0, 1, 1], null);
  }
  // Haupttür
  const dl = b.doorLocal || [b.doorOff || 0, b.d / 2];
  const dw = b.doorW, dh = b.cat === 'hotel' ? 3.3 : b.cat === 'eth' ? 4.5 : 2.6;
  const dmb = cm.get(b.style === 'venice' ? 'wooddoor' : 'door', b.x, b.z);
  const dz = dl[1] + 0.04;
  dmb.quad(P(dl[0] - dw / 2, b.base, dz), P(dl[0] + dw / 2, b.base, dz), P(dl[0] + dw / 2, b.base + dh, dz), P(dl[0] - dw / 2, b.base + dh, dz), [0, 0, 1, 1], null);
  // Rahmen / Vordach
  mbT.quad(P(dl[0] - dw / 2 - 0.3, b.base + dh, dz + 0.01), P(dl[0] + dw / 2 + 0.3, b.base + dh, dz + 0.01), P(dl[0] + dw / 2 + 0.3, b.base + dh + 0.35, dz + 0.01), P(dl[0] - dw / 2 - 0.3, b.base + dh + 0.35, dz + 0.01), null, lin(0x6d6a64));
  if (b.cat === 'hotel' || b.cat === 'firma') {
    const c0 = bLocal(b, dl[0], dz + 1.6);
    mbT.box(c0[0], b.base + dh + 0.5, c0[1], dw + 3, 0.3, 3.2, b.rot, lin(b.cat === 'hotel' ? 0xb8964a : 0x3a3f45));
    for (const s of [-1, 1]) { const pp = bLocal(b, dl[0] + s * (dw / 2 + 1.3), dz + 3.0); mbT.box(pp[0], b.base + (dh + 0.5) / 2, pp[1], 0.15, dh + 0.5, 0.15, b.rot, lin(0x9a8a6a)); }
  }
}

function emitHipRoof(cm, b, t, yTop) {
  const mb = cm.get('tile', b.x, b.z);
  const P = (lx, y, lz) => { const p = bLocal(b, lx, lz); return [p[0], y, p[1]]; };
  const o = 0.45, a = b.hipA, h = b.hipH;
  const hw = t.w / 2 + o, hd = t.d / 2 + o;
  const tw = t.w / 2 - a, td = t.d / 2 - a;
  const B = [[t.ox - hw, t.oz + hd], [t.ox + hw, t.oz + hd], [t.ox + hw, t.oz - hd], [t.ox - hw, t.oz - hd]];
  const T = [[t.ox - tw, t.oz + td], [t.ox + tw, t.oz + td], [t.ox + tw, t.oz - td], [t.ox - tw, t.oz - td]];
  const c = b.roofColor || lin(0xffffff);
  const yb = yTop - 0.15, yt = yTop + h;
  for (let k = 0; k < 4; k++) {
    const b0 = B[k], b1 = B[(k + 1) % 4], t1 = T[(k + 1) % 4], t0 = T[k];
    const len = Math.hypot(b1[0] - b0[0], b1[1] - b0[1]) / 3;
    mb.quadUV(P(b0[0], yb, b0[1]), P(b1[0], yb, b1[1]), P(t1[0], yt, t1[1]), P(t0[0], yt, t0[1]), [0, 0], [len, 0], [len * 0.7, a / 2], [len * 0.3, a / 2], c);
  }
  mb.quadUV(P(T[0][0], yt, T[0][1]), P(T[1][0], yt, T[1][1]), P(T[2][0], yt, T[2][1]), P(T[3][0], yt, T[3][1]), [0, 0], [tw / 1.5, 0], [tw / 1.5, td / 1.5], [0, td / 1.5], lin(0x9a9a96), [0, 1, 0]);
  // Traufe von unten
  const mt = cm.get('trim', b.x, b.z);
  for (let k = 0; k < 4; k++) {
    const b0 = B[k], b1 = B[(k + 1) % 4];
    mt.quad(P(b1[0], yb, b1[1]), P(b0[0], yb, b0[1]), P(b0[0], yb - 0.2, b0[1]), P(b1[0], yb - 0.2, b1[1]), null, lin(0x8a5a40));
  }
}

/* ---------- Stadtgebäude entlang der Strassen ---------- */
function zoneAt(x, z) {
  const dC = Math.hypot(x - WS.CENTER.x, z - WS.CENTER.z);
  const hr = Math.hypot(x - WS.HILL.x, z - WS.HILL.z);
  if (hr < 560) return { k: 'hill', w: [14, 26], d: [12, 20], fl: [3, 7], set: [1, 3], gap: [2, 8], shop: 0.1, hip: 0.2, styles: ['office', 'glass', 'plaster', 'brick'] };
  if (dC < 560) return { k: 'core', w: [18, 34], d: [15, 26], fl: [7, 19], set: [0, 0.5], gap: [0, 1], shop: 0.85, hip: 0, styles: ['glass', 'office', 'office', 'stone', 'plaster', 'glass'] };
  if (dC < 1300) return { k: 'mid', w: [12, 26], d: [12, 19], fl: [4, 8], set: [0.5, 2.5], gap: [0, 3], shop: 0.4, hip: 0.1, styles: ['plaster', 'plaster', 'plaster2', 'brick', 'office', 'stone'] };
  return { k: 'outer', w: [10, 18], d: [9, 15], fl: [2, 5], set: [2, 5], gap: [3, 9], shop: 0.12, hip: 0.6, styles: ['plaster', 'plaster2', 'brick', 'plaster'] };
}

function lotValid(obb, ownEdge) {
  const pts = obbCorners(obb, 0);
  pts.push([obb.cx, obb.cz]);
  for (let i = 0; i < 4; i++) { const a = pts[i], c = pts[(i + 1) % 4]; pts.push([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]); }
  let hmin = 1e9, hmax = -1e9;
  const V = WS.VENICE;
  for (const p of pts) {
    const x = p[0], z = p[1];
    if (Math.abs(x) > 2300 || Math.abs(z) > 2300) return false;
    if (roadClear(x, z, 2) < 0.3) return false;
    if (waterDist(x, z) < 25) return false;
    if (coastX(z) - x < 100) return false;
    if (x > V.x0 - 40 && z > V.z0 - 40 && z < V.z1 + 40) return false;
    if (isReserved(x, z, 1.0)) return false;
    const h = terrainH(x, z); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h);
  }
  if (hmax - hmin > 7) return false;
  if (Math.hypot(obb.cx - WS.HILL.x, obb.cz - WS.HILL.z) < 250) return false;
  for (const pk of ROADS.parks) if (pointInQuad(obb.cx, obb.cz, pk.poly) || pts.slice(0, 4).some(p => pointInQuad(p[0], p[1], pk.poly))) return false;
  for (const pz of ROADS.plazas) {
    if (pz.poly && (pointInQuad(obb.cx, obb.cz, pz.poly) || pts.slice(0, 4).some(p => pointInQuad(p[0], p[1], pz.poly)))) return false;
    if (pz.round && Math.hypot(obb.cx - pz.x, obb.cz - pz.z) < 40) return false;
  }
  if (!BLD.stationPolys) BLD.stationPolys = [...ROADS.cells.values()].filter(c => c.use === 'station').map(c => cellPoly(c, 0));
  for (const q of BLD.stationPolys) if (pointInQuad(obb.cx, obb.cz, q)) return false;
  if (!occFree(obb, 0.3)) return false;
  return true;
}

let HOTEL_I = 0, FIRM_I = 0;
const STREET_NO = new Map();
function nextNo(name) { const n = (STREET_NO.get(name) || 0) + ri(1, 3); STREET_NO.set(name, n); return n; }

function genCityBuildings() {
  for (const e of ROADS.edges) {
    if (e.dead || e.bridge || e.len < 30) continue;
    const A = ROADS.nodes[e.a], B = ROADS.nodes[e.b];
    for (const side of [1, -1]) {
      const trimA = (A.round ? A.ringR + 6 : A.r) + 3, trimB = (B.round ? B.ringR + 6 : B.r) + 3;
      let d = trimA + rr(0, 4);
      const end = e.len - trimB;
      let guard = 0;
      while (d < end - 7 && guard++ < 60) {
        const px = A.x + e.dx * d, pz = A.z + e.dz * d;
        const Z = zoneAt(px, pz);
        let W = rr(Z.w[0], Z.w[1]);
        if (e.type === 'alley') W = Math.min(W, 14);
        if (d + W > end) W = end - d;
        if (W < 7) break;
        let D = rr(Z.d[0], Z.d[1]);
        const set = e.w / 2 + e.sw + 0.4 + rr(Z.set[0], Z.set[1]);
        const rot = Math.atan2(-e.nx * side, -e.nz * side);
        let placed = false;
        for (let attempt = 0; attempt < 2 && !placed; attempt++) {
          const cx = A.x + e.dx * (d + W / 2) + e.nx * side * (set + D / 2);
          const cz = A.z + e.dz * (d + W / 2) + e.nz * side * (set + D / 2);
          const obb = makeOBB(cx, cz, rot, W / 2, D / 2);
          if (lotValid(obb, e)) {
            createCityBuilding(cx, cz, rot, W, D, Z, e);
            placed = true;
          } else D *= 0.6;
          if (D < 8) break;
        }
        d += placed ? W + rr(Z.gap[0], Z.gap[1]) : 4;
      }
    }
  }
}

function createCityBuilding(cx, cz, rot, W, D, Z, e) {
  let floors = ri(Z.fl[0], Z.fl[1]);
  let tiers = [];
  const fh = 3.3;
  if (Z.k === 'core' && chance(0.12)) floors = ri(24, 40);
  let style = pick(Z.styles);
  if (floors > 18) style = chance(0.6) ? 'glass' : 'office';
  const shop = chance(Z.shop) && floors > 2;
  const gh = shop ? 4.4 : fh;
  const height = gh + (floors - 1) * fh;
  let cat = 'buero';
  if (Z.k === 'core') cat = chance(0.12) ? 'hotel' : chance(0.3) ? 'firma' : 'buero';
  else if (Z.k === 'mid') cat = chance(0.04) ? 'hotel' : chance(0.05) ? 'firma' : 'buero';
  else if (Z.k === 'hill') cat = chance(0.5) ? 'firma' : 'buero';
  // Abgestufte Hochhäuser
  if (floors >= 12 && W > 20 && D > 18 && chance(0.6)) {
    const f1 = Math.floor(floors * rr(0.35, 0.6));
    const h1 = gh + (f1 - 1) * fh;
    tiers.push({ ox: 0, oz: 0, w: W, d: D, y0: 0, y1: h1 });
    const w2 = W * rr(0.55, 0.8), d2 = D * rr(0.55, 0.8);
    tiers.push({ ox: rr(-1, 1) * (W - w2) / 2, oz: -(D - d2) / 2 * rr(0, 1), w: w2, d: d2, y0: h1, y1: height });
  }
  const roofType = (floors <= 4 && chance(Z.hip) && Math.min(W, D) >= 7.6) ? 'hip' : 'flat';
  let color;
  if (style === 'plaster' || style === 'plaster2' || style === 'stone') color = varyCol(lin(pick(PLASTER_COLS)), 0.08);
  else if (style === 'glass') color = lin(pick(['#ffffff', '#e6eeff', '#e9fff4', '#fff3e4', '#dfe6ee']));
  else color = varyCol(lin(pick(['#f2f0ea', '#e2ddd2', '#d8dee4', '#ece3d6', '#d9d4c9'])), 0.06);
  const name = cat === 'hotel' ? HOTEL_NAMES[(HOTEL_I++) % HOTEL_NAMES.length] : cat === 'firma' ? FIRM_NAMES[(FIRM_I++) % FIRM_NAMES.length] : '';
  const b = makeBuilding({ x: cx, z: cz, rot, w: W, d: D, floors, fh, gh, shop, style, color, cat, name, roofType, tiers,
    address: e.name + ' ' + nextNo(e.name), doorOff: rr(-W / 2 + 2.5, W / 2 - 2.5) * (chance(0.5) ? 0 : 0.6) });
  if (roofType === 'hip') { b.hipA = Math.max(1.5, Math.min(W, D) / 2 - 2.2); b.hipH = b.hipA * 0.55; b.roofColor = varyCol(lin(0xffffff), 0.12); }
  if ((cat === 'hotel' || cat === 'firma') && floors >= 6) b.sign = true;
  finishBuilding(b);
  return b;
}

/* ---------- Luxushotels an der Küste ---------- */
function genHotels() {
  let z = -1860;
  while (z < 1860) {
    const w = rr(38, 78);
    const zc = z + w / 2;
    const inV = zc > WS.VENICE.z0 - 60 && zc < WS.VENICE.z1 + 60;
    if (inV || waterDist(coastX(zc) - 150, zc) < 45) { z += 30; continue; }
    const d = rr(30, 52);
    const cx = coastX(zc) - 205 + 9 + 6.5 + 5 + d / 2;
    const rot = -Math.PI / 2;
    const obb = makeOBB(cx, zc, rot, w / 2, d / 2);
    const ok = obbCorners(obb, 0).every(p => waterDist(p[0], p[1]) > 30 && !isReserved(p[0], p[1], 0.5) && roadClear(p[0], p[1], 2) > 0.3) && occFree(obb, 1);
    if (!ok) { z += 20; continue; }
    const floors = ri(14, 40);
    const fh = 3.4, gh = 6.0;
    const height = gh + (floors - 1) * fh;
    const tiers = [];
    const kind = ri(0, 2);
    if (kind === 0) {
      tiers.push({ ox: 0, oz: 0, w, d, y0: 0, y1: height });
    } else if (kind === 1) {
      const f1 = Math.floor(floors * 0.55), h1 = gh + (f1 - 1) * fh;
      tiers.push({ ox: 0, oz: 0, w, d, y0: 0, y1: h1 });
      tiers.push({ ox: 0, oz: -d * 0.12, w: w * 0.7, d: d * 0.7, y0: h1, y1: height - 2 * fh });
      tiers.push({ ox: 0, oz: -d * 0.18, w: w * 0.45, d: d * 0.5, y0: height - 2 * fh, y1: height });
    } else {
      const h1 = gh + 2 * fh;
      tiers.push({ ox: 0, oz: 0, w, d, y0: 0, y1: h1 });
      tiers.push({ ox: 0, oz: -d * 0.1, w: w * 0.85, d: d * 0.55, y0: h1, y1: height });
    }
    const b = makeBuilding({ x: cx, z: zc, rot, w, d, floors, fh, gh, shop: true, shopStyle: 'lobby', style: 'hotel', cat: 'hotel',
      color: lin(pick(['#ffffff', '#fbf6ec', '#f4efe6', '#eef2f4', '#fff8ee'])), name: HOTEL_NAMES[(HOTEL_I++) % HOTEL_NAMES.length], tiers, address: 'Seepromenade ' + nextNo('Seepromenade') });
    b.sign = true; b.luxury = true;
    finishBuilding(b);
    z += w + rr(16, 34);
  }
}

/* ---------- Klein-Venedig ---------- */
const CALLI = ['Calle Larga', 'Fondamenta Nuove', 'Calle del Forno', 'Salizada San Lio', 'Rio Terà', 'Campo San Polo', 'Calle dei Fabbri',
  'Fondamenta Zattere', 'Calle della Mandola', 'Campiello del Remer', 'Calle Lunga', 'Ruga Giuffa', 'Calle dei Botteri', 'Fondamenta Ormesini'];
function genVenice(scene) {
  const V = WS.VENICE, PZ = WS.PIAZZA;
  BLD.vBridges = [];
  // Fussgängerbrücken über die Kanäle
  for (const poly of WATER.polys) {
    if (poly.kind !== 'canal') continue;
    const pts = poly.pts, nrm = polyNormals(pts);
    let acc = 0;
    for (let i = 4; i < pts.length - 4; i++) {
      acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc < 62) continue;
      const x = pts[i][0], z = pts[i][1];
      if (x > coastX(z) - 25) continue;
      // nicht an Kanalkreuzungen
      if (waterDist(x + nrm[i][0] * (poly.hw[i] + 4), z + nrm[i][1] * (poly.hw[i] + 4)) < 1 || waterDist(x - nrm[i][0] * (poly.hw[i] + 4), z - nrm[i][1] * (poly.hw[i] + 4)) < 1) continue;
      acc = 0;
      const span = poly.hw[i] * 2 + 5;
      BLD.vBridges.push({ x, z, nx: nrm[i][0], nz: nrm[i][1], span, hw: poly.hw[i] });
      reserveCircle(x + nrm[i][0] * (span / 2 + 2), z + nrm[i][1] * (span / 2 + 2), 5.5);
      reserveCircle(x - nrm[i][0] * (span / 2 + 2), z - nrm[i][1] * (span / 2 + 2), 5.5);
    }
  }
  // Piazza
  reserveOBB(makeOBB(PZ.x, PZ.z, 0, PZ.hw, PZ.hd));
  reserveCircle(WS.TRAM_V.x, WS.TRAM_V.z, 55);
  // Häuser
  let ci = 0;
  for (let x = V.x0 + 10; x < 2060; x += 15.5) {
    for (let z = V.z0 + 10; z < V.z1 - 6; z += rr(14.5, 18)) {
      const cx = x + rr(-1.5, 1.5), cz = z + rr(-1, 1);
      if (cx > coastX(cz) - 9) continue;
      const w = rr(9, 13), d = rr(10, 14);
      const obb0 = makeOBB(cx, cz, 0, w / 2, d / 2);
      const corners = obbCorners(obb0, 0);
      const bad = corners.concat([[cx, cz]]).some(p => waterDist(p[0], p[1]) < 3.2 || p[0] > coastX(p[1]) - 4 || isReserved(p[0], p[1], 0.8) || p[0] < V.x0 - 5);
      if (bad || !occFree(obb0, 0.4)) continue;
      // Tür zur offensten Seite
      const dirs = [[0, 1, 0], [Math.PI / 2, 1, 0], [Math.PI, 1, 0], [-Math.PI / 2, 1, 0]];
      let bestRot = 0, bestScore = -1;
      for (const [r] of dirs) {
        const fx = Math.sin(r), fz = Math.cos(r);
        const ext = (Math.abs(fx) > 0.5 ? w : d) / 2;
        const tx = cx + fx * (ext + 2.2), tz = cz + fz * (ext + 2.2);
        let score = waterDist(tx, tz) > 0.5 ? 1 : 0;
        if (score && occFree(makeOBB(tx, tz, 0, 0.8, 0.8), 0)) score += 1;
        score += rnd() * 0.5;
        if (score > bestScore) { bestScore = score; bestRot = r; }
      }
      const rw = Math.abs(Math.sin(bestRot)) > 0.5 ? d : w, rd = Math.abs(Math.sin(bestRot)) > 0.5 ? w : d;
      const floors = ri(3, 5);
      const cat = chance(0.12) ? 'hotel' : 'buero';
      const b = makeBuilding({ x: cx, z: cz, rot: bestRot, w: rw, d: rd, floors, fh: 3.4, gh: 3.6, style: 'venice', cat,
        color: varyCol(lin(pick(VENICE_COLS)), 0.1), name: cat === 'hotel' ? 'Palazzo ' + pick(['Rialto', 'Dandolo', 'Contarini', 'Gritti', 'Bauer', 'Pisani', 'Foscari', 'Barbaro']) : '',
        roofType: Math.min(rw, rd) >= 7.6 ? 'hip' : 'flat', base: WS.VENICE_Y, address: CALLI[ci++ % CALLI.length] + ' ' + ri(1, 99), noClutter: true });
      if (b.roofType === 'hip') { b.hipA = Math.max(1.5, Math.min(rw, rd) / 2 - 2.2); b.hipH = b.hipA * 0.4; b.roofColor = varyCol(lin(0xffffff), 0.1); }
      finishBuilding(b);
    }
  }
  // Piazza: Campanile, Basilika, Prokuratien
  const camp = makeBuilding({ x: PZ.x - 30, z: PZ.z - 45, rot: 0, w: 12, d: 12, floors: 1, fh: 4, gh: 6, style: 'brick', cat: 'halle', name: 'Campanile', base: WS.VENICE_Y,
    color: lin(0xffffff), noClutter: true, noLiftHouse: false, address: 'Piazza San Marco', tiers: [{ ox: 0, oz: 0, w: 12, d: 12, y0: 0, y1: 59.6 }] });
  camp.special = 'campanile';
  camp.liftLocal = [0, 0];
  camp.noLiftHouse = true;
  finishBuilding(camp);
  camp.lift.y = camp.base + 59.6;
  const bas = makeBuilding({ x: PZ.x + 8, z: PZ.z - PZ.hd - 19, rot: 0, w: 44, d: 34, floors: 2, fh: 7, gh: 9, style: 'stone', cat: 'halle', name: 'Basilica San Marco (Nachbau)', base: WS.VENICE_Y,
    color: lin(0xf6ead6), noClutter: true, address: 'Piazza San Marco 1' });
  bas.special = 'basilica';
  finishBuilding(bas);
  const proc = makeBuilding({ x: PZ.x - PZ.hw - 9, z: PZ.z + 5, rot: Math.PI / 2, w: PZ.hd * 2 - 10, d: 15, floors: 3, fh: 4.2, gh: 5, style: 'stone', cat: 'hotel', name: 'Procuratie Palace', base: WS.VENICE_Y,
    color: lin(0xf2ead8), noClutter: true, shop: true, shopStyle: 'lobby', address: 'Piazza San Marco 12' });
  finishBuilding(proc);
}

/* ---------- Hügel: Firmensitze und ETH ---------- */
function genHill() {
  const H = WS.HILL;
  const topY = terrainH(H.x, H.z);
  // ETH-Hauptgebäude
  const ex = H.x, ez = H.z - 24;
  const eth = makeBuilding({ x: ex, z: ez, rot: 0, w: 128, d: 34, floors: 4, fh: 4.8, gh: 5.6, style: 'stone', cat: 'eth', name: 'ETH Hauptgebäude', base: topY - 0.3,
    color: lin(0xf4ecdc), noClutter: true, address: 'Rämistrasse 101', doorLocal: [0, 17 + 5],
    tiers: [
      { ox: 0, oz: 0, w: 128, d: 34, y0: 0, y1: 20.0 },
      { ox: 0, oz: 2.5, w: 42, d: 39, y0: 0, y1: 25.5 }
    ] });
  eth.special = 'eth';
  eth.liftLocal = [40, -8];
  eth.tiers[1].noCollide = false;
  eth.extraColliders = [];
  eth.roofYOverride = eth.base + 20.0;
  // Flügel nach hinten
  for (const s of [-1, 1]) {
    const c = bLocal(eth, s * 53, -42);
    eth.extraColliders.push({ obb: makeOBB(c[0], c[1], 0, 11, 26), top: eth.base + 20, b: eth });
    reserveOBB(makeOBB(c[0], c[1], 0, 12, 27));
  }
  // Säulenhalle (Kollision: Säulen)
  for (let i = 0; i < 8; i++) {
    const lx = -17.5 + i * 5;
    if (Math.abs(lx) < 3) continue;
    const c = bLocal(eth, lx, 26.2);
    eth.extraColliders.push({ obb: makeOBB(c[0], c[1], 0, 0.85, 0.85), top: eth.base + 14, b: eth });
  }
  finishBuilding(eth);
  eth.door.ox = ex; eth.door.oz = ez + 17 + 8; eth.door.oy = terrainH(ex, ez + 25);
  reserveOBB(makeOBB(ex, ez, 0, 70, 22));
  reserveOBB(makeOBB(ex, ez + 20, 0, 26, 12));
  // Firmensitze am Hang
  const placed = [];
  let fi = 0;
  for (let k = 0; k < 60 && placed.length < 7; k++) {
    const th = rr(-Math.PI, Math.PI), r = rr(150, 250);
    const cx = H.x + Math.cos(th) * r, cz = H.z + Math.sin(th) * r;
    const w = rr(26, 40), d = rr(18, 26);
    const rot = Math.atan2(H.x - cx, H.z - cz) + Math.PI; // Front zeigt bergab
    const obb = makeOBB(cx, cz, rot, w / 2, d / 2);
    const pts = obbCorners(obb, 2).concat([[cx, cz]]);
    if (pts.some(p => isReserved(p[0], p[1], 3) || roadClear(p[0], p[1], 2) < 2)) continue;
    let hmin = 1e9, hmax = -1e9; for (const p of pts) { const h = terrainH(p[0], p[1]); hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); }
    if (hmax - hmin > 14 || !occFree(obb, 6)) continue;
    const floors = ri(6, 11);
    const b = makeBuilding({ x: cx, z: cz, rot, w, d, floors, fh: 3.6, gh: 4.8, style: chance(0.6) ? 'glass' : 'office', cat: 'firma',
      color: lin(pick(['#ffffff', '#e4ecff', '#e6fff2', '#fff4e6'])), name: FIRM_NAMES[(FIRM_I++) % FIRM_NAMES.length], address: 'Hochschulhügel ' + (++fi * 3),
      tiers: [{ ox: 0, oz: 0, w, d, y0: 0, y1: 4.8 + 3.6 * 2 }, { ox: 0, oz: -2, w: w * 0.9, d: d * 0.9, y0: 4.8 + 3.6 * 2, y1: 4.8 + 3.6 * (floors - 1) }] });
    b.sign = true;
    finishBuilding(b);
    placed.push(b);
    reserveOBB(makeOBB(cx, cz, rot, w / 2 + 6, d / 2 + 8));
  }
}

/* ---------- Spezialgeometrie: ETH, Campanile, Basilika ---------- */
function emitSpecials(scene, M) {
  for (const b of BLD.list) {
    if (!b.special) continue;
    const g = new THREE.Group();
    g.position.set(b.x, b.base, b.z); g.rotation.y = b.rot;
    const mbS = new MB(), mbC = new MB(), mbF = new MB(), mbL = new MB(), mbLD = new MB();
    if (b.special === 'eth') {
      // Flügel
      for (const s of [-1, 1]) mbF.box(s * 53, 10, -42, 22, 20, 52, 0, lin(0xf4ecdc), 3.6);
      // Säulenhalle
      for (let i = 0; i < 8; i++) { const lx = -17.5 + i * 5; mbS.cyl(lx, 0, 26.2, 0.8, 0.7, 13.2, 16, null, false); mbS.box(lx, 13.4, 26.2, 2.0, 0.4, 2.0, 0); mbS.box(lx, 0.25, 26.2, 2.0, 0.5, 2.0, 0); }
      mbS.box(0, 14.3, 25.5, 44, 1.8, 5.5, 0);
      // Giebel
      const gt = new THREE.BufferGeometry();
      const v = new Float32Array([-22, 15.2, 28.2, 22, 15.2, 28.2, 0, 22, 28.2, -22, 15.2, 23, 0, 22, 23, 22, 15.2, 23]);
      gt.setAttribute('position', new THREE.BufferAttribute(v, 3)); gt.setIndex([0, 1, 2, 3, 0, 2, 3, 2, 4, 1, 5, 4, 1, 4, 2]); gt.computeVertexNormals();
      mbS.addGeom(gt, new THREE.Matrix4(), null);
      // Treppe vor dem Eingang
      for (let i = 0; i < 4; i++) mbS.box(0, 0.12 + i * 0.0, 30 + i * 0.8, 46 - i * 2, 0.3, 0.8, 0);
      // Kuppel: Tambour, Kuppel, Laterne
      mbS.cyl(0, 25.5, 2.5, 14, 14, 6, 40, null, true);
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; mbS.box(Math.cos(a) * 14.2, 28.5, 2.5 + Math.sin(a) * 14.2, 0.9, 6, 0.9, -a); }
      const dome = new THREE.SphereGeometry(13.6, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
      mbC.addGeom(dome, new THREE.Matrix4().makeTranslation(0, 31.5, 2.5), null);
      mbS.cyl(0, 44.8, 2.5, 2.2, 2.2, 3.2, 16, null, true);
      const cap = new THREE.SphereGeometry(2.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      mbC.addGeom(cap, new THREE.Matrix4().makeTranslation(0, 48, 2.5), null);
      mbS.cyl(0, 50.4, 2.5, 0.15, 0.05, 3, 6, null, true);
      // Schriftzug
      const cv = textCanvas('ETH', 512, 128, { bg: '#e2d8c2', fg: '#4a3f2e', font: 'bold 96px Georgia' });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshStandardMaterial({ map: canvasTex(cv), roughness: 0.8 }));
      sign.position.set(0, 18.6, 28.25); g.add(sign);
    } else if (b.special === 'campanile') {
      for (const [x, z] of [[-5.4, -5.4], [5.4, -5.4], [5.4, 5.4], [-5.4, 5.4]]) mbS.box(x, 63.6, z, 1.8, 8, 1.8, 0);
      for (const [x, z] of [[0, -5.4], [5.4, 0], [0, 5.4], [-5.4, 0]]) mbS.box(x, 63.5, z, 0.6, 8, 0.6, 0);
      mbS.box(0, 68.2, 0, 12.6, 1.4, 12.6, 0);
      mbS.box(0, 71, 0, 9, 4.4, 9, 0);
      const pyr = new THREE.ConeGeometry(6.6, 18, 4, 1); pyr.rotateY(Math.PI / 4);
      mbC.addGeom(pyr, new THREE.Matrix4().makeTranslation(0, 82, 0), null);
      for (const [x, z] of [[-5.4, -5.4], [5.4, -5.4], [5.4, 5.4], [-5.4, 5.4]]) b.extraColliders = (b.extraColliders || []);
      for (const [x, z] of [[-5.4, -5.4], [5.4, -5.4], [5.4, 5.4], [-5.4, 5.4], [0, -5.4], [5.4, 0], [0, 5.4], [-5.4, 0]]) {
        const p = bLocal(b, x, z);
        addCollider({ obb: makeOBB(p[0], p[1], 0, x * z === 0 ? 0.35 : 0.95, x * z === 0 ? 0.35 : 0.95), top: b.base + 67.6, bottom: b.base + 59.7, b });
      }
      addCollider({ obb: makeOBB(b.x, b.z, 0, 1.6, 1.6), top: b.base + 59.6 + 3.0, bottom: b.base + 59.7, b, lift: true });
      // Lifthaus im Glockenstuhl
      mbL.box(0, 59.6 + 1.5, 0, 3.2, 3.0, 3.2, 0, lin(0xcfcac0));
      mbLD.quad([-0.8, 59.62, 1.61], [0.8, 59.62, 1.61], [0.8, 61.8, 1.61], [-0.8, 61.8, 1.61], [0, 0, 1, 1], null);
    } else if (b.special === 'basilica') {
      for (const [x, z, r] of [[0, 0, 7.5], [-13, 0, 5.5], [13, 0, 5.5], [0, -11, 5.5], [0, 11, 5.5]]) {
        mbS.cyl(x, 16, z, r * 0.9, r * 0.9, 3, 24, null, true);
        mbC.addGeom(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.Matrix4().makeTranslation(x, 19, z), null);
        mbS.cyl(x, 19 + r, z, 0.6, 0.2, 2.5, 8, null, true);
      }
      for (let i = 0; i < 5; i++) { const x = -16 + i * 8; mbS.box(x, 9, 17.3, 6.2, 0.6, 0.8, 0); mbS.cyl(x - 2.8, 0, 17.4, 0.35, 0.35, 9, 10, null, false); mbS.cyl(x + 2.8, 0, 17.4, 0.35, 0.35, 9, 10, null, false); }
    }
    const add = (mb, mat) => { if (!mb.empty()) { const m = new THREE.Mesh(compactGeometry(mb.build(), !!mat.vertexColors), mat); m.castShadow = true; m.receiveShadow = true; g.add(m); } };
    add(mbS, M.stoneTrim); add(mbC, M.copper); add(mbF, M.f_stone); add(mbL, M.trim); add(mbLD, M.liftdoor);
    scene.add(g);
  }
}

/* ---------- Schriftzüge der Hotels und Firmen ---------- */
function emitSigns(scene) {
  for (const b of BLD.list) {
    if (!b.sign || !b.name) continue;
    const t = b.tiers[b.tiers.length - 1];
    const r = SIGNS.add('bldsign|' + b.cat + '|' + b.name, 384, 72, (ctx, w, h) => {
      ctx.fillStyle = b.cat === 'hotel' ? '#f6d27a' : '#e8f4ff';
      let fs = 48; ctx.font = (b.cat === 'hotel' ? 'italic bold ' : 'bold ') + fs + 'px ' + (b.cat === 'hotel' ? 'Georgia' : 'Arial');
      while (ctx.measureText(b.name).width > w - 12 && fs > 12) { fs -= 2; ctx.font = ctx.font.replace(/\d+px/, fs + 'px'); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.name, w / 2, h / 2 + 2);
    });
    const w = Math.min(t.w * 0.85, 40), h = w * 72 / 384;
    const mat = signMaterial(r, 'glow');
    const m = new THREE.Mesh(SIGNS.plane(r, w, h), mat);
    const p = bLocal(b, t.ox, t.oz + t.d / 2 + 0.15);
    m.position.set(p[0], b.base + t.y1 - h * 0.7 - 0.6, p[1]);
    m.rotation.y = b.rot;
    scene.add(m); nearVis(m, 1800);
    if (!BLD.signs.includes(mat)) BLD.signs.push(mat);
  }
}

function buildBuildingMeshes(scene) {
  const M = makeBuildingMaterials();
  BLD.mats = M;
  const atlas = WORLD.renderer && WORLD.renderer.capabilities.isWebGL2;
  const CH = atlas ? 250 : WS.CHUNK; // feine Zellen: genauere Detailstufen und Verdeckungs-Culling
  const cm = new ChunkedMB(CH);
  const cmLod = atlas ? new ChunkedMB(CH) : null;
  for (const b of BLD.list) { emitBuilding(cm, b, false); if (cmLod) emitBuilding(cmLod, b, true); }
  // Venedig: Brücken
  for (const br of BLD.vBridges) { emitVeniceBridge(cm, br); if (cmLod) emitVeniceBridge(cmLod, br, true); }
  // Piazza-Pflaster und Venedig-Pflaster vor dem Wasser
  const PZ = WS.PIAZZA;
  const pg = cm.get('ground', PZ.x, PZ.z);
  pg.flat([PZ.x - PZ.hw, PZ.z + PZ.hd], [PZ.x + PZ.hw, PZ.z + PZ.hd], [PZ.x + PZ.hw, PZ.z - PZ.hd], [PZ.x - PZ.hw, PZ.z - PZ.hd], WS.VENICE_Y + 0.04, 3, null);
  // Stadtplätze und Stationsplätze gepflastert
  for (const pz of ROADS.plazas) if (pz.poly) { const q = cellPoly(pz.cell, 0); cm.get('ground', pz.cell.cx, pz.cell.cz).flat(q[3], q[2], q[1], q[0], terrainH(pz.cell.cx, pz.cell.cz) + 0.04, 3, null); }
  for (const st of TRANSIT.stations) {
    const q = cellPoly(st.cell, 0);
    const y = terrainH(st.cell.cx, st.cell.cz) + 0.04;
    emitPlazaWithHole(cm.get('ground', st.cell.cx, st.cell.cz), q, y, st);
  }
  let meshes;
  if (atlas) {
    M.atlas = makeAtlasMaterial(buildAtlasTexture());
    const near = finishAtlas(cm, M.atlas, scene, CH);
    const far = finishAtlas(cmLod, M.atlas, scene, CH);
    for (const k in near) LOD.bld.push(Object.assign({ near: near[k].mesh, far: far[k] ? far[k].mesh : null }, near[k].c));
    for (const k in far) if (!near[k]) LOD.bld.push(Object.assign({ near: null, far: far[k].mesh }, far[k].c));
    for (const c of LOD.bld) {
      const bb = (c.near || c.far).geometry.boundingBox;
      c.occ = occRegister({ x: (bb.min.x + bb.max.x) / 2, z: (bb.min.z + bb.max.z) / 2, hx: (bb.max.x - bb.min.x) / 2, hz: (bb.max.z - bb.min.z) / 2, minY: bb.min.y, maxY: bb.max.y });
    }
    meshes = cm.finish({ ground: M.ground }, scene, {});
  } else {
    const mats = Object.assign({}, M);
    const cast = {}; for (const k in M) cast[k] = k !== 'ground';
    meshes = cm.finish(mats, scene, { cast });
  }
  emitSpecials(scene, M);
  emitSigns(scene);
  return meshes;
}

function emitPlazaWithHole(mb, q, y, st) {
  // Platz als Raster aus kleinen Feldern; Felder über der Treppenöffnung weglassen
  const N = 10;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const L = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
    const P = (u, v) => L(L(q[0], q[1], u), L(q[3], q[2], u), v);
    const a = P(i / N, j / N), b = P((i + 1) / N, j / N), c = P((i + 1) / N, (j + 1) / N), d = P(i / N, (j + 1) / N);
    const cx = (a[0] + c[0]) / 2, cz = (a[1] + c[1]) / 2;
    const l = stWorldToLocal(st, cx, cz);
    if (Math.abs(l[0]) < 9 && l[1] > st.aTop - 15 && l[1] < st.aTop + 6) {
      // feiner unterteilen
      const SUB = 10;
      for (let ii = 0; ii < SUB; ii++) for (let jj = 0; jj < SUB; jj++) {
        const Q = (u, v) => [lerp(lerp(a[0], b[0], u), lerp(d[0], c[0], u), v), lerp(lerp(a[1], b[1], u), lerp(d[1], c[1], u), v)];
        const a2 = Q(ii / SUB, jj / SUB), b2 = Q((ii + 1) / SUB, jj / SUB), c2 = Q((ii + 1) / SUB, (jj + 1) / SUB), d2 = Q(ii / SUB, (jj + 1) / SUB);
        const l2 = stWorldToLocal(st, (a2[0] + c2[0]) / 2, (a2[1] + c2[1]) / 2);
        if (Math.abs(l2[0]) < 2.6 && l2[1] > st.aTop - 6.0 && l2[1] < st.aTop + 0.6) continue;
        mb.flat(d2, c2, b2, a2, y, 3, null);
      }
      continue;
    }
    mb.flat(d, c, b, a, y, 3, null);
  }
}

function emitVeniceBridge(cm, br, noDeck) {
  const mb = cm.get('trim', br.x, br.z);
  const half = br.span / 2, W = 3.4, arch = 1.7;
  const tx = -br.nz, tz = br.nx; // entlang Kanal
  const y0 = WS.VENICE_Y + 0.02;
  const hAt = (a) => y0 + arch * (1 - (a / half) * (a / half));
  const P = (a, l, y) => [br.x + br.nx * a + tx * l, y, br.z + br.nz * a + tz * l];
  const col = lin(0xbfb2a0), stone = lin(0x9c8e7b);
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a0 = -half + br.span * i / n, a1 = -half + br.span * (i + 1) / n;
    const h0 = hAt(a0), h1 = hAt(a1);
    mb.quad(P(a0, -W / 2, h0), P(a0, W / 2, h0), P(a1, W / 2, h1), P(a1, -W / 2, h1), null, col);
    mb.quad(P(a1, -W / 2, h1), P(a1, W / 2, h1), P(a0, W / 2, h0), P(a0, -W / 2, h0), null, col);
    const u0 = Math.max(h0 - 0.6, WS.WATER_Y + (Math.abs(a0) > br.hw ? 1.5 : 0)), u1 = Math.max(h1 - 0.6, WS.WATER_Y + (Math.abs(a1) > br.hw ? 1.5 : 0));
    for (const s of [-1, 1]) {
      mb.quad(P(a0, s * W / 2, u0 - 0.1), P(a1, s * W / 2, u1 - 0.1), P(a1, s * W / 2, h1 + 0.9), P(a0, s * W / 2, h0 + 0.9), null, stone);
      mb.quad(P(a1, s * W / 2, u1 - 0.1), P(a0, s * W / 2, u0 - 0.1), P(a0, s * W / 2, h0 + 0.9), P(a1, s * W / 2, h1 + 0.9), null, stone);
      mb.quad(P(a0, s * (W / 2 - 0.25), h0 + 0.9), P(a1, s * (W / 2 - 0.25), h1 + 0.9), P(a1, s * W / 2, h1 + 0.9), P(a0, s * W / 2, h0 + 0.9), null, col);
      mb.quad(P(a1, s * (W / 2 - 0.25), h1 + 0.9), P(a0, s * (W / 2 - 0.25), h0 + 0.9), P(a0, s * W / 2, h0 + 0.9), P(a1, s * W / 2, h1 + 0.9), null, col);
    }
  }
  if (!noDeck) addDeck({ kind: 'vbridge', ox: br.x - br.nx * half, oz: br.z - br.nz * half, dx: br.nx, dz: br.nz, a0: 0, a1: br.span, hw: W / 2, h: (a) => hAt(a - half), rails: [1.5, br.span - 1.5] });
}

/* Nächste Tür in Reichweite */
function doorNear(x, z, r) {
  let best = null, bd = r;
  BLD.doorHash.query(x - r, z - r, x + r, z + r, (b) => { const d = Math.hypot(b.door.x - x, b.door.z - z); if (d < bd) { bd = d; best = b; } });
  return best;
}
function liftNear(x, z, y, r) {
  let best = null, bd = r;
  BLD.hash.query(x - r, z - r, x + r, z + r, (box) => {
    if (!box.lift) return;
    const b = box.b; const L = b.lift;
    if (Math.abs(y - L.y) > 1.5) return;
    const d = Math.hypot(L.dx - x, L.dz - z);
    if (d < bd) { bd = d; best = b; }
  });
  return best;
}
function buildingLabel(b) {
  const cat = { hotel: 'Hotel', firma: 'Firmensitz', buero: 'Bürogebäude', eth: 'Hochschule', halle: 'Halle' }[b.cat] || 'Gebäude';
  if (b.cat === 'hotel') return (b.name || 'Hotel') + ' (Luxushotel)';
  if (b.cat === 'firma') return (b.name ? b.name + ' – ' : '') + 'Firmensitz';
  if (b.cat === 'eth') return 'ETH Hauptgebäude';
  if (b.name) return b.name;
  return cat + ', ' + (b.address || '');
}

/* ---------- Fassaden-Atlas (WebGL2: 2D-Textur-Array) ----------
   Alle Gebäudetexturen liegen als Ebenen in einem Array. Jede Ebene kachelt für sich, deshalb
   genügt ein einziges Material für alle Gebäude einer Kachel (ein Draw-Call statt ~17). */
const ATLAS_LAYERS = ['f_plaster', 'f_plaster2', 'f_brick', 'f_glass', 'f_office', 'f_hotel', 'f_venice', 'f_stone', 'f_shop', 'f_lobby',
  'door', 'wooddoor', 'liftdoor', 'roof', 'tile', 'trim'];
const ATLAS_ROUGH = [0.85, 0.85, 0.85, 0.4, 0.85, 0.8, 0.85, 0.8, 0.6, 0.6, 0.4, 0.7, 0.3, 0.95, 0.8, 0.8];
const ATLAS_METAL = [0, 0, 0, 0.1, 0, 0, 0, 0, 0, 0, 0.2, 0, 0.8, 0, 0, 0];

function buildAtlasTexture() {
  const S = 256, N = ATLAS_LAYERS.length;
  const data = new Uint8Array(S * S * 4 * N);
  const cv = makeCanvas(S, S), ctx = cv.getContext('2d');
  ATLAS_LAYERS.forEach((k, i) => {
    ctx.clearRect(0, 0, S, S);
    const m = BLD.mats[k];
    if (k === 'trim') { ctx.fillStyle = '#d9d4ca'; ctx.fillRect(0, 0, S, S); }
    else if (m && m.map && m.map.image) ctx.drawImage(m.map.image, 0, 0, S, S);
    // Canvas-Zeile 0 ist oben; Textur-v=1 soll oben sein -> Zeilen umdrehen
    const px = ctx.getImageData(0, 0, S, S).data;
    for (let y = 0; y < S; y++) data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), (i * S * S + y * S) * 4);
  });
  const t = new THREE.DataTexture2DArray(data, S, S, N);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

function makeAtlasMaterial(tex) {
  const dummy = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  dummy.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: dummy, roughness: 1, metalness: 0, envMapIntensity: 1.0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uAtlas = { value: tex };
    sh.uniforms.uNight = NIGHT_U;
    sh.uniforms.uLiftCut = LIFTCUT;
    sh.uniforms.uRough = { value: ATLAS_ROUGH };
    sh.uniforms.uMetal = { value: ATLAS_METAL };
    sh.vertexShader = 'attribute float aLayer;\nvarying float vLayer;\nvarying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvLayer = aLayer;\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'precision highp sampler2DArray;\nuniform sampler2DArray uAtlas;\nuniform float uNight;\nuniform vec4 uLiftCut;\nuniform float uRough[16];\nuniform float uMetal[16];\nvarying float vLayer;\nvarying vec3 vWP;\nfloat winMask = 0.0;\nint gLayer = 0;\n' +
      sh.fragmentShader
        .replace('void main() {', `void main() {
          {
            vec3 d = vWP - uLiftCut.xyz;
            float c = cos(uLiftCut.w), s = sin(uLiftCut.w);
            float lx = d.x * c - d.z * s, lz = d.x * s + d.z * c;
            if (abs(lx) < 1.86 && abs(lz) < 1.86 && d.y > -0.05 && d.y < 3.25) discard;
          }`)
        .replace('#include <map_fragment>', `
          gLayer = int(vLayer + 0.5);
          vec4 texelColor = texture(uAtlas, vec3(vUv, float(gLayer)));
          winMask = clamp((0.9 - texelColor.a) / 0.22, 0.0, 1.0);
          texelColor.a = 1.0;
          texelColor = sRGBToLinear(texelColor);
          diffuseColor *= texelColor;`)
        .replace('#include <color_fragment>', `
          #ifdef USE_COLOR
            diffuseColor.rgb *= mix(vColor, vec3(1.0), winMask);
          #endif`)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(uRough[gLayer], 0.07, winMask);')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = mix(uMetal[gLayer], 0.55, winMask);')
        .replace('#include <emissivemap_fragment>', `
          {
            vec2 cell = floor(vUv + vec2(0.003));
            float hsh = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
            float lit = step(hsh, 0.30);
            float dim = 0.55 + 0.45 * fract(hsh * 13.7);
            vec3 lc = mix(vec3(1.0, 0.68, 0.38), vec3(0.78, 0.86, 1.0), step(0.75, fract(hsh * 7.31)));
            // manchmal steht jemand am Fenster: Silhouette aus Kopf und Schultern
            vec2 fc = fract(vUv + vec2(0.003));
            float px = 0.34 + 0.32 * fract(hsh * 37.1);
            vec2 hd = vec2(fc.x - px, (fc.y - 0.47) * 1.15);
            float sil = step(fract(hsh * 91.7), 0.45) * max(step(abs(fc.x - px), 0.06 + 0.02 * step(fc.y, 0.38)) * step(fc.y, 0.42), step(dot(hd, hd), 0.0021));
            totalEmissiveRadiance += winMask * lit * uNight * lc * 1.05 * dim * (1.0 - 0.85 * sil);
          }`);
  };
  return m;
}

/* Alle Atlas-Ebenen einer Kachel zu einer Geometrie mit Ebenen-Attribut zusammenfügen */
function finishAtlas(cm, mat, parent, CH) {
  const groups = {};
  for (const [k, mb] of cm.map) {
    const li = ATLAS_LAYERS.indexOf(mb.key);
    if (li < 0 || mb.empty()) continue;
    const ck = k.slice(k.indexOf('|') + 1);
    (groups[ck] = groups[ck] || []).push({ mb, li });
  }
  const out = {};
  for (const ck in groups) {
    const list = groups[ck];
    let nv = 0, ni = 0; for (const o of list) { nv += o.mb.vc; ni += o.mb.idx.length; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), lay = new Float32Array(nv);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (const { mb, li } of list) {
      pos.set(mb.p, vo * 3); nor.set(mb.n, vo * 3); uv.set(mb.uv, vo * 2); col.set(mb.c, vo * 3); lay.fill(li, vo, vo + mb.vc);
      for (let i = 0; i < mb.idx.length; i++) idx[io + i] = mb.idx[i] + vo;
      vo += mb.vc; io += mb.idx.length;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aLayer', new THREE.BufferAttribute(lay, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    compactGeometry(g, true);
    const m = new THREE.Mesh(g, mat);
    m.name = 'chunk:atlas'; m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false;
    parent.add(m);
    const [cx, cz] = ck.split('|').map(Number);
    out[ck] = { mesh: m, c: { x: (cx + 0.5) * CH - 2500, z: (cz + 0.5) * CH - 2500, r: CH * 0.5 } };
  }
  for (const k of [...cm.map.keys()]) if (ATLAS_LAYERS.includes(cm.map.get(k).key)) cm.map.delete(k);
  return out;
}
