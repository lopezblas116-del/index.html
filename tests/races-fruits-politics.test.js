import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter, performAction } from "../src/game.js";
import { createNetwork } from "../src/network.js";
import { createLocalFruitLedger } from "../src/devil_fruits.js";
import { advanceFruitCycle, claimLocalFruit, releaseLocalFruit } from "../src/devil_fruits.js";
import { attackWorldNoble, lootCelestialTribute, maybeCaptureAtAuction, resolveCapture, sabotageTyrantPort } from "../src/politics.js";

function character(options = {}) {
  const c = createCharacter({ name: "Prueba", traits: ["Valiente", "Leal"], ...options });
  c.inventory = { provisions: 3, water: 3, items: [], equipment: [] };
  c.crew = [];
  c.log = [];
  c.world.day = 1;
  return c;
}

test("race selection keeps rare bloodlines hidden and applies human learning", () => {
  assert.equal(character({ race: "lunarian" }).race, "human");
  assert.equal(character({ race: "human" }).racialLearning.talentBonus, 0.1);
  assert.equal(character({ race: "giant" }).stats.maxHealth, 140);
  assert.equal(character({ race: "mink" }).stats.agility, 7);
  const giant = character({ race: "giant", originSea: "East Blue" });
  giant.location.routeIndex = 5;
  giant.mission.status = "complete";
  giant.ship.reinforced = false;
  performAction(giant, "navigate");
  assert.equal(giant.location.routeIndex, 5);
});

test("conventional Haki training is locked in the Four Blues and gated by Grand Line survival", () => {
  const c = character({ originSea: "East Blue" });
  c.location.routeIndex = 5;
  const random = Math.random;
  try {
    Math.random = () => 0;
    performAction(c, "train");
  } finally { Math.random = random; }
  assert.equal(c.haki.busoshoku, false);
  c.location.routeIndex = 6;
  c.haki.grandLineSince = Date.now() - 31 * 24 * 60 * 60 * 1000;
  c.haki.survivalEvents = 5;
  try {
    Math.random = () => 0;
    performAction(c, "train");
  } finally { Math.random = random; }
  assert.equal(c.haki.busoshoku, true);
});

test("fruit claiming is unique locally and reappears after a later cycle", () => {
  const ledger = createLocalFruitLedger();
  const point = { x: 410, y: 145 };
  const fruit = claimLocalFruit(ledger, "bara-bara", "captain-one", point);
  assert.equal(fruit.name, "Bara Bara no Mi");
  assert.equal(claimLocalFruit(ledger, "bara-bara", "captain-two", point), null);
  assert.equal(releaseLocalFruit(ledger, "bara-bara", "captain-one", 2), true);
  assert.equal(advanceFruitCycle(ledger, 2, () => 0.5), 0);
  assert.equal(advanceFruitCycle(ledger, 3, () => 0.5), 1);
  assert.equal(ledger.find((entry) => entry.id === "bara-bara").state, "wild");
});

test("fruit discovery needs a sea event and an available server fruit", async () => {
  const c = character();
  c.location.atSea = true;
  c.mapPosition = { x: 410, y: 145 };
  const random = Math.random;
  try {
    Math.random = () => 0;
    performAction(c, "searchFruit", { availableFruitIds: ["bara-bara"] });
  } finally { Math.random = random; }
  assert.equal(c.pendingFruit.fruitId, "bara-bara");
  const ledgerNetwork = createNetwork({ storage: null });
  const fruit = await ledgerNetwork.claimFruit("bara-bara", c.id, c.mapPosition);
  assert.equal(fruit.name, "Bara Bara no Mi");
  assert.equal(ledgerNetwork.snapshot().world.devil_fruits[0].state, "owned");
  ledgerNetwork.publish("death", { captain_id: c.id, fruit_id: fruit.id, maps: [], notes: [] }, c);
  assert.equal(ledgerNetwork.snapshot().world.devil_fruits[0].state, "reincarnating");
  ledgerNetwork.advanceCycle(1);
  assert.equal(ledgerNetwork.snapshot().world.devil_fruits[0].state, "wild");
});

test("political actions expose tribute, revolutionary support and global response", () => {
  const c = character({ alignment: "Libertad" });
  const network = createNetwork({ storage: null });
  const world = network.snapshot().world;
  const shells = world.islands_control.find((entry) => entry.island_id === "shells");
  c.location.island = "Shells Town";
  const tribute = lootCelestialTribute(c, world);
  assert.equal(tribute.ok, true);
  assert.equal(shells.chaos, 0);
  network.publish(tribute.type, { island: tribute.island }, c);
  assert.equal(shells.chaos, 100);
  c.location.island = "Orange Town";
  const sabotage = sabotageTyrantPort(c, world);
  assert.equal(sabotage.ok, true);
  network.publish(sabotage.type, { island: sabotage.island, alignment: c.soulCard.alignment }, c);
  assert.equal(world.islands_control.find((entry) => entry.island_id === "orange").chaos, 70);
  assert.equal(c.revolutionarySupport.hideout, true);
  const noble = attackWorldNoble(c, world);
  assert.match(noble.message, /Almirante/);
  assert.equal(c.world.nobleAlert, true);
});

test("non-human captives can be rescued with ransom or crew infiltration", () => {
  const c = character({ race: "fishman" });
  c.location.island = "Archipiélago Sabaody";
  assert.equal(maybeCaptureAtAuction(c, () => 0), true);
  c.berries = 1000;
  assert.equal(resolveCapture(c, "ransom").ok, true);
  c.captured = { island: "Archipiélago Sabaody", ransom: 300 };
  c.crew = [{ name: "Nakama", loyalty: 70 }];
  assert.equal(resolveCapture(c, "infiltrate", () => 0).ok, true);
  assert.equal(c.captured, undefined);
});

test("a fruit user drowning at sea is rescued only by an available crew", () => {
  const c = character();
  c.fruit = { id: "bara-bara", name: "Bara Bara no Mi", swimming: false };
  c.redirectTarget = { x: 500, y: 500 };
  const random = Math.random;
  try {
    Math.random = () => 0.99;
    performAction(c, "navigate");
  } finally { Math.random = random; }
  assert.equal(c.status, "dead");
});
