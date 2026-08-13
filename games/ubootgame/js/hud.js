/* ================= HUD =================
   Alle Textanzeigen und Einblendungen während der Fahrt: Münzen, Tempo, Distanz, Highscore,
   Fahrzeugname, Flugzeit, Torpedo-Warnung und der Ruder-Hinweis.

   Sämtliche Zugriffe auf DOM-Elemente der Spielanzeige laufen über dieses Modul - wer eine
   Anzeige ändern oder ergänzen will, muss nur hier und in der index.html arbeiten. */

const Hud = (function () {
  const ui = {};

  const IDS = [
    'coinVal', 'speedVal', 'distVal', 'hsVal', 'vehicleVal',
    'flightVal', 'flightPanel', 'warnPanel', 'steerPanel'
  ];

  function init() {
    IDS.forEach(id => { ui[id] = document.getElementById(id); });
  }

  function show(el, visible) {
    if (el) el.classList.toggle('hidden', !visible);
  }

  /* state.running steuert nur, ob situative Hinweise erscheinen dürfen. */
  function update(player, progress, keys, running, force) {
    ui.coinVal.textContent = SaveSystem.coins;
    ui.speedVal.textContent = Math.round(Math.abs(player.speed)) + ' kn';
    ui.distVal.textContent = Math.floor(progress) + ' m';
    ui.hsVal.textContent = SaveSystem.highscore + ' m';
    if (force) ui.vehicleVal.textContent = player.def.name;

    // Restliche Flugzeit nur beim Wasserflugzeug
    const flying = player.def.seaplane && (player.flying || player.altitude > 0.5);
    show(ui.flightPanel, flying);
    if (flying) ui.flightVal.textContent = player.remainingFlight.toFixed(1).replace('.', ',');

    show(ui.warnPanel, Enemies.warning);

    // Erklärt, warum das Lenken ohne Fahrt wirkungslos bleibt
    const steeringWithoutWay = (keys.left || keys.right) && player.steerAuthority < 0.06;
    show(ui.steerPanel, running && steeringWithoutWay);
  }

  function setVehicleName(name) {
    if (ui.vehicleVal) ui.vehicleVal.textContent = name;
  }

  return { init, update, setVehicleName };
})();
