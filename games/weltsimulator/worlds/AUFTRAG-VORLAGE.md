# Auftrag an einen Welten-Agenten (kopieren und Platzhalter ersetzen)

```
Repository: lioninside/minigames, Branch: <branch>
Arbeitsordner: games/weltsimulator

Baue die Zusatzwelt „<Name>“ (id: <id>) für den Welt-Simulator.
Lies zuerst und ausschliesslich: worlds/AGENTS.md und worlds/_vorlage/world.js.
Lies keinen anderen Code des Spiels; die Schnittstelle in AGENTS.md ist vollständig.

Thema: <z. B. Alpental mit Bergsee, Seilbahnstation, Almhütten, Wasserfall>
Grösse: <z. B. 1500> m Kantenlänge
Pflichtinhalte: <3–6 Dinge, die es geben muss>
Stimmung/Stil: <z. B. Low-Poly wie die Hauptwelt, kräftige Farben>

Regeln: nur worlds/<id>/ und eine Zeile in worlds/index.js ändern. Budget und Verbote laut
AGENTS.md. Fertig ist die Welt erst, wenn
  node tools/play-test.cjs tools/welt-check.js --welt <id>
"ergebnis": "BESTANDEN" meldet. Kopiere diese Ausgabe in deine Abschlussmeldung.
Fehlt etwas in der Schnittstelle: worlds/<id>/WUNSCH.md schreiben, Kern nicht ändern.
Commit auf dem Branch mit Nachricht „Welt <id>: <Kurzbeschreibung>“, dann pushen. Kein Pull-Request.
```

## Hinweise für die Koordination mehrerer Agenten

- **Ein Agent pro Welt, jeder mit eigener id.** Die Agenten berühren nur ihren Ordner und je eine
  eigene Zeile in `worlds/index.js`. Dadurch gibt es beim Zusammenführen höchstens einen trivialen
  Konflikt in dieser einen Datei (beide Zeilen behalten).
- **Am einfachsten:** jeder Agent auf einem eigenen Branch `welt/<id>` ab dem Hauptbranch; danach
  der Reihe nach zusammenführen. Alternativ nacheinander auf demselben Branch (vor dem Push
  `git pull --rebase`).
- **Kosten:** Ein Agent braucht nur AGENTS.md (rund 2 000 Wörter) und die Vorlage (60 Zeilen)
  statt des ganzen Spiels (über 11 000 Zeilen). Die Abnahme liefert Text; Bilder nur bei Bedarf.
- **Abnahme durch den Koordinator:** `welt-check.js` für jede Welt laufen lassen, danach
  `node tools/play-test.cjs tools/test-durchlaufen.js` und `npm test` (Repo-Wurzel), damit die
  Hauptwelt unverändert läuft.
- **Wünsche:** `worlds/*/WUNSCH.md` einsammeln; Erweiterungen der Schnittstelle macht nur der
  Koordinator in `js/worlds.js` und trägt sie in AGENTS.md nach.
