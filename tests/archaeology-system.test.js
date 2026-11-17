import test from "node:test";
import assert from "node:assert/strict";
import { getMapIslands } from "../src/map.js";
import { ensureBlockOneData } from "../src/block1.js";
import { createCharacter, loadGame, SAVE_KEY } from "../src/game.js";
import { resolveLocalActivity } from "../src/ai_engine.js";
import {
  canReadAncient, examinePoneglyph, RUBBING_PRICE, sellPoneglyphRubbing, translateRubbing
} from "../src/archaeology_system.js";
import { decodeGlyphs, encodeGlyphs } from "../src/language_engine.js";

test("keyed glyph substitution round-trips text and rejects a different key", () => {
  const phrase = "Memoria antigua: Isla Ohara.";
  const encoded = encodeGlyphs(phrase, "ohara-stone");
  assert.notEqual(encoded, phrase);
  assert.equal(decodeGlyphs(encoded, "ohara-stone"), phrase.toLocaleUpperCase("es"));
  assert.notEqual(decodeGlyphs(encoded, "other-key"), phrase.toLocaleUpperCase("es"));
});

test("Poneglyph visit grants one rubbing, while readers can translate it", () => {
  const island = getMapIslands().find((entry) => entry.id === "ohara");
  const poi = island.pois.find((entry) => entry.type === "poneglyph");
  const captain = createCharacter({ name: "Cartógrafa", originSea: "West Blue" });
  ensureBlockOneData(captain);
  captain.location.island = island.name;
  captain.location.localVenue = { id: poi.id, name: poi.name, type: poi.type };
  assert.equal(canReadAncient(captain), false);
  const rubbing = examinePoneglyph(captain, island, poi);
  assert.equal(rubbing.title, "Siglo Vacío");
  assert.equal(examinePoneglyph(captain, island, poi), null);
  assert.equal(translateRubbing(captain, rubbing.id).ok, false);
  captain.profession = "Arqueóloga";
  const result = translateRubbing(captain, rubbing.id);
  assert.equal(result.ok, true);
  assert.match(result.translation.text, /registro fragmentario/i);
  assert.equal(captain.ancientLanguage.knowledge, 25);
});

test("Three Eyes read automatically and local rubbing sales collect port tax", () => {
  const islands = getMapIslands();
  const island = islands.find((entry) => entry.id === "ohara");
  const poi = island.pois.find((entry) => entry.type === "poneglyph");
  const captain = createCharacter({ name: "Navegante", originSea: "West Blue", race: "threeeye" });
  ensureBlockOneData(captain);
  captain.location.island = island.name;
  captain.location.localVenue = { id: poi.id, name: poi.name, type: poi.type };
  const rubbing = examinePoneglyph(captain, island, poi);
  assert.equal(canReadAncient(captain), true);
  assert.equal(rubbing.translated, true);
  assert.equal(captain.archaeology.translations.length, 1);
  const localWorld = { islands_control: [{ island_id: island.id, name: island.name, owner_id: "owner", tax_rate: 10, taxes: 0, treasury: 0 }] };
  const berries = captain.berries;
  const sale = sellPoneglyphRubbing(captain, rubbing.id, localWorld);
  assert.equal(sale.ok, true);
  assert.equal(sale.tax, Math.floor(RUBBING_PRICE * 0.1));
  assert.equal(captain.berries, berries + RUBBING_PRICE - sale.tax);
  assert.equal(localWorld.islands_control[0].treasury, sale.tax);
  assert.equal(sellPoneglyphRubbing(captain, rubbing.id, localWorld).ok, false);
});

test("Poneglyph translation dispatches the typed event", () => {
  const oldDocument = globalThis.document;
  const target = new EventTarget();
  globalThis.document = target;
  try {
    const island = getMapIslands().find((entry) => entry.id === "ohara");
    const poi = island.pois.find((entry) => entry.type === "poneglyph");
    const captain = createCharacter({ name: "Arqueóloga", race: "threeeye" });
    captain.location.island = island.name;
    captain.location.localVenue = { id: poi.id, name: poi.name, type: poi.type };
    let detail;
    target.addEventListener("onepiece:PONEGLYPH_TRANSLATED", (event) => { detail = event.detail; });
    examinePoneglyph(captain, island, poi);
    assert.deepEqual(detail, { siteId: poi.id, title: "Siglo Vacío", captainId: captain.id });
  } finally {
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  }
});

test("legacy saves gain archaeology defaults without losing their existing state", () => {
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const saved = createCharacter({ name: "Veterana", originSea: "East Blue" });
  saved.berries = 4321;
  delete saved.profession;
  delete saved.archaeology;
  delete saved.ancientLanguage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (key) => key === SAVE_KEY ? JSON.stringify(saved) : null }
  });
  try {
    const restored = loadGame();
    assert.equal(restored.name, "Veterana");
    assert.equal(restored.berries, 4321);
    assert.equal(restored.profession, "Navegante");
    assert.deepEqual(restored.archaeology.rubbings, []);
    assert.deepEqual(restored.archaeology.translations, []);
    assert.equal(restored.ancientLanguage.knowledge, 0);
  } finally {
    if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor);
    else delete globalThis.localStorage;
  }
});

test("eligible characters autonomously walk to a data-defined Poneglyph", () => {
  const captain = createCharacter({ name: "Exploradora", race: "threeeye", originSea: "West Blue" });
  captain.location.island = "Isla Ohara";
  const first = resolveLocalActivity(captain, () => 0);
  assert.equal(first.action, "walking");
  assert.equal(captain.location.localTarget.id, "ohara-stone");
  resolveLocalActivity(captain, () => 0);
  const visit = resolveLocalActivity(captain, () => 0);
  assert.equal(visit.action, "poneglyph");
});
