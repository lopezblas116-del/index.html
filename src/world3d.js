import { getMapIslands } from "./map.js";
import { routeFor } from "./game.js";
import { islandDetails } from "./islands_data.js";

const WIDTH = 1200;
const HEIGHT = 760;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const radians = (point) => ({
  lon: (point.x / WIDTH - 0.5) * Math.PI * 2,
  lat: (0.5 - point.y / HEIGHT) * Math.PI
});
let canvas, ctx, character, width = 0, height = 0, radius = 0;
let longitude = -2.05, latitude = 0.25, islands = [], animation;
let boatPosition, zoom = 1, targetZoom = 1, dashOffset = 0, pointers = new Map(), pinchStart, frame = null;
export const GLOBAL_MAP = "GLOBAL_MAP";
export const ISLAND_VIEW = "ISLAND_VIEW";
let cameraState = GLOBAL_MAP, transition = null, savedCamera = null;
let modalOpen = false;
const mapCovered = () => modalOpen || Boolean(document.querySelector?.("dialog[open]"));
export function getCameraState() { return cameraState; }

function project(lon, lat) {
  const delta = lon - longitude;
  const x = Math.cos(lat) * Math.sin(delta);
  const y = Math.sin(lat) * Math.cos(latitude) - Math.cos(lat) * Math.cos(delta) * Math.sin(latitude);
  const z = Math.sin(lat) * Math.sin(latitude) + Math.cos(lat) * Math.cos(delta) * Math.cos(latitude);
  const size = globeRadius();
  return { x: width / 2 + x * size, y: height / 2 - y * size, visible: z > 0 };
}
function projectPoint(point) {
  const { lon, lat } = radians(point);
  return project(lon, lat);
}
function globeRadius() { return radius * zoom; }
function traceLine(points, color, lineWidth) {
  ctx.beginPath();
  let visible = false;
  for (const point of points) {
    const p = project(point.lon, point.lat);
    if (!p.visible) { visible = false; continue; }
    if (!visible) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
    visible = true;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}
function parallel(lat, color, size) {
  traceLine(Array.from({ length: 181 }, (_, i) => ({ lon: -Math.PI + i * Math.PI / 90, lat })), color, size);
}
function meridian(lon, color, size) {
  traceLine(Array.from({ length: 91 }, (_, i) => ({ lon, lat: -Math.PI / 2 + i * Math.PI / 90 })), color, size);
}
function drawPoint(point, label, icon, color) {
  const p = projectPoint(point);
  if (!p.visible) return;
  const scale = clamp(0.7 + zoom * 0.3, 0.7, 1.8);
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(p.x - 3.5 * scale), Math.round(p.y - 3.5 * scale), 7 * scale, 7 * scale);
}
function roundedRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
}
function drawArchitecture(island, point, now) {
  const type = island.architecture || islandDetails(island).architecture;
  if (!type || zoom < 1.55 || !point.visible) return;
  const size = clamp(zoom * 5, 8, 19);
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.lineWidth = Math.max(1, zoom * 0.65);
  if (type === "foosha") {
    ctx.fillStyle = "#6b9b50"; ctx.beginPath(); ctx.ellipse(-size, size * .2, size * 1.1, size * .5, 0, 0, Math.PI * 2); ctx.fill();
    roundedRect(size * .3, size * .45, size * 1.1, size * .38, "#a77a45");
    roundedRect(size * .35, size * .14, size * .45, size * .3, "#e4c17a");
    ctx.strokeStyle = "#c5a36d";
    for (const x of [-size * 1.4, size * 1.65]) {
      ctx.beginPath(); ctx.moveTo(x, size * .4); ctx.lineTo(x, -size * .5); ctx.stroke();
      ctx.save();
      ctx.translate(x, -size * .5);
      ctx.rotate(now / 450);
      for (let blade = 0; blade < 4; blade++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(size * .32, -size * .08); ctx.lineTo(0, -size * .45); ctx.closePath(); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.strokeStyle = "#dbb879"; ctx.beginPath(); ctx.moveTo(-size * 1.7, size * .7); ctx.lineTo(size * 1.8, size * .7); ctx.stroke();
  } else if (type === "fortress") {
    roundedRect(0, 0, size * 2.4, size * 1.55, "#687784");
    roundedRect(0, -size * .9, size * .7, size * 1.35, "#9aa7ad");
    for (const x of [-size * .8, size * .8]) roundedRect(x, -size * .45, size * .42, size * .75, "#7f8e98");
    ctx.strokeStyle = "#d8dfe1"; ctx.beginPath(); ctx.moveTo(0, -size * 1.55); ctx.lineTo(0, -size * 1.1); ctx.stroke();
    ctx.fillStyle = "#f4b41a"; ctx.beginPath(); ctx.moveTo(0, -size * 1.53); ctx.lineTo(size * .65, -size * 1.32); ctx.lineTo(0, -size * 1.12); ctx.fill();
  } else if (type === "baratie") {
    ctx.fillStyle = "#aa7044"; ctx.beginPath(); ctx.ellipse(0, size * .22, size * 1.45, size * .58, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c08a50"; ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(-size * 1.85, -size * .45); ctx.lineTo(-size * 1.28, size * .12); ctx.fill();
    roundedRect(0, -size * .28, size * 1.25, size * .75, "#5b8290");
    ctx.fillStyle = "#ffcf67";
    for (const x of [-size * .5, 0, size * .5]) { ctx.beginPath(); ctx.arc(x, -size * .3, size * .09, 0, Math.PI * 2); ctx.fill(); }
  } else if (type === "arlong") {
    roundedRect(0, size * .2, size * 2.1, size * .55, "#d46a45");
    roundedRect(0, -size * .55, size * 1.55, size * .9, "#3d7b91");
    ctx.fillStyle = "#bd4f3e";
    ctx.beginPath(); ctx.moveTo(-size, -size * .7); ctx.lineTo(0, -size * 1.6); ctx.lineTo(size, -size * .7); ctx.closePath(); ctx.fill();
    for (const x of [-size * 1.55, size * 1.55]) { ctx.fillStyle = "#6eaa56"; ctx.beginPath(); ctx.arc(x, size * .35, size * .35, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#f58e35"; ctx.beginPath(); ctx.arc(x + size * .06, size * .32, size * .12, 0, Math.PI * 2); ctx.fill(); }
  } else if (type === "loguetown") {
    roundedRect(0, size * .34, size * 2.05, size * 1.18, "#989b9b");
    ctx.strokeStyle = "#d0cbc0"; ctx.strokeRect(-size * .72, -size * .18, size * 1.44, size * .88);
    ctx.strokeRect(-size * .9, -size * .36, size * 1.8, size * 1.22);
    roundedRect(0, size * .22, size * .2, size * .46, "#463f3c");
    ctx.fillStyle = "#bdcbd0"; ctx.globalAlpha = .35;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(-size + i * size * .5, -size * .95 + (i % 2) * size * .18, size * .48, size * .13, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}
function drawIslandLabels() {
  const selected = character?.navigationTarget;
  const currentName = character?.location?.island;
  const labels = [];
  for (const island of islands) {
    const point = projectPoint(island);
    if (!point.visible) continue;
    const selectedIsland = selected?.id === island.id || selected?.name === island.name;
    const currentIsland = currentName === island.name;
    if (zoom < 1.22 && !selectedIsland && !currentIsland) continue;
    const text = island.landmark || island.name;
    const font = zoom > 1.7 ? 11 : 10;
    const w = Math.min(140, text.length * font * .62 + 20);
    const rect = { x: point.x - w / 2, y: point.y + 8, w, h: 17 };
    if (!selectedIsland && !currentIsland && labels.some((other) => Math.abs(rect.x - other.x) < (rect.w + other.w) / 2 && Math.abs(rect.y - other.y) < 18)) continue;
    labels.push(rect);
    ctx.fillStyle = "rgba(5,14,29,.76)";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.font = `bold ${font}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = selectedIsland ? "#f4b41a" : "#f2f6f7";
    ctx.fillText(text, point.x, rect.y + rect.h / 2, rect.w - 6);
  }
}
function drawNightSky(now) {
  if (!character) return;
  const hour = Math.floor((Number(character.world?.minuteOfDay) || 0) / 60);
  const night = hour >= 19 || hour < 6;
  const calm = character.travel?.climate === "calm-belt";
  const tint = night ? "#07142a" : calm ? "#2a7380" : "#198094";
  ctx.save();
  ctx.globalAlpha = night ? .24 : .13;
  ctx.fillStyle = tint;
  ctx.beginPath(); ctx.arc(width / 2, height / 2, globeRadius(), 0, Math.PI * 2); ctx.fill();
  if (night) {
    ctx.globalAlpha = .75;
    for (let i = 0; i < 36; i++) {
      const x = ((i * 197 + 31) % 997) / 997 * width;
      const y = ((i * 313 + 19) % 991) / 991 * height;
      const twinkle = .45 + .45 * Math.sin(now / 750 + i * 1.7);
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = "#d8f4ff";
      ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1);
    }
  }
  ctx.restore();
}
function scheduleFrame() {
  if (!mapCovered() && !document.hidden && frame === null) frame = requestAnimationFrame(animate);
}
function stopFrame() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
}
function shouldAnimateRoute() {
  return Boolean(character?.location?.atSea && !character.autonomy?.paused && character.status !== "dead" && routeDestination());
}
function routeDestination() {
  if (character?.redirectTarget) return character.redirectTarget;
  if (character?.location?.atSea && character.navigationTarget) return character.navigationTarget;
  const route = routeFor(character.originSea);
  return islands.find((island) => island.name === route[character.location.routeIndex + 1]) ?? (animation?.to || null);
}
function drawRoute(from, to) {
  const dx = ((to.x - from.x + WIDTH * 1.5) % WIDTH) - WIDTH / 2;
  const points = Array.from({ length: 49 }, (_, i) => radians({ x: (from.x + dx * i / 48 + WIDTH) % WIDTH, y: from.y + (to.y - from.y) * i / 48 }));
  ctx.setLineDash([5, 7]);
  ctx.lineDashOffset = -dashOffset;
  traceLine(points, "#f4b41a", 2);
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
}
function drawBoat(point, destination) {
  const p = projectPoint(point);
  if (!p.visible) return;
  let angle = 0;
  if (destination) {
    const dx = ((destination.x - point.x + WIDTH * 1.5) % WIDTH) - WIDTH / 2;
    const next = projectPoint({ x: (point.x + dx * 0.02 + WIDTH) % WIDTH, y: point.y + (destination.y - point.y) * 0.02 });
    angle = Math.atan2(next.y - p.y, next.x - p.x) + Math.PI / 2;
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.fillStyle = "#f4b41a";
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 7); ctx.lineTo(0, 4); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawSeaLabel(point, label) {
  const p = projectPoint(point);
  if (!p.visible) return;
  ctx.fillStyle = "rgba(224,243,244,.68)";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillText(label, p.x, p.y);
}
function render(now = performance.now()) {
  if (!ctx || !width || !height) return;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0b1329";
  ctx.fillRect(0, 0, width, height);
  const size = globeRadius();
  const gradient = ctx.createRadialGradient(width / 2 - size * 0.3, height / 2 - size * 0.35, size * 0.05, width / 2, height / 2, size);
  gradient.addColorStop(0, "#287080");
  gradient.addColorStop(0.65, "#163e59");
  gradient.addColorStop(1, "#07172c");
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, size, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.save();
  ctx.clip();
  parallel(0.24, "rgba(201,226,217,.22)", radius * 0.13);
  parallel(-0.24, "rgba(201,226,217,.22)", radius * 0.13);
  parallel(0, "rgba(79,192,192,.65)", radius * 0.16);
  meridian(0, "#b75343", radius * 0.085);
  meridian(Math.PI, "#b75343", radius * 0.085);
  for (let lat = -Math.PI / 3; lat <= Math.PI / 3; lat += Math.PI / 6) parallel(lat, "rgba(210,240,240,.12)", 1);
  for (let lon = -Math.PI; lon < Math.PI; lon += Math.PI / 6) meridian(lon, "rgba(210,240,240,.12)", 1);
  drawSeaLabel({ x: 120, y: 190 }, "EAST BLUE");
  drawSeaLabel({ x: 120, y: 610 }, "WEST BLUE");
  drawSeaLabel({ x: 950, y: 100 }, "NORTH BLUE");
  drawSeaLabel({ x: 950, y: 650 }, "SOUTH BLUE");
  for (const island of islands) {
    const point = projectPoint(island);
    drawPoint(island, island.name, "■", "#a9cb78");
    drawArchitecture(island, point, now);
  }
  drawIslandLabels();
  const target = character?.navigationTarget;
  if (Number.isFinite(target?.x) && Number.isFinite(target?.y)) drawPoint(target, target.name || "Rumbo", "◎", "#f4b41a");
  if (boatPosition) {
    const destination = routeDestination();
    if (destination) drawRoute(boatPosition, destination);
    drawBoat(boatPosition, destination);
  }
  const climate = character?.travel?.climate;
  if (climate === "calm-belt") {
    const drift = (now / 120) % Math.max(width, 1);
    ctx.globalAlpha = .12;
    for (let i = 0; i < 5; i++) {
      const y = height / 2 + (i - 2) * size * .14;
      const fog = ctx.createLinearGradient(0, y - 28, 0, y + 28);
      fog.addColorStop(0, "transparent"); fog.addColorStop(.5, "#d3eef0"); fog.addColorStop(1, "transparent");
      ctx.fillStyle = fog;
      ctx.fillRect(-width + (drift + i * 130) % width, y - 28, width, 56);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  drawNightSky(now);
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, size, 0, Math.PI * 2);
  ctx.strokeStyle = "#f4b41a";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#f4b41a";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  if (zoom < 1.38) {
    ctx.fillText("GRAND LINE · RED LINE · FRANJA DE CALMA", width / 2, Math.max(20, height / 2 - size - 12));
  } else {
    ctx.font = "bold 11px monospace";
    ctx.fillText(`ZOOM ${zoom.toFixed(1)}× · ${character?.location?.island || "MAR ABIERTO"}`, width / 2, 22);
  }
}
function positionFor(c) {
  if (Number.isFinite(c?.mapPosition?.x) && Number.isFinite(c?.mapPosition?.y)) return { ...c.mapPosition };
  return islands.find((island) => island.name === c?.location?.island) ?? islands[0];
}
function animate(now) {
  frame = null;
  if (mapCovered() || document.hidden) return;
  if (transition) {
    const t = clamp((now - transition.started) / 650, 0, 1);
    const eased = t * t * (3 - 2 * t);
    longitude = transition.fromLon + transition.deltaLon * eased;
    latitude = transition.fromLat + (transition.toLat - transition.fromLat) * eased;
    zoom = transition.fromZoom + (transition.toZoom - transition.fromZoom) * eased;
    render(now);
    if (t < 1) { scheduleFrame(); return; }
    const island = transition.island;
    transition = null;
    cameraState = ISLAND_VIEW;
    document.dispatchEvent(new CustomEvent("onepiece:camera-state", { detail: { state: cameraState, island } }));
    return;
  }
  if (cameraState !== GLOBAL_MAP) return;
  if (Math.abs(targetZoom - zoom) > .003) zoom += (targetZoom - zoom) * .22;
  else zoom = targetZoom;
  if (animation && character && !character.autonomy?.paused && character.status !== "dead") {
    const t = clamp((now - animation.started) / animation.duration, 0, 1);
    const eased = t * t * (3 - 2 * t);
    const dx = ((animation.to.x - animation.from.x + WIDTH * 1.5) % WIDTH) - WIDTH / 2;
    boatPosition = { x: (animation.from.x + dx * eased + WIDTH) % WIDTH, y: animation.from.y + (animation.to.y - animation.from.y) * eased };
    if (t >= 1) animation = null;
  }
  dashOffset = (dashOffset + .45) % 24;
  render(now);
  if (animation || Math.abs(targetZoom - zoom) > .003 || shouldAnimateRoute()) scheduleFrame();
}
function screenPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
function unproject(point) {
  const x = (point.x - width / 2) / globeRadius();
  const y = -(point.y - height / 2) / globeRadius();
  const distance = x * x + y * y;
  if (distance > 1) return null;
  const z = Math.sqrt(1 - distance);
  const lat = Math.asin(clamp(y * Math.cos(latitude) + z * Math.sin(latitude), -1, 1));
  const lon = longitude + Math.atan2(x, z * Math.cos(latitude) - y * Math.sin(latitude));
  return { x: Math.round((((lon / (2 * Math.PI) + 0.5) % 1 + 1) % 1) * WIDTH), y: Math.round((0.5 - lat / Math.PI) * HEIGHT) };
}
function onDown(event) {
  if (cameraState !== GLOBAL_MAP || transition || (event.button !== undefined && event.button !== 0)) return;
  event.preventDefault();
  const point = screenPoint(event);
  pointers.set(event.pointerId, { start: point, last: point, moved: false });
  canvas.setPointerCapture?.(event.pointerId);
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    a.moved = true;
    b.moved = true;
    pinchStart = { distance: Math.hypot(a.last.x - b.last.x, a.last.y - b.last.y), zoom: targetZoom };
  }
}
function onMove(event) {
  const pointer = pointers.get(event.pointerId);
  if (!pointer) return;
  event.preventDefault();
  const point = screenPoint(event);
  const deltaX = point.x - pointer.last.x;
  const deltaY = point.y - pointer.last.y;
  if (Math.hypot(point.x - pointer.start.x, point.y - pointer.start.y) > 5) pointer.moved = true;
  pointer.last = point;
  if (pointers.size >= 2 && pinchStart) {
    const [a, b] = [...pointers.values()];
    const distance = Math.hypot(a.last.x - b.last.x, a.last.y - b.last.y);
    zoomMap(pinchStart.zoom * distance / Math.max(1, pinchStart.distance));
  } else if (pointer.moved) {
    longitude -= deltaX / globeRadius();
    latitude = clamp(latitude + deltaY / globeRadius(), -1.35, 1.35);
    render();
  }
}
function onUp(event) {
  const pointer = pointers.get(event.pointerId);
  if (!pointer) return;
  event.preventDefault();
  const wasPinching = pointers.size > 1 || Boolean(pinchStart);
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinchStart = null;
  if (wasPinching || pointer.moved) return;
  const screen = screenPoint(event);
  const point = unproject(screen);
  if (!point) return;
  let island = null;
  let closest = Math.max(18, zoom * 11);
  for (const item of islands) {
    const p = projectPoint(item);
    const distance = Math.hypot(screen.x - p.x, screen.y - p.y);
    if (p.visible && distance < closest) { island = item; closest = distance; }
  }
  canvas.dispatchEvent(new CustomEvent("onepiece:map-destination", { bubbles: true, detail: island ?? { ...point, name: "Mar abierto", sea: "Mar abierto" } }));
  if (island) enterIslandView(island);
}
function enterIslandView(island) {
  if (!character || cameraState !== GLOBAL_MAP || transition) return;
  savedCamera = { longitude, latitude, zoom: targetZoom };
  const position = radians(island);
  const deltaLon = Math.atan2(Math.sin(position.lon - longitude), Math.cos(position.lon - longitude));
  transition = { island, started: performance.now(), fromLon: longitude, deltaLon, fromLat: latitude, toLat: clamp(position.lat, -1.35, 1.35), fromZoom: zoom, toZoom: Math.max(2.5, zoom) };
  pointers.clear();
  pinchStart = null;
  scheduleFrame();
}
export function returnToGlobalMap() {
  transition = null;
  pointers.clear();
  pinchStart = null;
  cameraState = GLOBAL_MAP;
  if (savedCamera) {
    longitude = savedCamera.longitude;
    latitude = savedCamera.latitude;
    zoom = targetZoom = savedCamera.zoom;
    savedCamera = null;
  }
  document.dispatchEvent(new CustomEvent("onepiece:camera-state", { detail: { state: cameraState } }));
  if (!mapCovered() && !document.hidden) render();
  if (character && (animation || shouldAnimateRoute())) scheduleFrame();
}
export function resizeMap() {
  if (!canvas || !ctx) return;
  const nextWidth = Math.max(1, window.innerWidth);
  const nextHeight = Math.max(1, window.innerHeight);
  if (width === nextWidth && height === nextHeight) return;
  width = nextWidth;
  height = nextHeight;
  canvas.width = width;
  canvas.height = height;
  radius = Math.max(70, Math.min(width * 0.44, height * 0.37));
  if (!mapCovered() && !document.hidden && cameraState === GLOBAL_MAP) render();
}
export function zoomMap(value) {
  if (cameraState !== GLOBAL_MAP || transition) return;
  targetZoom = clamp(Number(value) || 1, 0.72, 3.2);
  scheduleFrame();
}
export function adjustZoom(direction) {
  zoomMap(targetZoom * (direction > 0 ? 1.28 : 1 / 1.28));
}
export function focusMap(point) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
  if (cameraState !== GLOBAL_MAP || transition) returnToGlobalMap();
  const position = radians(point);
  longitude = position.lon;
  latitude = clamp(position.lat, -1.35, 1.35);
  render();
}
export function initMap() {
  if (canvas) return;
  canvas = document.getElementById("world-map");
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  if (!ctx) { canvas = null; throw new Error("No se pudo inicializar el globo náutico."); }
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", (event) => { pointers.delete(event.pointerId); pinchStart = null; });
  canvas.addEventListener("wheel", (event) => { event.preventDefault(); zoomMap(targetZoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12)); }, { passive: false });
  document.getElementById("map-reset-view")?.addEventListener("click", () => { zoomMap(1); focusMap(positionFor(character)); });
  document.addEventListener("onepiece:map-zoom", (event) => adjustZoom(event.detail?.direction));
  document.addEventListener("onepiece:map-fit", () => zoomMap(1));
  document.addEventListener("onepiece:modal-visibility", (event) => {
    modalOpen = Boolean(event.detail?.open);
    if (modalOpen) stopFrame();
    else if (!mapCovered() && !document.hidden && cameraState === GLOBAL_MAP) {
      render();
      if (transition || animation || Math.abs(targetZoom - zoom) > .003 || shouldAnimateRoute()) scheduleFrame();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopFrame();
    else if (!mapCovered() && cameraState === GLOBAL_MAP) {
      render();
      if (transition || animation || Math.abs(targetZoom - zoom) > .003 || shouldAnimateRoute()) scheduleFrame();
    }
  });
  document.addEventListener("close", (event) => {
    if (event.target?.tagName !== "DIALOG" || mapCovered() || document.hidden || cameraState !== GLOBAL_MAP) return;
    render();
    if (transition || animation || Math.abs(targetZoom - zoom) > .003 || shouldAnimateRoute()) scheduleFrame();
  }, true);
  window.addEventListener("resize", resizeMap);
  resizeMap();
}
export function renderMap(c) {
  initMap();
  if (!canvas || !c) return;
  const previous = character?.id === c.id ? boatPosition : null;
  if (!previous) { stopFrame(); animation = null; }
  character = c;
  islands = getMapIslands(c);
  const next = positionFor(c);
  if (next && previous && (next.x !== previous.x || next.y !== previous.y) && !c.autonomy?.paused && c.status !== "dead") {
    if (!animation || animation.to.x !== next.x || animation.to.y !== next.y) {
      animation = { from: previous, to: next, started: performance.now(), duration: c.travel?.speedMultiplier === 0.5 ? 6000 : 3000 };
      stopFrame();
      if (cameraState === GLOBAL_MAP) scheduleFrame();
    }
  } else if (!previous || c.autonomy?.paused || c.status === "dead") {
    boatPosition = next;
    animation = null;
    stopFrame();
  }
  if (!mapCovered() && !document.hidden && cameraState === GLOBAL_MAP) render();
  if (cameraState === GLOBAL_MAP && (transition || animation || shouldAnimateRoute())) scheduleFrame();
}
