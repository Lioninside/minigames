# 🏙️ Welt-Simulator – Neu-Zürich

Eine 5 × 5 km grosse Stadt am Meer, in der man als Figur in Ego-Perspektive herumläuft,
mit Bus, Tram und U-Bahn fährt und jedes Gebäude durch seine Haupttür betreten kann.
Die Welt wird beim Laden prozedural erzeugt, immer aus demselben Startwert. Sie sieht deshalb
bei jedem Besuch gleich aus.

## Steuerung

| Taste | Wirkung |
|---|---|
| ↑ / ↓ (oder W / S) | vorwärts / rückwärts gehen |
| ← / → (oder A / D) | drehen |
| Maus | umschauen (einmal ins Bild klicken) |
| Leertaste | springen; im Wasser ans Ufer klettern; als Drache halten = mit den Flügeln schlagen und steigen |
| Shift | rennen |
| E | Gebäude an der Haupttür betreten / am Ausgang verlassen |
| L | Lift rufen, einsteigen, aussteigen |
| M | Netzplan mit U-Bahn, Tram und Buslinien |
| V | Ego- oder Verfolgerkamera (zeigt die Figur) |
| C | Spielfigur wechseln: Mensch oder Drache |
| T | Zeitraffer an/aus |
| Q | Grafikstufe wechseln (Niedrig, Mittel, Hoch) |
| F | Bildraten-Anzeige ein/aus |
| O | Verdeckungs-Culling ein/aus (zum Vergleich) |

## Spielfiguren

Im Startmenü (Zeile „Figur“) oder mit **C** wählbar; die Wahl wird gespeichert.

- **Mensch:** geht, rennt und springt, Ego- oder Verfolgerkamera.
- **Drache:** roter Comic-Drache mit cremefarbenem Plattenbauch, weissen Hörnern, grossen Augen,
  grauen Fledermausflügeln und orangen Tupfen. Er wird immer von hinten gezeigt. Leertaste halten
  lässt ihn flattern und steigen (bis 420 m über Grund, im Untergrund bis knapp unter die Decke).
  Loslassen lässt ihn gleiten und langsam sinken; mit ↑ und Shift fliegt er schneller. Am Boden
  geht er mit eingeklappten Flügeln. Busse, Trams, U-Bahn, Gebäude und Lift funktionieren wie
  beim Menschen.
- Beide Figuren sind auf der Asset-Testseite (`assets.html`) mit Bewegungsarten zu sehen.

## Die Stadt

- **Strassennetz:** unregelmässiges Raster mit breiten Hauptstrassen, Quartierstrassen, Gassen,
  Kreiseln mit Brunnen, Fussgängerstreifen und einer Seepromenade.
- **Fluss** quer durch die Stadt bis zur Mündung ins Meer, mit Quaimauern. Strassen queren ihn
  nur über Steinbrücken, und Gebäude halten mindestens 25 m Abstand zum Ufer.
- **Klein-Venedig:** Kanalnetz, das vom Meer herein- und wieder hinausführt, bunte Häuser,
  Fussgängerbrücken, Gondeln, Piazza mit Campanile, Basilika und Prokuratien.
- **Riviera:** Strand mit Palmen, Sonnenschirmen und Rettungstürmen, grosse Luxushotels mit Pools,
  Jachten vor der Küste. Meer nur auf der Ostseite.
- **Landschaft:** Hügel, Berge mit Wald und Fels, mehrere Parks mit Wegen, Bänken und Springbrunnen.
- **Hochschulhügel:** der höchste Stadthügel mit Wald, Firmensitzen und der ETH mit Kuppel und
  Säulenhalle.

## Verkehr

- **Busse** (12 Linien): halten in Haltebuchten mit gelbem Zickzack für 10 Sekunden und öffnen
  die Türen.
- **Tram 6** (altes Zürcher Tram): fährt von Venezia Hafen durchs Zentrum zur ETH. Die Gleise
  liegen mittig auf der Strasse, in stark gerundeten Kurven. Am Hügel fährt das Tram auf eigenem
  Trassee, an den Enden in Wendeschleifen. Haltestellen haben kurze erhöhte Perrons mit Dach.
- **U-Bahn** (U1–U4, Londoner Mehrwagenzüge): fährt in Tunneln unter der Stadt und hält 10 Sekunden
  in beleuchteten Stationen mit langen Perrons. Pavillons mit Treppen führen an die Oberfläche.
- **Mitfahren:** bei offenen Türen hineinlaufen, und die Kamera fährt mit. Zum Aussteigen an einer
  Haltestelle durch die offene Tür hinausgehen.
- Dazu kommen Autos und Fussgänger. Fahrzeuge bremsen vor Hindernissen und vor dem Spieler.

## Gebäude

Jedes Gebäude hat eine Haupttür (**E**) und einen Lift (**L**). Die Lift-Tabelle bietet alle
Stockwerke an, je nach Gebäudehöhe, und immer auch das **Dach**. Beim Ein- und Aussteigen öffnen
und schliessen sich die Lifttüren sichtbar. Jedes Stockwerk ist anders eingerichtet:

- **Luxushotel:** Marmor-Lobby mit Kronleuchtern, Rezeption und Standuhr; oben ein Korridor mit
  Zimmern (Doppelbett, Nachttische mit Lampen, Standuhren, Sessel, Teppiche, Schreibtisch mit
  Flachbildschirm-PC).
- **Firmengebäude:** Lobby mit Logo und Drehkreuzen; Arbeitsplätze mit grossen Pulten und mehreren
  Bildschirmen, Lounge, Pingpong, Serverraum.
- **Normales Büro:** Empfang, Grossraumbüro mit Pulten und grossen PCs, Besprechungsraum,
  Teeküche.
- **ETH:** Halle mit Säulen; Hörsäle, Bibliothek, Rechnerraum.

## Grafikstufen und Leistung

Die Stufe wird im Startmenü gewählt (oder im Spiel mit **Q**) und im Browser gespeichert.

| | Niedrig | Mittel | Hoch |
|---|---|---|---|
| Auflösung | 85 % | 100 % | bis 150 % (HiDPI) |
| Schattenkarte | 1024, ±90 m | 2048, ±140 m | 4096, ±180 m |
| Sichtweite | 1,9 km | 2,7 km | 3,4 km |
| Bäume voll / als Bild ab | 230 m | 380 m | 600 m |
| Gebäude voll / vereinfacht ab | 450 m | 750 m | 1150 m |
| Nachbearbeitung | – | Bloom, FXAA, ACES | zusätzlich SSAO |

- **Automatische Auflösung** (im Menü abschaltbar): Fällt die Bildrate unter etwa 42 FPS, wird die
  Auflösung schrittweise bis auf 55 % gesenkt. Ab etwa 57 FPS steigt sie wieder.
- **Bildraten-Anzeige** (F): FPS, Millisekunden pro Bild, Draw-Calls, Dreiecke, Auflösung.
- **Laden:** Das Gelände wird einmal in ein Höhenraster gerechnet. Shader werden während des
  Ladebalkens übersetzt. U-Bahn-Stationen, Fahrzeuge und Menschen entstehen erst nach dem
  Start-Knopf im Hintergrund.
- **Speicher:** Geometrie wird kompakt gespeichert (Normalen und Farben als 8 Bit, ungenutzte
  Vertexfarben entfallen). Statische Geometrie wird nach dem Laden einmal zur Grafikkarte
  geschickt, danach verwirft das Spiel die Kopie im Arbeitsspeicher. Schilder liegen in einem
  Textur-Atlas, die Wassermaske ist einkanalig. Innenräume geben ihre Daten beim Stockwerkwechsel frei.
- **Verdeckungs-Culling** (`js/occlusion.js`, Taste O schaltet es zum Vergleich ab): Aus den
  Häusern im Umkreis von 220 m entsteht ein 360°-Horizont. Gebäudezellen (250 m), Baum- und
  Strassenkacheln, die vollständig dahinter liegen, werden nicht gezeichnet. Die Bildraten-Anzeige
  zeigt, wie viele Bereiche gerade verdeckt sind.
- **Verkehr:** Autos über 300 m Entfernung werden nur jedes dritte Bild neu berechnet, Fussgänger
  ausserhalb der Sichtweite nur grob weitergezählt.
- **Detailstufen:** Gebäude haben eine vereinfachte Fernversion (ohne Brüstung, Tür, Lifthaus).
  Bäume werden in der Ferne als vorgerenderte Bilder (Impostors) gezeichnet.
- **Fassaden-Atlas:** Alle Gebäudetexturen liegen in einem 2D-Textur-Array (WebGL2). Damit braucht
  jede 250-m-Zelle nur einen Draw-Call für alle Gebäude.
- **Nachbearbeitung** (`js/post.js`): eigene SSAO direkt aus dem logarithmischen Tiefenpuffer
  (ohne zweiten Szenen-Durchgang), Bloom, ACES-Tonemapping, leichte Farbkorrektur und Vignette, FXAA.
  Bloom und FXAA stammen unverändert aus `shared/three-r128-postfx.js` (three.js r128, MIT).

## Assets (Fahrzeuge und Figuren)

Die Modelle liegen getrennt von der Spiellogik in `js/assets/` und lassen sich einzeln prüfen
und optimieren: **[Asset-Testseite](assets.html)** (Detailstufe, Anzahl 1 oder 25, Türanimation,
Dreiecke und Draw-Calls live).

| Asset | Datei | nah | mittel | fern | vorher |
|---|---|---|---|---|---|
| Stadtbus | `assets/bus.js` | 9 Draw-Calls, 4 556 Dreiecke | 5 / 3 312 | 1 / 42 | 26 Draw-Calls |
| Zürcher Tram | `assets/tram.js` | 9 / 4 660 | 5 / 3 912 | 1 / 42 | 32 |
| U-Bahn-Wagen | `assets/tube.js` | 13 / 5 864 | 7 / 4 432 | 1 / 42 | 38 |
| Auto (alle zusammen) | `assets/car.js` | 4 / 632 pro Auto | – | 1 / 32 | 5 |
| Fussgänger (alle zusammen) | `assets/pedestrian.js` | 1 / 482 pro Person | – | 1 / 36 | 6 |

Zielanzeigen kommen pro Fahrzeug dazu (1–2 Draw-Calls).

- **Gemeinsame Schnittstelle** (`assets/assets-core.js`): Spieldaten (Länge, Breite, Bodenhöhe,
  Türen), drei Detailstufen, Türflügel. Die Fahrlogik in `vehicles.js` und `traffic.js` kennt
  nur diese Schnittstelle. Ein Asset kann also ausgetauscht werden (später z. B. durch ein
  glTF-Modell), ohne die Fahrlogik anzufassen.
- **Zusammengefasste Meshes:** Gleich aussehende Teile teilen sich über Vertexfarben ein Material.
  Alle Türflügel, die sich in dieselbe Richtung bewegen, sind ein Mesh.
- **Detailstufen:** nah mit Innenraum (unter 60 m), mittel ohne Innenraum (bis 200 m), fern ein
  Kasten. Die Grenzen skalieren mit der Grafikstufe. In einem Zug wählt jeder Wagen seine Stufe selbst.
- **Fussgänger:** ein instanziertes Mesh; Arme und Beine bewegt der Vertex-Shader über eine
  Teil-Nummer pro Vertex. Das ergibt eine Matrix pro Person statt sechs.

## Technik

- Three.js r128 und die Nachbearbeitungs-Module aus `shared/`, ohne Build-Schritt.
- Alle Texturen (Fassaden, Asphalt, Pflaster, Schilder) entstehen zur Laufzeit auf Canvas.
- Nachts sind die Fenster zufällig beleuchtet (Shader-Erweiterung der Fassaden-Materialien).
- Statische Geometrie wird pro Kachel zusammengefasst; Bäume, Autos und Fussgänger sind
  instanziert. Unterirdisches wird nur in der Nähe gezeichnet, oberirdisches tief unten gar nicht.
- Gespeichert wird nur die Tageszeit (`weltsimulator.save.v1`).

| Datei | Inhalt |
|---|---|
| `js/util.js` | Zufall, Rauschen, Geometrie-Baukasten, räumlicher Hash, Canvas-Texturen |
| `js/config.js` | Eckdaten der Welt, Namenslisten |
| `js/terrain.js` | Höhenfunktion, Fluss, Kanäle, Strand, Gelände, Quaimauern, Wasser |
| `js/roads.js` | Strassennetz, Brücken, Bushaltebuchten, Markierungen, Laternen |
| `js/transit.js` | Bus-, Tram- und U-Bahn-Netz, Stationen, Tunnel, Gleise |
| `js/vehicles.js` | Fahrlogik der Linienfahrzeuge mit 10-s-Halt, Türen, Detailstufen-Wahl |
| `js/assets/*.js` | Modelle: Bus, Tram, U-Bahn-Wagen, Auto, Fussgänger (siehe oben) |
| `js/assets-viewer.js` | Asset-Testseite (`assets.html`) |
| `js/buildings.js` | Fassaden, Stadthäuser, Hotels, Klein-Venedig, ETH |
| `js/nature.js` | Bäume, Parks, Brunnen, Strand, Boote, Wartehäuschen |
| `js/interior.js` | Innenräume pro Kategorie und Stockwerk, Liftkabine |
| `js/sky.js` | Himmel, Tageszeit, Licht, Reflexionen |
| `js/traffic.js` | Fahr- und Gehlogik für Autos und Fussgänger |
| `js/player.js` | Bewegung, Kollision, Mitfahren, Türen, Lift-Ablauf |
| `js/hud.js` | Anzeige, Minikarte, Netzplan, Lift-Tabelle, Töne |
| `js/quality.js` | Grafikstufen, Bildraten-Anzeige, automatische Auflösung, Detailstufen |
| `js/post.js` | Nachbearbeitung: SSAO, Bloom, Tonemapping, FXAA |
| `js/occlusion.js` | Verdeckungs-Culling (Occlusion Horizon) |
| `js/main.js` | Renderer, Laden, Eingabe, Kamera, Spielschleife |
