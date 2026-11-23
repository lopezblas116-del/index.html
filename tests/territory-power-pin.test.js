import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter, performAction } from "../src/game.js";
import { marketPrices, trade } from "../src/combat_economy.js";
import { ensureBlockOneData, evaluateContract, resolvePortContracts } from "../src/block1.js";
import { advanceLocalWorld, applyLocalAction, claimLocalSovereignty, createLocalWorld, isPortBlockaded, startNavalBlockade } from "../src/geopolitics.js";
import { hasLocalGMPin, setLocalGMPin, verifyLocalGMPin } from "../src/gm_engine.js";
import { createNetwork } from "../src/network.js";
import { avatarScenePosition } from "../src/map.js";
import { createHakiProfile, ensureHakiProfile } from "../src/power_systems.js";
import { raceTreatmentAtPort } from "../src/race_system.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    values
  };
}

test("local sovereignty sets a bounded port tax and rejects a different owner", () => {
  const world = createLocalWorld();
  const captain = createCharacter({ name: "Capitana", originSea: "East Blue" });
  captain.location.island = "Isla Dawn";
  const claim = claimLocalSovereignty(world, captain, "dawn", 15);
  assert.equal(claim.ok, true);
  assert.equal(claim.island.tax_rate, 15);
  assert.equal(claimLocalSovereignty(world, { ...captain, id: "another" }, "dawn", 5).ok, false);
  assert.equal(claimLocalSovereignty(world, captain, "dawn", 21).ok, false);
});

test("mission victories claim sovereignty, set port tax, and imprison that island's boss", () => {
  const world = createLocalWorld();
  const actor = { id: "captain", name: "Capitana" };
  applyLocalAction(world, { event_id: "shells-victory", type: "mission", data: { island: "Shells Town", faction: "Pirata", level: 4, crewSize: 1 } }, actor);
  const island = world.islands_control.find((entry) => entry.island_id === "shells");
  assert.equal(island.owner_id, actor.id);
  assert.equal(island.tax_rate, 5);
  assert.equal(island.defense_level, 44);
  assert.equal(world.bosses.find((boss) => boss.island_id === "shells").status, "imprisoned");
});

test("periodic naval invasions can be resisted or capture a weakly defended island", () => {
  const resistedWorld = createLocalWorld();
  const resistedIsland = resistedWorld.islands_control.find((entry) => entry.island_id === "dawn");
  Object.assign(resistedIsland, { owner_id: "captain", owner_name: "Capitana", defense_level: 70 });
  let rolls = [0, 0, 0];
  advanceLocalWorld(resistedWorld, 1, () => rolls.shift() ?? 1);
  assert.equal(resistedIsland.owner_id, "captain");
  assert.match(resistedWorld.global_events[0].text, /defendió el puerto/);

  const lostWorld = createLocalWorld();
  const lostIsland = lostWorld.islands_control.find((entry) => entry.island_id === "dawn");
  Object.assign(lostIsland, { owner_id: "captain", owner_name: "Capitana", defense_level: 0 });
  rolls = [0, 0, 0.99];
  advanceLocalWorld(lostWorld, 1, () => rolls.shift() ?? 1);
  assert.equal(lostIsland.owner_id, null);
  assert.equal(lostIsland.faction, "Marina");
  assert.match(lostWorld.global_events[0].text, /arrebató Isla Dawn/);
});

test("crossing the Red Line requires level, Haki, or crew preparation", () => {
  const captain = createCharacter({ name: "Navegante", originSea: "East Blue" });
  captain.ship = { model: "Carabela de pruebas", acquired: true, health: 100 }; // sin barco el mar no suelta amarras
  captain.location.routeIndex = 6;
  captain.location.island = "Reverse Mountain";
  captain.mission.status = "complete";
  const originalRandom = Math.random;
  Math.random = () => 0.9; // sin deriva: el test mide el gate de preparación, no el azar
  try {
    const blocked = performAction(captain, "navigate");
    assert.match(blocked, /preparación/);
    assert.equal(captain.location.routeIndex, 6);
    captain.level = 3;
    performAction(captain, "navigate");
    assert.equal(captain.location.routeIndex, 7);
  } finally {
    Math.random = originalRandom;
  }
});

test("local market taxes are assessed only after a purchase can be paid", () => {
  const world = createLocalWorld();
  const captain = createCharacter({ name: "Capitana", originSea: "East Blue" });
  captain.location.island = "Isla Dawn";
  const island = world.islands_control.find((entry) => entry.island_id === "dawn");
  island.owner_id = "another";
  island.tax_rate = 20;
  const gross = marketPrices(captain).wood.buy;
  captain.berries = gross + Math.floor(gross * 0.2) - 1;
  assert.equal(trade(captain, "wood", "buy", world).ok, false);
  assert.equal(island.treasury, 0);
  captain.berries += 1;
  const result = trade(captain, "wood", "buy", world);
  assert.equal(result.ok, true);
  assert.equal(island.treasury, Math.floor(gross * 0.2));
  assert.equal(captain.berries, 0);
});

test("completed port contracts pay the island tax into the local treasury", () => {
  const world = createLocalWorld();
  const captain = createCharacter({ name: "Capitana", originSea: "East Blue", traits: ["Valiente", "Leal"] });
  ensureBlockOneData(captain);
  assert.equal(evaluateContract(captain, captain.availableContracts[0], "accept"), true);
  captain.location.island = "Orange Town";
  const island = world.islands_control.find((entry) => entry.island_id === "orange");
  island.owner_id = "another";
  island.tax_rate = 20;
  const reward = captain.activeContracts[0].reward;
  resolvePortContracts(captain, "Isla Dawn", world);
  assert.equal(captain.activeContracts[0].status, "completed");
  assert.equal(captain.berries, 100 + reward - Math.floor(reward * 0.2));
  assert.equal(island.treasury, Math.floor(reward * 0.2));
});

test("naval blockade requires nearby open water and expires after its duration", () => {
  const world = createLocalWorld();
  const captain = createCharacter({ name: "Navegante", originSea: "East Blue" });
  captain.location.atSea = true;
  captain.mapPosition = { x: 190, y: 170 };
  captain.berries = 500;
  const result = startNavalBlockade(world, captain, "dawn", { durationDays: 1, day: 4 });
  assert.equal(result.ok, true);
  assert.equal(isPortBlockaded(world, "dawn", 4, "opponent"), true);
  assert.equal(isPortBlockaded(world, "dawn", 4, captain.id), false);
  assert.equal(isPortBlockaded(world, "dawn", 5, "opponent"), false);
});

test("territorial fields persist on reload and race port treatment is explicit", () => {
  const storage = memoryStorage();
  const network = createNetwork({ config: {}, storage });
  network.mutateLocalWorld((world) => {
    const island = world.islands_control.find((entry) => entry.island_id === "dawn");
    island.owner_id = "captain";
    island.tax_rate = 10;
    island.treasury = 45;
    return true;
  });
  const reloaded = createNetwork({ config: {}, storage }).snapshot().world.islands_control.find((entry) => entry.island_id === "dawn");
  assert.equal(reloaded.tax_rate, 10);
  assert.equal(reloaded.treasury, 45);
  assert.equal(raceTreatmentAtPort("threeeye", { segregated: true }).status, "segregated");
  assert.equal(raceTreatmentAtPort("human", { segregated: true }).portPriceModifier, 1);
});

test("legacy local-world saves gain territorial defaults without losing ownership", () => {
  const storage = memoryStorage();
  const legacy = createLocalWorld();
  const dawn = legacy.islands_control.find((entry) => entry.island_id === "dawn");
  dawn.owner_id = "captain";
  delete dawn.tax_rate;
  delete dawn.treasury;
  delete dawn.blockade_until_day;
  storage.setItem("one-latam-local-world", JSON.stringify(legacy));
  const migrated = createNetwork({ config: {}, storage }).snapshot().world.islands_control.find((entry) => entry.island_id === "dawn");
  assert.equal(migrated.owner_id, "captain");
  assert.equal(migrated.tax_rate, 0);
  assert.equal(migrated.treasury, 0);
  assert.equal(migrated.blockade_until_day, 0);
});

test("legacy local-world saves gain new bosses and defense values non-destructively", () => {
  const storage = memoryStorage();
  const legacy = createLocalWorld();
  const dawn = legacy.islands_control.find((entry) => entry.island_id === "dawn");
  dawn.owner_id = "captain";
  dawn.defense_level = 48;
  delete dawn.defense_level;
  legacy.bosses = [legacy.bosses[0]];
  legacy.bosses[0].status = "imprisoned";
  storage.setItem("one-latam-local-world", JSON.stringify(legacy));
  const migrated = createNetwork({ config: {}, storage }).snapshot().world;
  assert.equal(migrated.islands_control.find((entry) => entry.island_id === "dawn").owner_id, "captain");
  assert.equal(migrated.islands_control.find((entry) => entry.island_id === "dawn").defense_level, 0);
  assert.equal(migrated.bosses.find((boss) => boss.name === "Arlong").status, "imprisoned");
  assert.ok(migrated.bosses.some((boss) => boss.name === "Capitán Morgan"));
});

test("local activity keeps the avatar at its saved venue and power facades preserve Haki state", () => {
  const saved = { x: 515, y: 125 };
  assert.deepEqual(avatarScenePosition("shells", "captain", "resting", saved), saved);
  const haki = createHakiProfile(true);
  haki.kenbunshoku = true;
  assert.deepEqual(ensureHakiProfile(haki), { ...haki });
  assert.equal(ensureHakiProfile({}).haoshoku, false);
});

test("local GM PIN stores a salted digest and verifies without storing the PIN", async () => {
  const storage = memoryStorage();
  assert.equal((await setLocalGMPin("12", storage)).ok, false);
  assert.equal((await setLocalGMPin("4826", storage)).ok, true);
  assert.equal(hasLocalGMPin(storage), true);
  const stored = JSON.stringify([...storage.values.values()]);
  assert.equal(stored.includes("4826"), false);
  assert.equal(await verifyLocalGMPin("0000", storage), false);
  assert.equal(await verifyLocalGMPin("4826", storage), true);
});
