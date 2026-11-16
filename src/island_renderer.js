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
function house(ctx, x, y, roof, wall) {
  box(ctx, x, y + 22, 76, 65, "#463e38");
  box(ctx, x + 5, y + 24, 66, 58, wall);
  for (let i = 0; i < 6; i++) box(ctx, x + i * 6, y + 15 - i * 3, 76 - i * 12, 4, roof);
  box(ctx, x + 28, y + 53, 18, 29, "#513c31");
  box(ctx, x + 9, y + 35, 12, 12, "#ffd071");
  box(ctx, x + 54, y + 35, 12, 12, "#ffd071");
}
function tree(ctx, x, y, color, fruit = false) {
  box(ctx, x + 10, y + 25, 8, 24, "#6a4934");
  box(ctx, x + 3, y + 9, 22, 23, color);
  box(ctx, x + 8, y + 3, 15, 8, color);
  box(ctx, x, y + 16, 29, 10, color);
  if (fruit) { box(ctx, x + 6, y + 18, 4, 4, "#f7a43c"); box(ctx, x + 18, y + 12, 4, 4, "#f7a43c"); }
}

export function drawPixelAvatar(ctx, appearance = {}, options = {}) {
  const { x = 0, y = 0, scale = 1 } = options;
  const skin = ({ Clara: "#e4b991", Bronceada: "#b77a4b", Oscura: "#754b35" })[appearance.skin] || "#e4b991";
  const hair = ({ Negro: "#1c1b22", Moreno: "#543320", Rubio: "#d6a53c", Rojo: "#a43d2e" })[appearance.hair] || "#1c1b22";
  const pixel = (px, py, w, h, color) => box(ctx, x + px * scale, y + py * scale, w * scale, h * scale, color);

  pixel(11, 22, 10, 9, "#c65f4c");
  pixel(12, 30, 8, 2, "#f4b41a");
  pixel(10, 31, 12, 1, "#49382d");
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

function drawClouds(ctx, seed) {
  const layers = [
    { y: 38, speed: 1, color: "rgba(255,255,255,.55)", width: 92 },
    { y: 75, speed: -1, color: "rgba(238,249,250,.42)", width: 128 },
    { y: 112, speed: 1, color: "rgba(255,255,255,.28)", width: 72 }
  ];
  for (const [layer, cloud] of layers.entries()) {
    for (let i = 0; i < 6; i++) {
      const x = ((seed + i * 151 + layer * 47) % 760) - 60;
      const y = cloud.y + (i % 3) * 9;
      box(ctx, x, y, cloud.width, 7, cloud.color);
      box(ctx, x + 12, y - 5, cloud.width * .55, 6, cloud.color);
      box(ctx, x + 27, y - 9, cloud.width * .25, 5, cloud.color);
    }
  }
}

export function drawIslandScene(canvas, island, character) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo inicializar la vista de isla.");
  const scene = island.localScene;
  const palette = PALETTES[scene.theme] || PALETTES.green;
  const seed = scene.seed;
  ctx.imageSmoothingEnabled = false;
  const sky = ctx.createLinearGradient(0, 0, 0, 200);
  sky.addColorStop(0, palette.sky[0]);
  sky.addColorStop(1, palette.sky[1]);
  box(ctx, 0, 0, 640, 400, sky);
  drawClouds(ctx, seed);
  box(ctx, 0, 182, 640, 218, "#397d8d");
  for (let i = 0; i < 12; i++) {
    const x = (seed + i * 137) % 640, y = 185 + (i * 43) % 155;
    box(ctx, x, y, 35, 3, "#71afaf");
    box(ctx, x + 8, y + 6, 18, 2, "rgba(205,240,235,.35)");
  }
  for (let i = 0; i < 4; i++) {
    const x = (seed + i * 179) % 660 - 40;
    box(ctx, x, 165, 100, 30, palette.mountain);
    box(ctx, x + 15, 150, 70, 20, palette.mountain);
    box(ctx, x + 34, 138, 30, 20, palette.mountain);
    box(ctx, x + 41, 143, 11, 3, "rgba(255,255,255,.2)");
  }
  box(ctx, 35, 235, 570, 123, palette.earth);
  box(ctx, 44, 251, 552, 95, "rgba(20,25,24,.12)");
  box(ctx, 58, 220, 524, 30, palette.land);
  box(ctx, 35, 242, 570, 18, palette.land);
  box(ctx, 55, 220, 526, 5, palette.light);
  for (let i = 0; i < 34; i++) {
    const x = 43 + ((seed + i * 83) % 545), y = 263 + ((seed >>> (i % 16)) + i * 19) % 81;
    box(ctx, x, y, 8 + (i % 3) * 4, 4, i % 2 ? palette.land : palette.earth);
  }
  const arch = scene.architecture;
  if (arch === "fortress" || arch === "stone" || arch === "loguetown") {
    box(ctx, 246, 126, 138, 107, "#56636a");
    box(ctx, 258, 133, 111, 99, "#a1ada9");
    for (let x = 250; x < 379; x += 22) box(ctx, x, 112, 14, 18, "#68777c");
    for (let y = 145; y < 218; y += 22) box(ctx, 263, y, 102, 3, "#82918e");
    box(ctx, 300, 75, 35, 80, "#7b898c");
    box(ctx, 314, 54, 4, 25, "#513c31");
    box(ctx, 318, 55, 24, 11, "#f4b41a");
    box(ctx, 300, 180, 34, 52, "#3e5055");
    if (arch === "loguetown") {
      box(ctx, 275, 198, 84, 9, "#b8b2a1");
      box(ctx, 289, 185, 11, 13, "#4a443e");
      box(ctx, 336, 185, 11, 13, "#4a443e");
    }
  } else if (arch === "baratie") {
    box(ctx, 230, 215, 180, 25, "#6f4938");
    box(ctx, 245, 193, 145, 24, "#b28251");
    house(ctx, 280, 116, "#4e7984", "#d9bd80");
    box(ctx, 205, 198, 40, 10, "#e1b06d");
    box(ctx, 192, 188, 18, 28, "#e1b06d");
  } else if (arch === "arlong" || island.id === "wano") {
    house(ctx, 275, 136, "#ab4739", "#5a8b93");
    box(ctx, 261, 160, 104, 7, "#b24438");
    box(ctx, 278, 143, 70, 7, "#d96748");
    tree(ctx, 420, 180, "#508e55", true);
  } else {
    house(ctx, 280, 135, arch === "sky" ? "#d9cba4" : "#b85a41", "#e7d09c");
    if (arch === "foosha") {
      box(ctx, 401, 139, 16, 90, "#ad8058");
      box(ctx, 381, 157, 56, 6, "#e6d3a6");
      box(ctx, 406, 132, 6, 55, "#e6d3a6");
    } else tree(ctx, 405, 180, "#4c8d60", true);
  }
  tree(ctx, 160, 184, scene.theme === "snow" ? "#a5c1b6" : "#467d55");
  tree(ctx, 505, 178, scene.theme === "snow" ? "#a5c1b6" : "#518b5b");
  box(ctx, 56, 284, 160, 14, "#845b3b");
  box(ctx, 64, 297, 9, 34, "#69432f");
  box(ctx, 195, 297, 9, 34, "#69432f");
  if (character) drawPixelAvatar(ctx, character.appearance, { x: 87, y: 255, scale: 1.15 });
  box(ctx, 457, 218, 27, 16, "#6c3e2d");
  box(ctx, 459, 211, 23, 8, "#bc8641");
  box(ctx, 467, 220, 5, 6, "#f4b41a");
  if (scene.options.includes("poneglyph")) {
    box(ctx, 508, 180, 36, 48, "#385b72");
    box(ctx, 513, 186, 26, 35, "#557f92");
    for (let i = 0; i < 5; i++) box(ctx, 517 + i % 2 * 4, 190 + i * 6, 12, 2, "#b4d7d2");
  }
  box(ctx, 0, 358, 640, 42, "#255e70");
  for (let x = 0; x < 640; x += 60) box(ctx, x + (seed % 23), 370 + x % 13, 30, 3, "#67a9ad");
}
