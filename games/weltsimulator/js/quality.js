/* ================= QUALITÄT, MESSUNG, DETAILSTUFEN =================
   Drei Qualitätsstufen, Bildraten-Anzeige (F), automatische Auflösung bei zu wenig Bildern
   pro Sekunde, und die Umschaltung der Detailstufen (Gebäude, Bäume) nach Entfernung. */

const QUALITY = {
  presets: {
    low:  { label: 'Niedrig', ratio: 0.85, shadow: 1024, shadowRange: 90,  far: 1900, treeLod: 230, bldLod: 450,  vehScale: 0.7, post: false, ao: false, bloom: false, fxaa: false },
    mid:  { label: 'Mittel',  ratio: 1.0,  shadow: 2048, shadowRange: 140, far: 2700, treeLod: 380, bldLod: 750,  vehScale: 1.0, post: true,  ao: false, bloom: true,  fxaa: true },
    high: { label: 'Hoch',    ratio: 1.5,  shadow: 4096, shadowRange: 180, far: 3400, treeLod: 600, bldLod: 1150, vehScale: 1.4, post: true,  ao: true,  bloom: true,  fxaa: true }
  },
  order: ['low', 'mid', 'high'],
  key: 'mid', cur: null, auto: true, dyn: 1, showStats: true,
  frames: 0, acc: 0, fps: 60, ms: 16, lastAdjust: 0, statT: 0
};
const SETTINGS_KEY = 'weltsimulator.settings.v1';

function loadQualitySettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (QUALITY.presets[s.key]) QUALITY.key = s.key;
    if (typeof s.auto === 'boolean') QUALITY.auto = s.auto;
    if (typeof s.stats === 'boolean') QUALITY.showStats = s.stats;
  } catch (e) { }
  QUALITY.cur = QUALITY.presets[QUALITY.key];
}
function saveQualitySettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ key: QUALITY.key, auto: QUALITY.auto, stats: QUALITY.showStats })); } catch (e) { }
}

function applyQuality(renderer, camera) {
  const q = QUALITY.cur = QUALITY.presets[QUALITY.key];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.ratio) * QUALITY.dyn);
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.far = q.far; camera.updateProjectionMatrix();
  if (SKY.sun) {
    const sh = SKY.sun.shadow;
    if (sh.mapSize.x !== q.shadow) { sh.mapSize.set(q.shadow, q.shadow); if (sh.map) { sh.map.dispose(); sh.map = null; } }
    const c = sh.camera; c.left = c.bottom = -q.shadowRange; c.right = c.top = q.shadowRange; c.updateProjectionMatrix();
    SKY.shadowRange = q.shadowRange;
  }
  LOD.t = 0;
  updateQualityUI();
  saveQualitySettings();
}
function cycleQuality(renderer, camera) {
  const i = QUALITY.order.indexOf(QUALITY.key);
  QUALITY.key = QUALITY.order[(i + 1) % QUALITY.order.length];
  QUALITY.dyn = 1;
  applyQuality(renderer, camera);
}
function updateQualityUI() {
  document.querySelectorAll('.qbtn').forEach(b => b.classList.toggle('on', b.dataset.q === QUALITY.key));
  const a = document.getElementById('qAuto'); if (a) a.checked = QUALITY.auto;
  const st = document.getElementById('stats'); if (st) st.classList.toggle('hidden', !QUALITY.showStats);
}

/* Messen und bei Bedarf die Auflösung anpassen */
function qualityFrame(dt, renderer, camera) {
  QUALITY.frames++; QUALITY.acc += dt;
  if (QUALITY.acc < 1) return;
  QUALITY.fps = QUALITY.frames / QUALITY.acc; QUALITY.ms = QUALITY.acc / QUALITY.frames * 1000;
  QUALITY.frames = 0; QUALITY.acc = 0;
  if (QUALITY.auto && GAME.started && !document.hidden) {
    const q = QUALITY.cur;
    let nd = QUALITY.dyn;
    if (QUALITY.fps < 42) nd = Math.max(0.55, QUALITY.dyn - 0.1);
    else if (QUALITY.fps > 57 && QUALITY.dyn < 1) nd = Math.min(1, QUALITY.dyn + 0.05);
    if (Math.abs(nd - QUALITY.dyn) > 0.001) {
      QUALITY.dyn = nd;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.ratio) * QUALITY.dyn);
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }
  if (QUALITY.showStats) {
    const i = renderer.info.render;
    const el = document.getElementById('stats');
    if (el) el.textContent = Math.round(QUALITY.fps) + ' FPS · ' + QUALITY.ms.toFixed(1) + ' ms · ' + QUALITY.lastCalls + ' Draw-Calls · ' +
      (QUALITY.lastTris / 1e6).toFixed(2) + ' Mio. Dreiecke · Auflösung ' + Math.round(renderer.getPixelRatio() * 100) + ' % · ' + QUALITY.cur.label +
      (QUALITY.auto ? ' (auto)' : '');
  }
}

/* ---------- Detailstufen ---------- */
const LOD = { bld: [], trees: [], t: 0 };
function updateLOD(camPos, dt) {
  LOD.t -= dt; if (LOD.t > 0) return; LOD.t = 0.25;
  const q = QUALITY.cur;
  for (const c of LOD.bld) {
    const d = Math.max(0, Math.hypot(camPos.x - c.x, camPos.z - c.z) - c.r);
    const near = d < q.bldLod;
    if (c.near) c.near.visible = near;
    if (c.far) c.far.visible = !near;
  }
  for (const c of LOD.trees) {
    const d = Math.max(0, Math.hypot(camPos.x - c.x, camPos.z - c.z) - c.r);
    const near = d < q.treeLod;
    for (const m of c.full) m.visible = near;
    if (c.imp) c.imp.visible = !near;
  }
}
