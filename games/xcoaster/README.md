# 🎢 Endless Coaster

Eine browserbasierte 3D-Achterbahnfahrt (Three.js), die komplett clientseitig in `index.html` läuft.
Teil der [Minigames-Sammlung](../../README.md).

Three.js kommt aus der gemeinsamen Kopie `shared/three-r128.min.js` im Wurzelverzeichnis der Sammlung,
das Spiel funktioniert also **offline** und ohne CDN. Fehlt die Datei, wird als Rückfall
automatisch das CDN versucht.

## Spielen

Im **Wurzelverzeichnis der Sammlung** einen kleinen Webserver starten (nicht in diesem Ordner,
sonst wird `shared/three-r128.min.js` nicht gefunden):

```bash
python3 -m http.server 8000
```

Danach `http://localhost:8000/games/xcoaster/` aufrufen.

## Steuerung

- `↑` – Gas geben
- `↓` – Bremsen
- `Leertaste` – Spiel starten / neustarten
- `Enter` – Neustart nach Absturz

## Rennen, Level & Duell

- **Jedes Level ist ein Rennen über eine Runde.** Alle Autos starten gemeinsam an der Startlinie. Wirst du **Erster**, geht es ins nächste Level – wirst du nicht Erster (oder stürzt ab), geht es zurück zu **Level 1**.
- Rechts eine **Live-Rangliste**, unten links eine **Navi-Streckenübersicht** (Minimap) mit den Positionen aller Autos.
- **7 Welten** (Hintergrund, Auto, Bahn und Umgebung wechseln pro Level):
  1. **Weltall** · 2. **Grossstadt** · 3. **Wüste** · 4. **Dschungel** · 5. **Meer** (mit Haien) · 6. **Mondlandschaft** · 7. **Eislandschaft** (mit Eisbären)
- Tempo der Gegner: In den Leveln **1–6 gleich schnell** wie der Player (850 km/h), im **7. Level 100 km/h schneller**.

## Schloss-Duell & Fahrzeug-Shop

- Nach Level 7 folgt das **Schloss-Duell 🐉**: ein 1-gegen-1-Rennen gegen das Drachenauto (bis zu **200 km/h schneller**) über eine Runde in einem riesigen Ritterschloss.
- Gewinnst du, bekommst du einen **Pokal**. Mit mindestens einem Pokal kannst du im **Shop** ein neues Auto kaufen (kostet 1 Pokal): 🏎️ **Formel 1**, 🚙 **Monstertruck** oder 🟡 **U-Boot**. Pokale und Autos werden lokal gespeichert.
- Verlierst du irgendein Rennen, beginnst du wieder bei Level 1.

## Aufbau des Codes

Das Spiel ist in Module aufgeteilt – eine typische Änderung betrifft genau eine Datei:

```
games/xcoaster/
├── index.html          Seitenaufbau, HUD und Menü-Overlays
└── js/
    ├── config.js       Zustand, Fahrphysik-Konstanten, LEVEL_THEMES, CARS  → Balancing & Level-Farben
    ├── save.js         Pokale und gekaufte Autos im localStorage
    ├── audio.js        Motorsound von Spieler und KI (Web Audio)
    ├── track.js        Streckengenerator, Schienen-Röhre, Seilbahn, Portale → neue Streckenelemente
    ├── scenery.js      Tunnel, Goldmine, schwarze Löcher, Planeten, Tempolimit-Schilder
    ├── ai.js           Schienen, Zustand und Bewegung der KI-Gegner
    ├── worlds.js       Umgebung je Level (Stadt, Wüste, … , Schloss)      → neues Level
    ├── vehicles.js     alle Fahrzeugmodelle inkl. Drachenauto             → neues Auto
    ├── race.js         Levelrennen, Duell, Sieg/Niederlage, Entgleisung
    ├── shop.js         Kauf und Auswahl der Sonder-Autos
    ├── minimap.js      Streckenübersicht unten links
    ├── effects.js      Triebwerks-Partikel
    ├── game.js         Szenenaufbau, Eingabe, Hauptschleife, Kamera, HUD
    └── main.js         Einstiegspunkt (einzige Datei, die beim Laden läuft)
```

Beispiele:

- **Neues Auto:** `build…()`-Funktion in `vehicles.js` und ein Eintrag in `CARS` (`config.js`).
- **Neues Level:** Deko-Funktion in `worlds.js` und ein Eintrag in `LEVEL_THEMES` (`config.js`).
- **Strecke ändern:** nur `track.js` – die Sequenz der `add…()`-Aufrufe in `buildTrack()`.
- **Tempo/Schwierigkeit:** nur die Konstanten oben in `config.js`.
