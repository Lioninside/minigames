# TrackEditor

TrackEditor ist ein lokaler SVG-Schienennetz-Editor fuer den geplanten Schienensimulator. Die
gezeichneten SVG-Pfade sind direkt die spaetere Fahrgeometrie: Exportierte Gleise verwenden den
gleichen `d`-Wert, der im Editor sichtbar ist.

## Start

Der Editor kann direkt ohne Webserver geoeffnet werden:

```text
games/trackeditor/rail-editor.html
```

Der Ordner besitzt zusaetzlich eine direkte `index.html`, damit die Minigames-Startseite und der
Smoke-Test weiterhin wie gewohnt `games/trackeditor/` oeffnen koennen.

## Funktionen

- SVG-Zeichenflaeche mit stabilem `viewBox="0 0 1600 900"`.
- Werkzeuge fuer Start A, optionales Ziel B, Gleis, Weiche, Zusammenfuehrung, Sackgasse, Defekt und Loeschen.
- Magnetische, typisierte Anschluesse. Gleise koennen nur von Ausgang zu Eingang verbunden werden.
- Steuerbare Weichen besitzen exakt einen Eingang und zwei Ausgaenge; Zusammenfuehrungen sind
  separate passive Bauteile.
- Start A besitzt einen Eingang und einen Ausgang. Ohne angeschlossenes Ziel B muss der Rundkurs
  wieder am Eingang von A enden.
- Gerichtete Kreise sind erlaubt. Rueckfuehrungen koennen an einem freien Eingang enden oder als
  direkte Verbindung zwischen zwei Weichenausgaengen gezeichnet werden.
- Das Kreis-Beispiel zeigt eine gueltige Schleife: W2 kann oben zurueck in M1 fuehren, ohne W1 oder
  W2 rueckwaerts zu verdrahten.
- Kurvenpfade werden aus Stützpunkten erzeugt, bleiben sichtbar und werden exakt exportiert.
- Rueckgaengig, Wiederholen, lokales Autosave, Projektdatei-Import und Projektdatei-Export.
- Netzpruefung mit Fehlern, Warnungen, Erreichbarkeit, sicherer Route und Kreiswarnung.
- Testfahrt mit `getTotalLength()` und `getPointAtLength()` direkt auf den sichtbaren SVG-Pfaden.
- Laufzeitexport als normale JavaScript-Datei im Format `window.RAIL_LEVELS["level01"] = ...`.

## Dateien

```
games/trackeditor/
├── index.html            direkter Einstieg fuer die Spielesammlung
├── rail-editor.html      lokaler Einstiegspunkt
├── rail-editor.css       gekapseltes Editor-Design
├── rail-validator.js     Ports, Pfade, Graph- und Validierungslogik
├── rail-exporter.js      Projekt- und Laufzeitexport
├── rail-editor.js        UI, Zeichnen, Bearbeitung, Testfahrt
└── levels/               Zielordner fuer exportierte Leveldateien
```
