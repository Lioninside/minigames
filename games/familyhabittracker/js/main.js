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
    habitList: document.getElementById('habitList')
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
