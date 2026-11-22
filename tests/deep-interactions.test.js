import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter, performAction } from "../src/game.js";
import { ensureBlockOneData, resolvePortSuggestions, suggestChestItem, suggestTraining } from "../src/block1.js";
import { newsLocation } from "../src/map.js";
import { generateTreasureMap } from "../src/systems.js";

function character() {
  const c = createCharacter({ name: "Prueba", originSea: "East Blue", traits: ["Valiente", "Astuto"] });
  ensureBlockOneData(c);
  c.inventory.items.push("Perla");
  return c;
}

test("training consumes energy once, waits for another port, and can be accepted", () => {
  const c = character();
  assert.equal(suggestTraining(c, "agility").ok, true);
  assert.equal(c.whisper.energy, 2);
  assert.equal(suggestTraining(c, "strength").ok, false);
  assert.equal(c.whisper.energy, 2);
  resolvePortSuggestions(c, c.location.island, () => 0);
  assert.equal(c.stats.agility, 5);
  const previous = c.location.island;
  c.location.island = "Orange Town";
  resolvePortSuggestions(c, previous, () => 0);
  assert.equal(c.stats.agility, 6);
  assert.equal(c.whisper.energy, 3);
  assert.equal(c.whisper.trainingSuggestion, undefined);
  c.whisper.energy = 0;
  assert.equal(suggestTraining(c, "strength").ok, false);
});

test("item warnings, sale, refusal and priority are persistent suggestions", () => {
  const c = character();
  const ref = { kind: "item", name: "Perla" };
  c.whisper.rebellion = 61;
  const result = suggestChestItem(c, ref, "sell");
  assert.match(result.message, /desconfía/);
  assert.match(c.log[0].message, /desconfía/);
  assert.equal(suggestChestItem(c, ref, "sell").ok, false);
  assert.equal(suggestChestItem(c, ref, "priority").ok, true);
  assert.equal(c.whisper.itemSuggestions.length, 0);
  assert.equal(suggestChestItem(c, ref, "sell").ok, false);
  const previous = c.location.island;
  c.location.island = "Orange Town";
  resolvePortSuggestions(c, previous, () => 0);
  assert.deepEqual(c.inventory.items, ["Perla"]);

  const other = character();
  assert.equal(suggestChestItem(other, ref, "sell").ok, true);
  other.location.island = "Orange Town";
  resolvePortSuggestions(other, "Isla Dawn", () => 0);
  assert.deepEqual(other.inventory.items, []);
  assert.equal(other.berries, 125);
  const refused = character();
  suggestChestItem(refused, ref, "sell");
  refused.location.island = "Orange Town";
  resolvePortSuggestions(refused, "Isla Dawn", () => 1);
  assert.deepEqual(refused.inventory.items, ["Perla"]);
  assert.equal(refused.whisper.itemSuggestions.length, 0);
  const boundary = character();
  boundary.whisper.rebellion = 60;
  assert.doesNotMatch(suggestChestItem(boundary, ref, "sell").message, /desconfía/);
});

test("an actual navigation arrival resolves port suggestions", () => {
  const c = character();
  suggestTraining(c, "strength");
  c.mission.status = "complete";
  const random = Math.random;
  try {
    Math.random = () => 0;
    performAction(c, "navigate");
  } finally {
    Math.random = random;
  }
  assert.equal(c.location.island, "Orange Town");
  assert.equal(c.stats.strength, 6);
  assert.equal(c.whisper.trainingSuggestion, undefined);
});

test("news locations use real recorded coordinates or known map islands", () => {
  const c = character();
  assert.deepEqual(newsLocation({ text: "Sin ubicación" }, c), null);
  assert.equal(newsLocation({ text: "Noticias cerca de Loguetown" }, c).x, 495);
  assert.equal(newsLocation({ location: "Isla Dawn", text: "Rumbo a Loguetown" }, c).x, 190);
  const map = generateTreasureMap(c);
  const news = c.world.news[0];
  assert.deepEqual(newsLocation(news, c), { x: map.x, y: map.y, name: map.island });
  delete news.coordinates;
  assert.deepEqual(newsLocation(news, c), { x: map.x, y: map.y, name: map.island });
});
