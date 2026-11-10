/* ================= VERDECKUNGS-CULLING (Occlusion Horizon) =================
   In einer Stadt verdecken die nahen Häuser fast alles dahinter. Aus allen Gebäuden im Umkreis
   von OCC.R wird ein 360°-„Horizont“ berechnet: pro Blickrichtung (Spalte) der Höhenwinkel,
   bis zu dem sicher alles verdeckt ist, und ab welchem unteren Winkel. Ein entfernter Bereich
   (Gebäudezelle, Baumkachel, Strassenkachel) wird nicht gezeichnet, wenn er in allen Spalten,
   die er überdeckt, vollständig innerhalb dieses verdeckten Bandes liegt.
   Getestet werden nur Bereiche, die weiter weg sind als alle verdeckenden Häuser (OCC.TEST),
   dadurch ist das Verfahren konservativ: Es blendet nie etwas aus, das sichtbar wäre. */

const OCC = {
  COLS: 1024, R: 220, TEST: 270,
  hi: new Float32Array(1024), lo: new Float32Array(1024),
  items: [], enabled: true, lastX: 1e9, lastZ: 1e9, lastY: 1e9, t: 0, culled: 0, tested: 0
};

/* Bereich anmelden: {x, z, hx, hz} = Rechteck (Mitte, halbe Ausdehnung), minY/maxY */
function occRegister(item) { item.occluded = false; OCC.items.push(item); return item; }

function occBuildHorizon(ex, ey, ez) {
  const C = OCC.COLS, hi = OCC.hi, lo = OCC.lo, R = OCC.R, TWO_PI = Math.PI * 2;
  hi.fill(-10); lo.fill(10);
  BLD.hash.query(ex - R, ez - R, ex + R, ez + R, (box) => {
    if (box.bottom !== undefined || box.lift) return;
    const o = box.obb;
    if (obbContains(o, ex, ez, 1)) return;
    const top = box.hip ? box.top - box.hipH : box.top;
    if (top < ey + 1) return; // flache Bauten unter Augenhöhe verdecken kaum etwas
    const base = box.b ? box.b.base : top - 10;
    const cs = obbCorners(o, 0);
    let a0 = 0, amin = 1e9, amax = -1e9, eTop = 1e9, eBot = -1e9, dmax = 0;
    for (let k = 0; k < 4; k++) {
      const dx = cs[k][0] - ex, dz = cs[k][1] - ez, d = Math.hypot(dx, dz);
      if (d > R + 40) return;
      let a = Math.atan2(dz, dx);
      if (k === 0) a0 = a; else a = a0 + angDiff(a0, a);
      if (a < amin) amin = a; if (a > amax) amax = a;
      const et = Math.atan2(top - ey, d), eb = Math.atan2(base - ey, d);
      if (et < eTop) eTop = et;   // unterste Oberkante (konservativ)
      if (eb > eBot) eBot = eb;   // oberste Unterkante (konservativ)
      if (d > dmax) dmax = d;
    }
    if (amax - amin > Math.PI * 0.9) return;
    // innere Spalten vollständig abgedeckt
    const c0 = Math.ceil(((amin + Math.PI) / TWO_PI) * C), c1 = Math.floor(((amax + Math.PI) / TWO_PI) * C);
    for (let c = c0; c <= c1; c++) {
      const ci = ((c % C) + C) % C;
      if (eTop > hi[ci]) { hi[ci] = eTop; lo[ci] = eBot; }
    }
  });
}

function occTestItem(it, ex, ey, ez) {
  // nächster Punkt des Rechtecks
  const qx = clamp(ex, it.x - it.hx, it.x + it.hx), qz = clamp(ez, it.z - it.hz, it.z + it.hz);
  const dmin = Math.hypot(qx - ex, qz - ez);
  if (dmin < OCC.TEST) return false;
  const C = OCC.COLS, TWO_PI = Math.PI * 2, hi = OCC.hi, lo = OCC.lo;
  const eTop = Math.atan2(it.maxY - ey, dmin), eBot = Math.atan2(it.minY - ey, dmin);
  // Winkelbereich der vier Ecken
  let a0 = 0, amin = 1e9, amax = -1e9;
  const xs = [it.x - it.hx, it.x + it.hx], zs = [it.z - it.hz, it.z + it.hz];
  let k = 0;
  for (const x of xs) for (const z of zs) {
    let a = Math.atan2(z - ez, x - ex);
    if (k++ === 0) a0 = a; else a = a0 + angDiff(a0, a);
    if (a < amin) amin = a; if (a > amax) amax = a;
  }
  const c0 = Math.floor(((amin + Math.PI) / TWO_PI) * C), c1 = Math.ceil(((amax + Math.PI) / TWO_PI) * C);
  for (let c = c0; c <= c1; c++) {
    const ci = ((c % C) + C) % C;
    if (!(hi[ci] >= eTop && lo[ci] <= eBot)) return false;
  }
  return true;
}

/* Jedes Bild aufrufen; rechnet nur neu, wenn sich die Kamera bewegt hat oder Zeit vergangen ist */
function occUpdate(cam, dt, active) {
  OCC.t -= dt;
  const p = cam.position;
  if (!active || !OCC.enabled) {
    if (OCC.culled) { for (const it of OCC.items) it.occluded = false; OCC.culled = 0; }
    return;
  }
  const moved = Math.abs(p.x - OCC.lastX) + Math.abs(p.z - OCC.lastZ) + Math.abs(p.y - OCC.lastY);
  if (moved < 2 && OCC.t > 0) return;
  OCC.t = 0.5; OCC.lastX = p.x; OCC.lastZ = p.z; OCC.lastY = p.y;
  occBuildHorizon(p.x, p.y, p.z);
  let n = 0;
  for (const it of OCC.items) { it.occluded = occTestItem(it, p.x, p.y, p.z); if (it.occluded) n++; }
  OCC.culled = n; OCC.tested = OCC.items.length;
  LOD.t = 0; // Sichtbarkeit sofort neu setzen
}

/* Kachel-Meshes (Strassen, Ausstattung, Quaimauern) über ihre Bounding-Box anmelden */
function occRegisterChunkMeshes(root) {
  root.traverse(o => {
    if (!o.isMesh || !o.name || !o.name.startsWith('chunk:') || o.name === 'chunk:atlas') return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox;
    const it = occRegister({ x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2, hx: (b.max.x - b.min.x) / 2, hz: (b.max.z - b.min.z) / 2, minY: b.min.y, maxY: b.max.y, mesh: o });
    LOD.generic.push(it);
  });
}
