/* ================= SPIELSTEUERUNG =================
   Zustandsautomat, Weltaufbau, Spawnlogik, Kollisionen, Kameras und HUD.

   Kurs: Der Spieler fährt grundsätzlich in Richtung -Z. Der "Fortschritt" ist der jemals
   erreichte Höchstwert in dieser Richtung - dadurch bringt Im-Kreis-Fahren keine zusätzlichen
   Münzen (siehe Kernregel: Münzen nur für echten Streckenfortschritt). */

const Game = (function () {
  const STATE = {
    LOADING: 'loading',
    MENU: 'menu',
    CONTROLS: 'controls',
    RUNNING: 'running',
    SHOP: 'shop',
    PAUSED: 'paused',
    DYING: 'dying',
    RESULT: 'result'
  };

  const COIN_PER_METERS = 10;
  const MINE_INTERVAL = 20;        // pro 20 m Fortschritt 1-3 Minen
  const SPAWN_MIN = 50;            // Gefahren erscheinen 50-100 m voraus
  const SPAWN_MAX = 100;
  const MAX_ACTIVE_MINES = 42;
  const DEATH_DELAY = 2.4;

  let scene, camera, renderer, clock;
  let player, sun;
  let state = STATE.LOADING;
  let previousState = null;

  // Fahrt-Statistik
  let progress = 0;                // Meter Fortschritt der aktuellen Fahrt
  let lastCoinProgress = 0;
  let nextMineProgress = MINE_INTERVAL;
  let nextSubProgress = 60;
  let runCoins = 0;
  let deathTimer = 0;
  let deathCause = '';

  // Eingaben
  const keys = { up: false, down: false, left: false, right: false, fly: false };
  let cameraMode = 0;              // 0 = Verfolger, 1 = Brücke, 2 = Vogelperspektive
  const mouseNdc = new THREE.Vector2(0, 0);
  const aimPoint = new THREE.Vector3(0, 0, -50);
  const raycaster = new THREE.Raycaster();
  const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const _v = new THREE.Vector3();
  const _camTarget = new THREE.Vector3();
  const _lookTarget = new THREE.Vector3();
  const _playerVel = new THREE.Vector3();

  const ui = {};

  /* ---------------- Aufbau ---------------- */

  function initRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('canvas-wrap').appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.4, 3000);
    camera.position.set(0, 20, 40);
    clock = new THREE.Clock();
  }

  function initWorld() {
    scene.add(new THREE.HemisphereLight(0xbcd8ea, 0x24404f, 0.85));
    sun = new THREE.DirectionalLight(0xfff4e0, 1.55);
    sun.position.set(120, 180, 90);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x7fb2d6, 0.45);
    fill.position.set(-120, 60, -80);
    scene.add(fill);

    buildSky(scene, 1600);
    Ocean.build(scene, sun.position.clone().normalize(), 700);
  }

  function initUi() {
    ['coinVal', 'speedVal', 'distVal', 'hsVal', 'vehicleVal', 'flightVal', 'flightPanel',
     'warnPanel', 'hud', 'menu', 'controls', 'shop', 'pause', 'result', 'loading',
     'menuCoins', 'menuHighscore', 'menuVehicle', 'resDist', 'resHigh', 'resCoins',
     'resRunCoins', 'resVehicle', 'resultTitle', 'resultCause', 'volume', 'btnMute']
      .forEach(id => { ui[id] = document.getElementById(id); });
  }

  /* ---------------- Zustandswechsel ---------------- */

  function show(el, visible) {
    if (el) el.classList.toggle('hidden', !visible);
  }

  function setState(next) {
    state = next;
    show(ui.menu, next === STATE.MENU);
    show(ui.controls, next === STATE.CONTROLS);
    show(ui.shop, next === STATE.SHOP);
    show(ui.pause, next === STATE.PAUSED);
    show(ui.result, next === STATE.RESULT);
    show(ui.hud, next === STATE.RUNNING || next === STATE.DYING || next === STATE.SHOP || next === STATE.PAUSED);

    if (next === STATE.MENU) refreshMenu();
    if (next === STATE.SHOP) Shop.render();
    if (next !== STATE.RUNNING) {
      keys.up = keys.down = keys.left = keys.right = keys.fly = false;
      if (next !== STATE.DYING) AudioEngine.silence();
    }
  }

  function refreshMenu() {
    ui.menuCoins.textContent = SaveSystem.coins;
    ui.menuHighscore.textContent = SaveSystem.highscore + ' m';
    ui.menuVehicle.textContent = Vehicles.get(SaveSystem.selectedVehicle).name;
  }

  /* ---------------- Fahrt starten / beenden ---------------- */

  function startRun() {
    progress = 0;
    lastCoinProgress = 0;
    nextMineProgress = MINE_INTERVAL;
    nextSubProgress = 60;
    runCoins = 0;
    deathTimer = 0;
    deathCause = '';
    cameraMode = 0;

    Mines.reset();
    Enemies.reset();
    Weapons.reset();
    Effects.reset();
    Ocean.reset();

    player.reset(SaveSystem.selectedVehicle);
    updateHud(true);
    setState(STATE.RUNNING);
  }

  function killPlayer(cause) {
    if (state !== STATE.RUNNING) return;
    deathCause = cause;
    deathTimer = 0;
    player.alive = false;
    // Explosionsstärke nach Fahrzeuggrösse
    const power = THREE.MathUtils.clamp(player.def.radius / 12, 0.8, 2.2);
    Effects.explosion(player.position.clone(), power);
    Effects.waterColumn(player.position.clone(), power);
    player.group.visible = false;
    AudioEngine.silence();
    setState(STATE.DYING);
  }

  function finishRun() {
    const dist = Math.floor(progress);
    const isRecord = SaveSystem.reportDistance(dist);
    ui.resultTitle.textContent = isRecord ? '🏆 Neuer Rekord!' : '💥 Gesunken!';
    ui.resultCause.textContent = deathCause;
    ui.resDist.textContent = dist + ' m';
    ui.resHigh.textContent = SaveSystem.highscore + ' m';
    ui.resRunCoins.textContent = runCoins;
    ui.resCoins.textContent = SaveSystem.coins;
    ui.resVehicle.textContent = player.def.name;
    setState(STATE.RESULT);
  }

  /* ---------------- Spawnlogik ---------------- */

  function difficultyFor(dist) {
    // 0 bis 500 m einfach, danach stufenweise anspruchsvoller, aber gedeckelt
    if (dist < 500) return 0.0;
    if (dist < 1500) return 0.3;
    if (dist < 3000) return 0.6;
    return 0.85;
  }

  /* Sucht einen Platz 50-100 m voraus, der nicht zu dicht am Spieler liegt. */
  function spawnPointAhead() {
    const ahead = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
    const lateral = (Math.random() - 0.5) * 110;
    return {
      x: player.position.x + lateral,
      z: player.position.z - ahead
    };
  }

  function spawnMines() {
    const count = 1 + Math.floor(Math.random() * 3); // 1 bis 3 Minen je Abschnitt
    for (let i = 0; i < count; i++) {
      if (Mines.activeCount >= MAX_ACTIVE_MINES) return;
      const p = spawnPointAhead();
      // Sicherheitsabstand: nie direkt vor dem Bug ohne Reaktionszeit
      if (Math.hypot(p.x - player.position.x, p.z - player.position.z) < SPAWN_MIN * 0.8) continue;
      Mines.spawn(p.x, p.z, Math.random() < 0.45);
    }
  }

  function spawnSub(difficulty) {
    const maxSubs = 2 + Math.round(difficulty * 3); // gedeckelt, damit es spielbar bleibt
    if (Enemies.activeSubs >= maxSubs) return;
    const p = spawnPointAhead();
    Enemies.spawnSub(p.x, p.z, difficulty);
  }

  /* ---------------- Kollisionen ---------------- */

  function checkCollisions() {
    const pr = player.def.radius;
    const px = player.position.x, pz = player.position.z;
    const airborne = player.altitude > 3.5; // im Flug wird nichts an der Oberfläche getroffen

    if (!airborne) {
      const mines = Mines.all;
      for (let i = 0; i < mines.length; i++) {
        const m = mines[i];
        if (!m.active) continue;
        if (Math.hypot(px - m.x, pz - m.z) < pr + m.radius) {
          Mines.detonate(m);
          killPlayer(m.underwater ? 'Kollision mit einer Unterwassermine.' : 'Kollision mit einer Oberflächenmine.');
          return;
        }
      }

      const subs = Enemies.subs;
      for (let i = 0; i < subs.length; i++) {
        const s = subs[i];
        if (!s.active) continue;
        if (Math.hypot(px - s.x, pz - s.z) < pr + s.radius) {
          Enemies.detonateSub(s);
          killPlayer('Feindliches U-Boot gerammt.');
          return;
        }
      }

      const torps = Enemies.torpedoes;
      for (let i = 0; i < torps.length; i++) {
        const t = torps[i];
        if (!t.active) continue;
        if (Math.hypot(px - t.pos.x, pz - t.pos.z) < pr + t.radius) {
          Enemies.detonateTorpedo(t);
          killPlayer('Von einem Torpedo getroffen.');
          return;
        }
      }
    }
  }

  /* ---------------- Kamera ---------------- */

  function updateCamera(dt) {
    const r = player.def.radius;
    const shake = Effects.shake;

    if (cameraMode === 1) {
      // Brücke / Cockpit
      player.getBridgeWorld(_camTarget);
      camera.position.lerp(_camTarget, Math.min(1, dt * 14));
      _lookTarget.copy(player.position)
        .addScaledVector(player.forward, 60)
        .setY(player.position.y + player.bridgeOffset.y * 0.6);
      camera.up.set(0, 1, 0);
      camera.lookAt(_lookTarget);
    } else if (cameraMode === 2) {
      // Vogelperspektive: hoch über dem Fahrzeug, Bug zeigt nach oben im Bild
      _camTarget.copy(player.position);
      _camTarget.y += 70 + r * 2.4;
      _camTarget.addScaledVector(player.forward, r * 0.6);
      camera.position.lerp(_camTarget, Math.min(1, dt * 4));
      camera.up.copy(player.forward);
      camera.lookAt(player.position);
    } else {
      // Verfolgerperspektive (Standard)
      const dist = 20 + r * 1.7;
      const height = 8 + r * 0.75;
      _camTarget.copy(player.position)
        .addScaledVector(player.forward, -dist)
        .addScaledVector(_v.set(0, 1, 0), height + player.altitude * 0.5);
      camera.position.lerp(_camTarget, 1 - Math.pow(0.0015, dt));
      _lookTarget.copy(player.position).addScaledVector(player.forward, 22).setY(player.position.y + 3);
      camera.up.set(0, 1, 0);
      camera.lookAt(_lookTarget);
    }

    if (shake > 0.01) {
      camera.position.x += (Math.random() - 0.5) * shake * 3;
      camera.position.y += (Math.random() - 0.5) * shake * 3;
      camera.position.z += (Math.random() - 0.5) * shake * 3;
    }
  }

  /* Mausposition auf die Wasserfläche projizieren - Zielpunkt der Panzerkreuzer-Kanonen. */
  function updateAimPoint() {
    raycaster.setFromCamera(mouseNdc, camera);
    if (!raycaster.ray.intersectPlane(waterPlane, aimPoint)) {
      aimPoint.copy(player.position).addScaledVector(player.forward, 120);
    }
  }

  /* ---------------- HUD ---------------- */

  function updateHud(force) {
    ui.coinVal.textContent = SaveSystem.coins;
    ui.speedVal.textContent = Math.round(Math.abs(player.speed)) + ' kn';
    ui.distVal.textContent = Math.floor(progress) + ' m';
    ui.hsVal.textContent = SaveSystem.highscore + ' m';
    if (force) ui.vehicleVal.textContent = player.def.name;

    const flying = player.def.seaplane && (player.flying || player.altitude > 0.5);
    show(ui.flightPanel, flying);
    if (flying) ui.flightVal.textContent = player.remainingFlight.toFixed(1).replace('.', ',');

    show(ui.warnPanel, Enemies.warning);
  }

  /* ---------------- Hauptschleife ---------------- */

  function step(dt) {
    // Effekte laufen auch während der Todesanimation weiter
    if (state === STATE.RUNNING || state === STATE.DYING) {
      Ocean.update(dt, player.position.x, player.position.z);
      Effects.update(dt);
    }

    if (state === STATE.RUNNING) {
      const before = player.position.clone();

      player.setFlightInput(keys.fly && player.def.seaplane);
      player.update(dt, keys);

      _playerVel.copy(player.position).sub(before).multiplyScalar(1 / Math.max(dt, 1e-4));

      // --- Fortschritt, Münzen ---
      const forwardProgress = -player.position.z;
      if (forwardProgress > progress) progress = forwardProgress;
      while (progress - lastCoinProgress >= COIN_PER_METERS) {
        lastCoinProgress += COIN_PER_METERS;
        SaveSystem.addCoins(1);
        runCoins++;
        AudioEngine.coin();
      }

      const dist = progress;
      const difficulty = difficultyFor(dist);

      // --- Gefahren erzeugen ---
      while (progress >= nextMineProgress) {
        nextMineProgress += MINE_INTERVAL;
        spawnMines();
      }
      if (progress >= nextSubProgress) {
        nextSubProgress = progress + THREE.MathUtils.lerp(90, 55, difficulty) + Math.random() * 45;
        spawnSub(difficulty);
      }

      Mines.update(dt, player.position);
      Enemies.update(dt, player.position, _playerVel, difficulty);

      // --- Waffen ---
      if (player.def.armed === 'guns') {
        updateAimPoint();
        player.aimTurrets(aimPoint, dt);
      }
      Weapons.update(dt, null);

      checkCollisions();

      Radar.update(dt, player);
      AudioEngine.update(player.speedFrac, player.flying);
      updateHud(false);

    } else if (state === STATE.DYING) {
      deathTimer += dt;
      // Kamera zieht sich vom Unglücksort zurück
      _camTarget.copy(player.position).add(_v.set(0, 26 + deathTimer * 6, 46 + deathTimer * 8));
      camera.position.lerp(_camTarget, Math.min(1, dt * 2));
      camera.up.set(0, 1, 0);
      camera.lookAt(player.position);
      Mines.update(dt, player.position);
      if (deathTimer >= DEATH_DELAY) finishRun();
    }

    if (state === STATE.RUNNING) updateCamera(dt);

    renderer.render(scene, camera);
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    step(dt);
  }

  /* ---------------- Eingaben ---------------- */

  function openShop() {
    if (state === STATE.RUNNING || state === STATE.PAUSED || state === STATE.RESULT || state === STATE.MENU) {
      previousState = (state === STATE.PAUSED) ? STATE.RUNNING : state;
      setState(STATE.SHOP);
    }
  }

  function closeShop() {
    if (state !== STATE.SHOP) return;
    setState(previousState === STATE.RESULT ? STATE.RESULT : (previousState === STATE.MENU ? STATE.MENU : STATE.RUNNING));
  }

  function togglePause() {
    if (state === STATE.RUNNING) setState(STATE.PAUSED);
    else if (state === STATE.PAUSED) setState(STATE.RUNNING);
    else if (state === STATE.SHOP) closeShop();
    else if (state === STATE.CONTROLS) setState(STATE.MENU);
  }

  function onKeyDown(e) {
    AudioEngine.init();
    const code = e.code;

    if (code === 'ArrowUp') { keys.up = true; e.preventDefault(); }
    if (code === 'ArrowDown') { keys.down = true; e.preventDefault(); }
    if (code === 'ArrowLeft') { keys.left = true; e.preventDefault(); }
    if (code === 'ArrowRight') { keys.right = true; e.preventDefault(); }

    if (code === 'KeyF') { keys.fly = true; e.preventDefault(); }

    if (code === 'KeyP' && (state === STATE.RUNNING)) {
      cameraMode = (cameraMode + 1) % 3;
      AudioEngine.menuClick();
    }

    if (code === 'KeyK') { openShop(); AudioEngine.menuClick(); }
    if (code === 'KeyC') { closeShop(); }
    if (code === 'Escape') { togglePause(); }

    if (code === 'KeyS' && state === STATE.RUNNING) {
      if (player.def.armed === 'guns') Weapons.fireGuns(player);
      else if (player.def.armed === 'bombs') Weapons.dropBomb(player);
    }

    if (code === 'Space' || code === 'Enter') {
      if (state === STATE.RESULT) { e.preventDefault(); startRun(); }
      else if (state === STATE.MENU) { e.preventDefault(); startRun(); }
    }
  }

  function onKeyUp(e) {
    if (e.code === 'ArrowUp') keys.up = false;
    if (e.code === 'ArrowDown') keys.down = false;
    if (e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'ArrowRight') keys.right = false;
    if (e.code === 'KeyF') keys.fly = false;
  }

  function onMouseMove(e) {
    mouseNdc.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseNdc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /* Fahrzeugwechsel mitten in der Fahrt: mit etwas Sicherheitsabstand, damit ein grösseres
     Schiff nicht sofort in einem Hindernis steht. */
  function applyVehicle(id) {
    const def = Vehicles.get(id);
    player.setVehicle(id);
    ui.vehicleVal.textContent = def.name;
    refreshMenu();

    // Hindernisse im neuen (grösseren) Rumpfbereich vorsichtshalber entfernen
    Mines.all.forEach(m => {
      if (m.active && Math.hypot(player.position.x - m.x, player.position.z - m.z) < def.radius + 14) {
        Mines.release(m);
      }
    });
    Enemies.subs.forEach(s => {
      if (s.active && Math.hypot(player.position.x - s.x, player.position.z - s.z) < def.radius + 18) {
        Enemies.releaseSub(s);
      }
    });
  }

  function bindUi() {
    document.getElementById('btnStart').onclick = () => { AudioEngine.init(); startRun(); };
    document.getElementById('btnSelect').onclick = () => { AudioEngine.init(); openShop(); };
    document.getElementById('btnControls').onclick = () => setState(STATE.CONTROLS);
    document.getElementById('btnControlsBack').onclick = () => setState(STATE.MENU);
    document.getElementById('btnReset').onclick = () => {
      if (!confirm('Wirklich den gesamten Fortschritt (Münzen, Schiffe, Highscore) löschen?')) return;
      SaveSystem.resetProgress();
      applyVehicle('startboat');
      refreshMenu();
      Shop.render();
    };

    document.getElementById('btnShopClose').onclick = closeShop;
    document.getElementById('btnResume').onclick = () => setState(STATE.RUNNING);
    document.getElementById('btnPauseShop').onclick = openShop;
    document.getElementById('btnPauseMenu').onclick = () => setState(STATE.MENU);

    document.getElementById('btnRetry').onclick = startRun;
    document.getElementById('btnResultShop').onclick = openShop;
    document.getElementById('btnResultMenu').onclick = () => setState(STATE.MENU);

    ui.volume.value = Math.round(SaveSystem.rawVolume * 100);
    ui.volume.oninput = () => {
      SaveSystem.setVolume(parseInt(ui.volume.value, 10) / 100);
      AudioEngine.applyMasterVolume();
    };
    ui.btnMute.textContent = SaveSystem.muted ? '🔇' : '🔊';
    ui.btnMute.onclick = () => {
      SaveSystem.setMuted(!SaveSystem.muted);
      ui.btnMute.textContent = SaveSystem.muted ? '🔇' : '🔊';
      AudioEngine.applyMasterVolume();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);
    window.addEventListener('blur', () => {
      keys.up = keys.down = keys.left = keys.right = keys.fly = false;
      if (state === STATE.RUNNING) setState(STATE.PAUSED);
    });
  }

  /* ---------------- Öffentliche Schnittstelle ---------------- */

  return {
    STATE,
    get state() { return state; },
    get scene() { return scene; },

    initRenderer, initWorld, initUi, bindUi,

    createPlayer() {
      player = new Player(scene);
      player.setVehicle(SaveSystem.selectedVehicle);
      return player;
    },
    get player() { return player; },

    applyVehicle,
    setState,
    start() {
      setState(STATE.MENU);
      animate();
    }
  };
})();
