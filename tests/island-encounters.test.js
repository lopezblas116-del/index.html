import test from "node:test";
import assert from "node:assert/strict";
import { islandEncountersFor } from "../src/island_encounters.js";

const island = { id: "port", name: "Puerto Bruma", affiliated: true, control: "Tirano" };
const captain = (overrides = {}) => ({
  id: "captain",
  status: "alive",
  location: { island: island.name, atSea: false },
  world: { day: 1, nobleAlert: true },
  soulCard: { alignment: "Libertad" },
  ...overrides
});

test("political actions appear as contextual encounters at an arrived port", () => {
  const encounters = islandEncountersFor(island, captain());
  assert.deepEqual(encounters.map(({ action }) => action), ["tribute", "sabotage"]);
});

test("encounters stay hidden at sea, on a preview island, or after the tribute cycle closes", () => {
  assert.deepEqual(islandEncountersFor(island, captain({ location: { island: "Other", atSea: false } })), []);
  assert.deepEqual(islandEncountersFor(island, captain({ location: { island: island.name, atSea: true } })), []);
  assert.deepEqual(islandEncountersFor(island, captain({ world: { day: 7, lastTributeDay: 1, nobleAlert: true } })), ["sabotage"].map((action) => ({
    action,
    title: "Contacto de la resistencia",
    description: "Una célula local ofrece refugio y suministros si ayudas a desarticular el control tiránico.",
    warning: "",
    buttonLabel: "Ayudar a la resistencia"
  })));
});

test("resistance encounters respect the captain's alignment and captivity state", () => {
  const neutral = captain({ soulCard: { alignment: "Justicia" } });
  assert.deepEqual(islandEncountersFor({ ...island, affiliated: false }, neutral), []);
  assert.deepEqual(islandEncountersFor(island, captain({ captured: { island: island.name } })), []);
});
