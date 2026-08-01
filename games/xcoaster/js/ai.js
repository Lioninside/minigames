/* ================= KI-GEGNER =================
   Eigene Schienen, Zustand und Bewegung der computergesteuerten Achterbahnen. */

/* ================= ZWEITE SCHIENE (KI-GEGNER) ================= */

function buildAiTrack(offset, tubeColor, tubeEmissive, tieColor, rampColor, gondolaColor) {
  const pts = trackPoints.map((p, i) => p.clone().addScaledVector(trackFrames[i].right, offset * getMergeFactor(i)));
  const gapRanges = getGapRanges();

  const tubeMat = new THREE.MeshStandardMaterial({ color: tubeColor, metalness: 0.6, roughness: 0.25, emissive: tubeEmissive, emissiveIntensity: 0.4 });
  buildTubeWithGaps(pts, gapRanges, tubeMat, 0.9);

  const tieGeo = new THREE.BoxGeometry(3.2, 0.35, 0.7);
  const tieMat = new THREE.MeshStandardMaterial({ color: tieColor, roughness: 0.8 });
  themeTieMats.push(tieMat); // auch die KI-Schwellen wechseln pro Level ihre Farbe
  for (let i = 0; i < pts.length; i += 10) {
    if (isInsideGap(i, gapRanges)) continue;
    const p = pts[i];
    const f = trackFrames[i];
    const tie = new THREE.Mesh(tieGeo, tieMat);
    tie.position.copy(p);
    const m = new THREE.Matrix4().makeBasis(f.right, f.up, f.forward.clone().multiplyScalar(-1));
    tie.quaternion.setFromRotationMatrix(m);
    scene.add(tie);
  }

  buildRampMarkers(pts, trackFrames, gapRanges, rampColor);
  const gInfo = buildCableSystem(pts, trackFrames, getCableCarRanges(), gondolaColor);
  return { pts, gondolaInfo: gInfo };
}

/* Baut Schiene + Wagen fuer einen einzelnen KI-Gegner und gibt sein komplettes
   Zustandsobjekt zurueck (wird in init() vier Mal aufgerufen, siehe AI_CONFIGS). */
function initAiState(config) {
  const rail = buildAiTrack(config.offset, config.tubeColor, config.tubeEmissive, config.tieColor, config.rampColor, config.bodyColor);
  const cart = buildCartMesh(config.bodyColor, config.finColor);
  cart.exhaust = createExhaustParticles();
  return {
    config,
    trackPoints: rail.pts,
    gondolaInfo: rail.gondolaInfo,
    cartGroup: cart.group,
    cartFlame: cart.flame,
    cart,
    idx: { i: 0 },
    distanceTraveled: 0,
    speedKmh: 0,
    throttle: false,
    targetSpeed: config.startTarget,
    inGondola: false,
    gondolaProgress: 0,
    nextPortal: 0,
    lap: 0 // abgeschlossene Runden dieser KI -> für die Ranglisten-Sortierung
  };
}

/* Bewegt eine KI-Achterbahn: startet erst, wenn der Player losfährt, stoppt mit ihm,
   pendelt sonst frei zwischen 400 und 800 km/h - ausser auf der Seilbahn-Strecke, dort
   gilt zwingend das Seilbahn-Tempo, egal was die KI eigentlich moechte. */
function updateAiState(state, dt) {
  updateAiEngineSound(state);
  const playerIsDriving = started && speedKmh > 0.01;

  if (state.inGondola && state.gondolaInfo) {
    const gapDist = state.gondolaInfo.exitDist - state.gondolaInfo.entryDist;
    const crossDuration = Math.max(1, gapDist / (CABLECAR_SPEED / 3.6));
    state.gondolaProgress = Math.min(1, state.gondolaProgress + dt / crossDuration);

    const interpDist = THREE.MathUtils.lerp(state.gondolaInfo.entryDist, state.gondolaInfo.exitDist, state.gondolaProgress);
    const sample = sampleTrackAt(interpDist, state.idx);
    const pos = sample.position.clone().addScaledVector(sample.right, state.config.offset * getMergeFactor(state.idx.i)).addScaledVector(sample.up, 1.1);
    state.cartGroup.position.copy(pos);
    const m = new THREE.Matrix4().makeBasis(sample.right, sample.up, sample.forward.clone().multiplyScalar(-1));
    state.cartGroup.quaternion.setFromRotationMatrix(m);

    state.gondolaInfo.box.position.copy(pos).addScaledVector(sample.up, -1.1);
    state.gondolaInfo.box.quaternion.copy(state.cartGroup.quaternion);
    if (state.cartFlame) state.cartFlame.material.opacity = 0;

    if (state.gondolaProgress >= 1) {
      state.inGondola = false;
      state.distanceTraveled = state.gondolaInfo.exitDist;
      state.speedKmh = CABLECAR_SPEED;
      state.gondolaInfo.box.position.copy(state.gondolaInfo.entryPos);
      state.gondolaInfo.box.quaternion.copy(state.gondolaInfo.entryQuat);
    }
    return;
  }

  if (!playerIsDriving) {
    state.speedKmh = Math.max(0, state.speedKmh - FRICTION * dt);
    state.throttle = false;
  } else {
    // Zieltempo pendelt zwischen 400 und dem levelabhängigen KI-Höchsttempo (aiMaxSpeed)
    state.targetSpeed += (Math.random() - 0.5) * 120 * dt;
    state.targetSpeed = THREE.MathUtils.clamp(state.targetSpeed, Math.min(400, aiMaxSpeed), aiMaxSpeed);
    if (state.speedKmh < state.targetSpeed) {
      state.speedKmh += ACCEL * 0.8 * dt;
      state.throttle = true;
    } else {
      state.speedKmh -= FRICTION * dt;
      state.throttle = false;
    }
  }
  state.speedKmh = THREE.MathUtils.clamp(state.speedKmh, 0, aiMaxSpeed);

  const speedMs = state.speedKmh / 3.6;
  state.distanceTraveled += speedMs * dt;
  if (state.distanceTraveled >= totalLength) {
    state.distanceTraveled = state.distanceTraveled % totalLength;
    state.idx.i = 0;
    state.nextPortal = 0;
    state.lap++; // Runde abgeschlossen -> zählt für die Ranglisten-Position
  }

  const sample = sampleTrackAt(state.distanceTraveled, state.idx);
  const pos = sample.position.clone()
    .addScaledVector(sample.right, state.config.offset * getMergeFactor(state.idx.i))
    .addScaledVector(sample.up, 1.1);
  state.cartGroup.position.copy(pos);
  const m = new THREE.Matrix4().makeBasis(sample.right, sample.up, sample.forward.clone().multiplyScalar(-1));
  state.cartGroup.quaternion.setFromRotationMatrix(m);

  if (state.cartFlame) {
    state.cartFlame.material.opacity = state.throttle ? 0.9 : 0.0;
    const s = state.throttle ? 1 + Math.random() * 0.3 : 0.4;
    state.cartFlame.scale.set(s, 1, s);
  }

  if (state.throttle && state.cart && state.cart.exhaust) {
    const speedFrac = THREE.MathUtils.clamp(state.speedKmh / aiMaxSpeed, 0, 1);
    const backward = sample.forward.clone().multiplyScalar(-1);
    const origin = pos.clone().addScaledVector(sample.up, 0.3).addScaledVector(sample.forward, -2.7);
    spawnExhaust(state.cart.exhaust, origin, backward, speedFrac, 1 + Math.round(speedFrac * 3));
  }

  checkVehiclePortal(state.distanceTraveled, state, state.cart);

  // In die eigene Gondel einsteigen, sobald der Eintrittspunkt erreicht ist
  if (state.gondolaInfo && state.distanceTraveled >= state.gondolaInfo.entryDist && state.distanceTraveled < state.gondolaInfo.exitDist) {
    state.inGondola = true;
    state.gondolaProgress = 0;
    state.distanceTraveled = state.gondolaInfo.entryDist;
  }
}
