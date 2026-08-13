/* ================= EINSTIEGSPUNKT =================
   Prüft, ob Three.js verfügbar ist, erzeugt die gemeinsam genutzten THREE-Objekte und
   startet Aufbau und Hauptschleife. Als einzige Datei führt sie beim Laden Code aus -
   alle anderen Module definieren nur Funktionen und Variablen. */

(function () {
  if (!window.THREE) {
    // Weder lokal noch per CDN verfügbar -> verständliche Meldung statt weisser Seite.
    document.getElementById('loaderr').style.display = 'flex';
    return;
  }

  initSharedObjects();
  init();
  animate();
})();
