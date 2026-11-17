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

export function npcAppearanceFor(text) {
  return NPC_PORTRAITS.find((entry) => entry.pattern.test(String(text ?? "")))?.appearance ?? null;
}

function avatarLayers(appearance, options) {
  const { x, y, scale, fullBody, action, frame, blink, equipment } = options;
  const skin = ({ Clara: "#e4b991", Bronceada: "#b77a4b", Oscura: "#754b35", Azul: "#639fa8" })[appearance.skin] || "#e4b991";
  const hair = ({ Negro: "#1c1b22", Moreno: "#543320", Rubio: "#d6a53c", Rojo: "#a43d2e", Gris: "#b9c9c8" })[appearance.hair] || "#1c1b22";
  const coats = { makino: "#728d72", morgan: "#576c89", zeff: "#e2d7b6", arlong: "#d09b55", smoker: "#718796" };
  const armor = String(equipment?.armor || "");
  const weapon = String(equipment?.weapon || "");
  const coat = /armadura|placa|metal/i.test(armor) ? "#768494"
    : /capa|manto|abrigo/i.test(armor) ? "#36445c"
      : coats[appearance.portrait] || ({ Azul: "#355f82", Rojo: "#9b443a", Verde: "#46735a", Negro: "#343a48", Marrón: "#79513b" })[appearance.outfit] || "#c65f4c";
  const eyes = ({ Marrón: "#483126", Azul: "#2585a5", Verde: "#4b8c55", Gris: "#aab7bf" })[appearance.eyes] || "#0b1329";
  const pixel = (px, py, w, h, color) => box(options.ctx, x + px * scale, y + py * scale, w * scale, h * scale, color);

  const body = () => {
    const breath = action === "idle" && frame % 4 === 1 ? -1 : 0;
    pixel(11, 16 + breath, 10, 7, coat);
    pixel(12, 22 + breath, 8, 2, "#f4b41a");
    pixel(10, 23 + breath, 12, 1, "#49382d");
    if (/armadura|placa|metal/i.test(armor)) {
      pixel(12, 17 + breath, 3, 5, "#a9b5bd");
      pixel(17, 17 + breath, 3, 5, "#a9b5bd");
    }
    if (fullBody) {
      const step = ["navigating", "walking"].includes(action) && frame % 2 ? 2 : 0;
      pixel(8, 17 + breath, 3, 6, skin);
      pixel(21, 17 + breath, 3, 6, skin);
      pixel(11 + step, 24, 4, 4, "#35455c");
      pixel(18 - step, 24, 4, 4, "#35455c");
      pixel(11 + step, 28, 4, 3, "#3b2822");
      pixel(18 - step, 28, 4, 3, "#3b2822");
    }
  };
  const face = () => {
    pixel(11, 7, 10, 10, skin);
    if (blink) pixel(12, 12, 8, 1, "#30251f");
    else {
      pixel(12, 11, 2, 2, eyes);
      pixel(18, 11, 2, 2, eyes);
    }
    pixel(15, 15, 3, 1, "#a14a36");
  };
  const hairLayer = () => {
    const wind = action === "idle" && frame % 4 === 2 ? 1 : 0;
    pixel(10 + wind, 4, 12, 4, hair);
    pixel(8 + wind, 7, 4, 7, hair);
    pixel(20 + wind, 7, 4, 5, hair);
    if (appearance.portrait === "makino") {
      pixel(8, 11, 3, 7, hair); pixel(21, 11, 3, 7, hair); pixel(10, 15, 2, 2, "#f4b41a");
    } else if (appearance.portrait === "zeff") {
      pixel(9, 1, 14, 4, "#f4efdf"); pixel(8, 5, 16, 2, "#d4ccb9"); pixel(13, 16, 7, 2, hair);
    } else if (appearance.portrait === "morgan") {
      pixel(8, 16, 5, 3, "#c9ad67"); pixel(20, 16, 5, 3, "#c9ad67"); pixel(16, 16, 5, 2, "#8b9695");
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
    if (hat.includes("sombrero") || hat.includes("hat")) { pixel(6, 5, 20, 2, "#8b6038"); pixel(10, 1, 12, 4, "#c79a54"); }
    else if (appearance.accessory === "Bandana") { pixel(9, 5, 14, 3, "#c84237"); pixel(22, 6, 4, 2, "#c84237"); }
    else if (appearance.accessory === "Aro de metal") pixel(22, 13, 2, 3, "#e1c46d");
    else if (appearance.accessory === "Collar") { pixel(14, 16, 6, 2, "#e1c46d"); pixel(16, 18, 2, 3, "#f4b41a"); }
    if (appearance.glasses) { pixel(10, 11, 5, 2, "#26394b"); pixel(18, 11, 5, 2, "#26394b"); pixel(15, 11, 3, 1, "#d5b66e"); }
    if (appearance.eyepatch) { pixel(17, 10, 4, 4, "#211c1a"); pixel(17, 9, 5, 1, "#3b3028"); }
    if (weapon || action === "combat") {
      pixel(26, 13, 2, 13, "#d7dce0");
      pixel(24, 14, 6, 2, "#b58b3a");
      pixel(26, 25, 2, 5, "#694732");
    }
    if (action === "tavern") { pixel(24, 19, 5, 6, "#bd8641"); pixel(25, 17, 3, 2, "#f3d37a"); }
    if (action === "resting" && frame % 4 === 0) { pixel(23, 3, 3, 2, "#e8d9ad"); pixel(27, 1, 3, 2, "#e8d9ad"); }
  };
  return [body, face, hairLayer, outfit, accessories];
}

export function avatarAction(character) {
  if (!character || character.status === "dead") return "resting";
  if (character.location?.atSea) return "navigating";
  const action = character.avatarActivity;
  return ["tavern", "combat", "resting", "walking", "inspecting"].includes(action) ? action : "idle";
}

export function drawPixelAvatar(ctx, appearance = {}, options = {}) {
  const equipment = options.equipment || appearance.equipped || {};
  const time = options.time ?? 0;
  const state = {
    ctx, x: options.x ?? 0, y: options.y ?? 0, scale: options.scale ?? 1,
    fullBody: Boolean(options.fullBody), action: options.action || "idle",
    frame: Math.floor(time / 300) % 8,
    blink: time > 0 && time % 4200 < 150,
    equipment
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
  box(ctx, 0, 0, 640, 400, "#397d8d");
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
    drawPixelAvatar(ctx, npcAppearanceFor(npc.name) || npc, { x, y, scale: .8, fullBody: true, time: now });
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
    box(ctx, position.x - 7, position.y + 35, 31, 6, "rgba(0,0,0,.25)");
    drawPixelAvatar(ctx, character.avatarConfig || character.appearance, {
      x: position.x - 16, y: position.y - 32, scale: 1, fullBody: true, action, time: now,
      equipment: character.equipped
    });
  }
}

export function drawIslandScene(canvas, island, character) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo inicializar la vista de isla.");
  drawIslandSceneContext(ctx, island, character);
}
