/* ================= GAMEPLAY: KERN =================
   Schnittstelle für Spielinhalte, damit neue Features den Kern nicht anfassen müssen.
   Ein Modul meldet sich mit gpRegister({ name, init(scene, surf, saved), update(dt),
   key(code) → true wenn verbraucht, minimap(c, toMini), save() → Objekt }).
   Der Kern liefert: Inventar (GP.inv), Zähler (GP.stats), Auswahl (GP.sel), Hinweis (gpToast),
   Flächenabfrage (gpSurfaceAt), Speichern (eigener Schlüssel) und die HUD-Leiste.
   Aufrufe aus dem Spiel: gpInit (nach dem Laden), gpUpdate (pro Bild), gpKey (Tastendruck),
   gpMinimap (Minikarte). Mehr braucht main.js/hud.js nicht zu wissen. */

const GP = { mods: [], inv: {}, stats: { trees: 0, flowers: 0, packs: 0 }, sel: 'oak', ready: false, el: {}, toastT: 0, dirty: false, saveT: 0, KEY: 'weltsimulator.gameplay.v1' };
function gpRegister(m) { GP.mods.push(m); }

function gpInit(scene, surf) {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(GP.KEY) || 'null'); } catch (e) { saved = null; }
  for (const k of GP_DATA.order) GP.inv[k] = (saved && saved.inv && saved.inv[k]) | 0;
  if (saved && saved.stats) Object.assign(GP.stats, saved.stats);
  if (saved && GP_DATA.kinds[saved.sel]) GP.sel = saved.sel;
  // HUD-Leiste
  const bar = document.createElement('div'); bar.id = 'gpBar'; bar.className = 'panel';
  const toast = document.createElement('div'); toast.id = 'gpToast';
  const hud = document.getElementById('hud'); hud.appendChild(bar); hud.appendChild(toast);
  GP.el = { bar, toast };
  for (const m of GP.mods) if (m.init) m.init(scene, surf, saved && saved[m.name]);
  GP.ready = true;
  gpRefresh();
}
function gpRefresh() {
  if (!GP.el.bar) return;
  const items = GP_DATA.order.map((k, i) => { const d = GP_DATA.kinds[k]; return '<span class="gpItem' + (k === GP.sel ? ' sel' : '') + (GP.inv[k] ? '' : ' empty') + '"><b>' + (i + 1) + '</b>' + d.icon + ' ' + GP.inv[k] + '</span>'; }).join('');
  GP.el.bar.innerHTML = '<div class="gpRow">' + items + '</div><div class="gpStat">Gepflanzte Bäume: <b>' + GP.stats.trees + '</b> · Blumen: <b>' + GP.stats.flowers + '</b> · P säen</div>';
}
function gpToast(text) { if (!GP.el.toast) return; GP.el.toast.textContent = text; GP.el.toast.classList.add('on'); GP.toastT = 2.6; }
function gpChanged() { GP.dirty = true; gpRefresh(); }
function gpSave() {
  const o = { inv: GP.inv, stats: GP.stats, sel: GP.sel };
  for (const m of GP.mods) if (m.save) o[m.name] = m.save();
  try { localStorage.setItem(GP.KEY, JSON.stringify(o)); } catch (e) { }
  GP.dirty = false;
}
function gpUpdate(dt) {
  if (!GP.ready) return;
  for (const m of GP.mods) if (m.update) m.update(dt);
  if (GP.toastT > 0) { GP.toastT -= dt; if (GP.toastT <= 0) GP.el.toast.classList.remove('on'); }
  GP.saveT += dt;
  if (GP.dirty && GP.saveT > 3) { GP.saveT = 0; gpSave(); }
}
function gpKey(code) {
  if (!GP.ready) return false;
  const m = /^Digit([1-9])$/.exec(code);
  if (m && GP_DATA.order[+m[1] - 1]) { GP.sel = GP_DATA.order[+m[1] - 1]; gpChanged(); gpToast(GP_DATA.kinds[GP.sel].icon + ' ' + GP_DATA.kinds[GP.sel].label + ' gewählt'); return true; }
  for (const mod of GP.mods) if (mod.key && mod.key(code)) return true;
  return false;
}
/* Minikarte: toMini(x, z) liefert Bildpunkt oder null (ausserhalb) */
function gpMinimap(c, W, scale, px, pz) {
  if (!GP.ready) return;
  const cs = Math.cos(P.yaw), sn = Math.sin(P.yaw);
  const toMini = (x, z) => { const dx = (x - px) * scale, dz = (z - pz) * scale; const mx = dx * cs - dz * sn, mz = dx * sn + dz * cs; return (mx * mx + mz * mz < (W / 2 - 8) ** 2) ? [W / 2 + mx, W / 2 + mz] : null; };
  for (const m of GP.mods) if (m.minimap) m.minimap(c, toMini);
}

/* Welche Fläche liegt hier? 'park' | 'hill' | 'island' | 'meadow' oder null (fester Boden,
   Wasser, Strand, Strasse, Platz, Gebäude, Gleistrassee: dort wächst nichts) */
function gpSurfaceAt(x, z) {
  if (Math.abs(x) > 2480 || Math.abs(z) > 2480) return null;
  if (terrainH(x, z) < WS.WATER_Y + 0.25 || waterDist(x, z) < 1.5) return null;
  const di = Math.hypot(x - ISLAND.x, z - ISLAND.z);
  if (di < ISLAND.r + 60) return di < ISLAND.r - 16 ? 'island' : null;
  if (veniceMask(x, z) > 0.3 || coastX(z) - x < 125) return null;
  if (roadClear(x, z, 3) < 0.4 || isReserved(x, z, 0)) return null;
  if (BLD.hash.query(x - 1, z - 1, x + 1, z + 1, (b) => obbContains(b.obb, x, z, 0.3))) return null;
  for (const f of NAT.fountains) if (Math.hypot(f.x - x, f.z - z) < f.r + 0.6) return null;
  for (const pz of ROADS.plazas) { if (pz.round ? Math.hypot(pz.x - x, pz.z - z) < pz.r + 1 : (pz.poly && pointInQuad(x, z, pz.poly))) return null; }
  for (const st of TRANSIT.stations) if (st.cell && Math.abs(st.cell.cx - x) < 110 && Math.abs(st.cell.cz - z) < 110 && pointInQuad(x, z, cellPoly(st.cell, 0))) return null;
  for (const T of [TRANSIT.tram, TRANSIT.tram18]) if (T) for (const p of [T.plazaV, T.plazaE]) if (Math.hypot(p[0] - x, p[1] - z) < 50) return null;
  for (const pk of ROADS.parks) if (Math.abs(pk.cell.cx - x) < 110 && Math.abs(pk.cell.cz - z) < 110 && pointInQuad(x, z, pk.poly)) return 'park';
  if (Math.hypot(x - WS.HILL.x, z - WS.HILL.z) < 470) return 'hill';
  return 'meadow';
}
