/* ================= SHOP (HAFENWERFT) =================
   Öffnet mit K, schliesst mit C - solange er offen ist, pausiert das Spiel vollständig.
   Für jedes Fahrzeug wird einmalig eine echte 3D-Vorschau gerendert und als Bild zwischen-
   gespeichert, damit im Shop kein zweiter dauerhafter WebGL-Kontext nötig ist. */

const Shop = (function () {
  let grid = null;
  let coinLabel = null;
  let previews = {};           // id -> dataURL
  let onSelect = null;         // Rückruf ins Spiel: Fahrzeug übernehmen

  /* Rendert alle Fahrzeugvorschauen einmal in einen temporären Renderer. */
  function buildPreviews() {
    const W = 300, H = 130;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(1);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a2231);
    scene.add(new THREE.HemisphereLight(0xbfd8e6, 0x14202a, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(4, 8, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88bbe0, 0.6);
    rim.position.set(-6, 3, -5);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 3000);

    Vehicles.list.forEach(def => {
      const built = Vehicles.create(def.id);
      const model = built.group;
      scene.add(model);

      // Modell einpassen: Kamera anhand der Bounding-Box positionieren
      const box = new THREE.Box3().setFromObject(model);
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(38) / 2) * 0.62;
      camera.position.set(dist * 0.75, sphere.radius * 0.55 + dist * 0.22, dist * 0.72);
      camera.lookAt(sphere.center);
      camera.far = dist * 6;
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
      previews[def.id] = renderer.domElement.toDataURL('image/png');

      scene.remove(model);
      model.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    });

    renderer.dispose();
    renderer.forceContextLoss();
  }

  function statBar(value, max) {
    const pct = Math.round(THREE.MathUtils.clamp(value / max, 0, 1) * 100);
    return '<span class="bar"><i style="width:' + pct + '%"></i></span>';
  }

  function render() {
    if (!grid) return;
    coinLabel.textContent = SaveSystem.coins;
    grid.innerHTML = '';

    Vehicles.list.forEach(def => {
      const owned = SaveSystem.owns(def.id);
      const active = SaveSystem.selectedVehicle === def.id;
      const affordable = SaveSystem.coins >= def.price;

      const card = document.createElement('div');
      card.className = 'shopItem' + (active ? ' active' : '') + (!owned && !affordable ? ' locked' : '');

      const img = document.createElement('canvas');
      img.width = 300; img.height = 130;
      const c = img.getContext('2d');
      if (previews[def.id]) {
        const image = new Image();
        image.onload = () => c.drawImage(image, 0, 0, img.width, img.height);
        image.src = previews[def.id];
      }
      card.appendChild(img);

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = def.name;
      card.appendChild(name);

      const price = document.createElement('div');
      price.className = 'price' + (owned ? ' owned' : '');
      price.textContent = owned ? (active ? '✓ im Einsatz' : '✓ im Besitz') : ('🪙 ' + def.price);
      card.appendChild(price);

      const specs = document.createElement('div');
      specs.className = 'specs';
      specs.innerHTML =
        '<div class="specRow"><span>Tempo</span>' + statBar(def.maxSpeed, 26) + '<span>' + def.maxSpeed + ' kn</span></div>' +
        '<div class="specRow"><span>Wendigkeit</span>' + statBar(def.turn, 1.0) + '</div>' +
        '<div class="specRow"><span>Grösse</span><span>' + def.sizeLabel + '</span></div>' +
        '<div class="specRow"><span>Bewaffnung</span><span class="' + (def.armed ? 'armed' : '') + '">' +
          (def.armed === 'guns' ? 'Kanonen' : def.armed === 'bombs' ? 'Bomben' : 'unbewaffnet') + '</span></div>';
      card.appendChild(specs);

      const desc = document.createElement('div');
      desc.className = 'specs';
      desc.textContent = def.desc;
      card.appendChild(desc);

      const btn = document.createElement('button');
      if (active) {
        btn.textContent = 'Aktiv';
        btn.disabled = true;
      } else if (owned) {
        btn.textContent = 'Übernehmen';
        btn.className = 'primary';
        btn.onclick = () => choose(def.id);
      } else if (affordable) {
        btn.textContent = 'Kaufen (' + def.price + ')';
        btn.className = 'primary';
        btn.onclick = () => buy(def);
      } else {
        btn.textContent = 'Zu teuer';
        btn.disabled = true;
      }
      card.appendChild(btn);

      grid.appendChild(card);
    });
  }

  function buy(def) {
    if (!SaveSystem.spendCoins(def.price)) return;
    SaveSystem.addVehicle(def.id);
    AudioEngine.purchase();
    choose(def.id);
  }

  function choose(id) {
    SaveSystem.selectVehicle(id);
    AudioEngine.menuClick();
    if (onSelect) onSelect(id);
    render();
  }

  function init(selectCallback) {
    grid = document.getElementById('shopGrid');
    coinLabel = document.getElementById('shopCoins');
    onSelect = selectCallback;
    buildPreviews();
  }

  return { init, render };
})();
