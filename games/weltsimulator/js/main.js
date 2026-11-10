/* ================= WELT-SIMULATOR: HAUPTPROGRAMM =================
   Einziger Ort, der beim Laden Code ausführt: Renderer, Materialien, Welterzeugung in Schritten
   (mit Ladebalken), Eingabe, Kamera und Spielschleife. */

const WORLD = { timing: [], scene: null, renderer: null, camera: null, clock: null, t: 0, hudT: 0, avatar: null };
let MATS = {};
let SPAWN = { x: 0, z: 0 };

(function () {
  if (!window.THREE) { document.getElementById('loaderr').classList.remove('hidden'); return; }
  const STORAGE_KEY = 'weltsimulator.save.v1';

  function makeMats() {
    const rt = roadTextures();
    const S = (o) => new THREE.MeshStandardMaterial(o);
    const stoneTex = canvasTex(noiseCanvas(128, 128, 0.75, 0.3, 7, 41));
    MATS = {
      asphalt: S({ map: rt.at, normalMap: rt.an, roughness: 0.9, color: 0xd8d8d8 }),
      sidewalk: S({ map: rt.pt, normalMap: rt.pn, roughness: 0.88 }),
      marking: S({ vertexColors: true, roughness: 0.65, color: 0xf2f2f2 }),
      yellow: S({ color: 0xf2c200, roughness: 0.6 }),
      bridge: S({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide, map: stoneTex }),
      grass: S({ vertexColors: true, roughness: 0.95 }),
      metal: S({ color: 0x41464c, roughness: 0.45, metalness: 0.7 }),
      lamphead: S({ color: 0xfff6e0, emissive: 0xffd9a0, emissiveIntensity: 0.05 }),
      quay: S({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, map: stoneTex }),
      metalDark: S({ color: 0x2c3136, roughness: 0.45, metalness: 0.7 }),
      metalLight: S({ color: 0xc8ccd0, roughness: 0.3, metalness: 0.9 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0xa8c8d8, transparent: true, opacity: 0.3, roughness: 0.05, depthWrite: false }),
      groove: S({ color: 0x2b2b2b, roughness: 0.8 }),
      ballast: S({ color: 0x8a847a, roughness: 0.95, map: canvasTex(noiseCanvas(64, 64, 0.5, 0.6, 16, 5)) }),
      sleeper: S({ color: 0x5b5148, roughness: 0.9 }),
      rail: S({ color: 0xb4b6b9, metalness: 0.9, roughness: 0.28 }),
      plaza: S({ map: rt.pt, normalMap: rt.pn, roughness: 0.9, color: 0xe6dfd2 }),
      platform: S({ color: 0xbcb7ae, roughness: 0.9, map: stoneTex })
    };
  }

  function init() {
    loadQualitySettings();
    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.info.autoReset = false;
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('canvas-wrap').appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 3400);
    camera.rotation.order = 'YXZ';
    camera.position.set(0, 300, 600); camera.lookAt(0, 0, 0);
    WORLD.scene = scene; WORLD.renderer = renderer; WORLD.camera = camera; WORLD.clock = new THREE.Clock();
    window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
    initSky(scene, renderer);
    initPost(renderer);
    applyQuality(renderer, camera);
    document.querySelectorAll('.qbtn').forEach(b => { b.onclick = () => { QUALITY.key = b.dataset.q; QUALITY.dyn = 1; applyQuality(renderer, camera); }; });
    document.getElementById('qAuto').onchange = (e) => { QUALITY.auto = e.target.checked; if (!QUALITY.auto) { QUALITY.dyn = 1; applyQuality(renderer, camera); } saveQualitySettings(); };
    initHUD();
    renderer.render(scene, camera);
    generate().catch(err => { console.error(err); document.getElementById('loadtxt').textContent = 'Fehler bei der Erzeugung: ' + err.message; });
  }

  const frame = () => new Promise(r => setTimeout(r, 0));
  async function generate() {
    const bar = document.getElementById('loadbar'), txt = document.getElementById('loadtxt');
    const scene = WORLD.scene;
    const surf = new THREE.Group(); surf.name = 'surface'; scene.add(surf); WORLD.surface = surf;
    const steps = [
      ['Landschaft und Gewässer', () => { seedRng(WS.SEED); initWater(); buildHeightGrid(); initReserves(); initBuildings(); initNature(); makeMats(); }],
      ['Strassennetz', () => genRoads(planMetroStations)],
      ['Buslinien, Tram und U-Bahn planen', () => { planBusLines(); planTram(); planMetroLines(); }],
      ['Strassen, Brücken und Laternen', () => { buildRoadMeshes(surf, MATS); buildQuays(surf, MATS); MATS.pools = buildLightPools(surf); }],
      ['ETH-Hügel, Hotels und Klein-Venedig', () => { genHill(); genHotels(); genVenice(scene); }],
      ['Stadthäuser', () => genCityBuildings()],
      ['Fassaden', () => buildBuildingMeshes(surf)],
      ['Parks, Bäume und Strand', () => { genTrees(); buildParksAndProps(surf); buildTreeMeshes(surf); buildBoats(surf); }],
      ['Tramgleise', () => { buildTramTracks(surf); }],
      ['Gelände', () => { buildWaterMask(); buildTerrain(surf); buildWater(surf); }],
      ['Karte', () => { buildMapImage(); placeSpawn(); }],
      ['Shader vorbereiten', () => precompile()]
    ];
    // Erst nach dem Start-Knopf, im Hintergrund (nicht nötig für das erste Bild)
    const later = [
      ['U-Bahn-Stationen', () => buildMetro(scene, surf, MATS)],
      ['Busse, Trams und U-Bahnen', () => spawnTransitVehicles(surf)],
      ['Autos und Fussgänger', () => spawnTraffic(surf)],
      ['Leben in der Stadt', () => initLife(surf, scene)],
      ['Shader der Fahrzeuge', () => precompile()]
    ];
    for (let i = 0; i < steps.length; i++) {
      txt.textContent = steps[i][0] + ' …';
      bar.style.width = Math.round(i / steps.length * 100) + '%';
      await frame();
      const t0 = performance.now();
      steps[i][1]();
      WORLD.timing.push([steps[i][0], Math.round(performance.now() - t0)]);
    }
    bar.style.width = '100%';
    WORLD.chars = { human: buildHumanModel(), dragon: buildDragonModel() };
    for (const k in WORLD.chars) { scene.add(WORLD.chars[k]); WORLD.chars[k].visible = false; }
    updateCharUI();
    const btn = document.getElementById('btnStart');
    btn.disabled = false; btn.textContent = 'Welt betreten';
    btn.onclick = start;
    GAME.ready = true;
    WORLD.readyMs = Math.round(performance.now());
    requestAnimationFrame(loop);
    for (const [label, fn] of later) {
      txt.textContent = 'Spielbereit · im Hintergrund: ' + label + ' …';
      await new Promise(r => setTimeout(r, 30));
      const t0 = performance.now(); fn(); WORLD.timing.push(['(später) ' + label, Math.round(performance.now() - t0)]);
    }
    for (const v of VEH.list) v.onDoorsClose = (veh) => { const p = veh.cars[0].g.position; if (Math.hypot(p.x - P.x, p.z - P.z) < 35 && GAME.mode === 'world') sfxChime(); };
    occRegisterChunkMeshes(WORLD.surface);
    WORLD.released = releaseStaticGeometry(WORLD.scene);
    await new Promise(r => setTimeout(r, 30));
    { const t0 = performance.now(); uploadAllGeometry(WORLD.renderer, WORLD.scene, WORLD.camera); WORLD.timing.push(['(später) Grafikdaten hochladen', Math.round(performance.now() - t0)]); }
    WORLD.allMs = Math.round(performance.now());
    txt.textContent = 'Fertig: ' + BLD.list.length + ' Gebäude, ' + TRANSIT.busLines.length + ' Buslinien, ' + TRANSIT.metro.length + ' U-Bahn-Linien, 1 Tramlinie.';
  }

  /* Alle Shader schon beim Laden übersetzen (sonst ruckelt das erste Hinschauen) */
  function precompile() {
    const r = WORLD.renderer;
    const oldTM = r.toneMapping;
    if (QUALITY.cur.post && POST.ok) r.toneMapping = THREE.NoToneMapping;
    const hidden = [];
    WORLD.scene.traverse(o => { if (o.visible === false) { hidden.push(o); o.visible = true; } });
    r.compile(WORLD.scene, WORLD.camera);
    for (const o of hidden) o.visible = false;
    r.toneMapping = oldTM;
  }

  function placeSpawn() {
    const pz = ROADS.plazas.find(p => p.kind === 'center');
    let x = WS.CENTER.x, z = WS.CENTER.z;
    if (pz) { x = pz.cell.cx + 20; z = pz.cell.cz + 4; }
    SPAWN = { x, z };
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { saved = null; }
    P.x = x; P.z = z; P.y = groundAt(x, z, 50); P.yaw = Math.PI / 2;
    if (saved && typeof saved.hour === 'number') GAME.hour = saved.hour;
    if (saved && saved.char === 'dragon') { P.char = 'dragon'; P.third = true; }
  }

  /* Spielfigur wechseln (Taste C oder Startmenü) */
  function setCharacter(c, fromKey) {
    if (c === P.char) return;
    P.char = c; P.popT = 0;
    if (c === 'dragon') P.third = true;
    if (fromKey) sfxMorph();
    updateCharUI(); saveNow();
  }
  function updateCharUI() { document.querySelectorAll('.cbtn').forEach(b => b.classList.toggle('on', b.dataset.c === P.char)); }
  function saveNow() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ hour: GAME.hour, char: P.char })); } catch (e) { } }
  document.querySelectorAll('.cbtn').forEach(b => { b.onclick = () => setCharacter(b.dataset.c, false); });

  function start() {
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    GAME.paused = false; GAME.started = true;
    audioCtx();
    WORLD.renderer.domElement.requestPointerLock && WORLD.renderer.domElement.requestPointerLock();
  }

  /* ---------- Eingabe ---------- */
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!GAME.started) return;
    if (!HUD.el.liftMenu.classList.contains('hidden')) { liftMenuKey(e.code); return; }
    if (e.code === 'Escape' && HUD.mapOpen) { toggleMap(false); return; }
    if (e.repeat) { KEYS[e.code] = true; return; }
    KEYS[e.code] = true;
    if (e.code === 'KeyE') actionE();
    if (e.code === 'KeyL') actionL();
    if (e.code === 'KeyM') toggleMap();
    if (e.code === 'KeyV') P.third = !P.third;
    if (e.code === 'KeyC' && ELEV.state === 'none') setCharacter(P.char === 'dragon' ? 'human' : 'dragon', true);
    if (e.code === 'KeyT') GAME.timeScale = GAME.timeScale > 1 ? 1 : 40;
    if (e.code === 'KeyF') { QUALITY.showStats = !QUALITY.showStats; updateQualityUI(); saveQualitySettings(); }
    if (e.code === 'KeyQ') cycleQuality(WORLD.renderer, WORLD.camera);
    if (e.code === 'KeyO') { OCC.enabled = !OCC.enabled; OCC.t = 0; }
    if (e.code === 'KeyG') ambToggle();
  });
  window.addEventListener('keyup', (e) => { KEYS[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== WORLD.renderer.domElement) return;
    if (ELEV.state !== 'none' && ELEV.state !== 'arrived') { P.pitch = clamp(P.pitch - e.movementY * 0.0022, -1.45, 1.45); return; }
    const dy = -e.movementX * 0.0022;
    if (P.ride) P.ride.lyaw += dy; else P.yaw += dy;
    P.pitch = clamp(P.pitch - e.movementY * 0.0022, -1.45, 1.45);
  });
  document.addEventListener('click', (e) => {
    if (!GAME.started || HUD.mapOpen || !HUD.el.liftMenu.classList.contains('hidden')) return;
    if (e.target === WORLD.renderer.domElement && document.pointerLockElement !== WORLD.renderer.domElement) WORLD.renderer.domElement.requestPointerLock();
  });
  document.getElementById('mapClose').onclick = () => toggleMap(false);
  document.getElementById('liftCancel').onclick = () => cancelLift();

  /* ---------- Kamera ---------- */
  const focus = new THREE.Vector3();
  function updateCamera(dt) {
    const cam = WORLD.camera;
    if (!GAME.started) {
      WORLD.t += dt;
      const a = WORLD.t * 0.05;
      cam.position.set(WS.CENTER.x + Math.cos(a) * 900, 260, WS.CENTER.z + Math.sin(a) * 900);
      cam.lookAt(WS.CENTER.x, 30, WS.CENTER.z);
      return;
    }
    const ch = WORLD.chars ? WORLD.chars[P.char] : null, other = WORLD.chars ? WORLD.chars[P.char === 'dragon' ? 'human' : 'dragon'] : null;
    const eye = ch ? ch.userData.eye : EYE;
    if (P.moving && P.onGround && ELEV.state === 'none') P.bob += dt * (KEYS.ShiftLeft || KEYS.ShiftRight ? 13 : 9); else P.bob *= 0.9;
    const bob = P.third ? 0 : Math.sin(P.bob) * 0.035;
    const eyeY = P.y + eye + bob + (P.camShake || 0);
    cam.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
    if (other) other.visible = false;
    if (P.third && GAME.mode === 'world' && ch) {
      const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
      const dist = ch.userData.camDist + (P.flying ? 2.5 : 0);
      cam.position.set(P.x - fx * dist, eyeY + 0.6 + (P.flying ? 1.2 : 0), P.z - fz * dist);
      cam.lookAt(P.x + fx * 2, eyeY - 0.3 + P.pitch * 3, P.z + fz * 2);
      ch.visible = true;
      ch.position.set(P.x, P.y, P.z); ch.rotation.y = P.yaw;
      // kurzer „Plopp“ beim Verwandeln
      P.popT = Math.min(1, (P.popT === undefined ? 1 : P.popT) + dt / 0.35);
      const s = P.popT < 1 ? 0.3 + 0.7 * (1 - Math.pow(1 - P.popT, 3)) + Math.sin(P.popT * Math.PI) * 0.12 : 1;
      ch.scale.setScalar(s);
      animateCharacter(ch, dt, { moving: P.moving, run: !!(KEYS.ShiftLeft || KEYS.ShiftRight), flying: !!P.flying, flapping: !!P.flapping });
    } else {
      cam.position.set(P.x, eyeY, P.z);
      if (ch) ch.visible = false;
    }
  }

  /* ---------- Spielschleife ---------- */
  let saveT = 0;
  function loop() {
    requestAnimationFrame(loop);
    const rawDt = WORLD.clock.getDelta();
    const dt = Math.min(0.05, rawDt);
    const scene = WORLD.scene, renderer = WORLD.renderer, cam = WORLD.camera;
    renderer.info.reset();
    const Q = QUALITY.cur, usePost = Q.post && POST.ok;
    if (!GAME.paused) {
      WORLD.t += dt;
      GAME.hour = (GAME.hour + dt * 24 / (WS.DAY_MINUTES * 60) * GAME.timeScale) % 24;
      const playerObs = GAME.mode === 'world' && !P.ride && !P.underground;
      rebuildObstacles(trafficObstacles(P.x, P.z, playerObs));
      updateTransit(dt, cam.position, !!(P.underground || (P.ride && P.ride.veh.underground)));
      updateTraffic(dt, cam.position);
      if (GAME.mode === 'world') updatePlayerWorld(dt); else updatePlayerInterior(dt);
      updateElevator(dt);
      updateNature(WORLD.t, dt);
      updateAmbientLife(WORLD.t, dt);
      updateAmbience(dt);
      updateRoofCab();
      updateNearVis(P.x, P.z, dt);
      saveT += dt;
      if (saveT > 10) { saveT = 0; saveNow(); }
    } else if (GAME.ready) {
      updateTransit(dt, cam.position, false);
      updateTraffic(dt, cam.position);
      updateNature(WORLD.t, dt);
      updateAmbientLife(WORLD.t, dt);
      updateNearVis(cam.position.x, cam.position.z, dt);
    }
    AMB_T.value = WORLD.t;
    updateCamera(dt);
    if (GAME.mode === 'world') {
      focus.set(GAME.started ? P.x : WS.CENTER.x, GAME.started ? P.y : 0, GAME.started ? P.z : WS.CENTER.z);
      const ug = !!(GAME.started && (P.underground || (P.ride && P.ride.veh.underground)));
      applyTimeOfDay(GAME.hour, scene, renderer, focus, ug, WORLD.t);
      if (TRANSIT.ugGroup) {
        let nearSt = ug;
        if (!nearSt && GAME.started) stationsNear(P.x, P.z, (st, lx, lz) => { if (Math.abs(lx) < 30 && lz > st.aBot - 10 && lz < st.aTop + 40) nearSt = true; });
        TRANSIT.ugGroup.visible = nearSt;
        // tief unten: Oberfläche nicht zeichnen
        let deep = false;
        if (ug) { deep = true; stationsNear(P.x, P.z, (st, lx, lz) => { if (Math.abs(lx) < 4 && lz > st.aTop - 22 && P.y > st.surfY - 12) deep = false; }); }
        WORLD.surface.visible = !deep; WORLD.surfaceHidden = deep;
        if (nearSt) for (const st of TRANSIT.stations) st.group.visible = Math.abs(st.x - cam.position.x) < 420 && Math.abs(st.z - cam.position.z) < 420;
      }
      SKY.mesh.position.copy(cam.position);
      updateWater(WORLD.t);
      const n = NIGHT_U.value;
      MATS.lamphead.emissiveIntensity = 0.05 + n * 2.5;
      if (MATS.pools) MATS.pools.opacity = n;
      setAssetNight(n);
      for (const m of BLD.signs) m.emissiveIntensity = 0.3 + n * 1.4;
      occUpdate(cam, dt, GAME.started && !ug && !WORLD.surfaceHidden);
      updateLOD(cam.position, dt);
      if (usePost) renderPost(renderer, scene, cam, { ao: Q.ao, bloom: Q.bloom, fxaa: Q.fxaa, exposure: renderer.toneMappingExposure, bloomStrength: ug ? 0.22 : 0.18 + n * 0.7, bloomThreshold: ug ? 1.5 : lerp(0.92, 0.45, n) });
      else renderer.render(scene, cam);
    } else {
      const day = 1 - SKY.night;
      INT.viewMat.color.setRGB(0.12 + 0.88 * day, 0.14 + 0.86 * day, 0.22 + 0.78 * day);
      renderer.toneMappingExposure = 1.0;
      updateInterior(WORLD.t);
      if (usePost) renderPost(renderer, INT.scene, cam, { ao: Q.ao, bloom: Q.bloom, fxaa: Q.fxaa, exposure: 1.0, bloomStrength: 0.18, bloomThreshold: 1.6 });
      else renderer.render(INT.scene, cam);
    }
    QUALITY.lastCalls = renderer.info.render.calls; QUALITY.lastTris = renderer.info.render.triangles;
    qualityFrame(rawDt, renderer, cam);
    if (GAME.started) {
      WORLD.hudT += dt;
      if (WORLD.hudT > 0.1) { WORLD.hudT = 0; updateHUD(); }
    }
  }

  init();
})();
