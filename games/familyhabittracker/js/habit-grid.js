/* ================= PUNKTRASTER (SVG) =================
   Ein Habit = ein Raster: eine Spalte pro Woche, eine Zeile pro Wochentag
   (Montag oben). Erfuellte Tage leuchten in der Farbe des Habits, offene Tage
   bleiben gedaempft, kuenftige Tage der laufenden Woche bleiben leer.
*/

const HABIT_GRID_WEEKS = 13;       /* Tracker: 91 Tage je Habit */
const HABIT_PATTERN_DAYS = 30;     /* Uebersicht: 30 Tage je Person */
const HABIT_CELL = 15;
const HABIT_PATTERN_SIZE = 12;     /* quadratische Felder */
const HABIT_PATTERN_GAP = 3;
const HABIT_GAP = 4;
const HABIT_SVG_NS = 'http://www.w3.org/2000/svg';

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

/* Muster fuer die Uebersicht: eine Zeile ist ein Tag, eine Spalte eine
   Aufgabe. Oben steht heute, darunter die Tage davor. Ein erfuelltes Feld
   leuchtet in der Farbe seiner Aufgabe, ein offenes bleibt gedaempft -
   dadurch wird ueber HABIT_PATTERN_DAYS Tage sichtbar, was sich wiederholt.
   Bewusst ohne Raender, Beschriftung und Markierung: die oberste Zeile ist
   heute, alles Weitere waere Beiwerk. */
function habitBuildPattern(data, userId) {
  const typen = habitTypesOf(userId);
  const step = HABIT_PATTERN_SIZE + HABIT_PATTERN_GAP;
  const width = typen.length * step - HABIT_PATTERN_GAP;
  const height = HABIT_PATTERN_DAYS * step - HABIT_PATTERN_GAP;

  const user = habitUserById(userId);
  const svg = habitSvg('svg', {
    class: 'habit-pattern',
    viewBox: `0 0 ${width} ${height}`,
    width: width,
    height: height,
    role: 'img',
    'aria-label': `${user ? user.name : userId}: letzte ${HABIT_PATTERN_DAYS} Tage, ` +
                  `eine Zeile je Tag, eine Spalte je Aufgabe`
  });

  const heute = new Date();
  for (let zeile = 0; zeile < HABIT_PATTERN_DAYS; zeile++) {
    const key = habitDateKey(habitAddDays(heute, -zeile));   // oben ist heute
    typen.forEach((habit, spalte) => {
      const done = habitIsDone(data, userId, key, habit.id);
      const feld = habitSvg('rect', {
        x: spalte * step,
        y: zeile * step,
        width: HABIT_PATTERN_SIZE,
        height: HABIT_PATTERN_SIZE,
        rx: 3,
        class: 'habit-field' + (done ? ' is-done' : '')
      });
      if (done) feld.style.fill = habit.color;
      feld.appendChild(habitSvg('title', {})).textContent =
        `${habitFormatDate(key)} – ${habit.label}: ${done ? 'erledigt' : 'offen'}`;
      svg.appendChild(feld);
    });
  }
  return svg;
}
