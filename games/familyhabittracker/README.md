# Family Habit Tracker

Kleiner Habit-Tracker für die Familie, gedacht für einen fest montierten Touchscreen zuhause.
**M**, **N** und **L** tragen selbst ein, was sie an einem Tag erledigt haben.

## Habits

| Habit | Farbe |
|---|---|
| 🎵 Instrument geübt | violett |
| 📚 Hausaufgaben gemacht | gelb |
| 🧹 Ämtli ausgeführt | blau |
| 🏠 Rechtzeitig zu Hause | grün |
| ⭐ Spezial Job | rot |

Für alle drei gelten dieselben fünf Habits. Standard ist immer *nicht gemacht* – eingetragen wird
also nur, was tatsächlich erledigt wurde.

## Bedienung

1. **Übersicht** – zeigt für M, N und L, wie viele Habits sie heute schon erledigt haben. Diese
   Ansicht ist ohne PIN sichtbar, damit ein Blick im Vorbeigehen genügt.
2. **PIN** – Benutzer antippen und die dreistellige Zahl auf dem Ziffernblock eingeben. Die PIN
   steht in `js/habit-data.js` (`HABIT_USERS`).
3. **Tracker** – die fünf Habits des heutigen Tages an- und abwählen. Darunter zeigt ein Punktraster
   die letzten 13 Wochen und die aktuelle Serie.

Nach zwei Minuten ohne Berührung geht es automatisch zurück zur Übersicht; jede Berührung im
Tracker verlängert die Sitzung. Mit **Fertig** lässt sich sofort abmelden.

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
js/habit-screens.js   Übersicht, PIN-Eingabe, Tracker, Sitzung
js/main.js            einzige Datei, die beim Laden startet
```

Gespeichert wird unter dem Schlüssel `familyhabittracker.data.v1` im `localStorage` des Browsers:

```json
{ "version": 1, "users": { "M": { "2026-08-31": ["instrument", "aemtli"] } } }
```

Die Daten liegen damit nur auf dem Gerät, auf dem eingetragen wird. Wer das Gerät ersetzt, nimmt
den Verlauf über einen Export des `localStorage` mit – oder fängt neu an.
