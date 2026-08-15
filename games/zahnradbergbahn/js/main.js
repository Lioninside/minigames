(function () {
  "use strict";

  const STORAGE_KEY = "zahnradbergbahn.save.v1";

  if (!window.THREE) {
    document.getElementById("loadError").hidden = false;
    return;
  }

  const sceneRoot = document.getElementById("scene");
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  sceneRoot.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc7d6d1);

  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 100);
  camera.position.set(12, 10, 16);
  camera.lookAt(0, 2.2, 0);

  scene.add(new THREE.HemisphereLight(0xf5fbf5, 0x526351, 1.35));
  const sun = new THREE.DirectionalLight(0xfff6df, 1.4);
  sun.position.set(8, 14, 10);
  scene.add(sun);

  const mountainMaterial = new THREE.MeshStandardMaterial({ color: 0x6c8772, roughness: 0.95 });
  const mountain = new THREE.Mesh(new THREE.ConeGeometry(8.6, 11, 5), mountainMaterial);
  mountain.position.set(-2.5, 4.2, -1.8);
  mountain.rotation.y = Math.PI / 4;
  scene.add(mountain);

  const railway = new THREE.Group();
  railway.position.set(0.8, 2.5, 0);
  railway.rotation.z = -0.34;

  const slope = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.6, 5),
    new THREE.MeshStandardMaterial({ color: 0x8ea98c, roughness: 0.95 })
  );
  railway.add(slope);

  const track = new THREE.Group();
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0x303a37, metalness: 0.35, roughness: 0.52 });
  const toothMaterial = new THREE.MeshStandardMaterial({ color: 0xc9a85d, metalness: 0.24, roughness: 0.52 });
  [-0.62, 0.62].forEach((offset) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(16, 0.12, 0.12), railMaterial);
    rail.position.z = offset;
    track.add(rail);
  });
  for (let index = -24; index <= 24; index += 1) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.24), toothMaterial);
    tooth.position.set(index * 0.32, 0, 0);
    track.add(tooth);
  }
  track.position.y = 0.42;
  railway.add(track);

  const train = new THREE.Group();
  const carriageMaterial = new THREE.MeshStandardMaterial({ color: 0xa73d32, roughness: 0.58, metalness: 0.12 });
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.45, 1.5), carriageMaterial);
  carriage.position.y = 0.92;
  train.add(carriage);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.95, 0.25, 1.72), new THREE.MeshStandardMaterial({ color: 0x26352c, roughness: 0.64 }));
  roof.position.y = 1.72;
  train.add(roof);
  const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x9ed4d8, emissive: 0x2e5f65, emissiveIntensity: 0.28 });
  [-0.72, 0, 0.72].forEach((offset) => {
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.48, 0.04), windowMaterial);
    window.position.set(offset, 1.08, 0.77);
    train.add(window);
  });
  train.position.set(-0.7, 0.32, 0);
  railway.add(train);
  scene.add(railway);

  function render() {
    const { width, height } = sceneRoot.getBoundingClientRect();
    const safeWidth = Math.max(1, Math.round(width));
    const safeHeight = Math.max(1, Math.round(height));
    renderer.setSize(safeWidth, safeHeight, false);
    camera.aspect = safeWidth / safeHeight;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  window.addEventListener("resize", render);
  render();

  try {
    localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    // Storage is optional for the upcoming game state.
  }
}());
