/* ================= NACHBEARBEITUNG =================
   Szene -> HDR-Render-Target (mit Tiefentextur)
     -> Umgebungsverdeckung (SSAO) aus dem logarithmischen Tiefenpuffer, halbe Auflösung
     -> Bloom (UnrealBloomPass aus three-r128-postfx.js) für Fenster, Laternen, Sonne
     -> Zusammensetzen: SSAO, Belichtung, ACES-Tonemapping, Farbkorrektur, Vignette, sRGB
     -> FXAA-Kantenglättung auf den Bildschirm.
   Die eigene SSAO braucht keinen zweiten Szenen-Durchgang (die von three.js schon). */

const POST = { ok: false, w: 0, h: 0, rtScene: null, rtAO: null, rtLDR: null, bloom: null, quad: null, mAO: null, mComp: null, mFXAA: null };

const POST_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const AO_FS = `
uniform sampler2D tDepth; uniform vec2 uTexel; uniform float uLogF; uniform vec2 uProj; uniform float uRadius; uniform float uStrength;
varying vec2 vUv;
float viewZ(vec2 uv) { float d = texture2D(tDepth, uv).x; return -(exp2(d * uLogF) - 1.0); }
vec3 viewPos(vec2 uv) { float z = viewZ(uv); vec2 ndc = uv * 2.0 - 1.0; return vec3(ndc.x * -z / uProj.x, ndc.y * -z / uProj.y, z); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float d0 = texture2D(tDepth, vUv).x;
  if (d0 >= 0.9999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPos(vUv);
  float dist = -P.z;
  if (dist > 160.0) { gl_FragColor = vec4(1.0); return; }
  vec3 Px = viewPos(vUv + vec2(uTexel.x * 2.0, 0.0)), Py = viewPos(vUv + vec2(0.0, uTexel.y * 2.0));
  vec3 Nx = viewPos(vUv - vec2(uTexel.x * 2.0, 0.0)), Ny = viewPos(vUv - vec2(0.0, uTexel.y * 2.0));
  vec3 dx = abs(Px.z - P.z) < abs(Nx.z - P.z) ? Px - P : P - Nx;
  vec3 dy = abs(Py.z - P.z) < abs(Ny.z - P.z) ? Py - P : P - Ny;
  vec3 N = normalize(cross(dx, dy));
  float rUv = uRadius / dist * uProj.y * 0.5;
  float ang = hash(gl_FragCoord.xy) * 6.2831853;
  float occ = 0.0;
  const int S = 12;
  for (int i = 0; i < S; i++) {
    float t = 0.25 + 0.75 * (float(i) + 0.5) / float(S);
    float a = ang + float(i) * 2.39996;
    vec2 off = vec2(cos(a), sin(a)) * rUv * t;
    vec3 Q = viewPos(vUv + off * vec2(uTexel.x / uTexel.y, 1.0));
    vec3 v = Q - P;
    float l = length(v);
    float ndv = dot(N, v / max(l, 1e-4));
    float rangeOk = 1.0 - smoothstep(uRadius, uRadius * 2.0, l);
    occ += max(0.0, ndv - 0.22) * rangeOk;
  }
  float ao = 1.0 - uStrength * occ / float(S) * 2.2;
  ao = mix(ao, 1.0, smoothstep(90.0, 160.0, dist));
  gl_FragColor = vec4(vec3(clamp(ao, 0.0, 1.0)), 1.0);
}`;

const COMP_FS = `
uniform sampler2D tScene; uniform sampler2D tAO; uniform vec2 uAOTexel; uniform float uUseAO; uniform float uExposure; uniform float uVignette; uniform float uSat; uniform float uContrast;
varying vec2 vUv;
vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 color) {
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= uExposure / 0.6;
  color = ACESInputMat * color; color = RRTAndODTFit(color); color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) { return mix(pow(c, vec3(0.41666)) * 1.055 - vec3(0.055), c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }
void main() {
  vec3 col = texture2D(tScene, vUv).rgb;
  if (uUseAO > 0.5) {
    float ao = 0.0;
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) ao += texture2D(tAO, vUv + vec2(float(x), float(y)) * uAOTexel * 1.2).r;
    col *= ao / 9.0;
  }
  col = aces(col);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  col = (col - 0.5) * uContrast + 0.5;
  vec2 q = vUv - 0.5;
  col *= 1.0 - uVignette * dot(q, q) * 1.6;
  gl_FragColor = vec4(toSRGB(clamp(col, 0.0, 1.0)), 1.0);
}`;

function initPost(renderer) {
  if (!renderer.capabilities.isWebGL2 || !THREE.UnrealBloomPass || !THREE.FXAAShader) { POST.ok = false; return; }
  const geo = new THREE.PlaneGeometry(2, 2);
  POST.quad = new THREE.Mesh(geo, null);
  POST.quad.frustumCulled = false;
  POST.qScene = new THREE.Scene(); POST.qScene.add(POST.quad);
  POST.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  POST.mAO = new THREE.ShaderMaterial({ vertexShader: POST_VS, fragmentShader: AO_FS, depthTest: false, depthWrite: false,
    uniforms: { tDepth: { value: null }, uTexel: { value: new THREE.Vector2() }, uLogF: { value: 1 }, uProj: { value: new THREE.Vector2(1, 1) }, uRadius: { value: 1.8 }, uStrength: { value: 1.0 } } });
  POST.mComp = new THREE.ShaderMaterial({ vertexShader: POST_VS, fragmentShader: COMP_FS, depthTest: false, depthWrite: false,
    uniforms: { tScene: { value: null }, tAO: { value: null }, uAOTexel: { value: new THREE.Vector2() }, uUseAO: { value: 0 }, uExposure: { value: 1 }, uVignette: { value: 0.22 }, uSat: { value: 1.06 }, uContrast: { value: 1.04 } } });
  POST.mFXAA = new THREE.ShaderMaterial({ vertexShader: POST_VS, fragmentShader: THREE.FXAAShader.fragmentShader, depthTest: false, depthWrite: false,
    uniforms: THREE.UniformsUtils.clone(THREE.FXAAShader.uniforms) });
  POST.ok = true;
}

function setPostSize(w, h) {
  if (!POST.ok || (w === POST.w && h === POST.h)) return;
  POST.w = w; POST.h = h;
  for (const k of ['rtScene', 'rtAO', 'rtLDR']) if (POST[k]) POST[k].dispose();
  const dt = new THREE.DepthTexture(w, h); dt.type = THREE.UnsignedIntType;
  POST.rtScene = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthTexture: dt, depthBuffer: true });
  POST.rtAO = new THREE.WebGLRenderTarget(Math.max(1, w >> 1), Math.max(1, h >> 1), { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  POST.rtLDR = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  if (!POST.bloom) POST.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.6, 0.9);
  else POST.bloom.setSize(w, h);
}

function blit(renderer, mat, target) {
  POST.quad.material = mat;
  renderer.setRenderTarget(target);
  renderer.render(POST.qScene, POST.qCam);
}

/* opts: {ao, bloom, fxaa, exposure, bloomStrength} */
function renderPost(renderer, scene, camera, opts) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  setPostSize(size.x, size.y);
  const oldTM = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setRenderTarget(POST.rtScene);
  renderer.clear();
  renderer.render(scene, camera);
  if (opts.ao) {
    const u = POST.mAO.uniforms;
    u.tDepth.value = POST.rtScene.depthTexture;
    u.uTexel.value.set(1 / POST.w, 1 / POST.h);
    u.uLogF.value = Math.log2(camera.far + 1);
    u.uProj.value.set(camera.projectionMatrix.elements[0], camera.projectionMatrix.elements[5]);
    blit(renderer, POST.mAO, POST.rtAO);
  }
  if (opts.bloom) {
    POST.bloom.strength = opts.bloomStrength;
    POST.bloom.threshold = opts.bloomThreshold !== undefined ? opts.bloomThreshold : 0.9;
    POST.bloom.renderToScreen = false;
    POST.bloom.render(renderer, null, POST.rtScene, 0, false);
  }
  const c = POST.mComp.uniforms;
  c.tScene.value = POST.rtScene.texture; c.tAO.value = POST.rtAO.texture; c.uUseAO.value = opts.ao ? 1 : 0;
  c.uAOTexel.value.set(2 / POST.w, 2 / POST.h); c.uExposure.value = opts.exposure;
  if (POST.debugAO && opts.ao) { blit(renderer, POST.copyAO || (POST.copyAO = new THREE.ShaderMaterial({ vertexShader: POST_VS, fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb, 1.0); }', uniforms: { t: { value: null } }, depthTest: false })), null); POST.copyAO.uniforms.t.value = POST.rtAO.texture; blit(renderer, POST.copyAO, null); renderer.toneMapping = oldTM; return; }
  if (opts.fxaa) {
    blit(renderer, POST.mComp, POST.rtLDR);
    POST.mFXAA.uniforms.tDiffuse.value = POST.rtLDR.texture;
    POST.mFXAA.uniforms.resolution.value.set(1 / POST.w, 1 / POST.h);
    blit(renderer, POST.mFXAA, null);
  } else blit(renderer, POST.mComp, null);
  renderer.toneMapping = oldTM;
}
