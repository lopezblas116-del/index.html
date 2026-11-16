const WORLD = { width: 1200, height: 760 };
const FIXED_ISLANDS = [
  { id: "dawn", name: "Isla Dawn", x: 190, y: 170, sea: "East Blue" },
  { id: "shells", name: "Shells Town", x: 300, y: 250, sea: "East Blue" },
  { id: "orange", name: "Orange Town", x: 270, y: 300, sea: "East Blue" },
  { id: "syrup", name: "Villa Syrup", x: 185, y: 340, sea: "East Blue" },
  { id: "baratie", name: "Baratie", x: 350, y: 420, sea: "East Blue" },
  { id: "arlong", name: "Arlong Park", x: 260, y: 500, sea: "East Blue" },
  { id: "loguetown", name: "Loguetown", x: 495, y: 370, sea: "East Blue" },
  { id: "reverse", name: "Reverse Mountain", x: 600, y: 370, sea: "Grand Line" },
  { id: "whiskey", name: "Whiskey Peak", x: 700, y: 370, sea: "Paraíso" },
  { id: "water7", name: "Water 7", x: 815, y: 310, sea: "Paraíso" },
  { id: "ennies", name: "Enies Lobby", x: 875, y: 420, sea: "Paraíso" },
  { id: "sabaody", name: "Archipiélago Sabaody", x: 965, y: 370, sea: "Paraíso" },
  { id: "wano", name: "Wano", x: 1080, y: 290, sea: "Nuevo Mundo" },
  { id: "onyigashima", name: "Onigashima", x: 1105, y: 450, sea: "Nuevo Mundo" },
  { id: "ohara", name: "Isla Ohara", x: 200, y: 80, sea: "West Blue" },
  { id: "flevance", name: "Isla Flevance", x: 970, y: 80, sea: "North Blue" },
  { id: "torino", name: "Isla Torino", x: 970, y: 680, sea: "South Blue" },
  { id: "kano", name: "Isla Kano", x: 200, y: 680, sea: "South Blue" }
];
const DYNAMIC_ISLANDS = [
  { id: "weatheria", name: "Weatheria", x: 410, y: 145, sea: "East Blue" },
  { id: "karakuri", name: "Karakuri", x: 770, y: 115, sea: "North Blue" },
  { id: "namakura", name: "Namakura", x: 430, y: 640, sea: "South Blue" },
  { id: "rusty", name: "Isla del Naufragio", x: 1035, y: 570, sea: "Nuevo Mundo" }
];
const COLORS = { water: "#0b1329", water2: "#102342", grid: "rgba(138,195,204,.10)", land: "#72a86c", landLight: "#a4c57c", red: "#a7463c", gold: "#f4b41a", text: "#ffffff", belt: "rgba(180,215,197,.16)" };
let canvas;
let ctx;
let initialized = false;
let characterState = null;
let camera = { x: 0, y: 0, zoom: 1 };
let pointer = null;
let islands = [...FIXED_ISLANDS];
let selected = null;
let width = 0;
let height = 0;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function seededIndex(seed, limit) { let value = 0; for (const char of String(seed || "voyager")) value = (value * 31 + char.charCodeAt(0)) >>> 0; return value % limit; }
function prepareIslands(character) {
  const offset = seededIndex(character?.id, DYNAMIC_ISLANDS.length);
  islands = [...FIXED_ISLANDS, ...DYNAMIC_ISLANDS.map((island, index) => ({ ...island, x: island.x + ((offset + index) % 3 - 1) * 22, y: island.y + ((offset * (index + 1)) % 3 - 1) * 18 }))];
}
export function newsLocation(entry, character) {
  if (!entry || typeof entry !== "object") entry = { text: String(entry ?? "") };
  const point = entry.coordinates;
  if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) {
    return { x: point.x, y: point.y, name: entry.location || "Zona del evento" };
  }
  const matchingTreasure = character?.systems?.treasureMaps?.find((map) => entry.type === "treasure-map" && entry.text?.includes(map.clue));
  if (Number.isFinite(matchingTreasure?.x) && Number.isFinite(matchingTreasure?.y)) {
    return { x: matchingTreasure.x, y: matchingTreasure.y, name: matchingTreasure.island || "Tesoro oculto" };
  }
  prepareIslands(character);
  const places = [...islands].sort((a, b) => b.name.length - a.name.length);
  const island = entry.location
    ? places.find((place) => place.name.toLocaleLowerCase("es") === String(entry.location).toLocaleLowerCase("es"))
    : places.find((place) => String(entry.text ?? "").toLocaleLowerCase("es").includes(place.name.toLocaleLowerCase("es")));
  return island ? { ...island } : null;
}
export function focusMap(point) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
  camera.x = -point.x;
  camera.y = -point.y;
  drawMap();
}
function resize() {
  if (!canvas || !ctx) return;
  // Use CSS-pixel viewport dimensions so map pointer coordinates and canvas coordinates match.
  width = Math.max(1, window.innerWidth);
  height = Math.max(1, window.innerHeight);
  canvas.width = width;
  canvas.height = height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawMap();
}
export function resizeMap() { resize(); }
function toScreen(point) { return { x: (point.x + camera.x) * camera.zoom + width / 2, y: (point.y + camera.y) * camera.zoom + height / 2 }; }
function toWorld(point) { return { x: (point.x - width / 2) / camera.zoom - camera.x, y: (point.y - height / 2) / camera.zoom - camera.y }; }
function islandPosition(name) { return islands.find((island) => island.name === name) || islands.find((island) => island.name === "Isla Dawn"); }
function drawIsland(island) {
  const p = toScreen(island); const radius = (island.dynamic ? 8 : island.id === "reverse" ? 14 : 11) * camera.zoom;
  ctx.fillStyle = island.dynamic ? "#9cbd77" : COLORS.land;
  ctx.fillRect(Math.round(p.x - radius), Math.round(p.y - radius), Math.round(radius * 2), Math.round(radius * 2));
  ctx.fillStyle = COLORS.landLight;
  ctx.fillRect(Math.round(p.x - radius / 2), Math.round(p.y - radius / 2), Math.max(3, Math.round(radius)), Math.max(3, Math.round(radius / 2)));
  ctx.fillStyle = "rgba(11,19,41,.65)"; ctx.fillRect(p.x - 42, p.y + radius + 3, 84, 16);
  ctx.strokeStyle = selected?.id === island.id ? COLORS.gold : "#d8d69c"; ctx.lineWidth = selected?.id === island.id ? 2 : 1;
  ctx.strokeRect(Math.round(p.x - radius - 2), Math.round(p.y - radius - 2), Math.round(radius * 2 + 4), Math.round(radius * 2 + 4));
  if (camera.zoom >= 0.48) { ctx.font = `bold ${Math.max(10, Math.min(15, 12 * camera.zoom))}px monospace`; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = COLORS.text; ctx.shadowColor = "#061725"; ctx.shadowBlur = 4; ctx.fillText(island.name, p.x, p.y + radius + 5, 80); ctx.shadowBlur = 0; }
}
function drawRegionLabel(text, x, y, size = 25) {
  ctx.save(); ctx.font = `900 ${size}px monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineWidth = 5; ctx.strokeStyle = "rgba(11,19,41,.82)"; ctx.strokeText(text, x, y); ctx.fillStyle = COLORS.gold; ctx.shadowColor = "rgba(244,180,26,.55)"; ctx.shadowBlur = 12; ctx.fillText(text, x, y); ctx.restore();
}
function drawMap() {
  if (!ctx || !width || !height) return;
  ctx.clearRect(0, 0, width, height);
  // Deep-ocean base and a subtle nautical grid across the full viewport.
  ctx.fillStyle = COLORS.water; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.translate(width / 2, height / 2); ctx.scale(camera.zoom, camera.zoom); ctx.translate(camera.x, camera.y);
  ctx.fillStyle = COLORS.water2; ctx.fillRect(-WORLD.width / 2, -WORLD.height / 2, WORLD.width, WORLD.height);
  ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
  for (let x = -WORLD.width / 2; x <= WORLD.width / 2; x += 40) { ctx.beginPath(); ctx.moveTo(x, -WORLD.height / 2); ctx.lineTo(x, WORLD.height / 2); ctx.stroke(); }
  for (let y = -WORLD.height / 2; y <= WORLD.height / 2; y += 40) { ctx.beginPath(); ctx.moveTo(-WORLD.width / 2, y); ctx.lineTo(WORLD.width / 2, y); ctx.stroke(); }
  ctx.fillStyle = COLORS.belt; ctx.fillRect(-WORLD.width / 2, -115, WORLD.width, 48); ctx.fillRect(-WORLD.width / 2, 67, WORLD.width, 48);
  ctx.strokeStyle = "rgba(244,180,26,.38)"; ctx.setLineDash([8, 8]); ctx.strokeRect(-WORLD.width / 2, -115, WORLD.width, 48); ctx.strokeRect(-WORLD.width / 2, 67, WORLD.width, 48); ctx.setLineDash([]);
  // Red Line and the Grand Line crossing.
  ctx.fillStyle = COLORS.red; ctx.fillRect(-22, -WORLD.height / 2, 44, WORLD.height); ctx.fillStyle = "#d77559"; ctx.fillRect(-7, -WORLD.height / 2, 7, WORLD.height);
  ctx.fillStyle = "#8bd3d0"; ctx.fillRect(-WORLD.width / 2, -28, WORLD.width, 56); ctx.fillStyle = "#b5e3d4"; ctx.fillRect(-WORLD.width / 2, -3, WORLD.width, 6);
  drawRegionLabel("EAST BLUE", -490, 260, 26);
  drawRegionLabel("GRAND LINE", 175, -4, 25);
  drawRegionLabel("PARAÍSO", 140, 38, 17);
  drawRegionLabel("RED LINE", 0, -315, 17);
  drawRegionLabel("FRANJA DE CALMA", 70, -88, 14);
  drawRegionLabel("FRANJA DE CALMA", 70, 91, 14);
  ctx.restore();
  islands.forEach(drawIsland);
  const current = islandPosition(characterState?.location?.island);
  const boat = characterState?.mapPosition && Number.isFinite(characterState.mapPosition.x) ? characterState.mapPosition : current;
  if (boat) {
    const p = toScreen(boat); ctx.save();
    if (selected) { const target = toScreen(selected); ctx.strokeStyle = "#ffe08a"; ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(target.x, target.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = "#ffe08a"; ctx.font = "bold 13px monospace"; ctx.textAlign = "left"; ctx.fillText("RUMBO LOG POSE", (p.x + target.x) / 2, (p.y + target.y) / 2 - 8); }
    ctx.translate(p.x, p.y); ctx.fillStyle = "#f4b41a"; ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#712f28"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("⛵", 0, 0); ctx.strokeStyle = "#fff0a8"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  if (selected) { const p = toScreen(selected); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 22 * camera.zoom, 0, Math.PI * 2); ctx.stroke(); }
  drawCompass();
}
function drawCompass() { const x = width - 34, y = 35; ctx.fillStyle = "#162238e8"; ctx.beginPath(); ctx.arc(x, y, 23, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 21, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("N", x, y - 10); ctx.fillStyle = COLORS.gold; ctx.fillText("✦", x, y + 3); }
function pointerPosition(event) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
function islandAt(screen) { const world = toWorld(screen); return islands.find((island) => Math.hypot(island.x - world.x, island.y - world.y) <= 23 / camera.zoom) || null; }
function onPointerDown(event) { if (event.button !== undefined && event.button !== 0) return; pointer = { id: event.pointerId, start: pointerPosition(event), last: pointerPosition(event), moved: false }; canvas.setPointerCapture?.(event.pointerId); }
function onPointerMove(event) { if (!pointer || pointer.id !== event.pointerId) return; const point = pointerPosition(event), dx = point.x - pointer.last.x, dy = point.y - pointer.last.y; if (Math.hypot(point.x - pointer.start.x, point.y - pointer.start.y) > 5) pointer.moved = true; if (pointer.moved) { camera.x += dx / camera.zoom; camera.y += dy / camera.zoom; drawMap(); } pointer.last = point; }
function onPointerUp(event) { if (!pointer || pointer.id !== event.pointerId) return; const state = pointer; pointer = null; if (!state.moved) { const island = islandAt(pointerPosition(event)); if (island) { selected = island; canvas.dispatchEvent(new CustomEvent("onepiece:map-destination", { bubbles: true, detail: { ...island } })); drawMap(); } } }
function onWheel(event) { event.preventDefault(); const before = toWorld(pointerPosition(event)); camera.zoom = clamp(camera.zoom * (event.deltaY < 0 ? 1.12 : 0.89), 0.55, 2.4); const after = toWorld(pointerPosition(event)); camera.x += after.x - before.x; camera.y += after.y - before.y; drawMap(); }
export function initMap() { if (initialized) return; canvas = document.getElementById("world-map"); if (!canvas) return; ctx = canvas.getContext("2d"); if (!ctx) return; initialized = true; canvas.addEventListener("pointerdown", onPointerDown); canvas.addEventListener("pointermove", onPointerMove); canvas.addEventListener("pointerup", onPointerUp); canvas.addEventListener("pointercancel", onPointerUp); canvas.addEventListener("wheel", onWheel, { passive: false }); document.getElementById("map-reset-view")?.addEventListener("click", () => { camera = { x: 0, y: 0, zoom: 1 }; drawMap(); }); window.addEventListener("resize", resize); resize(); }
export function initWorldMap() { return initMap(); }
export function renderMap(character) { initMap(); if (!initialized) return; characterState = character; prepareIslands(character); const target = character.navigationTarget; selected = target?.type === "news" && Number.isFinite(target.x) && Number.isFinite(target.y) ? target : target ? islands.find((island) => island.id === target.id || island.name === target.name) ?? (Number.isFinite(target.x) && Number.isFinite(target.y) ? target : null) : null; drawMap(); }
