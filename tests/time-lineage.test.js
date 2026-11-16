import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter, createHeir, PULSE_MS, resolveAutonomousBranch, resolveBranch, setAutonomyPaused, simulateOffline } from "../src/game.js";
import { ensureBlockOneData } from "../src/block1.js";
import { advanceAdvancedSystems, ensureAdvancedSystems } from "../src/systems.js";
import { advanceLocalWorld, applyLocalAction, createLocalWorld } from "../src/geopolitics.js";
import { createNetwork } from "../src/network.js";
import { getMapIslands } from "../src/map.js";

function captain() {
  const c = createCharacter({ name: "Ana Marea", originSea: "East Blue", traits: ["Valiente", "Leal"] });
  ensureBlockOneData(c);
  ensureAdvancedSystems(c);
  return c;
}

test("new captains spawn at the mapped starting port in each sea", () => {
  for (const sea of ["East Blue", "West Blue", "North Blue", "South Blue"]) {
    const character = createCharacter({ name: "Navegante", originSea: sea });
    const island = getMapIslands(character).find((item) => item.name === character.location.island);
    assert.ok(island, `Missing starting port for ${sea}`);
    assert.deepEqual(character.mapPosition, { x: island.x, y: island.y });
  }
});

test("the 1:4 clock retains fractions between saves and rolls over at midnight", () => {
  const c = captain();
  c.autonomy.lastSavedAt = 100_000;
  const original = Math.random;
  try {
    Math.random = () => 0.99;
    assert.equal(simulateOffline(c, 100_000 + 11 * PULSE_MS + 40_000).ticks, 11);
    c.autonomy.lastSavedAt = 100_000 + 11 * PULSE_MS + 40_000;
    assert.equal(simulateOffline(c, 100_000 + 12 * PULSE_MS).ticks, 1);
    assert.equal(c.world.minuteOfDay, 60);
    assert.equal(c.world.day, 0);
    c.world.minuteOfDay = 1435;
    simulateOffline(c, 100_000 + 13 * PULSE_MS);
    assert.equal(c.world.minuteOfDay, 0);
    assert.equal(c.world.day, 1);
  } finally { Math.random = original; }
});

test("hidden traits emerge under pressure and heirs retain memory without inheriting bounty", () => {
  const c = captain();
  const hidden = c.soulCard.latentTrait;
  assert.ok(hidden);
  assert.deepEqual(c.soulCard.traits.cons, []);
  c.stats.health = 20;
  advanceAdvancedSystems(c);
  assert.equal(c.soulCard.latentTrait, null);
  assert.ok(c.soulCard.traits.cons.includes(hidden));
  assert.ok(c.log.some((entry) => entry.message.includes("rasgo latente")));
  c.status = "dead";
  c.reputation = 1000;
  const heir = createHeir(c);
  assert.equal(heir.lineage.family, "Marea");
  assert.equal(heir.lineage.inheritedReputation, 300);
  assert.equal(heir.bounty, 0);
  assert.equal(heir.reputation, 0);
});

test("branch decisions resolve once, and offline behavior follows personality", () => {
  const c = captain();
  c.autonomy.pendingBranch = { kind: "castaways", deadline: 200_000 };
  assert.equal(resolveBranch(c, "unknown"), false);
  assert.equal(resolveBranch(c, "pass"), true);
  assert.equal(resolveBranch(c, "help"), false);
  c.autonomy.pendingBranch = { kind: "castaways", deadline: 200_000 };
  const water = c.inventory.water;
  assert.equal(resolveAutonomousBranch(c), true);
  assert.equal(c.inventory.water, water - 1);
});

test("pausing preserves the partial pulse without counting paused time", () => {
  const c = captain();
  const original = Date.now;
  try {
    c.autonomy.lastPulseAt = 100_000;
    Date.now = () => 130_000;
    setAutonomyPaused(c, true);
    Date.now = () => 500_000;
    setAutonomyPaused(c, false);
    assert.equal(c.autonomy.lastPulseAt, 470_000);
    assert.equal(simulateOffline(c, 514_999).ticks, 0);
    assert.equal(simulateOffline(c, 545_000).ticks, 1);
  } finally { Date.now = original; }
});

test("local boss escapes persist and can be found and recaptured", async () => {
  const world = createLocalWorld();
  world.bosses[0].status = "imprisoned";
  assert.equal(advanceLocalWorld(world, 1, () => 0), true);
  assert.equal(world.bosses[0].status, "fugitive");
  assert.match(world.global_events[0].text, /escapó/);
  applyLocalAction(world, { event_id: "recapture", type: "boss_defeated", data: { boss: "Arlong", x: 0, y: 0 } }, { id: "c", name: "Ana" });
  assert.equal(world.bosses[0].status, "imprisoned");
  const data = new Map();
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  const net = createNetwork({ config: {}, storage });
  net.publish("mission", { island: "Arlong Park", faction: "Pirata" }, { id: "c", name: "Ana" });
  const resumed = createNetwork({ config: {}, storage });
  assert.equal(resumed.snapshot().world.bosses[0].status, "imprisoned");
  assert.equal(await resumed.scout(0, 0), null);
});
