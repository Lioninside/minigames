/* ================= STRECKEN-DEKORATION =================
   Tunnel, Goldmine, schwarze Löcher, Planeten-Universum und die Tempolimit-Schilder. */

/* ================= TUNNELS ================= */

function buildTunnels() {
  const tunnelMat = new THREE.MeshStandardMaterial({ color: 0x15151d, side: THREE.BackSide, roughness: 0.9, metalness: 0.1 });
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x39e4ff, emissive: 0x39e4ff, emissiveIntensity: 1.3 });
  const neonPalette = [0x39e4ff, 0xff3cf0, 0x7cff3c, 0xffb020];

  trackSegments.filter(seg => seg.tunnel && !seg.goldmine).forEach(seg => {
    const pts = trackPoints.slice(seg.start, seg.end + 1);
    if (pts.length < 2) return;

    // die finale Tunnelstrecke ist als "wideTunnel" markiert und bekommt einen deutlich
    // groesseren Radius, damit Player- und alle vier KI-Schienen (bis zu ±28 versetzt) bequem
    // nebeneinander hineinpassen, statt nur die mittige Spieler-Schiene zu umschliessen.
    const tubeRadius = seg.wideTunnel ? 40 : 9.5;
    const ringRadius = seg.wideTunnel ? 38 : 9.2;
    const lightRange = seg.wideTunnel ? 90 : 40;

    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const tubeGeo = new THREE.TubeGeometry(curve, Math.max(20, pts.length), tubeRadius, 16, false);
    const tunnel = new THREE.Mesh(tubeGeo, tunnelMat);
    scene.add(tunnel);

    // glühende, farbig pulsierende Ringe als futuristische Tunnelbeleuchtung
    for (let i = seg.start; i <= seg.end; i += 14) {
      const p = trackPoints[i];
      const f = trackFrames[i];
      const mat = ringMat.clone();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(ringRadius, 0.18, 8, 20), mat);
      ring.position.copy(p);
      const m = new THREE.Matrix4().makeBasis(f.right, f.up, f.forward.clone().multiplyScalar(-1));
      ring.quaternion.setFromRotationMatrix(m);
      scene.add(ring);
      tunnelRings.push({ mesh: ring, mat, colorIndex: Math.floor(Math.random() * neonPalette.length), palette: neonPalette });
    }

    // echte Lichtquellen (sparsam platziert) fuer wirkliche Ausleuchtung der Tunnelwaende
    for (let i = seg.start; i <= seg.end; i += 56) {
      const p = trackPoints[i];
      const color = neonPalette[Math.floor(Math.random() * neonPalette.length)];
      const light = new THREE.PointLight(color, 1.6, lightRange, 2);
      light.position.copy(p);
      scene.add(light);
    }
  });

  buildGoldmineTunnels();
}

/* Tunnel im Goldminen-Look: raue Felswand, Holzstützbalken, glitzernde Goldnuggets, warme Laternen. */
function buildGoldmineTunnels() {
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a3323, side: THREE.BackSide, roughness: 1.0, metalness: 0.05 });
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffb020, emissiveIntensity: 1.2, metalness: 0.8, roughness: 0.3 });

  trackSegments.filter(seg => seg.goldmine).forEach(seg => {
    const pts = trackPoints.slice(seg.start, seg.end + 1);
    if (pts.length < 2) return;

    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const tubeGeo = new THREE.TubeGeometry(curve, Math.max(20, pts.length), 8.5, 10, false);
    scene.add(new THREE.Mesh(tubeGeo, rockMat));

    for (let i = seg.start; i <= seg.end; i += 16) {
      const p = trackPoints[i];
      const f = trackFrames[i];
      const m = new THREE.Matrix4().makeBasis(f.right, f.up, f.forward.clone().multiplyScalar(-1));
      const q = new THREE.Quaternion().setFromRotationMatrix(m);

      // A-Rahmen-Stützbalken (zwei schräge + ein Querbalken), wie im Minenschacht
      [-1, 1].forEach((s) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 8.5, 6), beamMat);
        post.position.copy(p).addScaledVector(f.right, s * 7).addScaledVector(f.up, -1);
        post.quaternion.copy(q);
        post.rotateZ(s * 0.25);
        scene.add(post);
      });
      const crossbeam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 15, 6), beamMat);
      crossbeam.position.copy(p).addScaledVector(f.up, 6.5);
      crossbeam.quaternion.copy(q);
      crossbeam.rotateX(Math.PI / 2);
      scene.add(crossbeam);

      // warme Laterne
      const lantern = new THREE.PointLight(0xffa040, 1.4, 35, 2);
      lantern.position.copy(p).addScaledVector(f.up, 4.5);
      scene.add(lantern);

      // glitzernde Goldnuggets an der Wand
      for (let k = 0; k < 3; k++) {
        const angle = Math.random() * Math.PI * 2;
        const nugget = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + Math.random() * 0.25, 0), goldMat);
        nugget.position.copy(p)
          .addScaledVector(f.right, Math.cos(angle) * 7.8)
          .addScaledVector(f.up, Math.sin(angle) * 7.8);
        scene.add(nugget);
      }
    }
  });
}

/* ================= SCHWARZES LOCH / ANDERES UNIVERSUM ================= */

function buildBlackHolePortal(color) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 24), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  group.add(core);

  const ringMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(11, 1.8, 16, 48), ringMat);
  group.add(ring);

  const ring2Mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.4, side: THREE.DoubleSide });
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(9, 0.9, 16, 48), ring2Mat);
  ring2.rotation.x = Math.PI / 3;
  group.add(ring2);

  const light = new THREE.PointLight(color, 2.2, 90, 2);
  group.add(light);

  scene.add(group);
  blackHoleVisuals.push({ group, ring, ring2 });
  return group;
}

/* Setzt an Anfang und Ende jedes "anderes Universum"-Abschnitts ein schwarzes Loch
   (einmal fuer Hin-, einmal fuer Rueckreise). Wird nur einmal fuer die geteilte
   Streckenmitte gebraucht, da alle drei Schienen dieselben Indizes verwenden. */
function buildBlackHoles() {
  getAltUniverseRanges().forEach((r) => {
    [{ idx: r.start, color: 0x8a3cff }, { idx: r.end, color: 0xff6a3c }].forEach(({ idx, color }) => {
      const p = trackPoints[idx];
      const f = trackFrames[idx];
      const portal = buildBlackHolePortal(color);
      portal.position.copy(p);
      const m = new THREE.Matrix4().makeBasis(f.right, f.up, f.forward.clone().multiplyScalar(-1));
      portal.quaternion.setFromRotationMatrix(m);
    });
  });
}

/* Baut die vier Fahrzeug-Wechsel-Portale (goldene schwarze Löcher) und merkt sich ihre
   Distanzen entlang der Strecke, damit jede Achterbahn beim Ueberqueren ihr Aussehen wechselt. */
function buildVehiclePortals() {
  const ranges = getVehiclePortalRanges();
  vehiclePortalDistances = ranges.map(r => cumLen[r.start]).sort((a, b) => a - b);
  ranges.forEach((r) => {
    const p = trackPoints[r.start];
    const f = trackFrames[r.start];
    const portal = buildBlackHolePortal(0xffd166); // goldenes Portal, unterscheidbar von den lila/orangen Universums-Portalen
    portal.position.copy(p);
    const m = new THREE.Matrix4().makeBasis(f.right, f.up, f.forward.clone().multiplyScalar(-1));
    portal.quaternion.setFromRotationMatrix(m);
  });
}

/* Streut rund um die Schiene EINER Achterbahn (player/rote KI/gruene KI) thematisch
   ganz anders aussehende, leuchtende Formen -> jede Bahn bekommt ihren eigenen
   "Universum"-Look fuer den Bereich zwischen den beiden schwarzen Loechern. */
function buildUniverseDecor(pts, range, theme) {
  for (let i = range.start; i <= range.end; i += 18) {
    const p = pts[i];
    const f = trackFrames[i];
    const color = theme.colors[Math.floor(Math.random() * theme.colors.length)];
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.4, metalness: 0.2 });
    let geo;
    if (theme.shape === 'crystal') geo = new THREE.OctahedronGeometry(1.8 + Math.random() * 2.6, 0);
    else if (theme.shape === 'lava') geo = new THREE.SphereGeometry(1.3 + Math.random() * 2.2, 8, 8);
    else geo = new THREE.IcosahedronGeometry(1.4 + Math.random() * 2.4, 0);

    const mesh = new THREE.Mesh(geo, mat);
    const outward = (Math.random() - 0.5) * 34;
    const vertical = Math.random() * 26 - 4;
    mesh.position.copy(p).addScaledVector(f.right, outward).addScaledVector(f.up, vertical);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    scene.add(mesh);
  }
}

/* Das "sehr krasse": ein dichtes Feld aus vielen kleinen und grossen Planeten, durch das
   sich die Strecke hindurchschlängelt, plus ein riesiger Ring-Gasriese und eine Sonne
   mit echtem Licht als dramatischer Blickfang. */
function buildPlanetUniverse(range) {
  const palette = [0x66aaff, 0xffaa55, 0xff5566, 0x88ff66, 0xaa66ff, 0xffee66, 0x66ffee, 0xff88cc, 0xcccccc];
  const span = range.end - range.start;

  for (let k = 0; k < 70; k++) {
    const idx = range.start + Math.floor(Math.random() * span);
    const p = trackPoints[idx];
    const f = trackFrames[idx];
    const size = 3 + Math.random() * Math.random() * 55; // meist klein, ab und zu richtig gross
    const color = palette[Math.floor(Math.random() * palette.length)];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.15, emissive: color, emissiveIntensity: 0.18 });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(size, 20, 16), mat);

    // Abstand so wählen, dass die nächste Planetenoberfläche immer klar ausserhalb ALLER
    // fünf Bahnen (bis ±28 seitlich) liegt -> die Fahrbahnen führen aussen um die Planeten
    // herum statt durch sie hindurch.
    const dist = size + 55 + Math.random() * 90;
    const angle = Math.random() * Math.PI * 2;
    planet.position.copy(p)
      .addScaledVector(f.right, Math.cos(angle) * dist)
      .addScaledVector(f.up, Math.sin(angle) * dist);
    scene.add(planet);
    planetMeshes.push({ mesh: planet, spin: (Math.random() - 0.5) * 0.3 });

    if (Math.random() < 0.25) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(size * 1.4, size * 2.1, 32),
        new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.6, roughness: 0.8 })
      );
      ring.position.copy(planet.position);
      ring.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.6;
      ring.rotation.y = Math.random() * Math.PI;
      scene.add(ring);
    }
  }

  // Riesiger Ring-Gasriese direkt an der Strecke -> man fliegt fast durch seinen Ring
  const bigIdx = range.start + Math.floor(span * 0.5);
  const bp = trackPoints[bigIdx];
  const bf = trackFrames[bigIdx];
  const huge = new THREE.Mesh(
    new THREE.SphereGeometry(120, 32, 24),
    new THREE.MeshStandardMaterial({ color: 0xffb347, roughness: 0.5, emissive: 0xff8800, emissiveIntensity: 0.25 })
  );
  // klar zur Seite versetzt (Radius 120 + Sicherheitsabstand), damit die Bahnen aussen
  // an ihm vorbeiführen; nur sein flacher, transparenter Ring reicht bis nahe an die Strecke.
  huge.position.copy(bp).addScaledVector(bf.right, 240).addScaledVector(bf.up, 15);
  scene.add(huge);
  planetMeshes.push({ mesh: huge, spin: 0.05 });

  const hugeRing = new THREE.Mesh(
    new THREE.RingGeometry(160, 230, 48),
    new THREE.MeshStandardMaterial({ color: 0xffe0a0, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
  );
  hugeRing.position.copy(huge.position);
  hugeRing.rotation.x = Math.PI / 2 + 0.3;
  scene.add(hugeRing);

  // Leuchtende Sonne mit echtem Licht fuer dramatische Beleuchtung im Planetenfeld
  const sunIdx = range.start + Math.floor(span * 0.25);
  const sp = trackPoints[sunIdx];
  const sf = trackFrames[sunIdx];
  const sun = new THREE.Mesh(new THREE.SphereGeometry(45, 24, 24), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  sun.position.copy(sp).addScaledVector(sf.right, -150).addScaledVector(sf.up, 60);
  scene.add(sun);
  const sunLight = new THREE.PointLight(0xfff2b0, 3.5, 700, 2);
  sunLight.position.copy(sun.position);
  scene.add(sunLight);
}

/* ================= SPEED SIGNS ================= */

function makeSignTexture(number) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(128, 128, 118, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 22;
  ctx.strokeStyle = '#e0272c';
  ctx.beginPath(); ctx.arc(128, 128, 107, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 96px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), 128, 140);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function buildSigns() {
  const limits = [600, 700, 750, 800, 850, 850, 1000, 1000, 1000]; // 1x600, 1x700, 1x750, 1x800, 2x850, 3x1000
  const count = limits.length;
  const spacing = totalLength / count;
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x555560 });

  for (let s = 0; s < count; s++) {
    const dist = (s + 0.5) * spacing;
    // find nearest index
    let idx = 0;
    while (idx < cumLen.length - 1 && cumLen[idx] < dist) idx++;
    const p = trackPoints[idx];
    const f = trackFrames[idx];
    const side = (s % 2 === 0) ? 1 : -1;
    const basePos = p.clone().addScaledVector(f.right, side * 7).addScaledVector(f.up, -2.5);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3.5, 6), poleMat);
    pole.position.copy(basePos);
    scene.add(pole);

    const limit = limits[s % limits.length];
    const tex = makeSignTexture(limit);
    const spriteMat = new THREE.SpriteMaterial({ map: tex });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(4.2, 4.2, 1);
    sprite.position.copy(basePos).addScaledVector(f.up, 2.2);
    scene.add(sprite);

    signList.push({ dist: dist, limit: limit });
  }
  signList.sort((a, b) => a.dist - b.dist);
}

function getCurrentLimit(dist) {
  let limit = 750; // default before first sign (sicher: MAX_SPEED 850 - OVERSPEED_MARGIN 100 = 750)
  for (let i = 0; i < signList.length; i++) {
    if (signList[i].dist <= dist) limit = signList[i].limit;
    else break;
  }
  return limit;
}
