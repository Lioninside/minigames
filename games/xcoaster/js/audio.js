/* ================= AUDIO =================
   Motorsound des Spielers und der KI-Gegner, synthetisiert über die Web Audio API. */

function makeDriveCurve(amount) {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}

function initAudio() {
  if (audioCtx) return;
  // THREE.AudioContext.getContext() liefert den von THREE.AudioListener/PositionalAudio
  // intern genutzten, geteilten Context -> Player-Sound und KI-Sounds landen im selben Graph.
  audioCtx = THREE.AudioContext.getContext();
  const master = audioCtx.createGain();
  master.gain.value = 1;
  master.connect(audioCtx.destination);

  // Weltraum-Echo: kurzes, ruecksgekoppeltes Delay verleiht allem etwas Weite/Hall
  spaceDelay = audioCtx.createDelay(1.0);
  spaceDelay.delayTime.value = 0.24;
  const spaceFeedback = audioCtx.createGain();
  spaceFeedback.gain.value = 0.33;
  spaceWet = audioCtx.createGain();
  spaceWet.gain.value = 0.25;
  spaceDelay.connect(spaceFeedback);
  spaceFeedback.connect(spaceDelay);
  spaceDelay.connect(spaceWet);
  spaceWet.connect(master);

  // Elektrischer Antrieb: Saegezahn-Traeger wird von einem Rechteck ringmoduliert
  // (klassischer robotischer/elektrischer Klang), danach angezerrt fuer mehr Biss.
  engineGain = audioCtx.createGain();
  engineGain.gain.value = 0;

  engineFilter = audioCtx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.Q.value = 2.4;
  engineFilter.frequency.value = 500;

  driveShaper = audioCtx.createWaveShaper();
  driveShaper.curve = makeDriveCurve(3.2);
  driveShaper.oversample = '2x';

  ringGain = audioCtx.createGain();
  ringGain.gain.value = 0; // wird komplett von modOsc angesteuert -> echte Ringmodulation

  carrierOsc = audioCtx.createOscillator();
  carrierOsc.type = 'sawtooth';
  carrierOsc.frequency.value = 90;
  carrierOsc.connect(ringGain);
  carrierOsc.start();

  modOsc = audioCtx.createOscillator();
  modOsc.type = 'square';
  modOsc.frequency.value = 90 * 2.01; // leicht verstimmtes Verhaeltnis -> metallisch/inharmonisch
  modOsc.connect(ringGain.gain);
  modOsc.start();

  // leichtes elektrisches Vibrato auf dem Traeger
  const vibrato = audioCtx.createOscillator();
  vibrato.type = 'sine';
  vibrato.frequency.value = 6.5;
  const vibratoGain = audioCtx.createGain();
  vibratoGain.gain.value = 4;
  vibrato.connect(vibratoGain);
  vibratoGain.connect(carrierOsc.detune);
  vibrato.start();

  subOsc = audioCtx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.value = 34;
  const subGain = audioCtx.createGain();
  subGain.gain.value = 0.6;
  subOsc.connect(subGain);
  subOsc.start();

  ringGain.connect(driveShaper);
  driveShaper.connect(engineFilter);
  subGain.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(master);
  engineGain.connect(spaceDelay);

  // Fahrtwind: bandpassgefiltertes Rauschen, Cutoff folgt dem Tempo ("Weltraum-Wind")
  const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  windNoise = audioCtx.createBufferSource();
  windNoise.buffer = noiseBuffer;
  windNoise.loop = true;

  windFilter = audioCtx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.Q.value = 0.7;
  windFilter.frequency.value = 300;

  windGain = audioCtx.createGain();
  windGain.gain.value = 0;

  windNoise.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(master);
  windNoise.start();

  // Shimmer: drei leise, hoch liegende Sinus-Toene mit langsamem Tremolo fuer eine
  // schwebende "unendliches All"-Atmosphaere, unabhaengig vom Tempo immer leise praesent.
  shimmerGain = audioCtx.createGain();
  shimmerGain.gain.value = 0.018;
  shimmerGain.connect(spaceDelay);
  shimmerGain.connect(master);
  [1046.5, 1568, 2093].forEach((freq, i) => {
    const o = audioCtx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = audioCtx.createGain();
    g.gain.value = 0.4;
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.05 + i * 0.03;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    o.connect(g);
    g.connect(shimmerGain);
    o.start();
    lfo.start();
  });

  // KI-Motorsounds: jede KI-Achterbahn bekommt ihren eigenen, simpleren elektrischen Motorton,
  // raeumlich an ihren Wagen gehaengt -> man hoert automatisch, ob ein Gegner links/rechts/
  // vor/hinter einem ist, ganz ohne Hand-Panning.
  audioListener = new THREE.AudioListener();
  camera.add(audioListener);
  aiStates.forEach((s) => { s.engine = createAiEngine(s); });
}

/* Baut den vereinfachten, ringmodulierten Motorton einer KI-Achterbahn und haengt ihn als
   raeumliches (3D-positioniertes) Audio-Objekt an ihren Wagen. */
function createAiEngine(state) {
  const posAudio = new THREE.PositionalAudio(audioListener);
  posAudio.setRefDistance(18);
  posAudio.setRolloffFactor(1.6);
  posAudio.setDistanceModel('inverse');
  state.cartGroup.add(posAudio);

  const gain = audioCtx.createGain();
  gain.gain.value = 0;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 1.8;
  filter.frequency.value = 400;

  const ring = audioCtx.createGain();
  ring.gain.value = 0; // wird komplett vom mod-Oszillator angesteuert -> Ringmodulation

  const carrier = audioCtx.createOscillator();
  carrier.type = 'sawtooth';
  carrier.frequency.value = 80;
  carrier.connect(ring);
  carrier.start();

  const mod = audioCtx.createOscillator();
  mod.type = 'square';
  mod.frequency.value = 80 * 1.98;
  mod.connect(ring.gain);
  mod.start();

  ring.connect(filter);
  filter.connect(gain);
  posAudio.setNodeSource(gain);

  return { carrier, mod, gain, filter, posAudio };
}

/* Aktualisiert Tonhoehe/Lautstaerke des KI-Motortons anhand ihrer aktuellen Geschwindigkeit
   (normiert auf das aktuell geltende, levelabhaengige KI-Hoechsttempo aiMaxSpeed). */
function updateAiEngineSound(state) {
  if (!state.engine) return;
  const t = audioCtx.currentTime;
  const ramp = 0.08;
  const speedFrac = THREE.MathUtils.clamp(state.speedKmh / aiMaxSpeed, 0, 1);
  const boost = state.throttle ? 0.03 : 0;
  const freq = 65 + speedFrac * 210;
  state.engine.carrier.frequency.setTargetAtTime(freq, t, ramp);
  state.engine.mod.frequency.setTargetAtTime(freq * 1.98, t, ramp);
  state.engine.filter.frequency.setTargetAtTime(350 + speedFrac * 2600, t, ramp);
  state.engine.gain.gain.setTargetAtTime(0.045 + speedFrac * 0.12 + boost, t, ramp);
}

/* Aktualisiert den elektrischen Antriebssound + Fahrtwind anhand der aktuellen
   Spieler-Geschwindigkeit (0..MAX_SPEED). Waehrend des Falls ins All oder im
   Game-Over-Bildschirm klingt der Motor schnell aus (nur der Weltraum-Shimmer bleibt). */
function updateEngineSound() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const ramp = 0.08;

  const silent = gameOver || falling;
  const speedFrac = silent ? 0 : THREE.MathUtils.clamp(speedKmh / MAX_SPEED, 0, 1);
  const thrustBoost = (!silent && keys.up) ? 0.06 : 0;

  const carrierFreq = 70 + speedFrac * 260;
  carrierOsc.frequency.setTargetAtTime(carrierFreq, t, ramp);
  modOsc.frequency.setTargetAtTime(carrierFreq * 2.01, t, ramp);
  subOsc.frequency.setTargetAtTime(28 + speedFrac * 46, t, ramp);

  engineFilter.frequency.setTargetAtTime(400 + speedFrac * 3200, t, ramp);
  engineGain.gain.setTargetAtTime(silent ? 0 : 0.05 + speedFrac * 0.16 + thrustBoost, t, ramp);

  windFilter.frequency.setTargetAtTime(350 + speedFrac * 3200, t, ramp);
  windGain.gain.setTargetAtTime(silent ? 0 : 0.02 + speedFrac * 0.1, t, ramp);

  spaceWet.gain.setTargetAtTime(silent ? 0.15 : 0.25 + speedFrac * 0.15, t, 0.3);
}
