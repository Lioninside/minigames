/* ================= GAMEPLAY: DATEN =================
   Neue Inhalte brauchen nur eine Zeile hier (keine Logik ändern).
   kinds: type 'tree' (model = Baumart aus nature.js) oder 'flower';
          grow = Sekunden bis ausgewachsen; soil = Flächen, auf denen die Art wächst
          (park, meadow, hill, island); patch = Blüten pro Samen; size/cols für Blumen. */
const GP_DATA = {
  order: ['oak', 'fir', 'palm', 'flower', 'sun'],
  kinds: {
    oak: { label: 'Laubbaum', icon: '🌳', type: 'tree', model: 'deciduous', grow: 40, soil: ['park', 'meadow', 'hill', 'island'], col: 0x58a83a },
    fir: { label: 'Tanne', icon: '🌲', type: 'tree', model: 'conifer', grow: 45, soil: ['hill', 'meadow', 'park'], col: 0x2f6b3a },
    palm: { label: 'Palme', icon: '🌴', type: 'tree', model: 'palm', grow: 50, soil: ['island', 'park', 'meadow'], col: 0xb7c94a },
    flower: { label: 'Wiesenblumen', icon: '🌼', type: 'flower', grow: 12, patch: 7, size: 1, soil: ['park', 'meadow', 'hill', 'island'], col: 0xe86aa8,
      cols: [0xe8455a, 0xf2c230, 0xffffff, 0x8a6be8, 0xf28ab2, 0x4a8fe8] },
    sun: { label: 'Sonnenblumen', icon: '🌻', type: 'flower', grow: 18, patch: 4, size: 3.4, soil: ['park', 'meadow', 'island'], col: 0xf2c230, cols: [0xf7c518, 0xf2a900] }
  },
  packages: { count: 150, respawn: 45, min: 3, max: 6, pickR: 1.7 },
  maxPlants: 2000, treeGap: 2.2, sowDist: 1.6, fastFactor: 6
};
