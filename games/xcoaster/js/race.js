/* ================= RENN-SYSTEM =================
   Levelrennen, Schloss-Duell, Sieg/Niederlage, Neustart und die Entgleisungs-Regel. */

/* ================= RENN-SYSTEM (1 Runde pro Level, gewinnen oder zurück zu Level 1) ================= */

function resetPlayerToStart() {
  distanceTraveled = 0; playerIdx.i = 0; speedKmh = 0;
  inGondola = false; gondolaProgress = 0;
  falling = false; gameOver = false;
  playerLap = 0;
  if (cartGroup) cartGroup.rotation.set(0, 0, 0);
  if (camera) { camera.fov = 70; camera.updateProjectionMatrix(); }
}

function resetOpponentToStart(s) {
  s.distanceTraveled = 0; s.idx.i = 0; s.speedKmh = 0;
  s.throttle = false; s.targetSpeed = aiMaxSpeed - 100;
  s.inGondola = false; s.gondolaProgress = 0; s.lap = 0;
  if (s.gondolaInfo) { s.gondolaInfo.box.position.copy(s.gondolaInfo.entryPos); s.gondolaInfo.box.quaternion.copy(s.gondolaInfo.entryQuat); }
}

function hideOverlays() {
  ['intro', 'gameover', 'raceresult', 'shop'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
}

/* Startet ein normales Level-Rennen (alle Autos an der Startlinie, eine Runde). */
function startRace(lv) {
  level = lv; inDuel = false; raceActive = true; raceResult = null; started = false;
  applyLevelTheme(lv);
  resetPlayerToStart();
  aiStates.forEach(s => { s.cartGroup.visible = true; resetOpponentToStart(s); });
  if (dragonState) dragonState.cartGroup.visible = false;
  if (gondolaInfo) { gondolaInfo.box.position.copy(gondolaInfo.entryPos); gondolaInfo.box.quaternion.copy(gondolaInfo.entryQuat); }
  hideOverlays();
  showLevelBanner();
}

/* Startet das Schloss-Duell gegen das Drachenauto (1 gegen 1, eine Runde). */
function startDuel() {
  inDuel = true; raceActive = true; raceResult = null; started = false; level = MAX_LEVEL + 1;
  applyTheme(DUEL_THEME, DUEL_DRAGON_SPEED);
  resetPlayerToStart();
  aiStates.forEach(s => { s.cartGroup.visible = false; });
  dragonState.cartGroup.visible = true;
  resetOpponentToStart(dragonState);
  hideOverlays();
  showLevelBanner('🐉 Schloss-Duell! Schlag das Drachenauto!');
}

/* Wird aufgerufen, sobald der Player seine Rennrunde beendet: als Erster -> weiter, sonst Level 1. */
function finishRace() {
  const opponents = inDuel ? [dragonState] : aiStates;
  const won = opponents.every(o => o.lap === 0); // niemand hat die Runde vor dir beendet
  raceActive = false;
  if (!won) { loseRace(); return; }
  if (inDuel) { winDuel(); return; }
  if (level < MAX_LEVEL) startRace(level + 1);
  else startDuel();
}

function loseRace() {
  raceActive = false; raceResult = 'lost';
  document.getElementById('raceResultTitle').textContent = '😢 Rennen verloren';
  document.getElementById('raceResultMsg').textContent = inDuel
    ? 'Das Drachenauto war schneller. Es geht zurück zu Level 1.'
    : 'Du bist nicht als Erster ins Ziel gekommen. Es geht zurück zu Level 1.';
  document.getElementById('raceresult').style.display = 'flex';
}

function winDuel() {
  raceActive = false; raceResult = 'won';
  trophies++; saveProgress();
  openShop();
}

/* Nach einem verlorenen Rennen / geschlossenem Shop: neu ab Level 1. */
function proceedAfterResult() {
  hideOverlays();
  startRace(1);
}

/* ================= GAME STATE ================= */

// Vollständiger Neustart ab Level 1 (nach Absturz / verlorenem Rennen).
function resetGame() {
  startRace(1);
}

/* Wird ausgeloest, wenn der Player mehr als OVERSPEED_MARGIN (100 km/h) ueber dem
   aktuellen Limit ist und dabei in eine Kurve faehrt: die Bahn verlaesst die Schiene
   und faellt endgueltig ins All. */
function startFalling() {
  falling = true;
  fallElapsed = 0;
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cartGroup.quaternion);
  fallVelocity.copy(fwd).multiplyScalar((speedKmh / 3.6) * 0.4);
}

function finalizeDerail() {
  falling = false;
  gameOver = true;
  raceActive = false;
  document.getElementById('finalScore').textContent = inDuel ? 'Schloss-Duell' : ('Level ' + level);
  document.getElementById('gameover').style.display = 'flex';
}

function flashWrap() {
  const f = document.getElementById('flash');
  f.style.opacity = '1';
  setTimeout(() => { f.style.opacity = '0'; }, 180);
}
