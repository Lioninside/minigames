/* ================= ZUSTAND UND KONFIGURATION =================
   Alle globalen Spielvariablen, Fahrphysik-Konstanten, Level-Themen, Fahrzeugpreise und
   Renn-Einstellungen. Wer Balancing oder Level-Farben ändern will, arbeitet nur hier. */

/* ================= ENDLESS COASTER – GAME LOGIC ================= */

let scene, camera, renderer, clock;
let trackPoints = [], trackFrames = [], cumLen = [], totalLength = 0;
let trackSegments = []; // markierte Streckenabschnitte (u.a. Tunnel)
let signList = []; // {dist, limit}
let cartGroup, cartFlame;
let playerCartBuilt = null;
let playerPortalState = { nextPortal: 0 };
let playerIdx = { i: 0 };

// Seitliche Abstände der vier KI-Schienen (Player bleibt in der Mitte bei Offset 0)
const SIDE_OFFSET = 14;
const SIDE_OFFSET2 = -14;
const SIDE_OFFSET3 = 28;
const SIDE_OFFSET4 = -28;

// Konfiguration aller vier KI-Gegner (Farben, seitlicher Abstand)
const AI_CONFIGS = [
  { name: 'rot',    offset: SIDE_OFFSET,  bodyColor: 0xcc2200, finColor: 0xffcc33, tubeColor: 0xe0402b, tubeEmissive: 0x661208, tieColor: 0x3a2a2a, rampColor: 0xff5050, startTarget: 700 },
  { name: 'grün',   offset: SIDE_OFFSET2, bodyColor: 0x22aa44, finColor: 0xccff66, tubeColor: 0x22cc55, tubeEmissive: 0x0f5c26, tieColor: 0x1f3a26, rampColor: 0x55ff88, startTarget: 650 },
  { name: 'lila',   offset: SIDE_OFFSET3, bodyColor: 0x8833cc, finColor: 0xd9b3ff, tubeColor: 0x8833cc, tubeEmissive: 0x3a1466, tieColor: 0x2a1f3a, rampColor: 0xcc88ff, startTarget: 680 },
  { name: 'orange', offset: SIDE_OFFSET4, bodyColor: 0xff9900, finColor: 0xffe066, tubeColor: 0xff9900, tubeEmissive: 0x664400, tieColor: 0x3a2f1a, rampColor: 0xffcc55, startTarget: 620 }
];

let aiStates = []; // je ein Zustandsobjekt pro KI-Gegner, befüllt in init()

// Seilbahn-Gondel-Zustand des Players (die KIs haben ihre eigene Gondel-Info in aiStates)
let gondolaInfo = null;
let inGondola = false;
let gondolaProgress = 0;

let vehiclePortalDistances = []; // Distanzen der Fahrzeug-Wechsel-Portale
let mergeZoneInfo = null; // Indizes der Teilstrecke, in der alle fuenf Schienen zusammenlaufen

let distanceTraveled = 0;
let speedKmh = 0;
let started = false;
let gameOver = false;
let falling = false;      // true, waehrend die Bahn nach einer Entgleisung ins All faellt
let fallVelocity = null;   // in initSharedObjects() erzeugt
let fallElapsed = 0;
let tunnelRings = [];      // für die animierte Neon-Beleuchtung in animate()
let blackHoleVisuals = []; // fuer die Dreh-Animation der schwarzen Löcher in animate()
let planetMeshes = [];     // fuer die langsame Rotationsanimation der Planeten in animate()
let swimmers = [];         // Haie, die im Meer-Level an der Wasseroberfläche kreisen
let startTime = 0;
let scoreSeconds = 0;
let currentLimit = 750;

// ---- Level-/Renn-System ----
// Jedes Level ist ein Rennen über GENAU EINE Runde. Alle Autos starten gemeinsam an der
// Startlinie. Wer zuerst durch ist, gewinnt: als Erster -> nächstes Level, sonst zurück zu
// Level 1. Nach Level 7 folgt das Schloss-Duell gegen das Drachenauto.
let level = 1;
const MAX_LEVEL = 7;
let raceActive = false;   // true, während ein Rennen läuft (Player hat die Runde noch nicht beendet)
let inDuel = false;       // true im Schloss-Zweikampf gegen das Drachenauto
let raceResult = null;    // 'won' | 'lost' -> steuert den Ergebnis-Bildschirm
let playerLap = 0;        // abgeschlossene Runden des Players in dieser Rennrunde (für die Rangliste)

const keys = { up: false, down: false };

const ACCEL = 220;    // km/h per second while accelerating (↑ gedrückt)
const DECEL = 260;    // km/h per second while actively braking (↓ gedrückt)
const FRICTION = 90;  // km/h per second automatische Verlangsamung, wenn ↑ NICHT gedrückt wird
const MAX_SPEED = 850;    // Höchstgeschwindigkeit des Players
// KI-Höchsttempo pro Level: Level 1-6 gleich schnell wie der Player (850), im letzten Level (7)
// sind die Gegner 100 km/h schneller. Im Schloss-Duell darf das Drachenauto 200 km/h schneller.
const LEVEL_AI_SPEEDS = [850, 850, 850, 850, 850, 850, 950];
const DUEL_DRAGON_SPEED = MAX_SPEED + 200; // 1050 km/h
let aiMaxSpeed = LEVEL_AI_SPEEDS[0]; // aktuell geltendes KI-Höchsttempo (per Level gesetzt)
const OVERSPEED_MARGIN = 100; // erst 100 km/h ueber dem Limit wird es gefaehrlich
const CABLECAR_SPEED = 400;   // Geschwindigkeit auf der Seilbahn-Strecke (um 200 km/h erhöht)
const NORMAL_BG_HEX = 0x02030a;       // finsteres Weltall (Level 1)
const ALT_UNIVERSE_BG_HEX = 0x230a2e; // "anderes Universum"
let NORMAL_BG = null, ALT_UNIVERSE_BG = null;

// Performance-Hilfen: Frame-Zähler (fürs Drosseln von HUD/Effekten) + wiederverwendete Scratch-Objekte
let frameCount = 0;
let _ringC1 = null, _ringC2 = null;
let _camOffset = null, _camPos = null, _lookTarget = null;

// Aktuell geltender Hintergrund/Nebel (wird von applyLevelTheme() gesetzt und in animate()
// verwendet, ausser waehrend der Player im "anderen Universum" ist).
let themeBaseBg = null;
let themeFog = null;

// Referenzen auf themenfähige Materialien (werden beim Bau eingesammelt und pro Level umgefärbt)
let playerRailMat = null;      // Schienen-Röhre der Spielerbahn
let themeTieMats = [];         // alle Schwellen-Materialien (Player + KI)
const placeGroups = {};        // { city, desert, jungle, ocean, moon, ice, castle }; nur die aktive hängt in der Szene
let currentPlaceKey = null;    // Schlüssel der aktuell eingehängten Welt (Performance: nur eine gleichzeitig)
let starGroup = null;          // Sternenfeld (nur im Weltall- und Mond-Level sichtbar)

// Themen der 7 Level: Hintergrund, Nebel, Schienenfarbe, Schwellenfarbe, Spieler-Auto, Ort-Deko.
const LEVEL_THEMES = [
  { name: '🌌 Weltall',      bg: 0x02030a, fog: null,                          rail: 0x2b3fe0, railEmissive: 0x0b1466, tie: 0x333340, carBody: 0x141428, carFin: 0xff5566, place: null },
  { name: '🏙️ Grossstadt',   bg: 0x0b1020, fog: { color: 0x0b1020, far: 1700 }, rail: 0x5566ff, railEmissive: 0x1a2299, tie: 0x22242e, carBody: 0x2a2f3a, carFin: 0x00e5ff, place: 'city' },
  { name: '🏜️ Wüste',        bg: 0xe8b46a, fog: { color: 0xe8b46a, far: 2000 }, rail: 0xa8702e, railEmissive: 0x3a2205, tie: 0x6b4a24, carBody: 0xb5651d, carFin: 0xffd27f, place: 'desert' },
  { name: '🌴 Dschungel',    bg: 0x2f6a3a, fog: { color: 0x2f6a3a, far: 1500 }, rail: 0x3a7d2c, railEmissive: 0x0e2a06, tie: 0x2a3d1a, carBody: 0x1f5c2a, carFin: 0xc6ff5e, place: 'jungle' },
  { name: '🌊 Meer',         bg: 0x4aa6d8, fog: { color: 0x4aa6d8, far: 2200 }, rail: 0x2b7fb0, railEmissive: 0x083049, tie: 0x1f3a4a, carBody: 0x0d3f66, carFin: 0x7fe8ff, place: 'ocean' },
  { name: '🌙 Mondlandschaft', bg: 0x090a12, fog: null,                        rail: 0x9aa2b0, railEmissive: 0x2a2f3a, tie: 0x40454f, carBody: 0x8b9099, carFin: 0xd8dde6, place: 'moon' },
  { name: '❄️ Eislandschaft', bg: 0xbfe4f0, fog: { color: 0xcfeaf5, far: 2000 }, rail: 0x8fd0e8, railEmissive: 0x14435c, tie: 0x2a4552, carBody: 0xdff3ff, carFin: 0x35c8ff, place: 'ice' }
];

// Sonderwelt nach Level 7: Zweikampf gegen das Drachenauto in einem riesigen Ritterschloss.
const DUEL_THEME = { name: '🐉 Schloss-Duell', bg: 0x241a2e, fog: { color: 0x241a2e, far: 2400 }, rail: 0x8a6d3a, railEmissive: 0x2a1f0a, tie: 0x3a2f1a, carBody: 0x1a2f6b, carFin: 0x66c0ff, place: 'castle' };

// Anzeige-Namen + Farben der fünf Renn-Teilnehmer für die Rangliste (Index 0 = Player).
const RACER_META = [
  { name: 'Du',     color: '#16209c' },
  { name: 'Rot',    color: '#cc2200' },
  { name: 'Grün',   color: '#22aa44' },
  { name: 'Lila',   color: '#8833cc' },
  { name: 'Orange', color: '#ff9900' }
];

// ---- Minimap (Navi-Übersicht unten links) ----
let miniCanvas = null, miniCtx = null, miniProjected = null, miniTrackCanvas = null; // Minimap (2D)

// ---- Drachenauto (Gegner im Schloss-Duell) ----
let dragonState = null;

// ---- Pokale & Fahrzeug-Shop ----
// Persistenter Fortschritt (Pokale + gekaufte Autos + gewähltes Auto) im localStorage.
const CARS = [
  { id: 'formel1',     name: '🏎️ Formel 1',    body: 0xd11a1a, accent: 0xffffff },
  { id: 'monstertruck', name: '🚙 Monstertruck', body: 0x2f9e34, accent: 0x111111 },
  { id: 'uboot',       name: '🟡 U-Boot',       body: 0xf2c500, accent: 0x0a3550 }
];
let trophies = 0;
let ownedCars = [];         // ['formel1', ...] gekaufte Sonder-Autos
let playerCarId = 'default'; // aktuell gewähltes Spieler-Auto

/* Diese Objekte brauchen THREE und werden deshalb erst erzeugt, wenn die Bibliothek sicher
   geladen ist (aufgerufen aus main.js, vor init()). Dadurch bleibt config.js beim Laden
   frei von THREE-Aufrufen und kann als eigene Datei ausgeliefert werden. */
function initSharedObjects() {
  fallVelocity = new THREE.Vector3();
  NORMAL_BG = new THREE.Color(NORMAL_BG_HEX);
  ALT_UNIVERSE_BG = new THREE.Color(ALT_UNIVERSE_BG_HEX);
  _ringC1 = new THREE.Color();
  _ringC2 = new THREE.Color();
  _camOffset = new THREE.Vector3();
  _camPos = new THREE.Vector3();
  _lookTarget = new THREE.Vector3();
  themeBaseBg = NORMAL_BG.clone();
}
