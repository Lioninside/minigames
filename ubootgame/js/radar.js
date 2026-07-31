/* ================= RADAR =================
   2D-Rundsichtanzeige unten links. Zeigt nur die nähere Umgebung (begrenzte Reichweite), damit
   Gefahren rechtzeitig, aber nicht beliebig weit im Voraus erkennbar sind.
   Das Radar ist die Hauptquelle für Unterwasserminen und getauchte U-Boote. */

const Radar = (function () {
  const RANGE = 140;          // Meter
  let canvas = null, ctx = null, size = 0, center = 0, scale = 1;
  let sweep = 0;
  let pingTimer = 0;

  function init() {
    canvas = document.getElementById('radar');
    ctx = canvas.getContext('2d');
    size = canvas.width;
    center = size / 2;
    scale = (size / 2 - 8) / RANGE;
  }

  /* Weltkoordinaten -> Radarkoordinaten (immer aus Sicht des Spielers, Bug zeigt nach oben). */
  function project(dx, dz, heading) {
    const cos = Math.cos(-heading), sin = Math.sin(-heading);
    // Rotation in die Fahrzeug-Ausrichtung; -Z (voraus) soll nach oben zeigen
    const rx = dx * cos - dz * sin;
    const rz = dx * sin + dz * cos;
    return { x: center + rx * scale, y: center + rz * scale };
  }

  function inRange(dx, dz) { return dx * dx + dz * dz <= RANGE * RANGE; }

  function update(dt, player) {
    if (!ctx) return;
    sweep += dt * 1.5;
    pingTimer += dt;
    if (pingTimer > 2.4) { pingTimer = 0; AudioEngine.radarPing(); }

    ctx.clearRect(0, 0, size, size);

    // Hintergrund
    ctx.beginPath();
    ctx.arc(center, center, center - 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(4, 26, 22, 0.85)';
    ctx.fill();

    // Entfernungsringe
    ctx.strokeStyle = 'rgba(110, 220, 170, 0.22)';
    ctx.lineWidth = 1;
    for (let r = 1; r <= 3; r++) {
      ctx.beginPath();
      ctx.arc(center, center, (center - 6) * (r / 3), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(center, 6); ctx.lineTo(center, size - 6);
    ctx.moveTo(6, center); ctx.lineTo(size - 6, center);
    ctx.stroke();

    // umlaufender Suchstrahl
    const sweepAngle = sweep % (Math.PI * 2);
    const grad = ctx.createRadialGradient(center, center, 0, center, center, center - 5);
    grad.addColorStop(0, 'rgba(120, 255, 200, 0.30)');
    grad.addColorStop(1, 'rgba(120, 255, 200, 0)');
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, center - 5, sweepAngle - 0.5, sweepAngle);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    const px = player.position.x, pz = player.position.z;

    // --- Unterwasserminen (kleiner Kreis) und Oberflächenminen (Ring) ---
    Mines.all.forEach(m => {
      if (!m.active) return;
      const dx = m.x - px, dz = m.z - pz;
      if (!inRange(dx, dz)) return;
      const p = project(dx, dz, player.heading);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
      if (m.underwater) {
        ctx.fillStyle = '#ff6b5c';
        ctx.fill();
      } else {
        ctx.strokeStyle = '#ffc46b';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    });

    // --- Feindliche U-Boote (längliches Symbol) ---
    Enemies.subs.forEach(s => {
      if (!s.active) return;
      const dx = s.x - px, dz = s.z - pz;
      if (!inRange(dx, dz)) return;
      const p = project(dx, dz, player.heading);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(s.heading - player.heading);
      ctx.fillStyle = s.state === 'aiming' ? '#ff4d4d' : '#ff9a3c';
      ctx.fillRect(-2, -5.5, 4, 11);
      ctx.restore();
    });

    // --- Torpedos (kurzer Strich in Fahrtrichtung) ---
    Enemies.torpedoes.forEach(t => {
      if (!t.active) return;
      const dx = t.pos.x - px, dz = t.pos.z - pz;
      if (!inRange(dx, dz)) return;
      const p = project(dx, dz, player.heading);
      const ang = Math.atan2(t.dir.x, -t.dir.z) - player.heading;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.strokeStyle = '#fff45c';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, 4); ctx.lineTo(0, -4);
      ctx.stroke();
      ctx.restore();
    });

    // --- Spieler (Dreieck in der Mitte, Spitze nach oben = voraus) ---
    ctx.save();
    ctx.translate(center, center);
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3.5);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fillStyle = '#8ef7c8';
    ctx.fill();
    ctx.restore();

    // Rahmen
    ctx.beginPath();
    ctx.arc(center, center, center - 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(140, 240, 200, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  return { init, update, RANGE };
})();
