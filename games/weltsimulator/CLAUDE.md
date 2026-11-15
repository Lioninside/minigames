# Welt-Simulator: Projektnotizen für die Entwicklung

Zweck: Schnittstellen nachschlagen statt Dateien lesen. Bei Änderungen an einer Schnittstelle
diese Datei mitpflegen. Sprache im Code und in der Doku: Deutsch (Schweizer Schreibweise, „ss“).

## Grundregeln
- three.js r128, kein Build, globale Scripts in fester Reihenfolge (`index.html`). Nur `main.js` läuft beim Laden.
- Welt −2500…2500 m in x/z. Norden = −z, Meer im Osten (+x). Blick/Vorwärts des Spielers: `(-sin yaw, -cos yaw)`.
  Fahrzeuge, Fussgänger und Leute schauen nach `(sin yaw, cos yaw)` (Modell zeigt nach +z).
- Welt ist bei jedem Start gleich (`seedRng(WS.SEED)`, `rnd/rr/ri/pick/chance`). Für Zufall, der die Welt
  nicht verschieben soll: `hash2i(a, b)` oder `Math.random()` (nur Gameplay).
- Neue Spielinhalte gehören nach `js/gameplay/` (siehe unten), nicht in `main.js`/`player.js`/`hud.js`.
- Meshes, die sich später ändern: `mesh.userData.dynamic = true` (sonst gibt `releaseStaticGeometry` die Daten frei).
- Commit nur auf dem vorgegebenen Branch; kein PR ohne Auftrag.

## Module (js/)
| Datei | Inhalt | wichtigste Globale |
|---|---|---|
| util.js | Zufall, Rauschen, `MB` (Mesh-Baukasten: `box(cx,cy,cz,sx,sy,sz,rot,col)`, `cyl(cx,yBasis,cz,rUnten,rOben,h,seg,col,caps)`, `quad`, `addGeom`, `build()`), `ChunkedMB(size).get(key,x,z)/.finish(mats,parent,opts)`, `SHash`, `SIGNS`/`signMesh`, `compactGeometry`, `AMB_T` | `lin(hex)`, `clamp`, `lerp`, `smooth(a,b,x)` |
| config.js / network.js | `WS` (HILL, CENTER, VENICE, PIAZZA, WATER_Y …), `ISLAND`; `HUB`, `RAIL_DEF`, `METRO_DEF`, `T18_DEF`, `BUS_DEF` | |
| terrain.js | `terrainH(x,z)`, `waterDist(x,z)` (<0 = im Wasser), `coastX(z)`, `veniceMask(x,z)` | `WATER`, `TGRID` |
| roads.js | Strassengraph `ROADS.nodes/edges/cells/parks/plazas`, `roadClear(x,z,extra)` (<0 = auf Strasse/Trottoir), `nearestNode`, `addDeck({ox,oz,dx,dz,a0,a1,hw,h(a)})` begehbare Fläche, `cellPoly`, `pointInQuad` | |
| transit.js | `TRANSIT` (busLines, stops, tram, tram18, metro, stations), `TPath` (`at(s,out)`, `L`), Reservierungen `reserveCircle/Seg/Poly`, `isReserved(x,z,m)` | |
| rail.js | S2/S5/IR7: `RAIL.lines/stations`, `RL`, `railStationFrame(st).W(a,q)` | |
| hub.js | Stationslifte `LIFTS`, `addLift`, Fussgängertunnel `HUBT`, `inHubTunnel` | |
| island.js | Isla Venezia, Ölplattform (`ISLE`) | |
| assets/characters.js | Spielfiguren: Mensch aus `js/data/avatar-man.js` (`tools/bake_avatar.py`), Drache, Fallschirm; `animateCharacter` | |
| vehicles.js + assets/ | `VEH.list`, `Vehicle` (state 'drive'/'dwell', door 0…1, `toWorld(car,lx,ly,lz)`), Assets über `finishAsset` (near/mid/far) | |
| buildings.js | `BLD.list` (Gebäude mit obb, door, cat), `BLD.hash` (Kollisionsboxen), `buildBuildingMeshes(scene, cells)` | |
| nature.js | `TREES`, `addTree(kind,x,z,s)`, `NAT` (treeHash, benches, fountains, treeBuild.groups), `nearVis(obj, r)` | |
| life.js / traffic.js | Leute (`LIFE`, `lifeAdd`), Autos/Fussgänger (`TRAFFIC`), Vögel, Boote | |
| player.js | `P` (x,y,z,yaw,pitch,onGround,ride,underground,char,flying,rocket), `GAME` (mode,hour,timeScale,paused), `KEYS`, `groundAt(x,z,y)`, `collideWorld` | |
| player.js (Hindernisse) | `addProp(x,z,r,top,bottom?)` Kreis-Hindernis (Mast, Säule, Tisch); Kästen: `addCollider({obb: makeOBB(cx,cz,rot,hw,hd), top, bottom?})` in buildings.js. Jedes neue feste Objekt braucht eines von beiden. `CHUTE`, `P.chute` Fallschirm | |
| hud.js | `HUD`, `updateHUD`, Karten, Töne (`sfxDing`, `sfxStep`, `tone`) | |
| main.js | Renderer, Ladeschritte (`steps` vor, `later` nach dem Start-Knopf), Eingabe, Kamera, Schleife | `WORLD`, `MATS` |

## Gameplay-Schnittstelle (js/gameplay/)
- `core.js`: `gpRegister({ name, init(scene, surf, saved), update(dt), key(code)→bool, minimap(c, toMini), save() })`.
  Kern bietet `GP.inv[kind]`, `GP.stats`, `GP.sel`, `gpToast(text)`, `gpChanged()` (Leiste neu + speichern),
  `gpSurfaceAt(x,z)` → `'park'|'meadow'|'hill'|'island'|null` (null = dort wächst nichts).
  Spielstand: `localStorage['weltsimulator.gameplay.v1']`.
- `data.js`: `GP_DATA` (Arten, Wachstumszeiten, Flächen, Paketzahl). Neue Inhalte zuerst hier.
- `packages.js` (`GPP`): Pakete zufällig pro Start, Einsammeln durch Darüberlaufen.
- `plants.js` (`GPL`): Taste P sät; fester/falscher Boden verbraucht den Samen ohne Wirkung.
- Kern ruft nur: `gpInit` (Ende von `generate`), `gpUpdate` (Schleife), `gpKey` (keydown), `gpMinimap` (hud.js).

## Zusatzwelten (js/worlds.js, worlds/)
- Welten anderer Agenten: `worlds/<id>/world.js` ruft `weltRegister({ id, name, size, seed, spawn, height, surfaceAt?, build(api), update? })`.
  Verzeichnis `worlds/index.js` (eine Zeile pro Welt), Vertrag und Regeln `worlds/AGENTS.md`, Auftragstext `worlds/AUFTRAG-VORLAGE.md`,
  Vorlage `worlds/_vorlage/`, Einstiegsseite mit Auftragsgenerator `worlds/index.html` (Links auf alle Dateien). Abnahme: `node tools/play-test.cjs tools/welt-check.js --welt <id>`.
- Tore auf dem Stadtplatz (`weltInit`), Modul wird beim ersten Durchgang geladen (`weltEnter(id)`), Rücktor `weltLeave()`.
- Jede Welt liegt bei `(ox, oz) = (20000 + i·12000, 0)` und rechnet lokal. `WELT.cur` gesetzt ⇒ `terrainH`, `groundAt`,
  `collideWorld`, `gpSurfaceAt` leiten in die Welt um; alles andere (Spieler, Kamera, Himmel) läuft unverändert.
- Schnittstelle erweitern: nur in `js/worlds.js` (`weltApi`) und in AGENTS.md nachtragen.

## Testen (spart Zeit und Tokens)
```bash
python3 -m http.server 8765            # im Repo-Wurzelordner
node games/weltsimulator/tools/play-test.cjs skript.js [--shot bild.png] [--start hoengg]
```
Das Skript läuft in der Seite (Helfer `step(n)`, `key(code)`, `tp(x,z,y?)`, `hold(code,n)`), gibt Text zurück.
Fertige Skripte: `tools/test-durchlaufen.js` (was ist durchlässig?). Screenshots nur, wenn das Aussehen geprüft werden muss. Syntaxcheck ohne Browser:
`node -e "new Function(require('fs').readFileSync('js/datei.js','utf8'))"`.
Smoke-Test aller Spiele: `npm test` im Repo-Wurzelordner (Playwright global; zahnradbergbahn scheitert ohne CDN, das ist bekannt).
