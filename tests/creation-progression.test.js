import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter, createHeir, performAction, routeFor } from "../src/game.js";
import { generateRandomOrigin, inferLatentTrait, isBiographyValid, rollCreationRace } from "../src/character_creation.js";
import { ensureAdvancedSystems, getTavernCandidates, hasNauticalCrew, performDockyardAction, tavernAction } from "../src/systems.js";
import { chooseAutonomousAction } from "../src/ai_engine.js";
import { advanceLocalWorld, createLocalWorld } from "../src/geopolitics.js";

test("the optional race roll preserves the 94/6 human-to-exotic odds", () => {
  let calls = 0;
  assert.equal(rollCreationRace(() => [0.939, 0.5][calls++]), "human");
  calls = 0;
  assert.notEqual(rollCreationRace(() => [0.94, 0.5][calls++]), "human");
});

test("new characters receive a random race and sea at launch", () => {
  const commonOrigin = generateRandomOrigin(() => 0);
  assert.deepEqual(commonOrigin, { race: "human", originSea: "East Blue", allowRareRace: false });

  const rareOrigin = generateRandomOrigin(() => 0.999);
  assert.equal(rareOrigin.race, "lunarian");
  assert.equal(rareOrigin.originSea, "North Blue");
  assert.equal(rareOrigin.allowRareRace, true);
});

test("biography keywords assign private behavioral traits", () => {
  assert.equal(inferLatentTrait("La Marina ejecutó a mi hermano; buscaré venganza."), "Rencoroso_Marina");
  assert.equal(inferLatentTrait("Crecí huérfana en los muelles."), "Desconfiado");
  assert.equal(inferLatentTrait("Sueño con encontrar oro."), "Codicioso");
  assert.equal(inferLatentTrait("Aprendí a leer las mareas."), null);
  const captain = createCharacter({ name: "Náufraga", story: "La Marina ejecutó a mi hermano; buscaré venganza." });
  assert.equal(captain.soulCard.latentTrait, "Rencoroso_Marina");
  assert.equal(createCharacter({ name: "Cronista", story: "x".repeat(300) }).story.length, 280);
});

test("a new avatar biography must contain non-whitespace text of at most 280 characters", () => {
  assert.equal(isBiographyValid(""), false);
  assert.equal(isBiographyValid(" \n\t "), false);
  assert.equal(isBiographyValid("a".repeat(280)), true);
  assert.equal(isBiographyValid("a".repeat(281)), false);
  assert.equal(isBiographyValid(null), false);
});

test("new-game starters must earn a ship and recruit a nautical crewmate before sailing", () => {
  const captain = createCharacter({ name: "Capitana", originSea: "East Blue", starterChallenge: true });
  ensureAdvancedSystems(captain);
  const routeIndex = captain.location.routeIndex;
  assert.equal(captain.ship.acquired, false);
  assert.notEqual(chooseAutonomousAction(captain, () => 0), "navigate");
  assert.match(performAction(captain, "navigate"), /conseguir primero un barco/i);
  assert.equal(captain.location.routeIndex, routeIndex);

  for (let i = 0; i < 3; i++) assert.equal(performDockyardAction(captain, "work").ok, true);
  assert.equal(performDockyardAction(captain, "purchase").ok, true);
  assert.equal(captain.ship.acquired, true);
  assert.equal(hasNauticalCrew(captain), false);
  assert.notEqual(chooseAutonomousAction(captain, () => 0), "navigate");
  assert.match(performAction(captain, "navigate"), /reclutar al menos un navegante o carpintero/i);

  const navigator = getTavernCandidates(captain).find((visitor) => visitor.role === "Navegante");
  assert.ok(navigator);
  navigator.loyalty = 60;
  captain.berries = 75;
  assert.equal(tavernAction(captain, navigator.id, "recruit").ok, true);
  assert.equal(hasNauticalCrew(captain), true);
  assert.equal(chooseAutonomousAction(captain, () => 0), "navigate");
  assert.match(performAction(captain, "navigate"), /Log Pose/i);
});

test("starter ships can also be crafted from materials or stolen with a bounded risk", () => {
  const builder = createCharacter({ name: "Carpintera", starterChallenge: true });
  ensureAdvancedSystems(builder);
  performDockyardAction(builder, "gather", () => 0);
  performDockyardAction(builder, "gather", () => 0);
  builder.berries = 120;
  assert.equal(performDockyardAction(builder, "craft").ok, true);
  assert.equal(builder.ship.model, "chalupa");
  assert.equal(builder.inventory.timber, 1);

  const thief = createCharacter({ name: "Ladrona", starterChallenge: true });
  ensureAdvancedSystems(thief);
  const health = thief.stats.health;
  assert.equal(performDockyardAction(thief, "steal", () => 0.99).ok, false);
  assert.equal(thief.ship.acquired, false);
  assert.ok(thief.stats.health < health);
  assert.equal(thief.bounty, 5000);
  assert.equal(performDockyardAction(thief, "steal", () => 0).ok, true);
  assert.equal(thief.ship.acquired, true);
});

test("legacy ship saves remain usable and heirs retain the starter progression state", () => {
  const legacy = createCharacter({ name: "Veterana" });
  delete legacy.ship.acquired;
  ensureAdvancedSystems(legacy);
  assert.equal(legacy.ship.acquired, true);

  const predecessor = createCharacter({ name: "Náufrago", starterChallenge: true });
  predecessor.status = "dead";
  predecessor.ship.acquired = false;
  const heir = createHeir(predecessor, { name: "Heredera" });
  assert.equal(heir.starterChallenge, true);
  assert.equal(heir.ship.acquired, false);
});

test("surviving a critical Grand Line battle awakens Conqueror Haki and advances fruit mastery", () => {
  const captain = createCharacter({ name: "Marinera", faction: "Marine", race: "fishman", originSea: "East Blue" });
  const reverseMountain = routeFor(captain.originSea).indexOf("Reverse Mountain");
  assert.ok(reverseMountain >= 0);
  captain.location.routeIndex = reverseMountain;
  captain.mission.status = "active";
  captain.stats.strength = 2000;
  captain.stats.agility = 1;
  captain.stats.health = 10;
  captain.level = 50;
  captain.fruit = { id: "test-fruit", name: "Fruta de prueba", bonus: 0 };

  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    for (let battle = 0; battle < 3; battle++) {
      captain.stats.health = 10;
      captain.mission.status = "active";
      captain.logPose.alignment = 0;
      performAction(captain, "navigate");
      performAction(captain, "navigate");
      performAction(captain, "navigate");
    }
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(captain.haki.haoshoku, true);
  assert.equal(captain.fruit.masteryLevel, 2);
  assert.equal(captain.fruit.masteryPoints, 0);
  assert.equal(captain.fruit.bonus, 2);
});

test("escaped bosses travel visibly to their island before attempting a reconquest", () => {
  const world = createLocalWorld();
  const boss = world.bosses.find((entry) => entry.island_id === "arlong");
  const island = world.islands_control.find((entry) => entry.island_id === "arlong");
  world.bosses = [boss];
  world.islands_control = [island];
  island.owner_id = "captain";
  island.owner_name = "Capitana";
  boss.status = "imprisoned";

  advanceLocalWorld(world, 1, () => 0);
  assert.equal(boss.status, "fugitive");
  assert.equal(boss.travel.progress, 0);
  assert.equal(boss.travel.arrived, false);
  advanceLocalWorld(world, 2, () => 0);
  assert.equal(boss.travel.progress, 0.5);
  assert.equal(boss.status, "fugitive");
  advanceLocalWorld(world, 3, () => 0);
  assert.equal(boss.travel.arrived, true);
  assert.equal(boss.status, "fugitive");
  assert.match(world.global_events.find((event) => event.type === "boss_arrival").text, /asedio/i);
  advanceLocalWorld(world, 4, () => 0);
  assert.equal(boss.status, "active");
  assert.equal(island.owner_id, null);
});
