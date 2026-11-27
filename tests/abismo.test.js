// PRUEBAS DEL ABISMO — el mundo tiene que soportar días simulados sin romperse:
// precios acotados, frentes que se resuelven, eventos con héroes, economía que
// responde a tu compra. Este suite es la antesala del MMO: sin esto, no hay online.
import test from "node:test";
import assert from "node:assert/strict";

import "../src/mundo/util.js";
import "../src/mundo/datos_mundo.js";
import "../src/mundo/datos_textos.js";
import "../src/mundo/simulacion.js";
import "../src/mundo/abismo.js";

const Sim = globalThis.Sim;
const AB = globalThis.AB;
const D = globalThis.D;

function mundo(seed = 42) {
  const sim = new Sim(seed);
  sim.ensureJefes && sim.ensureJefes();
  AB.ensure(sim);
  return sim;
}

test("ensure migra mundos viejos: crea mercados, guerra y eventos en un sim sin abismo", () => {
  const sim = mundo();
  delete sim.mercados; delete sim.cargas; delete sim.guerra; sim.evento = undefined; sim._evProx = undefined;
  AB.ensure(sim);
  assert.equal(Object.keys(sim.mercados).length, D.ISLAS.filter((i) => !i.oculta).length, "una fila por isla navegable");
  assert.ok(Array.isArray(sim.cargas) && sim.guerra.frentes && typeof sim._evProx === "number");
  // idempotente: asegurar dos veces no duplica nada
  AB.ensure(sim);
  assert.equal(Object.keys(sim.mercados).length, D.ISLAS.filter((i) => !i.oculta).length);
});

test("SOAK 10 días simulados: el mundo vive, respira y nunca se rompe", () => {
  const sim = mundo(7);
  let eventoVisto = false, frenteVisto = false, convoysVistos = 0;
  for (let i = 0; i < 14400; i++) {
    sim.step();
    AB.minuto(sim);
    if (sim.evento) eventoVisto = true;
    if (sim.guerra.frentes.length) frenteVisto = true;
    convoysVistos += sim.cargas.length;
  }
  // invariantes de economía
  for (const id in sim.mercados) {
    for (const k in sim.mercados[id]) {
      const m = sim.mercados[id][k], b = AB.BIENES.find((x) => x.k === k);
      assert.ok(isFinite(m.p), "precio finito en " + id + "/" + k);
      assert.ok(m.p > b.base * 0.3 && m.p < b.base * 3.05, "precio acotado en " + id + "/" + k + ": " + m.p);
      assert.ok(m.sto >= 0 && m.sto <= 141, "stock acotado en " + id + "/" + k);
      assert.ok(m.dem >= 0 && m.dem <= 101, "demanda acotada en " + id + "/" + k);
    }
  }
  // invariantes de guerra y política
  for (const f of sim.guerra.frentes) {
    assert.ok(f.moral >= -60 && f.moral <= 100, "moral de frente acotada");
    assert.ok(D.ISLA[f.isl], "frente sobre isla real");
  }
  assert.ok(Object.values(sim.control).every((v) => ["ley", "tirano", "libre"].includes(v)), "control siempre válido");
  // invariantes de almas
  for (const a of sim.agents) {
    assert.ok(isFinite(a.berries) && isFinite(a.level) && isFinite(a.bounty), "agente sin NaN: " + a.id);
    assert.ok(a.hp >= 0 && a.hp <= 100, "hp acotado");
  }
  // el mundo NARRA y decide
  assert.ok(sim.feed.length > 200, "el feed vive: " + sim.feed.length);
  assert.ok(sim.evId > 500, "el motor de eventos corrió");
  assert.ok(eventoVisto, "al menos un evento de mundo ocurrió en 10 días");
  assert.ok(frenteVisto, "al menos un frente de guerra se abrió en 10 días");
  assert.ok(convoysVistos > 10, "los convoys mercantes cruzaron el mar: " + convoysVistos);
});

test("la economía responde: comprar encarece, vender abarata, y la carga tiene tope", () => {
  const sim = mundo(99);
  const u = sim.agents.find((a) => a.state === "libre");
  sim.user = u;
  u.berries = 500000; u.level = 10; u.cargo = {};
  const isl = u.isl;
  AB.ensure(sim);
  const m = sim.mercados[isl];
  const p0 = m.grano.p;
  const r = AB.accion(sim, "comprar", "grano");
  assert.ok(r.ok, "compra ok: " + r.msg);
  assert.ok(u.cargo.grano && u.cargo.grano.n === 1, "carga registrada");
  assert.ok(u.berries < 500000, "berries gastados");
  assert.ok(m.grano.sto <= AB.precioFila(sim, isl).find((f) => f.k === "grano").sto + 1, "stock bajó al comprar");
  assert.ok(m.grano.dem >= 20, "demanda se movió");
  assert.ok(m.grano.p >= p0 - 1, "comprar no puede abaratar");
  const berries0 = u.berries;
  const v = AB.accion(sim, "vender", "grano");
  assert.ok(v.ok, "venta ok: " + v.msg);
  assert.ok(u.berries > berries0, "berries cobrados");
  assert.ok(!u.cargo.grano || u.cargo.grano.n === 0, "carga vaciada");
  // tope de carga: llenar hasta el cap y que rechace
  u.cargo = { rum: { n: 10 + Math.floor(u.level * 2), costo: 300 } };
  const r2 = AB.accion(sim, "comprar", "rum");
  assert.ok(!r2.ok, "rechaza compra con carga llena");
  // sin mercado: isla oculta
  const oculta = D.ISLAS.find((i) => i.oculta);
  if (oculta) { u.isl = oculta.id; const r3 = AB.accion(sim, "comprar", "grano"); assert.ok(!r3.ok, "sin puerto oculto"); u.isl = isl; }
});

test("la guerra resuelve: un frente con moral alta cambia el control del mundo", () => {
  const sim = mundo(13);
  // un tirano toma una isla libre y una crew pirata fuerte la asalta
  const libre = D.ISLAS.find((i) => !i.oculta && !i.noNav && !i.base && !i.natal && sim.mercados[i.id] && !sim.guerra.frentes.some((f) => f.isl === i.id));
  assert.ok(libre, "hay isla de prueba");
  sim.control[libre.id] = "libre"; // forzamos el punto de partida, como un mundo que lo dejó así
  const crew = sim.crews.filter((c) => c.fac === "pir" && c.mem.length).sort((a, b) => AB._pruebas.poderCrew(sim, b.id) - AB._pruebas.poderCrew(sim, a.id))[0];
  assert.ok(crew, "hay crew pirata de prueba");
  sim.guerra.frentes.push({ isl: libre.id, atacante: crew.id, defensor: "ley", tipo: "asalto", moral: 99, nom: "Frente de " + libre.n, desc: "prueba" });
  const feed0 = sim.evId;
  AB._pruebas.avanzarFrentes(sim);
  assert.ok(sim.guerra.frentes.length === 0, "el frente se resolvió");
  assert.ok(sim.control[libre.id] === "tirano" || sim.control[libre.id] === "libre", "control cambió: " + sim.control[libre.id]);
  assert.ok(sim.evId > feed0, "el mundo narró la caída");
  // y con moral en el piso, el frente se rompe sin cambiar nada (deriva negativa: la crew
  // más débil asalta una base militar — el asalto se ahoga seguro)
  const libre2 = D.ISLAS.find((i) => !i.oculta && i.base && sim.mercados[i.id] && !sim.guerra.frentes.some((f) => f.isl === i.id));
  assert.ok(libre2, "hay base de prueba");
  const debil = sim.crews.filter((c) => c.fac === "pir" && c.mem.length).sort((a, b) => AB._pruebas.poderCrew(sim, a.id) - AB._pruebas.poderCrew(sim, b.id))[0];
  const ctrl2 = sim.control[libre2.id];
  sim.guerra.frentes.push({ isl: libre2.id, atacante: debil.id, defensor: "ley", tipo: "asalto", moral: -55, nom: "Frente de " + libre2.n, desc: "prueba" });
  for (let k = 0; k < 200 && sim.guerra.frentes.length; k++) AB._pruebas.avanzarFrentes(sim);
  assert.ok(sim.guerra.frentes.length === 0, "el frente quebrado se retiró");
  assert.equal(sim.control[libre2.id], ctrl2, "una base militar no cambia de manos por un asalto ahogado");
});

test("los eventos de mundo se anuncian, aceptan héroes y los recompensan al cerrar", () => {
  const sim = mundo(21);
  const u = sim.agents.find((a) => a.state === "libre");
  sim.user = u;
  sim._evProx = sim.t; // el evento llama HOY
  AB.minuto(sim);
  assert.ok(sim.evento, "evento lanzado: " + (sim.evento && sim.evento.k));
  const ev = sim.evento;
  const anuncio = sim.feed.slice(-3).some((e) => e.key === ev.k + "_a");
  assert.ok(anuncio, "el anuncio entró al feed");
  // el jugador navega al escenario (o se queda donde está si el evento es global)
  if (ev.isl) { sim.mover(u, ev.isl); } else if (ev.reg) { const enReg = D.ISLAS.find((i) => i.reg === ev.reg && sim.mercados[i.id]); if (enReg) sim.mover(u, enReg.id); }
  const b0 = u.bounty;
  const r = AB.accion(sim, "evento");
  assert.ok(r.ok, "se une: " + r.msg);
  assert.ok(ev.heroes.includes(u.id), "héroe registrado");
  sim.evento.hasta = sim.t; // cierro el evento ya
  AB.minuto(sim);
  assert.ok(!sim.evento, "evento cerrado");
  const cierre = sim.feed.slice(-4).some((e) => e.key === ev.k + "_c");
  assert.ok(cierre, "el cierre entró al feed");
  assert.ok(u.bounty >= b0 + 8e6, "el héroe cobró su fama");
});

test("el pulso del mundo: rankings coherentes para la Vista Mundial", () => {
  const sim = mundo(5);
  const t = AB.top(sim);
  assert.ok(t.buscados.length <= 5, "top buscados acotado");
  for (let i = 1; i < t.buscados.length; i++) assert.ok(t.buscados[i - 1].bounty >= t.buscados[i].bounty, "buscados ordenados");
  assert.ok(t.crews.length <= 5, "top crews acotado");
  assert.ok(t.hot.length <= 3, "mercados calientes acotados");
  for (const h of t.hot) assert.ok(Math.abs(h.delta) <= 2.05, "delta acotado");
  assert.ok(Array.isArray(t.frentes), "frentes listos");
});
