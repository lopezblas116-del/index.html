import test from "node:test";
import assert from "node:assert/strict";
import { CATALOGO_ENTRADAS } from "../src/catalogo_engine.js";
import { canonParaNombre, canonParaTipo, extractoCanon, lineaCanon } from "../src/lore_encuentros.js";
import { islandEncountersFor } from "../src/island_encounters.js";

function personajeBase(islaNombre) {
  return {
    id: "test-canon",
    name: "Probador",
    status: "alive",
    captured: false,
    location: { island: islaNombre, atSea: false },
    world: { day: 12, story: {}, news: [], islands_control: [] },
    soulCard: { alignment: "Justicia", traits: { pros: [], cons: [] } },
    psyche: { morality: { honor: 50, liberty: 50 } },
    revolutionarySupport: { sabotagedIslands: [] }
  };
}

test("el catálogo queda 341/341 con texto real del lorebook", () => {
  const vacias = CATALOGO_ENTRADAS.filter((entry) => !(entry.texto || "").trim());
  assert.deepEqual(vacias.map((e) => e.nombre), [], "no pueden quedar entradas sin texto");
  for (const nombre of ["Zou", "Ryugu Kingdom", "Brag Men", "12 Supreme Grade Blades"]) {
    const entry = CATALOGO_ENTRADAS.find((e) => e.nombre === nombre);
    assert.ok(entry, `debe existir ${nombre}`);
    assert.ok(entry.texto.length >= 200, `${nombre} quedó con texto corto: ${entry.texto.length}`);
  }
});

test("extractoCanon corta por frase y respeta el límite", () => {
  const entry = canonParaTipo("noble");
  assert.ok(entry, "World Noble debe estar disponible como canon");
  const texto = extractoCanon(entry, 200);
  assert.ok(texto.length <= 220, `extracto demasiado largo: ${texto.length}`);
  assert.ok(texto.length > 40, "extracto con contenido real");
});

test("canonParaNombre resuelve islas conocidas y falla suave en desconocidas", () => {
  const conocida = canonParaNombre("Mary Geoise");
  assert.ok(conocida, "Mary Geoise tiene entrada canon");
  const desconocida = canonParaNombre("Isla Inexistente de Prueba");
  assert.equal(desconocida, null);
});

test("canonParaTipo mapea tributo→Marines y sabotaje→Ejército Revolucionario", () => {
  assert.match(canonParaTipo("tribute").nombre, /Marines/i);
  assert.match(canonParaTipo("sabotaje").nombre, /Revolutionary/i);
  assert.ok(canonParaTipo("noble"), "noble tiene canon");
});

test("lineaCanon anteponga el prefijo de registros del mundo", () => {
  const linea = lineaCanon({ tipo: "noble", maxChars: 180 });
  assert.ok(linea.startsWith("Según los registros del mundo:"), `línea: ${linea.slice(0, 60)}`);
});

test("los encuentros llevan canon: tributo y noble fundamentados en el lore real", () => {
  const island = { id: "isl-test", name: "Isla de Prueba", control: "Marina", affiliated: true, npcs: [] };
  const personaje = personajeBase("Isla de Prueba");
  personaje.world.nobleAlert = false;
  personaje.world.lastTributeDay = 0;
  // fuerza el seed del convoy noble para el día 12
  const diaNoble = (() => {
    for (let d = 12; d < 60; d++) {
      const seed = [...`test-canon:isl-test:${d}`].reduce((v, c) => (v * 31 + c.charCodeAt(0)) >>> 0, 0);
      if (seed % 9 === 0) return d;
    }
    return null;
  })();
  personaje.world.day = diaNoble ?? 12;
  const encuentros = islandEncountersFor(island, personaje);
  const tributo = encuentros.find((e) => e.action === "tribute");
  const noble = encuentros.find((e) => e.action === "noble");
  assert.ok(tributo, "el tributo debe aparecer");
  assert.match(tributo.description, /Según los registros del mundo:/, "tributo con canon");
  if (noble) {
    assert.match(noble.description, /Según los registros del mundo:/, "noble con canon");
    assert.match(noble.description, /noble|World Noble|Celestial/i, "canon de nobles mundiales");
  }
});

test("la crisis de la aventura inicial NO lleva canon (no ensucia el tutorial)", () => {
  const island = { id: "isl-foosha", name: "Villa Foosha", control: "Libre", affiliated: false, npcs: [] };
  const personaje = personajeBase("Villa Foosha");
  personaje.world.story.starterAdventure = {
    crisisId: "crisis:isl-foosha:12",
    islandId: "isl-foosha",
    status: "investigating",
    visitedPoiIds: []
  };
  personaje.world.story.activeCrisis = {
    id: "crisis:isl-foosha:12",
    islandId: "isl-foosha",
    status: "active",
    title: "Los suministros del puerto",
    participants: ["Makino", "Dadan"],
    opening: "Makino reúne a los vecinos.",
    startedDay: 12
  };
  const encuentros = islandEncountersFor(island, personaje);
  const crisis = encuentros.find((e) => e.action === "story-crisis");
  assert.ok(crisis, "la crisis debe aparecer");
  assert.ok(!crisis.description.includes("Según los registros del mundo"), "sin canon en el tutorial");
});
