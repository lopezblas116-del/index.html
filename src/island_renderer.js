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
function tree(ctx, x, y, color, fruit = false) {
  box(ctx, x + 10, y + 25, 8, 24, "#6a4934");
  box(ctx, x + 3, y + 9, 22, 23, color);
  box(ctx, x + 8, y + 3, 15, 8, color);
  box(ctx, x, y + 16, 29, 10, color);
  if (fruit) { box(ctx, x + 6, y + 18, 4, 4, "#f7a43c"); box(ctx, x + 18, y + 12, 4, 4, "#f7a43c"); }
}

export function drawPixelAvatar(ctx, appearance = {}, options = {}) {
  const { x = 0, y = 0, scale = 1, fullBody = false } = options;
  const skin = ({ Clara: "#e4b991", Bronceada: "#b77a4b", Oscura: "#754b35" })[appearance.skin] || "#e4b991";
  const hair = ({ Negro: "#1c1b22", Moreno: "#543320", Rubio: "#d6a53c", Rojo: "#a43d2e" })[appearance.hair] || "#1c1b22";
  const pixel = (px, py, w, h, color) => box(ctx, x + px * scale, y + py * scale, w * scale, h * scale, color);

  pixel(11, 22, 10, 9, "#c65f4c");
  pixel(12, 30, 8, 2, "#f4b41a");
  pixel(10, 31, 12, 1, "#49382d");
  if (fullBody) {
    pixel(9, 23, 3, 10, skin);
    pixel(21, 23, 3, 10, skin);
    pixel(11, 32, 10, 6, "#35455c");
    pixel(11, 38, 4, 5, "#3b2822");
    pixel(18, 38, 4, 5, "#3b2822");
  }
  pixel(12, 10, 9, 12, skin);
  pixel(11, 8, 11, 4, hair);
  pixel(9, 11, 4, 7, hair);
  pixel(20, 10, 4, 5, hair);
  pixel(13, 14, 2, 2, "#0b1329");
  pixel(18, 14, 2, 2, "#0b1329");
  pixel(15, 19, 3, 1, "#a14a36");

  if (appearance.accessory === "Bandana") {
    pixel(10, 9, 13, 3, "#c84237");
    pixel(21, 10, 5, 2, "#c84237");
  } else if (appearance.accessory === "Sombrero") {
    pixel(8, 9, 18, 2, "#8b6038");
    pixel(12, 5, 10, 4, "#c79a54");
  } else if (appearance.accessory === "Aro de metal") {
    pixel(21, 17, 2, 3, "#e1c46d");
  } else if (appearance.accessory === "Collar") {
    pixel(14, 22, 6, 2, "#e1c46d");
    pixel(16, 24, 2, 3, "#f4b41a");
  }
  if (appearance.glasses) {
    pixel(11, 14, 5, 2, "#26394b");
    pixel(18, 14, 5, 2, "#26394b");
    pixel(16, 14, 2, 1, "#d5b66e");
  }
  if (appearance.eyepatch) {
    pixel(17, 13, 4, 4, "#211c1a");
    pixel(17, 12, 5, 1, "#3b3028");
  }
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
  if (scene.options.includes("poneglyph")) {
    box(ctx, 535, 205, 27, 30, "#385b72");
    for (let i = 0; i < 4; i++) box(ctx, 540, 209 + i * 5, 15, 2, "#b4d7d2");
  }
  (island.npcs || []).forEach((npc, index) => {
    const x = 170 + index * 190 + Math.sin(now / 1700 + index * 2) * 34;
    const y = 172 + index * 20;
    box(ctx, x + 7, y + 34, 20, 4, "rgba(0,0,0,.25)");
    drawPixelAvatar(ctx, npc, { x, y, scale: .8, fullBody: true });
    if (ctx.fillText) {
      ctx.fillStyle = "#18263a";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(npc.name, x + 13, y - 2);
    }
  });
  if (character) {
    box(ctx, 275, 260, 31, 6, "rgba(0,0,0,.25)");
    drawPixelAvatar(ctx, character.appearance, { x: 267, y: 211, scale: 1.15, fullBody: true });
  }
}

export function drawIslandScene(canvas, island, character) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo inicializar la vista de isla.");
  drawIslandSceneContext(ctx, island, character);
}
