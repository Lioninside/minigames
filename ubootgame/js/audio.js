/* ================= AUDIO =================
   Alle Geräusche werden per Web Audio API synthetisiert - keine externen Dateien nötig.
   Kernstück ist der Motorsound, dessen Tonhöhe und Lautstärke der Geschwindigkeit folgen;
   grosse Schiffe klingen tiefer, das Segelschiff bekommt statt eines Motors Wind und Wellen. */

const AudioEngine = (function () {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;

  // Motorschleife
  let engineOsc, engineSub, engineFilter, engineGain;
  // Wind-/Wasserrauschen (Segelschiff, Fahrtwind, Flug)
  let airNoise, airFilter, airGain;
  // Ruhiges Meeresrauschen im Hintergrund
  let seaGain;

  let started = false;
  let currentProfile = null;

  /* Rauschpuffer für Wind, Wasser und Explosionen (zwei Sekunden, in Schleife nutzbar). */
  function makeNoiseBuffer() {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function loopingNoise(filterType, freq, q) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    if (q !== undefined) filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
    return { src, filter, gain };
  }

  function init() {
    if (started) return;
    ctx = THREE.AudioContext.getContext();
    started = true;

    master = ctx.createGain();
    master.gain.value = SaveSystem.volume;
    master.connect(ctx.destination);

    noiseBuffer = makeNoiseBuffer();

    // --- Motor: tiefer Sägezahn plus Sub-Sinus, durch ein Tiefpassfilter gedämpft ---
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 400;
    engineFilter.Q.value = 3;

    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 40;
    engineOsc.connect(engineFilter);
    engineOsc.start();

    engineSub = ctx.createOscillator();
    engineSub.type = 'sine';
    engineSub.frequency.value = 20;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.7;
    engineSub.connect(subGain);
    subGain.connect(engineFilter);
    engineSub.start();

    engineFilter.connect(engineGain);
    engineGain.connect(master);

    // --- Fahrtwind / Segelrauschen ---
    const air = loopingNoise('bandpass', 500, 0.8);
    airNoise = air.src; airFilter = air.filter; airGain = air.gain;

    // --- Grundrauschen des Meeres ---
    const sea = loopingNoise('lowpass', 420, 0.6);
    seaGain = sea.gain;
    seaGain.gain.value = 0.035;
  }

  function applyMasterVolume() {
    if (master) master.gain.setTargetAtTime(SaveSystem.volume, ctx.currentTime, 0.05);
  }

  /* Motorprofil des aktuell gefahrenen Fahrzeugs (grösser = tiefer, Segler = ohne Motor). */
  function setProfile(profile) {
    currentProfile = profile;
    if (!started) return;
    engineOsc.type = profile.engineWave || 'sawtooth';
  }

  /* Wird jeden Frame aufgerufen: speedFrac 0..1, flying = Wasserflugzeug in der Luft. */
  function update(speedFrac, flying) {
    if (!started || !currentProfile) return;
    const t = ctx.currentTime;
    const ramp = 0.09;
    const p = currentProfile;
    const frac = THREE.MathUtils.clamp(speedFrac, 0, 1);

    if (p.silentEngine) {
      // Segelschiff: kein Motor, dafür deutlich hörbarer Wind in den Segeln
      engineGain.gain.setTargetAtTime(0, t, ramp);
      airFilter.frequency.setTargetAtTime(380 + frac * 900, t, ramp);
      airGain.gain.setTargetAtTime(0.05 + frac * 0.16, t, ramp);
      return;
    }

    // Im Flug wechselt der Klang zu einem helleren, schnelleren Propellermotor
    const base = flying ? p.enginePitch * 2.4 : p.enginePitch;
    const freq = base + frac * (flying ? 190 : 95);
    engineOsc.frequency.setTargetAtTime(freq, t, ramp);
    engineSub.frequency.setTargetAtTime(freq * 0.5, t, ramp);
    engineFilter.frequency.setTargetAtTime(280 + frac * (flying ? 2600 : 1500), t, ramp);
    engineGain.gain.setTargetAtTime(0.012 + frac * p.engineVolume, t, ramp);

    airFilter.frequency.setTargetAtTime(450 + frac * (flying ? 2200 : 1100), t, ramp);
    airGain.gain.setTargetAtTime(frac * (flying ? 0.11 : 0.05), t, ramp);
  }

  function silence() {
    if (!started) return;
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(0, t, 0.15);
    airGain.gain.setTargetAtTime(0, t, 0.15);
  }

  /* --------- Einmalige Effekte --------- */

  function burst(opts) {
    if (!started) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType || 'lowpass';
    filter.frequency.setValueAtTime(opts.startFreq, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.endFreq), t + opts.duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(opts.volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + opts.duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + opts.duration + 0.05);
  }

  function tone(freq, endFreq, duration, volume, type) {
    if (!started) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  return {
    init,
    setProfile,
    update,
    silence,
    applyMasterVolume,
    get ready() { return started; },

    explosion(size) {
      const s = size || 1;
      burst({ startFreq: 900 * s, endFreq: 45, duration: 1.1 * s, volume: 0.42, filterType: 'lowpass' });
      tone(120 * s, 28, 0.7 * s, 0.3, 'sine');
    },
    underwaterExplosion(size) {
      const s = size || 1;
      burst({ startFreq: 420 * s, endFreq: 35, duration: 1.5 * s, volume: 0.34, filterType: 'lowpass' });
      tone(70, 22, 1.0, 0.26, 'sine');
    },
    cannon() {
      burst({ startFreq: 1800, endFreq: 120, duration: 0.32, volume: 0.3, filterType: 'lowpass' });
      tone(190, 55, 0.22, 0.18, 'square');
    },
    bombDrop() { tone(700, 180, 0.5, 0.1, 'triangle'); },
    torpedoLaunch() { burst({ startFreq: 1400, endFreq: 300, duration: 0.55, volume: 0.14, filterType: 'bandpass' }); },
    radarPing() { tone(1320, 1320, 0.14, 0.07, 'sine'); },
    warning() { tone(880, 620, 0.3, 0.12, 'square'); },
    coin() { tone(1046, 1568, 0.09, 0.05, 'triangle'); },
    menuClick() { tone(520, 760, 0.07, 0.07, 'triangle'); },
    purchase() { tone(660, 1320, 0.22, 0.1, 'triangle'); }
  };
})();
