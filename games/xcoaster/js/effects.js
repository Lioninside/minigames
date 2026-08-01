/* ================= EFFEKTE =================
   Triebwerks-Partikel (Abgas- und Funkenspur) als recycelter Punkte-Pool. */

/* ================= TRIEBWERKS-PARTIKEL (Abgas-/Funken-Trail) ================= */

/* Jedes Fahrzeug bekommt einen eigenen kleinen Partikel-Pool, aus dem beim Beschleunigen
   fortlaufend Punkte "verbraucht" (recycelt) werden - kein externes Partikelsystem noetig,
   nur ein THREE.Points mit manuell animierten Positionen/Farben. */
function createExhaustParticles() {
  const maxP = 140;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(maxP * 3);
  const colors = new Float32Array(maxP * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.55, vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return {
    points, maxP, cursor: 0,
    velocities: new Float32Array(maxP * 3),
    life: new Float32Array(maxP),
    maxLife: new Float32Array(maxP),
    baseColor: new THREE.Color(0xff9d2e)
  };
}

/* Spawnt einen kleinen Partikel-Schub an der angegebenen Weltposition, mit Geschwindigkeit
   entgegen der Flugrichtung -> hinterlaesst einen Abgas-/Funken-Trail hinter dem Fahrzeug. */
function spawnExhaust(sys, originPos, backward, speedFrac, count) {
  const posAttr = sys.points.geometry.attributes.position;
  for (let k = 0; k < count; k++) {
    const i = sys.cursor;
    sys.cursor = (sys.cursor + 1) % sys.maxP;
    const speed = 3 + speedFrac * 9;
    posAttr.array[i * 3] = originPos.x;
    posAttr.array[i * 3 + 1] = originPos.y;
    posAttr.array[i * 3 + 2] = originPos.z;
    sys.velocities[i * 3] = backward.x * speed + (Math.random() - 0.5) * 1.2;
    sys.velocities[i * 3 + 1] = backward.y * speed + (Math.random() - 0.5) * 1.2;
    sys.velocities[i * 3 + 2] = backward.z * speed + (Math.random() - 0.5) * 1.2;
    sys.life[i] = 0;
    sys.maxLife[i] = 0.3 + Math.random() * 0.3;
  }
}

/* Bewegt und verblasst alle aktiven Partikel eines Trails (Farbe faedet Richtung Schwarz, was
   dank additivem Blending wie natuerliches Verloeschen wirkt, ganz ohne Alpha-Attribut/Shader). */
function updateExhaust(sys, dt) {
  const posAttr = sys.points.geometry.attributes.position;
  const colAttr = sys.points.geometry.attributes.color;
  for (let i = 0; i < sys.maxP; i++) {
    if (sys.life[i] >= sys.maxLife[i]) {
      colAttr.array[i * 3] = 0; colAttr.array[i * 3 + 1] = 0; colAttr.array[i * 3 + 2] = 0;
      continue;
    }
    sys.life[i] += dt;
    posAttr.array[i * 3] += sys.velocities[i * 3] * dt;
    posAttr.array[i * 3 + 1] += sys.velocities[i * 3 + 1] * dt;
    posAttr.array[i * 3 + 2] += sys.velocities[i * 3 + 2] * dt;
    const t = THREE.MathUtils.clamp(1 - sys.life[i] / sys.maxLife[i], 0, 1);
    colAttr.array[i * 3] = sys.baseColor.r * t;
    colAttr.array[i * 3 + 1] = sys.baseColor.g * t;
    colAttr.array[i * 3 + 2] = sys.baseColor.b * t;
  }
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
}
