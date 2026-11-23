import { avatarScenePosition, localWaypointPosition } from "./map.js";

const PALETTES = {
  green: { sky: ["#8cc7d1", "#659fae"], mountain: "#577e74", land: "#6d9d5a", light: "#add17c", earth: "#77523d" },
  sky: { sky: ["#b6e3ed", "#6aa8ca"], mountain: "#c5e1e3", land: "#91bd72", light: "#d0e7aa", earth: "#b1d3d4" },
  snow: { sky: ["#b8d5dc", "#688da4"], mountain: "#a7bdc8", land: "#d9e8e4", light: "#f4f4dd", earth: "#879ca7" },
  desert: { sky: ["#e3b58a", "#b88b68"], mountain: "#ad7750", land: "#d7b87b", light: "#f0d99c", earth: "#986749" },
  volcanic: { sky: ["#9da6ac", "#6c7888"], mountain: "#574b54", land: "#74645a", light: "#aa8060", earth: "#473c3d" },
  stone: { sky: ["#a9c5c8", "#7297a1"], mountain: "#869a9d", land: "#9dad9d", light: "#c7cfba", earth: "#6e7670" }
};

function box(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
// Degradado radial tolerante: los entornos de prueba usan un ctx sin createRadialGradient
function radialSuave(ctx, px, py, r0, r1, c0, c1) {
  if (!ctx.createRadialGradient) return null;
  const g = ctx.createRadialGradient(px, py, r0, px, py, r1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}
// Degradado lineal tolerante: sin soporte devuelve null y el pintor usa color plano
function linearSuave(ctx, x0, y0, x1, y1, stops) {
  if (!ctx.createLinearGradient) return null;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
const normalizeText = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function tree(ctx, x, y, color, fruit = false) {
  box(ctx, x + 10, y + 25, 8, 24, "#6a4934");
  box(ctx, x + 3, y + 9, 22, 23, color);
  box(ctx, x + 8, y + 3, 15, 8, color);
  box(ctx, x, y + 16, 29, 10, color);
  if (fruit) { box(ctx, x + 6, y + 18, 4, 4, "#f7a43c"); box(ctx, x + 18, y + 12, 4, 4, "#f7a43c"); }
}

const NPC_PORTRAITS = [
  { pattern: /\bmakino\b/i, appearance: { portrait: "makino", hair: "Moreno" } },
  { pattern: /\bmorgan\b/i, appearance: { portrait: "morgan", hair: "Rubio" } },
  { pattern: /\bzeff\b/i, appearance: { portrait: "zeff", hair: "Rubio" } },
  { pattern: /\barlong\b(?!\s+park\b)/i, appearance: { portrait: "arlong", hair: "Negro", skin: "Azul" } },
  { pattern: /\bsmoker\b/i, appearance: { portrait: "smoker", hair: "Gris" } }
];
const victoryMoments = new WeakMap();

export function npcAppearanceFor(text) {
  return NPC_PORTRAITS.find((entry) => entry.pattern.test(String(text ?? "")))?.appearance ?? null;
}

function avatarLayers(appearance, options) {
  const { x, y, scale, fullBody, action, frame, blink, equipment, emotion, race } = options;
  const skin = ({ Clara: "#e4b991", Bronceada: "#b77a4b", Oscura: "#754b35", Azul: "#639fa8" })[appearance.skin] || "#e4b991";
  const skinSombra = ({ Clara: "#c89a70", Bronceada: "#93592e", Oscura: "#5c3625", Azul: "#4c7f88" })[appearance.skin] || "#c89a70";
  const hair = ({ Negro: "#1c1b22", Moreno: "#543320", Rubio: "#d6a53c", Rojo: "#a43d2e", Gris: "#b9c9c8", Blanco: "#e8e6e0", Verde: "#3d7a5c" })[appearance.hair] || "#1c1b22";
  const hairLuz = ({ Negro: "#3d3b49", Moreno: "#7d5533", Rubio: "#f2c96a", Rojo: "#cc5f4a", Gris: "#dde8e7", Blanco: "#ffffff", Verde: "#5ca37f" })[appearance.hair] || "#3d3b49";
  const coats = { makino: "#728d72", morgan: "#576c89", zeff: "#e2d7b6", arlong: "#d09b55", smoker: "#718796" };
  const armor = String(equipment?.armor || "");
  const weapon = String(equipment?.weapon || "");
  // vestimenta: cada atuendo es una silueta distinta, no un cambio de color
  const VESTIMENTA = {
    Rojo: { base: "#9b443a", luz: "#c25d4e", osc: "#6f2f28", detalle: "chaleco" },
    Azul: { base: "#355f82", luz: "#4b7ca3", osc: "#25445f", detalle: "uniforme" },
    Verde: { base: "#46735a", luz: "#5d9273", osc: "#31513f", detalle: "chaqueta" },
    Negro: { base: "#343a48", luz: "#4b5364", osc: "#23272f", detalle: "abrigo" },
    Marrón: { base: "#79513b", luz: "#946a4e", osc: "#573a2b", detalle: "cuero" },
    Kimono: { base: "#8e4460", luz: "#ab5a78", osc: "#6a3246", detalle: "kimono" },
    Manto: { base: "#2e3a54", luz: "#41527a", osc: "#1f2838", detalle: "manto" },
    Gabardina: { base: "#c9a86a", luz: "#ddc084", osc: "#9e824c", detalle: "gabardina" }
  };
  const v = VESTIMENTA[appearance.outfit] || VESTIMENTA.Rojo;
  const coat = /armadura|placa|metal/i.test(armor) ? "#768494"
    : /capa|manto|abrigo/i.test(armor) ? "#36445c"
      : coats[appearance.portrait] || v.base;
  const eyes = ({ Marrón: "#483126", Azul: "#2585a5", Verde: "#4b8c55", Gris: "#aab7bf" })[appearance.eyes] || "#0b1329";
  const OUT = "rgba(14,10,9,0.4)"; // la misma tinta que bordea el mundo pixel
  const pixel = (px, py, w, h, color) => box(options.ctx, x + px * scale, y + py * scale, w * scale, h * scale, color);

  const victoryAura = () => {
    if (emotion !== "victory") return;
    for (const [px, py] of [[6, 9], [7, 6], [25, 8], [26, 13], [7, 19], [25, 22]]) {
      pixel(px, py, 2, 2, "#f4b41a");
    }
  };
  const rasgosRaza = () => {
    // lo que la sangre marca, detrás del cuerpo
    if (race === "sky") { pixel(6, 14, 2, 5, "#eef2f7"); pixel(6, 12, 2, 2, "#d9e2ec"); pixel(24, 14, 2, 5, "#eef2f7"); pixel(24, 12, 2, 2, "#d9e2ec"); }
    if (race === "lunarian") {
      const f = frame % 2 ? 1 : 0;
      pixel(24 + f, 12, 3, 4, "#f2a03c"); pixel(25 + f, 10, 2, 2, "#f6c26a"); pixel(24 + f, 17, 2, 2, "#c96a1e");
    }
  };
  const body = () => {
    const breath = action === "idle" && frame % 4 === 1 ? -1 : 0;
    // sombra al piso: el avatar está EN el suelo, no flotando
    if (fullBody) pixel(9, 30, 14, 2, "rgba(6,14,26,0.32)");
    // torso con luz del norte y sombra lateral: volumen, no un rectángulo plano
    pixel(11, 16 + breath, 10, 7, coat);
    pixel(11, 16 + breath, 10, 2, v.luz);
    pixel(20, 17 + breath, 1, 5, v.osc);
    pixel(10, 16 + breath, 1, 7, OUT); pixel(21, 16 + breath, 1, 7, OUT);
    // silueta por atuendo
    if (v.detalle === "chaleco") { pixel(13, 18 + breath, 2, 4, skin); pixel(17, 18 + breath, 2, 4, skin); pixel(12, 23 + breath, 8, 1, "#f4b41a"); }
    else if (v.detalle === "uniforme") { pixel(13, 17 + breath, 1, 5, v.luz); pixel(18, 17 + breath, 1, 5, v.luz); pixel(15, 19 + breath, 2, 2, "#f4b41a"); pixel(12, 23 + breath, 8, 1, v.osc); }
    else if (v.detalle === "chaqueta") { for (let i = 0; i < 6; i++) pixel(12 + i, 17 + i, 1, 1, v.osc); pixel(12, 23 + breath, 8, 1, v.osc); }
    else if (v.detalle === "abrigo") { pixel(11, 16 + breath, 10, 1, v.osc); pixel(13, 15 + breath, 6, 2, "#e8e4d8"); pixel(12, 23 + breath, 8, 1, v.osc); }
    else if (v.detalle === "cuero") { pixel(12, 22 + breath, 8, 2, "#3b2822"); pixel(15, 22 + breath, 2, 2, "#e1c46d"); pixel(11, 17 + breath, 1, 5, v.luz); }
    else if (v.detalle === "kimono") { pixel(11, 16 + breath, 3, 7, v.luz); pixel(19, 16 + breath, 3, 7, v.osc); pixel(15, 19 + breath, 2, 2, "#e1c46d"); }
    else if (v.detalle === "manto") { pixel(9, 16 + breath, 2, 8, v.osc); pixel(21, 16 + breath, 2, 8, v.osc); pixel(14, 16 + breath, 4, 1, "#f4b41a"); }
    else if (v.detalle === "gabardina") { pixel(12, 22 + breath, 8, 2, v.osc); pixel(15, 22 + breath, 2, 2, "#6e5a35"); pixel(13, 16 + breath, 1, 6, v.luz); }
    // brazos con sombra interior; el metal lleva hombreras pulidas
    pixel(10, 17 + breath, 2, 6, skinSombra); pixel(20, 17 + breath, 2, 6, skin);
    if (/armadura|placa|metal/i.test(armor)) { pixel(10, 16 + breath, 3, 3, "#a9b5bd"); pixel(19, 16 + breath, 3, 3, "#a9b5bd"); }
    // lo que la sangre marca por delante: branquias, colmillos, tercer ojo
    if (race === "fishman") { pixel(12, 20 + breath, 1, 1, "#7fb5b6"); pixel(12, 22 + breath, 1, 1, "#7fb5b6"); pixel(19, 20 + breath, 1, 1, "#7fb5b6"); pixel(19, 22 + breath, 1, 1, "#7fb5b6"); }
    if (race === "giant") { pixel(9, 16 + breath, 2, 6, coat); pixel(21, 16 + breath, 2, 6, coat); }
    if (race === "threeeye") { pixel(15, 7 + breath, 2, 2, "#c9683a"); pixel(15, 7 + breath, 2, 1, "#8c3a22"); }
    if (fullBody) {
      const step = ["navigating", "walking"].includes(action) && frame % 2 ? 2 : 0;
      pixel(11 + step, 24, 4, 4, "#35455c"); pixel(18 - step, 24, 4, 4, "#35455c");
      pixel(11 + step, 24, 1, 4, "#2a3848"); pixel(18 - step, 24, 1, 4, "#2a3848");
      pixel(11 + step, 28, 4, 3, "#3b2822"); pixel(18 - step, 28, 4, 3, "#3b2822");
      pixel(11 + step, 30, 4, 1, "#241813"); pixel(18 - step, 30, 4, 1, "#241813");
    }
  };
  const face = () => {
    pixel(11, 7, 10, 10, skin);
    pixel(19, 8, 2, 8, skinSombra); // perfil sombreado: volumen
    pixel(11, 7, 10, 1, OUT); pixel(11, 16, 10, 1, OUT); pixel(11, 7, 1, 10, OUT); pixel(20, 7, 1, 10, OUT);
    // cejas: la actitud antes que la palabra
    pixel(12, 9, 3, 1, hair); pixel(17, 9, 3, 1, hair);
    if (emotion === "exhausted") {
      pixel(12, 12, 3, 1, "#30251f");
      pixel(18, 12, 3, 1, "#30251f");
      pixel(15, 15, 3, 2, "#66392f");
    } else if (blink) pixel(12, 12, 8, 1, "#30251f");
    else {
      pixel(12, 11, 3, 2, "#f4f0ea"); pixel(18, 11, 3, 2, "#f4f0ea");
      pixel(13, 11, 2, 2, eyes); pixel(18, 11, 2, 2, eyes);
    }
    if (emotion !== "exhausted") pixel(14, 14, 4, 1, emotion === "victory" ? "#8c3328" : "#a14a36");
    if (emotion === "victory") { pixel(12, 13, 1, 1, "#d9a06b"); pixel(19, 13, 1, 1, "#d9a06b"); }
    if (emotion === "exhausted") pixel(22, 8, 2, 3, "#64c9e8");
  };
  const hairLayer = () => {
    const wind = action === "idle" && frame % 4 === 2 ? 1 : 0;
    pixel(10 + wind, 4, 12, 4, hair);
    pixel(9 + wind, 5, 3, 6, hair); pixel(20 + wind, 5, 3, 6, hair);
    pixel(10 + wind, 4, 4, 1, hairLuz); // mechón iluminado
    pixel(13 + wind, 4, 3, 1, hairLuz);
    if (race === "mink") { pixel(9, 2, 3, 4, hair); pixel(20, 2, 3, 4, hair); pixel(10, 2, 1, 2, hairLuz); pixel(21, 2, 1, 2, hairLuz); }
    if (appearance.portrait === "makino") {
      pixel(8, 11, 3, 7, hair); pixel(21, 11, 3, 7, hair); pixel(10, 15, 2, 2, "#f4b41a");
    } else if (appearance.portrait === "zeff") {
      pixel(9, 1, 14, 4, "#f4efdf"); pixel(8, 5, 16, 2, "#d4ccb9"); pixel(13, 16, 7, 2, hair);
    } else if (appearance.portrait === "morgan") {
      pixel(8, 16, 5, 3, "#c9ad67"); pixel(20, 16, 5, 3, "#c9ad67"); pixel(16, 16, 5, 2, "#8b9695");
    } else if (race === "lunarian") {
      pixel(10 + wind, 2, 3, 3, "#f2e8dc"); pixel(19 + wind, 2, 3, 3, "#f2e8dc");
    }
  };
  const outfit = () => {
    pixel(12, 17, 8, 5, coat);
    if (appearance.portrait === "arlong") {
      pixel(14, 12, 7, 2, "#93c3c4"); pixel(20, 12, 4, 2, skin); pixel(14, 15, 6, 2, "#e6ded1");
    } else if (appearance.portrait === "smoker") {
      pixel(9, 15, 4, 4, "#e7e6d8"); pixel(20, 15, 4, 4, "#e7e6d8"); pixel(18, 13, 6, 1, "#7b5142");
    }
  };
  const accessories = () => {
    const hat = String(equipment?.accessory || appearance.accessory || "").toLocaleLowerCase("es");
    if (hat.includes("tricornio")) { pixel(8, 3, 16, 2, "#2b2f38"); pixel(10, 0, 12, 3, "#3a4048"); pixel(10, 3, 12, 1, "#e1c46d"); }
    else if (hat.includes("gorra marina")) { pixel(10, 2, 12, 3, "#e8e6e0"); pixel(9, 5, 14, 2, "#3a5578"); pixel(15, 1, 3, 1, "#3a5578"); }
    else if (hat.includes("sombrero") || hat.includes("hat")) { pixel(6, 5, 20, 2, "#8b6038"); pixel(6, 6, 20, 1, "#6d4a2b"); pixel(10, 1, 12, 4, "#c79a54"); pixel(10, 4, 12, 1, "#b03a3a"); }
    else if (appearance.accessory === "Bandana") { pixel(9, 5, 14, 3, "#c84237"); pixel(22, 6, 4, 2, "#c84237"); pixel(9, 5, 14, 1, "#e0655a"); }
    else if (appearance.accessory === "Capucha") { pixel(9, 4, 14, 4, coat); pixel(8, 8, 2, 5, coat); pixel(22, 8, 2, 5, coat); }
    else if (appearance.accessory === "Aro de metal") pixel(22, 13, 2, 3, "#e1c46d");
    else if (appearance.accessory === "Collar") { pixel(14, 16, 6, 2, "#e1c46d"); pixel(16, 18, 2, 3, "#f4b41a"); }
    else if (appearance.accessory === "Aretes") { pixel(10, 14, 1, 1, "#e1c46d"); pixel(10, 16, 1, 1, "#e1c46d"); pixel(21, 14, 1, 1, "#e1c46d"); pixel(21, 16, 1, 1, "#e1c46d"); }
    else if (appearance.accessory === "Cicatriz") { pixel(17, 12, 1, 3, "#8c5a48"); pixel(18, 13, 1, 2, "#8c5a48"); }
    if (appearance.glasses) { pixel(10, 11, 5, 2, "#26394b"); pixel(18, 11, 5, 2, "#26394b"); pixel(15, 11, 3, 1, "#d5b66e"); }
    if (appearance.eyepatch) { pixel(17, 10, 4, 4, "#211c1a"); pixel(17, 9, 5, 1, "#3b3028"); }
    if (weapon || action === "combat") {
      pixel(26, 13, 2, 13, "#d7dce0");
      pixel(24, 14, 6, 2, "#b58b3a");
      pixel(26, 25, 2, 5, "#694732");
    }
    if (emotion === "weather") {
      pixel(7, 2, 5, 1, "#b8e3f0");
      pixel(4, 6, 4, 1, "#b8e3f0");
      pixel(21, 4, 5, 1, "#b8e3f0");
      pixel(9, 15, 3, 4, skin);
      pixel(8, 13, 4, 2, coat);
    }
    if (action === "tavern") { pixel(24, 19, 5, 6, "#bd8641"); pixel(25, 17, 3, 2, "#f3d37a"); }
    if (action === "resting" && frame % 4 === 0) { pixel(23, 3, 3, 2, "#e8d9ad"); pixel(27, 1, 3, 2, "#e8d9ad"); }
  };
  return [victoryAura, rasgosRaza, body, face, hairLayer, outfit, accessories];
}

export function avatarEmotion(character) {
  if (!character) return "neutral";
  if (character.avatarActivity === "victory" || (victoryMoments.get(character) || 0) > Date.now()) return "victory";
  const health = Number(character.stats?.health);
  const maxHealth = Math.max(1, Number(character.stats?.maxHealth) || 100);
  if (Number.isFinite(health) && health / maxHealth <= 0.2) return "exhausted";
  if (character.travel?.weather === "storm" || character.travel?.climate === "rogue-wave") return "weather";
  return "neutral";
}

export function celebrateAvatar(character, duration = 1800) {
  if (character && typeof character === "object") victoryMoments.set(character, Date.now() + duration);
}

export function avatarAction(character) {
  if (!character || character.status === "dead") return "resting";
  if (avatarEmotion(character) === "victory") return "victory";
  if (character.location?.atSea) return "navigating";
  if (character.avatarActivity === "victory") return "victory";
  const action = character.avatarActivity;
  return ["tavern", "combat", "resting", "walking", "inspecting", "victory"].includes(action) ? action : "idle";
}

export function drawPixelAvatar(ctx, appearance = {}, options = {}) {
  const equipment = options.equipment || appearance.equipped || {};
  const time = options.time ?? 0;
  const pixelScale = options.size === 64 ? 2 : 1;
  const state = {
    ctx, x: options.x ?? 0, y: options.y ?? 0, scale: (options.scale ?? 1) * pixelScale,
    fullBody: Boolean(options.fullBody), action: options.action || "idle",
    frame: Math.floor(time / 300) % 8,
    blink: time > 0 && time % 4200 < 150,
    emotion: options.emotion || "neutral",
    equipment,
    race: options.race || appearance.race || null
  };
  const bob = state.action === "resting" ? 0 : state.action === "idle" ? (state.frame % 4 === 1 ? -1 : 0) : state.frame % 2;
  state.y += bob * state.scale;
  for (const layer of avatarLayers(appearance, state)) layer();
}

export const ISLAND_SCENE_WIDTH = 640;
export const ISLAND_SCENE_HEIGHT = 400;
export const ISLAND_HOTSPOTS = {
  tavern: { x: 112, y: 129 },
  market: { x: 514, y: 129 },
  blackmarket: { x: 135, y: 240 },
  poneglyph: { x: 548, y: 236 },
  chest: { x: 400, y: 260 }
};

function building(ctx, x, y, w, h, roof, wall) {
  ctx.fillStyle = "rgba(6,14,26,.2)"; // sombra suave al piso: profundidad 32-bit
  ctx.fillRect(x - 4, y + h - 4, w + 10, 9);
  box(ctx, x + 4, y + 9, w, h, "#423a35");
  box(ctx, x, y, w, h, wall);
  box(ctx, x - 5, y - 8, w + 10, 13, roof);
  box(ctx, x + 4, y - 13, w - 8, 6, roof);
  for (let px = x + 10; px < x + w - 8; px += 24) {
    box(ctx, px, y + 15, 11, 13, "#594c40");
    box(ctx, px + 2, y + 17, 7, 9, "#f5cf7a");
  }
  box(ctx, x + w / 2 - 7, y + h - 22, 14, 22, "#4b342a");
}

function ship(ctx, x, y, flag) {
  box(ctx, x, y + 26, 74, 13, "#614536");
  box(ctx, x + 6, y + 39, 62, 6, "#3e342e");
  box(ctx, x + 35, y - 10, 3, 37, "#5b4030");
  box(ctx, x + 38, y - 7, 22, 23, "#e6dec4");
  box(ctx, x + 38, y - 13, 14, 6, flag);
  box(ctx, x + 13, y + 22, 48, 4, "#c29a6b");
}

export function drawIslandSceneContext(ctx, island, character, now = 0) {
  const scene = island.localScene;
  const palette = PALETTES[scene.theme] || PALETTES.green;
  const seed = scene.seed;
  ctx.imageSmoothingEnabled = false;
  const mar = linearSuave(ctx, 0, 0, 0, 400, [[0, "#3f8aa4"], [.55, "#397d8d"], [1, "#2b6276"]]); // mar con profundidad (32-bit)
  ctx.fillStyle = mar || "#397d8d";
  ctx.fillRect(0, 0, 640, 400);
  for (let y = 8; y < 400; y += 16) for (let x = (y % 32 ? 7 : 20); x < 640; x += 43)
    box(ctx, x, y, 22, 2, (x + y + seed) % 3 ? "#518f9b" : "#71afaf");

  box(ctx, 24, 12, 592, 272, palette.earth);
  box(ctx, 30, 12, 580, 252, palette.land);
  box(ctx, 40, 20, 560, 230, "#9d9c8b");
  for (let y = 22; y < 248; y += 12) {
    for (let x = 42 + (y % 24 ? 0 : 9); x < 594; x += 18) {
      box(ctx, x, y, 16, 10, (x + y + seed) % 5 ? "#bcb7a1" : "#a8a994");
      box(ctx, x + 2, y + 1, 8, 1, "#d0c8b0");
    }
  }
  // ── Capa de luz 32-bit: luz de tarde cruzando el terreno y parches de sol ──
  const luz = linearSuave(ctx, 0, 12, 640, 388, [[0, "rgba(255,244,214,.12)"], [.5, "rgba(255,255,255,0)"], [1, "rgba(4,14,28,.18)"]]);
  if (luz) {
    ctx.fillStyle = luz;
    ctx.fillRect(24, 12, 592, 272);
  }
  for (const [px, py, pr] of [[150, 92, 92], [436, 118, 112], [298, 198, 84]]) {
    const g = radialSuave(ctx, px, py, 6, pr, "rgba(255,240,190,.12)", "rgba(255,240,190,0)");
    if (!g) continue;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, 7);
    ctx.fill();
  }
  // playa: arena clara en el borde sur y espuma viva contra el mar
  ctx.fillStyle = "rgba(233,208,150,.5)";
  ctx.fillRect(24, 262, 592, 10);
  for (let x = 26; x < 614; x += 13) {
    const fo = Math.sin(now / 640 + x * .12) * 3;
    box(ctx, x + fo, 280, 8, 2, "#eef7ff");
  }
  box(ctx, 27, 21, 15, 217, "#656b65");
  box(ctx, 598, 21, 15, 217, "#656b65");
  box(ctx, 30, 10, 580, 17, "#6c7774");
  for (let x = 33; x < 610; x += 24) box(ctx, x, 5, 14, 10, "#85918c");
  box(ctx, 170, 272, 300, 21, "#74523a");
  for (let x = 172; x < 466; x += 14) box(ctx, x, 275, 11, 15, "#aa7e52");
  for (const x of [190, 450]) {
    box(ctx, x, 290, 40, 62, "#694732");
    for (let y = 292; y < 350; y += 9) box(ctx, x + 3, y, 34, 7, "#b08354");
  }
  ship(ctx, 92, 317, "#f4b41a");
  ship(ctx, 495, 322, "#e6ded2");
  for (const [from, to] of [[{ x: 150, y: 145 }, { x: 320, y: 272 }], [{ x: 320, y: 272 }, { x: 490, y: 145 }], [{ x: 320, y: 272 }, { x: 320, y: 215 }]]) {
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 8);
    for (let step = 0; step <= steps; step++) {
      const progress = step / Math.max(1, steps);
      box(ctx, from.x + (to.x - from.x) * progress - 3, from.y + (to.y - from.y) * progress - 2, 6, 5, "#a98b63");
    }
  }

  const arch = scene.architecture;
  building(ctx, 65, 65, 96, 68, "#a9503b", "#e7d19f");
  building(ctx, 473, 65, 96, 68, "#82624a", "#d9c5a1");
  building(ctx, 56, 179, 78, 51, "#9e5e47", "#ddc59a");
  building(ctx, 506, 179, 78, 51, "#997850", "#d4c2a1");
  box(ctx, 99, 52, 29, 11, "#704c32");
  box(ctx, 102, 54, 23, 6, "#e1b95f");
  box(ctx, 507, 52, 28, 11, "#704c32");
  box(ctx, 510, 54, 22, 6, "#82b99a");

  if (arch === "fortress" || island.id === "ennies") {
    building(ctx, 225, 59, 190, 101, "#667a83", "#adb7ae");
    box(ctx, 270, 38, 100, 32, "#889897");
    box(ctx, 305, 13, 28, 49, "#aab7b2");
    box(ctx, 318, 0, 3, 19, "#4a3b2b");
    box(ctx, 321, 3, 25, 9, "#e7e9d8");
    box(ctx, 327, 5, 10, 5, "#537d9a");
    for (let x = 228; x < 415; x += 21) box(ctx, x, 50, 13, 12, "#778b8d");
  } else if (arch === "loguetown") {
    building(ctx, 216, 43, 208, 75, "#a86e58", "#e3d4b8");
    box(ctx, 253, 139, 134, 57, "#989b94");
    for (let x = 261; x < 385; x += 16) box(ctx, x, 146, 12, 45, "#c3c0ac");
    box(ctx, 297, 151, 46, 27, "#73533d");
    box(ctx, 304, 126, 4, 30, "#4f392e");
    box(ctx, 332, 126, 4, 30, "#4f392e");
    box(ctx, 304, 126, 32, 4, "#4f392e");
  } else if (arch === "baratie") {
    box(ctx, 225, 80, 190, 77, "#78513b");
    box(ctx, 210, 111, 220, 28, "#b9844e");
    box(ctx, 191, 99, 25, 52, "#b9844e");
    building(ctx, 260, 64, 120, 55, "#527c84", "#e5ca8d");
  } else if (arch === "arlong" || island.id === "wano") {
    building(ctx, 244, 69, 152, 86, "#a54238", "#6b9da3");
    box(ctx, 232, 60, 176, 12, "#b7493b");
    box(ctx, 254, 44, 132, 16, "#bd5b41");
    tree(ctx, 430, 171, "#508e55", true);
  } else {
    building(ctx, 245, 65, 150, 90, arch === "sky" ? "#d9cba4" : "#b85a41", "#e7d09c");
    if (arch === "foosha") {
      box(ctx, 413, 66, 12, 70, "#ad8058");
      box(ctx, 397, 79, 45, 5, "#e6d3a6");
      box(ctx, 416, 59, 5, 45, "#e6d3a6");
    } else tree(ctx, 410, 155, "#4c8d60", true);
  }
  box(ctx, 388, 232, 26, 17, "#6c3e2d");
  box(ctx, 390, 226, 22, 8, "#bc8641");
  box(ctx, 399, 235, 5, 6, "#f4b41a");
  (island.npcs || []).forEach((npc, index) => {
    const position = localWaypointPosition(island, index, now);
    const x = position.x - 12;
    const y = position.y - 16;
    box(ctx, x + 7, y + 27, 16, 3, "rgba(0,0,0,.25)");
    drawPixelAvatar(ctx, npcAppearanceFor(npc.name) || npc, { x, y, scale: .4, size: 64, fullBody: true, time: now });
  });
  (island.pois || []).forEach((poi) => {
    const canRead = character?.race === "threeeye" ||
        /(archaeolog|arqueolog)/i.test(normalizeText(character?.profession)) ||
        (character?.inventory?.items || []).some((item) => /ancient (?:cipher )?(?:tome|primer)|tomo antiguo|manual de glifos/i.test(String(item)));
    if (poi.type === "poneglyph" && !canRead) {
      const x = Number(poi.x);
      const y = Number(poi.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      box(ctx, x - 8, y - 12, 16, 24, "#625f58");
      box(ctx, x - 6, y - 15, 12, 4, "#817d72");
      box(ctx, x - 5, y - 7, 2, 2, "#c4b8a0");
      box(ctx, x + 1, y - 2, 3, 2, "#b9ad96");
      box(ctx, x - 3, y + 4, 2, 2, "#d0c3a9");
      box(ctx, x - 10, y + 12, 20, 3, "#454b4a");
      return;
    }
    const colors = {
      tavern: "#d27d47", restaurant: "#da9c48", market: "#e5bd63",
      weapon_shop: "#c7a2c2", base: "#849aa3", plaza: "#d2c49d",
      dock: "#c18e55", shipyard: "#9db4a0", kitchen: "#c77b5d"
    };
    const x = Number(poi.x);
    const y = Number(poi.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (poi.type === "poneglyph") {
      const glyphColor = ({ blue: "#3d8cff", red: "#e25252", gold: "#f4b41a" })[poi.glyphType] || "#3d8cff";
      box(ctx, x - 8, y - 12, 16, 24, "#625f58");
      box(ctx, x - 6, y - 15, 12, 4, "#817d72");
      box(ctx, x - 5, y - 7, 2, 2, glyphColor);
      box(ctx, x + 1, y - 2, 3, 2, glyphColor);
      box(ctx, x - 3, y + 4, 2, 2, glyphColor);
      box(ctx, x - 10, y + 12, 20, 3, "#454b4a");
      return;
    }
    const color = colors[poi.type] || "#f4b41a";
    box(ctx, x - 5, y - 5, 12, 12, "#18263a");
    box(ctx, x - 3, y - 3, 8, 8, color);
    if (ctx.fillText) {
      const labels = { tavern: "TABERNA", inn: "POSADA", market: "MERCADO", restaurant: "COMEDOR", base: "BASE", boss_lair: "GUARIDA", dock: "MUELLE", weapon_shop: "ARMAS", kitchen: "COCINA", shipyard: "ASTILLERO", plaza: "PLAZA" };
      const label = labels[poi.type];
      if (label) {
        const signX = x - 18, signY = y - 17;
        box(ctx, signX, signY, 38, 9, "#493727");
        box(ctx, signX + 1, signY + 1, 36, 7, "#b68c50");
        ctx.fillStyle = "#211b16";
        ctx.font = "bold 5px monospace";
        ctx.textAlign = "center";
        ctx.fillText(label, x + 1, signY + 6, 34);
      }
    }
  });
  if (character) {
    const action = avatarAction(character);
    const position = avatarScenePosition(island.id, character.id, action, character.location?.scenePosition);
    box(ctx, position.x - 21, position.y + 4, 42, 7, "rgba(0,0,0,.25)");
    drawPixelAvatar(ctx, character.avatarConfig || character.appearance, {
      x: position.x - 32, y: position.y - 62, scale: 1, size: 64, fullBody: true, action, time: now,
      equipment: character.equipped, emotion: avatarEmotion(character)
    });
  }
  // Viñeta suave de estudio: cierra la escena con profundidad (32-bit)
  const vina = radialSuave(ctx, 320, 176, 170, 430, "rgba(0,0,0,0)", "rgba(3,10,22,.16)");
  if (vina) {
    ctx.fillStyle = vina;
    ctx.fillRect(0, 0, 640, 400);
  }
}

export function drawIslandScene(canvas, island, character) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo inicializar la vista de isla.");
  drawIslandSceneContext(ctx, island, character);
}
