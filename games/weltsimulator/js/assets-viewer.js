/* ================= ASSET-TESTSEITE =================
   Lädt nur die Asset-Module (ohne Stadt) und zeigt ein Asset mit wählbarer Detailstufe,
   Anzahl und Türanimation. Misst Dreiecke und Draw-Calls live. */
(function () {
  if (!window.THREE) return;
  seedRng(7);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  document.getElementById('view').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9bccb);
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
  const fitView = () => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    // Bild nach rechts schieben, damit das Bedienfeld das Asset nicht verdeckt
    if (w > 760) camera.setViewOffset(w, h, -175, 0, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix(); renderer.setSize(w, h);
  };
  window.addEventListener('resize', fitView); fitView();

  // Licht und einfache Umgebungsreflexion (Himmelsverlauf)
  scene.add(new THREE.HemisphereLight(0xdfeaf4, 0x6b6a5c, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(30, 50, 25); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
  scene.add(sun);
  { const cv = makeCanvas(128, 64), c = cv.getContext('2d'); const g = c.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#5f8fc4'); g.addColorStop(0.5, '#d9e6ef'); g.addColorStop(1, '#6d6a5e'); c.fillStyle = g; c.fillRect(0, 0, 128, 64);
    const t = new THREE.CanvasTexture(cv); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
    scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(t).texture; }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x8d8f8a, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const grid = new THREE.GridHelper(400, 200, 0x666666, 0x777777); grid.position.y = 0.01; scene.add(grid);

  initAssetMats();
  const signMat = destTex(31, 'Hegibachplatz', '#e2001a');
  const DEFS = [
    { key: 'bus', label: 'Stadtbus', build: buildBusAsset, before: 26, side: -1 },
    { key: 'tram', label: 'Zürcher Tram', build: buildTramAsset, before: 32, side: -1 },
    { key: 'tube_front', label: 'U-Bahn Führerwagen', build: () => buildTubeAsset('front'), before: 38, side: 1 },
    { key: 'tube_none', label: 'U-Bahn Mittelwagen', build: () => buildTubeAsset('none'), before: 38, side: 1 },
    { key: 'car', label: 'Auto', build: buildCarAsset, before: 5, inst: true },
    { key: 'pedestrian', label: 'Fussgänger', build: buildPedestrianAsset, before: 6, inst: true, ped: true },
    { key: 'dd1', label: 'S-Bahn 1. Gen. (Wagen)', build: () => buildDoubleDeckAsset(1, 'rear'), before: 'neu', side: 0 },
    { key: 'dd2', label: 'S-Bahn 2. Gen. (Triebwagen)', build: () => buildDoubleDeckAsset(2, 'front'), before: 'neu', side: 0 },
    { key: 're450', label: 'Lok Re 450', build: () => buildLocoAsset('re450'), before: 'neu', side: 0 },
    { key: 're460', label: 'Lok Re 460 (IR)', build: () => buildLocoAsset('re460'), before: 'neu', side: 0 },
    { key: 'irc', label: 'IR-Wagen', build: buildIRCoachAsset, before: 'neu', side: 0 },
    { key: 'forch', label: 'Forchbahn (T18)', build: buildForchbahnAsset, before: 'neu', side: -1 },
    { key: 'human', label: 'Spielfigur Mensch', char: buildHumanModel, before: 15 },
    { key: 'dragon', label: 'Spielfigur Drache', char: buildDragonModel, before: null }
  ];
  for (const d of DEFS) { if (!d.build) continue; const b = d.build; let cache = null; d.build = () => cache || (cache = b()); }
  const state = { def: DEFS[0], lod: 'auto', count: 1, doors: 'cycle', open: 0, t: 0, motion: 'walk' };
  let holder = null, items = [], instLOD = null, crowd = null;

  /* Orbit-Kamera */
  const orbit = { yaw: 0.7, pitch: 0.25, dist: 22, target: new THREE.Vector3(0, 1.6, 0) };
  let drag = null;
  renderer.domElement.addEventListener('mousedown', e => { drag = [e.clientX, e.clientY]; });
  window.addEventListener('mouseup', () => { drag = null; });
  window.addEventListener('mousemove', e => { if (!drag) return; orbit.yaw -= (e.clientX - drag[0]) * 0.006; orbit.pitch = clamp(orbit.pitch + (e.clientY - drag[1]) * 0.004, -0.2, 1.4); drag = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('wheel', e => { orbit.dist = clamp(orbit.dist * (e.deltaY > 0 ? 1.12 : 0.89), 2, 600); e.preventDefault(); }, { passive: false });

  function buildScene() {
    if (holder) scene.remove(holder);
    holder = new THREE.Group(); scene.add(holder);
    items = []; instLOD = null; crowd = null;
    const d = state.def;
    if (d.char) {
      const n = state.count, cols = Math.ceil(Math.sqrt(n));
      for (let i = 0; i < n; i++) { const m = d.char(); m.position.set((i % cols - (cols - 1) / 2) * 3, 0, (Math.floor(i / cols) - (cols - 1) / 2) * 3); holder.add(m); items.push(m); }
      orbit.target.set(0, 1.1, 0); orbit.dist = n === 1 ? 6 : 30; orbit.yaw = 2.6; orbit.pitch = 0.15;
      renderStats(); return;
    }
    const a = d.build();
    const n = state.count, cols = Math.ceil(Math.sqrt(n));
    const spacingX = d.inst ? (d.ped ? 2.5 : 4) : 6, spacingZ = d.inst ? (d.ped ? 2.5 : 7) : (a.len + 4);
    const pos = [];
    for (let i = 0; i < n; i++) pos.push([(i % cols - (cols - 1) / 2) * spacingX, (Math.floor(i / cols) - (cols - 1) / 2) * spacingZ]);
    if (!d.inst) {
      for (const [x, z] of pos) { const it = instantiateAsset(a, { signMat, front: true }); it.g.position.set(x, 0, z); holder.add(it.g); items.push(it); }
      orbit.target.set(0, 1.6, 0);
    } else if (d.ped) {
      crowd = new PedCrowd(holder, a, n); items = pos;
      orbit.target.set(0, 1.0, 0);
    } else {
      instLOD = new InstancedLOD(holder, a, n); items = pos;
      orbit.target.set(0, 0.8, 0);
    }
    if (n === 1) orbit.dist = d.inst ? (d.ped ? 5 : 9) : Math.max(16, a.len * 1.6);
    else orbit.dist = Math.max(40, cols * spacingZ * 1.3);
    renderStats();
  }

  /* Bedienelemente */
  function btns(id, list, cur, fn) {
    const el = document.getElementById(id); el.innerHTML = '';
    for (const [v, label] of list) { const b = document.createElement('button'); b.textContent = label; b.className = v === cur ? 'on' : ''; b.onclick = () => fn(v); el.appendChild(b); }
  }
  function ui() {
    btns('assetBtns', DEFS.map(d => [d.key, d.label]), state.def.key, (k) => { state.def = DEFS.find(d => d.key === k); if (state.def.inst && state.lod === 'mid') state.lod = 'auto'; buildScene(); ui(); });
    const lods = state.def.char ? [] : state.def.inst ? [['near', 'Nah'], ['far', 'Fern'], ['auto', 'Automatisch']] : [['near', 'Nah'], ['mid', 'Mittel'], ['far', 'Fern'], ['auto', 'Automatisch']];
    btns('lodBtns', lods, state.lod, (v) => { state.lod = v; ui(); renderStats(); });
    document.getElementById('lodBtns').previousElementSibling.style.display = state.def.char ? 'none' : '';
    btns('countBtns', [[1, '1 Exemplar'], [25, '25 Exemplare']], state.count, (v) => { state.count = v; buildScene(); ui(); });
    const hasDoors = !state.def.inst;
    document.getElementById('doorLbl').style.display = hasDoors ? '' : 'none';
    document.getElementById('doorBtns').style.display = hasDoors ? '' : 'none';
    if (state.def.char) {
      document.getElementById('doorLbl').textContent = 'Bewegung';
      const mv = state.def.key === 'dragon' ? [['idle', 'Stehen'], ['walk', 'Gehen'], ['flap', 'Flattern'], ['glide', 'Gleiten'], ['rocket', 'Rakete']] : [['idle', 'Stehen'], ['walk', 'Gehen']];
      btns('doorBtns', mv, state.motion, (v) => { state.motion = v; ui(); });
    } else {
      document.getElementById('doorLbl').textContent = 'Türen';
      btns('doorBtns', [['closed', 'Zu'], ['open', 'Offen'], ['cycle', 'Auf und zu']], state.doors, (v) => { state.doors = v; ui(); });
    }
  }
  function renderStats() {
    if (state.def.char) {
      const s = characterStats(items[0] || state.def.char());
      document.getElementById('statTable').innerHTML = `<tr><th>Modell</th><th>Dreiecke</th><th>Draw-Calls</th><th>Vorher</th></tr><tr class="cur"><td>${state.def.label}</td><td>${s.tris.toLocaleString('de-CH')}</td><td>${s.calls}</td><td>${state.def.before || 'neu'}</td></tr>`;
      return;
    }
    const a = state.def.build(), s = a.stats;
    const rows = state.def.inst ? ['near', 'far'] : ['near', 'mid', 'far'];
    const names = { near: 'Nah', mid: 'Mittel', far: 'Fern' };
    let h = '<tr><th>Stufe</th><th>Dreiecke</th><th>Draw-Calls</th><th>Vorher</th></tr>';
    for (const r of rows) h += `<tr class="${state.lod === r ? 'cur' : ''}"><td>${names[r]}</td><td>${s[r].tris.toLocaleString('de-CH')}</td><td>${s[r].calls}${state.def.inst ? ' (alle)' : ''}</td><td>${r === 'near' ? state.def.before + (state.def.inst ? ' (alle)' : '') : '–'}</td></tr>`;
    document.getElementById('statTable').innerHTML = h;
  }

  /* Schleife */
  const clock = new THREE.Clock();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(1, 1, 1), p3 = new THREE.Vector3();
  const white = new THREE.Color(0.8, 0.12, 0.1), shirt = lin(0x2b4c7e), pants = lin(0x1d2633), skin = lin(0xe0ac87);
  let fpsT = 0, frames = 0, fps = 0;
  function levelFor(dist) {
    if (state.lod !== 'auto') return state.lod;
    if (state.def.inst) return dist < (state.def.ped ? 80 : 110) ? 'near' : 'far';
    return vehicleLODLevel(dist, false);
  }
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    state.t += dt; frames++; fpsT += dt;
    if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
    camera.position.set(orbit.target.x + Math.cos(orbit.pitch) * Math.sin(orbit.yaw) * orbit.dist, orbit.target.y + Math.sin(orbit.pitch) * orbit.dist, orbit.target.z + Math.cos(orbit.pitch) * Math.cos(orbit.yaw) * orbit.dist);
    camera.lookAt(orbit.target);
    const open = state.doors === 'open' ? 1 : state.doors === 'closed' ? 0 : clamp(Math.sin(state.t * 0.9) * 1.5 + 0.5, 0, 1);
    const d = state.def;
    let lvShown = '';
    if (d.char) {
      const st = { moving: state.motion === 'walk' || state.motion === 'rocket', flying: state.motion === 'flap' || state.motion === 'glide' || state.motion === 'rocket', flapping: state.motion === 'flap', rocket: state.motion === 'rocket', thrust: 1 };
      for (const m of items) { animateCharacter(m, dt, st); m.position.y = st.flying ? 1.2 + Math.sin(state.t * 2) * 0.1 : 0; }
    } else if (!d.inst) {
      for (const it of items) {
        const lv = levelFor(camera.position.distanceTo(it.g.position));
        it.setLOD(lv); it.setDoors(open, d.side); lvShown = lv;
      }
    } else if (instLOD) {
      instLOD.begin();
      for (const [x, z] of items) { q.setFromAxisAngle(up, 0); m4.compose(p3.set(x, 0, z), q, sc); const lv = levelFor(camera.position.distanceTo(p3)); instLOD.add(m4, white, lv === 'near'); lvShown = lv; }
      instLOD.end();
    } else if (crowd) {
      crowd.begin();
      for (const [x, z] of items) { q.setFromAxisAngle(up, state.t * 0.2); m4.compose(p3.set(x, 0, z), q, sc); const lv = levelFor(camera.position.distanceTo(p3)); crowd.add(m4, state.t * 5, shirt, pants, skin, lv === 'near'); lvShown = lv; }
      crowd.end();
    }
    renderer.info.reset();
    renderer.render(scene, camera);
    const i = renderer.info.render;
    const names = { near: 'Nah', mid: 'Mittel', far: 'Fern' };
    document.getElementById('live').innerHTML = `Live (ganze Szene inkl. Boden, Gitter, Schatten):<br>${Math.round(fps)} FPS · ${i.calls} Draw-Calls · ${i.triangles.toLocaleString('de-CH')} Dreiecke<br>Kameraabstand ${orbit.dist.toFixed(0)} m · gezeigte Stufe: ${names[lvShown] || '–'}`;
  }
  ui(); buildScene(); loop();
})();
