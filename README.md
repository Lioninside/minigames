# Minigames

Eine Sammlung kleiner 3D-Browserspiele. Jedes Spiel ist eigenständig, läuft rein clientseitig und
braucht weder Installation noch Build-Schritt – die Dateien lassen sich direkt auf jeden statischen
Webspace hochladen.

## Spiele

| Spiel | Ordner | Kurz |
|---|---|---|
| 🎢 **Endless Coaster** | [`games/xcoaster/`](games/xcoaster/) | Achterbahn-Rennen durch 7 Welten, Fahrzeug-Shop, Schloss-Duell |
| ⚓ **Hohe See** | [`games/ubootgame/`](games/ubootgame/) | Endlosfahrt über das Meer, Minen und U-Boote ausweichen, 12 Schiffe freischalten |
| **TrackEditor** | [`games/trackeditor/`](games/trackeditor/) | SVG-Schienennetz-Editor mit Weichen, Validierung, Testfahrt und Level-Export |
| **Stellwerksim** | [`games/stellwerksim/`](games/stellwerksim/) | SVG-Stellwerk mit freiem Betrieb oder Personenverkehr, fuenf Zuegen, Weichen und Kollisionsgefahr |
| ✅ **Family Habit Tracker** | [`games/familyhabittracker/`](games/familyhabittracker/) | Habit-Tracker fuer den Touchscreen zuhause: M, N, L und C tragen per PIN ein, was sie heute erledigt haben |

Details zu Steuerung und Spielregeln stehen jeweils in der README des Spiels.

## Struktur

```
/
├── index.html                  Startseite: Übersicht aller Spiele
├── README.md                   diese Datei
├── package.json                nur für den Testlauf – die Spiele brauchen kein npm
├── .nojekyll                   GitHub Pages liefert die Dateien unverändert aus
├── .github/workflows/          Smoke-Test bei jedem Push
├── tools/
│   └── smoke-test.mjs          lädt jede Seite im Browser und prüft sie
├── shared/
│   └── three-r128.min.js       Three.js – von allen Spielen gemeinsam genutzt
└── games/
    ├── _template/              Vorlage zum Kopieren (kein echtes Spiel)
    ├── trackeditor/            TrackEditor (SVG-Schienennetz-Editor)
    ├── familyhabittracker/     Family Habit Tracker (Touch-Oberflaeche, kein Spiel)
    ├── xcoaster/               Endless Coaster (index.html + js/-Module)
    ├── ubootgame/              Hohe See (index.html + js/-Module)
    └── stellwerksim/           Stellwerksim (SVG-Simulation)
```

Grundsatz: **Ein Spiel = ein Ordner unter `games/`.** Die Spiele kennen sich gegenseitig nicht und
teilen sich ausschliesslich das, was in `shared/` liegt. Dadurch lässt sich ein Spiel jederzeit
einzeln kopieren, ersetzen oder entfernen, ohne die anderen zu berühren.

Ordner, deren Name mit `_` beginnt, sind Werkzeuge und keine Spiele – sie erscheinen nicht auf der
Startseite.

## Lokal starten

Ein kleiner Webserver im Wurzelverzeichnis genügt – nötig, weil Browser Skripte von `file://`
teilweise blockieren:

```bash
python3 -m http.server 8000
```

Danach `http://localhost:8000` öffnen und ein Spiel auswählen. Einzelne Spiele sind direkt unter
`http://localhost:8000/games/<spiel>/` erreichbar.

## Ein neues Spiel hinzufügen

1. Vorlage kopieren – sie enthält bereits Szene, Kamera, Render-Schleife, HUD und Speicherung:

   ```bash
   cp -r games/_template games/<name>
   ```

2. In `games/<name>/js/main.js` den `STORAGE_KEY` auf `<name>.save.v1` setzen (siehe Konventionen).
3. Titel, Überschriften und die README des Spiels anpassen.
4. Das Spiel in der Tabelle oben **und** als Karte in der `index.html` im Wurzelverzeichnis
   eintragen.
5. `npm test` laufen lassen – das neue Spiel wird automatisch mitgeprüft.

## Konventionen

Diese Regeln verhindern die Probleme, die entstehen, wenn mehrere Spiele nebeneinander
ausgeliefert werden:

- **Speicherschlüssel mit Präfix.** Auf GitHub Pages teilen sich alle Spiele dieselbe Origin und
  damit denselben `localStorage`. Jeder Schlüssel beginnt deshalb mit dem Ordnernamen des Spiels:
  `xcoaster_progress`, `ubootgame.save.v1`. Ein generischer Name wie `highscore` würde die Daten
  anderer Spiele überschreiben.
- **Gemeinsame Bibliotheken mit Version im Dateinamen.** In `shared/` liegt jede Abhängigkeit
  genau einmal, benannt nach Version (`three-r128.min.js`). Braucht ein Spiel später eine neuere
  Fassung, kommt sie als eigene Datei daneben – bestehende Spiele laufen unverändert weiter.
- **Kein Spiel greift in ein anderes hinein.** Gemeinsam genutzt wird nur, was in `shared/` liegt.
- **Ein Thema, eine Datei.** Beide Spiele sind so geschnitten, dass eine typische Änderung genau
  eine Datei betrifft: Fahrzeuge, Strecke, Wasser, Gegner, Shop und Anzeigen liegen jeweils in
  einem eigenen Modul. Nur `main.js` führt beim Laden Code aus, alle anderen Dateien definieren
  ausschliesslich Funktionen und Variablen – dadurch ist die Ladereihenfolge unkritisch.

Bewusst *nicht* vereinheitlicht sind Speicherung, Audio und Effekte: Beide Spiele haben dafür
unterschiedliche Anforderungen, und eine gemeinsame Abstraktion würde derzeit mehr kosten als sie
einbringt. Sobald sich ein Muster über mehrere Spiele hinweg wiederholt, gehört es nach `shared/`.

## Tests

```bash
npm install          # einmalig, installiert Playwright für den Test
npm test
```

Der Smoke-Test startet einen lokalen Server, öffnet die Startseite und **jeden** Ordner unter
`games/` in einem echten Browser und meldet:

- JavaScript-Fehler und Konsolenfehler
- fehlende Dateien (404)
- Spielseiten, auf denen angeforderte Three.js-Skripte fehlen oder kein `<canvas>`/`<svg>` entsteht

Neue Spiele werden dabei automatisch gefunden – es muss nichts eingetragen werden. Dieselbe
Prüfung läuft über GitHub Actions bei jedem Push.

## Veröffentlichen

- **GitHub Pages:** Repository in den Einstellungen als Pages-Quelle aktivieren. Die Startseite
  liegt danach unter `https://<user>.github.io/<repo>/`, die Spiele unter `…/games/xcoaster/`
  bzw. `…/games/ubootgame/`. Die Datei `.nojekyll` sorgt dafür, dass alle Dateien unverändert
  ausgeliefert werden.
- **Eigener Webspace / FTP:** Den gesamten Ordnerinhalt hochladen. Wichtig ist nur, dass `shared/`
  und `games/` ihre relative Lage zueinander behalten. `package.json`, `tools/` und `.github/`
  werden auf dem Server nicht gebraucht.

## Technik

- **Three.js r128** (lokal in `shared/`, CDN nur als Rückfall) – sonst keine Abhängigkeiten.
- Kein Bundler, kein Transpiler. Was im Repository liegt, ist genau das, was im Browser läuft.
  Die einzige npm-Abhängigkeit ist Playwright für den Testlauf.
- Fortschritt (Münzen, freigeschaltete Fahrzeuge, Highscores) speichert jedes Spiel für sich im
  `localStorage` des Browsers.
