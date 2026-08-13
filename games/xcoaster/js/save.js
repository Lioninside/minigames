/* ================= FORTSCHRITT SPEICHERN =================
   Pokale, gekaufte Autos und das gewählte Auto im localStorage. */

function loadProgress() {
  try {
    const d = JSON.parse(localStorage.getItem('xcoaster_progress') || '{}');
    trophies = d.trophies || 0;
    ownedCars = Array.isArray(d.ownedCars) ? d.ownedCars : [];
    playerCarId = d.playerCarId || 'default';
  } catch (e) { trophies = 0; ownedCars = []; playerCarId = 'default'; }
}
function saveProgress() {
  try { localStorage.setItem('xcoaster_progress', JSON.stringify({ trophies, ownedCars, playerCarId })); } catch (e) {}
}

// ---- Motorsound (Web Audio): elektrischer Sci-Fi-Antrieb, folgt der aktuellen Geschwindigkeit ----
let audioCtx = null;
let audioListener = null; // fuer die 3D-positionierten KI-Motorsounds
let subOsc, carrierOsc, modOsc, ringGain, driveShaper, engineFilter, engineGain;
let windNoise, windFilter, windGain;
let shimmerGain, spaceDelay, spaceWet;

// Weiche Tangens-Verzerrungskurve fuers WaveShaping (mehr "Biss"/Obertöne, kein hartes Clipping)
