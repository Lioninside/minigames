/* ================= HIMMEL, TAGESZEIT, LICHT =================
   Himmelskuppel mit Sonne, Wolken und Sternen, Sonnen-/Mondlicht mit Schatten, Nebel,
   Umgebungs-Reflexionen (PMREM) und Nachtbeleuchtung. */

const SKY = { mesh: null, mat: null, sun: null, hemi: null, amb: null, pmrem: null, envRT: null, envScene: null, lastEnv: -99, night: 0, horizon: new THREE.Color(), sunDir: new THREE.Vector3() };

const SKY_VS = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w * 0.99999;
}`;
const SKY_FS = `
uniform vec3 uSun; uniform float uDay; uniform float uTime; uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround;
varying vec3 vDir;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(max(y, 0.0), 0.55));
  if (y < 0.0) col = mix(uHorizon, uGround, 1.0 - smoothstep(-0.25, 0.0, y));
  float sd = max(dot(d, uSun), 0.0);
  float sunUp = smoothstep(-0.12, 0.05, uSun.y);
  col += vec3(1.0, 0.75, 0.45) * pow(sd, 8.0) * 0.35 * sunUp;
  col += vec3(1.0, 0.9, 0.7) * pow(sd, 64.0) * 0.6 * sunUp;
  col += vec3(1.0, 0.97, 0.9) * smoothstep(0.9993, 0.9997, sd) * 25.0 * sunUp;
  // Sterne
  if (y > 0.0) {
    vec2 sp = d.xz / (y + 0.35) * 220.0;
    float st = step(0.9975, h(floor(sp))) * (1.0 - uDay) * smoothstep(0.0, 0.3, y);
    col += vec3(st) * 0.9;
    // Mond
    vec3 md = normalize(-uSun + vec3(0.2, 0.25, 0.0));
    float mm = smoothstep(0.99955, 0.9997, dot(d, md)) * (1.0 - uDay);
    col += vec3(0.85, 0.9, 1.0) * mm * 3.0;
    col += vec3(0.25, 0.3, 0.4) * pow(max(dot(d, md), 0.0), 60.0) * (1.0 - uDay) * 0.6;
    // Wolken
    vec2 cp = d.xz / (y + 0.08) * 1.6 + vec2(uTime * 0.004, uTime * 0.002);
    float c = fbm(cp);
    float cov = smoothstep(0.52, 0.78, c) * smoothstep(0.0, 0.18, y);
    vec3 cc = mix(vec3(0.16, 0.18, 0.24), vec3(1.0), uDay);
    cc = mix(cc, vec3(1.0, 0.72, 0.5), clamp(1.0 - abs(uSun.y) * 3.0, 0.0, 1.0) * 0.5 * sunUp);
    cc += vec3(1.0, 0.9, 0.7) * pow(sd, 6.0) * 0.4 * uDay;
    col = mix(col, cc, cov * 0.85);
  }
  col = clamp(col, 0.0, 60.0);
  gl_FragColor = vec4(col, 1.0);
}`;

function initSky(scene, renderer) {
  SKY.mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false,
    uniforms: { uSun: { value: new THREE.Vector3(0, 1, 0) }, uDay: { value: 1 }, uTime: { value: 0 }, uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color(0x40463f) } }
  });
  SKY.mesh = new THREE.Mesh(new THREE.SphereGeometry(4500, 32, 16), SKY.mat);
  SKY.mesh.renderOrder = -10; SKY.mesh.frustumCulled = false;
  scene.add(SKY.mesh);
  SKY.sun = new THREE.DirectionalLight(0xffffff, 2.5);
  SKY.sun.castShadow = true;
  SKY.sun.shadow.mapSize.set(2048, 2048);
  const sc = SKY.sun.shadow.camera; sc.left = -140; sc.right = 140; sc.top = 140; sc.bottom = -140; sc.near = 10; sc.far = 900;
  SKY.sun.shadow.bias = -0.0004; SKY.sun.shadow.normalBias = 0.05;
  scene.add(SKY.sun); scene.add(SKY.sun.target);
  SKY.hemi = new THREE.HemisphereLight(0xbcd6ef, 0x5b5a4a, 0.5); scene.add(SKY.hemi);
  SKY.amb = new THREE.AmbientLight(0xffffff, 0.0); scene.add(SKY.amb);
  scene.fog = new THREE.Fog(0xb8c8d6, 350, 3600);
  SKY.pmrem = new THREE.PMREMGenerator(renderer);
  SKY.envScene = new THREE.Scene();
  SKY.envMesh = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), SKY.mat);
  SKY.envScene.add(SKY.envMesh);
}

/* Tageszeit (Stunden 0..24) anwenden */
function applyTimeOfDay(hour, scene, renderer, focus, underground, realT) {
  const a = (hour - 6) / 12 * Math.PI;
  const sd = SKY.sunDir.set(Math.cos(a), Math.sin(a) * 0.86, Math.sin(a) * 0.42 + 0.12).normalize();
  const day = smooth(-0.1, 0.18, sd.y);
  const golden = 1 - smooth(0.05, 0.35, sd.y);
  SKY.night = 1 - day;
  const zenith = new THREE.Color(0x05070d).lerp(new THREE.Color(0x2f6fb8), day);
  const horizon = new THREE.Color(0x0b1220).lerp(new THREE.Color(0xc9dcea), day);
  horizon.lerp(new THREE.Color(0xf0a070), golden * day * 0.65);
  SKY.mat.uniforms.uSun.value.copy(sd);
  SKY.mat.uniforms.uDay.value = day;
  SKY.mat.uniforms.uTime.value = realT;
  SKY.mat.uniforms.uZenith.value.copy(zenith).convertSRGBToLinear();
  SKY.mat.uniforms.uHorizon.value.copy(horizon).convertSRGBToLinear();
  SKY.horizon.copy(horizon);
  // Licht
  const sun = SKY.sun;
  if (sd.y > -0.05) {
    sun.color.setRGB(1, lerp(0.62, 0.96, 1 - golden), lerp(0.38, 0.9, 1 - golden));
    sun.intensity = 2.6 * smooth(-0.05, 0.12, sd.y);
    sun.position.set(focus.x + sd.x * 400, focus.y + sd.y * 400, focus.z + sd.z * 400);
  } else {
    const md = new THREE.Vector3(-sd.x + 0.2, Math.max(0.3, -sd.y), -sd.z).normalize();
    sun.color.setRGB(0.55, 0.65, 0.9);
    sun.intensity = 0.28;
    sun.position.set(focus.x + md.x * 400, focus.y + md.y * 400, focus.z + md.z * 400);
  }
  // Schattenkamera auf Texel rasten (kein Flimmern)
  const snap = (SKY.shadowRange || 140) * 2 / (sun.shadow.mapSize.x || 2048);
  const tx = Math.round(focus.x / snap) * snap, tz = Math.round(focus.z / snap) * snap;
  sun.target.position.set(tx, focus.y, tz);
  sun.position.x += tx - focus.x; sun.position.z += tz - focus.z;
  SKY.hemi.intensity = 0.12 + 0.48 * day;
  SKY.hemi.color.setRGB(lerp(0.25, 0.74, day), lerp(0.3, 0.84, day), lerp(0.45, 0.94, day));
  SKY.hemi.groundColor.setRGB(lerp(0.08, 0.36, day), lerp(0.08, 0.35, day), lerp(0.1, 0.29, day));
  renderer.toneMappingExposure = lerp(1.25, 0.95, day);
  // Nebel
  scene.fog.color.copy(horizon).convertSRGBToLinear();
  scene.fog.near = underground ? 30 : 350; scene.fog.far = underground ? 260 : Math.min(lerp(2000, 3200, day), (WORLD.camera ? WORLD.camera.far : 3400) * 0.97);
  if (underground) { scene.fog.color.setRGB(0.02, 0.02, 0.025); SKY.sun.intensity = 0; SKY.hemi.intensity = 0.08; SKY.amb.intensity = 0.85; }
  else SKY.amb.intensity = 0.04 * (1 - day);
  // Nachtbeleuchtung
  NIGHT_U.value = smooth(0.15, 0.85, SKY.night);
  // Umgebungs-Reflexionen gelegentlich neu berechnen
  if (Math.abs(hour - SKY.lastEnv) > 0.25 && Math.abs(hour - SKY.lastEnv) < 23.75 || SKY.lastEnv < 0) {
    SKY.lastEnv = hour;
    const rt = SKY.pmrem.fromEquirectangular(skyEquirect(sd, day, zenith, horizon));
    if (SKY.envRT) SKY.envRT.dispose();
    SKY.envRT = rt;
    scene.environment = rt.texture;
  }
}

/* Himmel als kleines Panorama (für die Reflexionen), auf der CPU gemalt */
function skyEquirect(sd, day, zenith, horizon) {
  const W = 128, H = 64;
  if (!SKY.eqCanvas) { SKY.eqCanvas = makeCanvas(W, H); SKY.eqTex = new THREE.CanvasTexture(SKY.eqCanvas); SKY.eqTex.mapping = THREE.EquirectangularReflectionMapping; SKY.eqTex.encoding = THREE.sRGBEncoding; }
  const ctx = SKY.eqCanvas.getContext('2d');
  const img = ctx.createImageData(W, H), d = img.data;
  const zr = zenith.r * 255, zg = zenith.g * 255, zb = zenith.b * 255, hr = horizon.r * 255, hg = horizon.g * 255, hb = horizon.b * 255;
  const gr = lerp(20, 95, day), gg = lerp(22, 92, day), gb = lerp(24, 80, day);
  for (let j = 0; j < H; j++) {
    const lat = (0.5 - (j + 0.5) / H) * Math.PI;
    const y = Math.sin(lat), cl = Math.cos(lat);
    for (let i = 0; i < W; i++) {
      const lon = ((i + 0.5) / W) * Math.PI * 2 - Math.PI;
      const x = cl * Math.cos(lon), z = cl * Math.sin(lon);
      let r, g, b;
      if (y >= 0) { const t = Math.pow(y, 0.55); r = lerp(hr, zr, t); g = lerp(hg, zg, t); b = lerp(hb, zb, t); }
      else { const t = Math.min(1, -y * 4); r = lerp(hr, gr, t); g = lerp(hg, gg, t); b = lerp(hb, gb, t); }
      const sdot = Math.max(0, x * sd.x + y * sd.y + z * sd.z);
      const glow = (Math.pow(sdot, 8) * 90 + Math.pow(sdot, 200) * 255) * smooth(-0.1, 0.1, sd.y);
      const k = (j * W + i) * 4;
      d[k] = Math.min(255, r + glow); d[k + 1] = Math.min(255, g + glow * 0.85); d[k + 2] = Math.min(255, b + glow * 0.6); d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  SKY.eqTex.needsUpdate = true;
  return SKY.eqTex;
}
