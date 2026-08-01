/* ================= FAHRZEUGE =================
   Alle Fahrzeugmodelle: Standard-Achterbahn, Sonder-Autos aus dem Shop und das Drachenauto.
   Ein neues Auto braucht eine build-Funktion hier und einen Eintrag in CARS (config.js). */

/* ================= DRACHENAUTO (Duell-Gegner) ================= */

/* Ein bedrohliches Drachenauto: dunkelrote Karosserie, goldene Hörner, Flügel und Glühaugen. */
function buildDragonCar() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7a0f12, metalness: 0.6, roughness: 0.35, emissive: 0x3a0608, emissiveIntensity: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 3.8), bodyMat);
  body.position.y = 0.4;
  group.add(body);
  // Drachenkopf vorn
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 6), bodyMat);
  head.rotation.x = -Math.PI / 2;
  head.position.set(0, 0.6, -2.2);
  group.add(head);
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0x7a5a10, emissiveIntensity: 0.6, metalness: 0.7, roughness: 0.3 });
  [-1, 1].forEach((s) => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 5), hornMat);
    horn.position.set(s * 0.5, 1.2, -2.1);
    horn.rotation.x = 0.5;
    group.add(horn);
    // Glühauge
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffee55, emissive: 0xffcc00, emissiveIntensity: 2 }));
    eye.position.set(s * 0.45, 0.85, -2.4);
    group.add(eye);
    // Flügel
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x4a0a14, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x220408, emissiveIntensity: 0.4 });
    const wing = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.2, 3), wingMat);
    wing.position.set(s * 2.1, 1.2, 0.4);
    wing.rotation.z = s * 1.15;
    wing.rotation.y = s * 0.5;
    wing.scale.set(0.4, 1, 1);
    group.add(wing);
  });
  // Heckflamme (wie bei den anderen Fahrzeugen)
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xff5a2e, emissive: 0xff3a00, emissiveIntensity: 2.4, transparent: true, opacity: 0.0 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.6, 12), flameMat);
  flame.rotation.x = Math.PI / 2;
  flame.position.set(0, 0.4, 2.9);
  group.add(flame);
  scene.add(group);
  return { group, flame };
}

/* Zustandsobjekt des Drachenautos (nutzt dieselbe Bewegungs-Logik wie die KI-Gegner, aber
   auf Rennrunde und mit Duell-Höchsttempo). Die rote KI-Schiene/Gondel wird mitgenutzt. */
function initDragonState() {
  const cart = buildDragonCar();
  cart.group.visible = false;
  cart.exhaust = createExhaustParticles();
  return {
    config: { offset: SIDE_OFFSET, name: 'drache' },
    gondolaInfo: null, // wird in init() auf die Gondel der roten Schiene gesetzt
    cartGroup: cart.group, cartFlame: cart.flame, cart,
    idx: { i: 0 }, distanceTraveled: 0, speedKmh: 0, throttle: false,
    targetSpeed: DUEL_DRAGON_SPEED - 150, inGondola: false, gondolaProgress: 0, nextPortal: 0, lap: 0
  };
}

/* ================= SONDER-AUTOS (aus dem Shop) ================= */

function addRearFlame(group) {
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xff9d2e, emissive: 0xff6a00, emissiveIntensity: 2.2, transparent: true, opacity: 0.0 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.4, 12), flameMat);
  flame.rotation.x = Math.PI / 2;
  flame.position.set(0, 0.35, 2.7);
  group.add(flame);
  return flame;
}

function buildF1Car() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd11a1a, metalness: 0.7, roughness: 0.25, emissive: 0x3a0606, emissiveIntensity: 0.3 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.85 });
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 4.2), bodyMat);
  chassis.position.y = 0.35;
  group.add(chassis);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 6), bodyMat);
  nose.rotation.x = -Math.PI / 2; nose.position.set(0, 0.35, -2.6);
  group.add(nose);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), whiteMat);
  cockpit.position.set(0, 0.7, 0.2);
  group.add(cockpit);
  const rearWing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.4), whiteMat);
  rearWing.position.set(0, 1.0, 2.2);
  group.add(rearWing);
  const frontWing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.15, 0.6), whiteMat);
  frontWing.position.set(0, 0.2, -2.9);
  group.add(frontWing);
  [[-1, -1.6], [1, -1.6], [-1, 1.7], [1, 1.7]].forEach(([sx, pz]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 14), tyreMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * 1.15, 0.4, pz);
    group.add(wheel);
  });
  const flame = addRearFlame(group);
  scene.add(group);
  return { group, flame };
}

function buildMonsterTruck() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2f9e34, metalness: 0.5, roughness: 0.4, emissive: 0x0c2e0e, emissiveIntensity: 0.3 });
  const cabMat = new THREE.MeshStandardMaterial({ color: 0x1d6b22, roughness: 0.5 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 3.6), bodyMat);
  body.position.y = 1.5;
  group.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.6), cabMat);
  cab.position.set(0, 2.4, -0.4);
  group.add(cab);
  [[-1, -1.1], [1, -1.1], [-1, 1.1], [1, 1.1]].forEach(([sx, pz]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.9, 16), tyreMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * 1.5, 1.0, pz);
    group.add(wheel);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.95, 10), rimMat);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(sx * 1.5, 1.0, pz);
    group.add(rim);
  });
  const flame = addRearFlame(group);
  flame.position.set(0, 1.3, 2.4);
  scene.add(group);
  return { group, flame };
}

function buildUboot() {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf2c500, metalness: 0.6, roughness: 0.35, emissive: 0x4a3a00, emissiveIntensity: 0.3 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0a3550, roughness: 0.5, metalness: 0.4 });
  const hullGeo = (typeof THREE.CapsuleGeometry === 'function')
    ? new THREE.CapsuleGeometry(1.1, 2.6, 6, 12)
    : new THREE.CylinderGeometry(1.1, 1.1, 4.6, 16);
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.rotation.x = Math.PI / 2;
  hull.position.y = 0.7;
  group.add(hull);
  // abgerundete Nase/Heck falls keine Kapsel verfügbar
  if (typeof THREE.CapsuleGeometry !== 'function') {
    [-2.3, 2.3].forEach(pz => { const cap = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), hullMat); cap.position.set(0, 0.7, pz); group.add(cap); });
  }
  const tower = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 1.4), darkMat);
  tower.position.set(0, 1.6, -0.1);
  group.add(tower);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8), darkMat);
  scope.position.set(0, 2.3, -0.1);
  group.add(scope);
  const window1 = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x2aa0c0, emissiveIntensity: 0.8, transparent: true, opacity: 0.7 }));
  window1.position.set(0, 0.9, -1.8);
  group.add(window1);
  [-1, 1].forEach((s) => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 1.0), darkMat);
    fin.position.set(s * 1.1, 0.7, 1.9);
    group.add(fin);
  });
  const prop = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 6), darkMat);
  prop.rotation.x = -Math.PI / 2;
  prop.position.set(0, 0.7, 2.4);
  group.add(prop);
  const flame = addRearFlame(group);
  flame.material.opacity = 0; flame.position.set(0, 0.7, 2.9);
  scene.add(group);
  return { group, flame };
}

/* Baut das aktuell gewählte Spieler-Auto (Standard oder gekauftes Sonder-Auto). */
function setPlayerCar(id) {
  if (cartGroup) { scene.remove(cartGroup); }
  if (playerCartBuilt && playerCartBuilt.exhaust) { scene.remove(playerCartBuilt.exhaust.points); }
  let built;
  if (id === 'formel1') built = buildF1Car();
  else if (id === 'monstertruck') built = buildMonsterTruck();
  else if (id === 'uboot') built = buildUboot();
  else built = buildCartMesh(0x141428, 0xff5566); // Standard-Auto (themenfähig)
  built.exhaust = createExhaustParticles();
  cartGroup = built.group;
  cartFlame = built.flame;
  playerCartBuilt = built;
  playerCarId = id;
}

/* ================= CART / PLAYER ================= */

function buildCartMesh(bodyColor, finColor) {
  const group = new THREE.Group();

  // ---- Skin A: das bisherige Achterbahn-Design ----
  const skinA = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.8, roughness: 0.25, emissive: bodyColor, emissiveIntensity: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 3.4), bodyMat);
  body.position.y = 0.3;
  skinA.add(body);

  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x35d7ff, transparent: true, opacity: 0.55, metalness: 0.2, roughness: 0.1, emissive: 0x0b8fb0, emissiveIntensity: 0.6 });
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), canopyMat);
  canopy.position.set(0, 0.85, -0.2);
  canopy.scale.set(1, 0.7, 1.4);
  skinA.add(canopy);

  const finMat = new THREE.MeshStandardMaterial({ color: finColor, emissive: finColor, emissiveIntensity: 0.6 });
  [-1, 1].forEach((s) => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.4, 1.6), finMat);
    fin.position.set(s * 1.2, 0.4, -1.2);
    skinA.add(fin);
  });
  group.add(skinA);

  // ---- Skin B: rundes, futuristisches Pod-Design (wird an Fahrzeug-Portalen aktiviert) ----
  const skinB = new THREE.Group();
  const podMat = new THREE.MeshStandardMaterial({ color: finColor, metalness: 0.9, roughness: 0.15, emissive: finColor, emissiveIntensity: 0.4 });
  const pod = new THREE.Mesh(new THREE.SphereGeometry(1.35, 20, 16), podMat);
  pod.position.set(0, 0.55, 0);
  pod.scale.set(1, 0.8, 1.5);
  skinB.add(pod);
  const ringMat = new THREE.MeshStandardMaterial({ color: bodyColor, emissive: bodyColor, emissiveIntensity: 1.0, metalness: 0.6, roughness: 0.3 });
  const podRing = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.14, 8, 24), ringMat);
  podRing.position.set(0, 0.35, 0);
  podRing.rotation.x = Math.PI / 2;
  skinB.add(podRing);
  skinB.visible = false;
  group.add(skinB);

  // simplified human figure (in beiden Skins sichtbar)
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffcc99, roughness: 0.8 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: 0x2255cc, roughness: 0.6 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skinMat);
  head.position.set(0, 1.15, 0.3);
  group.add(head);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.7, 10), jacketMat);
  torso.position.set(0, 0.7, 0.3);
  group.add(torso);

  // Heckdüse: Triebwerksgehäuse + Flamme, die beim Gasgeben aufleuchtet/wächst (unabhängig vom Skin)
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a33, metalness: 0.7, roughness: 0.4 });
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.6, 12), nozzleMat);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0.3, 1.85);
  group.add(nozzle);

  const flameMat = new THREE.MeshStandardMaterial({ color: 0xff9d2e, emissive: 0xff6a00, emissiveIntensity: 2.2, transparent: true, opacity: 0.0 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.4, 12), flameMat);
  flame.rotation.x = Math.PI / 2;
  flame.position.set(0, 0.3, 2.7);
  group.add(flame);

  scene.add(group);
  // mats: die themenfähigen Materialien der Karosserie (fürs Umfärben des Spieler-Autos pro Level)
  return { group, flame, skins: [skinA, skinB], skinIndex: 0, mats: { body: bodyMat, fin: finMat, pod: podMat, podRing: ringMat } };
}

function buildCart() {
  setPlayerCar(playerCarId); // Standard-Auto oder gekauftes Sonder-Auto (aus dem Fortschritt)
}
