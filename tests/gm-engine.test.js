import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter } from "../src/game.js";
import { adjustLocalBounty, advanceGM, applyGMEvent, awardBerries, getBerryMultiplier, isLocalGMAvailable, scheduleGMEvent, transmitLocalGMMessage } from "../src/gm_engine.js";
import { avatarScenePosition } from "../src/map.js";
import { drawPixelAvatar } from "../src/island_renderer.js";
import { ensureAdvancedSystems } from "../src/systems.js";

test("avatar config is persisted and legacy appearance remains compatible", () => {
  const character = createCharacter({ name: "Navegante", appearance: { skin: "Oscura", eyes: "Verde", outfit: "Azul", hair: "Rojo", accessory: "Sombrero" } });
  assert.deepEqual(character.avatarConfig, character.appearance);
  const pixels = [];
  drawPixelAvatar({ fillRect: (...args) => pixels.push(args) }, character.avatarConfig, { fullBody: true });
  assert.ok(pixels.length >= 19);
  delete character.avatarConfig;
  character.appearance = { skin: "Oscura" };
  ensureAdvancedSystems(character);
  assert.equal(character.avatarConfig.outfit, "Rojo");
  assert.equal(character.avatarConfig.skin, "Oscura");
});

test("the five sprite layers and action poses produce distinct pixel drawings", () => {
  const signature = (appearance, options = {}) => {
    const calls = [];
    const ctx = { fillStyle: "", fillRect(...rect) { calls.push([this.fillStyle, ...rect]); } };
    drawPixelAvatar(ctx, appearance, { fullBody: true, ...options });
    return JSON.stringify(calls);
  };
  const base = signature({});
  for (const change of [
    { skin: "Oscura" }, { eyes: "Verde" }, { hair: "Rubio" },
    { outfit: "Azul" }, { accessory: "Sombrero" }
  ]) assert.notEqual(signature(change), base, `appearance layer ${Object.keys(change)[0]} should alter pixels`);
  assert.notEqual(signature({}, { action: "combat" }), base);
  assert.notEqual(signature({}, { action: "tavern" }), base);
  assert.notEqual(signature({}, { action: "resting", time: 0 }), signature({}, { action: "resting", time: 350 }));
});

test("avatar scene coordinates are stable and action-specific", () => {
  assert.deepEqual(avatarScenePosition("dawn", "captain"), avatarScenePosition("dawn", "captain"));
  assert.notDeepEqual(avatarScenePosition("dawn", "captain"), avatarScenePosition("dawn", "other"));
  assert.deepEqual(avatarScenePosition("dawn", "captain", "tavern"), { x: 109, y: 130 });
  assert.deepEqual(avatarScenePosition("dawn", "captain", "resting"), { x: 487, y: 325 });
});

test("Game Master events follow simulation-hour cadence and apply local weather/economy effects", () => {
  const character = createCharacter({ name: "Capitana" });
  ensureAdvancedSystems(character);
  character.world.gm = { lastCheckedHour: -1, lastEventMinute: 0, events: [] };
  assert.equal(advanceGM(character, () => 0), null, "automatic events do not fire on the first world hour");
  character.world.minuteOfDay = 60;
  assert.equal(advanceGM(character, () => 0), null, "automatic events observe their six-hour cooldown");
  character.world.minuteOfDay = 360;
  assert.equal(advanceGM(character, () => 0).type, "legendary_sighting");
  character.world.minuteOfDay = 720;
  character.location.atSea = true;
  character.travel.climate = "calm-belt";
  assert.equal(advanceGM(character, () => 0).type, "rogue_wave");
  assert.equal(character.travel.weather, "storm");
  assert.equal(character.world.gm.stormUntil, 960);
  assert.ok(character.world.news.some((item) => item.gmEvent === "rogue_wave"));
});

test("manual GM controls are local, bounded, and do not send a server chat event", () => {
  const storage = {
    values: new Map(),
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { this.values.set(key, value); }
  };
  const character = createCharacter({ name: "Capitana" });
  character.world.shared = { status: "local" };
  assert.equal(isLocalGMAvailable(character), true);
  assert.equal(transmitLocalGMMessage("Aviso de prueba", storage).ok, true);
  const saved = JSON.parse(storage.getItem("one-latam-global-chat-v1"));
  assert.equal(saved[0].author, "Game Master · Local");
  assert.equal(saved[0].text, "Aviso de prueba");
  assert.equal(adjustLocalBounty(character, "1000").ok, true);
  assert.equal(character.bounty, 1000);
  assert.equal(adjustLocalBounty(character, -1).ok, false);
  character.world.shared.status = "online";
  assert.equal(isLocalGMAvailable(character), false);
});

test("scheduled local GM events trigger on simulation time and expire their berry multiplier", () => {
  const character = createCharacter({ name: "Capitana" });
  const scheduled = scheduleGMEvent(character, "berry_multiplier", 10);
  assert.equal(scheduled.ok, true);
  character.world.minuteOfDay = 10;
  assert.equal(advanceGM(character, () => 1).type, "berry_multiplier");
  assert.equal(getBerryMultiplier(character), 2);
  assert.equal(awardBerries(character, 12), 24);
  character.world.minuteOfDay = 490;
  assert.equal(getBerryMultiplier(character), 1);
  assert.equal(awardBerries(character, 12), 12);
  assert.equal(scheduleGMEvent(character, "untyped", 60).ok, false);
});
