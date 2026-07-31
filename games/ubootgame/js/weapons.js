/* ================= WAFFEN =================
   Nur Panzerkreuzer (Granaten) und Wasserflugzeug (Bomben) können angreifen.
   Arcade-Regel: Granaten dringen ins Wasser ein und erreichen auch Unterwasserziele, werden
   dort aber sichtbar langsamer und ziehen eine Blasenspur. */

const Weapons = (function () {
  const SHELL_POOL = 24;
  const BOMB_POOL = 10;

  const SHELL_SPEED = 105;      // m/s über Wasser
  const SHELL_WATER_FACTOR = 0.42;
  const SHELL_LIFE = 4.5;
  const SHELL_HIT_RADIUS = 3.6;
  const RELOAD = 0.75;          // Sekunden zwischen zwei Salven

  const BOMB_HIT_RADIUS = 9.0;  // Bomben wirken über einen Flächenradius
  const BOMB_LIFE = 6.0;
  const BOMB_RELOAD = 0.85;

  let scene = null;
  let shells = [];
  let bombs = [];
  let reloadTimer = 0;
  let bombTimer = 0;

  function init(sceneRef) {
    scene = sceneRef;

    const shellGeo = new THREE.SphereGeometry(0.42, 8, 6);
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xffd27a, emissive: 0xff9a2e, emissiveIntensity: 1.6, roughness: 0.4, metalness: 0.6
    });
    shells = [];
    for (let i = 0; i < SHELL_POOL; i++) {
      const mesh = new THREE.Mesh(shellGeo, shellMat);
      mesh.visible = false;
      scene.add(mesh);
      shells.push({ mesh, active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, underwater: false, trail: 0 });
    }

    const bombGeo = new THREE.Group();
    bombs = [];
    const bombBodyGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.7, 9);
    const bombNoseGeo = new THREE.SphereGeometry(0.42, 9, 7);
    const bombMat = new THREE.MeshStandardMaterial({ color: 0x33383d, roughness: 0.6, metalness: 0.5 });
    const finMat = new THREE.MeshStandardMaterial({ color: 0x5a6169, roughness: 0.6, metalness: 0.5 });
    for (let i = 0; i < BOMB_POOL; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(bombBodyGeo, bombMat);
      body.rotation.x = Math.PI / 2;
      g.add(body);
      const nose = new THREE.Mesh(bombNoseGeo, bombMat);
      nose.position.z = -0.85;
      g.add(nose);
      [0, 1].forEach(k => {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(k ? 0.08 : 1.0, k ? 1.0 : 0.08, 0.6), finMat);
        fin.position.z = 0.85;
        g.add(fin);
      });
      g.visible = false;
      scene.add(g);
      bombs.push({ mesh: g, active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, underwater: false, trail: 0 });
    }
  }

  /* Panzerkreuzer feuert: die Granaten verlassen die Rohre in der Richtung, in die die Türme
     tatsächlich zeigen. Da sich die Türme nur langsam zum Mauszeiger drehen, muss der Spieler
     das Einschwenken abwarten - genau wie bei echtem Geschützrichten. */
  function fireGuns(player) {
    if (reloadTimer > 0) return false;
    const muzzles = player.getMuzzles();
    if (!muzzles.length) return false;
    reloadTimer = RELOAD;

    const dir = player.getAimDirection();
    muzzles.forEach(muzzle => {
      const s = shells.find(o => !o.active);
      if (!s) return;
      s.active = true;
      s.life = 0;
      s.underwater = false;
      s.trail = 0;
      s.pos.copy(muzzle);
      s.vel.copy(dir).setY(0.06).normalize().multiplyScalar(SHELL_SPEED);
      s.mesh.visible = true;
      s.mesh.position.copy(s.pos);
      Effects.muzzleFlash(muzzle, dir);
    });
    AudioEngine.cannon();
    return true;
  }

  /* Wasserflugzeug wirft im Flug eine Bombe ab - sie übernimmt die Vorwärtsbewegung. */
  function dropBomb(player) {
    if (bombTimer > 0 || !player.flying) return false;
    const b = bombs.find(o => !o.active);
    if (!b) return false;
    bombTimer = BOMB_RELOAD;
    b.active = true;
    b.life = 0;
    b.underwater = false;
    b.trail = 0;
    b.pos.copy(player.position);
    b.pos.y -= 1.2;
    b.vel.copy(player.forward).multiplyScalar(player.speed * KNOTS_TO_MS * 1.6);
    b.vel.y = -1.5;
    b.mesh.visible = true;
    b.mesh.position.copy(b.pos);
    AudioEngine.bombDrop();
    return true;
  }

  /* Prüft, ob ein Projektil ein Ziel trifft, und löst die Explosion aus.
     onKill(kind) meldet dem Spiel Treffer zurück (für Statistik/Sound). */
  function checkHit(pos, radius, onKill) {
    const mines = Mines.all;
    for (let i = 0; i < mines.length; i++) {
      const m = mines[i];
      if (!m.active) continue;
      if (Math.hypot(pos.x - m.x, pos.z - m.z) < radius + m.radius &&
          Math.abs(pos.y - m.y) < radius + 6) {
        Mines.detonate(m);
        if (onKill) onKill('mine');
        return true;
      }
    }
    const subs = Enemies.subs;
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      if (!s.active) continue;
      if (Math.hypot(pos.x - s.x, pos.z - s.z) < radius + s.radius &&
          Math.abs(pos.y - s.y) < radius + 8) {
        Enemies.detonateSub(s);
        if (onKill) onKill('sub');
        return true;
      }
    }
    const torps = Enemies.torpedoes;
    for (let i = 0; i < torps.length; i++) {
      const t = torps[i];
      if (!t.active) continue;
      if (pos.distanceTo(t.pos) < radius + t.radius) {
        Enemies.detonateTorpedo(t);
        if (onKill) onKill('torpedo');
        return true;
      }
    }
    return false;
  }

  function update(dt, onKill) {
    reloadTimer = Math.max(0, reloadTimer - dt);
    bombTimer = Math.max(0, bombTimer - dt);

    // ---- Granaten ----
    for (let i = 0; i < shells.length; i++) {
      const s = shells[i];
      if (!s.active) continue;
      s.life += dt;

      const surface = Ocean.heightAt(s.pos.x, s.pos.z);
      if (!s.underwater && s.pos.y <= surface) {
        s.underwater = true;
        s.vel.multiplyScalar(SHELL_WATER_FACTOR); // Wasserwiderstand bremst deutlich ab
        Effects.splash(new THREE.Vector3(s.pos.x, surface, s.pos.z), 0.5);
      }

      if (s.underwater) {
        s.vel.multiplyScalar(Math.pow(0.45, dt)); // sinkt und wird langsamer
        s.vel.y -= 5 * dt;
        s.trail += dt;
        while (s.trail > 0.03) {
          s.trail -= 0.03;
          Effects.bubbleTrail(s.pos, 0.4);
        }
      } else {
        s.vel.y -= 6.5 * dt; // leichte Ballistik
      }

      s.pos.addScaledVector(s.vel, dt);
      s.mesh.position.copy(s.pos);

      if (checkHit(s.pos, SHELL_HIT_RADIUS, onKill) || s.life > SHELL_LIFE || s.pos.y < surface - 22) {
        s.active = false;
        s.mesh.visible = false;
      }
    }

    // ---- Bomben ----
    for (let i = 0; i < bombs.length; i++) {
      const b = bombs[i];
      if (!b.active) continue;
      b.life += dt;

      const surface = Ocean.heightAt(b.pos.x, b.pos.z);
      if (!b.underwater && b.pos.y <= surface) {
        b.underwater = true;
        b.vel.multiplyScalar(0.3);
        Effects.splash(new THREE.Vector3(b.pos.x, surface, b.pos.z), 1.0);
      }

      if (b.underwater) {
        b.vel.y = -6; // sinkt gleichmässig weiter und kann Unterwasserziele erreichen
        b.vel.x *= Math.pow(0.2, dt);
        b.vel.z *= Math.pow(0.2, dt);
        b.trail += dt;
        while (b.trail > 0.05) {
          b.trail -= 0.05;
          Effects.bubbleTrail(b.pos, 0.8);
        }
      } else {
        b.vel.y -= 19 * dt;
      }

      b.pos.addScaledVector(b.vel, dt);
      b.mesh.position.copy(b.pos);
      b.mesh.rotation.x = Math.atan2(-b.vel.y, Math.hypot(b.vel.x, b.vel.z)) - Math.PI / 2;
      b.mesh.rotation.y = Math.atan2(b.vel.x, -b.vel.z);

      const hit = checkHit(b.pos, BOMB_HIT_RADIUS, onKill);
      const tooDeep = b.pos.y < surface - 14;
      if (hit || tooDeep || b.life > BOMB_LIFE) {
        // Bomben detonieren immer - auch ohne Treffer als Fehlschlag im Wasser
        if (b.underwater) Effects.underwaterExplosion(b.pos.clone(), 1.2);
        else Effects.explosion(b.pos.clone(), 1.0);
        // Flächenwirkung: alles in der Nähe wird zusätzlich erfasst
        checkHit(b.pos, BOMB_HIT_RADIUS, onKill);
        b.active = false;
        b.mesh.visible = false;
      }
    }
  }

  function reset() {
    shells.forEach(s => { s.active = false; s.mesh.visible = false; });
    bombs.forEach(b => { b.active = false; b.mesh.visible = false; });
    reloadTimer = 0;
    bombTimer = 0;
  }

  return { init, update, reset, fireGuns, dropBomb };
})();
