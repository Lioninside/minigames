/* ================= MINIMAP =================
   Navi-Streckenübersicht unten links mit den Positionen aller Autos. */

/* ================= MINIMAP (Navi-Übersicht unten links) ================= */

function initMinimap() {
  miniCanvas = document.getElementById('minimap');
  if (!miniCanvas) return;
  miniCtx = miniCanvas.getContext('2d');
  const W = miniCanvas.width, H = miniCanvas.height, pad = 12;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  trackPoints.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); });
  const spanX = (maxX - minX) || 1, spanZ = (maxZ - minZ) || 1;
  const s = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanZ);
  const ox = (W - s * spanX) / 2, oz = (H - s * spanZ) / 2;
  const toX = x => ox + (x - minX) * s;
  const toY = z => oz + (z - minZ) * s;
  miniProjected = { toX, toY };

  // Streckenlinie EINMAL in ein Offscreen-Canvas rendern (jede Runde identisch)
  miniTrackCanvas = document.createElement('canvas');
  miniTrackCanvas.width = W; miniTrackCanvas.height = H;
  const c = miniTrackCanvas.getContext('2d');
  c.strokeStyle = 'rgba(120,130,180,0.85)';
  c.lineWidth = 2;
  c.beginPath();
  trackPoints.forEach((p, i) => { const x = toX(p.x), y = toY(p.z); i ? c.lineTo(x, y) : c.moveTo(x, y); });
  c.stroke();
}

function drawMinimap() {
  if (!miniCtx || !miniProjected) return;
  const W = miniCanvas.width, H = miniCanvas.height;
  miniCtx.clearRect(0, 0, W, H);
  miniCtx.drawImage(miniTrackCanvas, 0, 0); // vorgezeichnete Strecke
  // Autos als Punkte
  const dots = [];
  dots.push({ x: cartGroup.position.x, z: cartGroup.position.z, color: '#16209c', me: true });
  if (inDuel) {
    dots.push({ x: dragonState.cartGroup.position.x, z: dragonState.cartGroup.position.z, color: '#cc2200', me: false });
  } else {
    aiStates.forEach((s, i) => dots.push({ x: s.cartGroup.position.x, z: s.cartGroup.position.z, color: RACER_META[i + 1].color, me: false }));
  }
  dots.forEach(d => {
    miniCtx.beginPath();
    miniCtx.arc(miniProjected.toX(d.x), miniProjected.toY(d.z), d.me ? 5 : 3.5, 0, Math.PI * 2);
    miniCtx.fillStyle = d.color;
    miniCtx.fill();
    if (d.me) { miniCtx.lineWidth = 2; miniCtx.strokeStyle = '#fff'; miniCtx.stroke(); }
  });
}
