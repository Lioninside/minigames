/* ================= UMGEBUNGSGERÄUSCHE =================
   Klangkulissen ohne Audiodateien (WebAudio, alles synthetisch), gemischt nach Ort und Uhrzeit:
     Meer      – Brandung (gefiltertes Rauschen mit langsamer Welle) und Möwenrufe am Strand
     Stadt     – tiefes Verkehrsrauschen, lauter, je mehr Autos in der Nähe fahren
     Stimmen   – Gemurmel, wenn viele Leute in der Nähe sind (Piazza, Haltestellen, Cafés)
     Vögel     – Zwitschern in Parks und am Hügel (tagsüber), Grillen in der Nacht
     U-Bahn    – Brummen im Untergrund
   Ein einziger Rausch-Puffer (2 s) wird von allen Kanälen geteilt. Taste G schaltet alles aus. */

const AMB = { on: true, ready: false, ctx: null, master: null, ch: {}, t: 0, chirpT: 2, gullT: 4, cricketT: 0 };

function ambInit() {
  if (AMB.ready) return true;
  const c = audioCtx(); if (!c) return false;
  AMB.ctx = c;
  const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  let b = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.6 + b * 2.0; }
  AMB.master = c.createGain(); AMB.master.gain.value = AMB.on ? 0.55 : 0; AMB.master.connect(c.destination);
  const chan = (type, f, q, rate) => {
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = rate || 1;
    src.loopStart = Math.random(); src.loopEnd = 2;
    const flt = c.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const g = c.createGain(); g.gain.value = 0;
    src.connect(flt); flt.connect(g); g.connect(AMB.master);
    src.start(0, Math.random() * 1.5);
    return { src, flt, g, lvl: 0 };
  };
  AMB.ch.sea = chan('lowpass', 520, 0.6, 0.9);
  AMB.ch.city = chan('lowpass', 170, 0.9, 0.7);
  AMB.ch.voices = chan('bandpass', 850, 1.6, 1.15);
  AMB.ch.ug = chan('lowpass', 95, 1.2, 0.6);
  AMB.ready = true;
  return true;
}
function ambToggle() {
  AMB.on = !AMB.on;
  if (AMB.master) AMB.master.gain.setTargetAtTime(AMB.on ? 0.55 : 0, AMB.ctx.currentTime, 0.2);
  return AMB.on;
}
function ambSet(ch, v) {
  if (Math.abs(v - ch.lvl) < 0.002) return;
  ch.lvl = v; ch.g.gain.setTargetAtTime(v, AMB.ctx.currentTime, 0.35);
}
/* kurzer synthetischer Ruf: Zwitschern, Möwe, Grille */
function ambCall(kind, vol) {
  const c = AMB.ctx, now = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  g.connect(AMB.master); o.connect(g);
  if (kind === 'chirp') {
    o.type = 'sine'; const f = 2800 + Math.random() * 1800, n = 2 + (Math.random() * 3 | 0);
    for (let k = 0; k < n; k++) {
      const t = now + k * 0.11;
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (1.25 + Math.random() * 0.3), t + 0.06);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    }
    o.start(now); o.stop(now + n * 0.11 + 0.1);
  } else if (kind === 'gull') {
    o.type = 'sawtooth';
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 2.5;
    o.disconnect(); o.connect(bp); bp.connect(g);
    const n = 2 + (Math.random() * 3 | 0);
    for (let k = 0; k < n; k++) {
      const t = now + k * 0.32, f = 1150 + Math.random() * 250;
      o.frequency.setValueAtTime(f * 1.35, t); o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 0.25);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.27);
    }
    o.start(now); o.stop(now + n * 0.32 + 0.1);
  } else {
    o.type = 'sine'; o.frequency.value = 4300 + Math.random() * 500;
    for (let k = 0; k < 6; k++) { const t = now + k * 0.045; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035); }
    o.start(now); o.stop(now + 0.35);
  }
}

/* pro Bild: Pegel nach Umgebung nachführen (nur alle 0,25 s, Pegel gleiten weich) */
function updateAmbience(dt) {
  if (!GAME.started || !AMB.ready && !ambInit()) return;
  AMB.t -= dt;
  if (!AMB.on) return;
  const night = SKY.night, day = 1 - night;
  const inside = GAME.mode !== 'world', ug = !!P.underground;
  const damp = inside ? 0.18 : 1;
  if (AMB.t <= 0) {
    AMB.t = 0.25;
    const x = P.x, z = P.z;
    const seaD = coastX(z) - x;
    const sea = ug ? 0 : (1 - smooth(60, 420, seaD)) * damp;
    // Autos in der Nähe
    let cars = 0;
    if (!ug) for (const c of TRAFFIC.cars) { const d2 = (c.x - x) ** 2 + (c.z - z) ** 2; if (d2 < 120 * 120) cars += 1 - Math.sqrt(d2) / 120; }
    const city = ug ? 0 : Math.min(1, 0.08 + cars * 0.09) * damp * (0.55 + 0.45 * day);
    const people = (LIFE.stats.near || 0) + (LIFE.stats.far || 0) * 0.25;
    const voices = Math.min(1, people / 26) * (inside ? 0.1 : 1);
    ambSet(AMB.ch.sea, sea * 0.32);
    // Brandung schwillt langsam an und ab
    AMB.ch.sea.flt.frequency.setTargetAtTime(420 + 260 * (0.5 + 0.5 * Math.sin(performance.now() / 1000 * 0.55)), AMB.ctx.currentTime, 0.4);
    ambSet(AMB.ch.city, city * 0.38);
    ambSet(AMB.ch.voices, voices * 0.07);
    ambSet(AMB.ch.ug, ug ? 0.25 : 0);
    // Rufe: Vögel im Grünen (tags), Grillen (nachts), Möwen am Meer
    const q = inside || ug ? '' : quarterAt(x, z);
    const green = (q === 'Hochschulhügel' || q === 'Berge') ? 1 : (ROADS.parks.some(pk => Math.hypot(pk.cell.cx - x, pk.cell.cz - z) < 90) ? 1 : 0.25);
    AMB.green = green; AMB.sea = sea;
  }
  if (inside || ug) return;
  AMB.chirpT -= dt; AMB.gullT -= dt; AMB.cricketT -= dt;
  if (AMB.chirpT <= 0) { AMB.chirpT = 0.6 + Math.random() * 2.5 / Math.max(0.2, AMB.green || 0.2); if (day > 0.5 && Math.random() < (AMB.green || 0) * 0.9) ambCall('chirp', 0.025 + Math.random() * 0.02); }
  if (AMB.gullT <= 0) { AMB.gullT = 3 + Math.random() * 6; if (day > 0.4 && Math.random() < (AMB.sea || 0) * 1.4) ambCall('gull', 0.03 * (AMB.sea || 0) + 0.01); }
  if (AMB.cricketT <= 0) { AMB.cricketT = 0.4 + Math.random() * 0.9; if (night > 0.6 && Math.random() < (AMB.green || 0) * 0.8) ambCall('cricket', 0.012); }
}
