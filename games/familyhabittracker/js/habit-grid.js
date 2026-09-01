/* ================= PUNKTRASTER (SVG) =================
   Ein Habit = ein Raster: eine Spalte pro Woche, eine Zeile pro Wochentag
   (Montag oben). Erfuellte Tage leuchten in der Farbe des Habits, offene Tage
   bleiben gedaempft, kuenftige Tage der laufenden Woche bleiben leer.
*/

const HABIT_GRID_WEEKS = 13;
const HABIT_CELL = 15;
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

/* Kleine Punktreihe fuer die Uebersicht: ein Punkt pro Habit, heutiger Stand. */
function habitBuildTodayDots(data, userId) {
  const step = 22;
  const size = 16;
  const width = HABIT_TYPES.length * step - (step - size);

  const svg = habitSvg('svg', {
    class: 'habit-dots',
    viewBox: `0 0 ${width} ${size}`,
    width: width,
    height: size,
    role: 'img',
    'aria-label': `Heute erledigt: ${habitCountDone(data, userId, habitToday())} von ${HABIT_TYPES.length}`
  });

  const todayKey = habitToday();
  HABIT_TYPES.forEach((habit, i) => {
    const done = habitIsDone(data, userId, todayKey, habit.id);
    const dot = habitSvg('rect', {
      x: i * step, y: 0, width: size, height: size, rx: 4,
      class: 'habit-dot' + (done ? ' is-done' : '')
    });
    if (done) dot.style.fill = habit.color;
    dot.appendChild(habitSvg('title', {})).textContent =
      `${habit.label} – ${done ? 'erledigt' : 'offen'}`;
    svg.appendChild(dot);
  });
  return svg;
}
