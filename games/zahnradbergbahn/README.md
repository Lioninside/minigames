# Zahnradbergbahn

Arbeitsbereich fuer das naechste Minigame der Sammlung.

Das Grundgeruest ist bewusst klein gehalten: Es laedt Three.js aus `shared/`, erzeugt eine
statische Bergbahn-Szene und verwendet den reservierten Speicherschluessel
`zahnradbergbahn.save.v1`. Die eigentliche Spielmechanik kann darauf in separaten JavaScript-
Modulen aufgebaut werden.

## Struktur

```text
games/zahnradbergbahn/
├── index.html          Einstiegspunkt und Three.js-Einbindung
├── css/style.css       lokale Darstellung
└── js/main.js          Szenen- und Render-Grundgeruest
```

Zum lokalen Oeffnen im Wurzelverzeichnis der Sammlung einen statischen Webserver starten und
anschliessend `http://localhost:8000/games/zahnradbergbahn/` aufrufen.
