/* ================= KAMERAFÜHRUNG =================
   Drei Perspektiven (Verfolger, Brücke, Vogelperspektive) und der Kameraschwenk beim Absturz.

   Wichtigster Kniff: Die Kamera folgt dem Schiffskurs *verzögert*. Wäre sie starr an die
   Blickrichtung des Schiffs gekoppelt, sähe jedes Lenkmanöver so aus, als drehe sich die Welt
   um ein stillstehendes Schiff - statt dass das Schiff sichtbar einen Kurs fährt.

   Das Modul kennt nur camera und player; es greift auf keinen Spielzustand zu. */

const CameraRig = (function () {
  const MODES = 3;              // 0 = Verfolger, 1 = Brücke, 2 = Vogelperspektive
  const YAW_FOLLOW = 1.8;       // wie schnell der Kamerakurs nachzieht (höher = starrer)

  let mode = 0;
  let yaw = 0;                  // folgt player.heading verzögert

  const _fwd = new THREE.Vector3(0, 0, -1);
  const _up = new THREE.Vector3(0, 1, 0);
  const _target = new THREE.Vector3();
  const _look = new THREE.Vector3();

  function reset(heading) {
    mode = 0;
    yaw = heading || 0;
    _fwd.set(Math.sin(yaw), 0, -Math.cos(yaw));
  }

  function cycleMode() {
    mode = (mode + 1) % MODES;
    return mode;
  }

  /* Kamerakurs auf kürzestem Weg an den Schiffskurs heranführen. */
  function followYaw(heading, dt) {
    let d = heading - yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    yaw += d * Math.min(1, dt * YAW_FOLLOW);
    _fwd.set(Math.sin(yaw), 0, -Math.cos(yaw));
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
    followYaw(player.heading, dt);

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
      // Verfolgerperspektive (Standard)
      const dist = 20 + r * 1.7;
      const height = 8 + r * 0.75;
      _target.copy(player.position)
        .addScaledVector(_fwd, -dist)
        .addScaledVector(_up, height + player.altitude * 0.5);
      camera.position.lerp(_target, 1 - Math.pow(0.0015, dt));
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
    get mode() { return mode; },
    get yaw() { return yaw; }
  };
})();
