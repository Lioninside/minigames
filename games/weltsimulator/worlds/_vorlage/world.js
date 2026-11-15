/* Vorlage für eine Zusatzwelt: kleine Insel mit Hügel, Wald, Hütte und Steg.
   Kopieren nach worlds/<id>/world.js, id/name/seed anpassen, in worlds/index.js eintragen.
   Vertrag und Regeln: worlds/AGENTS.md. Alle Koordinaten sind LOKAL (Mitte der Welt = 0, 0). */
(() => {
  const SIZE = 700, SEA = 0.3;
  // Höhenfunktion: muss schnell und ohne Zustand sein (wird sehr oft aufgerufen)
  const height = (x, z) => {
    const r = Math.hypot(x, z);
    const island = 4.5 * (1 - smooth(170, 300, r)) - 6 * smooth(250, 340, r);
    const hill = 38 * Math.exp(-((x + 70) ** 2 + (z + 40) ** 2) / (2 * 75 * 75));
    return island + hill + Math.sin(x * 0.05) * Math.cos(z * 0.045) * 0.6;
  };
  weltRegister({
    id: '_vorlage', name: 'Testinsel', size: SIZE, seed: 4711,
    spawn: { x: 60, z: 110, yaw: 0 },           // Startpunkt; Blick nach -z (yaw 0)
    height,
    surfaceAt: (x, z) => (Math.hypot(x + 70, z + 40) < 120 ? 'hill' : 'island'), // fürs Pflanzen
    build(api) {
      api.buildTerrain({ seg: 96, color: (x, z, y, steep) => y < SEA + 0.7 ? 0xd9c79a : steep > 0.25 ? 0x7f786c : y > 22 ? 0x6f8f4a : 0x5b8636 });
      api.addWater();
      // Wald am Hügel (zufällig, aber bei jedem Laden gleich: api.rng)
      for (let i = 0; i < 90; i++) {
        const a = api.rng() * 6.283, r = 25 + api.rng() * 95, x = -70 + Math.cos(a) * r, z = -40 + Math.sin(a) * r;
        if (height(x, z) > 2) api.addTree(api.rng() < 0.6 ? 'conifer' : 'deciduous', x, z, 0.8 + api.rng() * 0.5);
      }
      for (let i = 0; i < 14; i++) { const a = i * 0.45, x = Math.cos(a) * 190, z = Math.sin(a) * 190; if (height(x, z) > 0.8) api.addTree('palm', x, z, 1); }
      // Hütte (ein Mesh, Vertexfarben) mit Kollision
      const mb = new MB(), hx = 40, hz = 60, hy = height(hx, hz);
      mb.box(hx, hy + 1.5, hz, 6, 3, 5, 0.3, lin(0xb8895a));
      mb.box(hx, hy + 3.3, hz, 6.8, 0.6, 5.8, 0.3, lin(0x7a3b2e));
      api.addBox(hx, hz, 0.3, 3, 2.5, hy + 3.6);
      // Steg ins Meer: begehbares Deck + Pfosten
      const sx = 150, sz = 120, L = 60, dy = 1.2;
      for (let a = 0; a < L; a += 2) mb.box(sx + a + 1, dy - 0.1, sz, 2.02, 0.2, 2.6, 0, lin(0x8a6a48));
      for (let a = 0; a <= L; a += 10) for (const s of [-1.2, 1.2]) { mb.cyl(sx + a, -6, sz + s, 0.15, 0.15, 7.2, 6, lin(0x5a4632), false); }
      api.addDeck({ ox: sx, oz: sz, dx: 1, dz: 0, a0: -2, a1: L, hw: 1.3, h: () => dy });
      const g = mb.build(); g.deleteAttribute('uv');
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
      m.castShadow = true; m.receiveShadow = true; api.group.add(m);
    }
    // optional: update(dt, api, pos) { … }  pro Bild, solange der Spieler in der Welt ist
  });
})();
