/* ================= SPIELERFAHRZEUG =================
   Bewegung, Auftrieb auf den Wellen, Kielwasser, Fahrzeugwechsel sowie die Sonderfähigkeiten
   von Panzerkreuzer (drehbare Türme) und Wasserflugzeug (kurzer Flug).

   Steuermodell (Retro-Arcade, wie in einem Formel-Rennspiel):
   Das Schiff fährt immer entlang der Kursachse (-Z) und bewegt sich beim Lenken nur seitlich
   innerhalb eines Korridors. Es dreht sich dabei ausschliesslich OPTISCH um bis zu 10 Grad in
   die gesteuerte Richtung und neigt sich um bis zu 4 Grad - beides ohne Einfluss auf die
   Fahrtrichtung. Es gibt keine Trägheit, kein Driften und kein Nachrutschen: Die seitliche
   Position folgt unmittelbar der Eingabe und bleibt beim Loslassen stehen, während sich der
   Bug weich wieder gerade ausrichtet. Der Eindruck der Kursänderung entsteht dadurch, dass
   sich die Umgebung deutlich stärker bewegt als das Schiff (siehe camera-rig.js). */

const KNOTS_TO_MS = 0.5144;

/* Bewegt einen Wert um höchstens maxStep in Richtung target - ohne Überschwingen. */
function moveTowards(current, target, maxStep) {
  if (current < target) return Math.min(current + maxStep, target);
  if (current > target) return Math.max(current - maxStep, target);
  return target;
}

function Player(scene) {
  this.scene = scene;
  this.group = new THREE.Group();   // trägt das Modell, wird geneigt/gedreht
  scene.add(this.group);

  this.model = null;
  this.def = null;
  this.turrets = [];
  this.propellers = [];

  this.position = new THREE.Vector3(0, 0, 0);
  this.heading = 0;                 // Gierwinkel; 0 = Blick nach -Z
  this.speed = 0;                   // Knoten
  this.forward = new THREE.Vector3(0, 0, -1);
  this.right = new THREE.Vector3(1, 0, 0);

  this.flying = false;
  this.flightTime = 0;              // bereits verflogene Sekunden
  this.flightLocked = false;        // true nach erzwungener Landung, bis F losgelassen wird
  this.altitude = 0;                // Höhe über der Wasseroberfläche
  this.turretAngle = 0;             // aktueller Turmwinkel (Weltkoordinaten, um Y)
  this.steerAuthority = 0;          // 0 = steht still (keine Lenkung), 1 = lenkbar
  this.turnInput = 0;               // -1 = links, 0 = geradeaus, +1 = rechts
  this.lateral = 0;                 // seitliche Position im Korridor (Meter, 0 = Mitte)
  this.visualYaw = 0;               // rein optische Bugdrehung
  this.alive = true;

  this._wakeAccum = 0;
  this._normal = new THREE.Vector3();
  this._tmp = new THREE.Vector3();
}

Player.MAX_FLIGHT = 5.0;            // Sekunden, siehe Kernregel 27
Player.FLIGHT_HEIGHT = 16;
Player.CORRIDOR = 22;               // befahrbare Breite je Seite in Metern
Player.LATERAL_PER_TURN = 15;       // seitliches Tempo = def.turn * dieser Faktor (m/s)
Player.MAX_VISUAL_YAW = THREE.MathUtils.degToRad(10);  // sichtbare Bugdrehung, max. 10 Grad
Player.YAW_TO_SPEED = THREE.MathUtils.degToRad(120);   // Einlenken: 120 Grad pro Sekunde
Player.YAW_BACK_SPEED = THREE.MathUtils.degToRad(80);  // Rückstellung: 80 Grad pro Sekunde
Player.MAX_BANK = THREE.MathUtils.degToRad(4);         // Neigung zur Kurveninnenseite, max. 4 Grad
Player.WAVE_TILT = 0.10;            // ganz dezentes Wiegen im Seegang - kein Schlingern

/* Setzt ein neues Fahrzeug ein. Position und Kurs bleiben erhalten (Wechsel mitten in der Fahrt). */
Player.prototype.setVehicle = function (id) {
  if (this.model) {
    this.group.remove(this.model);
    this.model.traverse(o => { if (o.geometry && o.userData.disposable) o.geometry.dispose(); });
  }
  const built = Vehicles.create(id);
  this.def = built.def;
  this.model = built.group;
  this.turrets = built.turrets || [];
  this.propellers = built.propellers || [];
  this.bridgeOffset = built.bridge || new THREE.Vector3(0, 3, 0);
  this.group.add(this.model);

  // Ein grösseres Fahrzeug darf beim Wechsel nicht sofort in einem Hindernis stecken:
  // Die eigentliche Sicherheitsprüfung macht der Shop, hier wird nur das Tempo gedeckelt.
  this.speed = Math.min(this.speed, this.def.maxSpeed);
  this.flying = false;
  this.flightTime = 0;
  this.flightLocked = false;
  this.altitude = 0;

  AudioEngine.setProfile(this.def.audio);
  return this.def;
};

Player.prototype.reset = function (id) {
  this.position.set(0, 0, 0);
  this.heading = 0;
  this.lateral = 0;
  this.visualYaw = 0;
  this.turnInput = 0;
  this.speed = 0;
  this.alive = true;
  this.flying = false;
  this.flightTime = 0;
  this.flightLocked = false;
  this.altitude = 0;
  this.turretAngle = 0;
  this.group.rotation.set(0, 0, 0);
  this.setVehicle(id);
  this.group.visible = true;
};

Object.defineProperty(Player.prototype, 'speedFrac', {
  get: function () { return THREE.MathUtils.clamp(Math.abs(this.speed) / this.def.maxSpeed, 0, 1); }
});

/* Hauptupdate: Antrieb, Lenkung, Auftrieb, Flug, Kielwasser. */
Player.prototype.update = function (dt, keys) {
  const def = this.def;

  // ---- Antrieb ----
  if (keys.up) {
    this.speed += def.accel * dt;
  } else if (keys.down) {
    this.speed -= def.brake * dt;
  } else {
    // Wasserwiderstand: das Fahrzeug wird von allein langsamer
    const drag = def.accel * 0.55;
    if (this.speed > 0) this.speed = Math.max(0, this.speed - drag * dt);
    else if (this.speed < 0) this.speed = Math.min(0, this.speed + drag * dt);
  }
  const minSpeed = -def.maxSpeed * 0.15; // sehr langsame Rückwärtsfahrt
  this.speed = THREE.MathUtils.clamp(this.speed, minSpeed, def.maxSpeed);

  // ---- Lenkung: nur seitlich, ohne Trägheit ----
  // +1 = rechts, -1 = links. Die Eingabe wirkt unmittelbar auf die seitliche Position;
  // beim Loslassen stoppt die Bewegung sofort und das Schiff bleibt, wo es ist.
  this.steerAuthority = Math.abs(this.speed) > 0.5 ? 1 : 0;
  this.turnInput = ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * this.steerAuthority;

  const lateralSpeed = def.turn * Player.LATERAL_PER_TURN;
  this.lateral = THREE.MathUtils.clamp(
    this.lateral + this.turnInput * lateralSpeed * dt,
    -Player.CORRIDOR, Player.CORRIDOR
  );

  // Sichtbare Bugdrehung: zügig in die Eingaberichtung, beim Loslassen weich zurück auf 0.
  const targetYaw = this.turnInput * Player.MAX_VISUAL_YAW;
  const yawStep = (this.turnInput === 0 ? Player.YAW_BACK_SPEED : Player.YAW_TO_SPEED) * dt;
  this.visualYaw = moveTowards(this.visualYaw, targetYaw, yawStep);
  this.heading = this.visualYaw;

  this.forward.set(Math.sin(this.heading), 0, -Math.cos(this.heading));
  this.right.set(Math.cos(this.heading), 0, Math.sin(this.heading));

  // ---- Fortbewegung ----
  // Der Kurs zeigt immer entlang -Z; gelenkt wird ausschliesslich über die seitliche Position.
  const ms = this.speed * KNOTS_TO_MS * (this.flying ? 1.6 : 1.0);
  this.position.z -= ms * dt;
  this.position.x = this.lateral;

  // ---- Flug (nur Wasserflugzeug) ----
  if (this.flying) {
    this.flightTime += dt;
    if (this.flightTime >= Player.MAX_FLIGHT) {
      // Erzwungene Landung nach 5 Sekunden - auch wenn F weiter gedrückt bleibt
      this.flying = false;
      this.flightLocked = true;
    }
    this.altitude += (Player.FLIGHT_HEIGHT - this.altitude) * Math.min(1, dt * 1.6);
  } else if (this.altitude > 0.01) {
    this.altitude = Math.max(0, this.altitude - dt * 9);
    if (this.altitude < 0.5 && this.altitude > 0) {
      // Aufsetzen auf dem Wasser: Gischt
      Effects.splash(this._tmp.set(this.position.x, Ocean.heightAt(this.position.x, this.position.z), this.position.z), 1.1);
    }
  } else {
    this.flightTime = 0;
  }

  // ---- Auftrieb / Lage auf den Wellen ----
  const surfaceY = Ocean.heightAt(this.position.x, this.position.z);
  const submerged = def.submarine ? -1.6 : 0;
  const targetY = surfaceY + submerged + this.altitude;
  this.position.y += (targetY - this.position.y) * Math.min(1, dt * (this.flying ? 3 : 6));

  this.group.position.copy(this.position);

  // Neigung ist reine Optik. Der Seegang wiegt das Schiff nur noch dezent, damit es im Bild
  // ruhig steht; die Krängung in der Kurve ist der sichtbare Hinweis darauf, dass gelenkt wird.
  Ocean.normalAt(this.position.x, this.position.z, this._normal);
  const wobble = this.altitude > 1 ? 0 : Player.WAVE_TILT;
  const pitch = Math.atan2(-this._normal.z, this._normal.y) * wobble;
  const roll = Math.atan2(this._normal.x, this._normal.y) * wobble;
  // Wellen- und Kurvenneigung zusammen bleiben hart auf MAX_BANK begrenzt - kein Schlingern.
  const bank = THREE.MathUtils.clamp(roll + this.turnInput * Player.MAX_BANK,
                                     -Player.MAX_BANK, Player.MAX_BANK);

  this.group.rotation.order = 'YXZ';
  this.group.rotation.y = this.heading;
  this.group.rotation.x += (pitch - this.group.rotation.x) * Math.min(1, dt * 3);
  this.group.rotation.z += (bank - this.group.rotation.z) * Math.min(1, dt * 4);

  // ---- Propeller des Wasserflugzeugs ----
  if (this.propellers.length) {
    const spin = (this.flying ? 34 : 12) * (0.4 + this.speedFrac);
    this.propellers.forEach(p => { p.rotation.z += spin * dt; });
  }

  // ---- Kielwasser und Gischt ----
  if (!this.flying && Math.abs(this.speed) > 0.6) {
    this._wakeAccum += dt * (2 + this.speedFrac * 12);
    while (this._wakeAccum >= 1) {
      this._wakeAccum -= 1;
      this._tmp.copy(this.position).addScaledVector(this.forward, -def.radius * 0.75);
      this._tmp.y = surfaceY + 0.2;
      Effects.wake(this._tmp, this.right, this.speedFrac, def.radius * 0.55);
    }
    if (def.submarine) Effects.bubbleTrail(this._tmp, 0.6);
  }
};

/* Wasserflugzeug: F gedrückt halten hebt ab, solange die 5 Sekunden nicht verbraucht sind. */
Player.prototype.setFlightInput = function (pressed) {
  if (!this.def.seaplane) { this.flying = false; return; }
  if (!pressed) {
    this.flying = false;
    this.flightLocked = false; // Loslassen gibt den nächsten Start wieder frei
    return;
  }
  if (!this.flying && !this.flightLocked && this.flightTime < Player.MAX_FLIGHT && this.altitude < 1) {
    this.flying = true;
    AudioEngine.bombDrop();
  }
};

Object.defineProperty(Player.prototype, 'remainingFlight', {
  get: function () { return Math.max(0, Player.MAX_FLIGHT - this.flightTime); }
});

/* Panzerkreuzer: Türme drehen sich sichtbar und weich zum Mauszielpunkt. */
Player.prototype.aimTurrets = function (targetWorld, dt) {
  if (!this.turrets.length) return;
  const dx = targetWorld.x - this.position.x;
  const dz = targetWorld.z - this.position.z;
  const desired = Math.atan2(dx, -dz); // Weltwinkel, 0 = -Z
  // kürzesten Weg wählen
  let diff = desired - this.turretAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  this.turretAngle += THREE.MathUtils.clamp(diff, -1.1 * dt, 1.1 * dt); // ~63°/s
  this.turrets.forEach(t => { t.group.rotation.y = this.turretAngle - this.heading; });
};

/* Weltposition und -richtung der Rohrmündungen (für Mündungsfeuer und Geschossstart). */
Player.prototype.getMuzzles = function () {
  const out = [];
  this.turrets.forEach(t => {
    const p = t.muzzleLocal.clone();
    t.group.localToWorld(p);
    out.push(p);
  });
  return out;
};

Player.prototype.getAimDirection = function () {
  return new THREE.Vector3(Math.sin(this.turretAngle), 0, -Math.cos(this.turretAngle));
};

/* Kameraposition der Brücken-/Cockpitperspektive in Weltkoordinaten. */
Player.prototype.getBridgeWorld = function (target) {
  return this.group.localToWorld((target || new THREE.Vector3()).copy(this.bridgeOffset));
};
