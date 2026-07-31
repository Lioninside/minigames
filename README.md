# Mini-Games

Eine Sammlung kleiner 3D-Browserspiele. Jedes Spiel ist eigenständig, läuft rein clientseitig und
braucht weder Installation noch Build-Schritt – die Dateien lassen sich direkt auf jeden statischen
Webspace hochladen.

## Spiele

| Spiel | Ordner | Kurz |
|---|---|---|
| 🎢 **Endless Coaster** | [`games/xcoaster/`](games/xcoaster/) | Achterbahn-Rennen durch 7 Welten, Fahrzeug-Shop, Schloss-Duell |
| ⚓ **Hohe See** | [`games/ubootgame/`](games/ubootgame/) | Endlosfahrt über das Meer, Minen und U-Boote ausweichen, 12 Schiffe freischalten |

Details zu Steuerung und Spielregeln stehen jeweils in der README des Spiels.

## Struktur

```
/
├── index.html              Startseite: Übersicht aller Spiele
├── README.md               diese Datei
├── .nojekyll               GitHub Pages liefert die Dateien unverändert aus
├── shared/
│   └── three.min.js        Three.js r128 – von allen Spielen gemeinsam genutzt
└── games/
    ├── xcoaster/           Endless Coaster (eine einzelne index.html)
    │   ├── index.html
    │   └── README.md
    └── ubootgame/          Hohe See (modular aufgebaut)
        ├── index.html
        ├── css/
        ├── js/
        ├── assets/
        └── README.md
```

Grundsatz: **Ein Spiel = ein Ordner unter `games/`.** Die Spiele kennen sich gegenseitig nicht und
teilen sich ausschliesslich das, was in `shared/` liegt. Dadurch lässt sich ein Spiel jederzeit
einzeln kopieren, ersetzen oder entfernen, ohne die anderen zu berühren.

## Lokal starten

Ein kleiner Webserver im Wurzelverzeichnis genügt – nötig, weil Browser Skripte von `file://`
teilweise blockieren:

```bash
python3 -m http.server 8000
```

Danach `http://localhost:8000` öffnen und ein Spiel auswählen. Einzelne Spiele sind direkt unter
`http://localhost:8000/games/<spiel>/` erreichbar.

## Veröffentlichen

- **GitHub Pages:** Repository in den Einstellungen als Pages-Quelle aktivieren. Die Startseite
  liegt danach unter `https://<user>.github.io/<repo>/`, die Spiele unter
  `…/games/xcoaster/` bzw. `…/games/ubootgame/`. Die Datei `.nojekyll` sorgt dafür, dass alle
  Dateien unverändert ausgeliefert werden.
- **Eigener Webspace / FTP:** Den gesamten Ordnerinhalt hochladen. Wichtig ist nur, dass `shared/`
  und `games/` ihre relative Lage zueinander behalten.

## Ein neues Spiel hinzufügen

1. Ordner `games/<name>/` anlegen und dort eine `index.html` erstellen.
2. Three.js aus der gemeinsamen Kopie einbinden (zwei Ebenen nach oben):

   ```html
   <script src="../../shared/three.min.js"></script>
   <script>
     if (!window.THREE) {
       document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>');
     }
   </script>
   ```

   Der zweite Block lädt Three.js notfalls vom CDN nach, falls die lokale Datei fehlt.
3. Eine `README.md` im Spielordner ergänzen: Steuerung, Spielregeln, Besonderheiten.
4. Das Spiel in der Tabelle oben **und** als Karte in der `index.html` im Wurzelverzeichnis
   eintragen.

Wird eine andere Bibliothek gebraucht, kommt sie ebenfalls nach `shared/` – so bleibt jede
Abhängigkeit nur einmal im Repository.

## Technik

- **Three.js r128** (lokal in `shared/`, CDN nur als Rückfall) – sonst keine Abhängigkeiten.
- Kein Bundler, kein Transpiler, kein `npm install`. Was im Repository liegt, ist genau das, was
  im Browser läuft.
- Fortschritt (Münzen, freigeschaltete Fahrzeuge, Highscores) speichert jedes Spiel für sich im
  `localStorage` des Browsers.
