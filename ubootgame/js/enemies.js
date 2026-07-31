/* ================= FEINDLICHE U-BOOTE UND TORPEDOS =================
   Die U-Boote fahren unter der Oberfläche; sichtbar bleibt vor allem das Periskop mit seiner
   kleinen Bugwelle. Vor jedem Angriff richtet sich das Periskop erkennbar auf den Spieler aus
   und es ertönt eine Warnung - erst danach läuft ein Torpedo. Torpedos sind langsam genug,
   dass Ausweichen durch Kurs- oder Tempowechsel immer möglich bleibt. */

const Enemies = (function () {
  const SUB_POOL = 10;
  const TORP_POOL = 16;

  const SUB_RADIUS = 8;
  const TORPEDO_RADIUS = 1.6;
  const TORPEDO_SPEED = 11;      // m/s - deutlich langsamer als ein schnelles Schiff
  const TORPEDO_LIFE = 16;       // Sekunden bis zum Selbstverlöschen
  const AIM_TIME = 1.9;          // Vorwarnzeit, bevor gefeuert wird
  const SUB_DEPTH = 5.5;

  let scene = null;
  let subs = [];
  let torpedoes = [];
  let warningTimer = 0;

  /* --------- Modelle --------- */

  function buildSubMesh() {
    const g = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x18262c, roughness: 0.8, metalness: 0.45 });

    const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 22, 14), hullMat);
    hull.rotation.x = Math.PI / 2;
    g.add(hull);
    [-11, 11].forEach(z => {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.7, 12, 9), hullMat);
      cap.position.z = z;
      cap.scale.z = z < 0 ? 1.7 : 1.2;
      g.add(cap);
    });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.7, 3.0, 5.5), hullMat);
    tower.position.y = 2.2;
    g.add(tower);
    [-1, 1].forEach(s => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 1.6), hullMat);
      fin.position.set(s * 2.2, 0, 9.5);
      g.add(fin);
    });

    // Periskop: sitzt in einem eigenen Objekt, damit es über Wasser bleibt und sich drehen kann
    const periscope = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 5.5, 7),
      new THREE.MeshStandardMaterial({ color: 0x2c3a41, roughness: 0.5, metalness: 0.7 }));
    mast.position.y = 2.75;
    periscope.add(mast);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x1b2429, roughness: 0.4, metalness: 0.7 }));
    head.position.set(0, 5.3, -0.28);
    periscope.add(head);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10),
      new THREE.MeshStandardMaterial({ color: 0x9fe6ff, emissive: 0x2a8fb5, emissiveIntensity: 1.2 }));
    lens.position.set(0, 5.3, -0.74);
    periscope.add(lens);
    g.add(periscope);

    g.visible = false;
    scene.add(g);
    return { group: g, periscope, hullParts: [hull, tower] };
  }

  function buildTorpedoMesh() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x3d454b, roughness: 0.5, metalness: 0.65 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 4.2, 10), mat);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.0, 10), mat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = -2.5;
    g.add(nose);
    [-1, 1].forEach(s => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.7), mat);
      fin.position.set(s * 0.5, 0, 2.0);
      g.add(fin);
      const vfin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.7), mat);
      vfin.position.set(0, s * 0.5, 2.0);
      g.add(vfin);
    });
    g.visible = false;
    scene.add(g);
    return g;
  }

  function init(sceneRef) {
    scene = sceneRef;
    subs = [];
    torpedoes = [];
    for (let i = 0; i < SUB_POOL; i++) {
      const built = buildSubMesh();
      subs.push({
        mesh: built.group,
        periscope: built.periscope,
        active: false,
        x: 0, z: 0, y: -SUB_DEPTH,
        heading: 0,
        speed: 3.2,
        radius: SUB_RADIUS,
        state: 'patrol',     // patrol -> aiming -> reload
        timer: 0,
        cooldown: 0,
        accuracy: 0.55
      });
    }
    for (let i = 0; i < TORP_POOL; i++) {
      torpedoes.push({
        mesh: buildTorpedoMesh(),
        active: false,
        pos: new THREE.Vector3(),
        dir: new THREE.Vector3(0, 0, -1),
        life: 0,
        radius: TORPEDO_RADIUS,
        bubbleAccum: 0
      });
    }
  }

  function spawnSub(x, z, difficulty) {
    const s = subs.find(o => !o.active);
    if (!s) return null;
    s.active = true;
    s.x = x; s.z = z;
    s.heading = Math.random() * Math.PI * 2;
    s.speed = 2.4 + Math.random() * 1.6;
    s.state = 'patrol';
    s.timer = 0;
    // Bei grösserer Distanz greifen die Boote etwas schneller und genauer an
    s.cooldown = THREE.MathUtils.lerp(5.0, 2.6, difficulty) + Math.random() * 2.5;
    s.accuracy = THREE.MathUtils.lerp(0.45, 0.9, difficulty);
    s.mesh.visible = true;
    return s;
  }

  function releaseSub(s) {
    s.active = false;
    s.mesh.visible = false;
  }

  function fireTorpedo(sub, playerPos, playerVel) {
    const t = torpedoes.find(o => !o.active);
    if (!t) return;
    t.active = true;
    t.life = 0;
    t.pos.set(sub.x, Ocean.heightAt(sub.x, sub.z) - 2.6, sub.z);

    // Vorhalten auf die voraussichtliche Spielerposition, gedämpft durch die Zielgüte
    const toPlayer = new THREE.Vector3(playerPos.x - sub.x, 0, playerPos.z - sub.z);
    const dist = toPlayer.length();
    const lead = Math.min(dist / TORPEDO_SPEED, 6);
    const aimPoint = new THREE.Vector3(
      playerPos.x + playerVel.x * lead * sub.accuracy,
      0,
      playerPos.z + playerVel.z * lead * sub.accuracy
    );
    t.dir.set(aimPoint.x - sub.x, 0, aimPoint.z - sub.z).normalize();
    // Streuung: nie perfekt zielsuchend
    const spread = (1 - sub.accuracy) * 0.28;
    const a = (Math.random() - 0.5) * spread;
    const cos = Math.cos(a), sin = Math.sin(a);
    t.dir.set(t.dir.x * cos - t.dir.z * sin, 0, t.dir.x * sin + t.dir.z * cos).normalize();

    t.mesh.visible = true;
    t.mesh.position.copy(t.pos);
    AudioEngine.torpedoLaunch();
    warningTimer = 2.2;
  }

  function releaseTorpedo(t) {
    t.active = false;
    t.mesh.visible = false;
  }

  function update(dt, playerPos, playerVel, difficulty) {
    warningTimer = Math.max(0, warningTimer - dt);

    // ---- U-Boote ----
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      if (!s.active) continue;

      const dx = playerPos.x - s.x;
      const dz = playerPos.z - s.z;
      const dist = Math.hypot(dx, dz);
      const toPlayer = Math.atan2(dx, -dz);

      if (s.state === 'patrol') {
        // langsam in Angriffsposition manövrieren, ohne den Spieler zu rammen
        let diff = toPlayer - s.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const wanted = dist < 45 ? diff + Math.PI * 0.45 : diff; // auf Distanz halten
        s.heading += THREE.MathUtils.clamp(wanted, -0.5 * dt, 0.5 * dt);
        s.timer += dt;
        if (s.timer >= s.cooldown && dist < 170 && dist > 25) {
          s.state = 'aiming';
          s.timer = 0;
          AudioEngine.warning();
        }
      } else if (s.state === 'aiming') {
        // Periskop dreht sichtbar auf den Spieler ein - das ist die Vorwarnung
        s.timer += dt;
        let diff = toPlayer - s.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        s.heading += THREE.MathUtils.clamp(diff, -1.4 * dt, 1.4 * dt);
        if (s.timer >= AIM_TIME) {
          fireTorpedo(s, playerPos, playerVel);
          s.state = 'patrol';
          s.timer = 0;
          s.cooldown = THREE.MathUtils.lerp(6.5, 3.4, difficulty) + Math.random() * 3;
        }
      }

      s.x += Math.sin(s.heading) * s.speed * dt;
      s.z += -Math.cos(s.heading) * s.speed * dt;

      const surface = Ocean.heightAt(s.x, s.z);
      s.y = surface - SUB_DEPTH;
      s.mesh.position.set(s.x, s.y, s.z);
      s.mesh.rotation.y = s.heading;
      // Das Periskop bleibt immer knapp über Wasser, egal wie tief der Rumpf liegt
      s.periscope.position.y = SUB_DEPTH - 2.2;
      s.periscope.rotation.y = s.state === 'aiming' ? (toPlayer - s.heading) : Math.sin(Ocean.time * 0.6 + s.x) * 0.5;

      // kleine Bugwelle am Periskop
      if (Math.random() < dt * 9) {
        Effects.bubbleTrail({ x: s.x, y: surface - 1.2, z: s.z }, 0.5);
      }

      if (s.z > playerPos.z + 240 || Math.abs(s.x - playerPos.x) > 400) releaseSub(s);
    }

    // ---- Torpedos ----
    for (let i = 0; i < torpedoes.length; i++) {
      const t = torpedoes[i];
      if (!t.active) continue;
      t.life += dt;
      t.pos.addScaledVector(t.dir, TORPEDO_SPEED * dt);
      t.pos.y = Ocean.heightAt(t.pos.x, t.pos.z) - 2.4;
      t.mesh.position.copy(t.pos);
      t.mesh.rotation.y = Math.atan2(t.dir.x, -t.dir.z);

      // deutlich sichtbare Blasenspur
      t.bubbleAccum += dt;
      while (t.bubbleAccum > 0.045) {
        t.bubbleAccum -= 0.045;
        Effects.bubbleTrail({ x: t.pos.x, y: t.pos.y + 0.6, z: t.pos.z }, 0.45);
      }

      if (t.life > TORPEDO_LIFE) releaseTorpedo(t);
    }
  }

  function detonateSub(s) {
    Effects.underwaterExplosion(new THREE.Vector3(s.x, s.y, s.z), 1.5);
    releaseSub(s);
  }

  function detonateTorpedo(t) {
    Effects.underwaterExplosion(t.pos.clone(), 0.8);
    releaseTorpedo(t);
  }

  function reset() {
    subs.forEach(releaseSub);
    torpedoes.forEach(releaseTorpedo);
    warningTimer = 0;
  }

  return {
    init, spawnSub, update, reset,
    detonateSub, detonateTorpedo, releaseSub, releaseTorpedo,
    get subs() { return subs; },
    get torpedoes() { return torpedoes; },
    get activeSubs() { return subs.filter(s => s.active).length; },
    get activeTorpedoes() { return torpedoes.filter(t => t.active).length; },
    get warning() { return warningTimer > 0; }
  };
})();
