// Tests del MUNDO VIVO: la voz del capitán, el rumbo, los primeros 90 s y el sonido.
import test from "node:test";
import assert from "node:assert/strict";

import "../src/mundo/util.js";
import "../src/mundo/datos_mundo.js";
import "../src/mundo/datos_textos.js";
import "../src/mundo/simulacion.js";
import "../src/mundo/abismo.js";
import "../src/mundo/sonido.js";

const { Sim, D, SONIDO } = globalThis;

// ── LA VOZ DEL CAPITÁN ──
test("vozSusurro: leal y obediente contesta en primera persona, no con un aviso genérico", () => {
  const fake = { rng: { int: () => 0 } };
  const a = { ocultos: { lealtad: 8 }, stats: { ing: 5 }, hp: 80, anim: 'Tranquilo', sueno: 'riqueza' };
  const voz = Sim.prototype.vozSusurro.call(fake, a, 'explorar', true, false);
  assert.equal(typeof voz, 'string');
  assert.ok(voz.length > 2);
  assert.ok(!/Reinterpreta|Te ha hecho caso|No te ha hecho caso/.test(voz), "nada de avisos genéricos");
});

test("vozSusurro: la desobediencia de un capitán libre suena a su sueño, no a un bug", () => {
  const fake = { rng: { int: () => 0 } };
  const a = { ocultos: { lealtad: 5 }, stats: { ing: 5 }, hp: 80, anim: 'Tranquilo', sueno: 'libertad' };
  const voz = Sim.prototype.vozSusurro.call(fake, a, 'pelea', false, false);
  assert.ok(/mar|rumbo|decido/i.test(voz), `voz con carácter: "${voz}"`);
});

test("vozSusurro: herido o irritado se niega distinto que un prudente", () => {
  const fake = { rng: { int: () => 0 } };
  const herido = Sim.prototype.vozSusurro.call(fake, { ocultos: { lealtad: 5 }, stats: { ing: 5 }, hp: 20, anim: 'Tranquilo', sueno: 'riqueza' }, 'pelea', false, false);
  const irritado = Sim.prototype.vozSusurro.call(fake, { ocultos: { lealtad: 5 }, stats: { ing: 5 }, hp: 80, anim: 'Irritado', sueno: 'riqueza' }, 'pelea', false, false);
  assert.ok(/pedazos|ancla/.test(herido), `"${herido}"`);
  assert.ok(/Hoy|mañana/.test(irritado), `"${irritado}"`);
});

test("vozSusurro: reinterpretación promete SU versión", () => {
  const fake = { rng: { int: () => 0 } };
  const a = { ocultos: { lealtad: 5 }, stats: { ing: 9 }, hp: 80, anim: 'Tranquilo', sueno: 'riqueza' };
  const voz = Sim.prototype.vozSusurro.call(fake, a, 'explorar', false, true);
  assert.ok(/mi (manera|versión)|flanco/.test(voz), `"${voz}"`);
});

test("doWhisper: la voz viaja en las tres ramas del resultado", () => {
  const fake = Object.create(Sim.prototype);
  fake.rng = { chance: () => true, int: () => 0 };
  fake.probObediencia = () => 0.9;
  fake.ev = () => {};
  fake.t = 100;
  fake.nm = (a) => a.name || 'x';
  const a = { id: 1, name: 'Rune', stats: { ing: 5 }, ocultos: { obed: 5, lealtad: 8 }, hp: 80, anim: 'Tranquilo', sueno: 'riqueza', wh: null, nextThink: 0 };
  const obe = fake.doWhisper(a, 'explorar');
  assert.equal(obe.obe, true);
  assert.ok(obe.voz && obe.voz.length > 2, "obedece con voz");
  const fake2 = Object.create(Sim.prototype);
  fake2.rng = { chance: () => false, int: () => 0 };
  fake2.probObediencia = () => 0.2;
  fake2.ev = () => {};
  fake2.t = 100;
  fake2.nm = (x) => x.name;
  const a2 = Object.assign({}, a, { stats: { ing: 2 }, ocultos: { obed: 0, lealtad: 5 } });
  const noObe = fake2.doWhisper(a2, 'pelea');
  assert.equal(noObe.obe, false);
  assert.ok(noObe.voz && noObe.voz.length > 2, "rechaza con voz");
});

// ── TU PRÓXIMO PASO ──
test("rumboDelDia: con evento vivo manda el evento; con carga y mercado manda venderla", () => {
  const hogar = D.ISLAS.find((i) => i.juego);
  assert.ok(hogar, "hay al menos una isla del juego en el registro");
  const conEvento = Sim.prototype.rumboDelDia.call({ user: { isl: hogar.id }, evento: { isl: hogar.id }, guerra: { frentes: [] } });
  assert.equal(conEvento.k, 'evento');
  // con un AB falso la carga vale 10× en el mismo puerto: vender manda
  const vecina = D.ISLAS.find((i) => i.juego && i.id !== hogar.id);
  const ABreal = globalThis.AB; // no destruir el mundo para los tests que siguen
  globalThis.AB = { precio: (sim, isl) => (isl === hogar.id ? 100 : 1000) };
  try {
    const conCarga = Sim.prototype.rumboDelDia.call({
      user: { isl: hogar.id, cargo: { grano: { n: 2, costo: 100 } } },
      evento: null, guerra: { frentes: [] }, mercados: { [hogar.id]: { grano: { sto: 10, dem: 10 } } }
    });
    assert.ok(['vender', 'comercio'].includes(conCarga.k), `k real: ${conCarga.k}`);
    assert.ok(conCarga.txt.length > 10);
  } finally {
    globalThis.AB = ABreal;
  }
  assert.ok(vecina, "hay vecina para comerciar");
});

test("rumboDelDia: sin nada urgente propone explorar, nunca null ni vacío", () => {
  const r = Sim.prototype.rumboDelDia.call({ user: { isl: 'foosha' }, evento: null, guerra: { frentes: [] } });
  assert.ok(r && r.txt && r.txt.length > 10, JSON.stringify(r));
  assert.equal(r.k, 'explorar'); // sin mercados en el sim no promete precios ajenos
});

test("rumboDelDia: sin capitán responde null sin tirar", () => {
  assert.equal(Sim.prototype.rumboDelDia.call({ user: null }), null);
});

// ── LOS PRIMEROS 90 SEGUNDOS ──
test("citaPrimerEvento: con el despertar del capitán, el primer evento cae a 75 ticks y en SU isla", () => {
  const sim = new Sim(77);
  globalThis.AB.citaPrimerEvento(sim);
  assert.equal(sim._evProx - sim.t, 75, "el juego va a buscar al jugador YA");
  assert.equal(sim._primerEvento, true);
  // y la cita es idempotente con el resto del abismo: ensure no la pisa
  globalThis.AB.ensure(sim);
  assert.equal(sim._evProx - sim.t, 75, "ensure respeta la cita del despertar");
});

// ── EL SONIDO DEL MUNDO ──
test("SONIDO: en node (sin AudioContext) toca en silencio y el mute persiste", () => {
  assert.equal(typeof SONIDO.play, 'function');
  for (const p of ['ping', 'moneda', 'fallo', 'evento', 'cuerno', 'nivel', 'heredero']) {
    assert.doesNotThrow(() => SONIDO.play(p), `preset ${p} no tira`);
  }
  const antes = SONIDO.mudo();
  const ahora = SONIDO.toggle();
  assert.equal(ahora, !antes);
  assert.equal(SONIDO.mudo(), ahora);
  SONIDO.toggle(); // dejarlo como estaba
  assert.equal(SONIDO.mudo(), antes);
});

// ── SISTEMA NÉMESIS: el tirano fugado vuelve por su trono ──
import "../src/mundo/atmosfera.js";
const { ATM } = globalThis;

function fakeSimNemesis(control, frentes = []) {
  const fake = Object.create(Sim.prototype);
  fake.t = 5000;
  fake.control = control;
  fake.guerra = { frentes };
  fake.crews = []; fake.ships = [];
  fake.rng = { pick: () => 'Bestia' };
  fake.crewOf = () => null;
  fake.llegarIsla = (ag, isl) => { ag.isl = isl; fake._vuelto = isl; };
  fake.nm = (ag) => ag.name;
  fake.ev = (k, vars, opts) => { fake._ev = { k, vars, opts }; };
  return fake;
}
const jefeFugado = () => ({ id: 7, name: 'Kaido Falso', jefe: true, homeIsl: 'foosha', crew: -1, fac: 'pir', user: false, insignias: {} });

test("nemesisRetorna: el jefe fugado funda bandera, vuelve a casa y abre su frente de reconquista", () => {
  const fake = fakeSimNemesis({ foosha: 'ley' });
  const a = jefeFugado();
  const ok = Sim.prototype.nemesisRetorna.call(fake, a);
  assert.equal(ok, true);
  assert.equal(fake._vuelto, 'foosha', "vuelve a su trono, no a la vida civil");
  assert.equal(a.crew, 0, "bandera nueva sin peaje");
  assert.equal(fake.crews[0].nemesis, true, "crew marcada como némesis");
  const f = fake.guerra.frentes[0];
  assert.equal(f.isl, 'foosha');
  assert.equal(f.defensor, 'ley');
  assert.equal(f.tipo, 'asalto');
  assert.equal(f.rey, 7, "el frente sabe quién reclama el trono");
  assert.ok(/Retorno/.test(f.nom));
  assert.equal(fake._ev.k, 'nemesis');
  assert.equal(fake._ev.opts.impAdd, 2);
  assert.equal(a.insignias['nemesis'], 'nemesis', "insignia El Retorno");
});

test("nemesisRetorna: si su trono sigue suyo o ya hay pelea ahí, no abre nada", () => {
  const fake = fakeSimNemesis({ foosha: 'tirano' });
  assert.equal(Sim.prototype.nemesisRetorna.call(fake, jefeFugado()), false);
  const fake2 = fakeSimNemesis({ foosha: 'libre' }, [{ isl: 'foosha', moral: 10 }]);
  assert.equal(Sim.prototype.nemesisRetorna.call(fake2, jefeFugado()), false);
  assert.equal(fake2.guerra.frentes.length, 1, "frente original intacto");
  assert.equal(fake2.crews.length, 0, "sin bandera nueva");
});

test("nemesisRetorna: sin homeIsl o isla desconocida, no tumba nada", () => {
  const fake = fakeSimNemesis({});
  assert.equal(Sim.prototype.nemesisRetorna.call(fake, { jefe: true, crew: -1, id: 1, name: 'x', insignias: {} }), false, "sin homeIsl: nada que reclamar");
  const fake2 = fakeSimNemesis({ ningunSitio: 'ley' });
  assert.equal(Sim.prototype.nemesisRetorna.call(fake2, { jefe: true, homeIsl: 'ningunSitio', crew: -1, id: 2, name: 'y', insignias: {} }), false, "isla que no existe en ISLA");
});

test("nemesisRetorna: control indefinido se normaliza a 'libre' (sin crash en resolverFrente)", () => {
  const fake = fakeSimNemesis({}); // sin control asignado
  const a = jefeFugado();
  assert.equal(Sim.prototype.nemesisRetorna.call(fake, a), true);
  assert.equal(fake.guerra.frentes[0].defensor, 'libre');
});

test("marcaCerca: el toque cerca del ✦ aterriza en esa isla; lejos vuela a coordenadas", () => {
  const DI = { W: 800, H: 400, ISLA: { evia: { id: 'evia', n: 'Evia', x: 400, y: 200 }, frona: { id: 'frona', n: 'Frona', x: 100, y: 300 } } };
  // píxel de Evia en la brújula: ex=3 + 400*(142/800)=74, 3 + 200*(76/400)=41
  const golpecito = ATM.marcaCerca(75, 42, { evento: { isl: 'evia' }, guerra: { frentes: [] } }, DI);
  assert.ok(golpecito && golpecito.tipo === 'evento' && golpecito.isl === 'evia', JSON.stringify(golpecito));
  assert.equal(ATM.marcaCerca(140, 78, { evento: { isl: 'evia' }, guerra: { frentes: [] } }, DI), null, "lejos: el clic vuela libre");
  // ⚔ frente: píxel de Frona ≈ (20.75, 60) — el evento NO tapa al frente
  const frente = ATM.marcaCerca(21, 60, { evento: { isl: 'evia' }, guerra: { frentes: [{ isl: 'frona' }] } }, DI);
  assert.ok(frente && frente.tipo === 'frente' && frente.isl === 'frona', JSON.stringify(frente));
  // sin DI ni datos: null sin tirar
  assert.equal(ATM.marcaCerca(0, 0, null, null), null);
});

test("los titulares del némesis existen en D.TXT y son fuertes (cuerno garantizado)", () => {
  const { D } = globalThis;
  for (const k of ['nemesis', 'nemesisGana']) {
    const t = D.TXT[k];
    assert.ok(t, `falta el titular ${k}`);
    assert.ok(t.imp >= 5, `${k} imp=${t.imp}: sin impacto no suena el cuerno`);
    assert.ok(/\{a\}/.test(t.t) && /\{isla\}/.test(t.t), `${k} nombra al protagonista y su isla`);
  }
  assert.ok(D.INSIGNIAS.nemesis, "insignia El Retorno registrada");
});
