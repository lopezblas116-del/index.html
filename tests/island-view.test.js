import test from "node:test";
import assert from "node:assert/strict";
import { getMapIslands } from "../src/map.js";
import { ISLAND_DATA } from "../src/islands_data.js";
import { drawIslandScene, drawIslandSceneContext, drawPixelAvatar, npcAppearanceFor } from "../src/island_renderer.js";

test("each mapped island has its own stable scene and island-specific options", () => {
  const islands = getMapIslands({ id: "captain" });
  assert.equal(new Set(islands.map((island) => island.id)).size, islands.length);
  for (const island of islands) {
    assert.ok(Object.hasOwn(ISLAND_DATA, island.id), `Missing island ${island.id}`);
    assert.ok(island.localScene.options.includes("tavern"));
    assert.ok(Number.isInteger(island.localScene.seed));
    assert.deepEqual(island.localScene, getMapIslands({ id: "captain" }).find((item) => item.id === island.id).localScene);
  }
  assert.equal(islands.find((item) => item.id === "weatheria").localScene.theme, "sky");
  assert.ok(islands.find((item) => item.id === "sabaody").localScene.options.includes("blackmarket"));
  assert.ok(islands.find((item) => item.id === "ohara").localScene.options.includes("poneglyph"));
  assert.ok(!islands.find((item) => item.id === "dawn").localScene.options.includes("blackmarket"));
});

test("requested island venues are loaded from island data with medium-map coordinates", () => {
  const islands = getMapIslands();
  const expected = {
    dawn: ["Taberna de Makino", "Muelle de Partida", "Molino de Viento", "Cabaña de Dadan"],
    shells: ["Base Militar del Capitán Morgan", "Patio de Ejecuciones", "Mercado Urbano"],
    baratie: ["Cubierta Principal", "Cocina de Zeff", "Comedor Flotante"],
    arlong: ["Torre de Arlong", "Plaza Conomi", "Astillero de Gyojins"],
    loguetown: ["Plaza de la Plataforma de Ejecución", "Tienda de Katanas de Ipponmatsu", "Bar Gold Roger"]
  };
  for (const [id, names] of Object.entries(expected)) {
    const points = islands.find((island) => island.id === id).pois;
    assert.deepEqual(points.map((point) => point.name), names);
    assert.ok(points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
  }
});

test("scene renderer uses each island design without changing game state", () => {
  const calls = [];
  const ctx = { fillRect: (...args) => calls.push(args), createLinearGradient: () => ({ addColorStop() {} }) };
  const canvas = { getContext: () => ctx };
  const islands = getMapIslands();
  const character = { appearance: { skin: "Oscura" } };
  const original = structuredClone(character);
  for (const island of islands) drawIslandScene(canvas, island, character);
  assert.deepEqual(character, original);
  assert.ok(calls.length > islands.length * 20);
});

test("remote previews do not draw the avatar at the dock", () => {
  const calls = [];
  const canvas = { getContext: () => ({ fillRect: (...args) => calls.push(args), createLinearGradient: () => ({ addColorStop() {} }) }) };
  const island = getMapIslands().find((item) => item.id === "dawn");
  drawIslandScene(canvas, island, null);
  const previewPixels = calls.length;
  calls.length = 0;
  drawIslandScene(canvas, island, { appearance: { skin: "Oscura" } });
  assert.ok(calls.length > previewPixels, "the docked avatar adds its layered pixel-art sprite");
});

test("fortified Shells Town and Loguetown have distinct city landmarks", () => {
  const islands = getMapIslands();
  const render = (id) => {
    const calls = [];
    const ctx = { fillRect: (...args) => calls.push([ctx.fillStyle, ...args]) };
    drawIslandScene({ getContext: () => ctx }, islands.find((island) => island.id === id), null);
    return calls;
  };
  const shells = render("shells"), loguetown = render("loguetown");
  assert.ok(shells.some(([color, x, y]) => color === "#aab7b2" && x === 305 && y === 13));
  assert.ok(loguetown.some(([color, x, y]) => color === "#73533d" && x === 297 && y === 151));
  assert.notDeepEqual(shells, loguetown);
});

test("full-body sprite adds legs without changing the portrait sprite", () => {
  const calls = [];
  const ctx = { fillRect: (...args) => calls.push(args) };
  drawPixelAvatar(ctx, {}, { fullBody: true });
  assert.ok(calls.some(([x, y, w, h]) => x === 11 && y === 38 && w === 4 && h === 5));
  calls.length = 0;
  drawPixelAvatar(ctx, {});
  assert.ok(!calls.some(([, y]) => y >= 32));
});

test("known NPC portraits are distinct and island names do not impersonate Arlong", () => {
  const portraits = ["Makino", "Capitán Morgan", "Zeff", "Arlong", "Capitán Smoker"].map(npcAppearanceFor);
  assert.deepEqual(portraits.map((portrait) => portrait.portrait), ["makino", "morgan", "zeff", "arlong", "smoker"]);
  assert.equal(npcAppearanceFor("Rumores de Arlong Park"), null);
  const pixels = portraits.map((portrait) => {
    const calls = [];
    const ctx = { fillRect: (...args) => calls.push([ctx.fillStyle, ...args]) };
    drawPixelAvatar(ctx, portrait);
    return JSON.stringify(calls);
  });
  assert.equal(new Set(pixels).size, portraits.length);
});

test("themed NPCs come from island data and walk between frames", () => {
  const islands = getMapIslands();
  for (const [id, names] of [["dawn", ["Makino", "Dadan"]], ["shells", ["Capitán Morgan", "Helmeppo"]], ["baratie", ["Zeff"]], ["arlong", ["Arlong", "Gyojin"]], ["loguetown", ["Capitán Smoker", "Tashigi"]]]) {
    assert.deepEqual(islands.find((item) => item.id === id).npcs.map((npc) => npc.name), names);
  }
  const island = islands.find((item) => item.id === "dawn");
  const render = (time) => {
    const labels = [];
    const ctx = { fillRect() {}, fillText: (...args) => labels.push(args) };
    drawIslandSceneContext(ctx, island, null, time);
    return labels;
  };
  assert.notEqual(render(0)[0][1], render(1000)[0][1]);
});
