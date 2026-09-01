# Family Habit Tracker

Kleiner Habit-Tracker für die Familie, gedacht für einen fest montierten Touchscreen zuhause.
**M**, **N**, **L** und **C** tragen selbst ein, was sie an einem Tag erledigt haben.

## Habits

Jede Person hat ihre eigene Liste. M, N und L teilen sich eine, C hat eine eigene:

| M, N und L | C |
|---|---|
| 🎵 Instrument geübt | 🧦 Socken weggeräumt |
| 📚 Hausaufgaben gemacht | 👕 Nasse Kleider aufgehängt |
| 🧹 Ämtli ausgeführt | 🛏️ Bett gemacht |
| 🏠 Rechtzeitig zu Hause | 📱 Handy auf dem Regal |
| ⭐ Spezial Job | 🍵 Tee gekocht |

Standard ist immer *nicht gemacht* – eingetragen wird also nur, was tatsächlich erledigt wurde.

Wer welche Habits sieht, steht in `js/habit-data.js`: `HABIT_TYPES` ist der Katalog aller Habits,
`HABIT_USERS` gibt jeder Person ihre Liste. Eine Person umzustellen heisst dort eine Zeile ändern.

## Bedienung

1. **Übersicht** – pro Person der heutige Stand und ein Raster der letzten 30 Tage: **eine Zeile
   ist ein Tag, eine Spalte eine Aufgabe**, oben steht heute. Ein erfülltes Feld leuchtet in der
   Farbe seiner Aufgabe, ein offenes bleibt gedämpft. So wird als Muster sichtbar, was sich
   wiederholt – eine durchgehend gefüllte Spalte ist eine Aufgabe, die täglich klappt, eine leere
   eine, die liegen bleibt. Diese Ansicht ist ohne PIN sichtbar, damit ein Blick im Vorbeigehen
   genügt.
2. **PIN** – Benutzer antippen und die dreistellige Zahl auf dem Ziffernblock eingeben. Die PIN
   steht in `js/habit-data.js` (`HABIT_USERS`).
3. **Tracker** – die eigenen Habits des heutigen Tages an- und abwählen. Daneben zeigt ein
   Punktraster die letzten 13 Wochen und die aktuelle Serie.

Nach zwei Minuten ohne Berührung geht es automatisch zurück zur Übersicht; jede Berührung im
Tracker verlängert die Sitzung. Mit **Fertig** lässt sich sofort abmelden.

## Sicherung

Der Verlauf liegt im Browser genau des Geräts, an dem eingetragen wird – ein Gerätewechsel oder ein
geleerter Browserspeicher nimmt ihn mit. Über **Sicherung** in der Übersicht lässt er sich deshalb
ablegen und zurückholen:

- **Speichern** – als Datei (`familyhabittracker-JJJJ-MM-TT.json`) oder als Text zum Kopieren. Der
  Text steht immer daneben, weil manche Browser vom Skript ausgelöste Downloads unterbinden.
- **Einspielen** – Datei wählen oder Text einfügen. Die Sicherung wird zuerst geprüft und
  zusammengefasst; erst danach erscheinen die beiden Wege:
  - **Ersetzen** stellt genau den gesicherten Stand her.
  - **Zusammenführen** legt die Sicherung zum vorhandenen Bestand dazu und entfernt dabei nichts –
    gedacht für zwei Geräte, auf denen unabhängig eingetragen wurde.

Beim Einlesen wird streng geprüft: unbekannte Benutzer, unmögliche Datumsangaben, Tage in der
Zukunft und Habits, die der jeweiligen Person gar nicht gehören, werden verworfen und gezählt,
statt ungeprüft in den Bestand zu wandern.

Das Einspielen ist der einzige Weg, an einem vergangenen Tag etwas zu ändern – im Alltag bleibt
jeder abgeschlossene Tag fest.

## Regeln

- **Nur der heutige Tag ist änderbar.** Solange der Tag läuft, kann ein Habit beliebig oft an- und
  abgewählt werden.
- **Vergangene Tage sind fest.** Die Speicherfunktion `habitSetToday()` nimmt gar kein Datum
  entgegen – sie schreibt ausschliesslich auf den heutigen Tag. Es gibt in der Oberfläche keinen
  Weg, einen älteren Tag zu korrigieren.
- **Tageswechsel** wird auch dann erkannt, wenn die Seite tagelang offen bleibt: um Mitternacht
  springt die Anzeige auf die Übersicht des neuen Tages zurück.

Die PIN schützt bewusst nur gegen versehentliches Eintragen für jemand anderen. Alles läuft lokal
im Browser, nichts wird versendet.

## Technik

Reines HTML, CSS und JavaScript – keine Bibliothek, kein Build-Schritt.

```
index.html            Grundgerüst der drei Ansichten
habit-tracker.css     dunkles Touch-Layout
js/habit-data.js      Benutzer, Habits, Speicherung, Datums- und Serienlogik
js/habit-grid.js      Punktraster und Tagespunkte als SVG
js/habit-backup.js    Sicherung schreiben, prüfen und einspielen
js/habit-screens.js   Übersicht, PIN-Eingabe, Tracker, Sicherung, Sitzung
js/main.js            einzige Datei, die beim Laden startet
```

Gespeichert wird unter dem Schlüssel `familyhabittracker.data.v1` im `localStorage` des Browsers:

```json
{ "version": 1, "users": { "M": { "2026-08-31": ["instrument", "aemtli"] },
                           "C": { "2026-08-31": ["bett", "tee"] } } }
```

Die Daten liegen damit nur auf dem Gerät, auf dem eingetragen wird. Für den Umzug auf ein anderes
Gerät gibt es die **Sicherung** oben.
