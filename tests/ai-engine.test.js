import test from "node:test";
import assert from "node:assert/strict";
import { chooseAutonomousAction, ensurePsyche, evaluateWhisper, recordActionOutcome, resolvePortDilemma, writeDailyReflection } from "../src/ai_engine.js";
import { createCharacter, sendWhisper } from "../src/game.js";

test("legacy avatars receive a bounded psyche and personality-weighted decisions", () => {
  const captain = createCharacter({ name: "Cartógrafa", alignment: "Justicia", traits: ["Prudente", "Leal"] });
  assert.equal(ensurePsyche(captain).morality.honor, 68);
  assert.equal(chooseAutonomousAction({ ...captain, stats: { health: 10, maxHealth: 100 } }, () => 0.5), "rest");
  assert.ok(captain.psyche.morality.liberty >= 0 && captain.psyche.morality.liberty <= 100);
});

test("contradictory whispers can be reinterpreted and are recorded as reflection", () => {
  const captain = createCharacter({ name: "Valiente", traits: ["Valiente", "Leal"] });
  assert.equal(evaluateWhisper(captain, "rest").against, true);
  const rolls = [0.99, 0, 0.5];
  const result = sendWhisper(captain, "descansa", () => rolls.shift() ?? 0.5);
  assert.ok(result.reinterpretedAction);
  assert.ok(captain.log.some((entry) => entry.message.includes("lo reinterpreta")));
});

test("port dilemmas resolve from the captain's moral compass only once per island and day", () => {
  const captain = createCharacter({ name: "Capitana", alignment: "Justicia" });
  captain.world.day = 3;
  const event = resolvePortDilemma(captain, () => 0);
  assert.ok(event);
  assert.equal(event.location, captain.location.island);
  assert.ok(captain.psyche.diary[0].text.includes(event.choice.text));
  assert.equal(resolvePortDilemma(captain, () => 0), null);
});

test("daily reflections are literary diary entries and idempotent", () => {
  const captain = createCharacter({ name: "Navegante" });
  captain.world.day = 4;
  const entry = writeDailyReflection(captain);
  assert.match(entry.text, /cerrar el día 4/);
  assert.equal(writeDailyReflection(captain), null);
});

test("combat outcomes update mood and honor in the persistent psyche", () => {
  const captain = createCharacter({ name: "Guardia" });
  const honor = captain.psyche.morality.honor;
  recordActionOutcome(captain, "combat", { wins: true });
  assert.equal(captain.psyche.mood, "Eufórico");
  assert.equal(captain.psyche.morality.honor, honor + 2);
  recordActionOutcome(captain, "combat", { wins: false });
  assert.equal(captain.psyche.mood, "Vengativo");
});
