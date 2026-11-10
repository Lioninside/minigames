/* ================= ASSET: ANIMIERTE MENSCHENMENGE =================
   Figur „Animated Woman“ von Quaternius (CC0), vorab mit tools/bake_crowd.py umgerechnet
   (js/data/crowd-woman.js, wird erst nach dem Start nachgeladen).

   Alle Figuren sind EIN instanziertes Mesh = 1 Draw-Call (plus 1 für die Schatten).
   Das Skinning passiert im Vertex-Shader: Die Knochenmatrizen aller Einzelbilder der vier
   Animationen (Gehen, Rennen, Stehen, Sitzen) liegen in einer Float-Textur. Jede Instanz trägt
     iAnim  = (erste Zeile des Clips, Anzahl Bilder, Zyklus-Position)
   und der Shader holt pro Vertex 4 Knochen × 2 Bilder (weich überblendet).
   Farben: Jeder Vertex kennt seinen Palettenplatz (Haut, Haare, Oberteil, Hose, Schuhe);
   pro Instanz werden Haut, Haare, Oberteil und Hose ersetzt. Ein Modell → viele Leute. */

const CROWD = { asset: null, loading: false, mesh: null, max: 0, n: 0, failed: false };

/* Datendatei nachladen (Script-Tag statt fetch: funktioniert auch über file://) */
function loadCrowdData(cb) {
  if (window.CROWD_DATA && window.CROWD_DATA.woman) { cb(true); return; }
  if (CROWD.loading) return;
  CROWD.loading = true;
  const s = document.createElement('script');
  s.src = 'js/data/crowd-woman.js';
  s.async = true;
  s.onload = () => { CROWD.loading = false; cb(!!(window.CROWD_DATA && window.CROWD_DATA.woman)); };
  s.onerror = () => { CROWD.loading = false; CROWD.failed = true; cb(false); };
  document.head.appendChild(s);
}

function halfToFloat(h) {
  const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
  if (e === 0) return s * f * 5.960464477539063e-8;
  if (e === 31) return f ? NaN : s * Infinity;
  return s * (1 + f / 1024) * Math.pow(2, e - 15);
}

const CROWD_VS_DECL = `
uniform sampler2D uBones;
attribute vec4 skinJ;
attribute vec4 skinW;
attribute float aCol;
attribute vec3 iAnim;
attribute vec3 iShirt;
attribute vec3 iPants;
attribute vec3 iHair;
attribute vec3 iSkin;
varying vec3 vCrowdCol;
uniform vec3 uPal[6];
mat4 crowdBone(float j, float row) {
  int x = int(j) * 3, y = int(row);
  vec4 a = texelFetch(uBones, ivec2(x, y), 0), b = texelFetch(uBones, ivec2(x + 1, y), 0), c = texelFetch(uBones, ivec2(x + 2, y), 0);
  return mat4(a.x, b.x, c.x, 0.0, a.y, b.y, c.y, 0.0, a.z, b.z, c.z, 0.0, a.w, b.w, c.w, 1.0);
}
mat4 crowdSkin() {
  float fr = fract(iAnim.z) * iAnim.y;
  float f0 = floor(fr), t = fr - f0;
  float f1 = mod(f0 + 1.0, iAnim.y);
  float r0 = iAnim.x + f0, r1 = iAnim.x + f1;
  mat4 m = mat4(0.0);
  for (int i = 0; i < 4; i++) {
    float w = skinW[i];
    if (w > 0.0) m += w * ((1.0 - t) * crowdBone(skinJ[i], r0) + t * crowdBone(skinJ[i], r1));
  }
  return m;
}
`;
function crowdPatch(withColor) {
  return (sh) => {
    sh.uniforms.uBones = { value: CROWD.asset.boneTex };
    sh.uniforms.uPal = { value: CROWD.asset.pal };
    let vs = CROWD_VS_DECL + sh.vertexShader;
    if (withColor) {
      vs = vs.replace('#include <beginnormal_vertex>', `
        mat4 cSkin = crowdSkin();
        vec3 objectNormal = normalize(mat3(cSkin) * normal);
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif
        float cs = aCol;
        vCrowdCol = cs < 0.5 ? iSkin : cs < 1.5 ? uPal[1] : cs < 2.5 ? iHair : cs < 3.5 ? iShirt : cs < 4.5 ? iPants : uPal[5] * (0.35 + 0.65 * iPants);`)
        .replace('#include <begin_vertex>', 'vec3 transformed = (cSkin * vec4(position, 1.0)).xyz;');
    } else {
      vs = vs.replace('#include <begin_vertex>', 'mat4 cSkin = crowdSkin(); vec3 transformed = (cSkin * vec4(position, 1.0)).xyz;');
    }
    sh.vertexShader = vs;
    if (withColor) sh.fragmentShader = 'varying vec3 vCrowdCol;\n' + sh.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.rgb *= vCrowdCol;');
  };
}

/* Daten dekodieren → Geometrie, Knochentextur, Materialien */
function buildCrowdAsset() {
  if (CROWD.asset) return CROWD.asset;
  const D = window.CROWD_DATA && window.CROWD_DATA.woman;
  if (!D) return null;
  const bin = atob(D.b64), buf = new ArrayBuffer(bin.length), u8 = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const nv = D.verts, o = D.offs;
  const qp = new Int16Array(buf, o.pos, nv * 3), pos = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) { const k = i % 3; pos[i] = D.posMin[k] + (qp[i] + 32767) / 65534 * (D.posMax[k] - D.posMin[k]); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(buf, o.nrm, nv * 4), 4, true));
  geo.setAttribute('skinJ', new THREE.BufferAttribute(new Uint8Array(buf, o.jnt, nv * 4), 4, false));
  geo.setAttribute('skinW', new THREE.BufferAttribute(new Uint8Array(buf, o.wgt, nv * 4), 4, true));
  geo.setAttribute('aCol', new THREE.BufferAttribute(new Uint8Array(buf, o.col, nv), 1, false));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(buf, o.idx, D.tris * 3), 1));
  // Die Ruhepose ist winzig und liegt anders; der Shader skaliert. Für Culling eine grosszügige Kugel.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 1.2);
  // Knochentextur: Breite = Knochen × 3 Zeilen der 3×4-Matrix, Höhe = Einzelbilder
  const W = D.bones * 3, H = D.frames;
  const half = new Uint16Array(buf, o.bones, W * H * 4), f32 = new Float32Array(W * H * 4);
  for (let i = 0; i < f32.length; i++) f32[i] = halfToFloat(half[i]);
  const boneTex = new THREE.DataTexture(f32, W, H, THREE.RGBAFormat, THREE.FloatType);
  boneTex.magFilter = boneTex.minFilter = THREE.NearestFilter; boneTex.generateMipmaps = false; boneTex.needsUpdate = true;
  const pal = D.palette.map(h => new THREE.Color(h).convertSRGBToLinear());
  const clips = {}; for (const c of D.clips) clips[c.name] = c;
  const a = { geo, boneTex, pal, clips, tris: D.tris, bytes: D.bytes, hipY: clips.sit.hipY };
  CROWD.asset = a;
  a.mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });
  a.mat.onBeforeCompile = crowdPatch(true);
  a.mat.customProgramCacheKey = () => 'crowd-color';
  a.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  a.depth.onBeforeCompile = crowdPatch(false);
  a.depth.customProgramCacheKey = () => 'crowd-depth';
  return a;
}

/* Instanzen pro Bild füllen: begin(), add(...), end() */
class SkinCrowd {
  constructor(parent, asset, max) {
    this.max = max; this.asset = asset; this.n = 0;
    const g = asset.geo.clone();
    const at = (n) => { const b = new THREE.InstancedBufferAttribute(new Float32Array(max * n), n); b.setUsage(THREE.DynamicDrawUsage); return b; };
    for (const [k, n] of [['iAnim', 3], ['iShirt', 3], ['iPants', 3], ['iHair', 3], ['iSkin', 3]]) g.setAttribute(k, at(n));
    const im = new THREE.InstancedMesh(g, asset.mat, max);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.customDepthMaterial = asset.depth;
    im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; im.count = 0;
    im.userData.dynamic = true; im.name = 'crowd';
    parent.add(im);
    this.mesh = im;
    this.A = g.attributes;
  }
  begin() { this.n = 0; }
  full() { return this.n >= this.max; }
  /* clip: Objekt aus asset.clips, cyc: Zyklus-Position (1 = ein ganzer Durchlauf) */
  add(m4, clip, cyc, look) {
    if (this.n >= this.max) return false;
    const i = this.n++;
    this.mesh.setMatrixAt(i, m4);
    const A = this.A;
    A.iAnim.array[i * 3] = clip.start; A.iAnim.array[i * 3 + 1] = clip.frames; A.iAnim.array[i * 3 + 2] = cyc - Math.floor(cyc);
    A.iShirt.array.set([look.shirt.r, look.shirt.g, look.shirt.b], i * 3);
    A.iPants.array.set([look.pants.r, look.pants.g, look.pants.b], i * 3);
    A.iHair.array.set([look.hair.r, look.hair.g, look.hair.b], i * 3);
    A.iSkin.array.set([look.skin.r, look.skin.g, look.skin.b], i * 3);
    return true;
  }
  end() {
    const im = this.mesh;
    im.count = this.n;
    im.instanceMatrix.needsUpdate = true;
    for (const k of ['iAnim', 'iShirt', 'iPants', 'iHair', 'iSkin']) { const a = this.A[k]; a.needsUpdate = true; a.updateRange.count = this.n * 3; }
    im.instanceMatrix.updateRange.count = this.n * 16;
  }
}

/* Aussehen: Farben für Oberteil, Hose, Haare, Haut (zufällig, aber pro Person fest) */
const CROWD_LOOKS = (() => {
  const L = (a) => a.map(c => new THREE.Color(c).convertSRGBToLinear());
  return {
    shirt: L([0xe7655c, 0x2b4c7e, 0xe8e2d0, 0x2f6f4f, 0x333333, 0xd9a441, 0x6b3fa0, 0x1e90a0, 0xf0f0f0, 0xb03a2e, 0xf2a7b8, 0x7fb069, 0x4a5a7a]),
    pants: L([0x6187d3, 0x1d2633, 0x3a3a3a, 0x4a5a7a, 0x6b5a45, 0x1a1a1a, 0x7a7a72, 0xc9b28a, 0x2f3b52]),
    hair: L([0xd1c270, 0x2a1d14, 0x5a3a22, 0x8a5a2b, 0x111111, 0xb8b0a0, 0x9a3b1f, 0x3d2b1f]),
    skin: L([0xe7bd91, 0xf1c9a5, 0xe0ac87, 0xc68863, 0x8d5a3b, 0x5c3a24, 0xf5d7bf])
  };
})();
function crowdLook(seed) {
  const h = (k) => hash2i(seed | 0, k);
  const pk = (a, k) => a[Math.floor(h(k) * a.length) % a.length];
  return { shirt: pk(CROWD_LOOKS.shirt, 11), pants: pk(CROWD_LOOKS.pants, 23), hair: pk(CROWD_LOOKS.hair, 37), skin: pk(CROWD_LOOKS.skin, 51), h: 0.94 + h(61) * 0.12 };
}
