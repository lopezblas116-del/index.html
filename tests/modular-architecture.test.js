import test from "node:test";
import assert from "node:assert/strict";
import islandData from "../src/data/islands_data.json" with { type: "json" };
import missionData from "../src/data/missions_data.json" with { type: "json" };
import { CONTRACTS, PALETTE, STORAGE_KEYS } from "../src/config.js";
import { getGlobalChat, postGlobalChat } from "../src/chat_engine.js";
import { dispatchTypedEvent, onTypedEvent } from "../src/event_dispatcher.js";
import { readJSON, removeStorage, writeJSON } from "../src/storage_adapter.js";
import { ensureBlockOneData } from "../src/block1.js";
import { createCharacter } from "../src/game.js";
import { applyLocalAction, createLocalWorld } from "../src/geopolitics.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

test("configuration and descriptive JSON keep world and mission data separate", () => {
  assert.deepEqual(PALETTE, { ocean: "#0b1329", panel: "#162238", gold: "#f4b41a" });
  assert.equal(Object.keys(islandData).length, 28);
  assert.deepEqual(missionData.routes["East Blue"].slice(0, 3), ["Isla Dawn", "Orange Town", "Villa Syrup"]);
  assert.ok(CONTRACTS.some((contract) => contract.category === "archaeology" && contract.reward > 0));
  assert.equal(STORAGE_KEYS.save, "one-latam-rpg-beta-1");
});

test("storage adapter handles JSON values and unavailable or malformed storage", () => {
  const storage = memoryStorage();
  assert.equal(writeJSON("settings", { reducedMotion: true }, storage), true);
  assert.deepEqual(readJSON("settings", {}, storage), { reducedMotion: true });
  storage.setItem("broken", "{");
  assert.deepEqual(readJSON("broken", { fallback: true }, storage), { fallback: true });
  assert.equal(removeStorage("settings", storage), true);
  assert.equal(readJSON("settings", [], storage).length, 0);
  assert.equal(writeJSON("settings", {}, null), false);
});

test("global chat persists locally, emits typed events, and merges synchronized posts", () => {
  const storage = memoryStorage();
  const oldDocument = globalThis.document;
  const target = new EventTarget();
  globalThis.document = target;
  try {
    const captain = createCharacter({ name: "Navegante" });
    let received;
    const unsubscribe = onTypedEvent("global-chat-message", (event) => { received = event.detail.message; }, target);
    const result = postGlobalChat(captain, "  ¡Buen viento!  ", storage);
    assert.equal(result.ok, true);
    assert.equal(received.text, "¡Buen viento!");
    assert.equal(getGlobalChat([], storage)[0].id, result.message.id);
    const merged = getGlobalChat([{
      event_id: result.message.id,
      type: "global_chat",
      text: "Navegante: ¡Buen viento!",
      created_at: result.message.time
    }], storage);
    assert.equal(merged.length, 1);
    assert.equal(postGlobalChat(captain, "  ", storage).ok, false);
    unsubscribe();
  } finally {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
});

test("typed event dispatcher rejects unknown types and malformed payloads", () => {
  assert.throws(() => dispatchTypedEvent("untyped", {}, new EventTarget()), TypeError);
  assert.throws(() => dispatchTypedEvent("journal-entry", { message: 4 }, new EventTarget()), TypeError);
});

test("global chat actions become idempotent shared-world notices", () => {
  const world = createLocalWorld();
  const actor = { id: "captain", name: "Navegante" };
  const action = { event_id: "chat-1", type: "global_chat", data: { text: "¡Buen viento!" } };
  applyLocalAction(world, action, actor);
  applyLocalAction(world, action, actor);
  assert.equal(world.global_events.length, 1);
  assert.equal(world.global_events[0].text, "Navegante: ¡Buen viento!");
  assert.equal(world.global_events[0].type, "global_chat");
});

test("legacy contract saves gain category metadata and an archaeology board", () => {
  const captain = createCharacter({ name: "Cartógrafa" });
  captain.availableContracts = [{ id: "bounty", title: "Caza de recompensas", reward: 260 }];
  ensureBlockOneData(captain);
  assert.equal(captain.availableContracts.find((contract) => contract.id === "bounty").category, "bounty");
  assert.ok(captain.availableContracts.some((contract) => contract.category === "archaeology"));
});
