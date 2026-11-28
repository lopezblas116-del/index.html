// Tests del ESPEJO DEL CAPITÁN y del DIARIO DEL MAR: dos mundos que ahora se hablan.
// El sim arresta → el juego lo sabe; el juego captura → el mundo lo ve; la fuga
// de cualquiera de los dos lados libera ambos — y el trono renace como orden jugable.
import test from "node:test";
import assert from "node:assert/strict";

import "../src/mundo/util.js";
import "../src/mundo/datos_mundo.js";
import "../src/mundo/datos_textos.js";
import "../src/mundo/simulacion.js";

const { Sim, D } = globalThis;
import { entradasDelSim } from "../src/event_dispatcher.js";

// ── EL ESPEJO (lado mundo) ──
test("encarcelarUsuario: la captura jugable deja rastro en el mundo (estado, movimiento y feed)", () => {
  const sim = new Sim(11);
  sim.crearJugador({ nombre: "Rune D. Vela", mar: "EB", camino: "pir", sueno: "libertad", oficio: "grumete", rasgos: Object.fromEntries(D.EJES.map((e) => [e.k, 0])) });
  const u = sim.user;
  const islaNombre = D.ISLA[u.homeIsl]?.n || "Loguetown";
  const ok = sim.encarcelarUsuario(islaNombre, 9000);
  assert.ok(ok, "encarcelar debe aplicarse");
  assert.ok(["prision", "calabozo"].includes(u.state), "el agente queda preso");
  assert.equal(u.insignias.cadena, "cadena");
  const rec = sim.feed.filter((r) => r.key === "arresto" || r.key === "arresto_gran").at(-1);
  assert.ok(rec, "el feed narra la captura");
  const vars = D.TXT[rec.key];
  assert.ok(vars, "el evento existe en los textos");
  // idempotente: encarcelar dos veces no duplica
  const segunda = sim.encarcelarUsuario(islaNombre, 9000);
  assert.equal(segunda, false, "ya está preso: no se duplica");
});

test("liberarUsuario: la fuga jugable es noticia y el trono renace como orden", () => {
  const sim = new Sim(12);
  sim.crearJugador({ nombre: "Rune D. Vela", mar: "EB", camino: "pir", sueno: "libertad", oficio: "grumete", rasgos: Object.fromEntries(D.EJES.map((e) => [e.k, 0])) });
  const u = sim.user;
  u.bounty = 50000000; // sobre ฿30M: Impel Down y arco del trono
  sim.encarcelarUsuario("Impel Down", 25000);
  const ok = sim.liberarUsuario();
  assert.ok(ok, "liberar debe aplicarse");
  assert.equal(u.state, "libre", "el agente queda libre");
  assert.equal(u.insignias.fuga, "fuga");
  assert.ok(sim.feed.some((r) => r.key === "fuga"), "la fuga se narra");
  const nemesis = sim.feed.filter((r) => r.key === "nemesis").at(-1);
  assert.ok(nemesis, "el trono renace: ev nemesis para el jugador");
  // la guerra tiene el frente del retorno
  assert.ok(sim.guerra?.frentes?.some((f) => f.rey === u.id), "el frente de reconquista existe");
});

test("el espejo escucha: ev notifica a la ranura jugable con rec y vars", () => {
  const sim = new Sim(13);
  sim.crearJugador({ nombre: "Rune D. Vela", mar: "EB", camino: "pir", sueno: "libertad", oficio: "grumete", rasgos: Object.fromEntries(D.EJES.map((e) => [e.k, 0])) });
  const vistos = [];
  sim.espejo = (rec, vars) => vistos.push([rec.key, vars]);
  const u = sim.user;
  const cap = sim.agents.find((x) => x.fac === "mar") || sim.mkAgent({ fac: "mar", birthIsl: u.isl, isl: u.isl });
  sim.arrestar(cap, u, "patrulla");
  assert.ok(vistos.length >= 1, "el espejo recibió el evento");
  const arresto = vistos.find(([k, v]) => (k === "arresto" || k === "arresto_gran") && v.esJugador);
  assert.ok(arresto, "el arresto del agente jugador llega al espejo");
  assert.equal(arresto[1].b, sim.nm(u), "vars.b nombra al preso: el juego puede distinguir si YO era el preso");
});

// ── EL DIARIO DEL MAR ──
test("entradasDelSim: traduce el feed del mundo a formato gaceta con día, mar e importancia", () => {
  const feed = [
    { i: 1, t: 800, txt: "Algo pasa en el este", imp: 4, key: "x", reg: "east" },
    { i: 2, t: 1440 * 2 + 60, txt: "El cuerno suena", imp: 5, key: "nemesis", reg: null },
    { i: 3, t: 500, txt: "", imp: 3, key: "vacio", reg: null }, // sin texto: se descarta
  ];
  const entradas = entradasDelSim(feed, {});
  assert.equal(entradas.length, 2);
  assert.equal(entradas[0].day, 1, "floor(800/1440)+1 = día 1");
  assert.equal(entradas[1].day, 3, "floor(2940/1440)+1 = día 3");
  assert.equal(entradas[1].imp, 5);
});

test("entradasDelSim: filtra por mar (canon) y por importancia para Lo importante", () => {
  const feed = [
    { i: 1, t: 100, txt: "Pelea en East Blue", imp: 6, reg: "east" },
    { i: 2, t: 120, txt: "Mercado en West Blue", imp: 6, reg: "west" },
    { i: 3, t: 140, txt: "Susurro sin mar", imp: 6, reg: null },
    { i: 4, t: 160, txt: "Charla menor", imp: 2, reg: "east" },
  ];
  const miMar = entradasDelSim(feed, { mar: "east" });
  assert.deepEqual(miMar.map((e) => e.text), ["Pelea en East Blue", "Susurro sin mar", "Charla menor"], "canon: tu mar entero — hasta las charlas menores son de tu casa");
  const importante = entradasDelSim(feed, { minImportancia: 5 });
  assert.equal(importante.length, 3, "imp>=5 (la charla menor queda fuera)");
});
