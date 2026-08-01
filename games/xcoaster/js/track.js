/* ================= STRECKE =================
   Turtle-Graphics-Generator der Schienenführung, die sichtbare Schienen-Röhre, Seilbahn-Gondel
   und die Fahrzeug-Wechsel-Portale. Neue Streckenelemente entstehen ausschliesslich hier. */

/* ================= TRACK GENERATION (turtle-style) ================= */

function buildTrack() {
  const state = {
    position: new THREE.Vector3(0, 40, 0),
    forward: new THREE.Vector3(0, 0, -1),
    up: new THREE.Vector3(0, 1, 0),
    right: new THREE.Vector3(1, 0, 0)
  };

  trackPoints = [state.position.clone()];
  trackFrames = [{ forward: state.forward.clone(), up: state.up.clone(), right: state.right.clone() }];

  function pushSample() {
    trackPoints.push(state.position.clone());
    trackFrames.push({ forward: state.forward.clone(), up: state.up.clone(), right: state.right.clone() });
  }

  function reorthogonalize() {
    state.forward.normalize();
    state.right.crossVectors(state.forward, state.up).normalize();
    state.up.crossVectors(state.right, state.forward).normalize();
  }

  function addStraight(length, isTunnel) {
    const startIdx = trackPoints.length - 1;
    const steps = Math.max(2, Math.round(length / 20)); // gröbere Schrittweite: Geraden brauchen keine feine Auflösung
    const stepLen = length / steps;
    for (let i = 0; i < steps; i++) {
      state.position.addScaledVector(state.forward, stepLen);
      pushSample();
    }
    const endIdx = trackPoints.length - 1;
    trackSegments.push({ start: startIdx, end: endIdx, tunnel: !!isTunnel });
  }

  function addArc(totalAngleDeg, radius, axisType) {
    const steps = Math.max(8, Math.round(Math.abs(totalAngleDeg) / 4));
    const angleStep = THREE.MathUtils.degToRad(totalAngleDeg) / steps;
    const stepLen = radius * Math.abs(angleStep);
    const startIdx = trackPoints.length - 1;
    for (let i = 0; i < steps; i++) {
      let axis;
      if (axisType === 'up') axis = state.up.clone();
      else if (axisType === 'right') axis = state.right.clone();
      // diagonaler Bogen: Achse als laufend neu berechnete Mischung aus Rechts-/Hoch-Achse,
      // damit Huegel- und Kurvenanteil in einem einzigen, durchgehenden Bogen stecken
      // (kein Knick zwischen zwei nacheinander folgenden Boegen wie bei addHill+addTurn).
      else axis = state.right.clone().multiplyScalar(Math.cos(axisType.bank)).add(state.up.clone().multiplyScalar(Math.sin(axisType.bank))).normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(axis, angleStep);
      state.forward.applyQuaternion(q);
      state.up.applyQuaternion(q);
      reorthogonalize();
      state.position.addScaledVector(state.forward, stepLen);
      pushSample();
    }
    // jede Kurve (Turn/Hill/Loop/SideLoop) als "curve" markieren -> wird für die
    // Entgleisungs-Regel gebraucht ("fliegst in der naechsten Kurve raus")
    trackSegments.push({ start: startIdx, end: trackPoints.length - 1, tunnel: false, curve: true });
  }

  // Glatter, diagonaler Bogen (Huegel- + Kurvenanteil kombiniert) -> wird fuers Weben im
  // Planeten-Universum verwendet, damit dort keine eckigen Uebergaenge mehr entstehen.
  function addSmoothArc(totalAngleDeg, radius, bankDeg) {
    addArc(totalAngleDeg, radius, { bank: THREE.MathUtils.degToRad(bankDeg) });
  }

  function addTurn(angleDeg, radius) { addArc(angleDeg, radius, 'up'); }
  function addHill(angleDeg, length) {
    const rad = THREE.MathUtils.degToRad(Math.abs(angleDeg)) || 0.0001;
    const radius = length / rad;
    addArc(angleDeg, radius, 'right');
  }
  function addLoop(radius, direction) { addArc(360 * (direction || 1), radius, 'right'); }
  // Seitliches Looping: volle 360°-Drehung um die Hoch-Achse -> die Bahn wird seitlich
  // hinausgeschleudert und schliesst sich wieder, statt (wie addLoop) nach oben zu drehen.
  function addSideLoop(radius, direction) { addArc(360 * (direction || 1), radius, 'up'); }

  // Schanze: sichtbare Rampe hoch, dann eine unsichtbare Flugphase (gerade Fortsetzung der
  // Absprungrichtung, wie im Flug), am Ende eine sichtbare Landerampe, die wieder einfängt.
  function addRamp(launchAngle, launchLen, flightLen, landLen) {
    addHill(launchAngle, launchLen);      // sichtbare Startrampe (Absprung)
    const gapStart = trackPoints.length - 1;
    addStraight(flightLen);                // unsichtbare Flugphase
    const gapEnd = trackPoints.length - 1;
    trackSegments.push({ start: gapStart, end: gapEnd, tunnel: false, gap: true });
    addHill(-launchAngle, landLen);        // sichtbare Landerampe (Einfangen)
  }

  // Hügelige Strecke: mehrere kleine, abwechselnde Hügel hintereinander
  function addHilly(count, angleDeg, segLen) {
    for (let i = 0; i < count; i++) {
      addHill(i % 2 === 0 ? angleDeg : -angleDeg, segLen);
    }
  }

  // Seilbahn-Abschnitt: eine Achterbahn, die hineinfährt, wird dort zwangsweise mit
  // konstant 300 km/h weitergezogen (siehe cablecar-Logik in animate()/updateAi()).
  // Seilbahn: die Schiene fehlt hier komplett (gap), stattdessen haengt eine Gondel an
  // einem gespannten Seil, die Spieler/KI erst dann uebernimmt, wenn sie eingefahren sind.
  function addCableCar(length) {
    const startIdx = trackPoints.length - 1;
    addStraight(length);
    const endIdx = trackPoints.length - 1;
    trackSegments.push({ start: startIdx, end: endIdx, tunnel: false, gap: true, cablecar: true });
  }

  // Goldminen-Tunnel: wie ein normaler Tunnel, aber im Inneren mit Felswand-Optik,
  // Holzstuetzbalken und Goldnuggets statt futuristischer Neon-Beleuchtung.
  function addGoldmineTunnel(length) {
    const startIdx = trackPoints.length - 1;
    addStraight(length);
    const endIdx = trackPoints.length - 1;
    trackSegments.push({ start: startIdx, end: endIdx, tunnel: true, goldmine: true });
  }

  // "Anderes Universum": langer hügeliger Abschnitt, an dessen beiden Enden ein
  // schwarzes Loch als Portal steht (Hin- und Rueckreise).
  function addAltUniverse(buildFn) {
    const startIdx = trackPoints.length - 1;
    buildFn();
    const endIdx = trackPoints.length - 1;
    trackSegments.push({ start: startIdx, end: endIdx, tunnel: false, altUniverse: true });
  }

  // Schlängelnder Pfad fuers Planeten-Universum: Huegel- und Kurvenanteil laufen als EIN
  // einziger diagonaler Bogen (statt zwei nacheinander folgender Boegen) -> keine eckigen
  // Uebergaenge mehr, sondern durchgehend runde, gebankte S-Kurven.
  function addPlanetWeave(count, hillAngle, turnAngle, segLen) {
    for (let i = 0; i < count; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      const angle = Math.hypot(hillAngle, turnAngle) * dir;
      const bankDeg = Math.atan2(turnAngle, hillAngle) * (180 / Math.PI) * dir;
      addSmoothArc(angle, segLen * 0.85, bankDeg);
    }
  }

  // Schraubenlooping (Corkscrew): die Bahn rollt waehrend der Vorwaertsfahrt einmal komplett
  // um die eigene Laengsachse (Vorwaerts-Achse), statt wie addLoop nach oben oder addSideLoop
  // zur Seite auszubrechen - typisches "verdrehtes" Element statt eines klassischen Loopings.
  function addCorkscrew(length, rollDeg, direction) {
    const steps = Math.max(24, Math.round(length / 10));
    const stepLen = length / steps;
    const angleStep = THREE.MathUtils.degToRad(rollDeg * (direction || 1)) / steps;
    const startIdx = trackPoints.length - 1;
    for (let i = 0; i < steps; i++) {
      const axis = state.forward.clone();
      const q = new THREE.Quaternion().setFromAxisAngle(axis, angleStep);
      state.up.applyQuaternion(q);
      state.right.applyQuaternion(q);
      reorthogonalize();
      state.position.addScaledVector(state.forward, stepLen);
      pushSample();
    }
    trackSegments.push({ start: startIdx, end: trackPoints.length - 1, tunnel: false, curve: true });
  }

  // Spirale/Schraube: bohrt sich in mehreren vollen Umdrehungen wie ein Bohrer spiralfoermig
  // ins All hinauf. Die Bahn dreht sich fortlaufend um die Hoch-Achse (wie addSideLoop), steigt
  // dabei aber gleichmaessig in der Welt-Vertikalen, statt auf gleicher Hoehe zu bleiben.
  function addSpiralClimb(turns, radius, riseTotal) {
    const totalAngleDeg = 360 * turns;
    const steps = Math.max(24, Math.round(totalAngleDeg / 6));
    const angleStep = THREE.MathUtils.degToRad(totalAngleDeg) / steps;
    const stepLen = radius * Math.abs(angleStep);
    const riseStep = riseTotal / steps;
    const startIdx = trackPoints.length - 1;
    for (let i = 0; i < steps; i++) {
      const q = new THREE.Quaternion().setFromAxisAngle(state.up, angleStep);
      state.forward.applyQuaternion(q);
      reorthogonalize();
      state.position.addScaledVector(state.forward, stepLen);
      state.position.y += riseStep;
      pushSample();
    }
    trackSegments.push({ start: startIdx, end: trackPoints.length - 1, tunnel: false, curve: true });
  }

  // Teilstrecke, auf der alle fuenf Schienen (Player + 4 KIs) kurz zu einer einzigen
  // gemeinsamen Schiene zusammenlaufen und sich danach wieder auf ihre normalen seitlichen
  // Abstaende auftrennen. Die eigentliche Zusammenfuehrung passiert ueber mergeZoneInfo,
  // das in buildAiTrack()/updateAiState() den seitlichen Versatz Richtung 0 herunterfaehrt.
  function addMergeZone(taperLen, mergeLen) {
    const taperInStart = trackPoints.length - 1;
    addStraight(taperLen);              // Schienen laufen zusammen
    const mergeStart = trackPoints.length - 1;
    addStraight(mergeLen);              // gemeinsame Strecke: alle fuenf Bahnen auf einer Schiene
    const mergeEnd = trackPoints.length - 1;
    addStraight(taperLen);              // Schienen trennen sich wieder auf
    const taperOutEnd = trackPoints.length - 1;
    trackSegments.push({ start: taperInStart, end: taperOutEnd, tunnel: false, mergeZone: true });
    mergeZoneInfo = { taperInStart, mergeStart, mergeEnd, taperOutEnd };
  }

  // Fahrzeug-Wechsel-Portal: markiert einen einzelnen Punkt. Jede Achterbahn, die
  // hier vorbeikommt, wechselt ihr Aussehen (siehe checkVehiclePortal in animate()).
  function addVehiclePortal() {
    const idx = trackPoints.length - 1;
    trackSegments.push({ start: idx, end: idx, tunnel: false, vehiclePortal: true });
  }

  trackSegments = [];

  // ---- Sequence: weiträumige, ausladende Kurven/Loopings, lange Tunnel, sehr lange Gerade + sehr steiler Abhang ----
  addStraight(220, true);   // Tunnel 1
  addTurn(90, 85);          // weiter, lockerer Turn
  addStraight(60);
  addHill(-20, 120);        // sanfter, weiträumiger Drop
  addTurn(-70, 75);
  addHill(20, 120);
  addStraight(450);         // sehr lange gerade Schienenstrecke
  addStraight(200, true);   // Tunnel 2
  addLoop(48);               // grosszügiges Looping
  addStraight(70);
  addSideLoop(58, 1);        // weites seitliches Looping 1
  addTurn(55, 60);
  addHill(-30, 150);
  addStraight(70);
  addTurn(-40, 55);
  addLoop(42, -1);
  addStraight(240, true);   // Tunnel 3
  addHill(30, 150);
  addSideLoop(52, -1);       // weites seitliches Looping 2
  addTurn(90, 95);
  addStraight(240, true);   // Tunnel 4
  addTurn(90, 85);
  addHill(70, 260);          // langer, steiler Anstieg (Vorbereitung)
  addHill(-85, 380);         // sehr langer, sehr steiler (fast senkrechter) Abhang
  addStraight(260, true);   // Tunnel 5
  addTurn(60, 70);
  addStraight(320, true);   // Tunnel 6 - noch ein sehr langer Tunnel
  addRamp(35, 90, 280, 90); // Schanze: doppelt so lange Flugzeit wie zuvor (140 -> 280)
  addStraight(80);
  addHill(78, 300);          // Anstieg vor dem zweiten Steil-Abhang
  addHill(-82, 340);         // zweiter sehr langer, sehr steiler (fast senkrechter) Abhang
  addStraight(70);
  addTurn(-50, 65);
  addMergeZone(140, 320);      // NEU: Teilstrecke - alle fuenf Schienen laufen kurz zu einer einzigen zusammen
  addHilly(8, 18, 55);        // NEU: hügelige Strecke (mehrere kleine Wellen hintereinander)
  addStraight(60);
  addCableCar(2200);          // Seilbahn deutlich verlängert (800 -> 2200)
  addStraight(60);
  addHill(88, 100);           // NEU: Übergang in eine senkrecht ausgelegte Schienenstrecke
  addStraight(550);           // ... lange Fahrt auf der senkrechten Schiene ...
  addHill(88, 100);           // ... Übergang zurück
  addGoldmineTunnel(500);      // NEU: Goldminen-Tunnel
  addStraight(80);
  addAltUniverse(() => {
    addStraight(160);
    addLoop(45, 1);              // Looping mitten im Planetenfeld
    addStraight(160);
    addCorkscrew(150, 360, 1);   // Schraubenlooping (Corkscrew) mitten im Planetenfeld
    addStraight(160);
    addSpiralClimb(4, 90, 260);  // NEU: Spirale/Schraube, die sich hoch ins All hinaufbohrt
    addHill(-90, 260);           // NEU: an der Spitze kippt die Bahn senkrecht nach unten ab
    addStraight(420);            // NEU: langer senkrechter Sturz zurueck Richtung Planeten
    addHill(90, 260);            // NEU: faengt die Bahn wieder ab, zurueck in die Horizontale
    addStraight(160);
    addRamp(48, 160, 380, 160);  // hohe Schanze - fliegt weit über die Planeten, wird am Ende wieder aufgefangen
  });
  addStraight(80);
  addStraight(80);
  // finaler, innen beleuchteter Zieltunnel (breit genug für alle fünf Bahnen) - um die Hälfte gekürzt
  addStraight(1175, true);   // finale Strecke Teil 1 (vorher 2350)
  trackSegments[trackSegments.length - 1].wideTunnel = true;
  addStraight(1200, true);   // finale Strecke Teil 2 (vorher 2400)
  trackSegments[trackSegments.length - 1].wideTunnel = true;

  // cumulative arc length
  cumLen = [0];
  for (let i = 1; i < trackPoints.length; i++) {
    cumLen.push(cumLen[i - 1] + trackPoints[i].distanceTo(trackPoints[i - 1]));
  }
  totalLength = cumLen[cumLen.length - 1];
}

function frameQuaternion(frame) {
  const m = new THREE.Matrix4().makeBasis(
    frame.right, frame.up, frame.forward.clone().multiplyScalar(-1)
  );
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/* Returns interpolated {position, forward, up, right} for a distance along the (wrapped) track.
   idxState = {i:0} is a small mutable object so player and AI can each keep their own search cursor. */
function sampleTrackAt(dist, idxState) {
  let i = idxState.i;
  while (i < cumLen.length - 2 && cumLen[i + 1] < dist) i++;
  while (i > 0 && cumLen[i] > dist) i--;
  idxState.i = i;

  const segLen = cumLen[i + 1] - cumLen[i];
  const t = segLen > 0 ? THREE.MathUtils.clamp((dist - cumLen[i]) / segLen, 0, 1) : 0;

  const pos = trackPoints[i].clone().lerp(trackPoints[i + 1], t);
  const q1 = frameQuaternion(trackFrames[i]);
  const q2 = frameQuaternion(trackFrames[i + 1]);
  const q = q1.clone().slerp(q2, t);

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q).normalize();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q).normalize();
  return { position: pos, forward, up, right };
}

/* ================= VISUAL TRACK MESH ================= */

function getGapRanges() {
  return trackSegments.filter(s => s.gap);
}
function isInsideGap(i, gapRanges) {
  return gapRanges.some(r => i >= r.start && i <= r.end);
}
function getCurveRanges() {
  return trackSegments.filter(s => s.curve);
}
function isInsideCurve(i, curveRanges) {
  return curveRanges.some(r => i >= r.start && i <= r.end);
}
function getAltUniverseRanges() {
  return trackSegments.filter(s => s.altUniverse);
}
function isInsideRange(i, ranges) {
  return ranges.some(r => i >= r.start && i <= r.end);
}

/* Liefert 1 ausserhalb der Teilstrecke (normaler seitlicher Abstand), 0 mitten in der
   Teilstrecke (alle fuenf Schienen auf einer einzigen Linie) und einen weich interpolierten
   Zwischenwert in den beiden Uebergangsstuecken davor/danach. */
function getMergeFactor(i) {
  if (!mergeZoneInfo) return 1;
  const { taperInStart, mergeStart, mergeEnd, taperOutEnd } = mergeZoneInfo;
  if (i <= taperInStart || i >= taperOutEnd) return 1;
  if (i >= mergeStart && i <= mergeEnd) return 0;
  let t;
  if (i < mergeStart) t = 1 - (i - taperInStart) / Math.max(1, mergeStart - taperInStart);
  else t = (i - mergeEnd) / Math.max(1, taperOutEnd - mergeEnd);
  return t * t * (3 - 2 * t); // smoothstep
}

/* ================= FAHRZEUG-WECHSEL-PORTALE ================= */

function getVehiclePortalRanges() {
  return trackSegments.filter(s => s.vehiclePortal);
}

/* Prueft, ob eine Achterbahn gerade ein Fahrzeug-Portal ueberquert hat, und wechselt
   in diesem Fall ihr Aussehen (Skin) auf das jeweils naechste. portalState = {nextIndex}. */
function checkVehiclePortal(distanceTraveled, state, cart) {
  if (vehiclePortalDistances.length === 0 || !cart || !cart.skins || cart.skins.length < 2) return;
  const nextDist = vehiclePortalDistances[state.nextPortal % vehiclePortalDistances.length];
  if (distanceTraveled >= nextDist) {
    cart.skinIndex = (cart.skinIndex + 1) % cart.skins.length;
    setCartSkin(cart, cart.skinIndex);
    state.nextPortal = (state.nextPortal + 1) % vehiclePortalDistances.length;
  }
}

function setCartSkin(cart, index) {
  if (!cart || !cart.skins) return; // Sonder-Autos haben keine Skins
  cart.skins.forEach((skinGroup, i) => { skinGroup.visible = (i === index); });
}

function getCableCarRanges() {
  return trackSegments.filter(s => s.cablecar);
}

/* Baut die Schienen-Röhre in mehreren Stücken und lässt dabei die gap-Bereiche
   (Schanzen-Flugphasen) komplett aus, damit dort wirklich keine Schiene zu sehen ist. */
function buildTubeWithGaps(points, gapRanges, material, radius) {
  const sorted = gapRanges.slice().sort((a, b) => a.start - b.start);
  let cursor = 0;
  const ranges = [];
  sorted.forEach((g) => {
    if (g.start > cursor) ranges.push([cursor, g.start]);
    cursor = Math.max(cursor, g.end);
  });
  if (cursor < points.length - 1) ranges.push([cursor, points.length - 1]);

  ranges.forEach(([s, e]) => {
    if (e - s < 2) return;
    const pts = points.slice(s, e + 1);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const tubeGeo = new THREE.TubeGeometry(curve, Math.max(20, pts.length * 2), radius, 8, false);
    scene.add(new THREE.Mesh(tubeGeo, material));
  });
}

/* Leuchtende Markierungsplatten an Absprung- und Landepunkt der Schanze */
function buildRampMarkers(points, frames, gapRanges, color) {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6 });
  gapRanges.forEach((g) => {
    [g.start, g.end].forEach((idx) => {
      const p = points[idx];
      const f = frames[idx];
      const plate = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.25, 2.2), mat);
      plate.position.copy(p);
      const m = new THREE.Matrix4().makeBasis(f.right, f.up, f.forward.clone().multiplyScalar(-1));
      plate.quaternion.setFromRotationMatrix(m);
      scene.add(plate);
    });
  });
}

/* Silbern schimmernde Zusatz-Röhre über der Seilbahn-Strecke, damit sie optisch als
   eigener Abschnitt erkennbar ist. */
/* Baut eine kaefigartige Gondel-Box in Wagenfarbe (Panels + Kanten), passend zur jeweiligen Achterbahn. */
function buildGondolaBox(color) {
  const group = new THREE.Group();
  const panelMat = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.5, side: THREE.DoubleSide });
  const box = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.0, 4.6), panelMat);
  group.add(box);

  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), edgeMat);
  group.add(edges);

  // kurze Verbindungsstange nach oben zum Seil
  const hookMat = new THREE.MeshStandardMaterial({ color: 0x333340, metalness: 0.8, roughness: 0.3 });
  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 6), hookMat);
  hook.position.y = 2.2;
  group.add(hook);

  scene.add(group);
  return group;
}

/* Spannt ein Seil zwischen Ein- und Ausstieg der Seilbahn-Luecke und setzt dort die
   (anfangs stehende) Gondel-Box ab. Gibt die Distanzwerte + die Gondel zurueck, damit
   animate()/updateAi() die Ueberfahrt steuern koennen. */
function buildCableSystem(points, frames, cableRanges, color) {
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, metalness: 0.7, roughness: 0.4 });
  let info = null;
  cableRanges.forEach((r) => {
    const pA = points[r.start];
    const pB = points[r.end];
    const dir = pB.clone().sub(pA);
    const len = dir.length();
    if (len < 1) return;

    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, len, 6), cableMat);
    cable.position.copy(pA).add(pB).multiplyScalar(0.5);
    cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    scene.add(cable);

    const gondola = buildGondolaBox(color);
    gondola.position.copy(pA);
    const m = new THREE.Matrix4().makeBasis(frames[r.start].right, frames[r.start].up, frames[r.start].forward.clone().multiplyScalar(-1));
    gondola.quaternion.setFromRotationMatrix(m);

    info = {
      entryDist: cumLen[r.start],
      exitDist: cumLen[r.end],
      box: gondola,
      entryPos: pA.clone(),
      entryQuat: gondola.quaternion.clone()
    };
  });
  return info;
}

function buildTrackMesh() {
  const gapRanges = getGapRanges();
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0x2b3fe0, metalness: 0.6, roughness: 0.25, emissive: 0x0b1466, emissiveIntensity: 0.4 });
  playerRailMat = tubeMat; // themenfähig: Schienenfarbe der Spielerbahn wechselt pro Level
  buildTubeWithGaps(trackPoints, gapRanges, tubeMat, 0.9);

  // simple cross ties for a rail look (in der Schanzen-Lücke ausgelassen)
  const tieGeo = new THREE.BoxGeometry(3.2, 0.35, 0.7);
  const tieMat = new THREE.MeshStandardMaterial({ color: 0x333340, roughness: 0.8 });
  themeTieMats.push(tieMat); // Schwellen wechseln pro Level ihre Farbe
  for (let i = 0; i < trackPoints.length; i += 10) {
    if (isInsideGap(i, gapRanges)) continue;
    const p = trackPoints[i];
    const f = trackFrames[i];
    const tie = new THREE.Mesh(tieGeo, tieMat);
    tie.position.copy(p);
    const m = new THREE.Matrix4().makeBasis(f.right, f.up, f.forward.clone().multiplyScalar(-1));
    tie.quaternion.setFromRotationMatrix(m);
    scene.add(tie);
  }

  buildRampMarkers(trackPoints, trackFrames, gapRanges, 0xffb020);
  gondolaInfo = buildCableSystem(trackPoints, trackFrames, getCableCarRanges(), 0x3355ff);
}
