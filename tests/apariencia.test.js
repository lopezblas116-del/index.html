import { test } from "node:test";
import assert from "node:assert/strict";
import { createCharacter } from "../src/game.js";

test("createCharacter conserva TODA la apariencia elegida (outfitColor incluido)", () => {
  const c = createCharacter({ name: "Test", appearance: { skin: "Oscura", eyes: "Azul", hair: "Moreno", outfit: "kimono-wano", outfitColor: "Vino", coat: "Rojo", accessory: "Bandana", detail: "Cicatriz" }, race: "fishman" });
  assert.equal(c.appearance.outfitColor, "Vino");
  assert.equal(c.appearance.outfit, "kimono-wano");
  assert.equal(c.appearance.coat, "Rojo");
  assert.equal(c.appearance.detail, "Cicatriz");
});

test("createCharacter inyecta la raza en la apariencia para el avatar del mundo", () => {
  const c = createCharacter({ name: "Test", appearance: {}, race: "mink" });
  assert.equal(c.appearance.race, "mink", "la apariencia debe llevar race para que el sprite del mundo la dibuje");
});

import { ensureAdvancedSystems } from "../src/systems.js";

test("ensureAdvancedSystems (cada tick) NO borra outfitColor ni race de la apariencia", () => {
  const c = createCharacter({ name: "Tick", appearance: { outfit: "kimono-wano", outfitColor: "Vino", coat: "Rojo", detail: "Cicatriz" }, race: "fishman" });
  for (let i = 0; i < 5; i++) ensureAdvancedSystems(c); // cinco latidos del tick
  assert.equal(c.appearance.outfitColor, "Vino", "el color elegido debe sobrevivir al tick");
  assert.equal(c.appearance.outfit, "kimono-wano");
  assert.equal(c.appearance.race, "fishman", "la raza debe sobrevivir al tick");
  assert.equal(c.appearance.coat, "Rojo");
});
