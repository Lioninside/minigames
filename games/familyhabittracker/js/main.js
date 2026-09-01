/* ================= START =================
   Einzige Datei, die beim Laden Code ausfuehrt: Elemente einsammeln,
   Ereignisse verbinden, Uhr starten.
*/

function habitInit() {
  habitApp.el = {
    overview: document.getElementById('screenOverview'),
    pin: document.getElementById('screenPin'),
    tracker: document.getElementById('screenTracker'),
    userList: document.getElementById('userList'),
    todayLabel: document.getElementById('todayLabel'),
    pinName: document.getElementById('pinName'),
    pinDots: document.getElementById('pinDots'),
    pinPad: document.getElementById('pinPad'),
    trackerName: document.getElementById('trackerName'),
    trackerDate: document.getElementById('trackerDate'),
    sessionLabel: document.getElementById('sessionLabel'),
    habitList: document.getElementById('habitList'),
    backup: document.getElementById('screenBackup'),
    backupInfo: document.getElementById('backupInfo'),
    backupText: document.getElementById('backupText'),
    backupPaste: document.getElementById('backupPaste'),
    backupStatus: document.getElementById('backupStatus'),
    backupConfirm: document.getElementById('backupConfirm')
  };

  habitApp.data = habitLoad();
  habitApp.dayKey = habitToday();

  /* Benutzer waehlen */
  habitApp.el.userList.addEventListener('click', event => {
    const card = event.target.closest('.user-card');
    if (card) habitStartPin(card.dataset.user);
  });

  /* Ziffernblock */
  habitApp.el.pinPad.addEventListener('click', event => {
    const key = event.target.closest('button[data-key]');
    if (key) habitPinInput(key.dataset.key);
  });
  document.getElementById('pinCancel').addEventListener('click', habitGoOverview);

  /* Habits umschalten - nur der heutige Tag, das erledigt habitSetToday. */
  habitApp.el.habitList.addEventListener('click', event => {
    const toggle = event.target.closest('.habit-toggle');
    if (toggle) habitToggle(toggle.dataset.habit);
  });
  document.getElementById('trackerDone').addEventListener('click', habitGoOverview);

  /* Jede Beruehrung im Tracker verlaengert die Sitzung. */
  habitApp.el.tracker.addEventListener('pointerdown', habitExtendSession);

  /* Sicherung: speichern, einspielen */
  document.getElementById('openBackup').addEventListener('click', habitOpenBackup);
  document.getElementById('backupClose').addEventListener('click', habitGoOverview);

  document.getElementById('backupDownload').addEventListener('click', () => {
    const geschafft = habitDownloadText(habitApp.el.backupText.value, habitBackupName());
    habitApp.el.backupInfo.textContent = geschafft
      ? `Gespeichert als ${habitBackupName()}.`
      : 'Dieser Browser erlaubt kein Speichern – bitte den Text unten kopieren.';
  });

  document.getElementById('backupCopy').addEventListener('click', async () => {
    const text = habitApp.el.backupText.value;
    habitApp.el.backupText.select();
    let geschafft = false;
    try {
      await navigator.clipboard.writeText(text);
      geschafft = true;
    } catch {
      try { geschafft = document.execCommand('copy'); } catch { geschafft = false; }
    }
    habitApp.el.backupInfo.textContent = geschafft
      ? 'Text kopiert – jetzt irgendwo einfügen und aufbewahren.'
      : 'Kopieren nicht möglich – Text ist markiert, bitte von Hand kopieren.';
  });

  document.getElementById('backupFile').addEventListener('change', event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const leser = new FileReader();
    leser.onload = () => habitCheckBackup(String(leser.result));
    leser.onerror = () => { habitApp.el.backupStatus.textContent = 'Die Datei liess sich nicht lesen.'; };
    leser.readAsText(file);
    event.target.value = '';   // dieselbe Datei soll erneut waehlbar sein
  });

  document.getElementById('backupCheck').addEventListener('click',
    () => habitCheckBackup(habitApp.el.backupPaste.value));
  document.getElementById('backupReplace').addEventListener('click', () => habitRunBackup('replace'));
  document.getElementById('backupMerge').addEventListener('click', () => habitRunBackup('merge'));
  document.getElementById('backupCancel').addEventListener('click', habitResetBackupImport);

  document.addEventListener('keydown', event => {
    if (habitApp.el.pin.classList.contains('is-active')) {
      if (/^[0-9]$/.test(event.key)) habitPinInput(event.key);
      else if (event.key === 'Backspace') habitPinInput('del');
      else if (event.key === 'Escape') habitGoOverview();
    } else if (event.key === 'Escape') {
      habitGoOverview();
    }
  });

  habitGoOverview();
  window.setInterval(habitTick, 1000);
}

/* Start, sobald das Grundgeruest steht - auch wenn das Skript erst spaeter geladen wird. */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', habitInit);
else habitInit();
