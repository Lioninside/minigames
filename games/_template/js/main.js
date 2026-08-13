/* ================= VORLAGE FÜR EIN NEUES SPIEL =================
   Lauffähiges Grundgerüst mit allem, was jedes Spiel der Sammlung braucht:
   Szene, Kamera, Licht, Render-Schleife, Fenstergrösse, Tastatureingabe und gespeicherter
   Fortschritt. Alles Weitere kommt spielspezifisch dazu.

   Zum Kopieren: diesen Ordner nach games/<name>/ duplizieren, STORAGE_KEY anpassen
   (Konvention: Ordnername als Präfix, siehe README der Sammlung) und loslegen. */

(function () {
  if (!window.THREE) {
    document.getElementById('loaderr').classList.remove('hidden');
    return;
  }

  // WICHTIG: Alle Spiele der Sammlung teilen sich auf GitHub Pages dieselbe Origin.
  // Der Schlüssel muss deshalb mit dem Ordnernamen des Spiels beginnen.
  const STORAGE_KEY = 'template.save.v1';

  let scene, camera, renderer, clock;
  let player, ring;
  let running = false;
  let score = 0;
  const keys = { left: false, right: false };

  /* ---------- Fortschritt ---------- */

  function loadProgress() {
    try {
      const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { best: Math.max(0, Math.floor(d.best) || 0) };
    } catch (e) {
      return { best: 0 };
    }
  }

  function saveProgress(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  const progress = loadProgress();

  /* ---------- Aufbau ---------- */

  function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('canvas-wrap').appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x10151c);
    scene.fog = new THREE.Fog(0x10151c, 40, 130);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(0, 12, 22);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0x9fc4de, 0x1b2129, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(8, 16, 10);
    scene.add(key);

    // Boden als Orientierungsraster
    const grid = new THREE.GridHelper(200, 40, 0x3a5568, 0x22303c);
    scene.add(grid);

    // Spielfigur
    player = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 3),
      new THREE.MeshStandardMaterial({ color: 0x6fd3ff, roughness: 0.35, metalness: 0.4 })
    );
    player.position.y = 1;
    scene.add(player);

    // Einsammelbares Objekt
    ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.28, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0xf0a43a, emissive: 0x7a4d08, emissiveIntensity: 0.7 })
    );
    ring.position.set(6, 1.6, -6);
    scene.add(ring);

    clock = new THREE.Clock();

    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.getElementById('btnStart').onclick = start;
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onKeyDown(e) {
    if (e.code === 'ArrowLeft') { keys.left = true; e.preventDefault(); }
    if (e.code === 'ArrowRight') { keys.right = true; e.preventDefault(); }
    if (e.code === 'Space' && running) { e.preventDefault(); collect(); }
  }

  function onKeyUp(e) {
    if (e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'ArrowRight') keys.right = false;
  }

  function start() {
    running = true;
    score = 0;
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    updateHud();
  }

  function collect() {
    score++;
    if (score > progress.best) {
      progress.best = score;
      saveProgress(progress);
    }
    // Ring an eine neue zufällige Stelle setzen
    ring.position.set((Math.random() - 0.5) * 30, 1.6, (Math.random() - 0.5) * 30);
    updateHud();
  }

  function updateHud() {
    document.getElementById('scoreVal').textContent = score + ' (Bestwert ' + progress.best + ')';
  }

  /* ---------- Render-Schleife ---------- */

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (running) {
      if (keys.left) player.rotation.y += dt * 2.2;
      if (keys.right) player.rotation.y -= dt * 2.2;
    }
    ring.rotation.y += dt * 1.4;
    ring.position.y = 1.6 + Math.sin(clock.elapsedTime * 2) * 0.25;

    renderer.render(scene, camera);
  }

  init();
  animate();
})();
