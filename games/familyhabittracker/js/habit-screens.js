/* ================= BILDSCHIRME & ABLAUF =================
   Drei Ansichten auf einem Touchscreen:
     1. Übersicht  - wer hat heute was erledigt, Auswahl des Benutzers
     2. PIN        - dreistellige Zahl auf einem grossen Ziffernblock
     3. Tracker    - die fuenf Habits des heutigen Tages an- und abwaehlen
     4. Sicherung  - Verlauf als Datei ablegen oder wieder einspielen

   Nach SESSION_MS ohne Beruehrung geht es automatisch zurueck zur Übersicht,
   damit niemand versehentlich fuer jemand anderen eintraegt.
*/

const HABIT_SESSION_MS = 120000; // 2 Minuten Sitzung nach der PIN-Eingabe

const habitApp = {
  data: null,
  userId: null,      // eingeloggter Benutzer, sonst null
  pinFor: null,      // Benutzer, dessen PIN gerade eingegeben wird
  pin: '',
  sessionEndsAt: 0,
  dayKey: '',
  pending: null,     // geprüfte, noch nicht eingespielte Sicherung
  el: {}
};

/* ---------- Bildschirmwechsel ---------- */
function habitShow(screen) {
  for (const name of ['overview', 'pin', 'tracker', 'backup']) {
    habitApp.el[name].classList.toggle('is-active', name === screen);
  }
}

function habitGoOverview() {
  habitApp.userId = null;
  habitApp.pinFor = null;
  habitApp.pin = '';
  habitApp.sessionEndsAt = 0;
  habitRenderOverview();
  habitShow('overview');
}

/* ---------- Übersicht ---------- */
function habitRenderOverview() {
  const list = habitApp.el.userList;
  list.textContent = '';
  const todayKey = habitToday();

  for (const user of HABIT_USERS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'user-card';
    button.dataset.user = user.id;
    button.style.setProperty('--user-color', user.color);

    const initial = document.createElement('span');
    initial.className = 'user-initial';
    initial.textContent = user.name;
    button.appendChild(initial);

    const count = document.createElement('span');
    count.className = 'user-count';
    count.textContent = `${habitCountDone(habitApp.data, user.id, todayKey)} von ${HABIT_TYPES.length} heute`;
    button.appendChild(count);

    button.appendChild(habitBuildTodayDots(habitApp.data, user.id));
    list.appendChild(button);
  }

  habitApp.el.todayLabel.textContent = habitFormatDate(todayKey);
}

/* ---------- PIN ---------- */
function habitStartPin(userId) {
  const user = habitUserById(userId);
  if (!user) return;
  habitApp.pinFor = userId;
  habitApp.pin = '';
  habitApp.el.pinName.textContent = user.name;
  habitApp.el.pinName.style.setProperty('--user-color', user.color);
  habitApp.el.pinPad.classList.remove('is-wrong');
  habitRenderPin();
  habitShow('pin');
}

function habitRenderPin() {
  const dots = habitApp.el.pinDots.children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].classList.toggle('is-filled', i < habitApp.pin.length);
  }
}

function habitPinInput(key) {
  if (key === 'del') {
    habitApp.pin = habitApp.pin.slice(0, -1);
    habitRenderPin();
    return;
  }
  if (habitApp.pin.length >= 3) return;
  habitApp.pin += key;
  habitRenderPin();
  if (habitApp.pin.length === 3) window.setTimeout(habitCheckPin, 120);
}

function habitCheckPin() {
  const user = habitUserById(habitApp.pinFor);
  if (user && habitApp.pin === user.pin) {
    habitApp.userId = user.id;
    habitApp.pin = '';
    habitExtendSession();
    habitRenderTracker();
    habitShow('tracker');
    return;
  }
  habitApp.pin = '';
  habitRenderPin();
  habitApp.el.pinPad.classList.add('is-wrong');
  window.setTimeout(() => habitApp.el.pinPad.classList.remove('is-wrong'), 450);
}

/* ---------- Tracker ---------- */
function habitRenderTracker() {
  const user = habitUserById(habitApp.userId);
  if (!user) { habitGoOverview(); return; }

  habitApp.el.trackerName.textContent = user.name;
  habitApp.el.trackerName.style.setProperty('--user-color', user.color);
  habitApp.el.trackerDate.textContent = habitFormatDate(habitToday());

  const list = habitApp.el.habitList;
  list.textContent = '';
  const todayKey = habitToday();

  for (const habit of HABIT_TYPES) {
    const done = habitIsDone(habitApp.data, user.id, todayKey, habit.id);

    const card = document.createElement('article');
    card.className = 'habit-card' + (done ? ' is-done' : '');
    card.style.setProperty('--habit-color', habit.color);

    const text = document.createElement('div');
    text.className = 'habit-text';
    const title = document.createElement('h2');
    title.textContent = `${habit.icon} ${habit.label}`;
    const streak = document.createElement('p');
    const days = habitStreak(habitApp.data, user.id, habit.id);
    streak.textContent = days > 0
      ? `🔥 ${days} ${days === 1 ? 'Tag' : 'Tage'} in Folge`
      : 'Noch keine Serie';
    text.appendChild(title);
    text.appendChild(streak);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'habit-toggle';
    toggle.dataset.habit = habit.id;
    toggle.setAttribute('aria-pressed', done ? 'true' : 'false');
    toggle.setAttribute('aria-label', `${habit.label} für heute ${done ? 'abwählen' : 'erledigt setzen'}`);
    toggle.textContent = '✓';

    card.appendChild(text);
    card.appendChild(habitBuildGrid(habitApp.data, user.id, habit));
    card.appendChild(toggle);
    list.appendChild(card);
  }
}

function habitToggle(habitId) {
  if (!habitApp.userId) return;
  const done = habitIsDone(habitApp.data, habitApp.userId, habitToday(), habitId);
  habitSetToday(habitApp.data, habitApp.userId, habitId, !done);
  habitRenderTracker();
}

/* ---------- Sitzung ---------- */
function habitExtendSession() {
  habitApp.sessionEndsAt = Date.now() + HABIT_SESSION_MS;
  habitRenderSession();
}

function habitRenderSession() {
  if (!habitApp.userId) return;
  const left = Math.max(0, habitApp.sessionEndsAt - Date.now());
  const seconds = Math.ceil(left / 1000);
  habitApp.el.sessionLabel.textContent =
    `noch ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function habitTick() {
  // Tageswechsel: das Geraet laeuft durch, der heutige Tag muss trotzdem stimmen.
  const today = habitToday();
  if (today !== habitApp.dayKey) {
    habitApp.dayKey = today;
    habitGoOverview();
    return;
  }
  if (!habitApp.userId) return;
  if (Date.now() >= habitApp.sessionEndsAt) { habitGoOverview(); return; }
  habitRenderSession();
}


/* ---------- Sicherung ---------- */
function habitOpenBackup() {
  habitApp.userId = null;          // Sicherung ist kein Ort fuer eine laufende Sitzung
  habitApp.sessionEndsAt = 0;
  habitResetBackupImport();
  habitApp.el.backupText.value = habitExportText(habitApp.data);
  habitApp.el.backupInfo.textContent = habitDescribeStats(habitBackupStats(habitApp.data.users));
  habitShow('backup');
}

function habitResetBackupImport() {
  habitApp.pending = null;
  habitApp.el.backupPaste.value = '';
  habitApp.el.backupStatus.textContent = '';
  habitApp.el.backupConfirm.hidden = true;
}

/* Prueft einen Text und zeigt, was daraus wuerde - eingespielt wird erst danach. */
function habitCheckBackup(text) {
  const result = habitParseBackup(text);
  if (!result.ok) {
    habitApp.pending = null;
    habitApp.el.backupConfirm.hidden = true;
    habitApp.el.backupStatus.textContent = result.error;
    return;
  }
  habitApp.pending = result.users;
  habitApp.el.backupConfirm.hidden = false;
  habitApp.el.backupStatus.textContent =
    `Gefunden: ${habitDescribeStats(result.stats)}` +
    (result.ignored > 0 ? ` ${result.ignored} unbekannte Angaben werden übergangen.` : '');
}

function habitRunBackup(mode) {
  if (!habitApp.pending) return;
  habitApplyBackup(habitApp.data, habitApp.pending, mode);
  const stats = habitBackupStats(habitApp.data.users);
  habitResetBackupImport();
  habitApp.el.backupText.value = habitExportText(habitApp.data);
  habitApp.el.backupInfo.textContent = habitDescribeStats(stats);
  habitApp.el.backupStatus.textContent =
    mode === 'replace' ? 'Sicherung eingespielt, bisheriger Stand ersetzt.'
                       : 'Sicherung dazugelegt, nichts wurde entfernt.';
  habitRenderOverview();
}
