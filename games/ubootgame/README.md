# ⚓ Hohe See – Endlosfahrt (ubootgame)

Ein dreidimensionales Browser-Endlosspiel für einen Spieler: Du fährst mit einem Schiff über ein
endloses Meer, weichst Minen, feindlichen U-Booten und Torpedos aus und sammelst dabei Münzen,
mit denen sich in der Hafenwerft immer neue Fahrzeuge freischalten lassen.

Das Spiel läuft vollständig im Browser – keine Installation, kein Build-Schritt, kein Server nötig.
Teil der [Mini-Games-Sammlung](../../README.md).

## Lokal starten

Im **Wurzelverzeichnis der Sammlung** einen kleinen Webserver starten (nicht in diesem Ordner,
sonst wird `shared/three.min.js` nicht gefunden):

```bash
python3 -m http.server 8000
```

Danach `http://localhost:8000/games/ubootgame/` im Browser öffnen.

Alternativ funktioniert auch jeder andere statische Server, z. B. `npx serve`.

## Auf einen Webhoster hochladen

Es gibt nichts zu kompilieren – die Dateien werden einfach hochgeladen:

1. Den Ordner `games/ubootgame/` **und** den Ordner `shared/` per FTP/SFTP hochladen, dabei die
   relative Lage zueinander beibehalten.
2. Die Seite ist danach unter `https://deine-domain.tld/games/ubootgame/` spielbar.

Wichtig: Das Spiel erwartet Three.js unter `../../shared/three.min.js`. Fehlt die Datei, versucht
es automatisch, Three.js vom CDN nachzuladen – dann ist allerdings eine Internetverbindung nötig.

## Steuerung

| Taste | Funktion |
|---|---|
| `↑` | Beschleunigen |
| `↓` | Bremsen / sehr langsam rückwärts |
| `←` `→` | Nach links / rechts steuern |
| `P` | Kameraperspektive wechseln (Verfolger → Brücke → Vogelperspektive) |
| `K` | Shop öffnen (pausiert das Spiel vollständig) |
| `C` | Shop schliessen |
| `S` | Panzerkreuzer: schiessen · Wasserflugzeug im Flug: Bombe abwerfen |
| `F` halten | Wasserflugzeug: abheben (maximal 5 Sekunden am Stück) |
| `Esc` | Pausemenü öffnen / schliessen |
| Maus | Panzerkreuzer: Zielrichtung der Kanonen (kein Klicken nötig) |

## Spielregeln in Kürze

- Pro **10 Meter** echtem Streckenfortschritt gibt es automatisch **1 Münze**. Im Kreis fahren
  bringt nichts – gezählt wird nur der Fortschritt entlang der endlosen Route.
- Der Spieler hat **keine Lebenspunkte**: Mine, Torpedo oder das Rammen eines U-Boots beenden
  die Fahrt sofort.
- **Münzen, gekaufte Fahrzeuge und der Highscore bleiben** nach einem Unfall erhalten – nur die
  aktuelle Distanz beginnt wieder bei null.
- Nur **Panzerkreuzer** (Kanonen) und **Wasserflugzeug** (Bomben) können Minen und U-Boote
  zerstören. Alle anderen Fahrzeuge müssen ausweichen.
- **Oberflächenminen** sind sichtbar, **Unterwasserminen** praktisch nicht – sie werden über das
  **Radar** unten links entdeckt (Reichweite ca. 140 m). Feindliche U-Boote verraten sich
  zusätzlich durch ihr **Periskop**.
- Vor jedem Torpedoangriff dreht das Periskop sichtbar ein und es ertönt eine Warnung.
- Die Schwierigkeit steigt stufenweise mit der Distanz (0–500 m einfach, 500–1500 m moderat,
  1500–3000 m anspruchsvoll, ab 3000 m schwierig), bleibt aber immer spielbar.

## Speicherung

Der Fortschritt wird im **`localStorage`** des Browsers abgelegt (Schlüssel `ubootgame.save.v1`)
und nach jeder wichtigen Änderung sofort geschrieben – nach jeder Münze, jedem Kauf, jedem neuen
Highscore und bei Änderungen an den Einstellungen.

Gespeichert werden: Münzen, gekaufte Fahrzeuge, zuletzt gewähltes Fahrzeug, Highscore,
Lautstärke und Stummschaltung.

Zum Löschen gibt es im Hauptmenü den Punkt **„Fortschritt zurücksetzen"**.

## Verwendete Bibliotheken

- **[Three.js](https://threejs.org/) r128** – WebGL-Rendering, gemeinsam genutzt aus
  `shared/three.min.js` im Wurzelverzeichnis der Sammlung.

Sonst keine externen Abhängigkeiten. Sämtliche 3D-Modelle, Wellen, Partikeleffekte und Geräusche
werden zur Laufzeit erzeugt – Geräusche über die Web Audio API, Modelle prozedural aus Three.js-
Grundkörpern.

## Ordnerstruktur

```
games/ubootgame/
├── index.html            Aufbau der Seite und aller Menüs
├── css/style.css         gesamtes Aussehen von Menüs, HUD und Shop
├── js/
│   ├── save-system.js    localStorage: Münzen, Schiffe, Highscore, Einstellungen
│   ├── audio.js          Motor-, Wind- und Effektgeräusche (Web Audio)
│   ├── ocean.js          Wellen-Shader, Wasserhöhe für die Physik, Himmelskuppel
│   ├── effects.js        Partikelpools: Explosionen, Gischt, Rauch, Blasen, Trümmer
│   ├── vehicles.js       alle 12 Fahrzeuge: Werte und prozedurale 3D-Modelle
│   ├── player.js         Steuerung, Auftrieb, Kielwasser, Türme, Flugmodus
│   ├── mines.js          Oberflächen- und Unterwasserminen
│   ├── enemies.js        feindliche U-Boote und Torpedos
│   ├── weapons.js        Granaten des Panzerkreuzers und Bomben des Flugzeugs
│   ├── radar.js          Rundsichtradar unten links
│   ├── shop.js           Hafenwerft inkl. 3D-Vorschaubildern
│   ├── game.js           Zustandsautomat, Spawnlogik, Kollisionen, Kameras, HUD
│   └── main.js           Ladebildschirm und Startreihenfolge
└── assets/               Platz für eigene Modelle, Texturen, Sounds, UI-Grafiken
```

## Eigene Modelle, Texturen und Sounds einsetzen

Alles ist bewusst so gebaut, dass sich die Platzhalter später leicht ersetzen lassen:

- **3D-Modelle:** In `js/vehicles.js` hat jedes Fahrzeug eine eigene `build…()`-Funktion, die eine
  `THREE.Group` zurückgibt. Um ein echtes Modell zu verwenden, lädt man die Datei aus
  `assets/models/` (z. B. mit dem `GLTFLoader`) und gibt stattdessen dessen Gruppe zurück. Die
  Konvention lautet: Bug zeigt nach `-Z`, die Wasserlinie liegt bei `y = 0`.
- **Texturen:** Die Materialien liegen gesammelt im Objekt `M` in `js/vehicles.js`. Dort lässt
  sich z. B. `map: new THREE.TextureLoader().load('assets/textures/…')` ergänzen.
- **Sounds:** `js/audio.js` synthetisiert alle Geräusche. Wer echte Dateien bevorzugt, ersetzt die
  Funktionen (`explosion`, `cannon`, …) durch das Abspielen geladener Puffer aus `assets/sounds/`.
- **Wasser:** Die Wellenparameter stehen ganz oben in `js/ocean.js` im Array `WAVES` und wirken
  gleichzeitig auf Optik und Schiffsbewegung.

## Leistung

Das Spiel nutzt Objekt-Pooling für Partikel, Minen, U-Boote, Torpedos und Projektile – während
der Fahrt werden keine Geometrien oder Materialien neu erzeugt. Weit hinter dem Spieler liegende
Objekte werden automatisch freigegeben und wiederverwendet.
