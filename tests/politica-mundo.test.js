import test from "node:test";
import assert from "node:assert/strict";

import "../src/mundo/util.js";
import "../src/mundo/datos_mundo.js";
import "../src/mundo/datos_textos.js";
import "../src/mundo/simulacion.js";

const { D, Sim } = globalThis;

function simNuevo() {
  const sim = new Sim(42);
  return sim;
}

test("las razas se reparten con pesos, aplican bonos y el linaje hereda por reglas", () => {
  const sim = simNuevo();
  const conteo = {};
  sim.agents.forEach((a) => { conteo[a.raza] = (conteo[a.raza] || 0) + 1; });
  // humanos mayoritarios; lunarianes casi imposibles; todas las claves son válidas
  assert.ok((conteo.human || 0) > sim.agents.length * 0.5, "los humanos deben dominar el reparto");
  assert.ok(!(conteo.lunarian > 1), "los lunarianes son rarísimos");
  for (const a of sim.agents) assert.ok(D.RAZAS_SIM[a.raza], "raza desconocida: " + a.raza);
  // bono de raza aplicado a stats: un gigante del mismo nivel pega más que un humano
  const nivel = 10;
  const gigante = sim.mkAgent({ fac: "ciu", raza: "giant", level: nivel });
  const humano = sim.mkAgent({ fac: "ciu", raza: "human", level: nivel });
  assert.ok(gigante.stats.fue > humano.stats.fue, "el bono de gigante debe subir fuerza");
  const mink = sim.mkAgent({ fac: "ciu", raza: "mink", level: nivel });
  assert.ok(mink.stats.agi > humano.stats.agi, "el bono de mink debe subir agilidad");
});

test("la ley discrimina: la Marina arresta razas oprimidas con un décimo de cartel", () => {
  const sim = simNuevo();
  const mar = sim.agents.find((a) => a.fac === "mar");
  const pez = sim.mkAgent({ fac: "ciu", raza: "fishman", level: 5 });
  pez.bounty = 5e5; pez.isl = mar.isl; sim.agents.push(pez); sim.pushPop(pez);
  sim.pelea(mar, pez, "ley");
  const castigado = pez.state === "calabozo" || pez.state === "prision" || pez._injusticia === true;
  assert.ok(castigado, "un pez-hombre sin cartel grave no se salva del arresto");
  const h = sim.mkAgent({ fac: "ciu", raza: "human", level: 5 });
  h.bounty = 5e5; h.isl = mar.isl; h.hp = 100; sim.agents.push(h); sim.pushPop(h);
  h._injusticia = false; h.state = "libre";
  sim.pelea(mar, h, "ley");
  assert.equal(h._injusticia, false, "un humano con el mismo cartel no carga el agravio");
});

test("la opresión radicaliza: el oprimido bajo tirano se une a una célula revolucionaria", () => {
  const sim = simNuevo();
  const tirano = Object.keys(sim.control).find((k) => sim.control[k] === "tirano");
  assert.ok(tirano, "el mundo arranca con al menos una isla tiranizada");
  const op = sim.mkAgent({ fac: "ciu", raza: "fishman", level: 8 });
  op.isl = tirano; sim.agents.push(op); sim.pushPop(op);
  let convirtio = false;
  for (let k = 0; k < 60 && !convirtio; k++) {
    const antes = sim.agents.filter((a) => a.fac === "rev").length;
    sim.radicalizar();
    convirtio = sim.agents.filter((a) => a.fac === "rev").length > antes;
  }
  assert.ok(convirtio, "radicalizar debe convertir al oprimido");
  assert.ok(sim.feed.some((e) => e.key === "seRev"), "la conversión queda en la bitácora");
});

test("la revuelta libera la isla tirano y la Marina responde con cazadores de carteles", () => {
  const sim = simNuevo();
  const tirano = Object.keys(sim.control).find((k) => sim.control[k] === "tirano");
  const rev = [];
  for (let i = 0; i < 3; i++) {
    const a = sim.mkAgent({ fac: "rev", raza: "human", level: 12 });
    a.isl = tirano; sim.agents.push(a); sim.pushPop(a); rev.push(a);
  }
  assert.equal(sim.liberarIsla(tirano, rev), true);
  assert.equal(sim.control[tirano], "libre");
  assert.ok(rev[0].insignias.liberador, "los liberadores ganan insignia");
  assert.ok(rev[0].bounty > 0, "la Marina cuelga sus carteles: ahora son cazados");
});

test("el tributo del tirano sangra a los pueblos y deja memoria de agravio en oprimidos", () => {
  const sim = simNuevo();
  const tirano = Object.keys(sim.control).find((k) => sim.control[k] === "tirano");
  const ciu = sim.mkAgent({ fac: "ciu", raza: "human" });
  ciu.berries = 1000; ciu.isl = tirano; sim.agents.push(ciu); sim.pushPop(ciu);
  const op = sim.mkAgent({ fac: "ciu", raza: "longlimb" });
  op.berries = 1000; op.isl = tirano; sim.agents.push(op); sim.pushPop(op);
  sim.tributoTirano();
  assert.ok(ciu.berries < 1000, "el tributo cobra a todos");
  assert.ok(op._injusticia === true, "la cuota del oprimido se recuerda como agravio");
});

test("cubos azules: tres silencios del Siglo Vacío; al leer uno, las pistas dejan de ser acertijos", () => {
  const sim = simNuevo();
  const lector = sim.mkAgent({ fac: "ciu", raza: "threeeye" });
  lector.isl = "ohara"; sim.agents.push(lector);
  let revelado = false;
  for (let k = 0; k < 200 && !revelado; k++) revelado = sim.intentarCuboAzul(lector);
  assert.ok(revelado, "el lector tres-ojos revela el Cubo Azul de Ohara");
  assert.ok(sim.feed.some((e) => e.key === "cuboAzul"));
  sim.user = lector;
  let pista = null;
  for (let k = 0; k < 40 && !pista; k++) {
    sim.pistaCubo(lector);
    pista = Object.values(sim.cubos).find((c) => c.pista);
  }
  assert.ok(pista.pista.startsWith("El Cubo Azul señala"), "la pista tras un Azul es exacta, no poética");
});

test("el Cubo Dorado está sellado sin los cuatro rojos; con la saga cerrada corona Rey", () => {
  const sim = simNuevo();
  const heroe = sim.mkAgent({ fac: "pir", raza: "human", level: 30, user: true, birthIsl: "foosha", isl: "laugh" });
  sim.agents.push(heroe); sim.user = heroe; heroe.insignias = {};
  assert.equal(sim.intentarCuboDorado(heroe), false, "sin los 4 rojos la isla final no entrega nada");
  ["tottoland", "wano", "zou", "hachinosu"].forEach((id) => { sim.cubos[id].hallado = true; });
  sim.cubosFin = true;
  sim.abrirRutaFinal();
  assert.ok(sim.rutas.some((r) => r.a === "g5" && r.b === "laugh"), "abrirRutaFinal dibuja g5→laugh");
  let dorado = false;
  for (let k = 0; k < 60 && !dorado; k++) dorado = sim.intentarCuboDorado(heroe);
  assert.ok(dorado, "el Cubo Dorado se puede levantar con la ruta abierta");
  assert.equal(heroe.insignias.rey, "rey", "el hallador se corona Rey de los Piratas");
  assert.ok(sim.feed.some((e) => e.key === "cuboDorado"));
});

test("la ruta final sobrevive a la recarga: abrirRutaFinal es idempotente", () => {
  const sim = simNuevo();
  sim.cubosFin = true;
  sim.abrirRutaFinal();
  const con = sim.rutas.filter((r) => r.a === "g5" && r.b === "laugh").length;
  sim.abrirRutaFinal();
  assert.equal(sim.rutas.filter((r) => r.a === "g5" && r.b === "laugh").length, con, "no duplica la ruta");
});
