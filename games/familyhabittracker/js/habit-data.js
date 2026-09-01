/* ================= DATEN & REGELN =================
   Benutzer, Habits, Speicherung und die Regel "nur der heutige Tag ist aenderbar".
   Diese Datei definiert ausschliesslich Funktionen und Werte - gestartet wird in main.js.
*/

const HABIT_STORAGE_KEY = 'familyhabittracker.data.v1';

/* Katalog aller Habits. Wer welche davon sieht, steht bei den Benutzern.
   Die fuenf Farben wiederholen sich pro Person, damit die Raster gleich lesen. */
const HABIT_TYPES = [
  { id: 'instrument',   label: 'Instrument geübt',      icon: '🎵', color: '#c084fc' },
  { id: 'hausaufgaben', label: 'Hausaufgaben gemacht',  icon: '📚', color: '#f5b83c' },
  { id: 'aemtli',       label: 'Ämtli ausgeführt',      icon: '🧹', color: '#5aa9f8' },
  { id: 'zuhause',      label: 'Rechtzeitig zu Hause',  icon: '🏠', color: '#4ade80' },
  { id: 'spezialjob',   label: 'Spezial Job',           icon: '⭐', color: '#fb7185' },

  { id: 'socken',       label: 'Socken weggeräumt',     icon: '🧦', color: '#c084fc' },
  { id: 'kleider',      label: 'Nasse Kleider aufgehängt', icon: '👕', color: '#f5b83c' },
  { id: 'bett',         label: 'Bett gemacht',          icon: '🛏️', color: '#5aa9f8' },
  { id: 'handy',        label: 'Handy auf dem Regal',   icon: '📱', color: '#4ade80' },
  { id: 'tee',          label: 'Tee gekocht',           icon: '🍵', color: '#fb7185' }
];

/* Die Benutzer mit ihren eigenen Habits. Die PIN ist bewusst kurz: das Geraet
   steht zuhause am Touchscreen, sie verhindert nur das versehentliche
   Eintragen fuer jemand anderen. */
const HABIT_USERS = [
  { id: 'M', name: 'M', pin: '324', color: '#c084fc',
    habits: ['instrument', 'hausaufgaben', 'aemtli', 'zuhause', 'spezialjob'] },
  { id: 'N', name: 'N', pin: '313', color: '#f5b83c',
    habits: ['instrument', 'hausaufgaben', 'aemtli', 'zuhause', 'spezialjob'] },
  { id: 'L', name: 'L', pin: '171', color: '#4ade80',
    habits: ['instrument', 'hausaufgaben', 'aemtli', 'zuhause', 'spezialjob'] },
  { id: 'C', name: 'C', pin: '861', color: '#2dd4bf',
    habits: ['socken', 'kleider', 'bett', 'handy', 'tee'] }
];

/* Die Habits einer Person, in ihrer Reihenfolge. */
function habitTypesOf(userId) {
  const user = HABIT_USERS.find(u => u.id === userId);
  if (!user) return [];
  return user.habits
    .map(id => HABIT_TYPES.find(h => h.id === id))
    .filter(Boolean);
}

/* ---------- Datum ----------
   Bewusst lokale Datumsfelder statt toISOString(): sonst wechselt der "Tag"
   je nach Zeitzone mitten am Abend. */
function habitDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function habitToday() {
  return habitDateKey(new Date());
}

function habitAddDays(date, days) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

/* Montag der Woche, in der das Datum liegt. */
function habitMondayOf(date) {
  const day = (date.getDay() + 6) % 7; // 0 = Montag
  return habitAddDays(date, -day);
}

function habitFormatDate(key) {
  const [y, m, d] = key.split('-');
  return `${d}.${m}.${y}`;
}

/* ---------- Speicherung ----------
   Ein einziger Schluessel mit Ordner-Praefix, damit sich nichts mit anderen
   Seiten derselben Origin beisst. Aufbau:
   { version: 1, users: { M: { "2026-08-31": ["instrument", "aemtli"] } } } */
function habitLoad() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(HABIT_STORAGE_KEY);
  } catch {
    return { version: 1, users: {} };
  }
  if (!raw) return { version: 1, users: {} };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.users !== 'object' || !parsed.users) {
      return { version: 1, users: {} };
    }
    return { version: 1, users: parsed.users };
  } catch {
    return { version: 1, users: {} };
  }
}

function habitSave(data) {
  try {
    window.localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false; // z. B. privater Modus - die Anzeige bleibt trotzdem bedienbar
  }
}

function habitEntriesOf(data, userId, dateKey) {
  const perUser = data.users[userId];
  const list = perUser && perUser[dateKey];
  return Array.isArray(list) ? list : [];
}

function habitIsDone(data, userId, dateKey, habitId) {
  return habitEntriesOf(data, userId, dateKey).indexOf(habitId) !== -1;
}

function habitCountDone(data, userId, dateKey) {
  const list = habitEntriesOf(data, userId, dateKey);
  return habitTypesOf(userId).filter(h => list.indexOf(h.id) !== -1).length;
}

/* Setzt einen Habit fuer HEUTE. Vergangene Tage sind bewusst nicht aenderbar:
   die Funktion nimmt gar kein Datum entgegen, damit es dafuer keinen Weg gibt. */
function habitSetToday(data, userId, habitId, done) {
  const dateKey = habitToday();
  if (!data.users[userId]) data.users[userId] = {};
  const day = data.users[userId];
  const list = Array.isArray(day[dateKey]) ? day[dateKey].slice() : [];
  const at = list.indexOf(habitId);

  if (done && at === -1) list.push(habitId);
  if (!done && at !== -1) list.splice(at, 1);

  if (list.length === 0) delete day[dateKey];
  else day[dateKey] = list;

  habitSave(data);
  return data;
}

/* Aktuelle Serie: zurueck ab heute. Ein noch offener heutiger Tag beendet die
   Serie nicht - sonst waere sie den ganzen Vormittag ueber auf 0. */
function habitStreak(data, userId, habitId) {
  const today = new Date();
  let cursor = habitIsDone(data, userId, habitDateKey(today), habitId) ? today : habitAddDays(today, -1);
  let count = 0;
  for (let i = 0; i < 400; i++) {
    if (!habitIsDone(data, userId, habitDateKey(cursor), habitId)) break;
    count++;
    cursor = habitAddDays(cursor, -1);
  }
  return count;
}

function habitUserById(userId) {
  return HABIT_USERS.find(u => u.id === userId) || null;
}
