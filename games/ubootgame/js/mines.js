/* ================= MINEN =================
   Zwei Arten: Oberflächenminen schwimmen sichtbar im Wasser, Unterwasserminen hängen unter der
   Oberfläche und sind mit blossem Auge praktisch nicht zu sehen - sie werden über das Radar
   entdeckt und erst auf sehr kurze Distanz schemenhaft sichtbar.
   Beide Typen laufen über einen Mesh-Pool, es werden zur Laufzeit keine Objekte neu erzeugt. */

const Mines = (function () {
  const POOL_SIZE = 60;
  const SURFACE_RADIUS = 2.4;
  const UNDER_RADIUS = 2.6;
  const UNDER_DEPTH = 4.5;

  let pool = [];
  let scene = null;

  function buildMineMesh(isUnderwater) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isUnderwater ? 0x1a2c33 : 0x2a2f33,
      roughness: 0.85, metalness: 0.4,
      transparent: isUnderwater, opacity: isUnderwater ? 0 : 1
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(isUnderwater ? 1.7 : 1.6, 14, 11), bodyMat);
    g.add(body);

    // Zündhörner rundum
    const hornMat = new THREE.MeshStandardMaterial({
      color: isUnderwater ? 0x33454d : 0x6b7075,
      roughness: 0.6, metalness: 0.6,
      transparent: isUnderwater, opacity: isUnderwater ? 0 : 1
    });
    const dirs = [
      [0, 1, 0], [0.8, 0.6, 0], [-0.8, 0.6, 0], [0, 0.6, 0.8], [0, 0.6, -0.8],
      [0.6, 0, 0.6], [-0.6, 0, -0.6], [0.6, 0, -0.6], [-0.6, 0, 0.6]
    ];
    dirs.forEach(d => {
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 1.0, 5), hornMat);
      const v = new THREE.Vector3(d[0], d[1], d[2]).normalize();
      horn.position.copy(v).multiplyScalar(1.9);
      horn.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
      g.add(horn);
    });

    if (!isUnderwater) {
      // rostroter Ring als Erkennungsmerkmal an der Oberfläche
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.16, 7, 18),
        new THREE.MeshStandardMaterial({ color: 0x8a3a22, roughness: 0.8, metalness: 0.3 }));
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
    } else {
      // Ankerkette nach unten - nur sichtbar, wenn die Mine überhaupt eingeblendet ist
      const chainMat = new THREE.MeshStandardMaterial({ color: 0x1a2126, roughness: 0.9, transparent: true, opacity: 0 });
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 5), chainMat);
      chain.position.y = -4;
      g.add(chain);
    }

    g.visible = false;
    scene.add(g);
    return g;
  }

  function init(sceneRef) {
    scene = sceneRef;
    pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      pool.push({
        surfaceMesh: buildMineMesh(false),
        underMesh: buildMineMesh(true),
        mesh: null,
        active: false,
        underwater: false,
        x: 0, z: 0, y: 0,
        radius: SURFACE_RADIUS,
        bobPhase: 0
      });
    }
  }

  function spawn(x, z, underwater) {
    const m = pool.find(p => !p.active);
    if (!m) return null;
    m.active = true;
    m.underwater = underwater;
    m.x = x; m.z = z;
    m.radius = underwater ? UNDER_RADIUS : SURFACE_RADIUS;
    m.bobPhase = Math.random() * Math.PI * 2;
    m.surfaceMesh.visible = !underwater;
    m.underMesh.visible = underwater;
    m.mesh = underwater ? m.underMesh : m.surfaceMesh;
    m.mesh.position.set(x, 0, z);
    return m;
  }

  function setOpacity(group, value) {
    group.traverse(o => {
      if (o.material && o.material.transparent) o.material.opacity = value;
    });
  }

  function update(dt, playerPos) {
    for (let i = 0; i < pool.length; i++) {
      const m = pool[i];
      if (!m.active) continue;

      const surfaceY = Ocean.heightAt(m.x, m.z);
      if (m.underwater) {
        m.y = surfaceY - UNDER_DEPTH;
        m.mesh.position.y = m.y;
        m.mesh.rotation.y += dt * 0.25;
        // Nur auf sehr kurze Distanz schemenhaft erkennbar (Radar bleibt die Hauptquelle)
        const d = Math.hypot(playerPos.x - m.x, playerPos.z - m.z);
        const vis = THREE.MathUtils.clamp((20 - d) / 10, 0, 1) * 0.55;
        setOpacity(m.mesh, vis);
      } else {
        m.bobPhase += dt * 1.6;
        m.y = surfaceY + Math.sin(m.bobPhase) * 0.12;
        m.mesh.position.y = m.y;
        m.mesh.rotation.y += dt * 0.35;
        m.mesh.rotation.z = Math.sin(m.bobPhase * 0.7) * 0.12;
      }

      // Weit hinter dem Spieler zurückgelassene Minen freigeben
      if (m.z > playerPos.z + 260 || Math.abs(m.x - playerPos.x) > 420) release(m);
    }
  }

  function release(m) {
    m.active = false;
    m.surfaceMesh.visible = false;
    m.underMesh.visible = false;
    m.mesh = null;
  }

  /* Zerstörung durch Treffer (Panzerkreuzer/Bombe) oder durch Kollision mit dem Spieler. */
  function detonate(m) {
    const pos = new THREE.Vector3(m.x, m.y, m.z);
    if (m.underwater) Effects.underwaterExplosion(pos, 1.1);
    else Effects.explosion(pos, 1.0);
    release(m);
  }

  function reset() {
    pool.forEach(release);
  }

  return {
    init, spawn, update, detonate, release, reset,
    get all() { return pool; },
    get activeCount() { return pool.filter(m => m.active).length; }
  };
})();
