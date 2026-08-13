/* ================= SPEICHERSYSTEM =================
   Dauerhafte Ablage von Münzen, gekauften Fahrzeugen, Highscore und Einstellungen
   im localStorage. Wird nach jeder wichtigen Änderung sofort geschrieben, damit
   nach einem Absturz oder Neuladen nichts verloren geht. */

const SaveSystem = (function () {
  const KEY = 'ubootgame.save.v1';

  // Welche Fahrzeuge gratis sind, steht in vehicles.js - hier wird nichts hartcodiert.
  function defaults() {
    return {
      coins: 0,
      ownedVehicles: Vehicles.freeIds(),
      selectedVehicle: Vehicles.DEFAULT_ID,
      highscore: 0,
      volume: 0.7,
      muted: false
    };
  }

  let data = null; // wird in load() gefüllt (Vehicles ist dann sicher geladen)

  function write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      // Privater Modus / voller Speicher: das Spiel läuft weiter, nur ohne Persistenz.
    }
  }

  function load() {
    data = defaults();
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch (e) {
      stored = null;
    }
    if (stored && typeof stored === 'object') {
      data.coins = Math.max(0, Math.floor(stored.coins) || 0);
      data.highscore = Math.max(0, Math.floor(stored.highscore) || 0);
      data.volume = typeof stored.volume === 'number' ? THREE.MathUtils.clamp(stored.volume, 0, 1) : data.volume;
      data.muted = !!stored.muted;
      const free = Vehicles.freeIds();
      const owned = Array.isArray(stored.ownedVehicles) ? stored.ownedVehicles.filter(id => typeof id === 'string') : [];
      // Gratisfahrzeuge sind immer dabei, egal was gespeichert war
      data.ownedVehicles = free.concat(owned.filter(id => !free.includes(id)));
      data.selectedVehicle = data.ownedVehicles.includes(stored.selectedVehicle)
        ? stored.selectedVehicle : Vehicles.DEFAULT_ID;
    }
    return data;
  }

  return {
    load,
    get data() { return data; },

    get coins() { return data.coins; },
    addCoins(n) { data.coins += n; write(); },
    spendCoins(n) {
      if (data.coins < n) return false;
      data.coins -= n;
      write();
      return true;
    },

    owns(id) { return data.ownedVehicles.includes(id); },
    addVehicle(id) {
      if (!data.ownedVehicles.includes(id)) data.ownedVehicles.push(id);
      write();
    },

    get selectedVehicle() { return data.selectedVehicle; },
    selectVehicle(id) { data.selectedVehicle = id; write(); },

    get highscore() { return data.highscore; },
    /* Gibt true zurück, wenn ein neuer Rekord aufgestellt wurde. */
    reportDistance(meters) {
      const m = Math.floor(meters);
      if (m > data.highscore) {
        data.highscore = m;
        write();
        return true;
      }
      return false;
    },

    get volume() { return data.muted ? 0 : data.volume; },
    get rawVolume() { return data.volume; },
    get muted() { return data.muted; },
    setVolume(v) { data.volume = THREE.MathUtils.clamp(v, 0, 1); write(); },
    setMuted(m) { data.muted = !!m; write(); },

    resetProgress() {
      data = defaults();
      write();
    }
  };
})();
