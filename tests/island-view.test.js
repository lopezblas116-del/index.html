import test from "node:test";
import assert from "node:assert/strict";
import { getMapIslands } from "../src/map.js";
import { ISLAND_DATA } from "../src/islands_data.js";
import { drawIslandScene } from "../src/island_renderer.js";

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
