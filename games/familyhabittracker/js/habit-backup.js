/* ================= SICHERUNG =================
   Die Daten liegen im localStorage genau des Geraets, an dem eingetragen wird.
   Diese Datei erzeugt daraus eine Textdatei und liest sie wieder ein - der
   einzige Weg, einen Verlauf auf ein anderes Geraet zu bringen.

   Beim Einlesen wird streng geprueft: unbekannte Benutzer, unbekannte Habits,
   unmoegliche Datumsangaben und Tage in der Zukunft werden verworfen und
   gezaehlt, statt ungeprueft in den Bestand zu wandern.
*/

function habitExportText(data) {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    users: data.users
  }, null, 2);
}

function habitBackupName() {
  return `familyhabittracker-${habitToday()}.json`;
}

/* Kurzfassung eines Bestandes: wie viele Tage, welcher Zeitraum. */
function habitBackupStats(users) {
  let days = 0;
  let entries = 0;
  let first = null;
  let last = null;

  for (const userId in users) {
    for (const dateKey in users[userId]) {
      const list = users[userId][dateKey];
      if (!Array.isArray(list) || list.length === 0) continue;
      days++;
      entries += list.length;
      if (!first || dateKey < first) first = dateKey;
      if (!last || dateKey > last) last = dateKey;
    }
  }
  return { days, entries, first, last };
}

function habitDescribeStats(stats) {
  if (stats.days === 0) return 'Noch keine Einträge.';
  const zeitraum = stats.first === stats.last
    ? habitFormatDate(stats.first)
    : `${habitFormatDate(stats.first)} bis ${habitFormatDate(stats.last)}`;
  const tage = stats.days === 1 ? '1 Tag' : `${stats.days} Tagen`;
  return `${stats.entries} Häkchen an ${tage}, ${zeitraum}.`;
}

function habitValidDateKey(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/* Liest den Text einer Sicherung und gibt nur das zurueck, was gueltig ist. */
function habitParseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Das ist keine gültige Sicherungsdatei – der Text lässt sich nicht lesen.' };
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.users || typeof parsed.users !== 'object') {
    return { ok: false, error: 'In der Datei fehlt der Abschnitt mit den Benutzern.' };
  }

  const knownUsers = HABIT_USERS.map(u => u.id);
  const knownHabits = HABIT_TYPES.map(h => h.id);
  const today = habitToday();
  const users = {};
  let ignored = 0;

  for (const userId in parsed.users) {
    if (knownUsers.indexOf(userId) === -1) { ignored++; continue; }
    const days = parsed.users[userId];
    if (!days || typeof days !== 'object') { ignored++; continue; }

    for (const dateKey in days) {
      if (!habitValidDateKey(dateKey) || dateKey > today) { ignored++; continue; }
      const list = days[dateKey];
      if (!Array.isArray(list)) { ignored++; continue; }

      const clean = [];
      for (const habitId of list) {
        if (knownHabits.indexOf(habitId) !== -1 && clean.indexOf(habitId) === -1) clean.push(habitId);
        else ignored++;
      }
      if (clean.length === 0) continue;
      if (!users[userId]) users[userId] = {};
      users[userId][dateKey] = clean;
    }
  }

  const stats = habitBackupStats(users);
  if (stats.days === 0) {
    return { ok: false, error: 'Die Datei enthält keine verwertbaren Einträge.' };
  }
  return { ok: true, users, stats, ignored };
}

/* 'replace' stellt den Stand der Sicherung her, 'merge' legt ihn dazu.
   Zusammenfuehren kann nie etwas verlieren: pro Tag wird vereinigt. */
function habitApplyBackup(data, users, mode) {
  if (mode === 'replace') {
    data.users = users;
    habitSave(data);
    return data;
  }

  for (const userId in users) {
    if (!data.users[userId]) data.users[userId] = {};
    for (const dateKey in users[userId]) {
      const vorhanden = Array.isArray(data.users[userId][dateKey]) ? data.users[userId][dateKey] : [];
      const zusammen = vorhanden.slice();
      for (const habitId of users[userId][dateKey]) {
        if (zusammen.indexOf(habitId) === -1) zusammen.push(habitId);
      }
      data.users[userId][dateKey] = zusammen;
    }
  }
  habitSave(data);
  return data;
}

/* Datei anbieten. Manche Browser unterbinden vom Skript ausgeloeste Downloads -
   deshalb steht der Text daneben immer auch zum Kopieren bereit. */
function habitDownloadText(text, filename) {
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
