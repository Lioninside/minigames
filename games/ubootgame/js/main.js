/* ================= EINSTIEGSPUNKT =================
   Startet das Spiel in klar getrennten Schritten und meldet den Fortschritt an den
   Ladebildschirm. Zwischen den Schritten wird jeweils ein Frame abgewartet, damit der
   Ladebalken sichtbar mitläuft statt am Stück zu blockieren. */

(function () {
  if (!window.THREE) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('loaderr').classList.remove('hidden');
    return;
  }

  const bar = document.getElementById('loadingBar');
  const label = document.getElementById('loadingLabel');

  const steps = [
    ['Gespeicherten Fortschritt laden …', () => SaveSystem.load()],
    ['Renderer starten …', () => Game.initRenderer()],
    ['Meer und Himmel aufbauen …', () => Game.initWorld()],
    ['Effekte vorbereiten …', () => Effects.init(Game.scene)],
    ['Fahrzeug einsetzen …', () => Game.createPlayer()],
    ['Minenfelder vorbereiten …', () => Mines.init(Game.scene)],
    ['Feindliche U-Boote vorbereiten …', () => Enemies.init(Game.scene)],
    ['Bewaffnung vorbereiten …', () => Weapons.init(Game.scene)],
    ['Radar kalibrieren …', () => { Game.initUi(); Radar.init(); }],
    ['Werft-Vorschauen rendern …', () => Shop.init(id => Game.applyVehicle(id))],
    ['Bedienung verknüpfen …', () => Game.bindUi()]
  ];

  let i = 0;

  function next() {
    if (i >= steps.length) {
      bar.style.width = '100%';
      label.textContent = 'Bereit.';
      setTimeout(() => {
        document.getElementById('loading').classList.add('hidden');
        Game.start();
      }, 250);
      return;
    }

    const [text, fn] = steps[i];
    label.textContent = text;
    bar.style.width = Math.round((i / steps.length) * 100) + '%';

    // Ein Frame Pause, damit der Browser den Balken zeichnen kann
    requestAnimationFrame(() => {
      try {
        fn();
      } catch (err) {
        label.textContent = 'Fehler beim Schritt: ' + text;
        console.error(err);
        return;
      }
      i++;
      next();
    });
  }

  next();
})();
