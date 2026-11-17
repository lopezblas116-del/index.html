import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter, createHeir, performAction } from "../src/game.js";
import { ensureBlockOneData } from "../src/block1.js";
import { marketPrices, seaEncounter, trade } from "../src/combat_economy.js";
import {
  climateFor, discoverAtSea, draftTestament, ensureAdvancedSystems,
  getTavernCandidates, suggestNavigation, tavernAction, updateCrewLoyalty
} from "../src/systems.js";
import { proceduralLore } from "../src/world_lore.js";

function character(options = {}) {
  const c = createCharacter({ name: "Prueba", traits: ["Valiente", "Leal"], ...options });
  ensureBlockOneData(c);
  ensureAdvancedSystems(c);
  c.soulCard.traits.cons = [];
  return c;
}

test("alignment migrates and route suggestions can be accepted or refused", () => {
  const generated = createCharacter({ name: "Rasgos", traits: ["Valiente", "Astuto"] });
  assert.equal(generated.soulCard.traits.cons.length, 0);
  assert.ok(!generated.soulCard.traits.pros.includes(generated.soulCard.latentTrait));
  const c = character({ alignment: "Justicia" });
  assert.equal(c.soulCard.alignment, "Justicia");
  delete c.soulCard.alignment;
  ensureAdvancedSystems(c);
  assert.equal(c.soulCard.alignment, "Libertad");
  const destination = { x: 100, y: 200, name: "Mar abierto" };
  assert.equal(suggestNavigation(c, destination, () => 1).accepted, false);
  assert.equal(c.redirectTarget, undefined);
  assert.equal(suggestNavigation(c, { x: -1, y: 0 }, () => 0).ok, false);
  assert.equal(suggestNavigation(c, destination, () => 0).accepted, true);
  const random = Math.random;
  try {
    Math.random = () => 0.99;
    performAction(c, "navigate");
  } finally { Math.random = random; }
  assert.deepEqual(c.mapPosition, { x: 100, y: 200 });
  assert.equal(c.location.atSea, true);
  assert.equal(c.travel.docked, false);
  assert.equal(c.redirectTarget, undefined);
});

test("secret clues and death coordinates survive in the heir's testament", () => {
  const c = character({ alignment: "Justicia" });
  c.location.atSea = true;
  c.mapPosition = { x: 411, y: 250 };
  draftTestament(c);
  const discovery = discoverAtSea(c, () => 0);
  assert.match(c.log[0].message, /^\[MISTERIO\]/);
  assert.ok(c.inventory.items.includes(discovery.item));
  assert.match(c.systems.testament.text, /X:411 Y:250/);
  assert.equal(discoverAtSea(c, () => 0), null);
  c.stats.health = 1;
  c.redirectTarget = { x: 420, y: 250 };
  const random = Math.random;
  try {
    Math.random = () => 0;
    performAction(c, "navigate");
  } finally { Math.random = random; }
  assert.equal(c.status, "dead");
  assert.equal(c.world.pantheon[0].name, c.name);
  const deathMap = c.systems.treasureMaps.find((entry) => entry.reason === "muerte");
  assert.deepEqual([deathMap.x, deathMap.y], [420, 250]);
  const heir = createHeir(c);
  assert.equal(heir.systems.discoveries[0].clue, discovery.clue);
  assert.match(heir.systems.testament.text, /X:411 Y:250/);
  assert.equal(heir.systems.treasureMaps[0].x, 420);
});

test("combat respects prudence and awards loot and wanted posters", () => {
  const cautious = character({ traits: ["Prudente", "Leal"] });
  cautious.stats.health = 29;
  assert.equal(seaEncounter(cautious, () => 0).fled, true);
  assert.equal(cautious.stats.health, 29);
  const bold = character({ traits: ["Impulsivo", "Leal"] });
  bold.stats.strength = 50;
  const result = seaEncounter(bold, () => 0);
  assert.equal(result.won, true);
  assert.ok(bold.inventory.items.includes(result.booty));
  assert.equal(bold.bounty, 2000);
  assert.equal(bold.world.news[0].type, "bounty");
});

test("market transactions enforce port, funds, inventory and priority", () => {
  const c = character();
  const price = marketPrices(c).wood;
  assert.equal(trade(c, "wood", "buy").ok, true);
  assert.equal(c.berries, 100 - price.buy);
  c.whisper.priorityItems.push({ kind: "item", name: "Madera" });
  assert.equal(trade(c, "wood", "sell").ok, false);
  c.whisper.priorityItems = [];
  assert.equal(trade(c, "wood", "sell").ok, true);
  assert.equal(c.berries, 100 - price.buy + price.sell);
  assert.equal(trade(c, "wood", "sell").ok, false);
  assert.equal(trade(c, "toString", "buy").ok, false);
  c.location.atSea = true;
  assert.equal(trade(c, "water", "buy").ok, false);
});

test("crew recruitment, abandonment, and Calm Belt supplies", () => {
  const c = character();
  c.berries = 500;
  const visitor = getTavernCandidates(c)[0];
  assert.ok(visitor.attributes.ingenuity >= 3);
  assert.equal(tavernAction(c, visitor.id, "round").ok, true);
  assert.equal(tavernAction(c, visitor.id, "recruit").ok, true);
  c.crew[0].loyalty = 20;
  updateCrewLoyalty(c, true, () => 0);
  assert.equal(c.crew.length, 0);
  assert.match(c.log[0].message, /abandona/);
  c.redirectTarget = { x: 400, y: 322 };
  const random = Math.random;
  try {
    Math.random = () => 0.99;
    performAction(c, "navigate");
  } finally { Math.random = random; }
  assert.equal(climateFor(c), "calm-belt");
  assert.deepEqual(c.travel.lastSuppliesUsed, { food: 1, water: 2 });
  assert.equal(c.travel.speedMultiplier, 0.5);
});

test("unmapped regions receive a stable procedural climate instead of a generic default", () => {
  const c = character();
  c.location.region = "Archipiélago de la Bruma";
  c.location.island = "Puerto Bruma";
  c.location.atSea = false;
  assert.equal(climateFor(c), proceduralLore("Puerto Bruma").climate);
});
