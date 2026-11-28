// abismo.js — EL MOTOR DEL ABISMO: la capa que convierte el mundo vivo en un
// MMO simulado. Mercados con precios que respiran, convoys que cruzan el mar,
// frentes de guerra que avanzan y caen, eventos de mundo con héroes y el pulso
// (rankings globales). Todo se guarda con el mundo; AB.ensure re-crea lo que
// falte en partidas viejas — migración gratis, sin romper el guardado v1.
(function () {
  'use strict';
  const AB = (globalThis.AB = globalThis.AB || {});
  const D = () => globalThis.D; // lazy: los datos ya viven cuando se llama

  // ── bienes del mercado: base de precio en berries ──
  const BIENES = [
    { k: 'grano', n: 'Grano', base: 150 },
    { k: 'rum', n: 'Rum', base: 320 },
    { k: 'medicina', n: 'Medicina', base: 780 },
    { k: 'armas', n: 'Armas', base: 1100 },
    { k: 'cartas', n: 'Cartas de navegar', base: 1900 },
  ];
  AB.BIENES = BIENES;

  // qué produce (+) y qué consume (−) cada isla según su tema, por hora sim
  const PROD = {
    verde: { grano: 3 }, tropical: { grano: 2, rum: 3 }, mar: { rum: 1 },
    industrial: { armas: 3, grano: -2 }, ciudad: { cartas: 2, grano: -2, medicina: -1 },
    base: { armas: -3, medicina: -2, grano: -2 }, natal: { grano: -1 },
    tribunal: { cartas: 1 }, restaurante: { rum: -1, grano: -1 },
  };

  // ── asegurar estado (migración de partidas viejas + mundos nuevos) ──
  function ensure(sim) {
    if (!sim.mercados) {
      sim.mercados = {};
      D().ISLAS.forEach((isl) => {
        if (isl.oculta) return; // las islas ocultas no tienen puerto abierto
        const m = {};
        BIENES.forEach((b) => { m[b.k] = { sto: 50, dem: 20, p: b.base, dir: 0 }; });
        sim.mercados[isl.id] = m;
      });
    }
    if (!sim.cargas) sim.cargas = []; // convoys en ruta {de, a, bien, n, llega}
    if (!sim.guerra) sim.guerra = { frentes: [], prox: (sim.t || 0) + 900 };
    if (sim.evento === undefined) sim.evento = null;
    if (sim._evProx === undefined) sim._evProx = (sim.t || 0) + 1200;
  if (sim._primerEvento === undefined) sim._primerEvento = true;
  }
  AB.ensure = ensure;
  // LOS PRIMEROS 90 SEGUNDOS: se dispara con el DESPERTAR del capitán (no con
  // el init del mundo, que corre antes de que existas). El primer evento sale
  // ya y en tu isla — el juego busca al jugador, no al revés.
  AB.citaPrimerEvento = function (sim) {
    sim._evProx = (sim.t || 0) + 75;
    sim._primerEvento = true;
  };

  // ── precio: stock bajo y demanda alta encarecen; feria y hambruna muerden ──
  function precio(sim, islId, k) {
    const m = sim.mercados[islId]; if (!m || !m[k]) return null;
    const b = BIENES.find((x) => x.k === k);
    const desc = (sim.evento && sim.evento.k === 'feria' && sim.evento.isl === islId) ? -0.25 : 0;
    const f = Math.max(0.35, Math.min(3, 1.35 - m[k].sto / 160 + m[k].dem / 150 + desc));
    return Math.round(b.base * f);
  }
  AB.precio = precio;

  // ── deriva de precios: cada 10 min respiran hacia su equilibrio ──
  function deriva(sim) {
    D().ISLAS.forEach((isl) => {
      const m = sim.mercados[isl.id]; if (!m) return;
      BIENES.forEach((b) => {
        const p = precio(sim, isl.id, b.k);
        const prev = m[b.k].p;
        m[b.k].p = p;
        m[b.k].dir = p > prev ? 1 : p < prev ? -1 : 0;
      });
    });
  }

  // ── producción y consumo por hora: el tipo de isla decide ──
  function producir(sim) {
    D().ISLAS.forEach((isl) => {
      const m = sim.mercados[isl.id]; if (!m) return;
      const tabla = PROD[isl.tema] || {};
      for (const k in tabla) {
        if (!m[k]) continue;
        m[k].sto = Math.max(0, Math.min(140, m[k].sto + tabla[k]));
        m[k].dem = Math.max(0, Math.min(100, m[k].dem - tabla[k] * 0.4));
      }
    });
    // la guerra muerde: frentes piden armas, medicina y grano
    (sim.guerra.frentes || []).forEach((f) => {
      const m = sim.mercados[f.isl]; if (!m) return;
      m.armas.dem = Math.min(100, m.armas.dem + 8);
      m.medicina.dem = Math.min(100, m.medicina.dem + 6);
      m.grano.dem = Math.min(100, m.grano.dem + 4);
      m.grano.sto = Math.max(0, m.grano.sto - 6);
    });
  }

  // ── convoys mercantes: cruzan el mar, llegan, o los asaltan ──
  function lanzarConvoys(sim, forzados) {
    const ISLAS = D().ISLAS, ISLA = D().ISLA;
    const rutas = forzados || [];
    // convoys naturales: quien tiene sobra envía a su vecino que carece
    if (!forzados) {
      ISLAS.forEach((isl) => {
        const m = sim.mercados[isl.id]; if (!m) return;
        const vecinos = (sim.vecinos[isl.id] || []).filter((v) => sim.mercados[v]);
        vecinos.forEach((v) => {
          BIENES.forEach((b) => {
            if (rutas.length >= 3) return;
            if (m[b.k].sto > 85 && sim.mercados[v][b.k].sto < 28 && sim.rng.chance(0.25)) {
              rutas.push({ de: isl.id, a: v, bien: b.k, n: sim.rng.int(8, 16) });
              m[b.k].sto -= 10;
            }
          });
        });
      });
    }
    rutas.forEach((c) => {
      const A = ISLA[c.de], B = ISLA[c.a]; if (!A || !B) return;
      const dist = globalThis.U.dist(A.x, A.y, B.x, B.y);
      // asalto pirata: si una crew pirata caza el mercante, la carga no llega
      const pira = sim.crews.filter((cr) => cr.fac === 'pir' && cr.mem.length);
      const asaltado = !forzados && pira.length && sim.rng.chance(0.2);
      if (asaltado) {
        const cr = pira[sim.rng.int(0, pira.length - 1)];
        sim.ev('asaltoConvoy', { isla: B.n, bien: (BIENES.find((x) => x.k === c.bien) || {}).n || c.bien }, { ids: cr.mem.slice(0, 2) });
        (cr.mem || []).forEach((id) => { const a = sim.byId(id); if (a) a.bounty += 4e5; });
      } else {
        sim.cargas.push({ ...c, llega: sim.t + Math.max(90, Math.min(600, Math.round(dist / 14))) });
        sim.ev('convoy', { isla: B.n, bien: (BIENES.find((x) => x.k === c.bien) || {}).n || c.bien }, { impAdd: -1 });
      }
    });
  }

  function llegarConvoys(sim) {
    const quedan = [];
    sim.cargas.forEach((c) => {
      const m = sim.mercados[c.a];
      if (!m || !m[c.bien]) return;
      if (sim.t < c.llega) { quedan.push(c); return; }
      m[c.bien].sto = Math.min(140, m[c.bien].sto + c.n);
      m[c.bien].dem = Math.max(0, m[c.bien].dem - 4);
    });
    sim.cargas = quedan;
  }

  // ── poder de cada bando: crews por nivel, guarniciones por control ──
  function poderCrew(sim, crewId) {
    const c = sim.crews[crewId]; if (!c) return 20;
    let p = 10;
    (c.mem || []).forEach((id) => {
      const a = sim.byId(id);
      if (a && a.state !== 'muerto' && a.state !== 'retirado') p += a.level * 3 + (a.bounty > 0 ? 2 : 0);
    });
    return p;
  }
  function poderDefensa(sim, islId) {
    const ISLA = D().ISLA, ctrl = sim.control[islId], isl = ISLA[islId];
    if (ctrl === 'ley') return 70 + (isl && isl.base ? 45 : 0);
    if (ctrl === 'tirano') {
      const jefe = sim.agents.find((a) => a.jefe && a.homeIsl === islId && a.state !== 'muerto' && a.state !== 'retirado');
      return 35 + (jefe ? jefe.level * 4 : 15);
    }
    return 22; // isla libre: poca guarnición
  }

  // ── frentes: avanzan cada 30 min, caen o se rompen ──
  function avanzarFrentes(sim) {
    const frentes = sim.guerra.frentes;
    for (let i = frentes.length - 1; i >= 0; i--) {
      const f = frentes[i];
      const at = f.atacante === 'mar' ? 90 : poderCrew(sim, f.atacante);
      const df = f.defensor === 'ley' || f.defensor === 'tirano' ? poderDefensa(sim, f.isl) : poderCrew(sim, f.defensor);
      f.moral += Math.round((at - df) / 30) + sim.rng.int(-4, 6);
      f.moral = Math.max(-60, Math.min(100, f.moral));
      if (f.moral >= 100) { resolverFrente(sim, f); frentes.splice(i, 1); }
      else if (f.moral <= -60) {
        const ISLA = D().ISLA;
        sim.ev('frenteRompe', { isla: ISLA[f.isl] ? ISLA[f.isl].n : f.isl, atacante: nombreAtacante(sim, f) }, { ids: f.atacante === 'mar' ? [] : (sim.crews[f.atacante] || {}).mem || [] });
        frentes.splice(i, 1);
      }
    }
  }

  function nombreAtacante(sim, f) {
    if (f.atacante === 'mar') return 'la Marina';
    const c = sim.crews[f.atacante];
    return c ? c.name : 'el asalto';
  }

  function resolverFrente(sim, f) {
    const ISLA = D().ISLA, isl = ISLA[f.isl];
    const nomAt = nombreAtacante(sim, f);
    const ctrl = sim.control[f.isl];
    if (f.tipo === 'asalto' && ctrl === 'tirano') {
      const c = sim.crews[f.atacante];
      const cap = c && sim.byId(c.cap);
      sim.liberarIsla(f.isl, cap ? [cap] : []);
    } else if (f.tipo === 'asalto' && ctrl === 'libre') {
      // NÉMESIS VICTORIOSO: el trono vuelve a SU dueño legítimo (f.rey), no a
      // un tirano genérico — la reconquista es PERSONAL, no un rebarajo de mapa
      const rey = f.rey ? sim.byId(f.rey) : null;
      if (rey && rey.homeIsl === f.isl) {
        sim.control[f.isl] = 'tirano';
        sim.ev('nemesisGana', { a: sim.nm(rey), isla: isl.n, crew: nomAt }, { ids: [rey.id], impAdd: 2 });
      } else {
        sim.tiranoNuevo([isl]);
      }
      const c = sim.crews[f.atacante];
      if (c) (c.mem || []).forEach((id) => { const a = sim.byId(id); if (a) a.bounty += 6e6; });
    } else if (f.tipo === 'asalto' && ctrl === 'ley') {
      sim.control[f.isl] = 'libre';
      sim.ev('liberada', { crew: nomAt, isla: isl.n }, {});
    } else {
      sim.ev('frenteRompe', { isla: isl.n, atacante: nomAt }, {});
    }
    sim.ev('frenteCae', { isla: isl.n, atacante: nomAt }, { ids: f.atacante === 'mar' ? [] : (sim.crews[f.atacante] || {}).mem || [] });
    const c2 = sim.crews[f.atacante];
    if (c2 && c2.mem) c2.mem.forEach((id) => { const a = sim.byId(id); if (a) a.insignias['vanguardia'] = 'vanguardia'; });
  }

  // ── campañas de guerra: cada 40-73 h el mundo abre un frente ──
  function campanas(sim) {
    sim.guerra.prox = sim.t + sim.rng.int(2400, 4400);
    const frentes = sim.guerra.frentes;
    if (frentes.length >= 2) return;
    const ISLAS = D().ISLAS, ISLA = D().ISLA;
    // la Marina elige el nido pirata más cargado de recompensa
    const tiranos = ISLAS.filter((i) => !i.oculta && i.reg !== 'RL' && sim.control[i.id] === 'tirano');
    // piratas y revolución eligen vecinos débiles del Gobierno
    const crews = sim.crews.filter((c) => (c.fac === 'pir' || c.fac === 'rev') && c.mem.length && c.base && ISLA[c.base]);
    crews.sort((a, b) => poderCrew(sim, b.id) - poderCrew(sim, a.id));
    for (const c of crews) {
      const blancos = (sim.vecinos[c.base] || []).filter((v) => {
        const isl = ISLA[v]; if (!isl || isl.oculta || !sim.mercados[v]) return false;
        if (c.fac === 'rev') return sim.control[v] === 'tirano';
        return sim.control[v] === 'ley' && !isl.base;
      });
      if (blancos.length) {
        const isl = ISLA[sim.rng.pick(blancos)];
        if (frentes.some((f) => f.isl === isl.id)) continue;
        frentes.push({ isl: isl.id, atacante: c.id, defensor: 'ley', tipo: 'asalto', moral: 10, nom: 'Frente de ' + isl.n, desc: c.name + ' marcha sobre el control del Gobierno.' });
        sim.ev(c.fac === 'rev' ? 'campanaRev' : 'campanaPir', { crew: c.name, isla: isl.n }, { ids: c.mem.slice(0, 3) });
        return;
      }
    }
    if (tiranos.length) {
      const isl = sim.rng.pick(tiranos);
      if (!frentes.some((f) => f.isl === isl.id)) {
        const jefe = sim.agents.find((a) => a.jefe && a.homeIsl === isl.id);
        frentes.push({ isl: isl.id, atacante: 'mar', defensor: 'tirano', tipo: 'asalto', moral: 5, nom: 'Frente de ' + isl.n, desc: 'La Marina asedia el nido del tirano.' });
        sim.ev('campanaMar', { isla: isl.n, jefe: jefe ? sim.nm(jefe) : 'el tirano' }, {});
      }
    }
  }

  // ── eventos de mundo: se anuncian, viven un día y dejan héroes ──
  const EVENTOS = [
    { k: 'caceria', nom: 'La Gran Cacería', dur: 1440,
      ini(sim) {
        const islas = D().ISLAS.filter((i) => !i.oculta && (i.tema === 'mar' || i.reg === 'GL'));
        return islas.length ? { isl: sim.rng.pick(islas).id } : null;
      },
      hora(sim, ev) {
        D().ISLAS.filter((i) => i.reg === (D().ISLA[ev.isl] || {}).reg).forEach((i) => {
          const m = sim.mercados[i.id]; if (!m) return;
          m.armas.dem = Math.min(100, m.armas.dem + 2); m.cartas.dem = Math.min(100, m.cartas.dem + 2);
        });
      },
      cierra(sim, ev) {
        const caz = sim.crews.filter((c) => c.fac === 'caz' && c.mem.length);
        const crew = caz.sort((a, b) => poderCrew(sim, b.id) - poderCrew(sim, a.id))[0];
        if (crew) { crew.mem.forEach((id) => { const a = sim.byId(id); if (a) a.bounty += 12e6; }); }
        return { crew: crew ? crew.name : 'los cazadores' };
      } },
    { k: 'hambruna', nom: 'La Bodega Vacía', dur: 2160,
      ini(sim) {
        const reg = sim.rng.pick(['EB', 'NB', 'SB', 'WB']);
        return { reg };
      },
      hora(sim, ev) {
        D().ISLAS.filter((i) => i.reg === ev.reg).forEach((i) => {
          const m = sim.mercados[i.id]; if (!m) return;
          m.grano.sto = Math.max(0, m.grano.sto - 2); m.grano.dem = Math.min(100, m.grano.dem + 2);
        });
      },
      cierra(sim) { return {}; } },
    { k: 'feria', nom: 'La Feria de los Mares', dur: 720,
      ini(sim) {
        const islas = D().ISLAS.filter((i) => !i.oculta && !i.noNav);
        const isl = sim.rng.pick(islas);
        sim.fest = sim.fest || {}; sim.fest[isl.id] = sim.t + 720;
        return { isl: isl.id };
      },
      hora() {},
      cierra() { return {}; } },
    { k: 'aurora', nom: 'La Aurora del Siglo', dur: 1440,
      ini(sim) {
        const conCubo = D().ISLAS.filter((i) => sim.cubos[i.id] && !sim.cubos[i.id].hallado && !i.oculta);
        const isl = conCubo.length ? sim.rng.pick(conCubo).id : sim.rng.pick(D().ISLAS.filter((i) => !i.oculta)).id;
        return { isl };
      },
      hora() {},
      cierra(sim, ev) {
        const cub = sim.cubos[ev.isl];
        if (cub && !cub.hallado) cub.pistas = (cub.pistas || 0) + 1;
        return {};
      } },
    { k: 'duelo', nom: 'El Duelo de las Cumbres', dur: 360,
      ini(sim) {
        const jefes = sim.agents.filter((a) => a.jefe && a.state !== 'muerto' && a.state !== 'retirado' && a.homeIsl);
        if (jefes.length < 2) return null;
        const a = sim.rng.pick(jefes);
        const otros = jefes.filter((x) => x.id !== a.id && x.isl !== a.isl);
        if (!otros.length) return null;
        const b = sim.rng.pick(otros);
        return { a: a.id, b: b.id };
      },
      hora() {},
      cierra(sim, ev) {
        const A = sim.byId(ev.datos.a), B = sim.byId(ev.datos.b);
        if (!A || !B) return {};
        const gana = A.level + sim.rng.int(0, 4) >= B.level ? A : B;
        const pierde = gana === A ? B : A;
        gana.bounty += 18e6; gana.level += 1; pierde.hp = Math.max(15, pierde.hp - 40);
        return { a: sim.nm(gana), b: sim.nm(pierde) };
      } },
    { k: 'consejo', nom: 'El Consejo del Mundo', dur: 1440,
      ini() { return {}; },
      hora(sim) {
        D().ISLAS.filter((i) => i.base).forEach((i) => {
          const m = sim.mercados[i.id]; if (!m) return;
          m.armas.dem = Math.min(100, m.armas.dem + 2);
        });
      },
      cierra(sim) {
        if (sim.radicalizar) sim.radicalizar();
        return {};
      } },
  ];
  AB.EVENTOS = EVENTOS;

  function lanzarEvento(sim) {
    // una sola llamada a ini por evento: el rng es semillado, llamarlo dos
    // veces daría islas distintas (y duelos nulos)
    let candidatos = [];
    for (const e of EVENTOS) {
      const d = e.ini(sim);
      if (d !== null && d !== undefined) candidatos.push([e, d]);
    }
    if (!candidatos.length) { sim._evProx = sim.t + 600; return; }
    // el primer evento del juego pasa DONDE ESTÁS: no en otra punta del mapa
    if (sim._primerEvento && sim.user && sim.user.isl) {
      const enMiIsla = candidatos.filter(([e, d]) => d && d.isl === sim.user.isl);
      if (enMiIsla.length) candidatos = enMiIsla;
      sim._primerEvento = false;
    }
    const [e, datos] = candidatos[sim.rng.int(0, candidatos.length - 1)];
    const ISLA = D().ISLA;
    sim.evento = { k: e.k, nom: e.nom, isl: datos.isl || null, reg: datos.reg || null, hasta: sim.t + e.dur, datos, heroes: [] };
    const vars = { isla: datos.isl ? ISLA[datos.isl].n : '', mar: D().NOMBRE_MAR ? (D().NOMBRE_MAR[datos.reg] || '') : '', a: '', b: '', crew: '' };
    if (e.k === 'duelo' && datos.a) { vars.a = sim.nm(sim.byId(datos.a)); vars.b = sim.nm(sim.byId(datos.b)); }
    sim.ev(e.k + '_a', vars, {});
    sim._evProx = sim.evento.hasta + sim.rng.int(1800, 4200);
  }

  function tickEvento(sim) {
    const ev = sim.evento;
    const e = EVENTOS.find((x) => x.k === ev.k);
    if (!e) { sim.evento = null; return; }
    if (sim.t % 60 === 0) e.hora(sim, ev);
    if (sim.t >= ev.hasta) {
      const vars = e.cierra(sim, ev) || {};
      vars.isla = ev.isl ? D().ISLA[ev.isl].n : '';
      vars.mar = ev.reg && D().NOMBRE_MAR ? (D().NOMBRE_MAR[ev.reg] || '') : '';
      sim.ev(ev.k + '_c', vars, {});
      // los héroes cobran: el mundo recuerda quién se unió
      ev.heroes.forEach((id) => {
        const a = sim.byId(id); if (!a) return;
        a.berries += 3e6; a.bounty += 8e6; a.insignias['abismo_' + ev.k] = 'abismo_' + ev.k;
      });
      sim.evento = null;
    }
  }

  // ── EL MINUTO: el corazón del abismo, llamado tras cada sim.step() ──
  function minuto(sim) {
    ensure(sim);
    const t = sim.t;
    if (t % 10 === 0) deriva(sim);
    if (t % 60 === 0) { producir(sim); lanzarConvoys(sim); }
    llegarConvoys(sim);
    if (t % 30 === 0 && (sim.guerra.frentes || []).length) avanzarFrentes(sim);
    if (t >= sim.guerra.prox) campanas(sim);
    if (!sim.evento && t >= sim._evProx) lanzarEvento(sim);
    if (sim.evento) tickEvento(sim);
  }
  AB.minuto = minuto;

  // ── EL PULSO: rankings y estado del mundo para la Vista Mundial ──
  function top(sim) {
    ensure(sim);
    const vivos = sim.agents.filter((a) => a.state !== 'muerto' && a.state !== 'retirado');
    const buscados = vivos.filter((a) => a.bounty > 0).sort((a, b) => b.bounty - a.bounty).slice(0, 5)
      .map((a) => ({ n: sim.nm(a), bounty: a.bounty }));
    const crews = sim.crews.map((c) => ({ n: c.name, fac: c.fac, poder: poderCrew(sim, c.id) }))
      .sort((a, b) => b.poder - a.poder).slice(0, 5);
    const hot = D().ISLAS.filter((i) => sim.mercados[i.id]).map((i) => {
      let mejor = null, delta = 0;
      BIENES.forEach((b) => {
        const m = sim.mercados[i.id][b.k];
        const d = m.p / b.base - 1;
        if (Math.abs(d) > Math.abs(delta)) { delta = d; mejor = b; }
      });
      return mejor ? { isl: i.n, bien: mejor.n, delta } : null;
    }).filter(Boolean).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
    return { buscados, crews, hot, frentes: sim.guerra.frentes.slice(0, 3), evento: sim.evento };
  }
  AB.top = top;

  // ── el jugador en la economía: carga, compra y venta ──
  function cargaCap(sim) { const u = sim.user; return u ? 10 + Math.floor(u.level * 2) : 10; }
  function cargaDe(sim) {
    const u = sim.user; if (!u || !u.cargo) return 0;
    return Object.values(u.cargo).reduce((s, c) => s + c.n, 0);
  }
  AB.cargaCap = cargaCap; AB.cargaDe = cargaDe;

  function comprar(sim, k) {
    const u = sim.user;
    if (!u) return { ok: false, msg: 'Tu alma aún no existe.' };
    ensure(sim);
    const m = sim.mercados[u.isl]; if (!m) return { ok: false, msg: 'Aquí no hay puerto con mercado.' };
    if (cargaDe(sim) >= cargaCap(sim)) return { ok: false, msg: 'Tu carga va llena: el barco no aguanta más.' };
    const p = precio(sim, u.isl, k);
    if (u.berries < p) return { ok: false, msg: 'No te alcanza para ' + k + ' (฿' + p.toLocaleString('es') + ').' };
    u.berries -= p;
    u.cargo = u.cargo || {};
    const c = u.cargo[k] || { n: 0, costo: 0 };
    c.costo = Math.round((c.costo * c.n + p) / (c.n + 1));
    c.n += 1;
    u.cargo[k] = c;
    m[k].sto = Math.max(0, m[k].sto - 5); // tu compra mueve el precio
    m[k].dem = Math.min(100, m[k].dem + 2);
    try { if (globalThis.SONIDO) globalThis.SONIDO.play('moneda'); } catch (e) { /* un sonido roto no tumba la compra */ }
    return { ok: true, msg: 'Comprado ' + k + ' a ฿' + p.toLocaleString('es') + '.' };
  }

  function vender(sim, k) {
    const u = sim.user;
    if (!u || !u.cargo || !u.cargo[k] || u.cargo[k].n <= 0) return { ok: false, msg: 'No llevas ' + k + ' para vender.' };
    const m = sim.mercados[u.isl]; if (!m) return { ok: false, msg: 'Aquí no hay puerto con mercado.' };
    const p = precio(sim, u.isl, k);
    const c = u.cargo[k];
    const ganancia = p - c.costo;
    u.berries += p;
    c.n -= 1;
    if (c.n <= 0) delete u.cargo[k];
    m[k].sto = Math.min(140, m[k].sto + 5);
    m[k].dem = Math.max(0, m[k].dem - 2);
    if (ganancia >= 1500) {
      sim.ev('mercadoGanancia', { a: sim.nm(u), isla: D().ISLA[u.isl].n, bien: (BIENES.find((x) => x.k === k) || {}).n }, { ids: [u.id], esJugador: true });
    }
    try { if (globalThis.SONIDO) globalThis.SONIDO.play('moneda'); } catch (e) { /* un sonido roto no tumba la venta */ }
    return { ok: true, msg: (ganancia >= 0 ? 'Vendido por ฿' + p.toLocaleString('es') + ' (ganancia ฿' + ganancia.toLocaleString('es') + ').' : 'Vendido por ฿' + p.toLocaleString('es') + ' (pérdida ฿' + (-ganancia).toLocaleString('es') + ').') };
  }

  // ── el jugador en la guerra y los eventos ──
  function unirseFrente(sim) {
    const u = sim.user; if (!u) return { ok: false, msg: 'Tu alma aún no existe.' };
    const f = (sim.guerra.frentes || []).find((fr) => fr.isl === u.isl);
    if (!f) return { ok: false, msg: 'Aquí no hay frente abierto.' };
    if ((u._frenteCd || 0) > sim.t) return { ok: false, msg: 'Aún te sangran las heridas del último asalto.' };
    u._frenteCd = sim.t + 720;
    const poder = u.level * 4 + (u.haki ? (u.haki.busoshoku || 0) + (u.haki.kenbunshoku || 0) : 0) * 5;
    const acierto = sim.rng.chance(Math.min(0.85, 0.3 + poder / 120));
    if (f.atacante === 'mar') {
      // el jugador defiende contra la Marina
      if (u.fac === 'mar' || u.fac === 'caz') return { ok: false, msg: 'Estás del lado equivocado de este frente.' };
      f.moral += acierto ? -sim.rng.int(10, 20) : -sim.rng.int(2, 6);
      if (acierto) { u.bounty += 5e6; u.berries += 2e6; u.insignias['vanguardia'] = 'vanguardia'; }
      u.hp = Math.max(20, u.hp - (acierto ? 12 : 25));
    } else {
      if (u.fac === 'mar' || u.fac === 'caz') return { ok: false, msg: 'Tu uniforme no marcha con ese asalto.' };
      f.moral += acierto ? sim.rng.int(10, 20) : sim.rng.int(2, 6);
      if (acierto) { u.bounty += 5e6; u.berries += 2e6; u.insignias['vanguardia'] = 'vanguardia'; }
      u.hp = Math.max(20, u.hp - (acierto ? 12 : 25));
    }
    const res = acierto ? 'Su nombre crece en el frente.' : 'Paga en sangre la intentona.';
    sim.ev('frenteTuyo', { a: sim.nm(u), isla: D().ISLA[u.isl].n, res }, { ids: [u.id], esJugador: true });
    return { ok: true, msg: acierto ? 'El frente se mueve por vos. +฿2.000.000.' : 'El frente te escupe: sobreviviste, nada más.' };
  }

  function unirseEvento(sim) {
    const u = sim.user; if (!u) return { ok: false, msg: 'Tu alma aún no existe.' };
    const ev = sim.evento;
    if (!ev) return { ok: false, msg: 'El mundo está en calma: ningún evento abierto.' };
    // escenario: la isla del evento, su mar… o el mundo entero (los eventos globales
    // como el Consejo se viven desde cualquier puerto)
    const presente = (ev.isl && ev.isl === u.isl) || (ev.reg && D().ISLA[u.isl] && D().ISLA[u.isl].reg === ev.reg) || (!ev.isl && !ev.reg);
    if (!presente) return { ok: false, msg: 'El evento sucede en otro mar: navega hasta él.' };
    if (ev.heroes.includes(u.id)) return { ok: false, msg: 'Ya estás dentro de ' + ev.nom + '.' };
    ev.heroes.push(u.id);
    sim.ev('eventoTuyo', { a: sim.nm(u), ev: ev.nom }, { ids: [u.id], esJugador: true });
    return { ok: true, msg: 'Entraste en ' + ev.nom + ': al cerrar, los héroes cobran.' };
  }

  // ── dispatcher único para la UI del pop ──
  AB.accion = function (sim, acc, arg) {
    if (acc === 'comprar') return comprar(sim, arg);
    if (acc === 'vender') return vender(sim, arg);
    if (acc === 'frente') return unirseFrente(sim);
    if (acc === 'evento') return unirseEvento(sim);
    return { ok: false, msg: '' };
  };

  // filas listas para pintar en el pop
  AB.precioFila = function (sim, islId) {
    ensure(sim);
    const m = sim.mercados[islId]; if (!m) return [];
    return BIENES.map((b) => ({ k: b.k, n: b.n, p: m[b.k].p, dir: m[b.k].dir, sto: m[b.k].sto }));
  };

  // costura para pruebas (node --test): internas deterministas al alcance del tester
  AB._pruebas = { avanzarFrentes, resolverFrente, poderDefensa, poderCrew, lanzarEvento, comprar, vender, unirseEvento, unirseFrente };
})();
