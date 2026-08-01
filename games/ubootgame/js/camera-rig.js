/* ================= KAMERAFÜHRUNG =================
   Drei Perspektiven (Verfolger, Brücke, Vogelperspektive) und der Kameraschwenk beim Absturz.

   Leitgedanke: Die Kamera sitzt starr hinter dem Schiff. Beim Lenken bleibt das Schiff also
   ruhig in der Bildmitte und die Umgebung dreht sich um es herum - so ist auf einen Blick klar,
   dass gesteuert wird. Es gibt bewusst keinen Kamera-Nachlauf, der das Schiff im Bild
   seitwärts wandern liesse.

   Das Modul kennt nur camera und player; es greift auf keinen Spielzustand zu. */

const CameraRig = (function () {
  const MODES = 3;              // 0 = Verfolger, 1 = Brücke, 2 = Vogelperspektive

  let mode = 0;

  const _fwd = new THREE.Vector3(0, 0, -1);
  const _up = new THREE.Vector3(0, 1, 0);
  const _target = new THREE.Vector3();
  const _look = new THREE.Vector3();

  function reset(heading) {
    mode = 0;
    setForward(heading || 0);
  }

  /* Blickrichtung der Kamera = Blickrichtung des Schiffs, ohne Verzögerung. */
  function setForward(heading) {
    _fwd.set(Math.sin(heading), 0, -Math.cos(heading));
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
    setForward(player.heading);

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
      camera.up.copy(_fwd);
      camera.lookAt(player.position);

    } else {
      // Verfolgerperspektive (Standard): fest hinter dem Bug, ohne Nachlauf.
      // Dadurch steht das Schiff immer an derselben Stelle im Bild und die Umgebung dreht sich.
      const dist = 20 + r * 1.7;
      const height = 8 + r * 0.75;
      _target.copy(player.position)
        .addScaledVector(_fwd, -dist)
        .addScaledVector(_up, height + player.altitude * 0.5);
      camera.position.copy(_target);
      _look.copy(player.position).addScaledVector(_fwd, 22).setY(player.position.y + 3);
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
