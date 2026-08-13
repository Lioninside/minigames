/* ================= SPIELSTEUERUNG =================
   Aufbau der Szene, Tastatureingabe, Hauptschleife, Kamera und HUD. */

function init() {
  scene = new THREE.Scene();
  scene.background = NORMAL_BG; // finsteres Weltall

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('canvas-wrap').appendChild(renderer.domElement);

  // Lighting fürs All: dezentes Umgebungslicht + zwei Richtungslichter für Kontraste auf der Bahn
  const hemi = new THREE.HemisphereLight(0x4a5a8a, 0x0a0a14, 0.7);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.3);
  dir.position.set(120, 200, 80);
  scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0x88aaff, 0.5);
  dir2.position.set(-120, 80, -80);
  scene.add(dir2);

  loadProgress(); // Pokale + gekauftes/gewähltes Auto aus dem localStorage

  buildStarfield();

  buildTrack();
  buildTrackMesh();
  buildTunnels();
  buildSigns();
  buildCart();

  aiStates = AI_CONFIGS.map(initAiState);
  dragonState = initDragonState(); // Gegner fürs Schloss-Duell (anfangs verborgen)
  dragonState.gondolaInfo = aiStates[0].gondolaInfo; // Drache nutzt die Gondel der roten Schiene mit

  // Schwarze Verwandlungslöcher wurden entfernt; das Planeten-Universum bleibt als Strecke.
  const altRanges = getAltUniverseRanges();
  altRanges.forEach((r) => {
    buildUniverseDecor(trackPoints, r, { colors: [0x39d6ff, 0x8fe8ff, 0xffffff], shape: 'crystal' });     // Player: eisig-blaue Kristallwelt
    buildUniverseDecor(aiStates[0].trackPoints, r, { colors: [0xff5522, 0xff8800, 0xffcc33], shape: 'lava' });   // rote KI: Lavawelt
    buildUniverseDecor(aiStates[1].trackPoints, r, { colors: [0x33ff77, 0x99ff33, 0xccff66], shape: 'alien' });  // grüne KI: Alienwelt
    buildUniverseDecor(aiStates[2].trackPoints, r, { colors: [0xaa66ff, 0xcc99ff, 0xffffff], shape: 'crystal' }); // lila KI: Void-Kristallwelt
    buildUniverseDecor(aiStates[3].trackPoints, r, { colors: [0xffaa00, 0xffcc55, 0xffe0a0], shape: 'lava' });   // orange KI: Wüstenwelt
    buildPlanetUniverse(r); // dichtes Planetenfeld, die Strecke schlängelt sich hindurch
  });

  buildLevelWorlds();   // Ort-Deko aller Level-Welten (anfangs unsichtbar)
  initMinimap();        // Navi-Übersicht unten links vorbereiten
  setupShopUI();        // Klick-Handler der Fahrzeug-Karten
  applyLevelTheme(1);   // Level 1 (Weltall) als Startthema aktivieren
  raceActive = true;    // Rennen von Level 1 ist scharf; startet, sobald der Player Gas gibt

  clock = new THREE.Clock();

  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(e) {
  initAudio(); // Web Audio darf erst nach einer Nutzer-Interaktion starten
  const shopOpen = document.getElementById('shop').style.display === 'flex';
  if (e.code === 'ArrowUp') { keys.up = true; e.preventDefault(); dismissIntro(); }
  if (e.code === 'ArrowDown') { keys.down = true; e.preventDefault(); dismissIntro(); }
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (gameOver) { proceedAfterResult(); return; }        // nach Absturz: neu ab Level 1
    if (raceResult === 'lost') { proceedAfterResult(); return; } // Rennen verloren: neu ab Level 1
    if (raceResult === 'won' && shopOpen) { proceedAfterResult(); return; } // Shop überspringen
    dismissIntro(); // Leertaste/Enter startet das Spiel
  }
}
function onKeyUp(e) {
  if (e.code === 'ArrowUp') keys.up = false;
  if (e.code === 'ArrowDown') keys.down = false;
}

function dismissIntro() {
  const el = document.getElementById('intro');
  if (el) el.style.display = 'none';
}

/* ================= MAIN LOOP ================= */

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  frameCount++;

  updateEngineSound();

  // Partikel-Trails aller Fahrzeuge immer weiter bewegen/verblassen lassen (auch im Game-Over,
  // damit ein bereits ausgestossener Trail sauber ausklingt statt abrupt einzufrieren)
  if (playerCartBuilt && playerCartBuilt.exhaust) updateExhaust(playerCartBuilt.exhaust, dt);
  aiStates.forEach((s) => { if (s.cart && s.cart.exhaust) updateExhaust(s.cart.exhaust, dt); });
  if (dragonState && dragonState.cart && dragonState.cart.exhaust) updateExhaust(dragonState.cart.exhaust, dt);

  // Schwarze Löcher drehen sich immer weiter (auch im Intro/Game-Over)
  blackHoleVisuals.forEach((bh) => {
    bh.ring.rotation.z += dt * 0.6;
    bh.ring2.rotation.y += dt * 0.9;
  });
  // Planeten drehen sich langsam um sich selbst
  planetMeshes.forEach((p) => {
    p.mesh.rotation.y += p.spin * dt;
  });
  // Haie kreisen im Meer-Level langsam an der Wasseroberfläche
  if (currentPlaceKey === 'ocean') {
    swimmers.forEach((sw) => {
      sw.angle += sw.speed * dt;
      const x = sw.cx + Math.cos(sw.angle) * sw.radius;
      const z = sw.cz + Math.sin(sw.angle) * sw.radius;
      sw.mesh.position.set(x, sw.y, z);
      sw.mesh.rotation.y = -sw.angle + Math.PI / 2; // Nase in Schwimmrichtung
    });
  }
  // Tunnel-Neonringe pulsieren/wechseln farblich durch (nur jeden 3. Frame, ohne Allokationen)
  if (frameCount % 3 === 0) {
    const now = performance.now();
    tunnelRings.forEach((tr) => {
      const t = (now / 600 + tr.colorIndex) % tr.palette.length;
      const idx = Math.floor(t);
      const frac = t - idx;
      _ringC1.setHex(tr.palette[idx]);
      _ringC2.setHex(tr.palette[(idx + 1) % tr.palette.length]);
      tr.mat.color.copy(_ringC1).lerp(_ringC2, frac);
      tr.mat.emissive.copy(tr.mat.color);
    });
  }

  if (!gameOver && falling) {
    // Die Bahn ist entgleist und faellt endgueltig ins dunkle All
    fallElapsed += dt;
    fallVelocity.y -= 240 * dt; // zieht die Bahn ins Leere
    cartGroup.position.addScaledVector(fallVelocity, dt);
    cartGroup.rotation.x += 2.4 * dt;
    cartGroup.rotation.z += 1.6 * dt;

    const desiredCamPos = cartGroup.position.clone().add(new THREE.Vector3(0, 18, 42));
    camera.position.lerp(desiredCamPos, 1 - Math.pow(0.001, dt));
    camera.up.set(0, 1, 0);
    camera.lookAt(cartGroup.position);

    if (cartFlame) cartFlame.material.opacity = 0;

    if (fallElapsed > 2.5) finalizeDerail();
  } else if (!gameOver) {
    let sample, cartPos;

    if (inGondola && gondolaInfo) {
      // Die Gondel hat vollstaendig die Kontrolle: Spieler-Eingaben wirken hier nicht
      const gapDist = gondolaInfo.exitDist - gondolaInfo.entryDist;
      const crossDuration = Math.max(1, gapDist / (CABLECAR_SPEED / 3.6));
      gondolaProgress = Math.min(1, gondolaProgress + dt / crossDuration);

      const interpDist = THREE.MathUtils.lerp(gondolaInfo.entryDist, gondolaInfo.exitDist, gondolaProgress);
      sample = sampleTrackAt(interpDist, playerIdx);
      cartPos = sample.position.clone().addScaledVector(sample.up, 1.1);
      cartGroup.position.copy(cartPos);
      const gm = new THREE.Matrix4().makeBasis(sample.right, sample.up, sample.forward.clone().multiplyScalar(-1));
      cartGroup.quaternion.setFromRotationMatrix(gm);

      gondolaInfo.box.position.copy(sample.position);
      gondolaInfo.box.quaternion.copy(cartGroup.quaternion);
      if (cartFlame) cartFlame.material.opacity = 0;

      if (gondolaProgress >= 1) {
        inGondola = false;
        distanceTraveled = gondolaInfo.exitDist;
        speedKmh = CABLECAR_SPEED; // automatisches Abladen: faehrt mit Seilbahntempo weiter
        gondolaInfo.box.position.copy(gondolaInfo.entryPos);
        gondolaInfo.box.quaternion.copy(gondolaInfo.entryQuat);
      }
    } else {
      // speed control (nur während ein Rennen läuft)
      if (raceActive) {
        if (keys.up) {
          speedKmh += ACCEL * dt;
        } else if (keys.down) {
          speedKmh -= DECEL * dt;
        } else {
          speedKmh -= FRICTION * dt; // rollt selbstständig langsamer, sobald ↑ losgelassen wird
        }
        speedKmh = THREE.MathUtils.clamp(speedKmh, 0, MAX_SPEED);

        // Speed-Effekt: Sichtfeld weitet sich mit dem Tempo, zusaetzlicher Kick beim Gasgeben
        const fovSpeedFrac = THREE.MathUtils.clamp(speedKmh / MAX_SPEED, 0, 1);
        const targetFov = 70 + fovSpeedFrac * 9 + (keys.up ? 4 : 0);
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
        camera.updateProjectionMatrix();

        if (speedKmh > 0 && !started) {
          started = true;
          startTime = performance.now();
        }
        if (started) {
          scoreSeconds = Math.floor((performance.now() - startTime) / 1000);
        }

        // move along track
        const speedMs = speedKmh / 3.6;
        distanceTraveled += speedMs * dt;
        if (distanceTraveled >= totalLength) {
          flashWrap();
          finishRace(); // Rennrunde beendet -> auswerten (gewinnt/verliert, ggf. neues Rennen)
        }
      }

      sample = sampleTrackAt(distanceTraveled, playerIdx);
      cartPos = sample.position.clone().addScaledVector(sample.up, 1.1);
      cartGroup.position.copy(cartPos);
      const m = new THREE.Matrix4().makeBasis(sample.right, sample.up, sample.forward.clone().multiplyScalar(-1));
      cartGroup.quaternion.setFromRotationMatrix(m);

      // Szenenhintergrund/Nebel folgen dem Level-Thema; im "anderen Universum" gilt weiter das
      // spezielle Planeten-Universum (kein Nebel, damit man die Planeten sieht).
      const altRanges = getAltUniverseRanges();
      const inAlt = isInsideRange(playerIdx.i, altRanges);
      scene.background = inAlt ? ALT_UNIVERSE_BG : themeBaseBg;
      scene.fog = inAlt ? null : themeFog;

      // Heckdüse: zündet/leuchtet, sobald Gas gegeben wird (Pfeiltaste hoch)
      if (cartFlame) {
        cartFlame.material.opacity = (raceActive && keys.up) ? 0.9 : 0.0;
        const s = keys.up ? 1 + Math.random() * 0.3 : 0.4;
        cartFlame.scale.set(s, 1, s);
      }

      // Triebwerks-Partikel: Abgas-/Funken-Trail hinter dem Fahrzeug beim Beschleunigen
      if (raceActive && keys.up && playerCartBuilt && playerCartBuilt.exhaust) {
        const speedFrac = THREE.MathUtils.clamp(speedKmh / MAX_SPEED, 0, 1);
        const backward = sample.forward.clone().multiplyScalar(-1);
        const origin = cartPos.clone().addScaledVector(sample.up, 0.3).addScaledVector(sample.forward, -2.7);
        spawnExhaust(playerCartBuilt.exhaust, origin, backward, speedFrac, 2 + Math.round(speedFrac * 4));
      }

      if (raceActive) {
        // In die Seilbahn-Gondel einsteigen, sobald der Eintrittspunkt erreicht ist
        if (gondolaInfo && distanceTraveled >= gondolaInfo.entryDist && distanceTraveled < gondolaInfo.exitDist) {
          inGondola = true;
          gondolaProgress = 0;
          distanceTraveled = gondolaInfo.entryDist;
        }

        // Entgleisungs-Regel: mehr als 100 km/h ueber dem Limit UND in einer Kurve -> Absturz.
        currentLimit = getCurrentLimit(distanceTraveled);
        const curveRanges = getCurveRanges();
        const dangerouslyFast = speedKmh > currentLimit + OVERSPEED_MARGIN;
        if (dangerouslyFast && isInsideCurve(playerIdx.i, curveRanges)) {
          startFalling();
        }
      }
    }

    // Gegner aktualisieren: im Duell nur das Drachenauto, sonst die vier KI (nur während des Rennens)
    if (raceActive) {
      if (inDuel) updateAiState(dragonState, dt);
      else aiStates.forEach((s) => updateAiState(s, dt));
    }

    // camera follow (third person, banks/flips with track) - ohne Pro-Frame-Allokationen
    _camOffset.copy(sample.forward).multiplyScalar(-13).addScaledVector(sample.up, 4);
    _camPos.copy(cartPos).add(_camOffset);
    camera.position.lerp(_camPos, 1 - Math.pow(0.00005, dt));
    camera.up.copy(sample.up);
    _lookTarget.copy(cartPos).addScaledVector(sample.forward, 6);
    camera.lookAt(_lookTarget);

    // HUD/Rangliste/Minimap nur alle 3 Frames aktualisieren (spart DOM-/Canvas-Arbeit)
    if (frameCount % 3 === 0) updateHUD();
  }

  renderer.render(scene, camera);
}

function updateHUD() {
  document.getElementById('speedVal').textContent = Math.round(speedKmh);
  document.getElementById('limitVal').textContent = currentLimit;
  document.getElementById('scoreVal').textContent = trophies; // Score-Panel zeigt jetzt Pokale
  aiStates.forEach((s, i) => {
    const el = document.getElementById('aiSpeedVal' + (i + 1));
    if (el) el.textContent = Math.round(s.speedKmh);
  });

  // Level-/Welt-Anzeige
  document.getElementById('levelVal').textContent = inDuel ? '★' : level;
  document.getElementById('worldVal').textContent = inDuel ? DUEL_THEME.name : LEVEL_THEMES[Math.min(level, LEVEL_THEMES.length) - 1].name;

  updateLeaderboard();
  drawMinimap();
}

/* Live-Rangliste: sortiert die Renn-Teilnehmer nach zurückgelegter Gesamtstrecke. */
function updateLeaderboard() {
  const entries = [
    { meta: RACER_META[0], rankDist: playerLap * totalLength + distanceTraveled, speed: speedKmh, isPlayer: true }
  ];
  if (inDuel) {
    entries.push({ meta: { name: '🐉 Drache', color: '#cc2200' }, rankDist: dragonState.lap * totalLength + dragonState.distanceTraveled, speed: dragonState.speedKmh, isPlayer: false });
  } else {
    aiStates.forEach((s, i) => {
      entries.push({ meta: RACER_META[i + 1], rankDist: s.lap * totalLength + s.distanceTraveled, speed: s.speedKmh, isPlayer: false });
    });
  }
  entries.sort((a, b) => b.rankDist - a.rankDist);

  const html = entries.map((e, i) =>
    `<div class="rankRow${e.isPlayer ? ' me' : ''}">` +
      `<span class="rankPos">${i + 1}.</span>` +
      `<span class="rankDot" style="background:${e.meta.color}"></span>` +
      `<span class="rankName">${e.meta.name}</span>` +
      `<span class="rankSpeed">${Math.round(e.speed)} km/h</span>` +
    `</div>`
  ).join('');
  document.getElementById('rankList').innerHTML = html;
}
