# Stellwerksim

Eine freie, browserbasierte Stellwerk-Simulation ohne Backend, Framework oder externe Bibliothek.
Sie laeuft direkt als statische Seite und eignet sich damit fuer GitHub Pages.

## Dateien

- `index.html`: Oberflaeche, Gleisplan-SVG und Script-Reihenfolge.
- `css/style.css`: responsives Stellwerk-Design und SVG-Zustandsfarben.
- `js/config.js`: zentrale Zugnamen, Farben, Geschwindigkeitsstufen, Grundstellungen und Debug-Schalter.
- `js/network.js`: Gleisnetz, topografische SVG-Landschaft, vierzehn Weichen und sechs Ausweichgleise.
- `js/train.js`: zugindividuelle Lok- und Wagenformationen sowie route-basierte Fahrzeugpositionen.
- `js/simulation.js`: Bewegung, Gleisbelegung, Weichensperren, Kollisionspruefung und Reset.
- `js/ui.js`: Zugsteuerungen, Geschwindigkeitsregler und Crash-Overlay.
- `js/main.js`: Zusammensetzen und Animationsschleife.

## Gleismodell

Jeder sichtbare Strich im SVG ist ein eigenes `TrackSegment` mit ID, Anfangs- und Endpunkt,
Standardnachfolger und Belegungszustand. Die drei Ringe, die acht Ringwechsel und die sechs
durchgehenden Ausweichgleise werden aus denselben Segmenten aufgebaut, die auch die Simulation
verwendet. Das Gleisbild erhaelt darunter eine prozedural aufgebaute Topografie aus Wiesen,
Baumgruppen, Bergen und See.

Eine Weiche besitzt ein Quellsegment, einen geraden Nachfolger und einen abzweigenden Nachfolger.
Der jeweilige Zugkopf liest die aktuelle Stellung nur beim Verlassen des Quellsegments. Alle Wagen
folgen einer gespeicherten Koerperroute. Deshalb fahren sie sauber durch Kurven; nach einem
Richtungswechsel folgt das neue Zugende erst vollstaendig dem bestehenden Zugkoerper, bevor es
an einer Weiche einen neuen, physisch gueltigen Fahrweg waehlt.

Die acht Ringweichen sind in beiden Fahrtrichtungen Teil des Graphen. Im Uhrzeigersinn fuehren `W1`
und `W5` vom aeusseren auf den mittleren Ring, `W2` und `W6` vom mittleren auf den inneren Ring,
`W4` und `W8` vom inneren zurueck auf den mittleren Ring sowie `W3` und `W7` vom mittleren auf
den aeusseren Ring. In Gegenrichtung gelten die jeweiligen Verbindungen umgekehrt. `W9` bis
`W14` verbinden die sechs Startgleise mit dem aeusseren Ring. Beim Richtungswechsel bleibt die
optische Zugformation erhalten: Die Lok dreht nicht, sondern der ganze Zug faehrt rueckwaerts.

Die Belegungsberechnung liefert eine gemeinsame Quelle fuer zugfarbene LED-Gleisabschnitte,
Weichensperren und die Kollisionspruefung. Die Animation benutzt `requestAnimationFrame()` mit
Delta-Time und kurzen Simulationsschritten, damit bei Stufe 5 keine Kollision uebersprungen wird.

## Erweiterungen

Zugnamen, Farben, Wagenreihen und Startgleise stehen in `js/config.js` unter
`trainDefinitions`; die fuer alle Zuege identischen Fahrstufen stehen dort unter `speedLevels`.

Neue Gleisbereiche werden in `TrackNetwork.build()` mit `addRoute()` angelegt. Die Funktion zerlegt
eine Punktfolge automatisch in kurze SVG-Segmente. Eine weitere Hauptweiche folgt dem Muster in
`addMainSwitches()`: Quellgleis, Zielgleis, Abzweiggeometrie und Beschriftungsposition definieren.
Dadurch bleiben visuelles Gleisbild und logischer Graph immer identisch.

`debug: true` in `js/config.js` blendet Segment-IDs direkt im Gleisbild ein.
