import test from "node:test";
import assert from "node:assert/strict";

import "../src/mundo/util.js";
import "../src/mundo/datos_mundo.js";
import "../src/mundo/datos_textos.js";
import "../src/mundo/simulacion.js";
import "../src/mundo/puente.js";

const { D, Sim, PUENTE, U } = globalThis;

test("el mundo genera islas y rutas navegables conectadas", () => {
  const sim = new Sim(12345);
  const navegables = D.ISLAS.filter((island) => !island.noNav && !island.oculta && island.reg !== "RL" && island.reg !== "BM");
  const visitadas = new Set(["foosha"]);
  const cola = ["foosha"];

  while (cola.length) {
    for (const neighbor of sim.vecinos[cola.shift()] || []) {
      if (!visitadas.has(neighbor)) {
        visitadas.add(neighbor);
        cola.push(neighbor);
      }
    }
  }

  assert.ok(D.ISLAS.length >= 48);
  assert.ok(sim.agents.length >= 150);
  assert.ok(sim.crews.length >= 20);
  assert.ok(navegables.every((island) => visitadas.has(island.id)));
});

test("la simulación mantiene actividad tras dos mil pasos", () => {
  const sim = new Sim(67890);
  for (let i = 0; i < 2000; i++) sim.step();
  assert.ok(sim.feed.length > 100);
});

test("el jugador nuevo conserva el contrato de identidad y recursos", () => {
  const sim = new Sim(54321);
  const player = sim.crearJugador({
    nombre: "Capitana",
    camino: "pir",
    mar: "EB",
    sueno: "libertad",
    oficio: "navegante",
    rasgos: {},
    secreto: "sabio"
  });
  assert.equal(player.user, true);
  assert.equal(player.berries, 10000);
  assert.equal(player.level, 1);
  assert.equal(sim.user, player);
});

test("los susurros responden y clasifican instrucciones de texto", () => {
  const sim = new Sim(24680);
  const player = sim.crearJugador({ nombre: "Navegante", camino: "pir", mar: "EB", sueno: "libertad", oficio: "navegante", rasgos: {} });
  const result = sim.doWhisper(player, "explorar");
  assert.equal(result.ok, true);
  assert.equal(typeof result.obe, "boolean");
  assert.equal(PUENTE.clasificarSusurro("zarpa a otra isla"), "zarpar");
});

test("las recompensas publicadas se redondean a cifras utilizables", () => {
  for (const bounty of [1000, 5000, 128500, 12340000, 2000000000]) {
    assert.ok(U.cifraBonita(bounty) >= 1000);
  }
});
