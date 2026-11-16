import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter, createHeir, simulateOffline } from "../src/game.js";
import { ensureBlockOneData, evaluateContract, resolvePortContracts } from "../src/block1.js";
import { ensureAdvancedSystems } from "../src/systems.js";
import { discoverAncient } from "../src/ancient_language.js";
import { applyLocalAction, createLocalWorld } from "../src/geopolitics.js";
import { createNetwork } from "../src/network.js";

function captain() {
  const c = createCharacter({ name: "Prueba", traits: ["Valiente", "Leal"] });
  ensureBlockOneData(c);
  ensureAdvancedSystems(c);
  return c;
}

test("ancient fragments are unique and the heir retains the final route", () => {
  const c = captain();
  c.location.atSea = true;
  for (const point of [{ x: 70, y: 210 }, { x: 440, y: 90 }, { x: 1060, y: 190 }, { x: 840, y: 650 }]) {
    c.mapPosition = point;
    assert.ok(discoverAncient(c, () => 0));
    assert.equal(discoverAncient(c, () => 0), null);
  }
  assert.equal(c.ancientLanguage.knowledge, 100);
  assert.deepEqual(c.ancientLanguage.finalCoordinates, { x: 1130, y: 375, name: "Horizonte velado" });
  c.status = "dead";
  const heir = createHeir(c);
  assert.deepEqual(heir.ancientLanguage, c.ancientLanguage);
  heir.ancientLanguage.fragments.pop();
  assert.equal(c.ancientLanguage.fragments.length, 4);
});

test("offline simulation respects pause, elapsed time and the eight-hour cap", () => {
  const c = captain();
  c.autonomy.lastSavedAt = 100000;
  const random = Math.random;
  try {
    Math.random = () => 0.99;
    assert.equal(simulateOffline(c, 250000).ticks, 2);
    assert.equal(c.world.minuteOfDay, 10);
    c.autonomy.paused = true;
    assert.equal(simulateOffline(c, 325000).ticks, 0);
    c.autonomy.paused = false;
    const result = simulateOffline(c, 250000 + 9 * 3600000);
    assert.equal(result.ticks, 384);
    assert.equal(result.capped, true);
  } finally { Math.random = random; }
});

test("local conquest, Yonkou threshold and Buster Call have distinct outcomes", () => {
  const world = createLocalWorld();
  const actor = { id: "captain", name: "Prueba" };
  let id = 0;
  const action = (type, data) => applyLocalAction(world, { event_id: String(++id), type, data }, actor);
  action("mission", { island: "Isla Dawn", faction: "Pirata" });
  action("bounty", { captain_id: actor.id, bounty: 1_000_000_001 });
  assert.equal(world.bounties_leaderboard[0].yonkou, undefined);
  action("mission", { island: "Orange Town", faction: "Pirata" });
  action("bounty", { captain_id: actor.id, bounty: 1_000_000_001 });
  assert.equal(world.bounties_leaderboard[0].yonkou, true);
  assert.match(world.global_events[0].text, /YONKOU/);
  action("mission", { island: "Orange Town", faction: "Pirata" });
  assert.equal(world.islands_control.find((entry) => entry.name === "Orange Town").faction, "Marina");
  assert.match(world.global_events[0].text, /Buster Call/);
});

test("accepted port contracts finish only on arrival at another port", () => {
  const c = captain();
  const contract = c.availableContracts[0];
  assert.equal(evaluateContract(c, contract, "accept"), true);
  resolvePortContracts(c, "Isla Dawn");
  assert.equal(c.activeContracts[0].status, "accepted");
  c.location.island = "Orange Town";
  c.location.atSea = true;
  resolvePortContracts(c, "Isla Dawn");
  assert.equal(c.activeContracts[0].status, "accepted");
  c.location.atSea = false;
  resolvePortContracts(c, "Isla Dawn");
  assert.equal(c.activeContracts[0].status, "completed");
  assert.equal(c.berries, 100 + contract.reward);
});

test("unconfigured network stays local without network requests", async () => {
  const net = createNetwork({ config: {}, storage: null, fetcher: () => { throw new Error("unexpected request"); } });
  await net.sync();
  assert.equal(net.snapshot().status, "local");
  let updates = 0;
  net.subscribe(() => { updates += 1; });
  net.batch(() => {
    assert.equal(net.publish("whisper", { island: "Isla Dawn" }, { id: "a", name: "Navegante" }).status, "local");
    net.publish("battle", { island: "Isla Dawn" }, { id: "a", name: "Navegante" });
  });
  assert.equal(updates, 2);
  assert.match(net.snapshot().world.global_events[1].text, /susurro/);
});

test("network retries queued actions after an outage without losing the event ID", async () => {
  let online = false;
  const sent = [];
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value) };
  const fetcher = async (url, options) => {
    if (!online) throw new Error("desconectado");
    if (url.includes("/auth/v1/signup")) return { ok: true, status: 200, json: async () => ({ access_token: "test", refresh_token: "refresh", user: { id: "user" }, expires_in: 3600 }) };
    if (url.includes("/rpc/scout_fugitive")) return { ok: true, status: 200, json: async () => "Arlong" };
    if (url.includes("/rpc/")) { sent.push(JSON.parse(options.body).action); return { ok: true, status: 204 }; }
    return { ok: true, status: 200, json: async () => [] };
  };
  const net = createNetwork({ config: { url: "https://example.test", publishableKey: "test" }, storage, fetcher });
  net.publish("battle", { island: "Isla Dawn" }, { id: "captain", name: "Prueba" });
  await net.sync();
  assert.equal(net.snapshot().status, "offline");
  assert.equal(net.snapshot().pending, 1);
  assert.match(net.snapshot().error, /desconectado/);
  const resumed = createNetwork({ config: { url: "https://example.test", publishableKey: "test" }, storage, fetcher });
  assert.equal(resumed.snapshot().pending, 1);
  online = true;
  await resumed.sync();
  assert.equal(resumed.snapshot().status, "online");
  assert.equal(resumed.snapshot().pending, 0);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, "battle");
  assert.equal(await resumed.scout(500, 300), "Arlong");
});
