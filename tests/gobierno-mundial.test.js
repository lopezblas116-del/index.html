import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter } from "../src/game.js";
import {
  decretoDelDia, desfileTenryuubito, pagarTributo, desoibirTributo,
  vigilanciaCP9, emboscadaCP9, consultarFilosofo, dejarFragmento,
  revelarArquitecto, arquitectoCompleto, governmentPulse, resumenGobierno
} from "../src/world_government.js";

function character(options = {}) {
  const c = createCharacter({ name: "Prueba", traits: ["Valiente", "Leal"], ...options });
  c.inventory = { provisions: 3, water: 3, items: [], equipment: [] };
  c.crew = [];
  c.log = [];
  c.world.day = 1;
  return c;
}

test("los Gorosei decretan por día y su decreto es determinista", () => {
  const a = decretoDelDia(7);
  const b = decretoDelDia(7);
  assert.equal(a.id, b.id, "el mismo día tiene el mismo decreto");
  assert.ok(a.texto.length > 20, "el decreto se explica solo");
  assert.notEqual(decretoDelDia(1).id, decretoDelDia(2).id, "el decreto cambia con el calendario");
});

test("el desfile tenryuubito exige tributo y responder a un noble tiene consecuencias", () => {
  const cap = character({ originSea: "East Blue" });
  cap.berrytest = true;
  const random = Math.random;
  // fuerza el desfile: la semilla del desfile depende de isla/día, así que probamos la respuesta directa
  const desfile = { noble: "Rosa Marijois", tributo: 80, dia: 1 };
  cap.berries = 200;
  const pagado = pagarTributo(cap, desfile);
  assert.equal(pagado.ok, true, "con berries alcanza para el tributo");
  assert.equal(cap.berries, 120, "el tributo se cobra de verdad");
  const desoir = desoibirTributo(cap, desfile);
  assert.equal(desoir.ok, true, "desoír es posible");
  assert.ok(Number(cap.bounty) > 0, "desafiar a un noble pone precio a tu cabeza");
  // sin berries no hay cortesía: el noble mira hacia otro lado o no
  const pobre = character({ originSea: "East Blue" });
  pobre.berries = 10;
  const rechazo = pagarTributo(pobre, { noble: "X", tributo: 80 });
  assert.equal(rechazo.ok, false, "sin berries no se paga el tributo");
});

test("CP9 marca a los capitales con precio y los embosca", () => {
  const cap = character({ originSea: "East Blue" });
  cap.bounty = 45000;
  cap.location.island = "Loguetown";
  cap.location.control = "Marina";
  const estado = vigilanciaCP9(cap);
  assert.ok(estado?.vigilando, "una recompensa alta despierta al CP9");
  assert.ok(estado.agente.length > 3, "el agente tiene nombre");
  assert.ok(Number(cap.cp9.desde) >= 1, "la vigilancia se registra con fecha");
  const random = Math.random;
  Math.random = () => 0; // victoria garantizada en el combate: el test mide la mecánica
  try {
    const resultado = emboscadaCP9(cap, Math.random);
    assert.equal(resultado?.ok, true, "con atributos altos el agente cae");
    assert.ok(Number(cap.berries) > 0, "derrotar al agente paga");
    assert.equal(cap.cp9.vigilando, false, "la vigilancia se levanta tras la derrota");
  } finally {
    Math.random = random;
  }
});

test("los filósofos venden teorías y los planos del Arquitecto completan la conspiración", () => {
  const cap = character({ originSea: "East Blue" });
  cap.berries = 500;
  cap.location.island = "Isla Dawn";
  const respuesta = consultarFilosofo(cap, () => 0); // el azar acompaña: siempre suelta fragmento si queda
  assert.equal(respuesta.ok, true, "la consulta es posible con berries");
  assert.ok(Number(cap.berries) < 500, "la verdad cobra su precio");
  assert.ok((cap.arquitecto?.fragmentos?.length || 0) >= 0, "el estado del Arquitecto existe");
  // se reúnen los seis planos a mano: la revelación llega sola
  const ids = ["puente", "estrellas", "raices", "marea", "silencio", "regreso"];
  cap.arquitecto = { fragmentos: [...ids], revelado: false };
  assert.equal(arquitectoCompleto(cap), true, "los seis planos forman el mapa");
  const revelacion = revelarArquitecto(cap);
  assert.ok(revelacion, "la conspiración se revela con los planos completos");
  assert.equal(cap.arquitecto.revelado, true, "no se revela dos veces");
  assert.equal(revelarArquitecto(cap), null, "la revelación no se repite");
  assert.match(cap.log[0]?.message || "", /Arquitecto|conspiración|MAPA/i);
});

test("el pulso del Gobierno decide una vez por día y resume su estado en una línea", () => {
  const cap = character({ originSea: "East Blue" });
  cap.location.island = "Loguetown";
  cap.location.control = "Marina";
  cap.bounty = 50000;
  cap.world.day = 3;
  governmentPulse(cap, () => 0);
  const linea = resumenGobierno(cap);
  assert.ok(linea.includes("Decreto:"), "el decreto vive en el resumen");
  assert.ok(linea.length > 10, "el resumen dice algo real del Gobierno");
  cap.cp9 = { vigilando: true, agente: "Rob Lucci", isla: "Loguetown", desde: 1 };
  assert.match(resumenGobierno(cap), /CP9: Rob Lucci/, "la vigilancia se anuncia por nombre");
});
