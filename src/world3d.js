import { getMapIslands } from "./map.js";
import { routeFor } from "./game.js";
import { islandDetails } from "./islands_data.js";
import { avatarAction, drawIslandSceneContext, drawPixelAvatar, ISLAND_SCENE_WIDTH, ISLAND_SCENE_HEIGHT } from "./island_renderer.js";

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
let zoomFocus = null, zoomAnchor = null;
let lastFollowFrame = 0;
const ISLAND_ZOOM = 2.2;
export const GLOBAL_MAP = "GLOBAL_MAP";
export const ISLAND_VIEW = "ISLAND_VIEW";
let cameraState = GLOBAL_MAP, transition = null, savedCamera = null, localIsland = null, localRenderKey = "";
let lastIslandFrame = 0;
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
function drawRedLineMeridian(lon) {
  const halfWidth = 0.105;
  const rows = 90;
  for (let i = 0; i < rows; i++) {
    const lat1 = -Math.PI / 2 + i * Math.PI / rows;
    const lat2 = -Math.PI / 2 + (i + 1) * Math.PI / rows;
    const points = [
      project(lon - halfWidth, lat1), project(lon + halfWidth, lat1),
      project(lon + halfWidth, lat2), project(lon - halfWidth, lat2)
    ];
    if (points.every((point) => point.visible)) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let j = 1; j < points.length; j++) ctx.lineTo(points[j].x, points[j].y);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? "#874238" : "#77372f";
      ctx.fill();
      if (i % 3 === 0) {
        ctx.strokeStyle = "rgba(211,144,99,.3)";
        ctx.lineWidth = Math.max(1, radius * zoom * .003);
        ctx.beginPath();
        ctx.moveTo(points[0].x + (points[3].x - points[0].x) * .28, points[0].y + (points[3].y - points[0].y) * .28);
        ctx.lineTo(points[1].x + (points[2].x - points[1].x) * .68, points[1].y + (points[2].y - points[1].y) * .68);
        ctx.stroke();
      }
    }
  }
  traceLine(Array.from({ length: 91 }, (_, i) => ({ lon: lon - halfWidth, lat: -Math.PI / 2 + i * Math.PI / 90 })), "rgba(223,145,98,.62)", Math.max(1, radius * zoom * .009));
  traceLine(Array.from({ length: 91 }, (_, i) => ({ lon: lon + halfWidth, lat: -Math.PI / 2 + i * Math.PI / 90 })), "rgba(68,39,39,.7)", Math.max(1, radius * zoom * .01));
}
function drawPoint(point, label, icon, color) {
  drawIslandSprite(point, color);
}
function drawIslandSprite(point, color) {
  const p = projectPoint(point);
  if (!p.visible) return;
  const scale = clamp(0.9 + zoom * 0.34, 0.9, 2.1);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(scale, scale);
  const pixel = (x, y, w, h, fill) => { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); };
  pixel(-7, 4, 15, 3, "rgba(0,0,0,.35)");
  pixel(-6, -2, 12, 8, "#b99a61");
  pixel(-8, 0, 16, 4, "#cbb17a");
  pixel(-5, -3, 10, 7, color === "#f4b41a" ? "#c89835" : "#6f9a62");
  pixel(-3, -4, 6, 2, "#82ab70");
  pixel(2, -8, 2, 8, "#684a32");
  pixel(-1, -9, 8, 2, "#477a51");
  pixel(-3, -7, 4, 2, "#5e9457");
  pixel(5, -7, 3, 2, "#5e9457");
  pixel(-6, 1, 7, 2, "#d8c28c");
  pixel(-5, -1, 3, 2, "#6b4934");
  pixel(-4, -2, 2, 1, "#b9604d");
  ctx.restore();
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
  const bob = Math.sin(performance.now() / 360) * 1.15;
  ctx.translate(0, bob);
  const pixel = (x, y, w, h, fill) => { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); };
  if (shouldAnimateRoute()) {
    for (let i = 0; i < 3; i++) {
      const offset = (performance.now() / 120 + i * 5) % 15;
      pixel(-5 - i * 2, 9 + offset, 3, 2, "rgba(221,244,238,.7)");
      pixel(3 + i * 2, 11 + offset, 3, 2, "rgba(221,244,238,.55)");
    }
  }
  pixel(-6, 3, 12, 4, "#704c36");
  pixel(-4, 7, 8, 2, "#4b342d");
  pixel(-5, 3, 10, 1, "#c59b58");
  pixel(-1, -10, 2, 14, "#a17b48");
  pixel(-5, -6, 4, 8, "#e8d9ad");
  pixel(-3, -8, 2, 2, "#e8d9ad");
  pixel(1, -5, 4, 7, "#f1e4be");
  pixel(1, -9, 4, 2, "#f4b41a");
  if (character?.location?.atSea && character.status !== "dead") {
    drawPixelAvatar(ctx, character.avatarConfig || character.appearance, {
      x: -4, y: -13, scale: .28, action: avatarAction(character), time: performance.now()
    });
  }
  ctx.restore();
}
function drawSeaLabel(point, label) {
  const p = projectPoint(point);
  if (!p.visible) return;
  const location = radians(point);
  const before = project(location.lon - .08, location.lat);
  const after = project(location.lon + .08, location.lat);
  let angle = Math.atan2(after.y - before.y, after.x - before.x);
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.fillStyle = "rgba(224,243,244,.68)";
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, 0);
  ctx.restore();
}
function drawCompassRose(x, y, radius) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "rgba(89,59,31,.7)";
  ctx.fillStyle = "rgba(247,235,204,.65)";
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, radius * .72, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4 - Math.PI / 2;
    const outer = radius * .68, inner = i % 2 ? radius * .18 : radius * .82;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.lineTo(Math.cos(angle + Math.PI / 8) * radius * .13, Math.sin(angle + Math.PI / 8) * radius * .13);
    ctx.lineTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle - Math.PI / 8) * radius * .13, Math.sin(angle - Math.PI / 8) * radius * .13);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? "rgba(99,73,43,.62)" : "rgba(196,145,54,.88)";
    ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = "#573e2c";
  ctx.font = `bold ${Math.max(9, radius * .37)}px monospace`;
  ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  ctx.fillText("N", 0, -radius * .82);
  ctx.fillStyle = "#f4b41a";
  ctx.beginPath(); ctx.arc(0, 0, radius * .1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function render(now = performance.now()) {
  if (!ctx || !width || !height) return;
  ctx.clearRect(0, 0, width, height);
  const chart = ctx.createLinearGradient(0, 0, width, height);
  chart.addColorStop(0, "#0b1329");
  chart.addColorStop(.48, "#12243a");
  chart.addColorStop(1, "#0b1329");
  ctx.fillStyle = chart;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 460; i++) {
    const x = (i * 197 + 41) % width, y = (i * 313 + 17) % height;
    ctx.fillStyle = i % 3 ? "rgba(118,166,169,.08)" : "rgba(255,249,220,.16)";
    ctx.fillRect(x, y, i % 7 === 0 ? 2 : 1, 1);
  }
  for (let y = height * .16; y < height; y += 84) {
    ctx.strokeStyle = "rgba(155,191,181,.14)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
  for (let x = width * .12; x < width; x += 96) {
    ctx.strokeStyle = "rgba(155,191,181,.12)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  const size = globeRadius();
  const gradient = ctx.createRadialGradient(width / 2 - size * 0.3, height / 2 - size * 0.35, size * 0.05, width / 2, height / 2, size);
  gradient.addColorStop(0, "#537d7a");
  gradient.addColorStop(0.65, "#31666b");
  gradient.addColorStop(1, "#193f4a");
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, size, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 96; i++) {
    const lon = ((i * 137 + 19) % 997) / 997 * Math.PI * 2 - Math.PI;
    const lat = ((i * 313 + 71) % 991) / 991 * Math.PI - Math.PI / 2;
    const point = project(lon, lat);
    if (!point.visible || Math.hypot(point.x - width / 2, point.y - height / 2) > size * .92) continue;
    ctx.fillStyle = i % 5 === 0 ? "rgba(239,223,181,.28)" : "rgba(223,208,166,.14)";
    ctx.fillRect(point.x, point.y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
  }
  parallel(0.24, "rgba(209,193,151,.22)", radius * 0.13);
  parallel(-0.24, "rgba(209,193,151,.22)", radius * 0.13);
  parallel(0, "rgba(115,191,172,.55)", radius * 0.16);
  drawRedLineMeridian(0);
  drawRedLineMeridian(Math.PI);
  for (let lat = -Math.PI / 3; lat <= Math.PI / 3; lat += Math.PI / 6) parallel(lat, "rgba(231,216,178,.2)", 1);
  for (let lon = -Math.PI; lon < Math.PI; lon += Math.PI / 6) meridian(lon, "rgba(231,216,178,.2)", 1);
  drawSeaLabel({ x: 120, y: 190 }, "MAR DEL ESTE");
  drawSeaLabel({ x: 120, y: 610 }, "MAR DEL OESTE");
  drawSeaLabel({ x: 950, y: 100 }, "MAR DEL NORTE");
  drawSeaLabel({ x: 950, y: 650 }, "MAR DEL SUR");
  drawSeaLabel({ x: 600, y: 380 }, "PARAÍSO");
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
  drawCompassRose(width * .16, height * .74, clamp(Math.min(width, height) * .045, 18, 38));
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
function atIsland(island) {
  return Boolean(character && character.status !== "dead" && !character.captured && !character.location?.atSea && character.location?.island === island.name);
}
function islandFrame(island, progress = 1, now = 0, sceneRect = null) {
  const scene = document.querySelector?.(".island-scene");
  const rect = sceneRect || scene?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return;
  const blend = clamp((progress - .44) / .56, 0, 1);
  if (!blend) return;
  const eased = blend * blend * (3 - 2 * blend);
  const center = projectPoint(island);
  const x = center.x + (rect.left + rect.width / 2 - center.x) * eased;
  const y = center.y + (rect.top + rect.height / 2 - center.y) * eased;
  const size = .22 + .78 * eased;
  ctx.save();
  ctx.globalAlpha = eased;
  ctx.fillStyle = "#0b1329";
  ctx.fillRect(0, 0, width, height);
  ctx.translate(x - rect.width * size / 2, y - rect.height * size / 2);
  ctx.scale(rect.width * size / ISLAND_SCENE_WIDTH, rect.height * size / ISLAND_SCENE_HEIGHT);
  drawIslandSceneContext(ctx, island, atIsland(island) ? character : null, now);
  ctx.restore();
}
function sceneKey(island) {
  return JSON.stringify([island.id, atIsland(island), character?.avatarConfig || character?.appearance, character?.avatarActivity]);
}
function renderLocalIsland(now = performance.now()) {
  if (!localIsland) return;
  islandFrame(localIsland, 1, now);
  localRenderKey = sceneKey(localIsland);
}
function animateIsland() {
  const residents = Boolean(localIsland?.npcs?.length);
  const avatar = Boolean(atIsland(localIsland) && character?.status === "alive");
  return Boolean((residents || avatar) && !document.body?.classList?.contains("reduced-motion"));
}
function suspendTransition() {
  if (transition && transition.suspendedAt == null) transition.suspendedAt = performance.now();
}
function resumeRendering() {
  if (mapCovered() || document.hidden) return;
  if (transition) {
    if (transition.suspendedAt != null) {
      transition.started += performance.now() - transition.suspendedAt;
      transition.suspendedAt = null;
    }
    scheduleFrame();
  } else if (cameraState === ISLAND_VIEW) {
    renderLocalIsland();
    lastIslandFrame = performance.now();
    if (animateIsland()) scheduleFrame();
  } else {
    render();
    if (animation || Math.abs(targetZoom - zoom) > .003 || shouldAnimateRoute()) scheduleFrame();
  }
}
function positionFor(c) {
  if (Number.isFinite(c?.mapPosition?.x) && Number.isFinite(c?.mapPosition?.y)) return { ...c.mapPosition };
  return islands.find((island) => island.name === c?.location?.island) ?? islands[0];
}
function animate(now) {
  frame = null;
  if (mapCovered() || document.hidden) { suspendTransition(); return; }
  if (transition) {
    const t = clamp((now - transition.started) / 1400, 0, 1);
    const eased = t * t * (3 - 2 * t);
    longitude = transition.fromLon + transition.deltaLon * eased;
    latitude = transition.fromLat + (transition.toLat - transition.fromLat) * eased;
    zoom = transition.fromZoom + (transition.toZoom - transition.fromZoom) * eased;
    render(now);
    islandFrame(transition.island, transition.returning ? 1 - t : t, now, transition.sceneRect);
    if (t < 1) { scheduleFrame(); return; }
    const island = transition.island;
    const returning = transition.returning;
    transition = null;
    if (returning) {
      targetZoom = zoom;
      if (animation || shouldAnimateRoute()) scheduleFrame();
      return;
    }
    cameraState = ISLAND_VIEW;
    localIsland = island;
    targetZoom = zoom;
    lastIslandFrame = now;
    localRenderKey = sceneKey(island);
    canvas.setAttribute("aria-label", `Ciudad y puerto de ${island.landmark || island.name}, vista pixel art`);
    document.dispatchEvent(new CustomEvent("onepiece:camera-state", { detail: { state: cameraState, island } }));
    if (animateIsland()) scheduleFrame();
    return;
  }
  if (cameraState === ISLAND_VIEW) {
    if (now - lastIslandFrame >= 80) { renderLocalIsland(now); lastIslandFrame = now; }
    if (animateIsland()) scheduleFrame();
    return;
  }
  if (Math.abs(targetZoom - zoom) > .003) zoom += (targetZoom - zoom) * .22;
  else zoom = targetZoom;
  if (animation && character && !character.autonomy?.paused && character.status !== "dead") {
    const t = clamp((now - animation.started) / animation.duration, 0, 1);
    const eased = t * t * (3 - 2 * t);
    const dx = ((animation.to.x - animation.from.x + WIDTH * 1.5) % WIDTH) - WIDTH / 2;
    boatPosition = { x: (animation.from.x + dx * eased + WIDTH) % WIDTH, y: animation.from.y + (animation.to.y - animation.from.y) * eased };
    if (t >= 1) animation = null;
  }
  if (character?.location?.atSea && boatPosition && shouldAnimateRoute()) {
    const elapsed = lastFollowFrame ? Math.min(100, now - lastFollowFrame) : 16;
    const focus = radians(boatPosition);
    const delta = Math.atan2(Math.sin(focus.lon - longitude), Math.cos(focus.lon - longitude));
    const blend = 1 - Math.exp(-elapsed / 650);
    longitude += delta * blend;
    latitude += (focus.lat - latitude) * blend;
  }
  lastFollowFrame = now;
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
  if (transition || (event.button !== undefined && event.button !== 0)) return;
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
    const value = pinchStart.zoom * distance / Math.max(1, pinchStart.distance);
    if (cameraState === ISLAND_VIEW) {
      if (value < pinchStart.zoom * .85) returnToGlobalMap();
    } else zoomMap(value, { x: (a.last.x + b.last.x) / 2, y: (a.last.y + b.last.y) / 2 });
  } else if (pointer.moved && cameraState === GLOBAL_MAP) {
    zoomFocus = zoomAnchor = null;
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
  if (cameraState !== GLOBAL_MAP) return;
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
  document.dispatchEvent(new CustomEvent("onepiece:island-approach", { detail: { island } }));
  pointers.clear();
  pinchStart = null;
  scheduleFrame();
}
export function returnToGlobalMap(immediate = false) {
  const island = localIsland;
  const previous = savedCamera;
  const canAnimate = !immediate && cameraState === ISLAND_VIEW && island && previous;
  const sceneRect = canAnimate ? document.querySelector?.(".island-scene")?.getBoundingClientRect() : null;
  if (immediate) stopFrame();
  transition = null;
  pointers.clear();
  pinchStart = null;
  cameraState = GLOBAL_MAP;
  localIsland = null;
  localRenderKey = "";
  canvas?.setAttribute("aria-label", "Globo interactivo de los cuatro mares, la Red Line y la Grand Line");
  if (previous) {
    if (canAnimate) {
      transition = { island, returning: true, started: performance.now(), fromLon: longitude,
        deltaLon: Math.atan2(Math.sin(previous.longitude - longitude), Math.cos(previous.longitude - longitude)),
        fromLat: latitude, toLat: previous.latitude, fromZoom: zoom, toZoom: Math.min(previous.zoom, 1.8), sceneRect };
    } else {
      longitude = previous.longitude;
      latitude = previous.latitude;
      zoom = targetZoom = previous.zoom;
    }
    savedCamera = null;
  }
  document.dispatchEvent(new CustomEvent("onepiece:camera-state", { detail: { state: cameraState } }));
  if (!mapCovered() && !document.hidden && !transition) render();
  if (transition || (!immediate && character && (animation || shouldAnimateRoute()))) scheduleFrame();
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
  if (!mapCovered() && !document.hidden) {
    if (cameraState === ISLAND_VIEW) renderLocalIsland();
    else render();
  }
}
export function zoomMap(value, anchor = { x: width / 2, y: height / 2 }) {
  if (transition) return;
  if (cameraState === ISLAND_VIEW) {
    if (value < targetZoom) returnToGlobalMap();
    return;
  }
  const nextZoom = clamp(Number(value) || 1, 0.72, 3.2);
  if (zoomAnchor && Math.hypot(anchor.x - zoomAnchor.x, anchor.y - zoomAnchor.y) > 40) zoomFocus = zoomAnchor = null;
  if (nextZoom > targetZoom && !zoomFocus) {
    let nearest = null, distance = 40;
    for (const island of islands) {
      const point = projectPoint(island);
      const d = Math.hypot(anchor.x - point.x, anchor.y - point.y);
      if (point.visible && d < distance) { nearest = island; distance = d; }
    }
    zoomFocus = nearest;
    zoomAnchor = nearest ? anchor : null;
  }
  if (nextZoom < targetZoom) zoomFocus = zoomAnchor = null;
  targetZoom = nextZoom;
  if (targetZoom >= ISLAND_ZOOM && zoomFocus) { const island = zoomFocus; zoomFocus = zoomAnchor = null; enterIslandView(island); return; }
  scheduleFrame();
}
export function adjustZoom(direction) {
  zoomMap(targetZoom * (direction > 0 ? 1.28 : 1 / 1.28));
}
export function focusMap(point) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
  if (cameraState !== GLOBAL_MAP || transition) returnToGlobalMap(true);
  const position = radians(point);
  longitude = position.lon;
  latitude = clamp(position.lat, -1.35, 1.35);
  zoomFocus = zoomAnchor = null;
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
  canvas.addEventListener("wheel", (event) => { event.preventDefault(); zoomMap(targetZoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), screenPoint(event)); }, { passive: false });
  document.getElementById("map-reset-view")?.addEventListener("click", () => { zoomMap(1); focusMap(positionFor(character)); });
  document.addEventListener("onepiece:map-zoom", (event) => adjustZoom(event.detail?.direction));
  document.addEventListener("onepiece:map-fit", () => zoomMap(1));
  document.addEventListener("onepiece:island-layout", () => {
    if (cameraState === ISLAND_VIEW && !mapCovered() && !document.hidden) renderLocalIsland();
  });
  document.addEventListener("onepiece:modal-visibility", (event) => {
    modalOpen = Boolean(event.detail?.open);
    if (modalOpen) { suspendTransition(); stopFrame(); }
    else resumeRendering();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { suspendTransition(); stopFrame(); }
    else resumeRendering();
  });
  document.addEventListener("close", (event) => {
    if (event.target?.tagName === "DIALOG") resumeRendering();
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
  if (!previous && next) {
    const position = radians(next);
    longitude = position.lon;
    latitude = clamp(position.lat, -1.35, 1.35);
  }
  if (next && previous && (next.x !== previous.x || next.y !== previous.y) && !c.autonomy?.paused && c.status !== "dead") {
    if (!animation || animation.to.x !== next.x || animation.to.y !== next.y) {
      animation = { from: previous, to: next, started: performance.now(), duration: c.travel?.speedMultiplier === 0.5 ? 6000 : 3000 };
      stopFrame();
      if (cameraState === GLOBAL_MAP) scheduleFrame();
    }
  } else if (!previous || c.autonomy?.paused || c.status === "dead") {
    boatPosition = next;
    animation = null;
    if (!transition) stopFrame();
  }
  if (!mapCovered() && !document.hidden) {
    if (cameraState === ISLAND_VIEW && localIsland && sceneKey(localIsland) !== localRenderKey) renderLocalIsland();
    else if (cameraState === GLOBAL_MAP && !transition) render();
  }
  if ((cameraState === GLOBAL_MAP && (transition || animation || shouldAnimateRoute())) || (cameraState === ISLAND_VIEW && animateIsland())) scheduleFrame();
}
