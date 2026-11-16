import { getMapIslands } from "./map.js";

const WIDTH = 1200;
const HEIGHT = 760;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const radians = (point) => ({
  lon: (point.x / WIDTH - 0.5) * Math.PI * 2,
  lat: (0.5 - point.y / HEIGHT) * Math.PI
});
let canvas, ctx, character, width = 0, height = 0, radius = 0, pointer;
let longitude = -2.05, latitude = 0.25, islands = [], animation, frame;
let boatPosition;

function project(lon, lat) {
  const delta = lon - longitude;
  const x = Math.cos(lat) * Math.sin(delta);
  const y = Math.sin(lat) * Math.cos(latitude) - Math.cos(lat) * Math.cos(delta) * Math.sin(latitude);
  const z = Math.sin(lat) * Math.sin(latitude) + Math.cos(lat) * Math.cos(delta) * Math.cos(latitude);
  return { x: width / 2 + x * radius, y: height / 2 - y * radius, visible: z > 0 };
}
function projectPoint(point) {
  const { lon, lat } = radians(point);
  return project(lon, lat);
}
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
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(p.x - 4), Math.round(p.y - 4), 8, 8);
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "#0b1329";
  ctx.shadowBlur = 5;
  ctx.fillText(`${icon} ${label}`, p.x, p.y + 19);
  ctx.shadowBlur = 0;
}
function render() {
  if (!ctx || !width || !height) return;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0b1329";
  ctx.fillRect(0, 0, width, height);
  const gradient = ctx.createRadialGradient(width / 2 - radius * 0.3, height / 2 - radius * 0.35, radius * 0.05, width / 2, height / 2, radius);
  gradient.addColorStop(0, "#287080");
  gradient.addColorStop(0.65, "#163e59");
  gradient.addColorStop(1, "#07172c");
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
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
  for (const island of islands) drawPoint(island, island.name, "■", "#a9cb78");
  const target = character?.navigationTarget;
  if (Number.isFinite(target?.x) && Number.isFinite(target?.y)) drawPoint(target, target.name || "Rumbo", "◎", "#f4b41a");
  if (boatPosition) drawPoint(boatPosition, character?.name || "Carabela", "⛵", "#f4b41a");
  ctx.restore();
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
  ctx.strokeStyle = "#f4b41a";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#f4b41a";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.fillText("GRAND LINE · RED LINE · FRANJA DE CALMA", width / 2, Math.max(20, height / 2 - radius - 12));
}
function positionFor(c) {
  if (Number.isFinite(c?.mapPosition?.x) && Number.isFinite(c?.mapPosition?.y)) return { ...c.mapPosition };
  return islands.find((island) => island.name === c?.location?.island) ?? islands[0];
}
function animate(now) {
  frame = null;
  if (!animation || !character || character.autonomy?.paused || character.status === "dead") return;
  const t = clamp((now - animation.started) / animation.duration, 0, 1);
  const eased = t * t * (3 - 2 * t);
  const dx = ((animation.to.x - animation.from.x + WIDTH * 1.5) % WIDTH) - WIDTH / 2;
  boatPosition = { x: (animation.from.x + dx * eased + WIDTH) % WIDTH, y: animation.from.y + (animation.to.y - animation.from.y) * eased };
  render();
  if (t < 1) frame = requestAnimationFrame(animate);
  else animation = null;
}
function screenPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
function unproject(point) {
  const x = (point.x - width / 2) / radius;
  const y = -(point.y - height / 2) / radius;
  const distance = x * x + y * y;
  if (distance > 1) return null;
  const z = Math.sqrt(1 - distance);
  const lat = Math.asin(clamp(y * Math.cos(latitude) + z * Math.sin(latitude), -1, 1));
  const lon = longitude + Math.atan2(x, z * Math.cos(latitude) - y * Math.sin(latitude));
  return { x: Math.round((((lon / (2 * Math.PI) + 0.5) % 1 + 1) % 1) * WIDTH), y: Math.round((0.5 - lat / Math.PI) * HEIGHT) };
}
function onDown(event) {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  pointer = { id: event.pointerId, start: screenPoint(event), last: screenPoint(event), moved: false };
  canvas.setPointerCapture?.(event.pointerId);
}
function onMove(event) {
  if (!pointer || pointer.id !== event.pointerId) return;
  event.preventDefault();
  const point = screenPoint(event);
  if (Math.hypot(point.x - pointer.start.x, point.y - pointer.start.y) > 5) pointer.moved = true;
  if (pointer.moved) {
    longitude -= (point.x - pointer.last.x) / radius;
    latitude = clamp(latitude + (point.y - pointer.last.y) / radius, -1.35, 1.35);
    render();
  }
  pointer.last = point;
}
function onUp(event) {
  if (!pointer || pointer.id !== event.pointerId) return;
  event.preventDefault();
  const moved = pointer.moved;
  pointer = null;
  if (moved) return;
  const screen = screenPoint(event);
  const point = unproject(screen);
  if (!point) return;
  const island = islands.find((item) => {
    const p = projectPoint(item);
    return p.visible && Math.hypot(screen.x - p.x, screen.y - p.y) < 18;
  });
  canvas.dispatchEvent(new CustomEvent("onepiece:map-destination", { bubbles: true, detail: island ?? { ...point, name: "Mar abierto", sea: "Mar abierto" } }));
}
export function resizeMap() {
  if (!canvas || !ctx) return;
  width = Math.max(1, window.innerWidth);
  height = Math.max(1, window.innerHeight);
  canvas.width = width;
  canvas.height = height;
  radius = Math.max(70, Math.min(width * 0.44, height * 0.37));
  render();
}
export function focusMap(point) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
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
  canvas.addEventListener("pointercancel", () => { pointer = null; });
  canvas.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
  document.getElementById("map-reset-view")?.addEventListener("click", () => focusMap(positionFor(character)));
  window.addEventListener("resize", resizeMap);
  resizeMap();
}
export const initWorldMap = initMap;
export function renderMap(c) {
  initMap();
  if (!canvas || !c) return;
  const previous = character?.id === c.id ? boatPosition : null;
  if (!previous && frame) cancelAnimationFrame(frame);
  if (!previous) { animation = null; frame = null; }
  character = c;
  islands = getMapIslands(c);
  const next = positionFor(c);
  if (next && previous && (next.x !== previous.x || next.y !== previous.y) && !c.autonomy?.paused && c.status !== "dead") {
    if (!animation || animation.to.x !== next.x || animation.to.y !== next.y) {
      animation = { from: previous, to: next, started: performance.now(), duration: c.travel?.speedMultiplier === 0.5 ? 6000 : 3000 };
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(animate);
    }
  } else if (!previous || c.autonomy?.paused || c.status === "dead") {
    boatPosition = next;
    animation = null;
    if (frame) cancelAnimationFrame(frame);
    frame = null;
  }
  render();
}
