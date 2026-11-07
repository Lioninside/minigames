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
| Leertaste | springen; im Wasser ans Ufer klettern |
| Shift | rennen |
| E | Gebäude an der Haupttür betreten / am Ausgang verlassen |
| L | Lift rufen, einsteigen, aussteigen |
| M | Netzplan mit U-Bahn, Tram und Buslinien |
| V | Ego- oder Verfolgerkamera (zeigt die Figur) |
| T | Zeitraffer an/aus |

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

## Technik

- Three.js r128 aus `shared/`, ohne weitere Bibliotheken und ohne Build-Schritt.
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
| `js/vehicles.js` | Bus, Tram, U-Bahn-Wagen, Fahrlogik mit 10-s-Halt und Türen |
| `js/buildings.js` | Fassaden, Stadthäuser, Hotels, Klein-Venedig, ETH |
| `js/nature.js` | Bäume, Parks, Brunnen, Strand, Boote, Wartehäuschen |
| `js/interior.js` | Innenräume pro Kategorie und Stockwerk, Liftkabine |
| `js/sky.js` | Himmel, Tageszeit, Licht, Reflexionen |
| `js/traffic.js` | Autos und Fussgänger |
| `js/player.js` | Bewegung, Kollision, Mitfahren, Türen, Lift-Ablauf |
| `js/hud.js` | Anzeige, Minikarte, Netzplan, Lift-Tabelle, Töne |
| `js/main.js` | Renderer, Laden, Eingabe, Kamera, Spielschleife |
