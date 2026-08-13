/* ================= FAHRZEUG-SHOP =================
   Kauf und Auswahl der Sonder-Autos gegen Pokale. */

/* ================= FAHRZEUG-SHOP ================= */

function openShop() {
  document.getElementById('shopTrophies').textContent = trophies;
  CARS.forEach(c => {
    const card = document.getElementById('shopcard-' + c.id);
    if (!card) return;
    const owned = ownedCars.includes(c.id);
    const status = card.querySelector('.shopStatus');
    card.classList.toggle('owned', owned);
    card.classList.toggle('selected', playerCarId === c.id);
    if (owned) status.textContent = (playerCarId === c.id) ? '✓ ausgewählt' : 'wählen';
    else status.textContent = (trophies >= 1) ? '1 🏆 kaufen' : 'gesperrt';
  });
  document.getElementById('shop').style.display = 'flex';
}

/* Klick auf eine Auto-Karte: gekaufte Autos nur auswählen, neue für 1 Pokal kaufen. */
function pickCar(id) {
  const owned = ownedCars.includes(id);
  if (!owned) {
    if (trophies < 1) return; // gesperrt
    trophies -= 1;
    ownedCars.push(id);
  }
  playerCarId = id;
  saveProgress();
  setPlayerCar(id);
  openShop(); // Anzeige aktualisieren
}

function setupShopUI() {
  CARS.forEach(c => {
    const card = document.getElementById('shopcard-' + c.id);
    if (card) card.addEventListener('click', () => pickCar(c.id));
  });
  const closeBtn = document.getElementById('shopClose');
  if (closeBtn) closeBtn.addEventListener('click', proceedAfterResult);
}
