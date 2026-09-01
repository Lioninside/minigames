/* ================= PUNKTRASTER (SVG) =================
   Ein Habit = ein Raster: eine Spalte pro Woche, eine Zeile pro Wochentag
   (Montag oben). Erfuellte Tage leuchten in der Farbe des Habits, offene Tage
   bleiben gedaempft, kuenftige Tage der laufenden Woche bleiben leer.
*/

const HABIT_GRID_WEEKS = 13;       /* Tracker: 91 Tage je Habit */
const HABIT_PATTERN_WEEKS = 6;     /* Uebersicht: 42 Tage je Person */
const HABIT_CELL = 15;
const HABIT_PATTERN_CELL = 14;
const HABIT_GAP = 4;
const HABIT_SVG_NS = 'http://www.w3.org/2000/svg';
const HABIT_WEEKDAYS = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];

function habitSvg(name, attrs) {
  const node = document.createElementNS(HABIT_SVG_NS, name);
  for (const key in attrs) node.setAttribute(key, String(attrs[key]));
  return node;
}

/* Raster der letzten HABIT_GRID_WEEKS Wochen bis einschliesslich heute. */
function habitBuildGrid(data, userId, habit) {
  const step = HABIT_CELL + HABIT_GAP;
  const width = HABIT_GRID_WEEKS * step - HABIT_GAP;
  const height = 7 * step - HABIT_GAP;

  const svg = habitSvg('svg', {
    class: 'habit-grid',
    viewBox: `0 0 ${width} ${height}`,
    width: width,
    height: height,
    role: 'img',
    'aria-label': `${habit.label}: letzte ${HABIT_GRID_WEEKS} Wochen`
  });

  const todayKey = habitToday();
  const firstMonday = habitAddDays(habitMondayOf(new Date()), -(HABIT_GRID_WEEKS - 1) * 7);

  for (let week = 0; week < HABIT_GRID_WEEKS; week++) {
    for (let day = 0; day < 7; day++) {
      const date = habitAddDays(firstMonday, week * 7 + day);
      const key = habitDateKey(date);
      const future = key > todayKey;
      const done = !future && habitIsDone(data, userId, key, habit.id);

      const cell = habitSvg('rect', {
        x: week * step,
        y: day * step,
        width: HABIT_CELL,
        height: HABIT_CELL,
        rx: 3.5,
        class: 'habit-cell' + (done ? ' is-done' : '') + (future ? ' is-future' : '') +
               (key === todayKey ? ' is-today' : '')
      });
      if (done) cell.style.fill = habit.color; // Inline-Style, sonst gewinnt die CSS-Regel
      cell.appendChild(habitSvg('title', {})).textContent =
        `${habitFormatDate(key)} – ${done ? 'erledigt' : future ? 'noch offen' : 'nicht erledigt'}`;
      svg.appendChild(cell);
    }
  }
  return svg;
}

/* Muster fuer die Uebersicht: die letzten HABIT_PATTERN_WEEKS Wochen als
   Kalender - Wochentage als Spalten (Montag links), Wochen als Zeilen, die
   laufende Woche unten. Ein Punkt ist ein Tag; je mehr Habits an dem Tag
   erledigt wurden, desto kraeftiger leuchtet er in der Farbe der Person.
   Dadurch faellt auf, was sich wiederholt - etwa ein immer offener Mittwoch. */
function habitBuildPattern(data, userId) {
  const step = HABIT_PATTERN_CELL + HABIT_GAP;
  const kopf = 13;                       // Zeile mit den Wochentagen
  const width = 7 * step - HABIT_GAP;
  const height = kopf + HABIT_PATTERN_WEEKS * step - HABIT_GAP;

  const user = habitUserById(userId);
  const anzahl = habitTypesOf(userId).length;
  const farbe = user ? user.color : '#94a6b5';

  const svg = habitSvg('svg', {
    class: 'habit-pattern',
    viewBox: `0 0 ${width} ${height}`,
    width: width,
    height: height,
    role: 'img',
    'aria-label': `Letzte ${HABIT_PATTERN_WEEKS * 7} Tage von ${user ? user.name : userId}`
  });

  /* Ohne die Wochentage waere eine leere Spalte nicht zu deuten. */
  HABIT_WEEKDAYS.forEach((name, i) => {
    const label = habitSvg('text', {
      x: i * step + HABIT_PATTERN_CELL / 2, y: kopf - 5,
      'text-anchor': 'middle', class: 'habit-weekday'
    });
    label.textContent = name;
    svg.appendChild(label);
  });

  const todayKey = habitToday();
  const firstMonday = habitAddDays(habitMondayOf(new Date()), -(HABIT_PATTERN_WEEKS - 1) * 7);

  for (let week = 0; week < HABIT_PATTERN_WEEKS; week++) {
    for (let day = 0; day < 7; day++) {
      const date = habitAddDays(firstMonday, week * 7 + day);
      const key = habitDateKey(date);
      const future = key > todayKey;
      const done = future ? 0 : habitCountDone(data, userId, key);

      const cell = habitSvg('rect', {
        x: day * step,
        y: kopf + week * step,
        width: HABIT_PATTERN_CELL,
        height: HABIT_PATTERN_CELL,
        rx: 3,
        class: 'habit-cell' + (done > 0 ? ' is-done' : '') + (future ? ' is-future' : '') +
               (key === todayKey ? ' is-today' : '')
      });
      if (done > 0 && anzahl > 0) {
        cell.style.fill = farbe;
        // Ein einzelnes Haekchen bleibt sichtbar, ein voller Tag leuchtet ganz.
        cell.style.fillOpacity = String(0.3 + 0.7 * (done / anzahl));
      }
      cell.appendChild(habitSvg('title', {})).textContent = future
        ? `${habitFormatDate(key)} – noch offen`
        : `${habitFormatDate(key)} – ${done} von ${anzahl}`;
      svg.appendChild(cell);
    }
  }
  return svg;
}
