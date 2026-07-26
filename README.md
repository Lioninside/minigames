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

## Level & Rangliste

- Rechts zeigt eine **Live-Rangliste** Platzierung und Tempo aller fünf Achterbahnen (du + vier KI-Gegner), sortiert nach zurückgelegter Strecke.
- Mit jeder abgeschlossenen Runde steigt das **Level** (max. 5). Pro Level verwandelt sich die ganze Welt (Hintergrund, Auto, Bahn, Umgebung):
  1. **Weltall** · 2. **Grossstadt** · 3. **Wüste** · 4. **Dschungel** · 5. **Meer**
- Mit jedem Level werden die Gegner schneller – Höchsttempo **450 → 550 → 650 → 750 → 850 km/h**.
