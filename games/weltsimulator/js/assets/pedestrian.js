/* ================= ASSET: FUSSGÄNGER =================
   Alle Fussgänger sind ein einziges instanziertes Mesh pro Detailstufe.
   Statt sechs Meshes (Rumpf, Kopf, Beine, Arme) mit je eigener Matrix pro Bild trägt jeder
   Vertex eine Teil-Nummer (aPart). Der Vertex-Shader dreht Beine und Arme mit der
   Schrittphase (iPhase) um Hüfte bzw. Schulter. Hemd-, Hosen- und Hautfarbe kommen als
   Instanz-Attribute. Ergebnis: 1 Draw-Call und 1 Matrix pro Person statt 6.
     near: Figur mit Armen, Beinen, Schuhen, Händen
     far:  zwei Kästen und Kopf, ohne Bewegung */

const PED_VS_DECL = 'attribute float aPart;\nattribute float aSel;\nattribute float iPhase;\nattribute vec3 iShirt;\nattribute vec3 iPants;\nattribute vec3 iSkin;\nvarying vec3 vPedCol;\n';
const PED_VS_BODY = `
  {
    float sw = sin(iPhase) * 0.5;
    if (aPart > 0.5) {
      vec3 pivot; float ang;
      if (aPart < 1.5) { pivot = vec3(0.11, 0.86, 0.0); ang = sw; }
      else if (aPart < 2.5) { pivot = vec3(-0.11, 0.86, 0.0); ang = -sw; }
      else if (aPart < 3.5) { pivot = vec3(0.28, 1.48, 0.0); ang = -sw * 0.8; }
      else { pivot = vec3(-0.28, 1.48, 0.0); ang = sw * 0.8; }
      vec3 p = transformed - pivot; float c = cos(ang), s = sin(ang);
      transformed = pivot + vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
    }
    vPedCol = aSel < 0.5 ? iShirt : (aSel < 1.5 ? iPants : (aSel < 2.5 ? iSkin : vec3(0.05)));
  }`;
function pedPatch(withColor) {
  return (sh) => {
    sh.vertexShader = PED_VS_DECL + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + PED_VS_BODY);
    if (withColor) sh.fragmentShader = 'varying vec3 vPedCol;\n' + sh.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.rgb *= vPedCol;');
  };
}

function buildPedestrianAsset() {
  if (ASSETS.list.pedestrian) return ASSETS.list.pedestrian;
  // Teil-Baukasten: jeder Vertex bekommt (aPart, aSel)
  const geoFrom = (pieces) => {
    const mb = new MB(), part = [], sel = [];
    for (const [g, m, pt, sl] of pieces) {
      const v0 = mb.vc;
      mb.addGeom(g, m, null);
      for (let i = v0; i < mb.vc; i++) { part.push(pt); sel.push(sl); }
    }
    const geo = mb.build();
    geo.deleteAttribute('color');
    geo.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
    geo.setAttribute('aSel', new THREE.Float32BufferAttribute(sel, 1));
    return geo;
  };
  const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const SHIRT = 0, PANTS = 1, SKIN = 2, DARK = 3;
  const near = geoFrom([
    [box(0.42, 0.62, 0.24), T(0, 1.2, 0), 0, SHIRT],
    [new THREE.SphereGeometry(0.12, 12, 10), T(0, 1.66, 0), 0, SKIN],
    [new THREE.SphereGeometry(0.125, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), T(0, 1.69, 0), 0, DARK],
    [box(0.15, 0.82, 0.16), T(0.11, 0.45, 0), 1, PANTS],
    [box(0.15, 0.82, 0.16), T(-0.11, 0.45, 0), 2, PANTS],
    [box(0.16, 0.07, 0.26), T(0.11, 0.035, -0.04), 1, DARK],
    [box(0.16, 0.07, 0.26), T(-0.11, 0.035, -0.04), 2, DARK],
    [box(0.11, 0.62, 0.12), T(0.28, 1.17, 0), 3, SHIRT],
    [box(0.11, 0.62, 0.12), T(-0.28, 1.17, 0), 4, SHIRT],
    [new THREE.SphereGeometry(0.055, 6, 4), T(0.28, 0.83, 0), 3, SKIN],
    [new THREE.SphereGeometry(0.055, 6, 4), T(-0.28, 0.83, 0), 4, SKIN]
  ]);
  const far = geoFrom([
    [box(0.44, 0.7, 0.26), T(0, 1.18, 0), 0, SHIRT],
    [box(0.36, 0.84, 0.22), T(0, 0.42, 0), 0, PANTS],
    [box(0.22, 0.24, 0.22), T(0, 1.66, 0), 0, SKIN]
  ]);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  mat.onBeforeCompile = pedPatch(true);
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = pedPatch(false);
  const a = { name: 'pedestrian', kind: 'pedestrian', label: 'Fussgänger', near: [{ geo: near, mat }], far: [{ geo: far, mat }], depth };
  a.stats = { near: { tris: Math.round(triCount(near)), calls: 1 }, far: { tris: Math.round(triCount(far)), calls: 1 } };
  ASSETS.list.pedestrian = a;
  return a;
}

/* Menschenmenge: begin(), add() pro Person, end() */
class PedCrowd {
  constructor(parent, asset, max) {
    this.max = max;
    const mk = (src) => {
      const g = src.geo.clone();
      const at = (n) => new THREE.InstancedBufferAttribute(new Float32Array(max * n), n);
      g.setAttribute('iPhase', at(1)); g.setAttribute('iShirt', at(3)); g.setAttribute('iPants', at(3)); g.setAttribute('iSkin', at(3));
      const im = new THREE.InstancedMesh(g, src.mat, max);
      im.customDepthMaterial = asset.depth; im.userData.dynamic = true;
      im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; im.count = 0;
      parent.add(im);
      return im;
    };
    this.near = mk(asset.near[0]); this.far = mk(asset.far[0]);
    this.nn = 0; this.nf = 0;
  }
  begin() { this.nn = 0; this.nf = 0; }
  add(m4, phase, shirt, pants, skin, isNear) {
    const im = isNear ? this.near : this.far;
    if ((isNear ? this.nn : this.nf) >= this.max) return;
    const i = isNear ? this.nn++ : this.nf++;
    im.setMatrixAt(i, m4);
    const g = im.geometry;
    g.attributes.iPhase.array[i] = isNear ? phase : 0;
    g.attributes.iShirt.array.set([shirt.r, shirt.g, shirt.b], i * 3);
    g.attributes.iPants.array.set([pants.r, pants.g, pants.b], i * 3);
    g.attributes.iSkin.array.set([skin.r, skin.g, skin.b], i * 3);
  }
  end() {
    for (const [im, n] of [[this.near, this.nn], [this.far, this.nf]]) {
      im.count = n; im.instanceMatrix.needsUpdate = true;
      for (const k of ['iPhase', 'iShirt', 'iPants', 'iSkin']) im.geometry.attributes[k].needsUpdate = true;
    }
  }
}
