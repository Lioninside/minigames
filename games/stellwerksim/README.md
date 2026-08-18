# Stellwerksim

Eine freie, browserbasierte Stellwerk-Simulation ohne Backend, Framework oder externe Bibliothek.
Sie laeuft direkt als statische Seite und eignet sich damit fuer GitHub Pages.

## Dateien

- `index.html`: Oberflaeche, Gleisplan-SVG und Script-Reihenfolge.
- `css/style.css`: responsives Stellwerk-Design und SVG-Zustandsfarben.
- `js/config.js`: zentrale Zugnamen, Farben, Geschwindigkeitsstufen, Grundstellungen und Debug-Schalter.
- `js/network.js`: Gleisnetz, topografische SVG-Landschaft, fuenfzehn Weichen, Abstellbahnhof und Bergstrecke.
- `js/train.js`: zugindividuelle Lok- und Wagenformationen, route-basierte Fahrzeugpositionen und Stopp per Zugklick.
- `js/simulation.js`: Bewegung, Gleisbelegung, Weichensperren, Kollisionspruefung und Reset.
- `js/map-viewport.js`: internes Zoomen und Verschieben der Gleiskarte per Rad, Tasten, Drag und Touch.
- `js/ui.js`: kompakte Zugsteuerungen, Geschwindigkeitsregler und Crash-Overlay.
- `js/main.js`: Zusammensetzen und Animationsschleife.

## Gleismodell

Jeder sichtbare Strich im SVG ist ein eigenes `TrackSegment` mit ID, Anfangs- und Endpunkt,
Standardnachfolger und Belegungszustand. Die drei Ringe, die acht Ringwechsel, der obere
Abstellbahnhof mit sechs parallelen Gleisen und die offene Berg-Stichstrecke werden aus denselben
Segmenten aufgebaut, die auch die Simulation verwendet. Alle Abzweige nutzen Bezier-Kurven,
damit Gleisuebergaenge und Weichen sichtbar weich verlaufen. Das Gleisbild erhaelt darunter eine
prozedural aufgebaute Topografie aus Wiesen, Baumgruppen, Bach, Bergen, Felsen und See.

Eine Weiche besitzt ein Quellsegment, einen geraden Nachfolger und einen abzweigenden Nachfolger.
Der jeweilige Zugkopf liest die aktuelle Stellung nur beim Verlassen des Quellsegments. Alle Wagen
folgen einer gespeicherten Koerperroute. Deshalb fahren sie sauber durch Kurven; nach einem
Richtungswechsel folgt das neue Zugende erst vollstaendig dem bestehenden Zugkoerper, bevor es
an einer Weiche einen neuen, physisch gueltigen Fahrweg waehlt.

Die acht Ringweichen sind in beiden Fahrtrichtungen Teil des Graphen. Im Uhrzeigersinn fuehren `W1`
und `W5` vom aeusseren auf den mittleren Ring, `W2` und `W6` vom mittleren auf den inneren Ring,
`W4` und `W8` vom inneren zurueck auf den mittleren Ring sowie `W3` und `W7` vom mittleren auf
den aeusseren Ring. In Gegenrichtung gelten die jeweiligen Verbindungen umgekehrt. `W9` bis
`W14` verbinden die sechs parallelen Abstellgleise im oberen Bereich mit dem aeusseren Ring.
`W15` fuehrt auf die offene Bergstrecke mit dem Bahnhof `Littsdingen`; am Ende der Strecke haelt
ein Zug am Prellbock und kann rueckwaerts zurueckfahren. Beim Richtungswechsel bleibt die optische
Zugformation erhalten: Die Lok dreht nicht, sondern der ganze Zug faehrt rueckwaerts.

Die Belegungsberechnung liefert eine gemeinsame Quelle fuer zugfarbene LED-Gleisabschnitte,
Weichensperren und die Kollisionspruefung. Die Animation benutzt `requestAnimationFrame()` mit
Delta-Time und kurzen Simulationsschritten, damit bei Stufe 5 keine Kollision uebersprungen wird.
Abstellweichen sperren nur ihre unmittelbaren Ein- und Ausfahrbereiche, nicht den ganzen
Abstellgleisabschnitt.

## Bedienung

Die sechs Zugpulte liegen im Desktop-Layout links und rechts neben der Karte. Ein Klick oder
Antippen eines fahrenden Zuges setzt ihn sofort auf `Halt` und Fahrstufe `0`; ein stehender Zug
wird dadurch nicht erneut gestartet.

Die Karte selbst zoomt von 50 % bis 250 %: Mausrad und Pinch-Geste zoomen um den Beruehrpunkt,
Drag verschiebt die vergroesserte Karte. Die Tasten `+`, `-` und `Reset` bleiben dabei fest am
Kartenrand. Weichen und Zuege verwenden SVG-Pointer-Ereignisse und bleiben nach dem Zoomen exakt
bedienbar.

## Erweiterungen

Zugnamen, Farben, Wagenreihen und Startgleise stehen in `js/config.js` unter
`trainDefinitions`; die fuer alle Zuege identischen Fahrstufen stehen dort unter `speedLevels`.

Neue Gleisbereiche werden in `TrackNetwork.build()` mit `addRoute()` angelegt. Die Funktion zerlegt
eine Punktfolge automatisch in kurze SVG-Segmente. Eine weitere Hauptweiche folgt dem Muster in
`addMainSwitches()`: Quellgleis, Zielgleis, Abzweiggeometrie und Beschriftungsposition definieren.
Dadurch bleiben visuelles Gleisbild und logischer Graph immer identisch.

`debug: true` in `js/config.js` blendet Segment-IDs direkt im Gleisbild ein.
