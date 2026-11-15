# Auftrag für Welten-Agenten

Du baust **eine Zusatzwelt** für den Welt-Simulator. Sie wird über ein Tor auf dem Stadtplatz
betreten und erst dann geladen. Du musst den Kern des Spiels **nicht lesen**: Alles, was du
brauchst, steht in dieser Datei und in der Vorlage `worlds/_vorlage/world.js`.

## 1. Was du anfasst (und was nicht)

| Erlaubt | Verboten |
|---|---|
| Ordner `worlds/<id>/` (deine Dateien, frei) | alles unter `js/`, `css/`, `index.html`, `tools/` |
| **eine** neue Zeile in `worlds/index.js` | andere Zeilen in `worlds/index.js` ändern |
| | fremde Ordner unter `worlds/` |

- `<id>`: Kleinbuchstaben, Ziffern, Bindestrich (z. B. `alpental`). Ordnername = `id`.
- Fehlt dir etwas in der Schnittstelle: **nicht den Kern ändern**, sondern in
  `worlds/<id>/WUNSCH.md` kurz beschreiben, was du brauchst und wofür. Bau solange ohne.
- Commit nur auf dem vorgegebenen Branch, kein Pull-Request ohne Auftrag.

## 2. So gehst du vor

1. `worlds/_vorlage/world.js` nach `worlds/<id>/world.js` kopieren; `id`, `name`, `seed` anpassen.
2. Zeile in `worlds/index.js` ergänzen: `{ id: '<id>', name: 'Anzeigename', file: 'worlds/<id>/world.js', color: 0x… },`
3. Welt bauen (Abschnitt 3 und 4).
4. Prüfen (Abschnitt 6), bis `"ergebnis": "BESTANDEN"` erscheint.
5. `worlds/<id>/README.md` schreiben: 5–10 Zeilen, was es gibt und wo (lokale Koordinaten).

## 3. Vertrag: das Weltmodul

Eine Datei, die genau einmal `weltRegister({...})` aufruft, in einer IIFE (keine eigenen Globalen):

```js
(() => {
  weltRegister({
    id: 'alpental', name: 'Alpental',
    size: 1500,                 // Kantenlänge in m (200…3000); Welt reicht lokal von -size/2 bis +size/2
    seed: 1234,                 // Startwert für api.rng
    spawn: { x: 0, z: 100, yaw: 0 },   // Startpunkt (yaw 0 = Blick nach -z). 5 m dahinter entsteht das Rücktor.
    height(x, z) { … },         // Geländehöhe in m (Pflicht, siehe Regeln)
    surfaceAt(x, z) { … },      // optional: 'park' | 'meadow' | 'hill' | 'island' oder null (fürs Pflanzen)
    build(api) { … },           // einmal beim ersten Betreten: Geometrie, Kollision
    update(dt, api, pos) { … }  // optional, pro Bild, solange der Spieler hier ist; pos = lokale Position
  });
})();
```

**Koordinaten:** immer **lokal** (Weltmitte = 0, 0). y ist oben. Norden = −z. Einheiten = Meter.
Meeresspiegel = `api.seaLevel` (0,3 m). Tiefer als −0,8 m schwimmt der Spieler.

**Regeln für `height(x, z)`:**
- rein rechnerisch, ohne Zustand, ohne Zufall pro Aufruf; unter 5 µs pro Aufruf
- am Rand der Welt unter den Meeresspiegel fallen (Insel) **oder** steil ansteigen (Talkessel);
  der Spieler wird 3 m vor dem Rand ohnehin aufgehalten
- keine Sprünge über 2,5 m auf 0,5 m (sonst bleibt der Spieler hängen); Stufen bis 0,65 m steigt er hoch

## 4. Die API (`api` in `build` und `update`)

| Aufruf | Wirkung |
|---|---|
| `api.group` | `THREE.Group` der Welt. Alle Meshes hier hinein (`api.group.add(mesh)`), lokale Koordinaten. |
| `api.size`, `api.half`, `api.seaLevel` | Kantenlänge, halbe Kantenlänge, Meeresspiegel |
| `api.rng()` | Zufallszahl 0…1, bei jedem Laden gleich. **Nie `Math.random()`** für die Geometrie. |
| `api.buildTerrain({ seg, color })` | Gelände-Mesh aus `height`. `seg` Standard 128 (höchstens 256). `color(x, z, y, steil)` → Hex-Farbe. |
| `api.addWater(farbe?)` | Wasserfläche auf Meereshöhe |
| `api.addTree(kind, x, z, s)` | Baum der Hauptwelt (`'deciduous'`, `'conifer'`, `'palm'`), instanziert, mit Wind und Kollision. Höchstens 1500. |
| `api.addBox(cx, cz, rot, hw, hd, top, bottom?)` | festes Hindernis als Kasten (halbe Breite/Tiefe, Oberkante absolut). Auf die Oberkante kann man springen. `bottom` für Schwebendes (Durchgang darunter). |
| `api.addPole(x, z, r, top, bottom?)` | festes Hindernis als Kreis (Mast, Säule, Fels) |
| `api.addDeck({ ox, oz, dx, dz, a0, a1, hw, h(a) })` | begehbare Fläche über dem Gelände: Strecke ab (ox, oz) in Richtung (dx, dz) (normiert) von `a0` bis `a1`, halbe Breite `hw`, Höhe `h(a)`. Für Brücken, Stege, Rampen, Treppen, Plattformen. |
| `api.toast(text)` | kurzer Hinweis am Bildschirm |

**Jedes sichtbare feste Objekt braucht Kollision** (`addBox` oder `addPole`), jede begehbare
erhöhte Fläche ein `addDeck`. Sonst läuft der Spieler hindurch oder fällt durch.

**Aus dem Kern darfst du benutzen** (global vorhanden): `THREE` (r128), `MB` (Mesh-Baukasten, siehe
Vorlage: `box(cx, cy, cz, sx, sy, sz, rot, farbe)`, `cyl(cx, yBasis, cz, rUnten, rOben, h, seg, farbe, deckel)`,
`quad(a, b, c, d, null, farbe)`, `addGeom(geo, matrix, farbe)`, `build()`), `lin(hex)` (Farbe für
Vertexfarben), `clamp`, `lerp`, `smooth(a, b, x)`, `hash2i(a, b)` (fester Zufall 0…1 aus zwei Zahlen),
`makeCanvas(w, h)`, `canvasTex(canvas)`. **Sonst nichts.** Insbesondere nicht: `P`, `GAME`, `WORLD`,
`ROADS`, `TRANSIT`, `terrainH`, `document`, `localStorage`, Netzwerk, Timer.

## 5. Budget (wird geprüft)

| Grösse | Grenze |
|---|---|
| Bauzeit von `build` | 400 ms |
| Draw-Calls der Welt | 80 |
| Dreiecke | 500 000 |
| `height()` | 5 µs pro Aufruf |
| Dateien | `world.js` höchstens 150 KB; keine Bilder, keine Modelle, keine Bibliotheken |

So bleibst du darunter:
- **Zusammenfassen:** alles Gleichartige in einen `MB` und ein Mesh mit Vertexfarben
  (`new THREE.MeshStandardMaterial({ vertexColors: true })`), nicht ein Mesh pro Objekt.
- **Instanzieren:** viele gleiche Dinge als `THREE.InstancedMesh`.
- Texturen nur klein und auf Canvas gezeichnet (`makeCanvas`), höchstens 4 Stück à 512 px.
- Bewegliches in `update` nur für wenige Objekte; Matrizen statt neuer Geometrie.
- Setze `mesh.userData.dynamic = true` bei allem, was du später veränderst.

## 6. Prüfen

```bash
python3 -m http.server 8765                                    # im Repo-Wurzelordner, einmal
cd games/weltsimulator
node -e "new Function(require('fs').readFileSync('worlds/<id>/world.js','utf8'))"   # Syntax
node tools/play-test.cjs tools/welt-check.js --welt <id>                            # Abnahme (Text)
node tools/play-test.cjs tools/welt-check.js --welt <id> --shot /pfad/bild.png      # mit Bild
```

- Die Abnahme prüft Vertrag, Budget, Höhenfunktion, Startpunkt, Gehen in 8 Richtungen und das Rücktor.
  Erst bei `"ergebnis": "BESTANDEN"` ist die Welt fertig.
- Eigene Tests: ein Skript (Rumpf einer Funktion in der Seite) mit den Helfern `step(n)`, `key(code)`,
  `hold(code, n)`, `tp(x, z, y?)` (Achtung: `tp` erwartet **absolute** Koordinaten: `WELT.cur.ox + lokalX`).
- Bilder nur, wenn du das Aussehen beurteilen musst (sie sind teuer). Meist genügt die Textausgabe.
- Ein Ladevorgang dauert 30–70 s. Sammle Änderungen und teste dann, nicht nach jeder Zeile.

## 7. Abgabe-Checkliste

- [ ] nur `worlds/<id>/` und eine Zeile in `worlds/index.js` geändert
- [ ] Abnahme `BESTANDEN`, Ausgabe in die Abschlussmeldung kopiert
- [ ] alle festen Objekte mit Kollision, alle erhöhten Flächen mit Deck
- [ ] `README.md` der Welt vorhanden; Texte im Spiel auf Deutsch (Schweizer Schreibweise, „ss“)
- [ ] keine Markennamen, keine realen Personen, keine Nachbauten bestehender Spiele

## 8. Was (noch) nicht geht

Fahrzeuge der Hauptwelt, Leute, Pakete, Minikarte und Lifte gibt es in Zusatzwelten nicht.
Gepflanzte Bäume sind dort keine Hindernisse. Wenn deine Welt so etwas braucht: `WUNSCH.md`.
