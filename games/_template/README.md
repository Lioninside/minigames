# 🎮 Vorlage für ein neues Spiel

Kein fertiges Spiel, sondern das Grundgerüst zum Kopieren. Es ist bewusst lauffähig gehalten und
läuft im Smoke-Test der Sammlung mit – so kann die Vorlage nicht unbemerkt veralten.

Der Ordnername beginnt mit einem Unterstrich, damit klar ist: Das ist kein Eintrag für die
Startseite.

## Was schon drin ist

- Three.js aus der gemeinsamen Kopie eingebunden, inklusive CDN-Rückfall
- Szene, Kamera, Licht, Raster, Render-Schleife und Reaktion auf Fenstergrössen-Änderungen
- Start-Overlay, HUD und Tastatureingabe
- Lesen und Schreiben des Fortschritts im `localStorage` mit korrekt vorangestelltem Schlüssel

## Ein neues Spiel daraus machen

1. Ordner kopieren:

   ```bash
   cp -r games/_template games/<name>
   ```

2. In `js/main.js` den `STORAGE_KEY` auf `<name>.save.v1` ändern.
   **Wichtig:** Auf GitHub Pages teilen sich alle Spiele dieselbe Origin – ohne eigenen Präfix
   überschreiben sich die Spielstände gegenseitig.
3. Titel in `index.html` und Überschriften anpassen.
4. Diese README durch eine echte ersetzen: Steuerung, Spielregeln, Besonderheiten.
5. Das Spiel in der [Sammlungs-README](../../README.md) eintragen und als Karte in der
   `index.html` im Wurzelverzeichnis ergänzen.

Ab einer gewissen Grösse lohnt es sich, `js/main.js` in mehrere Module aufzuteilen – wie es
`games/ubootgame/` vormacht.

## Steuerung der Vorlage

| Taste | Funktion |
|---|---|
| `←` `→` | Würfel drehen |
| `Leertaste` | Ring einsammeln (Punkt) |
