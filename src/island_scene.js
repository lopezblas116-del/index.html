const PALETTES = {
  green: { sky: "#659fae", mountain: "#577e74", land: "#6d9d5a", light: "#add17c", earth: "#77523d" },
  sky: { sky: "#6aa8ca", mountain: "#c5e1e3", land: "#91bd72", light: "#d0e7aa", earth: "#b1d3d4" },
  snow: { sky: "#688da4", mountain: "#a7bdc8", land: "#d9e8e4", light: "#f4f4dd", earth: "#879ca7" },
  desert: { sky: "#b88b68", mountain: "#ad7750", land: "#d7b87b", light: "#f0d99c", earth: "#986749" },
  volcanic: { sky: "#6c7888", mountain: "#574b54", land: "#74645a", light: "#aa8060", earth: "#473c3d" },
  stone: { sky: "#7297a1", mountain: "#869a9d", land: "#9dad9d", light: "#c7cfba", earth: "#6e7670" }
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

export function drawIslandScene(canvas, island, character) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo inicializar la vista de isla.");
  const scene = island.localScene;
  const p = PALETTES[scene.theme] || PALETTES.green;
  const seed = scene.seed;
  ctx.imageSmoothingEnabled = false;
  box(ctx, 0, 0, 640, 400, p.sky);
  box(ctx, 0, 182, 640, 218, "#397d8d");
  for (let i = 0; i < 12; i++) {
    const x = (seed + i * 137) % 640, y = 185 + (i * 43) % 155;
    box(ctx, x, y, 35, 3, "#71afaf");
  }
  for (let i = 0; i < 4; i++) {
    const x = (seed + i * 179) % 660 - 40;
    box(ctx, x, 165, 100, 30, p.mountain);
    box(ctx, x + 15, 150, 70, 20, p.mountain);
    box(ctx, x + 34, 138, 30, 20, p.mountain);
  }
  box(ctx, 35, 235, 570, 123, p.earth);
  box(ctx, 58, 220, 524, 30, p.land);
  box(ctx, 35, 242, 570, 18, p.land);
  box(ctx, 55, 220, 526, 5, p.light);
  for (let i = 0; i < 34; i++) {
    const x = 43 + ((seed + i * 83) % 545), y = 263 + ((seed >>> (i % 16)) + i * 19) % 81;
    box(ctx, x, y, 8 + (i % 3) * 4, 4, i % 2 ? p.land : p.earth);
  }
  const arch = scene.architecture;
  if (arch === "fortress" || arch === "stone" || arch === "loguetown") {
    box(ctx, 250, 122, 130, 111, "#68777c");
    box(ctx, 264, 133, 102, 99, "#a1ada9");
    for (let x = 258; x < 370; x += 22) box(ctx, x, 112, 14, 18, "#68777c");
    box(ctx, 300, 75, 35, 80, "#7b898c");
    box(ctx, 314, 54, 4, 25, "#513c31");
    box(ctx, 318, 55, 24, 11, "#f4b41a");
    box(ctx, 300, 180, 34, 52, "#3e5055");
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
  if (character) {
    box(ctx, 98, 276, 12, 16, "#4b3631");
    box(ctx, 94, 268, 20, 10, character.appearance?.skin === "Oscura" ? "#754b35" : "#dfb18a");
    box(ctx, 93, 264, 22, 5, "#3b2826");
    box(ctx, 94, 280, 20, 11, "#c65f4c");
  }
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
