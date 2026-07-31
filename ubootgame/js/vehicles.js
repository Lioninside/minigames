/* ================= FAHRZEUGE =================
   Alle Rümpfe entstehen prozedural aus einem gemeinsamen Grundriss (hullGeometry), auf den je
   Schiffstyp Aufbauten gesetzt werden. Dadurch sehen die Fahrzeuge glaubwürdig aus, ohne dass
   externe 3D-Modelle geladen werden müssen - die Modelle lassen sich später leicht gegen
   hochwertige Dateien aus assets/models/ austauschen (siehe README).

   Konvention: Der Bug zeigt in -Z, die Wasserlinie liegt bei y = 0. */

const Vehicles = (function () {

  const MAT = {};
  function mat(key, params) {
    if (!MAT[key]) MAT[key] = new THREE.MeshStandardMaterial(params);
    return MAT[key];
  }

  /* Schiffsgrundriss von oben: spitzer Bug, parallele Seiten, gerundetes Heck. */
  function hullGeometry(beam, length, height, opts) {
    opts = opts || {};
    const b = beam / 2, L = length / 2;
    const bow = opts.bow !== undefined ? opts.bow : 0.34;
    const stern = opts.stern !== undefined ? opts.stern : 0.12;

    const s = new THREE.Shape();
    s.moveTo(0, L);
    s.bezierCurveTo(b * 0.5, L - length * bow * 0.3, b, L - length * bow * 0.75, b, L - length * bow);
    s.lineTo(b, -L + length * stern);
    s.quadraticCurveTo(b, -L, b * 0.5, -L);
    s.lineTo(-b * 0.5, -L);
    s.quadraticCurveTo(-b, -L, -b, -L + length * stern);
    s.lineTo(-b, L - length * bow);
    s.bezierCurveTo(-b, L - length * bow * 0.75, -b * 0.5, L - length * bow * 0.3, 0, L);

    const geo = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false, curveSegments: 7 });
    geo.rotateX(-Math.PI / 2); // Grundriss liegt danach in XZ, die Extrusion zeigt nach +Y
    geo.translate(0, -(opts.draft || height * 0.35), 0); // Wasserlinie auf y = 0 legen
    geo.computeVertexNormals();
    return geo;
  }

  function box(w, h, d, material, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    return m;
  }

  function cyl(rt, rb, h, seg, material, x, y, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
    m.position.set(x, y, z);
    return m;
  }

  /* Reihe kleiner Bullaugen/Fenster entlang eines Aufbaus. */
  function windowStrip(group, count, spacing, y, z, width, material) {
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * spacing;
      [-1, 1].forEach(side => {
        const w = box(0.12, 0.5, 0.7, material, side * width, y, z + off);
        group.add(w);
      });
    }
  }

  const M = {
    whiteHull: () => mat('whiteHull', { color: 0xe6e9ec, roughness: 0.55, metalness: 0.15 }),
    darkHull: () => mat('darkHull', { color: 0x27313a, roughness: 0.7, metalness: 0.25 }),
    redHull: () => mat('redHull', { color: 0x8e2f26, roughness: 0.65, metalness: 0.2 }),
    blueHull: () => mat('blueHull', { color: 0x1d4f74, roughness: 0.6, metalness: 0.25 }),
    greenHull: () => mat('greenHull', { color: 0x2b5a46, roughness: 0.7, metalness: 0.2 }),
    greyHull: () => mat('greyHull', { color: 0x555f68, roughness: 0.6, metalness: 0.45 }),
    blackHull: () => mat('blackHull', { color: 0x1b1f24, roughness: 0.55, metalness: 0.45 }),
    deck: () => mat('deck', { color: 0x6d5236, roughness: 0.9, metalness: 0.05 }),
    superstructure: () => mat('superstructure', { color: 0xf2f4f6, roughness: 0.5, metalness: 0.1 }),
    glass: () => mat('glass', { color: 0x9fd8ee, roughness: 0.15, metalness: 0.5, emissive: 0x1b4a5e, emissiveIntensity: 0.45 }),
    metal: () => mat('metal', { color: 0x8a939b, roughness: 0.45, metalness: 0.75 }),
    dark: () => mat('darkTrim', { color: 0x2c3238, roughness: 0.65, metalness: 0.4 }),
    funnel: () => mat('funnel', { color: 0xb03a2e, roughness: 0.6, metalness: 0.2 }),
    sail: () => mat('sail', { color: 0xefe6d2, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide }),
    wood: () => mat('wood', { color: 0x7a5a35, roughness: 0.9, metalness: 0.05 }),
    accent: () => mat('accent', { color: 0xd8a247, roughness: 0.4, metalness: 0.7 })
  };

  /* ---------------- Modelle ---------------- */

  function buildStartboat() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hullGeometry(3.4, 11, 2.2, { draft: 0.9, bow: 0.42 }), M.whiteHull()));
    g.add(box(3.0, 0.16, 9.4, M.deck(), 0, 1.32, 0.3));
    const cabin = box(2.1, 1.5, 3.0, M.superstructure(), 0, 2.1, 0.6);
    g.add(cabin);
    g.add(box(1.8, 0.7, 0.14, M.glass(), 0, 2.35, -0.92));
    g.add(cyl(0.16, 0.16, 1.5, 6, M.metal(), 0, 3.2, 1.4));
    g.add(cyl(0.05, 0.05, 2.4, 4, M.metal(), 0, 4.0, 1.9));
    return { group: g, bridge: new THREE.Vector3(0, 2.8, 0.2) };
  }

  function buildSailship() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hullGeometry(5.5, 22, 3.6, { draft: 1.6, bow: 0.4 }), M.wood()));
    g.add(box(4.8, 0.2, 19, M.deck(), 0, 2.06, 0));
    // Aufbau achtern
    g.add(box(3.4, 1.4, 4.2, M.wood(), 0, 2.8, 6.2));
    // Masten mit Rahsegeln
    [-4.5, 1.5, 6.0].forEach((z, i) => {
      const h = i === 1 ? 17 : 13;
      g.add(cyl(0.16, 0.24, h, 7, M.wood(), 0, 2.1 + h / 2, z));
      for (let s = 0; s < 2; s++) {
        const sailH = i === 1 ? 5.2 : 4.0;
        const sailW = i === 1 ? 8.5 : 6.6;
        const y = 5.5 + s * (sailH + 1.4) + (i === 1 ? 1.5 : 0);
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(sailW, sailH, 6, 3), M.sail());
        sail.position.set(0, y, z + 0.35);
        // leichte Wölbung, damit die Segel nicht wie Bretter wirken
        const pos = sail.geometry.attributes.position;
        for (let v = 0; v < pos.count; v++) {
          const px = pos.getX(v) / (sailW / 2);
          pos.setZ(v, (1 - px * px) * 0.9);
        }
        pos.needsUpdate = true;
        sail.geometry.computeVertexNormals();
        g.add(sail);
        const yard = cyl(0.09, 0.09, sailW + 0.8, 5, M.wood(), 0, y + sailH / 2, z);
        yard.rotation.z = Math.PI / 2; // Rah quer zum Schiff
        g.add(yard);
      }
    });
    // Bugspriet
    const spr = cyl(0.12, 0.18, 6, 6, M.wood(), 0, 3.0, -12.4);
    spr.rotation.x = Math.PI / 2 - 0.25;
    g.add(spr);
    return { group: g, bridge: new THREE.Vector3(0, 4.2, 5.0) };
  }

  function buildFishingboat() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hullGeometry(5.0, 16, 3.2, { draft: 1.4, bow: 0.36 }), M.blueHull()));
    g.add(box(4.4, 0.18, 13.5, M.deck(), 0, 1.82, 0.5));
    const cabin = box(3.4, 2.4, 4.6, M.superstructure(), 0, 3.05, 2.6);
    g.add(cabin);
    windowStrip(g, 2, 1.6, 3.4, 2.6, 1.72, M.glass());
    g.add(box(3.0, 0.9, 0.14, M.glass(), 0, 3.5, 0.32));
    g.add(cyl(0.18, 0.22, 6.5, 6, M.metal(), 0, 5.5, 1.0));
    // Ausleger für die Netze
    [-1, 1].forEach(s => {
      const boom = cyl(0.12, 0.12, 7.5, 5, M.metal(), s * 1.6, 5.2, 1.0);
      boom.rotation.z = s * 1.05;
      g.add(boom);
    });
    g.add(cyl(0.9, 0.9, 1.1, 10, M.dark(), 0, 2.4, 6.4)); // Netztrommel
    return { group: g, bridge: new THREE.Vector3(0, 3.9, 1.0) };
  }

  function buildSmallFerry() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hullGeometry(7.5, 30, 4.2, { draft: 1.8 }), M.whiteHull()));
    g.add(box(7.0, 0.2, 27, M.deck(), 0, 2.5, 0));
    const deckHouse = box(5.6, 2.6, 17, M.superstructure(), 0, 3.9, 1.5);
    g.add(deckHouse);
    windowStrip(g, 7, 2.1, 4.2, 1.5, 2.82, M.glass());
    const bridge = box(4.4, 1.8, 4.0, M.superstructure(), 0, 6.1, -4.2);
    g.add(bridge);
    g.add(box(4.0, 0.9, 0.14, M.glass(), 0, 6.3, -6.15));
    g.add(cyl(0.7, 0.8, 3.0, 10, M.funnel(), 0, 7.0, 6.0));
    g.add(box(0.14, 1.0, 5.0, M.accent(), 0, 2.72, 0)); // Reling-Andeutung
    return { group: g, bridge: new THREE.Vector3(0, 6.8, -4.6) };
  }

  function buildBigFerry() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hullGeometry(11, 48, 5.6, { draft: 2.4 }), M.blueHull()));
    g.add(box(10.4, 0.25, 44, M.deck(), 0, 3.3, 0));
    for (let level = 0; level < 2; level++) {
      const w = 8.4 - level * 1.2;
      const l = 30 - level * 6;
      g.add(box(w, 2.8, l, M.superstructure(), 0, 4.8 + level * 3.0, 2 + level * 2));
      windowStrip(g, 9, 2.6, 5.1 + level * 3.0, 2 + level * 2, w / 2 + 0.02, M.glass());
    }
    const wheelhouse = box(6.0, 2.2, 5.0, M.superstructure(), 0, 12.2, -6.5);
    g.add(wheelhouse);
    g.add(box(5.4, 1.1, 0.14, M.glass(), 0, 12.4, -8.95));
    g.add(cyl(1.1, 1.3, 4.6, 12, M.funnel(), 0, 13.4, 9.0));
    g.add(box(2.6, 0.6, 0.5, M.accent(), 0, 15.3, 9.0));
    return { group: g, bridge: new THREE.Vector3(0, 13.0, -7.0) };
  }

  function buildSmallFreighter() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hullGeometry(12, 56, 6.5, { draft: 3.0 }), M.redHull()));
    g.add(box(11.4, 0.3, 52, M.deck(), 0, 3.6, 0));
    // Ladeluken
    [-14, -4, 6].forEach(z => g.add(box(8.0, 0.9, 8.0, M.dark(), 0, 4.1, z)));
    // Ladekräne
    [-9, 1].forEach(z => {
      g.add(cyl(0.35, 0.4, 9, 7, M.metal(), 0, 8.2, z));
      const jib = cyl(0.22, 0.22, 11, 6, M.metal(), 0, 11.5, z - 3.5);
      jib.rotation.x = 1.05;
      g.add(jib);
    });
    const house = box(9.5, 4.6, 9.0, M.superstructure(), 0, 6.2, 20);
    g.add(house);
    windowStrip(g, 4, 2.0, 7.2, 20, 4.78, M.glass());
    g.add(box(8.4, 1.2, 0.16, M.glass(), 0, 8.9, 15.45));
    g.add(cyl(1.2, 1.4, 5.0, 10, M.funnel(), 0, 11.2, 23.5));
    return { group: g, bridge: new THREE.Vector3(0, 9.4, 16.5) };
  }

  function buildBigFreighter() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hullGeometry(16, 78, 8.5, { draft: 4.0 }), M.greenHull()));
    g.add(box(15.2, 0.35, 73, M.deck(), 0, 4.7, 0));
    [-24, -12, 0, 12].forEach(z => g.add(box(11, 1.1, 9.5, M.dark(), 0, 5.4, z)));
    [-18, -6, 6].forEach(z => {
      g.add(cyl(0.45, 0.55, 12, 8, M.metal(), 0, 10.7, z));
      const jib = cyl(0.28, 0.28, 15, 6, M.metal(), 0, 15.0, z - 4.8);
      jib.rotation.x = 1.0;
      g.add(jib);
    });
    const house = box(13.5, 7.0, 12, M.superstructure(), 0, 8.3, 29);
    g.add(house);
    windowStrip(g, 5, 2.4, 10.5, 29, 6.78, M.glass());
    g.add(box(12, 1.4, 0.16, M.glass(), 0, 11.6, 22.9));
    g.add(cyl(1.7, 2.0, 7.0, 12, M.funnel(), 0, 15.3, 33));
    g.add(box(3.4, 0.8, 0.6, M.accent(), 0, 18.6, 33));
    return { group: g, bridge: new THREE.Vector3(0, 12.2, 23.5) };
  }

  function buildContainerShip() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hullGeometry(22, 120, 11, { draft: 5.5 }), M.blackHull()));
    g.add(box(21, 0.4, 114, M.dark(), 0, 5.7, 0));

    // Containerstapel in kräftigen Reedereifarben
    const colors = [0xc0392b, 0x2874a6, 0x239b56, 0xd4ac0d, 0x7d3c98, 0xca6f1e];
    const contMats = colors.map((c, i) => mat('cont' + i, { color: c, roughness: 0.75, metalness: 0.15 }));
    for (let row = -4; row <= 3; row++) {
      const stackHeight = 2 + Math.floor(Math.abs(Math.sin(row * 1.7)) * 3);
      for (let col = -3; col <= 3; col++) {
        for (let h = 0; h < stackHeight; h++) {
          const c = box(2.4, 2.4, 11.5, contMats[(row * 7 + col * 3 + h + 60) % contMats.length],
            col * 2.6, 7.2 + h * 2.5, row * 12.5 - 12);
          g.add(c);
        }
      }
    }

    const house = box(18, 11, 14, M.superstructure(), 0, 11.4, 44);
    g.add(house);
    windowStrip(g, 6, 2.6, 15.5, 44, 9.03, M.glass());
    g.add(box(16, 1.6, 0.18, M.glass(), 0, 16.4, 36.9));
    g.add(cyl(2.2, 2.6, 9, 12, M.funnel(), 0, 21.5, 50));
    return { group: g, bridge: new THREE.Vector3(0, 17.6, 37.5) };
  }

  function buildCruiseShip() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hullGeometry(18, 105, 9.5, { draft: 4.6 }), M.whiteHull()));
    g.add(box(17.5, 0.5, 100, M.dark(), 0, -0.6, 0)); // dunkler Streifen an der Wasserlinie

    // Mehrere Passagierdecks, nach oben schmaler werdend
    for (let level = 0; level < 5; level++) {
      const w = 16.5 - level * 1.5;
      const l = 92 - level * 11;
      const y = 6.0 + level * 3.1;
      g.add(box(w, 2.9, l, M.superstructure(), 0, y, 2 + level * 1.5));
      windowStrip(g, 14, 5.4, y + 0.2, 2 + level * 1.5, w / 2 + 0.02, M.glass());
    }
    // Brücke mit vorgezogenen Nocken
    g.add(box(15, 2.4, 7, M.superstructure(), 0, 21.6, -26));
    g.add(box(13.5, 1.3, 0.18, M.glass(), 0, 21.9, -29.4));
    // Schornstein und Aufbauten
    g.add(cyl(2.0, 2.4, 8, 14, M.funnel(), 0, 26.0, 20));
    g.add(cyl(1.2, 1.2, 4.0, 10, M.accent(), 0, 24.5, -6));
    // Rettungsboote
    for (let i = -3; i <= 3; i++) {
      [-1, 1].forEach(s => {
        const boat = cyl(0.9, 0.9, 5.5, 8, M.accent(), s * 8.6, 12.2, i * 9 + 4);
        boat.rotation.x = Math.PI / 2;
        boat.scale.set(1, 1, 0.5);
        g.add(boat);
      });
    }
    return { group: g, bridge: new THREE.Vector3(0, 22.4, -27.0) };
  }

  function buildSubmarine() {
    const g = new THREE.Group();
    // Zigarrenförmiger Druckkörper
    const hull = cyl(2.4, 2.4, 34, 18, M.darkHull(), 0, -0.4, 0);
    hull.rotation.x = Math.PI / 2;
    g.add(hull);
    [-17, 17].forEach(z => {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 12), M.darkHull());
      cap.position.set(0, -0.4, z);
      cap.scale.set(1, 1, z < 0 ? 1.6 : 1.2);
      g.add(cap);
    });
    // Turm
    g.add(box(2.4, 4.2, 8.5, M.darkHull(), 0, 2.4, 1.5));
    g.add(box(2.0, 0.35, 8.0, M.dark(), 0, 4.6, 1.5));
    g.add(cyl(0.16, 0.16, 3.4, 6, M.metal(), 0, 6.2, -0.5));   // Periskop
    g.add(cyl(0.1, 0.1, 2.6, 6, M.metal(), 0.55, 5.8, 1.6));   // Antenne
    // Tiefenruder und Heckflossen
    [-1, 1].forEach(s => {
      g.add(box(4.5, 0.25, 1.6, M.dark(), s * 3.2, 1.6, -1.0));
      g.add(box(4.0, 0.25, 2.2, M.dark(), s * 3.0, -0.4, 15.5));
    });
    g.add(box(0.25, 4.5, 2.2, M.dark(), 0, 1.2, 15.5));
    const prop = cyl(0.25, 0.25, 0.5, 8, M.metal(), 0, -0.4, 17.6);
    prop.rotation.x = Math.PI / 2;
    g.add(prop);
    return { group: g, bridge: new THREE.Vector3(0, 5.6, -0.6) };
  }

  function buildCruiser() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hullGeometry(13, 68, 7.5, { draft: 3.4, bow: 0.4 }), M.greyHull()));
    g.add(box(12.4, 0.3, 64, M.dark(), 0, 4.1, 0));

    // Aufbauten mittschiffs
    g.add(box(8.0, 3.4, 20, M.greyHull(), 0, 5.9, 3));
    g.add(box(6.0, 2.6, 8.0, M.greyHull(), 0, 8.8, -2));
    g.add(box(5.4, 1.0, 0.16, M.glass(), 0, 9.2, -5.9));
    // Gefechtsmast
    g.add(cyl(0.3, 0.4, 11, 6, M.metal(), 0, 15.0, 1));
    g.add(box(3.0, 0.3, 0.3, M.metal(), 0, 18.5, 1));
    // Schornsteine
    [6.5, 13.5].forEach(z => g.add(cyl(1.0, 1.2, 4.2, 10, M.dark(), 0, 9.5, z)));
    // Panzergürtel
    [-1, 1].forEach(s => g.add(box(0.3, 1.6, 52, M.dark(), s * 6.5, 1.6, 0)));

    // Zwei drehbare Geschütztürme (vorn und achtern)
    const turrets = [];
    [{ z: -18, scale: 1 }, { z: 22, scale: 0.92 }].forEach(cfg => {
      const turret = new THREE.Group();
      const base = cyl(3.0 * cfg.scale, 3.4 * cfg.scale, 1.2, 12, M.greyHull(), 0, 0, 0);
      turret.add(base);
      const house = box(5.2 * cfg.scale, 2.6, 6.0 * cfg.scale, M.greyHull(), 0, 1.6, 0);
      turret.add(house);
      // Zwei Rohre je Turm
      [-1, 1].forEach(s => {
        const barrel = cyl(0.3, 0.34, 9.5 * cfg.scale, 8, M.dark(), s * 1.2 * cfg.scale, 2.0, -6.0 * cfg.scale);
        barrel.rotation.x = Math.PI / 2;
        turret.add(barrel);
      });
      turret.position.set(0, 4.4, cfg.z);
      g.add(turret);
      // Mündungspunkt in lokalen Turmkoordinaten (für Mündungsfeuer und Geschossstart)
      turrets.push({ group: turret, muzzleLocal: new THREE.Vector3(0, 2.0, -10.5 * cfg.scale) });
    });

    return { group: g, turrets, bridge: new THREE.Vector3(0, 9.8, -3.0) };
  }

  function buildSeaplane() {
    const g = new THREE.Group();
    // Bootsrumpf des Flugzeugs
    const fuse = cyl(1.0, 1.3, 13, 12, M.whiteHull(), 0, 0.9, 0);
    fuse.rotation.x = Math.PI / 2;
    g.add(fuse);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 10), M.whiteHull());
    nose.position.set(0, 0.9, -6.6);
    nose.scale.set(1, 1, 1.6);
    g.add(nose);
    const tailCone = cyl(0.25, 1.0, 4.5, 10, M.whiteHull(), 0, 1.3, 8.2);
    tailCone.rotation.x = Math.PI / 2;
    g.add(tailCone);
    // Cockpit
    g.add(box(1.5, 0.9, 2.6, M.glass(), 0, 2.0, -2.4));
    // Tragfläche mit Motorgondeln
    g.add(box(20, 0.35, 3.4, M.whiteHull(), 0, 2.9, -0.5));
    const props = [];
    [-5.2, 5.2].forEach(x => {
      g.add(cyl(0.55, 0.6, 2.6, 10, M.dark(), x, 2.9, -1.6));
      const prop = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.0, 0.12), M.dark());
      prop.position.set(x, 2.9, -3.0);
      g.add(prop);
      props.push(prop);
      // Schwimmer unter den Motoren
      const float = cyl(0.55, 0.7, 5.0, 10, M.accent(), x, -0.3, -0.5);
      float.rotation.x = Math.PI / 2;
      g.add(float);
    });
    // Leitwerk
    g.add(box(0.25, 3.4, 2.4, M.whiteHull(), 0, 3.4, 10.0));
    g.add(box(6.5, 0.25, 1.8, M.whiteHull(), 0, 2.2, 10.2));
    return { group: g, propellers: props, bridge: new THREE.Vector3(0, 2.4, -2.6) };
  }

  /* ---------------- Fahrzeugliste ----------------
     maxSpeed = Knoten, accel/brake = Knoten pro Sekunde, turn = rad/s bei voller Fahrt,
     radius = Kollisionsradius in Metern. */
  const LIST = [
    {
      id: 'startboat', name: 'Startboot', price: 0, build: buildStartboat,
      maxSpeed: 13, accel: 4.2, brake: 6.0, turn: 0.95, radius: 3.6, sizeLabel: 'sehr klein',
      armed: null, audio: { enginePitch: 62, engineVolume: 0.10 },
      desc: 'Klein, wendig und kostenlos - der ideale Einstieg.'
    },
    {
      id: 'sailship', name: 'Segelschiff', price: 10, build: buildSailship,
      maxSpeed: 11, accel: 1.8, brake: 2.4, turn: 0.55, radius: 6.5, sizeLabel: 'klein',
      armed: null, audio: { enginePitch: 40, engineVolume: 0.0, silentEngine: true },
      desc: 'Altmodischer Dreimaster. Ruhig, leise, reines Prestigeobjekt.'
    },
    {
      id: 'fishingboat', name: 'Fischerboot', price: 30, build: buildFishingboat,
      maxSpeed: 14, accel: 3.6, brake: 5.2, turn: 0.78, radius: 5.2, sizeLabel: 'klein',
      armed: null, audio: { enginePitch: 52, engineVolume: 0.12 },
      desc: 'Robuster Kutter mit Netztrommel und Auslegern.'
    },
    {
      id: 'smallferry', name: 'Kleines Kursschiff', price: 40, build: buildSmallFerry,
      maxSpeed: 17, accel: 3.0, brake: 4.0, turn: 0.52, radius: 9.5, sizeLabel: 'mittel',
      armed: null, audio: { enginePitch: 45, engineVolume: 0.13 },
      desc: 'Kleines Passagierschiff - schneller, aber träger als das Startboot.'
    },
    {
      id: 'bigferry', name: 'Grosses Kursschiff', price: 50, build: buildBigFerry,
      maxSpeed: 19, accel: 2.4, brake: 3.2, turn: 0.40, radius: 14, sizeLabel: 'mittel',
      armed: null, audio: { enginePitch: 38, engineVolume: 0.15 },
      desc: 'Zwei Passagierdecks, spürbare Massenträgheit.'
    },
    {
      id: 'smallfreighter', name: 'Kleiner Frachter', price: 70, build: buildSmallFreighter,
      maxSpeed: 20, accel: 1.9, brake: 2.6, turn: 0.30, radius: 17, sizeLabel: 'gross',
      armed: null, audio: { enginePitch: 32, engineVolume: 0.16 },
      desc: 'Schweres Arbeitstier mit Ladekränen. Langer Bremsweg.'
    },
    {
      id: 'bigfreighter', name: 'Grosser Frachter', price: 80, build: buildBigFreighter,
      maxSpeed: 21, accel: 1.6, brake: 2.2, turn: 0.24, radius: 23, sizeLabel: 'sehr gross',
      armed: null, audio: { enginePitch: 28, engineVolume: 0.17 },
      desc: 'Beeindruckende Masse, entsprechend grosser Wendekreis.'
    },
    {
      id: 'container', name: 'Containerschiff', price: 100, build: buildContainerShip,
      maxSpeed: 24, accel: 1.1, brake: 1.6, turn: 0.16, radius: 34, sizeLabel: 'riesig',
      armed: null, audio: { enginePitch: 24, engineVolume: 0.19 },
      desc: 'Höchste Endgeschwindigkeit, aber extrem langsame Beschleunigung.'
    },
    {
      id: 'cruise', name: 'Kreuzfahrtschiff', price: 120, build: buildCruiseShip,
      maxSpeed: 22, accel: 1.4, brake: 1.9, turn: 0.19, radius: 30, sizeLabel: 'riesig',
      armed: null, audio: { enginePitch: 26, engineVolume: 0.18 },
      desc: 'Fünf Decks, Rettungsboote, viel Glanz - reines Prestige.'
    },
    {
      id: 'submarine', name: 'U-Boot', price: 150, build: buildSubmarine,
      maxSpeed: 18, accel: 2.8, brake: 3.4, turn: 0.62, radius: 9, sizeLabel: 'mittel',
      armed: null, submarine: true, audio: { enginePitch: 34, engineVolume: 0.13, engineWave: 'triangle' },
      desc: 'Fährt knapp unter der Oberfläche, gedämpftes Fahrgefühl. Unbewaffnet.'
    },
    {
      id: 'cruiser', name: 'Panzerkreuzer', price: 200, build: buildCruiser,
      maxSpeed: 18, accel: 2.0, brake: 2.8, turn: 0.34, radius: 20, sizeLabel: 'gross',
      armed: 'guns', audio: { enginePitch: 30, engineVolume: 0.17 },
      desc: 'Einziges bewaffnetes Schiff: zielt mit der Maus, feuert mit S.'
    },
    {
      id: 'seaplane', name: 'Wasserflugzeug', price: 300, build: buildSeaplane,
      maxSpeed: 26, accel: 5.5, brake: 6.5, turn: 0.85, radius: 6.5, sizeLabel: 'klein',
      armed: 'bombs', seaplane: true, audio: { enginePitch: 70, engineVolume: 0.12 },
      desc: 'Fährt und fliegt. F halten zum Abheben (max. 5 s), S wirft Bomben.'
    }
  ];

  const BY_ID = {};
  LIST.forEach(v => { BY_ID[v.id] = v; });

  return {
    list: LIST,
    get(id) { return BY_ID[id] || BY_ID.startboat; },
    /* Baut ein frisches Modell für eine Fahrzeug-ID (auch für die Shop-Vorschau genutzt). */
    create(id) {
      const def = BY_ID[id] || BY_ID.startboat;
      const built = def.build();
      built.def = def;
      return built;
    }
  };
})();
