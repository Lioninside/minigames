/* ================= SPAWNLOGIK UND SCHWIERIGKEIT =================
   Entscheidet, wann und wo Minen und feindliche U-Boote entstehen, und wie stark die
   Schwierigkeit mit der Distanz steigt.

   Alle Regeln zum Spielrhythmus stehen hier an einer Stelle - Balancing lässt sich also
   ändern, ohne Zustandsautomat, Kamera oder HUD anzufassen. */

const Spawner = (function () {
  const MINE_INTERVAL = 20;     // pro 20 m Fortschritt entstehen 1-3 Minen
  const SPAWN_MIN = 50;         // Gefahren erscheinen 50-100 m voraus
  const SPAWN_MAX = 100;
  const MAX_ACTIVE_MINES = 42;
  const FIRST_SUB_AT = 60;      // Meter bis zum ersten U-Boot

  let nextMineProgress = MINE_INTERVAL;
  let nextSubProgress = FIRST_SUB_AT;

  function reset() {
    nextMineProgress = MINE_INTERVAL;
    nextSubProgress = FIRST_SUB_AT;
  }

  /* Stufenweise Steigerung, nach oben gedeckelt - auch weit draussen bleibt es spielbar. */
  function difficultyFor(dist) {
    if (dist < 500) return 0.0;
    if (dist < 1500) return 0.3;
    if (dist < 3000) return 0.6;
    return 0.85;
  }

  /* Punkt 50-100 m voraus, verteilt über den befahrbaren Korridor.
     Die Breite richtet sich nach Player.CORRIDOR, damit Gefahren erreichbar und
     ausweichbar bleiben, statt weit neben der Fahrspur zu liegen. */
  function pointAhead(player) {
    const half = Player.CORRIDOR + 8;
    return {
      x: (Math.random() * 2 - 1) * half,
      z: player.position.z - (SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN))
    };
  }

  function spawnMines(player) {
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      if (Mines.activeCount >= MAX_ACTIVE_MINES) return;
      const p = pointAhead(player);
      // Sicherheitsabstand: nie direkt vor dem Bug ohne Reaktionszeit
      if (Math.hypot(p.x - player.position.x, p.z - player.position.z) < SPAWN_MIN * 0.8) continue;
      Mines.spawn(p.x, p.z, Math.random() < 0.45);
    }
  }

  function spawnSub(player, difficulty) {
    const maxSubs = 2 + Math.round(difficulty * 3); // gedeckelt, damit es fair bleibt
    if (Enemies.activeSubs >= maxSubs) return;
    const p = pointAhead(player);
    Enemies.spawnSub(p.x, p.z, difficulty);
  }

  /* Wird jeden Frame mit dem aktuellen Streckenfortschritt aufgerufen.
     Gibt die aktuelle Schwierigkeit zurück, die auch die Gegner-KI nutzt. */
  function update(progress, player) {
    const difficulty = difficultyFor(progress);

    while (progress >= nextMineProgress) {
      nextMineProgress += MINE_INTERVAL;
      spawnMines(player);
    }

    if (progress >= nextSubProgress) {
      // mit steigender Schwierigkeit rücken die U-Boote enger zusammen
      nextSubProgress = progress + THREE.MathUtils.lerp(90, 55, difficulty) + Math.random() * 45;
      spawnSub(player, difficulty);
    }

    return difficulty;
  }

  return { reset, update, difficultyFor };
})();
