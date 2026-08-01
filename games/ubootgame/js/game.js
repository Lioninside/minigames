/* ================= SPIELSTEUERUNG =================
   Zustandsautomat, Weltaufbau, Kollisionen, Eingabe und Hauptschleife.

   Bewusst ausgelagert: Kameraführung -> camera-rig.js, Anzeigen -> hud.js,
   Spawnrhythmus und Schwierigkeit -> spawner.js.

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
  const DEATH_DELAY = 2.4;

  let scene, camera, renderer, clock;
  let player, sun;
  let state = STATE.LOADING;
  let previousState = null;

  // Fahrt-Statistik
  let progress = 0;                // Meter Fortschritt der aktuellen Fahrt
  let lastCoinProgress = 0;
  let runCoins = 0;
  let deathTimer = 0;
  let deathCause = '';

  // Eingaben
  const keys = { up: false, down: false, left: false, right: false, fly: false };
  const mouseNdc = new THREE.Vector2(0, 0);
  const aimPoint = new THREE.Vector3(0, 0, -50);
  const raycaster = new THREE.Raycaster();
  const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

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
    // Overlays und Menüs; die Fahrt-Anzeigen selbst verwaltet hud.js
    ['hud', 'menu', 'controls', 'shop', 'pause', 'result', 'loading',
     'menuCoins', 'menuHighscore', 'menuVehicle', 'resDist', 'resHigh', 'resCoins',
     'resRunCoins', 'resVehicle', 'resultTitle', 'resultCause', 'volume', 'btnMute']
      .forEach(id => { ui[id] = document.getElementById(id); });
    Hud.init();
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
    runCoins = 0;
    deathTimer = 0;
    deathCause = '';

    Spawner.reset();
    Mines.reset();
    Enemies.reset();
    Weapons.reset();
    Effects.reset();
    Ocean.reset();

    player.reset(SaveSystem.selectedVehicle);
    CameraRig.reset(player.heading);
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

  /* Mausposition auf die Wasserfläche projizieren - Zielpunkt der Panzerkreuzer-Kanonen. */
  function updateAimPoint() {
    raycaster.setFromCamera(mouseNdc, camera);
    if (!raycaster.ray.intersectPlane(waterPlane, aimPoint)) {
      aimPoint.copy(player.position).addScaledVector(player.forward, 120);
    }
  }

  function updateHud(force) {
    Hud.update(player, progress, keys, state === STATE.RUNNING, force);
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

      // --- Gefahren erzeugen (Rhythmus und Schwierigkeit siehe spawner.js) ---
      const difficulty = Spawner.update(progress, player);

      Mines.update(dt, player.position);
      Enemies.update(dt, player.position, _playerVel, difficulty);

      // --- Waffen ---
      if (Weapons.usesMouseAim(player)) {
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
      CameraRig.updateDeath(camera, player, dt, deathTimer);
      Mines.update(dt, player.position);
      if (deathTimer >= DEATH_DELAY) finishRun();
    }

    if (state === STATE.RUNNING) CameraRig.update(camera, player, dt, Effects.shake);

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

    if (code === 'KeyP' && state === STATE.RUNNING) {
      CameraRig.cycleMode();
      AudioEngine.menuClick();
    }

    if (code === 'KeyK') { openShop(); AudioEngine.menuClick(); }
    if (code === 'KeyC') { closeShop(); }
    if (code === 'Escape') { togglePause(); }

    if (code === 'KeyS' && state === STATE.RUNNING) {
      Weapons.fire(player);
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
    Hud.setVehicleName(def.name);
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
      applyVehicle(Vehicles.DEFAULT_ID);
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
    get camera() { return camera; },

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
