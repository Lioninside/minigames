/* ================= EFFEKTE =================
   Alle Partikel laufen über feste Pools (Object-Pooling): die Puffer werden einmal angelegt und
   danach nur noch recycelt - es entstehen im Spielverlauf keine neuen Geometrien oder Materialien.
   Kategorien: Feuer, Rauch, Gischt/Schaum, Blasen sowie einige Trümmerstücke als echte Meshes. */

const Effects = (function () {

  /* Runde, weich auslaufende Punktpartikel mit echter Transparenz je Partikel.
     Ein eigener Shader ist nötig, weil THREE.PointsMaterial nur eine globale Deckkraft kennt -
     tote Partikel liessen sich damit nicht sauber ausblenden. */
  const PARTICLE_VERT = `
    attribute vec3 pcolor;
    attribute float alpha;
    uniform float uSize;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vColor = pcolor;
      vAlpha = alpha;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = uSize * (320.0 / max(-mv.z, 0.001));
      gl_Position = projectionMatrix * mv;
    }
  `;

  const PARTICLE_FRAG = `
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      if (d > 0.5 || vAlpha <= 0.001) discard;
      float soft = smoothstep(0.5, 0.12, d);
      gl_FragColor = vec4(vColor, vAlpha * soft);
    }
  `;

  /* Ein Pool aus Punktpartikeln mit gemeinsamer Grösse und gemeinsamem Blending. */
  function ParticlePool(scene, opts) {
    const max = opts.count;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(max * 3);
    const colors = new Float32Array(max * 3);
    const alphas = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      uniforms: { uSize: { value: opts.size } },
      transparent: true,
      depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    this.points = points;
    this.max = max;
    this.cursor = 0;
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.gravity = opts.gravity || 0;
    this.drag = opts.drag !== undefined ? opts.drag : 0.6;
    this.floorY = opts.floorY;           // undefined = kein Boden
    this.baseAlpha = opts.opacity !== undefined ? opts.opacity : 0.95;
    this.positions = positions;
    this.colors = colors;
    this.alphas = alphas;
    // alle Partikel starten "tot"
    for (let i = 0; i < max; i++) this.life[i] = 1e9;
  }

  ParticlePool.prototype.spawn = function (pos, vel, color, life, spread) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const s = spread || 0;
    this.positions[i * 3] = pos.x + (Math.random() - 0.5) * s;
    this.positions[i * 3 + 1] = pos.y + (Math.random() - 0.5) * s;
    this.positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * s;
    this.vel[i * 3] = vel.x;
    this.vel[i * 3 + 1] = vel.y;
    this.vel[i * 3 + 2] = vel.z;
    this.colors[i * 3] = color.r;
    this.colors[i * 3 + 1] = color.g;
    this.colors[i * 3 + 2] = color.b;
    this.alphas[i] = this.baseAlpha;
    this.life[i] = 0;
    this.maxLife[i] = life;
  };

  ParticlePool.prototype.update = function (dt) {
    const damp = Math.pow(1 - this.drag, dt);
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] >= this.maxLife[i]) {
        this.alphas[i] = 0;
        continue;
      }
      this.life[i] += dt;
      const i3 = i * 3;
      this.vel[i3] *= damp;
      this.vel[i3 + 1] = (this.vel[i3 + 1] + this.gravity * dt) * damp;
      this.vel[i3 + 2] *= damp;
      this.positions[i3] += this.vel[i3] * dt;
      this.positions[i3 + 1] += this.vel[i3 + 1] * dt;
      this.positions[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.floorY !== undefined && this.positions[i3 + 1] < this.floorY) {
        this.positions[i3 + 1] = this.floorY;
        this.vel[i3 + 1] = 0;
      }
      // weiches Ausblenden statt Abdunkeln
      this.alphas[i] = this.baseAlpha * (1 - this.life[i] / this.maxLife[i]);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.pcolor.needsUpdate = true;
    this.points.geometry.attributes.alpha.needsUpdate = true;
  };

  ParticlePool.prototype.clear = function () {
    for (let i = 0; i < this.max; i++) {
      this.life[i] = 1e9;
      this.alphas[i] = 0;
    }
    this.points.geometry.attributes.alpha.needsUpdate = true;
  };

  /* --- Zustand des Moduls --- */
  let fire, smoke, foam, bubbles;
  let debris = [];
  let debrisCursor = 0;
  let shake = 0;

  const _v = new THREE.Vector3();
  const COL_FIRE = new THREE.Color(0xffb347);
  const COL_HOT = new THREE.Color(0xfff0c0);
  const COL_SMOKE = new THREE.Color(0x4a4a52);
  const COL_FOAM = new THREE.Color(0xdff0f6);
  const COL_BUBBLE = new THREE.Color(0xbfe4f2);

  function init(scene) {
    fire = new ParticlePool(scene, { count: 420, size: 2.4, additive: true, gravity: 7, drag: 0.75 });
    smoke = new ParticlePool(scene, { count: 360, size: 4.6, additive: false, opacity: 0.5, gravity: 2.2, drag: 0.55 });
    foam = new ParticlePool(scene, { count: 700, size: 1.15, additive: false, opacity: 0.85, gravity: -6, drag: 0.9 });
    bubbles = new ParticlePool(scene, { count: 420, size: 0.85, additive: false, opacity: 0.6, gravity: 4.5, drag: 0.5 });

    // Trümmerstücke: wenige echte Meshes, ebenfalls als Pool
    const debrisGeo = new THREE.BoxGeometry(0.9, 0.55, 1.5);
    const debrisMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.85, metalness: 0.3 });
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(debrisGeo, debrisMat);
      m.visible = false;
      scene.add(m);
      debris.push({ mesh: m, vel: new THREE.Vector3(), spin: new THREE.Vector3(), life: 0, maxLife: 0 });
    }
  }

  function spawnDebris(pos, power) {
    for (let k = 0; k < 6; k++) {
      const d = debris[debrisCursor];
      debrisCursor = (debrisCursor + 1) % debris.length;
      d.mesh.visible = true;
      d.mesh.position.copy(pos);
      const scl = 0.6 + Math.random() * 1.1;
      d.mesh.scale.setScalar(scl * power);
      d.vel.set((Math.random() - 0.5) * 16 * power, 6 + Math.random() * 13 * power, (Math.random() - 0.5) * 16 * power);
      d.spin.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
      d.life = 0;
      d.maxLife = 2.4 + Math.random() * 1.4;
    }
  }

  function updateDebris(dt) {
    for (let i = 0; i < debris.length; i++) {
      const d = debris[i];
      if (!d.mesh.visible) continue;
      d.life += dt;
      if (d.life >= d.maxLife) { d.mesh.visible = false; continue; }
      d.vel.y -= 19 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.y += d.spin.y * dt;
      d.mesh.rotation.z += d.spin.z * dt;
      // beim Eintauchen abbremsen und langsam absinken
      const surface = Ocean.heightAt(d.mesh.position.x, d.mesh.position.z);
      if (d.mesh.position.y < surface) {
        d.vel.multiplyScalar(Math.pow(0.02, dt));
        d.vel.y = -1.2;
      }
    }
  }

  /* ---------- Öffentliche Effekte ---------- */

  /* Explosion an der Wasseroberfläche: Blitz, Feuerball, Wasserfontäne, Rauch, Trümmer. */
  function explosion(pos, power) {
    const p = power || 1;
    for (let i = 0; i < 45 * p; i++) {
      _v.set((Math.random() - 0.5) * 22, Math.random() * 20 + 4, (Math.random() - 0.5) * 22).multiplyScalar(p);
      fire.spawn(pos, _v, Math.random() < 0.4 ? COL_HOT : COL_FIRE, 0.4 + Math.random() * 0.55, 2.5 * p);
    }
    for (let i = 0; i < 30 * p; i++) {
      _v.set((Math.random() - 0.5) * 9, 4 + Math.random() * 9, (Math.random() - 0.5) * 9).multiplyScalar(p);
      smoke.spawn(pos, _v, COL_SMOKE, 1.4 + Math.random() * 1.5, 4 * p);
    }
    waterColumn(pos, p);
    spawnDebris(pos, Math.min(1.6, p));
    shake = Math.max(shake, 0.55 * p);
    AudioEngine.explosion(Math.min(1.7, p));
  }

  /* Unterwasserexplosion: erst Blasen und Druckwelle, dann die Fontäne an der Oberfläche. */
  function underwaterExplosion(pos, power) {
    const p = power || 1;
    for (let i = 0; i < 55 * p; i++) {
      _v.set((Math.random() - 0.5) * 12, 6 + Math.random() * 16, (Math.random() - 0.5) * 12).multiplyScalar(p);
      bubbles.spawn(pos, _v, COL_BUBBLE, 0.9 + Math.random() * 1.2, 4 * p);
    }
    for (let i = 0; i < 16 * p; i++) {
      _v.set((Math.random() - 0.5) * 10, 2 + Math.random() * 7, (Math.random() - 0.5) * 10).multiplyScalar(p);
      fire.spawn(pos, _v, COL_FIRE, 0.28 + Math.random() * 0.3, 3 * p);
    }
    const surface = new THREE.Vector3(pos.x, Ocean.heightAt(pos.x, pos.z), pos.z);
    waterColumn(surface, p * 1.25);
    for (let i = 0; i < 14 * p; i++) {
      _v.set((Math.random() - 0.5) * 7, 3 + Math.random() * 6, (Math.random() - 0.5) * 7);
      smoke.spawn(surface, _v, COL_SMOKE, 1.1 + Math.random(), 3.5 * p);
    }
    shake = Math.max(shake, 0.4 * p);
    AudioEngine.underwaterExplosion(Math.min(1.6, p));
  }

  /* Hoch aufsteigende Wassersäule mit herabfallender Gischt. */
  function waterColumn(pos, power) {
    const p = power || 1;
    for (let i = 0; i < 60 * p; i++) {
      const up = 14 + Math.random() * 26 * p;
      _v.set((Math.random() - 0.5) * 11 * p, up, (Math.random() - 0.5) * 11 * p);
      foam.spawn(pos, _v, COL_FOAM, 1.0 + Math.random() * 1.1, 3 * p);
    }
  }

  /* Kielwasser / Bugwelle: wird laufend während der Fahrt erzeugt. */
  const _wakePos = new THREE.Vector3();
  function wake(pos, sideDir, speedFrac, width) {
    const n = speedFrac > 0.55 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const side = (Math.random() < 0.5 ? -1 : 1) * width * (0.6 + Math.random() * 0.5);
      _wakePos.copy(pos).addScaledVector(sideDir, side);
      _v.copy(sideDir).multiplyScalar(side * 0.35);
      _v.y = 0.7 + Math.random() * 1.4 * speedFrac;
      foam.spawn(_wakePos, _v, COL_FOAM, 0.6 + Math.random() * 0.7, 1.1);
    }
  }

  function splash(pos, power) {
    const p = power || 1;
    for (let i = 0; i < 18 * p; i++) {
      _v.set((Math.random() - 0.5) * 8 * p, 3 + Math.random() * 9 * p, (Math.random() - 0.5) * 8 * p);
      foam.spawn(pos, _v, COL_FOAM, 0.5 + Math.random() * 0.6, 1.8 * p);
    }
  }

  function bubbleTrail(pos, power) {
    _v.set((Math.random() - 0.5) * 1.2, 1.4 + Math.random() * 1.6, (Math.random() - 0.5) * 1.2);
    bubbles.spawn(pos, _v, COL_BUBBLE, 0.7 + Math.random() * 0.8, (power || 1) * 1.1);
  }

  function muzzleFlash(pos, dir) {
    for (let i = 0; i < 12; i++) {
      _v.copy(dir).multiplyScalar(11 + Math.random() * 16);
      _v.x += (Math.random() - 0.5) * 5;
      _v.y += Math.random() * 4;
      _v.z += (Math.random() - 0.5) * 5;
      fire.spawn(pos, _v, Math.random() < 0.5 ? COL_HOT : COL_FIRE, 0.14 + Math.random() * 0.16, 0.6);
    }
    for (let i = 0; i < 6; i++) {
      _v.copy(dir).multiplyScalar(4 + Math.random() * 6);
      _v.y += 1 + Math.random() * 2;
      smoke.spawn(pos, _v, COL_SMOKE, 0.6 + Math.random() * 0.5, 1.2);
    }
  }

  function update(dt) {
    fire.update(dt);
    smoke.update(dt);
    foam.update(dt);
    bubbles.update(dt);
    updateDebris(dt);
    shake = Math.max(0, shake - dt * 1.4);
  }

  function reset() {
    fire.clear(); smoke.clear(); foam.clear(); bubbles.clear();
    debris.forEach(d => { d.mesh.visible = false; });
    shake = 0;
  }

  return {
    init, update, reset,
    explosion, underwaterExplosion, waterColumn, wake, splash, bubbleTrail, muzzleFlash,
    get shake() { return shake; }
  };
})();
