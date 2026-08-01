/* ================= WELTEN =================
   Sternenfeld und die Umgebung jedes Levels (Stadt, Wüste, Dschungel, Meer, Mond, Eis, Schloss)
   samt Themenwechsel. Ein neues Level braucht hier eine Deko-Funktion und einen Eintrag in
   LEVEL_THEMES (config.js). */

/* ================= WELTALL / STERNENFELD ================= */

function buildStarfield() {
  // alle Sternobjekte in eine Gruppe legen -> in Nicht-Weltall-Leveln komplett ausblendbar
  starGroup = new THREE.Group();
  scene.add(starGroup);
  // Grosses Feld aus vielen kleinen, leuchtenden Punktsternen rundum
  const starCount = 6000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const palette = [
    [1, 1, 1], [0.75, 0.85, 1], [1, 0.9, 0.75], [0.8, 0.95, 1], [1, 0.8, 0.9]
  ];
  for (let i = 0; i < starCount; i++) {
    // gleichmässig auf einer grossen Kugelschale verteilen, damit man nie an den Rand kommt
    const radius = 900 + Math.random() * 1600;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

    const c = palette[Math.floor(Math.random() * palette.length)];
    const brightness = 0.5 + Math.random() * 0.5;
    colors[i * 3] = c[0] * brightness;
    colors[i * 3 + 1] = c[1] * brightness;
    colors[i * 3 + 2] = c[2] * brightness;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const starMat = new THREE.PointsMaterial({ size: 3.2, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.95 });
  starGroup.add(new THREE.Points(starGeo, starMat));

  // ein paar grössere, kräftig leuchtende "nahe" Sterne für Tiefe
  const bigStarMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 60; i++) {
    const radius = 400 + Math.random() * 500;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const star = new THREE.Mesh(new THREE.SphereGeometry(1.2 + Math.random() * 1.8, 6, 6), bigStarMat.clone());
    star.material.color.setHSL(Math.random(), 0.4, 0.85);
    star.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
    starGroup.add(star);
  }
}

/* ================= LEVEL-WELTEN (Ort-Deko pro Level) ================= */

/* Achsen-ausgerichtete Bounding-Box aller Streckenpunkte -> fuer Bodenhoehe/-groesse der Welten. */
function getTrackBounds() {
  const box = new THREE.Box3();
  trackPoints.forEach(p => box.expandByPoint(p));
  return box;
}

/* Grosser, flacher Boden (Plane) knapp unterhalb der tiefsten Streckenstelle, passend zur Welt. */
function buildGround(color, y, box, opts = {}) {
  const sizeX = (box.max.x - box.min.x) + 2600;
  const sizeZ = (box.max.z - box.min.z) + 2600;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.95, metalness: opts.metalness ?? 0.0 });
  if (opts.transparent) { mat.transparent = true; mat.opacity = opts.opacity ?? 1; }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(sizeX, sizeZ, 1, 1), mat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((box.min.x + box.max.x) / 2, y, (box.min.z + box.max.z) / 2);
  return ground;
}

/* Ruft cb(p, i) an gleichmaessig verteilten Streckenpunkten auf -> Standorte fuer Deko entlang der Bahn. */
function forEachTrackSpot(step, cb) {
  for (let i = 0; i < trackPoints.length; i += step) cb(trackPoints[i], i);
}

/* Level 2 – Grossstadt: dunkler Asphaltboden + viele Hochhaeuser mit leuchtenden Fenstern. */
function buildCityDecor(box, groundY) {
  const g = new THREE.Group();
  g.add(buildGround(0x1c1f28, groundY, box, { roughness: 0.9 }));
  const windowColors = [0x00e5ff, 0xffe066, 0xff7ac0, 0x8fff6a];
  forEachTrackSpot(9, (p) => {
    for (let s = -1; s <= 1; s += 2) {
      if (Math.random() < 0.35) continue;
      const w = 10 + Math.random() * 16;
      const d = 10 + Math.random() * 16;
      const h = 30 + Math.random() * Math.random() * 180;
      const winCol = windowColors[Math.floor(Math.random() * windowColors.length)];
      const mat = new THREE.MeshStandardMaterial({ color: 0x2a2f3c, roughness: 0.6, metalness: 0.3, emissive: winCol, emissiveIntensity: 0.22 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      const off = 60 + Math.random() * 240;
      b.position.set(p.x + s * off + (Math.random() - 0.5) * 40, groundY + h / 2, p.z + (Math.random() - 0.5) * 120);
      g.add(b);
    }
  });
  return g;
}

/* Level 3 – Wüste: sandfarbener Boden + flache Dünen + ein paar Kakteen. */
function buildDesertDecor(box, groundY) {
  const g = new THREE.Group();
  g.add(buildGround(0xd9b36a, groundY, box, { roughness: 1.0 }));
  const duneMat = new THREE.MeshStandardMaterial({ color: 0xcaa25a, roughness: 1.0 });
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.8 });
  forEachTrackSpot(11, (p) => {
    for (let s = -1; s <= 1; s += 2) {
      const off = 50 + Math.random() * 260;
      const bx = p.x + s * off + (Math.random() - 0.5) * 50;
      const bz = p.z + (Math.random() - 0.5) * 120;
      if (Math.random() < 0.6) {
        const r = 20 + Math.random() * 60;
        const dune = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), duneMat);
        dune.scale.y = 0.22 + Math.random() * 0.15;
        dune.position.set(bx, groundY, bz);
        g.add(dune);
      } else {
        const hgt = 6 + Math.random() * 10;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, hgt, 8), cactusMat);
        trunk.position.set(bx, groundY + hgt / 2, bz);
        g.add(trunk);
        for (let a = 0; a < 2; a++) {
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, hgt * 0.5, 6), cactusMat);
          arm.position.set(bx + (a ? 1 : -1) * 1.4, groundY + hgt * 0.6, bz);
          arm.rotation.z = (a ? -1 : 1) * 0.9;
          g.add(arm);
        }
      }
    }
  });
  return g;
}

/* Level 4 – Dschungel: grüner Boden + dichte Bäume (Stamm + Blätterkugeln). */
function buildJungleDecor(box, groundY) {
  const g = new THREE.Group();
  g.add(buildGround(0x2f6a2f, groundY, box, { roughness: 1.0 }));
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9 });
  const leafMats = [0x1f7d2a, 0x2c9c3a, 0x3fb54a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
  forEachTrackSpot(9, (p) => {
    for (let s = -1; s <= 1; s += 2) {
      if (Math.random() < 0.2) continue;
      const off = 40 + Math.random() * 240;
      const bx = p.x + s * off + (Math.random() - 0.5) * 60;
      const bz = p.z + (Math.random() - 0.5) * 130;
      const hgt = 16 + Math.random() * 26;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.7, hgt, 7), trunkMat);
      trunk.position.set(bx, groundY + hgt / 2, bz);
      g.add(trunk);
      const leafMat = leafMats[Math.floor(Math.random() * leafMats.length)];
      for (let k = 0; k < 2; k++) {
        const r = 5 + Math.random() * 5;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 7), leafMat);
        leaf.position.set(bx + (Math.random() - 0.5) * 6, groundY + hgt + (Math.random() - 0.3) * 6, bz + (Math.random() - 0.5) * 6);
        g.add(leaf);
      }
    }
  });
  return g;
}

/* Ein einzelner Hai: grauer, spindelförmiger Körper + Rückenflosse + Schwanzflosse. */
function buildShark() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x5a6773, roughness: 0.7, metalness: 0.1 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xd7dde2, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 10), bodyMat);
  body.scale.set(1, 0.7, 3.0); // langgezogen
  g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(2.0, 12, 8), bellyMat);
  belly.scale.set(0.9, 0.4, 2.6);
  belly.position.y = -0.5;
  g.add(belly);
  // Rückenflosse (ragt aus dem Wasser)
  const finMat = bodyMat;
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.4, 4), finMat);
  dorsal.position.set(0, 1.6, 0.3);
  dorsal.rotation.y = Math.PI / 4;
  g.add(dorsal);
  // Schwanzflosse
  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.6, 4), finMat);
  tail.position.set(0, 0.4, -6.4);
  tail.rotation.x = -Math.PI / 2;
  tail.rotation.z = Math.PI / 4;
  g.add(tail);
  // Seitenflossen
  [-1, 1].forEach((s) => {
    const pec = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.2, 4), finMat);
    pec.position.set(s * 1.6, -0.4, 1.5);
    pec.rotation.z = s * Math.PI / 2.2;
    g.add(pec);
  });
  return g;
}

/* Level 5 – Meer: grosse (leicht transparente) Wasserfläche + Sandinseln mit Palmen + kreisende Haie. */
function buildOceanDecor(box, groundY) {
  const g = new THREE.Group();
  const waterY = groundY + 6;
  g.add(buildGround(0x2f7fb0, waterY, box, { roughness: 0.25, metalness: 0.5, transparent: true, opacity: 0.82 }));
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xe6d18a, roughness: 1.0 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.9 });
  const palmMat = new THREE.MeshStandardMaterial({ color: 0x2c9c3a, roughness: 0.85 });
  swimmers = [];
  forEachTrackSpot(12, (p, i) => {
    if (Math.random() < 0.5) return;
    const s = Math.random() < 0.5 ? -1 : 1;
    const off = 60 + Math.random() * 260;
    const bx = p.x + s * off + (Math.random() - 0.5) * 60;
    const bz = p.z + (Math.random() - 0.5) * 140;
    const r = 18 + Math.random() * 40;
    const island = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), sandMat);
    island.scale.y = 0.16;
    island.position.set(bx, waterY, bz);
    g.add(island);
    const hgt = 10 + Math.random() * 8;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, hgt, 6), trunkMat);
    trunk.position.set(bx, waterY + hgt / 2, bz);
    trunk.rotation.z = 0.15;
    g.add(trunk);
    for (let a = 0; a < 5; a++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.2, 7, 5), palmMat);
      frond.position.set(bx, waterY + hgt, bz);
      frond.rotation.z = Math.PI / 2;
      frond.rotation.y = (a / 5) * Math.PI * 2;
      frond.translateY(3);
      g.add(frond);
    }
    // ein paar Haie, die um die Inseln kreisen
    if (i % 24 === 0) {
      const shark = buildShark();
      const cx = p.x + s * (off + 20), cz = p.z;
      shark.position.set(cx, waterY, cz);
      g.add(shark);
      swimmers.push({ mesh: shark, cx, cz, radius: 40 + Math.random() * 60, angle: Math.random() * Math.PI * 2, speed: 0.25 + Math.random() * 0.3, y: waterY });
    }
  });
  return g;
}

/* Level 6 – Mondlandschaft: graue Oberfläche mit Kratern (Ringe) und verstreuten Felsen. */
function buildMoonDecor(box, groundY) {
  const g = new THREE.Group();
  g.add(buildGround(0x8a8f98, groundY, box, { roughness: 1.0 }));
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x767b84, roughness: 1.0 });
  const craterMat = new THREE.MeshStandardMaterial({ color: 0x5e636b, roughness: 1.0, side: THREE.DoubleSide });
  forEachTrackSpot(7, (p) => {
    for (let s = -1; s <= 1; s += 2) {
      const off = 45 + Math.random() * 300;
      const bx = p.x + s * off + (Math.random() - 0.5) * 60;
      const bz = p.z + (Math.random() - 0.5) * 130;
      if (Math.random() < 0.55) {
        // Krater: flacher Ring auf dem Boden
        const rad = 8 + Math.random() * 34;
        const crater = new THREE.Mesh(new THREE.RingGeometry(rad * 0.6, rad, 20), craterMat);
        crater.rotation.x = -Math.PI / 2;
        crater.position.set(bx, groundY + 0.2, bz);
        g.add(crater);
      } else {
        const r = 2 + Math.random() * 7;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat);
        rock.position.set(bx, groundY + r * 0.4, bz);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        g.add(rock);
      }
    }
  });
  return g;
}

/* Ein stilisierter Eisbär: weisser Körper, Kopf, vier Beine. */
function buildPolarBear() {
  const g = new THREE.Group();
  const furMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.95 });
  const noseMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 10), furMat);
  body.scale.set(1, 0.9, 1.7);
  body.position.y = 2.4;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 10), furMat);
  head.position.set(0, 3.4, 2.8);
  g.add(head);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), furMat);
  snout.scale.set(1, 0.8, 1.4);
  snout.position.set(0, 3.1, 3.9);
  g.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), noseMat);
  nose.position.set(0, 3.2, 4.6);
  g.add(nose);
  [-1, 1].forEach((sx) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), furMat);
    ear.position.set(sx * 0.7, 4.3, 2.6);
    g.add(ear);
    [1.6, -1.6].forEach((pz) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 2.4, 8), furMat);
      leg.position.set(sx * 1.1, 1.1, pz);
      g.add(leg);
    });
  });
  return g;
}

/* Level 7 – Eislandschaft: weisser Eisboden, Eisschollen/-blöcke und ein paar Eisbären. */
function buildIceDecor(box, groundY) {
  const g = new THREE.Group();
  g.add(buildGround(0xdff1fb, groundY, box, { roughness: 0.4, metalness: 0.2 }));
  const iceMat = new THREE.MeshStandardMaterial({ color: 0xbfe6f5, roughness: 0.3, metalness: 0.25, transparent: true, opacity: 0.9 });
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  forEachTrackSpot(11, (p, i) => {
    for (let s = -1; s <= 1; s += 2) {
      const off = 45 + Math.random() * 280;
      const bx = p.x + s * off + (Math.random() - 0.5) * 60;
      const bz = p.z + (Math.random() - 0.5) * 130;
      if (Math.random() < 0.5) {
        // gezackter Eisblock
        const r = 6 + Math.random() * 22;
        const berg = new THREE.Mesh(new THREE.ConeGeometry(r, r * (1.2 + Math.random()), 5), iceMat);
        berg.position.set(bx, groundY + r * 0.6, bz);
        berg.rotation.y = Math.random() * Math.PI;
        g.add(berg);
      } else {
        const r = 8 + Math.random() * 20;
        const mound = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), snowMat);
        mound.scale.y = 0.4;
        mound.position.set(bx, groundY, bz);
        g.add(mound);
      }
    }
    // ab und zu ein Eisbär direkt neben der Strecke
    if (i % 10 === 0) {
      const bear = buildPolarBear();
      const s = Math.random() < 0.5 ? -1 : 1;
      bear.position.set(p.x + s * (30 + Math.random() * 40), groundY, p.z + (Math.random() - 0.5) * 40);
      bear.rotation.y = Math.random() * Math.PI * 2;
      g.add(bear);
    }
  });
  return g;
}

/* Schluss-Welt – Schloss-Duell: ein riesiges Ritterschloss (Mauern, Türme, Fahnen) rund um die Strecke. */
function buildCastleDecor(box, groundY) {
  const g = new THREE.Group();
  g.add(buildGround(0x3a5a32, groundY, box, { roughness: 1.0 })); // Wiese
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x7a2233, roughness: 0.8 });
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, emissive: 0x3a2f0a, roughness: 0.6, side: THREE.DoubleSide });
  forEachTrackSpot(13, (p) => {
    for (let s = -1; s <= 1; s += 2) {
      const off = 70 + Math.random() * 220;
      const bx = p.x + s * off + (Math.random() - 0.5) * 40;
      const bz = p.z + (Math.random() - 0.5) * 120;
      if (Math.random() < 0.5) {
        // Rundturm mit Kegeldach + Fahne
        const h = 40 + Math.random() * 90;
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, h, 12), stoneMat);
        tower.position.set(bx, groundY + h / 2, bz);
        g.add(tower);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(12, 22, 12), roofMat);
        roof.position.set(bx, groundY + h + 11, bz);
        g.add(roof);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 12, 6), stoneMat);
        pole.position.set(bx, groundY + h + 28, bz);
        g.add(pole);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(7, 4), flagMat);
        flag.position.set(bx + 3.7, groundY + h + 31, bz);
        g.add(flag);
      } else {
        // Mauerabschnitt mit Zinnen
        const w = 24 + Math.random() * 30, h = 26 + Math.random() * 24;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), stoneMat);
        wall.position.set(bx, groundY + h / 2, bz);
        g.add(wall);
        const n = Math.floor(w / 10);
        for (let c = 0; c < n; c++) {
          const merlon = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4, 8), stoneMat);
          merlon.position.set(bx - w / 2 + 3 + c * 6, groundY + h + 2, bz);
          g.add(merlon);
        }
      }
    }
  });
  return g;
}

/* Baut alle Level-Welten einmal auf (anfangs unsichtbar) und blendet sie später per Level ein/aus. */
/* Friert die statischen Transforms einer Gruppe ein (kein Neuberechnen der Matrix pro Frame). */
function freezeStatic(group) {
  group.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); });
}

function buildLevelWorlds() {
  const box = getTrackBounds();
  const groundY = box.min.y - 14;
  placeGroups.city = buildCityDecor(box, groundY);
  placeGroups.desert = buildDesertDecor(box, groundY);
  placeGroups.jungle = buildJungleDecor(box, groundY);
  placeGroups.ocean = buildOceanDecor(box, groundY);
  placeGroups.moon = buildMoonDecor(box, groundY);
  placeGroups.ice = buildIceDecor(box, groundY);
  placeGroups.castle = buildCastleDecor(box, groundY);
  // Statische Deko einfrieren; nur die animierten Haie brauchen weiterhin Auto-Updates.
  Object.values(placeGroups).forEach(g => freezeStatic(g));
  swimmers.forEach(s => { s.mesh.matrixAutoUpdate = true; });
  // WICHTIG: Welten werden NICHT alle in die Szene gehängt - nur die jeweils aktive (applyTheme).
}

/* Wendet ein Thema an: Hintergrund/Nebel, Schienen-/Schwellenfarbe, Spieler-Auto (nur beim
   themenfähigen Standard-Auto), sichtbare Ort-Deko und das geltende Gegner-Höchsttempo. */
function applyTheme(t, aiMax) {
  aiMaxSpeed = aiMax;
  themeBaseBg = new THREE.Color(t.bg);
  themeFog = t.fog ? new THREE.Fog(t.fog.color, 120, t.fog.far) : null;

  if (playerRailMat) { playerRailMat.color.setHex(t.rail); playerRailMat.emissive.setHex(t.railEmissive); }
  themeTieMats.forEach(m => m.color.setHex(t.tie));

  // Das gekaufte Sonder-Auto behält seine eigene Lackierung; nur das Standard-Auto wird getönt.
  if (playerCarId === 'default' && playerCartBuilt && playerCartBuilt.mats) {
    const mats = playerCartBuilt.mats;
    mats.body.color.setHex(t.carBody); mats.body.emissive.setHex(t.carBody);
    mats.fin.color.setHex(t.carFin); mats.fin.emissive.setHex(t.carFin);
    if (mats.pod) { mats.pod.color.setHex(t.carFin); mats.pod.emissive.setHex(t.carFin); }
    if (mats.podRing) { mats.podRing.color.setHex(t.carBody); mats.podRing.emissive.setHex(t.carBody); }
  }

  // Nur die aktive Welt in der Szene halten (spart pro Frame das Durchlaufen aller anderen).
  if (currentPlaceKey !== t.place) {
    if (currentPlaceKey && placeGroups[currentPlaceKey]) scene.remove(placeGroups[currentPlaceKey]);
    if (t.place && placeGroups[t.place]) scene.add(placeGroups[t.place]);
    currentPlaceKey = t.place;
  }
  if (starGroup) starGroup.visible = (t.place === null || t.place === 'moon'); // Sterne im Weltall + auf dem Mond
}

function applyLevelTheme(lv) {
  const idx = Math.min(lv, LEVEL_THEMES.length) - 1;
  applyTheme(LEVEL_THEMES[idx], LEVEL_AI_SPEEDS[idx]);
}

/* Kurzer, ein-/ausblendender Banner (Levelstart / Duell / Meldungen). */
let levelBannerTimer = null;
function showLevelBanner(msg) {
  const el = document.getElementById('levelBanner');
  if (!msg) {
    const t = LEVEL_THEMES[Math.min(level, LEVEL_THEMES.length) - 1];
    msg = `Level ${level} · ${t.name}`;
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(levelBannerTimer);
  levelBannerTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
