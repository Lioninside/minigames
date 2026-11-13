/* ================= NETZPLAN =================
   Liniennetz nach der handgezeichneten Karte (Norden oben = -z, Meer im Osten = +x).
   Knoten Hönggerberg mit neun Abteilen rund um den ETH-Hügel, alle über einen unterirdischen
   Fussgängertunnel verbunden:
     S Serviceanlage  – IR7, T18 (Endstation), S5 (Endstation)
     Z Zug            – S5, S2 (Hochbrücke auf Höhe des ETH-Dachs)
     F Forchbahn      – T18
     U U-Bahnhof      – U2, U3, U4
     G Gemischt       – IR7, U1 (Endstation)
     B Busbahnhof     – B18, B19, B22, B23, B45, B78 (alle Endstation)
     T Tram 6         – T6 (Endstation)
     V Vorbahnhof     – S2, U1, U2, U3, U4
     H Hinterbahnhof  – U4, S5, T18
   Knoten: { x, z } Wegpunkt oder { st: 'Name', x, z, dir?, y?, hub?, term? } Station. */

const HUB = {
  Z: { x: -620, z: -1140, y: 99 },   // y: Gleishöhe = ETH-Dach
  V: { x: -280, z: -1150 },
  U: { x: -260, z: -820 },
  H: { x: -640, z: -700 },
  G: { x: -1090, z: -840 },
  S: { x: -1090, z: -1180 },
  F: { x: -905, z: -600 },
  T: { x: -620, z: -918 },
  B: { x: -420, z: -560 },
  TUN_Y: -4.0,                         // Boden des Fussgängertunnels
  // U-Bahn-Hallen im Knoten: Versatz zum Abteil (dicht beieinander, verschiedene Tiefen, nur Lift)
  UHALLS: { V: { U1: [-20, 70], U2: [40, 112], U3: [100, 70], U4: [-80, 112] }, U: { U2: [-20, -10], U3: [45, 30], U4: [-85, 30] }, H: { U4: [0, 0] }, G: { U1: [0, 0] } },
  NAMES: { S: 'Serviceanlage', Z: 'Zug', F: 'Forchbahn', U: 'U-Bahnhof', G: 'Gemischtbahnhof', B: 'Busbahnhof', T: 'Tram 6', V: 'Vorbahnhof', H: 'Hinterbahnhof' }
};
const hubName = (k) => 'Hönggerberg/' + k;

/* ---------- S-Bahn und InterRegio (oberirdisch, meist auf Viadukt) ---------- */
const RAIL_DEF = [
  {
    id: 'S2', kind: 'sbahn', gen: 2, color: '#8e3fa8', vmax: 25, trains: 8, label: 'S2',
    nodes: [
      { st: 'Triemli', x: 1700, z: 1640, term: true },
      { x: 1790, z: 1300 },
      { st: 'Riviera', x: 1820, z: 980 },
      { x: 1600, z: 700 },
      { st: 'Stadelhofen', x: 1050, z: 560 },
      { x: 480, z: 560 },
      { st: 'Wipkingen', x: -50, z: 440 },
      { x: -130, z: -300 },
      { x: -110, z: -930 },
      { st: hubName('V'), x: HUB.V.x, z: HUB.V.z, dir: [-1, 0], hub: 'V' },
      { st: hubName('Z'), x: HUB.Z.x, z: HUB.Z.z - 5.9, dir: [-1, 0], y: HUB.Z.y, hub: 'Z', wide: 1 },
      { x: -860, z: -1300 },
      { x: -850, z: -1520 },
      { x: -620, z: -1700 },
      { x: -180, z: -1780 },
      { st: 'Letten', x: 450, z: -1750 },
      { x: 1000, z: -1770 },
      { st: 'Seebach', x: 1450, z: -1660, term: true }
    ]
  },
  {
    id: 'S5', kind: 'sbahn', gen: 1, color: '#2e9e44', vmax: 25, trains: 8, label: 'S5',
    nodes: [
      { st: hubName('S'), x: HUB.S.x, z: HUB.S.z, dir: [1, 0], term: true, hub: 'S' },
      { st: hubName('Z'), x: HUB.Z.x, z: HUB.Z.z + 5.9, dir: [1, 0], y: HUB.Z.y, hub: 'Z', wide: -1 },
      { x: -430, z: -1080 },
      { x: -420, z: -860 },
      { st: hubName('H'), x: HUB.H.x, z: HUB.H.z, dir: [-0.95, 0.31], hub: 'H' },
      { x: -900, z: -500 },
      { x: -1000, z: -100 },
      { st: 'Tiefenbrunnen', x: -1000, z: 450 },
      { x: -860, z: 1150 },
      { st: 'Zollikerberg', x: -300, z: 1580 },
      { x: 450, z: 1660 },
      { st: 'Zollikon', x: 1150, z: 1560, term: true }
    ]
  },
  {
    id: 'IR7', kind: 'ir', color: '#0b5d2e', vmax: 33, trains: 6, label: 'IR7', ring: true,
    nodes: [
      { x: -1920, z: -1920 },
      { x: 1900, z: -1920 },
      { x: 2330, z: -1480 },
      { st: 'Isla Venezia', x: 2330, z: -600, dir: [0, 1], liftMid: true },
      { x: 2330, z: 1480 },
      { x: 1900, z: 1920 },
      { x: -1920, z: 1920 },
      { x: -1920, z: 250 },
      { x: -1650, z: -330 },
      { x: -1260, z: -600 },
      { st: hubName('G'), x: HUB.G.x, z: HUB.G.z, dir: [0, -1], hub: 'G' },
      { st: hubName('S'), x: HUB.S.x, z: HUB.S.z, dir: [0, -1], hub: 'S' },
      { x: -1260, z: -1520 },
      { x: -1720, z: -1760 }
    ]
  }
];

/* ---------- U-Bahn (unterirdisch, Stationsnamen frei gewählt) ---------- */
const METRO_DEF = [
  { name: 'U1', color: '#e30613', depth: -12, wp: [
    { n: 'Oerlikon', x: 1450, z: -1650 }, { n: 'Milchbuck', x: 900, z: -1350 }, { n: 'Universität', x: 450, z: -900 },
    { n: 'Central', x: 230, z: -420 }, { n: 'Haldenegg', x: -40, z: -760 },
    { n: hubName('V'), hub: 'V' }, { n: hubName('G'), hub: 'G' }] },
  { name: 'U2', color: '#0069b4', depth: -19, wp: [
    { n: 'Affoltern', x: -250, z: -1780 }, { n: hubName('V'), hub: 'V' }, { n: hubName('U'), hub: 'U' },
    { n: 'Escher-Wyss-Platz', x: -450, z: 280 }, { n: 'Hardbrücke', x: -300, z: 880 }, { n: 'Wiedikon', x: 100, z: 1380 },
    { n: 'Enge', x: 760, z: 1650 }, { n: 'Wollishofen', x: 1400, z: 1500 }] },
  { name: 'U3', color: '#00963f', depth: -26, wp: [
    { n: hubName('V'), hub: 'V' }, { n: hubName('U'), hub: 'U' }, { n: 'Stauffacher', x: 250, z: 380 },
    { n: 'Kreuzplatz', x: 850, z: 720 }, { n: 'Hegibach', x: 1450, z: 520 }, { n: 'Bellevue', x: 1650, z: -150 },
    { n: 'Isla Venezia', free: true, x: ISLAND.x + 20, z: ISLAND.z + 10 }] },
  { name: 'U4', color: '#f29400', depth: -33, wp: [
    { n: 'Venezia', x: 1250, z: -1050 }, { n: 'Irchel', x: 700, z: -1450 }, { n: 'Bucheggplatz', x: 100, z: -1600 },
    { n: hubName('V'), hub: 'V' }, { n: hubName('U'), hub: 'U' }, { n: hubName('H'), hub: 'H' },
    { n: 'Lindenplatz', x: -850, z: 280 }, { n: 'Albisriederplatz', x: -750, z: 950 }, { n: 'Friesenberg', x: -150, z: 1550 },
    { n: 'Brunau', x: 600, z: 1250 }, { n: 'Strandbad', x: 1500, z: 1050 }] }
];

/* ---------- Tram 18 (Forchbahn) ---------- */
const T18_DEF = {
  num: 18, color: '#2a8a8c', trams: 20,
  hub: [[HUB.S.x + 45, HUB.S.z + 40], [-1010, -900], [HUB.F.x, HUB.F.z], [-760, -660], [HUB.H.x + 30, HUB.H.z + 45]],
  via: [WS.CENTER.x, WS.CENTER.z + 120],
  end: [1250, 1300],
  names: ['Hubertus', 'Waidberg', 'Kappeli', 'Rosengarten', 'Bucheggplatz Süd', 'Kunsthalle', 'Römerhof', 'Burgwies', 'Rehalp',
    'Waldburg', 'Zollikerberg Dorf', 'Neue Forch', 'Scheuren', 'Esslingen']
};

/* ---------- Buslinien ---------- */
const BUS_DEF = {
  hubLines: [22, 23, 45, 18, 19, 78],
  cityLines: [31, 32, 33, 46, 61, 62, 72, 75, 80, 89, 91, 94, 66, 70],
  colors: ['#e2001a', '#00923f', '#009ee0', '#f39200', '#7b2482', '#a5027d', '#5aa034', '#d0a700', '#00a3a6', '#c2185b',
    '#6d4c41', '#3949ab', '#ef6c00', '#2e7d32', '#1565c0', '#ad1457', '#4e342e', '#00838f', '#6a1b9a', '#827717']
};
