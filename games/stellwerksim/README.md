# Stellwerksim

Ein kleines 3D-Stellwerk fuer den Browser. Zuege melden ein Zielgleis an, die Einfahrten West und
Ost werden ueber Weichen und Signale gesteuert.

## Spielidee

- Jeder Zug hat ein Ziel: Gleis 1, 2 oder 3.
- Vor der Einfahrt muss die passende Weiche fuer West oder Ost gestellt werden.
- Rote Signale halten Zuege vor der Verzweigung, gruene Signale lassen sie einfahren.
- Korrekt abgefertigte Zuege geben Punkte und bauen eine Serie auf.
- Falsche Bahnsteige oder Zusammenstoesse zaehlen als Stoerung. Nach drei Stoerungen endet die
  Schicht.

## Steuerung

- Buttons im Stellwerk stellen West- und Ost-Weichen.
- `W frei/O frei` und `W halt/O halt` schalten die Signale.
- Tempo und Pause liegen rechts im Bedienfeld.
- Tastatur: `1`, `2`, `3` fuer West, `Q`, `W`, `E` fuer Ost, `A` und `D` fuer die Signale,
  `Leertaste` fuer Pause.

## Technik

Das Spiel ist eigenstaendig und nutzt nur die gemeinsame Three.js-Datei aus `shared/`.
Der Fortschritt wird unter `stellwerksim.save.v1` im `localStorage` gespeichert.
