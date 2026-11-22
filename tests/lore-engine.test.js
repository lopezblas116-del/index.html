import test from "node:test";
import assert from "node:assert/strict";
import {
  ensurePoliticalStance, recordPoliticalEcho, marinePatrolActive,
  revolutionaryTrust, politicalTradeAdjustment, pickWeightedEnemy, describePoliticalStance
} from "../src/lore_engine.js";
import { raceTreatmentAtPort } from "../src/race_system.js";
import { maybeCaptureAtAuction } from "../src/politics.js";
import { advanceLocalWorld } from "../src/geopolitics.js";
import { tavernAction, getTavernCandidates } from "../src/systems.js";

function personajeBase({ island = "Archipiélago Sabaody", race = "fishman", day = 10 } = {}) {
  return {
    id: "test-eco", name: "Probador", status: "alive", captured: false, race,
    faction: "Pirata", berries: 500, bounty: 0, level: 3,
    location: { island, atSea: false }, mapPosition: { x: 965, y: 370 },
    stats: { health: 90, maxHealth: 100, strength: 5, agility: 4, ingenuity: 4 },
    world: { day, news: [], islands_control: [] },
    log: [], inventory: { provisions: 2, water: 1, items: [], equipment: [] },
    soulCard: { dream: "Libertad", alignment: "Libertad", traits: { pros: [], cons: [] } },
    whisper: { affinity: 55, rebellion: 45, priorityItems: [], itemSuggestions: [] },
    crew: [], ship: { acquired: true, health: 100, maxHealth: 100 }, tavern: { port: "", visitors: [] },
    revolutionarySupport: { sabotagedIslands: [] }
  };
}

test("el eco político del tributo enciende la vigilancia y la Revolución", () => {
  const character = personajeBase();
  recordPoliticalEcho(character, "tribute", "Archipiélago Sabaody", () => 0);
  const stance = character.politicalStance;
  assert.equal(stance.marineFavor, 38);
  assert.equal(stance.revolutionarySympathy, 8);
  assert.equal(stance.underworldRenown, 6);
  assert.equal(stance.patrolUntilDay, 13);
  assert.ok(marinePatrolActive(character));
  assert.ok(character.world.news.some((entry) => /patrón de vigilancia/.test(entry.text)));
  assert.ok(character.log.some((entry) => /Eco político/.test(entry.message)));
  assert.equal(stance.echoes, 1);
});

test("el eco del noble castiga el favor de la Marina y activa patrón severo", () => {
  const character = personajeBase();
  recordPoliticalEcho(character, "noble", "Archipiélago Sabaody", () => 0);
  const stance = character.politicalStance;
  assert.equal(stance.marineFavor, 10);
  assert.equal(stance.patrolUntilDay, 15);
  assert.ok(stance.revolutionarySympathy > 0);
});

test("la confianza revolucionaria abarata suministros y el hampa paga mejor", () => {
  const character = personajeBase();
  character.politicalStance = { marineFavor: 50, revolutionarySympathy: 70, underworldRenown: 60, patrolUntilDay: 0, echoes: 0 };
  const trust = revolutionaryTrust(character);
  assert.equal(trust.level, "Camarada de confianza");
  const adjustment = politicalTradeAdjustment(character);
  assert.equal(adjustment.buy, 0.9);
  assert.equal(adjustment.sell, 1.1);
  assert.ok(adjustment.reasons.some((reason) => /Revolución/.test(reason)));
  assert.ok(adjustment.reasons.some((reason) => /hampa/.test(reason)));
});

test("el patrón naval encarece los muelles para los buscados", () => {
  const character = personajeBase();
  character.politicalStance = { marineFavor: 50, revolutionarySympathy: 0, underworldRenown: 0, patrolUntilDay: 99, echoes: 0 };
  const adjustment = politicalTradeAdjustment(character);
  assert.ok(adjustment.buy > 1, "el recargo del patrón debe subir las compras");
  assert.ok(adjustment.reasons.some((reason) => /vigilados/.test(reason)));
  // un Marine no carga con el recargo
  const marine = personajeBase({ race: "human" });
  marine.faction = "Marine";
  marine.politicalStance = { ...character.politicalStance };
  assert.equal(politicalTradeAdjustment(marine).buy, 1);
});

test("el patrón naval inclina los encuentros hacia la Marina", () => {
  const character = personajeBase();
  character.politicalStance = { marineFavor: 50, revolutionarySympathy: 0, underworldRenown: 0, patrolUntilDay: 20, echoes: 0 };
  assert.equal(pickWeightedEnemy(character, () => 0.5), "Marina");
  assert.equal(pickWeightedEnemy(character, () => 0.1), "Barco Pirata");
  assert.equal(pickWeightedEnemy(personajeBase(), () => 0.5), null, "sin patrón no hay sesgo");
});

test("la segregación cierra la taberna y encarece la subasta; la sangre buscada paga más", () => {
  const island = { segregated: true, auctionHouse: true };
  const treated = raceTreatmentAtPort("fishman", island);
  assert.equal(treated.status, "segregated");
  assert.equal(treated.portPriceModifier, 1.5);
  assert.equal(treated.tavernPolicy, "denied");
  assert.equal(treated.captureRiskModifier, 1.35);
  const feared = raceTreatmentAtPort("lunarian", {});
  assert.equal(feared.status, "feared");
  assert.equal(feared.tavernPolicy, "watched");
  assert.equal(feared.captureRiskModifier, 1.6);
  const humano = raceTreatmentAtPort("human", island);
  assert.equal(humano.portPriceModifier, 1);
  assert.equal(humano.tavernPolicy, "allowed");
  assert.equal(humano.captureRiskModifier, 1);
});

test("la subasta caza con más firmeza a la sangre perseguida", () => {
  const fishman = personajeBase({ race: "fishman" });
  // 0.5 ≥ 0.35 × 1.35: el pez-hombre escapa esta vez (antes el umbral era 0.35 plano)
  assert.equal(maybeCaptureAtAuction(fishman, () => 0.5), false);
  const hunted = personajeBase({ race: "lunarian" });
  // 0.5 < 0.35 × 1.6 = 0.56: la sangre perseguida se paga más alto
  assert.equal(maybeCaptureAtAuction(hunted, () => 0.5), true);
  assert.ok(hunted.captured);
  const humano = personajeBase({ race: "human" });
  assert.equal(maybeCaptureAtAuction(humano, () => 0), false);
});

test("la taberna segregada rechaza la raza; la confianza revolucionaria abre la puerta", () => {
  const character = personajeBase({ island: "Archipiélago Sabaody", race: "fishman" });
  const visitors = getTavernCandidates(character);
  visitors.forEach((visitor) => { visitor.loyalty = 80; });
  const visitor = visitors[0];
  const rejected = tavernAction(character, visitor.id, "recruit");
  assert.equal(rejected.ok, false);
  assert.ok(/no sirve a tu raza/.test(rejected.message));
  assert.ok(/Revolución/.test(rejected.message));
  character.politicalStance = { marineFavor: 50, revolutionarySympathy: 70, underworldRenown: 0, patrolUntilDay: 0, echoes: 0 };
  const accepted = tavernAction(character, visitor.id, "recruit");
  assert.equal(accepted.ok, true);
  assert.equal(character.crew.length, 1);
});

test("los impuestos abusivos terminan en revuelta; los justos calman el puerto", () => {
  const world = {
    islands_control: [{ island_id: "sabaody", name: "Archipiélago Sabaody", faction: "Tripulación", owner_id: "test-eco", owner_name: "Probador", tax_rate: 20, taxes: 0, treasury: 0, chaos: 55, blockade_until_day: 0, besieged_by: null, defense_level: 30 }],
    global_events: [], bounties_leaderboard: [], fallen_captains: [], bosses: [], devil_fruits: [], last_cycle_day: 0
  };
  advanceLocalWorld(world, 1, () => 0.99); // aleatorio inyectado: sin invasiones ni fugas, el caos es determinista
  let island = world.islands_control[0];
  assert.equal(island.chaos, 65, "el impuesto del 20% suma 10 de caos por ciclo");
  assert.ok(world.global_events.some((entry) => /hierve/.test(entry.text)), "el descontento queda registrado");
  advanceLocalWorld(world, 2, () => 0.99);
  island = world.islands_control[0];
  assert.equal(island.owner_id, null, "la revuelta derroca al dueño");
  assert.equal(island.faction, "Tirano");
  assert.equal(island.tax_rate, 0);
  assert.ok(world.global_events.some((entry) => /REVUELTA/.test(entry.text)));

  const calmWorld = {
    islands_control: [{ island_id: "sabaody", name: "Archipiélago Sabaody", faction: "Tripulación", owner_id: "test-eco", owner_name: "Probador", tax_rate: 5, taxes: 0, treasury: 0, chaos: 30, blockade_until_day: 0, besieged_by: null, defense_level: 30 }],
    global_events: [], bounties_leaderboard: [], fallen_captains: [], bosses: [], devil_fruits: [], last_cycle_day: 0
  };
  advanceLocalWorld(calmWorld, 1, () => 0.99);
  advanceLocalWorld(calmWorld, 2, () => 0.99);
  assert.equal(calmWorld.islands_control[0].chaos, 26, "una tasación justa calma las aguas");
  assert.ok(!calmWorld.global_events.some((entry) => /REVUELTA/.test(entry.text)));
});

test("la lectura política para la interfaz resume la marea", () => {
  const character = personajeBase();
  ensurePoliticalStance(character);
  const summary = describePoliticalStance(character);
  assert.match(summary, /Marina:/);
  assert.match(summary, /Revolución:/);
  assert.match(summary, /Sin patrón naval/);
  const hunted = personajeBase();
  hunted.politicalStance = { marineFavor: 5, revolutionarySympathy: 0, underworldRenown: 70, patrolUntilDay: 99, echoes: 0 };
  assert.match(describePoliticalStance(hunted), /Patrón naval en curso/);
  assert.match(describePoliticalStance(hunted), /te caza/);
});
