/* ================= KAMERAFÜHRUNG =================
   Drei Perspektiven (Verfolger, Brücke, Vogelperspektive) und der Kameraschwenk beim Absturz.

   Leitgedanke (Retro-Arcade): Die Kamera blickt fest entlang der Kursachse, dreht sich also nie
   mit. Seitlich folgt sie dem Schiff nur zu einem Teil (CHASE_FOLLOW) - dadurch wandert das
   Schiff im Bild spürbar zur Seite, während sich die Umgebung deutlich stärker verschiebt.
   Genau dieses Verhältnis erzeugt den Eindruck der Kursänderung, obwohl das Schiff gross und
   stabil im Vordergrund bleibt.

   Das Modul kennt nur camera und player; es greift auf keinen Spielzustand zu. */

const CameraRig = (function () {
  const MODES = 3;              // 0 = Verfolger, 1 = Brücke, 2 = Vogelperspektive
  // Wie stark die Kamera der Seitwärtsbewegung folgt. 1 = Schiff klebt in der Bildmitte,
  // 0 = Kamera steht still. Dazwischen entsteht die gewünschte Eigenbewegung im Bild.
  const CHASE_FOLLOW = 0.45;
  const COURSE = new THREE.Vector3(0, 0, -1);   // Kursachse: die Kamera blickt immer hierhin

  let mode = 0;

  const _fwd = new THREE.Vector3(0, 0, -1);
  const _up = new THREE.Vector3(0, 1, 0);
  const _target = new THREE.Vector3();
  const _look = new THREE.Vector3();

  function reset() {
    mode = 0;
    _fwd.copy(COURSE);
  }

  function cycleMode() {
    mode = (mode + 1) % MODES;
    return mode;
  }

  function applyShake(camera, shake) {
    if (shake <= 0.01) return;
    camera.position.x += (Math.random() - 0.5) * shake * 3;
    camera.position.y += (Math.random() - 0.5) * shake * 3;
    camera.position.z += (Math.random() - 0.5) * shake * 3;
  }

  /* Normale Fahrt: Perspektive je nach Modus. */
  function update(camera, player, dt, shake) {
    const r = player.def.radius;
    _fwd.copy(COURSE);   // Blickrichtung bleibt fest - nur das Schiff dreht sich sichtbar

    if (mode === 1) {
      // Brücke / Cockpit - hier gilt die echte Blickrichtung des Schiffs
      player.getBridgeWorld(_target);
      camera.position.lerp(_target, Math.min(1, dt * 14));
      _look.copy(player.position)
        .addScaledVector(player.forward, 60)
        .setY(player.position.y + player.bridgeOffset.y * 0.6);
      camera.up.set(0, 1, 0);
      camera.lookAt(_look);

    } else if (mode === 2) {
      // Vogelperspektive: hoch über dem Fahrzeug, Bug zeigt nach oben im Bild
      _target.copy(player.position);
      _target.y += 70 + r * 2.4;
      _target.addScaledVector(_fwd, r * 0.6);
      camera.position.lerp(_target, Math.min(1, dt * 4));
      camera.up.copy(COURSE);
      camera.lookAt(player.position);

    } else {
      // Verfolgerperspektive (Standard): fester Blick nach vorn, das Schiff sitzt im unteren
      // Bilddrittel. Seitlich folgt die Kamera nur teilweise, damit das Schiff im Bild wandern
      // kann und sich die Umgebung sichtbar stärker verschiebt.
      const dist = 20 + r * 1.7;
      const height = 8 + r * 0.75;
      const camX = player.lateral * CHASE_FOLLOW;
      _target.set(camX, player.position.y + height + player.altitude * 0.5, player.position.z + dist);
      camera.position.copy(_target);
      _look.set(camX, player.position.y + 3, player.position.z - 22);
      camera.up.set(0, 1, 0);
      camera.lookAt(_look);
    }

    applyShake(camera, shake);
  }

  /* Nach einem Treffer: Die Kamera zieht sich langsam vom Unglücksort zurück. */
  function updateDeath(camera, player, dt, elapsed) {
    _target.copy(player.position);
    _target.x += 0;
    _target.y += 26 + elapsed * 6;
    _target.z += 46 + elapsed * 8;
    camera.position.lerp(_target, Math.min(1, dt * 2));
    camera.up.set(0, 1, 0);
    camera.lookAt(player.position);
  }

  return {
    reset, cycleMode, update, updateDeath,
    get mode() { return mode; }
  };
})();
