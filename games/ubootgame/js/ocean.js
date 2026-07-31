/* ================= MEER =================
   Endlose Wasseroberfläche: ein grosses Gitter, das dem Spieler nachgeführt wird. Die Wellen
   werden im Vertex-Shader aus der WELT-Position berechnet, dadurch bleibt das Wellenmuster im
   Raum verankert und das Nachführen des Gitters ist unsichtbar.
   Dieselben Wellenparameter liegen auch als JS-Array vor, damit Schiffe auf der CPU exakt auf
   der sichtbaren Oberfläche schwimmen (heightAt / normalAt). */

const Ocean = (function () {
  // dir(x,z) normalisiert, amp = Höhe in m, len = Wellenlänge in m, spd = Laufgeschwindigkeit
  const WAVES = [
    { dx:  1.00, dz:  0.00, amp: 0.42, len: 38, spd: 4.2 },
    { dx:  0.66, dz:  0.75, amp: 0.26, len: 21, spd: 3.3 },
    { dx: -0.55, dz:  0.83, amp: 0.15, len: 12.5, spd: 2.6 },
    { dx:  0.20, dz: -0.98, amp: 0.08, len: 7.0, spd: 1.9 }
  ];

  const SIZE = 1200;      // Kantenlänge des Wassergitters in m
  const SEGMENTS = 130;   // Auflösung (SIZE/SEGMENTS ≈ 9 m pro Feld)
  const TILE = SIZE / SEGMENTS;

  const SHALLOW = new THREE.Color(0x2f7f9e);
  const DEEP = new THREE.Color(0x05263a);
  const HORIZON = new THREE.Color(0x9db9c9);

  let mesh = null;
  let material = null;
  let time = 0;

  const vertexShader = `
    uniform float uTime;
    uniform vec2  uDir[4];
    uniform float uAmp[4];
    uniform float uLen[4];
    uniform float uSpd[4];

    varying vec3 vWorld;
    varying vec3 vNormalW;

    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      float h = 0.0;
      float dhdx = 0.0;
      float dhdz = 0.0;
      for (int i = 0; i < 4; i++) {
        float k = 6.2831853 / uLen[i];
        float phase = dot(uDir[i], wp.xz) * k + uTime * uSpd[i] * k;
        h += uAmp[i] * sin(phase);
        float c = uAmp[i] * cos(phase) * k;
        dhdx += c * uDir[i].x;
        dhdz += c * uDir[i].y;
      }
      wp.y += h;
      vWorld = wp.xyz;
      vNormalW = normalize(vec3(-dhdx, 1.0, -dhdz));
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const fragmentShader = `
    uniform vec3 uShallow;
    uniform vec3 uDeep;
    uniform vec3 uHorizon;
    uniform vec3 uSunDir;
    uniform float uFar;

    varying vec3 vWorld;
    varying vec3 vNormalW;

    void main() {
      vec3 n = normalize(vNormalW);
      vec3 viewDir = normalize(cameraPosition - vWorld);

      // Fresnel: flacher Blickwinkel -> mehr Himmelsspiegelung
      float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
      fres = clamp(fres, 0.0, 1.0);

      // Wellenkämme wirken heller als die Täler
      float crest = smoothstep(-0.35, 0.55, vWorld.y);
      vec3 body = mix(uDeep, uShallow, crest * 0.85 + 0.15);
      vec3 col = mix(body, uHorizon, fres * 0.75);

      // Sonnenglitzern
      vec3 halfDir = normalize(uSunDir + viewDir);
      float spec = pow(max(dot(n, halfDir), 0.0), 90.0);
      col += vec3(1.0, 0.96, 0.85) * spec * 0.9;

      // diffuse Grundhelligkeit
      col *= 0.72 + 0.42 * max(dot(n, uSunDir), 0.0);

      // Übergang zum Dunst am Horizont
      float dist = length(cameraPosition.xz - vWorld.xz);
      col = mix(col, uHorizon, smoothstep(uFar * 0.35, uFar, dist));

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function build(scene, sunDir, far) {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2); // Gitter liegt danach in der XZ-Ebene

    material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uDir: { value: WAVES.map(w => new THREE.Vector2(w.dx, w.dz).normalize()) },
        uAmp: { value: WAVES.map(w => w.amp) },
        uLen: { value: WAVES.map(w => w.len) },
        uSpd: { value: WAVES.map(w => w.spd) },
        uShallow: { value: SHALLOW.clone() },
        uDeep: { value: DEEP.clone() },
        uHorizon: { value: HORIZON.clone() },
        uSunDir: { value: sunDir.clone().normalize() },
        uFar: { value: far }
      }
    });

    mesh = new THREE.Mesh(geo, material);
    mesh.renderOrder = -1;
    scene.add(mesh);
    return mesh;
  }

  /* Wasserhöhe an einer Weltposition - identisch zur Shader-Berechnung. */
  function heightAt(x, z) {
    let h = 0;
    for (let i = 0; i < WAVES.length; i++) {
      const w = WAVES[i];
      const inv = 1 / Math.hypot(w.dx, w.dz);
      const k = (Math.PI * 2) / w.len;
      const phase = (x * w.dx * inv + z * w.dz * inv) * k + time * w.spd * k;
      h += w.amp * Math.sin(phase);
    }
    return h;
  }

  /* Oberflächennormale - für die Neigung (Roll/Pitch) schwimmender Objekte. */
  function normalAt(x, z, target) {
    let dhdx = 0, dhdz = 0;
    for (let i = 0; i < WAVES.length; i++) {
      const w = WAVES[i];
      const inv = 1 / Math.hypot(w.dx, w.dz);
      const dx = w.dx * inv, dz = w.dz * inv;
      const k = (Math.PI * 2) / w.len;
      const phase = (x * dx + z * dz) * k + time * w.spd * k;
      const c = w.amp * Math.cos(phase) * k;
      dhdx += c * dx;
      dhdz += c * dz;
    }
    return (target || new THREE.Vector3()).set(-dhdx, 1, -dhdz).normalize();
  }

  /* Nachführen: das Gitter springt in ganzen Feldern mit, damit die Wellen nicht "mitwandern". */
  function update(dt, focusX, focusZ) {
    time += dt;
    if (!mesh) return;
    material.uniforms.uTime.value = time;
    mesh.position.x = Math.round(focusX / TILE) * TILE;
    mesh.position.z = Math.round(focusZ / TILE) * TILE;
  }

  return {
    build, update, heightAt, normalAt,
    get time() { return time; },
    reset() { time = 0; },
    HORIZON
  };
})();

/* ================= HIMMEL =================
   Farbverlauf-Kuppel; ersetzt eine Skybox-Textur und passt farblich zum Dunst des Meeres. */
function buildSky(scene, radius) {
  const geo = new THREE.SphereGeometry(radius, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x2f6f9c) },
      uMid: { value: new THREE.Color(0x9db9c9) },
      uBottom: { value: new THREE.Color(0x6d8ea3) }
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBottom;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 col = h > 0.0 ? mix(uMid, uTop, smoothstep(0.0, 0.55, h))
                           : mix(uMid, uBottom, smoothstep(0.0, -0.3, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -2;
  scene.add(sky);
  return sky;
}
