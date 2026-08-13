(function () {
  if (!window.THREE) {
    document.getElementById('loaderr').classList.remove('hidden');
    return;
  }

  const STORAGE_KEY = 'stellwerksim.save.v1';
  const LANE_Z = [-15, 0, 15];
  const LANE_COLORS = [0x62c4ff, 0xf0b747, 0x7ee084];
  const MAX_MISTAKES = 3;

  let scene, camera, renderer, clock;
  let routePreview, groundPulse;
  let trainSeq = 1;
  const trains = [];
  const signalLights = {};
  const switchNeedles = {};

  const ui = {};
  const state = {
    running: false,
    paused: false,
    score: 0,
    best: 0,
    handled: 0,
    mistakes: 0,
    streak: 0,
    westRoute: 1,
    eastRoute: 1,
    westSignal: true,
    eastSignal: true,
    speed: 1,
    spawnTimer: 1.2,
    messageTimer: 0
  };

  function loadProgress() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { best: Math.max(0, Math.floor(data.best) || 0) };
    } catch (e) {
      return { best: 0 };
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ best: state.best }));
    } catch (e) {}
  }

  function init() {
    Object.assign(ui, {
      menu: document.getElementById('menu'),
      gameover: document.getElementById('gameover'),
      hud: document.getElementById('hud'),
      menuBest: document.getElementById('menuBest'),
      finalText: document.getElementById('finalText'),
      score: document.getElementById('scoreVal'),
      handled: document.getElementById('handledVal'),
      mistakes: document.getElementById('mistakeVal'),
      streak: document.getElementById('streakVal'),
      message: document.getElementById('message'),
      trainList: document.getElementById('trainList'),
      signalWest: document.getElementById('signalWest'),
      signalEast: document.getElementById('signalEast'),
      speedVal: document.getElementById('speedVal'),
      pauseBtn: document.getElementById('pauseBtn')
    });

    state.best = loadProgress().best;
    ui.menuBest.textContent = state.best;

    setupScene();
    createWorld();
    bindControls();
    refreshRoutePreview();
    updateSignals();
    updateUi();

    clock = new THREE.Clock();
    animate();
  }

  function setupScene() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('canvas-wrap').appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x15181b);
    scene.fog = new THREE.Fog(0x15181b, 58, 145);

    camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 300);
    positionCamera();

    scene.add(new THREE.HemisphereLight(0xdceff5, 0x242019, 0.95));
    const sun = new THREE.DirectionalLight(0xffffff, 1.25);
    sun.position.set(-24, 44, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    scene.add(sun);

    window.addEventListener('resize', onResize);
  }

  function positionCamera() {
    const narrow = window.innerWidth < 720;
    camera.position.set(0, narrow ? 70 : 56, narrow ? 72 : 62);
    camera.lookAt(0, 0, 0);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    positionCamera();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function createWorld() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(190, 120),
      new THREE.MeshStandardMaterial({ color: 0x20262a, roughness: 0.94, metalness: 0.02 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    groundPulse = ground;

    addYardLines();
    addTracks();
    addPlatforms();
    addSignals();
    addSwitchNeedles();
    addYardDetails();
  }

  function addYardLines() {
    const mat = new THREE.LineBasicMaterial({ color: 0x303940, transparent: true, opacity: 0.55 });
    for (let z = -45; z <= 45; z += 15) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-90, 0.025, z),
        new THREE.Vector3(90, 0.025, z)
      ]);
      scene.add(new THREE.Line(geo, mat));
    }
    for (let x = -75; x <= 75; x += 15) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, 0.026, -52),
        new THREE.Vector3(x, 0.026, 52)
      ]);
      scene.add(new THREE.Line(geo, mat));
    }
  }

  function addTracks() {
    const railMat = new THREE.MeshStandardMaterial({ color: 0xb7c0c4, roughness: 0.34, metalness: 0.68 });
    const darkRailMat = new THREE.MeshStandardMaterial({ color: 0x6f787c, roughness: 0.45, metalness: 0.55 });

    addSleeperRun(-78, -36, 0);
    addSleeperRun(36, 78, 0);
    addStraightRail(-78, -36, 0, railMat);
    addStraightRail(36, 78, 0, railMat);

    for (let i = 0; i < LANE_Z.length; i++) {
      addSleeperRun(-20, 20, LANE_Z[i]);
      addStraightRail(-20, 20, LANE_Z[i], railMat);
      addBranch(-38, 0, -20, LANE_Z[i], i === 1 ? railMat : darkRailMat);
      addBranch(38, 0, 20, LANE_Z[i], i === 1 ? railMat : darkRailMat);
    }
  }

  function addStraightRail(x1, x2, z, mat) {
    const len = Math.abs(x2 - x1);
    for (const offset of [-0.68, 0.68]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 0.18), mat);
      rail.position.set((x1 + x2) / 2, 0.23, z + offset);
      rail.castShadow = true;
      rail.receiveShadow = true;
      scene.add(rail);
    }
  }

  function addSleeperRun(x1, x2, z) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a3423, roughness: 0.86 });
    const start = Math.min(x1, x2);
    const end = Math.max(x1, x2);
    for (let x = start; x <= end; x += 4) {
      const sleeper = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 3.2), mat);
      sleeper.position.set(x, 0.1, z);
      sleeper.receiveShadow = true;
      scene.add(sleeper);
    }
  }

  function addBranch(x1, z1, x2, z2, mat) {
    for (const offset of [-0.62, 0.62]) {
      const points = [
        new THREE.Vector3(x1, 0.22, z1 + offset),
        new THREE.Vector3((x1 + x2) / 2, 0.22, (z1 + z2) / 2 + offset),
        new THREE.Vector3(x2, 0.22, z2 + offset)
      ];
      const curve = new THREE.CatmullRomCurve3(points);
      const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.08, 8, false), mat);
      rail.castShadow = true;
      scene.add(rail);
    }
  }

  function addPlatforms() {
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x596066, roughness: 0.82 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xf0b747, roughness: 0.6 });
    for (let i = 0; i < LANE_Z.length; i++) {
      const side = i === 2 ? 1 : -1;
      const platform = new THREE.Mesh(new THREE.BoxGeometry(30, 0.42, 2.6), platformMat);
      platform.position.set(0, 0.34, LANE_Z[i] + side * 3.3);
      platform.receiveShadow = true;
      platform.castShadow = true;
      scene.add(platform);

      const edge = new THREE.Mesh(new THREE.BoxGeometry(30, 0.06, 0.14), edgeMat);
      edge.position.set(0, 0.6, LANE_Z[i] + side * 1.92);
      scene.add(edge);

      const label = makeLabel('Gleis ' + (i + 1), 160, 54, '#111820', '#edf3f6');
      label.position.set(-10, 2.2, LANE_Z[i] + side * 3.4);
      label.scale.set(5.6, 1.9, 1);
      scene.add(label);
    }
  }

  function addSignals() {
    signalLights.west = createSignal(-43, -4.5, 'W');
    signalLights.east = createSignal(43, 4.5, 'O');
  }

  function createSignal(x, z, labelText) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const postMat = new THREE.MeshStandardMaterial({ color: 0x2e3539, roughness: 0.55, metalness: 0.45 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.1, 10), postMat);
    post.position.y = 1.55;
    post.castShadow = true;
    group.add(post);

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 1.45, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x11171b, roughness: 0.42, metalness: 0.3 })
    );
    box.position.y = 3.05;
    box.castShadow = true;
    group.add(box);

    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), new THREE.MeshStandardMaterial());
    lamp.position.set(0, 3.08, 0.28);
    group.add(lamp);

    const label = makeLabel(labelText, 96, 64, '#111820', '#f0b747');
    label.position.set(0, 4.4, 0);
    label.scale.set(2.4, 1.6, 1);
    group.add(label);

    scene.add(group);
    return { lamp };
  }

  function addSwitchNeedles() {
    switchNeedles.west = createSwitchNeedle(-30, -6.2);
    switchNeedles.east = createSwitchNeedle(30, 6.2);
  }

  function createSwitchNeedle(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0.38, z);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.75, 0.16, 20),
      new THREE.MeshStandardMaterial({ color: 0x222a2e, roughness: 0.6 })
    );
    base.castShadow = true;
    group.add(base);

    const needle = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.18, 4.8),
      new THREE.MeshStandardMaterial({ color: 0xf0b747, emissive: 0x5a3908, emissiveIntensity: 0.45 })
    );
    needle.position.y = 0.18;
    needle.castShadow = true;
    group.add(needle);

    scene.add(group);
    return group;
  }

  function addYardDetails() {
    const hutMat = new THREE.MeshStandardMaterial({ color: 0x38434a, roughness: 0.76 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b3f35, roughness: 0.68 });
    const hut = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(9, 4.2, 6), hutMat);
    body.position.y = 2.1;
    hut.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.8, 2.4, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 5.4;
    hut.add(roof);
    hut.position.set(-54, 0, -28);
    hut.traverse(obj => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    scene.add(hut);

    const mastMat = new THREE.MeshStandardMaterial({ color: 0x56636b, roughness: 0.5, metalness: 0.35 });
    for (const x of [-62, -22, 22, 62]) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.5, 8), mastMat);
      mast.position.set(x, 3.75, -24);
      mast.castShadow = true;
      scene.add(mast);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(7, 0.12, 0.12), mastMat);
      arm.position.set(x, 7.2, -24);
      arm.castShadow = true;
      scene.add(arm);
    }
  }

  function makeLabel(text, w, h, bg, fg) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = fg;
    ctx.font = '700 26px Segoe UI, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 1);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    return sprite;
  }

  function bindControls() {
    document.getElementById('btnStart').addEventListener('click', startGame);
    document.getElementById('btnRestart').addEventListener('click', startGame);

    document.querySelectorAll('[data-west-route]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.westRoute = Number(btn.dataset.westRoute);
        refreshRoutePreview();
        setMessage('Westliche Einfahrt auf Gleis ' + (state.westRoute + 1) + '.', 'good');
        updateUi();
      });
    });

    document.querySelectorAll('[data-east-route]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.eastRoute = Number(btn.dataset.eastRoute);
        refreshRoutePreview();
        setMessage('Oestliche Einfahrt auf Gleis ' + (state.eastRoute + 1) + '.', 'good');
        updateUi();
      });
    });

    ui.signalWest.addEventListener('click', () => {
      state.westSignal = !state.westSignal;
      updateSignals();
      updateUi();
    });

    ui.signalEast.addEventListener('click', () => {
      state.eastSignal = !state.eastSignal;
      updateSignals();
      updateUi();
    });

    document.getElementById('speedDown').addEventListener('click', () => {
      state.speed = Math.max(0.75, state.speed - 0.25);
      updateUi();
    });

    document.getElementById('speedUp').addEventListener('click', () => {
      state.speed = Math.min(2, state.speed + 0.25);
      updateUi();
    });

    ui.pauseBtn.addEventListener('click', () => {
      if (!state.running) return;
      state.paused = !state.paused;
      setMessage(state.paused ? 'Schicht angehalten.' : 'Schicht laeuft weiter.', 'warn');
      updateUi();
    });

    window.addEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) {
    if (e.target && e.target.tagName === 'BUTTON') return;
    if (e.code === 'Digit1') { state.westRoute = 0; refreshRoutePreview(); updateUi(); }
    if (e.code === 'Digit2') { state.westRoute = 1; refreshRoutePreview(); updateUi(); }
    if (e.code === 'Digit3') { state.westRoute = 2; refreshRoutePreview(); updateUi(); }
    if (e.code === 'KeyQ') { state.eastRoute = 0; refreshRoutePreview(); updateUi(); }
    if (e.code === 'KeyW') { state.eastRoute = 1; refreshRoutePreview(); updateUi(); }
    if (e.code === 'KeyE') { state.eastRoute = 2; refreshRoutePreview(); updateUi(); }
    if (e.code === 'KeyA') { state.westSignal = !state.westSignal; updateSignals(); updateUi(); }
    if (e.code === 'KeyD') { state.eastSignal = !state.eastSignal; updateSignals(); updateUi(); }
    if (e.code === 'Space') {
      if (state.running) {
        e.preventDefault();
        state.paused = !state.paused;
        updateUi();
      }
    }
  }

  function startGame() {
    clearTrains();
    trainSeq = 1;
    state.running = true;
    state.paused = false;
    state.score = 0;
    state.handled = 0;
    state.mistakes = 0;
    state.streak = 0;
    state.westRoute = 1;
    state.eastRoute = 1;
    state.westSignal = true;
    state.eastSignal = true;
    state.speed = 1;
    state.spawnTimer = 0.8;
    state.messageTimer = 0;

    ui.menu.classList.add('hidden');
    ui.gameover.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    setMessage('Erster Zug ist angemeldet.', 'good');
    refreshRoutePreview();
    updateSignals();
    updateUi();
  }

  function clearTrains() {
    while (trains.length) {
      const train = trains.pop();
      scene.remove(train.mesh);
    }
  }

  function updateGame(dt) {
    if (!state.running || state.paused) return;

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      if (trains.length < 6) spawnTrain();
      const pressure = Math.min(4.5, state.handled * 0.12);
      state.spawnTimer = 8.2 - pressure + Math.random() * 2.8;
    }

    for (const train of trains.slice()) updateTrain(train, dt);
    checkCollisions();
  }

  function spawnTrain() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const target = Math.floor(Math.random() * 3);
    const id = 'Z' + String(trainSeq++).padStart(2, '0');
    const train = {
      id,
      dir,
      target,
      route: null,
      checked: false,
      dwell: 0,
      waiting: false,
      x: dir === 1 ? -78 : 78,
      z: 0,
      speed: 6.8 + Math.random() * 1.2 + Math.min(2.8, state.handled * 0.08),
      mesh: createTrainMesh(id, target, dir)
    };
    trains.push(train);
    scene.add(train.mesh);
    setMessage(id + ' von ' + (dir === 1 ? 'West' : 'Ost') + ' nach Gleis ' + (target + 1) + '.', 'warn');
    updateUi();
  }

  function createTrainMesh(id, target, dir) {
    const group = new THREE.Group();
    const color = LANE_COLORS[target];
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.38,
      metalness: 0.18,
      emissive: color,
      emissiveIntensity: 0.08
    });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x15191d, roughness: 0.5, metalness: 0.3 });
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff1aa, emissive: 0xffcf55, emissiveIntensity: 0.95 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.65, 2.45), bodyMat);
    body.position.y = 1.1;
    body.castShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.52, 2.0), trimMat);
    roof.position.set(-dir * 0.45, 2.2, 0);
    roof.castShadow = true;
    group.add(roof);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.75, 1.25), lightMat);
    nose.position.set(dir * 3.55, 1.2, 0);
    group.add(nose);

    const label = makeLabel(id + ' G' + (target + 1), 160, 64, '#111820', '#ffffff');
    label.position.set(0, 4.0, 0);
    label.scale.set(5.2, 2.05, 1);
    group.add(label);

    group.userData.bodyMat = bodyMat;
    return group;
  }

  function updateTrain(train, dt) {
    if (train.dwell > 0) {
      train.dwell -= dt;
      syncTrainMesh(train);
      return;
    }

    const prevX = train.x;
    const nextX = train.x + train.dir * train.speed * dt;
    if (!canPassSignal(train, nextX)) {
      train.waiting = true;
      syncTrainMesh(train);
      return;
    }

    train.waiting = false;
    train.x = nextX;

    if (train.route === null && hasEnteredSwitch(train)) {
      train.route = train.dir === 1 ? state.westRoute : state.eastRoute;
      setMessage(train.id + ' nimmt Gleis ' + (train.route + 1) + '.', 'good');
    }

    train.z = pathZ(train.x, train.route);

    if (!train.checked && crossedCenter(prevX, train.x)) {
      evaluateTrain(train);
    }

    if (Math.abs(train.x) > 82) {
      removeTrain(train);
      updateUi();
      return;
    }

    syncTrainMesh(train);
  }

  function canPassSignal(train, nextX) {
    if (train.route !== null) return true;
    const green = train.dir === 1 ? state.westSignal : state.eastSignal;
    const stopX = train.dir === 1 ? -43 : 43;
    if (green) return true;
    if (train.dir === 1 && nextX >= stopX) {
      train.x = stopX;
      return false;
    }
    if (train.dir === -1 && nextX <= stopX) {
      train.x = stopX;
      return false;
    }
    return true;
  }

  function hasEnteredSwitch(train) {
    return train.dir === 1 ? train.x >= -35.5 : train.x <= 35.5;
  }

  function pathZ(x, route) {
    if (route === null || route === undefined) return 0;
    const targetZ = LANE_Z[route];
    const ax = Math.abs(x);
    if (ax >= 36) return 0;
    if (ax > 18) return targetZ * ((36 - ax) / 18);
    return targetZ;
  }

  function crossedCenter(prevX, x) {
    return (prevX < 0 && x >= 0) || (prevX > 0 && x <= 0);
  }

  function evaluateTrain(train) {
    train.checked = true;
    train.dwell = 1.1;
    if (train.route === train.target) {
      state.handled++;
      state.streak++;
      state.score += 120 + state.streak * 15;
      setMessage(train.id + ' korrekt auf Gleis ' + (train.target + 1) + '.', 'good');
      flashTrain(train, 0x56d17d);
    } else {
      state.streak = 0;
      registerMistake(train.id + ' am falschen Bahnsteig.', 90);
      flashTrain(train, 0xee5b5b);
    }
    updateUi();
  }

  function flashTrain(train, color) {
    const mat = train.mesh.userData.bodyMat;
    if (!mat) return;
    mat.emissive.setHex(color);
    mat.emissiveIntensity = 0.55;
    window.setTimeout(() => {
      mat.emissive.setHex(LANE_COLORS[train.target]);
      mat.emissiveIntensity = 0.08;
    }, 450);
  }

  function checkCollisions() {
    for (let i = 0; i < trains.length; i++) {
      for (let j = i + 1; j < trains.length; j++) {
        const a = trains[i];
        const b = trains[j];
        if (Math.abs(a.x - b.x) < 5.4 && Math.abs(a.z - b.z) < 3.4) {
          registerMistake('Zusammenstoss zwischen ' + a.id + ' und ' + b.id + '.', 160);
          removeTrain(a);
          removeTrain(b);
          updateUi();
          return;
        }
      }
    }
  }

  function registerMistake(text, penalty) {
    state.mistakes++;
    state.score = Math.max(0, state.score - penalty);
    setMessage(text, 'bad');
    if (state.mistakes >= MAX_MISTAKES) endGame();
  }

  function removeTrain(train) {
    const idx = trains.indexOf(train);
    if (idx >= 0) trains.splice(idx, 1);
    scene.remove(train.mesh);
  }

  function syncTrainMesh(train) {
    train.mesh.position.set(train.x, 0, train.z);
    train.mesh.rotation.y = train.dir === 1 ? 0 : Math.PI;
    const bob = train.waiting ? 0 : Math.sin(performance.now() * 0.008 + train.x) * 0.025;
    train.mesh.position.y = bob;
  }

  function endGame() {
    state.running = false;
    state.paused = false;
    if (state.score > state.best) {
      state.best = state.score;
      saveProgress();
    }
    ui.hud.classList.add('hidden');
    ui.gameover.classList.remove('hidden');
    ui.finalText.textContent = state.score + ' Punkte, ' + state.handled + ' Zuege abgefertigt.';
    ui.menuBest.textContent = state.best;
    updateUi();
  }

  function refreshRoutePreview() {
    if (!scene) return;
    if (routePreview) scene.remove(routePreview);
    routePreview = new THREE.Group();
    addPreviewBranch('west', state.westRoute);
    addPreviewBranch('east', state.eastRoute);
    scene.add(routePreview);

    if (switchNeedles.west) switchNeedles.west.rotation.y = (state.westRoute - 1) * 0.36;
    if (switchNeedles.east) switchNeedles.east.rotation.y = -(state.eastRoute - 1) * 0.36;
  }

  function addPreviewBranch(side, route) {
    const lane = LANE_Z[route];
    const mat = new THREE.MeshStandardMaterial({
      color: LANE_COLORS[route],
      emissive: LANE_COLORS[route],
      emissiveIntensity: 0.45,
      roughness: 0.42,
      metalness: 0.2
    });
    const points = side === 'west'
      ? [
        new THREE.Vector3(-38, 0.36, 0),
        new THREE.Vector3(-28, 0.36, lane * 0.45),
        new THREE.Vector3(-18, 0.36, lane)
      ]
      : [
        new THREE.Vector3(38, 0.36, 0),
        new THREE.Vector3(28, 0.36, lane * 0.45),
        new THREE.Vector3(18, 0.36, lane)
      ];
    const curve = new THREE.CatmullRomCurve3(points);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.13, 10, false), mat);
    routePreview.add(mesh);
  }

  function updateSignals() {
    setSignalMaterial(signalLights.west, state.westSignal);
    setSignalMaterial(signalLights.east, state.eastSignal);
  }

  function setSignalMaterial(signal, green) {
    if (!signal || !signal.lamp) return;
    signal.lamp.material = new THREE.MeshStandardMaterial({
      color: green ? 0x56d17d : 0xee5b5b,
      emissive: green ? 0x1dbb54 : 0xc43131,
      emissiveIntensity: 1.2,
      roughness: 0.2
    });
  }

  function updateUi() {
    ui.score.textContent = Math.floor(state.score);
    ui.handled.textContent = state.handled;
    ui.mistakes.textContent = state.mistakes + '/' + MAX_MISTAKES;
    ui.streak.textContent = state.streak;
    ui.speedVal.textContent = state.speed.toFixed(state.speed % 1 ? 2 : 0) + 'x';
    ui.pauseBtn.textContent = state.paused ? 'Weiter' : 'Pause';

    ui.signalWest.textContent = state.westSignal ? 'W frei' : 'W halt';
    ui.signalEast.textContent = state.eastSignal ? 'O frei' : 'O halt';
    ui.signalWest.classList.toggle('green', state.westSignal);
    ui.signalWest.classList.toggle('red', !state.westSignal);
    ui.signalEast.classList.toggle('green', state.eastSignal);
    ui.signalEast.classList.toggle('red', !state.eastSignal);

    document.querySelectorAll('[data-west-route]').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.westRoute) === state.westRoute);
    });
    document.querySelectorAll('[data-east-route]').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.eastRoute) === state.eastRoute);
    });

    renderTrainList();
  }

  function renderTrainList() {
    if (trains.length === 0) {
      ui.trainList.innerHTML = '<li class="empty">Keine Zuege im Abschnitt</li>';
      return;
    }
    ui.trainList.innerHTML = trains.map(train => {
      const side = train.dir === 1 ? 'West' : 'Ost';
      const route = train.route === null ? 'offen' : 'Gleis ' + (train.route + 1);
      const status = train.waiting ? 'wartet am Signal' : train.checked ? 'am Bahnsteig' : 'Route ' + route;
      return '<li><span class="train-id">' + train.id + ' von ' + side + '</span>' +
        '<span class="train-goal">G' + (train.target + 1) + '</span>' +
        '<span class="train-state">' + status + '</span></li>';
    }).join('');
  }

  function setMessage(text, kind) {
    ui.message.textContent = text;
    ui.message.classList.remove('good', 'warn', 'bad');
    ui.message.classList.add(kind || 'good');
    state.messageTimer = 3.8;
  }

  function fadeMessage(dt) {
    if (state.messageTimer <= 0) return;
    state.messageTimer -= dt;
    if (state.messageTimer <= 0 && state.running) {
      ui.message.textContent = state.paused ? 'Schicht angehalten.' : 'Stellwerk bereit.';
      ui.message.classList.remove('good', 'warn', 'bad');
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    const rawDt = Math.min(clock.getDelta(), 0.05);
    const dt = rawDt * state.speed;

    updateGame(dt);
    fadeMessage(rawDt);
    animateScene();
    renderer.render(scene, camera);
  }

  function animateScene() {
    if (routePreview) {
      routePreview.children.forEach((mesh, i) => {
        mesh.material.emissiveIntensity = 0.35 + Math.sin(performance.now() * 0.004 + i) * 0.12;
      });
    }
    if (groundPulse && state.mistakes > 0) {
      const warn = 0.02 * state.mistakes * (0.5 + Math.sin(performance.now() * 0.005) * 0.5);
      groundPulse.material.emissive = new THREE.Color(0x3a120e);
      groundPulse.material.emissiveIntensity = warn;
    }
    for (const train of trains) syncTrainMesh(train);
  }

  init();
})();
