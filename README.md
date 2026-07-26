# Xcoaster – Endless Coaster

Eine browserbasierte 3D-Achterbahnfahrt (Three.js), die komplett clientseitig in `index.html` läuft.

Three.js wird lokal aus `three.min.js` geladen, das Spiel funktioniert also **offline** und ohne CDN. Fehlt die Datei, wird als Rückfall automatisch das CDN versucht.

## Spielen

Einfach `index.html` in einem modernen Browser öffnen (die Datei `three.min.js` muss daneben liegen), oder lokal servieren:

```bash
python3 -m http.server 8000
```

Danach `http://localhost:8000` aufrufen.

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
