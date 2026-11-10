/* ================= ASSET: AUTO =================
   Zwei Detailstufen, beide instanziert (alle Autos teilen sich dieselben Meshes):
     near: Karosserie (Lack, Farbe pro Auto), Glas, Räder/Stossstangen, Lichter = 4 Draw-Calls
     far:  ein zusammengefasster Kasten (Farbe pro Auto)                       = 1 Draw-Call
   InstancedLOD verteilt jedes Bild die Autos nach Entfernung auf die beiden Stufen. */

function buildCarAsset() {
  if (ASSETS.list.car) return ASSETS.list.car;
  initAssetMats();
  const body = new THREE.Shape();
  body.moveTo(-2.25, 0.3); body.lineTo(2.18, 0.3); body.quadraticCurveTo(2.32, 0.32, 2.32, 0.58); body.lineTo(2.25, 0.8);
  body.quadraticCurveTo(1.7, 0.88, 1.0, 0.93); body.lineTo(-1.65, 0.96); body.quadraticCurveTo(-2.2, 0.92, -2.28, 0.78); body.lineTo(-2.3, 0.45); body.closePath();
  const bg = new THREE.ExtrudeGeometry(body, { depth: 1.72, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 6 });
  bg.translate(0, 0, -0.86);
  const cab = new THREE.Shape();
  cab.moveTo(1.0, 0.9); cab.quadraticCurveTo(0.55, 1.3, 0.25, 1.42); cab.lineTo(-1.15, 1.45); cab.quadraticCurveTo(-1.55, 1.3, -1.75, 0.93); cab.closePath();
  const cg = new THREE.ExtrudeGeometry(cab, { depth: 1.56, bevelEnabled: false, curveSegments: 6 });
  cg.translate(0, 0, -0.78);
  const roof = new THREE.BoxGeometry(1.3, 0.05, 1.5); roof.translate(-0.45, 1.46, 0);
  const I = new THREE.Matrix4();
  const mbBody = new MB(); mbBody.addGeom(bg, I, null); mbBody.addGeom(roof, I, null);
  const mbGlass = new MB(); mbGlass.addGeom(cg, I, null);
  const mbTrim = new MB();
  const wg = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14); wg.rotateX(Math.PI / 2);
  const dark = lin(0x151515);
  for (const x of [1.42, -1.38]) for (const z of [0.8, -0.8]) mbTrim.addGeom(wg, new THREE.Matrix4().makeTranslation(x, 0.33, z), dark);
  mbTrim.box(2.33, 0.4, 0, 0.06, 0.18, 1.6, 0, dark); mbTrim.box(-2.32, 0.4, 0, 0.06, 0.18, 1.6, 0, dark);
  const mbLight = new MB();
  const head = lin(0xfff6dc), tail = lin(0xff1a1a);
  mbLight.box(2.3, 0.66, 0.6, 0.05, 0.12, 0.32, 0, head); mbLight.box(2.3, 0.66, -0.6, 0.05, 0.12, 0.32, 0, head);
  mbLight.box(-2.3, 0.7, 0.62, 0.05, 0.14, 0.3, 0, tail); mbLight.box(-2.3, 0.7, -0.62, 0.05, 0.14, 0.3, 0, tail);
  // Fernversion: Unterbau (Lackfarbe), Kabine dunkel, Räder dunkel
  const mbFar = new MB();
  mbFar.box(0, 0.62, 0, 4.55, 0.62, 1.78, 0, lin(0xffffff), null, true);
  mbFar.box(-0.35, 1.18, 0, 2.6, 0.5, 1.58, 0, lin(0x1c262e), null, false);
  mbFar.box(0, 0.3, 0, 3.6, 0.3, 1.6, 0, dark, null, true);
  const rot = new THREE.Matrix4().makeRotationY(-Math.PI / 2); // Länge entlang +z (Fahrtrichtung)
  const g = (mb) => { const x = mb.build(); x.applyMatrix4(rot); return x; };
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.08 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x14202a, roughness: 0.05, metalness: 0.3, envMapIntensity: 1.5 });
  const M = ASSETS.mats;
  const bodyG = g(mbBody); bodyG.deleteAttribute('color');
  const glassG = g(mbGlass); glassG.deleteAttribute('color');
  const a = {
    name: 'car', kind: 'car', label: 'Auto',
    near: [
      { geo: bodyG, mat: paint, tint: true, cast: true, key: 'body' },
      { geo: glassG, mat: glass, tint: false, cast: false, key: 'glass' },
      { geo: g(mbTrim), mat: M.matte, tint: false, cast: true, key: 'trim' },
      { geo: g(mbLight), mat: M.light, tint: false, cast: false, key: 'light' }
    ],
    far: [{ geo: g(mbFar), mat: M.mid, tint: true, cast: false, key: 'far' }]
  };
  a.stats = {
    near: { tris: Math.round(a.near.reduce((s, p) => s + triCount(p.geo), 0)), calls: a.near.length },
    far: { tris: Math.round(a.far.reduce((s, p) => s + triCount(p.geo), 0)), calls: a.far.length }
  };
  ASSETS.list.car = a;
  return a;
}

/* Instanzierte Detailstufen: jedes Bild begin(), dann add() pro Objekt, dann end() */
class InstancedLOD {
  constructor(parent, asset, max) {
    this.max = max;
    const mk = (p) => {
      const im = new THREE.InstancedMesh(p.geo, p.mat, max);
      im.frustumCulled = false; im.castShadow = !!p.cast; im.receiveShadow = true;
      im.userData.tint = !!p.tint; im.userData.dynamic = true;
      if (p.tint) im.setColorAt(0, new THREE.Color(1, 1, 1));
      im.count = 0;
      parent.add(im);
      return im;
    };
    this.near = asset.near.map(mk);
    this.far = asset.far.map(mk);
    this.nn = 0; this.nf = 0;
  }
  begin() { this.nn = 0; this.nf = 0; }
  add(m4, col, isNear) {
    const list = isNear ? this.near : this.far;
    const i = isNear ? this.nn++ : this.nf++;
    for (const im of list) { im.setMatrixAt(i, m4); if (im.userData.tint) im.setColorAt(i, col); }
  }
  end() {
    for (const im of this.near) { im.count = this.nn; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    for (const im of this.far) { im.count = this.nf; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
}
