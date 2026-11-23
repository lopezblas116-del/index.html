import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter } from "../src/game.js";
import { codexProgress, syncCodex } from "../src/codex_engine.js";
import { PLANETARY_GEOGRAPHY } from "../src/map.js";
import { avatarEmotion, celebrateAvatar, drawPixelAvatar } from "../src/island_renderer.js";
import { rarityFor } from "../src/vfx_engine.js";

test("the planetary geography keeps the two barriers and four Blues in one canonical model", () => {
  assert.deepEqual(PLANETARY_GEOGRAPHY.redLineMeridians, [0, Math.PI]);
  assert.equal(PLANETARY_GEOGRAPHY.grandLineLatitude, 0);
  assert.equal(PLANETARY_GEOGRAPHY.calmBelts.length, 2);
  assert.equal(PLANETARY_GEOGRAPHY.blues.length, 4);
  assert.equal(PLANETARY_GEOGRAPHY.reverseMountain.name, "Reverse Mountain");
});

test("codex sync records island, race, fruit, ship, and translated poneglyph discoveries once", () => {
  const character = createCharacter({ name: "Cartógrafa", originSea: "East Blue" });
  character.archaeology.translations.push({ siteId: "ohara-stone" });
  character.fruit = { id: "mera-mera", name: "Mera Mera no Mi" };
  assert.equal(syncCodex(character), true);
  const discoveries = [...character.codex.discoveries];
  assert.ok(discoveries.includes("islands:dawn"));
  assert.ok(discoveries.includes("races:human"));
  assert.ok(discoveries.includes("fruits:mera-mera"));
  assert.ok(discoveries.includes("ships:caravel"));
  assert.ok(discoveries.includes("poneglyphs:void-century"));
  assert.equal(syncCodex(character), false);
  assert.deepEqual(character.codex.discoveries, discoveries);
  const progress = codexProgress(character);
  assert.equal(progress.unlocked, discoveries.length);
  assert.equal(progress.percent, Math.round(discoveries.length / progress.total * 100));
});

test("64-pixel avatar rendering scales the authored sprite and exposes emotional states", () => {
  const rectangles = [];
  const context = {
    fillRect(x, y, width, height) { rectangles.push({ x, y, width, height }); },
    set fillStyle(value) {}
  };
  drawPixelAvatar(context, {}, { size: 64, fullBody: true, equipment: { weapon: "Sable" } });
  assert.ok(Math.max(...rectangles.map(({ x, width }) => x + width)) > 32);
  const character = { stats: { health: 10, maxHealth: 100 }, travel: { weather: "clear" } };
  assert.equal(avatarEmotion(character), "exhausted");
  character.stats.health = 100;
  character.travel.weather = "storm";
  assert.equal(avatarEmotion(character), "weather");
  celebrateAvatar(character);
  assert.equal(avatarEmotion(character), "victory");
});

test("loot reveal rarity is inferred from the actual item name", () => {
  assert.equal(rarityFor({ name: "Provisión de viaje" }).className, "common");
  assert.equal(rarityFor({ name: "Log Pose antiguo" }).className, "rare");
  assert.equal(rarityFor({ name: "Plano épico" }).className, "epic");
  assert.equal(rarityFor({ name: "Calco Poneglyph: Siglo Vacío" }).className, "legendary");
});
