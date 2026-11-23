// Simulación: personajes autónomos, tripulaciones, barcos, ley y director de sucesos.
// Unidad de tiempo: 1 minuto de juego por paso. Rutas por vecinos más cercanos + especiales.
import { rollLineageRace } from '../races.js';
(function (G) {
  const { rng, clamp, dist, fill, cap, cifraBonita, fmtBelis, hhmm, esNoche } = G.U;
  const D = G.D;
  const WALK = 1.6;                 // casillas por minuto (dentro de isla)
  const BOUNTY_TOP = { EB: 3e7, NB: 3e7, WB: 3e7, SB: 3e7, PAR: 3e8, NW: 2e9 };
  const MULT_MAR = { EB: 1, NB: 1, WB: 1, SB: 1, PAR: 4, NW: 12 };
  const XP_NEED = (L) => Math.round(4.5 * Math.pow(L - 1, 2.05)) + 20;

  function Sim(seed) {
    this.rng = rng(seed || ((Date.now() % 100000) + 7));
    this.seed = seed || 7;
    this.t = 6 * 60;              // arranca un día 1 a las 06:00
    this.agents = []; this.crews = []; this.ships = []; this.storms = [];
    this.feed = []; this.archive = []; this.evId = 0;
    this.pop = {};                 // islaId -> [agentIds]
    this.charlaMem = {};           // islaId -> {parejaKey: count}
    this.frutasLibres = [];        // {k, isl}
    this.descubiertas = {};        // islaId -> agentId (primer pisa)
    this.cofres = {};              // islaId -> {until} rumor con cofre
    this.secretos = {};            // islaId -> {tipo, obj, descubierto, por, t}
    this.cubos = {};               // islaId -> {hallado, esMio, por, pistas, pista}
    this.cubosFin = false;
    this.cubosAzules = {};         // islaId -> {hallado, esMio, por}
    this.cuboDorado = { hallado: false, esMio: false, por: null };
    this.control = {};             // islaId -> 'ley' | 'tirano' | 'libre'
    this.initCubos();
    this.initCubosAzules();
    this.pozo = { prof: 0, cavadores: {}, fin: false, premio: 0 };
    this.emperadores = [];
    this.user = null;              // el agente del jugador
    this.rutas = this.calcRutas();
    this.vecinos = {};
    this.rutas.forEach(r => { (this.vecinos[r.a] || (this.vecinos[r.a] = [])).push(r.b); (this.vecinos[r.b] || (this.vecinos[r.b] = [])).push(r.a); });
    this.crearMundo();
  }

  // ── Rutas: 2-3 vecinos más cercanos por región + especiales ──
  Sim.prototype.calcRutas = function () {
    const islas = D.ISLAS.filter(i => !i.noNav && !i.oculta && i.reg !== 'RL' && i.reg !== 'BM');
    const rutas = [], seen = {};
    const add = (a, b, danger) => {
      const k = [a, b].sort().join('|');
      if (seen[k] || a === b) return; seen[k] = 1;
      rutas.push({ a, b, danger: danger || 1 });
    };
    for (const i of islas) {
      const d = islas.filter(j => j.id !== i.id && j.reg === i.reg)
        .map(j => ({ j, d: dist(i.x, i.y, j.x, j.y) })).sort((p, q) => p.d - q.d);
      d.slice(0, 2).forEach(x => add(i.id, x.j.id, i.reg === 'NW' ? 3 : i.reg === 'PAR' ? 2 : 1));
    }
    // Especiales: entrada a la Gran Ruta, cruce a Nuevo Mundo, cielo, bajo el mar
    const EB = D.ISLA.logue, NB = D.ISLA.basen, WB = D.ISLA.baseo, SB = D.ISLA.bases;
    const rev = D.ISLA.reverse;
    [EB, NB, WB, SB].forEach(i => add(i.id, rev.id, 3)); // cada mar escala el Monte Contracorriente
    add(rev.id, D.ISLA.whisky.id, 3);      // bajar de la montaña a la Gran Ruta
    add(D.ISLA.sabaody.id, 'g5', 4);       // cruce a Nuevo Mundo (nivel 16+)
    add(D.ISLA.jaya.id, 'skypiea', 4);     // corriente ascendente
    add(D.ISLA.sabaody.id, 'fishman', 3);  // burbuja de recubrimiento
    add('fishman', 'g5', 3);               // subir al Nuevo Mundo
    // Garantía de conectividad: une componentes sueltas con su par más cercano
    const grupos = {};
    islas.forEach(i => { grupos[i.id] = i.id; });
    const find = (x) => (grupos[x] === x ? x : (grupos[x] = find(grupos[x])));
    rutas.forEach(r => { const ra = find(r.a), rb = find(r.b); if (ra !== rb) grupos[ra] = rb; });
    const comp = {};
    islas.forEach(i => { (comp[find(i.id)] || (comp[find(i.id)] = [])).push(i); });
    const comps = Object.values(comp);
    while (comps.length > 1) {
      const c1 = comps.shift();
      let mejor = null, dd = 1e9, c2g = null;
      for (const c2 of comps) {
        for (const p of c1) for (const q of c2) {
          const dv = dist(p.x, p.y, q.x, q.y);
          if (dv < dd) { dd = dv; mejor = [p, q]; c2g = c2; }
        }
      }
      add(mejor[0].id, mejor[1].id, 2);
      const rc1 = find(mejor[0].id), rc2 = find(mejor[1].id);
      comps.splice(comps.indexOf(c2g), 1);
      comps.push(c1);
      grupos[rc1] = rc2;
    }
    return rutas;
  };

  // ── Creación del mundo ──
  Sim.prototype.crearMundo = function () {
    const R = this.rng;
    // Tripulaciones NPC por región
    const regiones = [['NB', 5], ['WB', 5], ['EB', 7], ['SB', 5], ['PAR', 8], ['NW', 6]];
    const nombreCrew = () => 'Los Piratas del ' + R.pick(D.CREW_ANIMAL);
    let idA = 0;
    const mkAgent = (cfg) => {
      const a = Object.assign({
        id: 'a' + (++idA), name: R.pick(D.NOMBRES) + ' ' + String.fromCharCode(65 + (idA % 26)) + '.',
        epi: null, fac: 'pir', rank: 0, level: R.int(3, 14), xp: 0,
        stats: { fue: 0, agi: 0, agu: 0, ing: 0 }, hp: 100,
        rasgos: {}, ocultos: {}, secreto: R.pick(D.SECRETOS).k, sueno: R.pick(D.SUEÑOS).k,
        oficio: R.pick(D.OFICIOS).k, birthIsl: null, isl: null, state: 'libre', act: '',
        crew: -1, ship: -1, berries: R.int(200, 3000), bounty: 0, inf: 0, lowUntil: -1,
        pos: { x: 0, y: 0 }, plan: null, nextThink: R.int(1, 40), fruta: null, maestria: 0,
        opinion: {}, insignias: {}, user: false, habil: [], arrestos: 0, cobros: 0, raza: null,
        anim: 'Tranquilo', necesita: { comer: R.int(0, 60), dormir: 0 }, frutasCount: 0
      }, cfg);
      const base = { fue: 6 + Math.round(a.level * 1.2), agi: 6 + Math.round(a.level * 1.1), agu: 6 + Math.round(a.level * 1.15), ing: 6 + Math.round(a.level * 1.0) };
      a.stats = base;
      D.EJES.forEach(e => { a.rasgos[e.k] = R.chance(0.5) ? 0 : 1; });
      D.OCULTOS_KEYS.forEach(k => { a.ocultos[k] = R.int(0, 10); });
      if (!a.raza) a.raza = this.razaDe();
      this.aplicarRaza(a);
      return a;
    };
    this.mkAgent = mkAgent;
    // tras cargar una partida con herederos, los ids nuevos no pueden colisionar con los guardados
    this.resemillarIds = function () {
      let mx = 0;
      for (const a of this.agents) { const n = parseInt(String(a.id).slice(1), 10); if (n > mx) mx = n; }
      if (mx > idA) idA = mx;
    };
    const islasNav = D.ISLAS.filter(i => !i.noNav && !i.oculta && i.reg !== 'RL' && i.reg !== 'BM');
    // Marines estructurales en cada base
    for (const isl of islasNav.filter(i => i.base)) {
      for (let k = 0; k < 4; k++) {
        const a = mkAgent({ fac: 'mar', rank: R.int(0, 3), birthIsl: isl.id, isl: isl.id });
        a.rasgos.justicia = 1; this.agents.push(a);
      }
    }
    // Tripulaciones piratas
    for (const [reg, n] of regiones) {
      for (let c = 0; c < n; c++) {
        const islR = islasNav.filter(i => i.reg === reg);
        const home = R.pick(islR).id;
        const crew = { id: this.crews.length, name: nombreCrew(), fac: 'pir', cap: null, mem: [], allies: [], wars: [], ship: this.ships.length, base: home, born: 0 };
        const ship = { id: this.ships.length, crew: crew.id, isl: home, dest: null, state: 'puerto', t0: 0, dur: 0, hull: 100, x: 0, y: 0, plan: null };
        this.crews.push(crew); this.ships.push(ship);
        const nMem = R.int(3, 7);
        for (let m = 0; m <= nMem; m++) {
          const a = mkAgent({ fac: 'pir', birthIsl: R.pick(islR).id, isl: home });
          a.crew = crew.id;
          this.agents.push(a);
          crew.mem.push(a.id);
          if (!crew.cap) { crew.cap = a.id; a.rank = 3; }
        }
        // recompensas iniciales coherentes con la región
        const top = { PAR: 1.5e8, NW: 6e8 }[reg] || 2e7;
        this.agents.slice(-nMem - 1).forEach((a, i) => { a.bounty = Math.round(top * (0.25 + 0.75 * (i === 0 ? 1 : R.rango(0.05, 0.4)))); a.inf = a.bounty; });
      }
    }
    // Cazarrecompensas sueltos y ciudadanos
    for (let k = 0; k < 14; k++) {
      const a = mkAgent({ fac: 'caz', birthIsl: R.pick(islasNav).id, isl: R.pick(islasNav).id });
      this.agents.push(a);
    }
    for (let k = 0; k < 16; k++) {
      const isl = R.pick(islasNav).id;
      const a = mkAgent({ fac: 'ciu', name: R.pick(D.NPC_CIU) + ' ' + String.fromCharCode(65 + (idA % 26)) + '.', birthIsl: isl, isl });
      a.level = R.int(1, 4); this.agents.push(a);
    }
    // Frutas libres en el mundo (4) y una en poder de alguien
    const frutas = D.FRUTAS.slice();
    for (let k = 0; k < 4; k++) {
      const f = frutas.splice(this.rng.int(0, frutas.length - 1), 1)[0];
      this.frutasLibres.push({ k: f.k, isl: R.pick(islasNav.filter(i => i.reg === 'PAR')).id });
    }
    const aFruta = R.pick(this.agents.filter(a => a.fac === 'pir'));
    const f = frutas.splice(this.rng.int(0, frutas.length - 1), 1)[0];
    this.darFruta(aFruta, f.k, false);
    // población por isla
    this.agents.forEach(a => this.pushPop(a));
    // el primer día: cartel publicado ya (los que empiezan con inf)
    this.publicarCarteles(true);
    // política del mundo: células revolucionarias y una isla tiranizada (tras crear a todos)
    this.semillasPoliticas();
  };
  G.D.OCULTOS_KEYS = ['valor', 'ambicion', 'lealtad', 'intel', 'codicia', 'curios', 'social', 'obed'];

  Sim.prototype.pushPop = function (a) {
    if (a.isl == null) return;
    (this.pop[a.isl] || (this.pop[a.isl] = [])).push(a.id);
  };
  Sim.prototype.popOf = function (isl) { return (this.pop[isl] || []).map(id => this.byId(id)); };
  Sim.prototype.mover = function (a, islId) {
    this.leaveIsland(a);
    a.isl = islId;
    a.pos = { x: this.rng.rango(-0.6, 0.6), y: this.rng.rango(-0.6, 0.6) };
    this.pushPop(a);
  };
  Sim.prototype.byId = function (id) { return this.agents.find(a => a.id === id); };
  Sim.prototype.crewOf = function (a) { return a.crew >= 0 ? this.crews[a.crew] : null; };
  Sim.prototype.nm = function (a) { return a.epi ? a.name + ' «' + a.epi + '»' : a.name; };
  Sim.prototype.isl = function (a) { return D.ISLA[a.isl]; };

  // ── Eventos (feed) ──
  Sim.prototype.ev = function (key, vars, opts) {
    const tpl = D.TXT[key]; if (!tpl) return;
    let t = fill(tpl.t, vars);
    const imp = (opts && opts.impAdd ? tpl.imp + opts.impAdd : tpl.imp) + ((vars && vars.esJugador) ? 2 : 0);
    // cada evento sabe en qué mar ocurrió: el feed puede filtrar por región (canon)
    const islaMencionada = vars && (vars.isla || vars.dest);
    const reg = (islaMencionada && D.MAR_POR_ISLA[islaMencionada]) || null;
    const rec = { i: ++this.evId, t: this.t, txt: t, imp, ids: (opts && opts.ids) || [], key, reg };
    this.feed.push(rec);
    if (this.feed.length > 500) this.feed.splice(0, this.feed.length - 500);
    if (imp >= 5) { this.archive.push(rec); if (this.archive.length > 400) this.archive.splice(0, this.archive.length - 400); }
  };

  // ── Fuerza y combate ──
  Sim.prototype.fuerza = function (a) {
    let f = 6 + 1.2 * a.level + 0.55 * (a.stats.fue * 0.6 + a.stats.agu * 0.4);
    if (a.fruta) f += 25 + 0.3 * a.stats.fue + a.maestria * 2;
    if (a.oficio === 'luchador') f *= 1.12;
    if (a.oficio === 'espadachin') f *= 1.1;
    if (a.rasgos.valor === 0) f *= 1.06; // Valiente
    return f;
  };
  Sim.prototype.porQue = function (a, b) {
    const R = this.rng;
    if (R.chance(0.55)) {
      if (a.stats.fue >= b.stats.fue && a.stats.ing < b.stats.ing) return 'Ganó por fuerza, aunque el otro era más listo.';
      if (a.stats.agi > b.stats.agi) return 'Ganó por agilidad.';
      if (a.stats.ing > b.stats.ing) return 'Ganó con astucia: el otro nunca vio de dónde vino.';
      if (a.stats.agu > b.stats.agu) return 'Ganó por aguante: se comió los golpes y siguió de pie.';
    }
    return R.pick(D.PORQUE);
  };
  Sim.prototype.shielded = function (att, def) {
    const novato = def.user && (this.t - def.nacidoT < 1440);
    return (novato && this.fuerza(att) > this.fuerza(def) * 1.5) || (def.lowUntil > this.t);
  };
  Sim.prototype.findTarget = function (a, otros) {
    let best = null, bs = 0;
    for (const b of otros) {
      if (!b || b.state !== 'libre' || b.isl !== a.isl || b.id === a.id) continue;
      if (a.crew >= 0 && b.crew === a.crew) continue;
      const op = a.opinion[b.id] || 0;
      if (op >= 50 || b.hp < 35 || this.shielded(a, b)) continue;
      let s = 0;
      const fa = D.BANDO[a.fac], fb = D.BANDO[b.fac];
      if ((a.fac === 'mar') && (b.fac === 'pir' || b.fac === 'rev') && b.bounty >= 2e6) s = (1 + b.bounty / 1e8);
      else if (a.fac === 'caz' && b.bounty >= 3e6) s = (1 + b.bounty / 1e8) * 0.9;
      else if (a.fac === 'pir' && b.fac === 'mar') s = (a.ocultos.valor >= 7 ? 1.2 : 0.6);
      else if (a.fac === 'pir' && b.fac === 'pir') s = (a.ocultos.ambicion >= 6 || op <= -30) ? 0.5 : 0;
      else if (a.crew >= 0 && b.crew >= 0 && this.crews[a.crew].wars.includes(this.crews[b.crew].id)) s = 1.6;
      if (a.sueno === 'destruccion' && b.fac !== 'ciu') s += 0.4;
      if (a.rasgos.genio === 0) s *= 1.2; // Agresivo
      if (s > bs) { bs = s; best = b; }
    }
    return bs > 0.3 ? best : null;
  };

  Sim.prototype.pelea = function (a, b, contexto) {
    if (!b || b.state !== 'libre') return null;
    const Ra = this.rng.rango(0.65, 1.35), Rb = this.rng.rango(0.65, 1.35);
    let fa = this.fuerza(a) * Ra, fb = this.fuerza(b) * Rb;
    // ayudantes: tripulación presente en la isla
    if (a.crew >= 0) { for (const m of this.popOf(a.isl)) if (m.crew === a.crew && m.id !== a.id) fa *= 1.1; }
    if (b.crew >= 0) { for (const m of this.popOf(b.isl)) if (m.crew === b.crew && m.id !== b.id) fb *= 1.1; }
    if (a.habil.includes('lider')) fa *= 1.06;
    if (a.rasgos.mente === 0 && this.rng.chance(0.5)) fa *= 1.08; // Listo golpea primero
    const ganaA = fa >= fb;
    const win = ganaA ? a : b, lose = ganaA ? b : a;
    const por = this.porQue(win, lose);
    // daño
    lose.hp = Math.max(1, lose.hp - Math.round(this.rng.int(25, 55)));
    win.hp = Math.max(5, win.hp - Math.round(this.rng.int(5, 20)));
    // XP y fama
    this.ganarXp(win, Math.max(2, Math.round(lose.level * 0.8)));
    // ley
    const oprimido = D.OPRIMIDAS.includes(lose.raza);
    const esArresto = ((win.fac === 'mar' || win.fac === 'caz') && (lose.fac === 'pir' || lose.fac === 'rev') && lose.bounty >= 2e6) ||
      (win.fac === 'mar' && oprimido && lose.fac !== 'mar' && lose.bounty >= 2e5);
    if (esArresto && win.fac === 'mar' && oprimido) lose._injusticia = true; // el agravio tiene memoria
    if (esArresto) { this.arrestar(win, lose, por); }
    else if (lose.fac === 'pir' && win.fac !== 'ciu') { this.addInf(lose, lose.bounty ? lose.bounty * 0.06 : 2e6 * (MULT_MAR[this.islReg(lose)] || 1)); }
    this.ev('derrota', { a: this.nm(win), b: this.nm(lose), isla: this.isl(win).n, por }, { ids: [win.id, lose.id], impAdd: (win.user || lose.user) ? 1 : 0 });
    win.victorias = (win.victorias || 0) + 1;
    if (win.victorias >= 10 && !win.insignias['veterano']) win.insignias['veterano'] = 'veterano';
    return { win, lose, por, esArresto };
  };

  Sim.prototype.arrestar = function (cap, preso, por) {
    preso.state = preso.bounty >= 3e7 ? 'prision' : 'calabozo';
    this.mover(preso, preso.bounty >= 3e7 ? 'impel' : cap.isl);
    preso.stateSince = this.t;
    preso.duracion = preso.bounty >= 3e7 ? this.rng.int(720, 1800) : this.rng.int(120, 360);
    cap.cobros = (cap.cobros || 0) + 1; cap.arrestos++;
    cap.insignias['arrestos'] = cap.arrestos >= 10 ? 'arrestos' : cap.insignias['arrestos'];
    this.popArrastre(cap, preso);
    const vars = { a: this.nm(cap), b: this.nm(preso), isla: this.isl(cap).n, por, recompensa: fmtBelis(preso.bounty), esJugador: cap.user || preso.user };
    this.ev(preso.bounty >= 3e7 ? 'arresto_gran' : 'arresto', vars, { ids: [cap.id, preso.id] });
    // rescate leal
    const leal = this.popOf(cap.isl).find(x => x !== cap && x.fac === preso.fac && (x.opinion[preso.id] || 0) >= 60 && x.ocultos.lealtad >= 7);
    if (leal && this.rng.chance(0.5)) {
      this.ev('rescate', { a: this.nm(leal), b: this.nm(preso), isla: this.isl(cap).n, esJugador: leal.user || preso.user }, { ids: [leal.id, preso.id] });
      preso.state = 'libre'; this.mover(preso, cap.isl); preso.lowUntil = this.t + 720; preso.duracion = 0;
      this.addInf(leal, leal.bounty ? 5e6 : 3e6);
      this.ganarXp(leal, 10);
    }
  };

  // ── Ley: infamia y carteles ──
  Sim.prototype.islReg = function (a) { const i = D.ISLA[a.isl]; return i ? i.reg : 'EB'; };
  Sim.prototype.addInf = function (a, amount) {
    const reg = this.islReg(a);
    const techo = BOUNTY_TOP[reg] || 3e7;
    a.inf = Math.min(techo, (a.inf || 0) + amount);
    a.crimeT = this.t;
  };
  Sim.prototype.publicarCarteles = function (silencioso) {
    for (const a of this.agents) {
      if (a.fac === 'mar' || a.fac === 'ciu') { a.inf = Math.max(0, (a.inf || 0) - 1e5); continue; }
      // rebaja por buena conducta (2 días sin crimen)
      if (this.t - (a.crimeT || 0) > 2880 && a.inf > 0) a.inf = Math.max(0, a.inf * 0.96 - 1e4);
      const objetivo = Math.min(a.inf, BOUNTY_TOP[this.islReg(a)] || 3e7);
      const nuevo = cifraBonita(objetivo);
      if (nuevo >= 5000 && (nuevo > a.bounty * 1.08 || (a.bounty === 0 && nuevo >= 5e5))) {
        const sube = a.bounty > 0;
        a.bounty = nuevo;
        if (!a.epi && nuevo >= 1e6) {
          a.epi = this.rng.pick(D.EPITETOS);
          this.ev('cartel', Object.assign({ a: this.nm(a), recompensa: fmtBelis(nuevo), isla: this.isl(a).n, esJugador: !!a.user }), { ids: [a.id] });
          if (a.user) a.insignias['primer cartel'] = 'primer cartel';
        } else {
          this.ev(sube ? 'sube' : 'cartel', { a: this.nm(a), recompensa: fmtBelis(nuevo), isla: this.isl(a).n, esJugador: !!a.user }, { ids: [a.id], impAdd: sube ? 0 : 1 });
        }
        if (nuevo >= 1e8 && a.fac === 'pir') this.ev('supernova', { a: this.nm(a), isla: this.isl(a).n, esJugador: !!a.user }, { ids: [a.id] });
      } else if (nuevo < a.bounty * 0.92 && a.bounty > 0) {
        a.bounty = nuevo;
        if (!silencioso) this.ev('rebaja', { a: this.nm(a), recompensa: fmtBelis(nuevo), esJugador: !!a.user }, { ids: [a.id] });
      }
    }
    // Cuatro Emperadores del Nuevo Mundo: solo entran los que suben al top-4 real
    const nw = this.crews.map(c => ({ c, cap: this.byId(c.cap), bounty: Math.max(...c.mem.map(id => (this.byId(id) || { bounty: 0 }).bounty)) }))
      .filter(x => x.cap && this.islReg(x.cap) === 'NW')
      .sort((p, q) => q.bounty - p.bounty).slice(0, 4);
    for (const x of nw) {
      if (x.cap && !this.emperadores.includes(x.cap.id) && x.bounty >= 5e8) {
        this.emperadores.push(x.cap.id);
        this.ev('emperador', { a: this.nm(x.cap), esJugador: !!x.cap.user }, { ids: [x.cap.id] });
      }
    }
  };

  // ── XP y niveles ──
  Sim.prototype.ganarXp = function (a, amount) {
    if (a.level >= 50) return;
    a.xp += amount;
    while (a.xp >= XP_NEED(a.level) && a.level < 50) {
      a.xp -= XP_NEED(a.level); a.level++;
      a.hp = 100;
      this.ev('nivel', { a: this.nm(a), n: a.level, esJugador: !!a.user }, { ids: [a.id] });
      if (a.level % 10 === 0 && a.habil.length < D.HABILIDADES.length) {
        const falta = D.HABILIDADES.filter(h => !a.habil.includes(h.k));
        const h = this.rng.pick(falta);
        a.habil.push(h.k);
        this.ev('habilidad', { a: this.nm(a), hab: h.n, esJugador: !!a.user }, { ids: [a.id] });
      }
    }
  };

  // ── Frutas ──
  Sim.prototype.darFruta = function (a, k, conEvento) {
    a.fruta = k; a.maestria = 1;
    if (!a.epi) { const f = D.FRUTAS.find(x => x.k === k); if (f) a.epi = f.n.replace('Fruta ', ''); }
    if (conEvento) this.ev('fruta', { a: this.nm(a), fruta: (D.FRUTAS.find(x => x.k === k) || {}).n, esJugador: !!a.user }, { ids: [a.id] });
    if (a.user) a.insignias['fruta'] = 'fruta';
  };
  Sim.prototype.comerFruta = function (a, k) {
    if (a.fruta || !k) return false;
    this.darFruta(a, k, true);
    return true;
  };

  // ── Opiniones y charlas ──
  Sim.prototype.setOp = function (a, b, delta) {
    const v = clamp((a.opinion[b.id] || 0) + delta, -100, 100);
    a.opinion[b.id] = v;
    const primero = a.id < b.id; // el evento se cuenta una sola vez por pareja
    if (v >= 50 && (a.opinion[b.id + '_f'] || 0) === 0) {
      a.opinion[b.id + '_f'] = 1; b.opinion[a.id + '_f'] = 1;
      if (primero) {
        this.ev('amistad', { a: this.nm(a), b: this.nm(b), isla: this.isl(a).n, esJugador: a.user || b.user }, { ids: [a.id, b.id] });
        this.startCharla(a, b, 'amigos');
      }
    } else if (v <= -50 && (a.opinion[b.id + '_f'] || 0) === 0) {
      a.opinion[b.id + '_f'] = -1;
      if (primero) this.ev('rivalidad', { a: this.nm(a), b: this.nm(b), isla: this.isl(a).n, esJugador: a.user || b.user }, { ids: [a.id, b.id] });
    }
    // recorte a 40 opiniones más fuertes
    const keys = Object.keys(a.opinion).filter(k => !k.endsWith('_f'));
    if (keys.length > 40) {
      keys.sort((x, y) => Math.abs(a.opinion[x]) - Math.abs(a.opinion[y]));
      keys.slice(0, keys.length - 40).forEach(k => { delete a.opinion[k]; });
    }
  };
  Sim.prototype.startCharla = function (A, B, tipo) {
    if (A.state !== 'libre' || B.state !== 'libre' || A.isl !== B.isl) return;
    const activas = this.charlasActivas || (this.charlasActivas = []);
    const islaActivas = activas.filter(c => c.isl === A.isl).length;
    if (islaActivas >= 2) return;
    const rel = (A.opinion[B.id] || 0) >= 25 ? 'bien' : (A.opinion[B.id] || 0) <= -25 ? 'mal' : 'neutro';
    const noche = esNoche(this.minOfDay()) ? 1 : 0;
    const cand = D.CHARLAS.filter(c => {
      if (c.rel !== rel) return false;
      if (c.noche && !noche) return false;
      if (c.isl && c.isl !== A.isl) return false;
      if (c.rasgo) {
        const eje = D.EJES.find(e => e.polos.some(p => p.n === c.rasgo));
        if (!eje || A.rasgos[eje.k] !== 0) return false;
      }
      if (c.fac && !(c.fac.includes(A.fac) && c.fac.includes(B.fac))) return false;
      return true;
    });
    if (!cand.length) return;
    // memoria anti-repetición por isla
    const mem = (this.charlaMem[A.isl] || (this.charlaMem[A.isl] = {}));
    const frescos = cand.filter(c => (mem[c.l[0][1]] || 0) < 2);
    const guion = this.rng.pick(frescos.length ? frescos : cand);
    mem[guion.l[0][1]] = (mem[guion.l[0][1]] || 0) + 1;
    const charla = { A: A.id, B: B.id, isl: A.isl, t0: this.t, t1: this.t + 40, guion, tipo: tipo || 'normal' };
    activas.push(charla);
    A.act = 'Charla con ' + B.name; B.act = 'Charla con ' + A.name;
  };
  Sim.prototype.finCharlas = function () {
    const activas = this.charlasActivas || [];
    for (let i = activas.length - 1; i >= 0; i--) {
      const c = activas[i];
      if (this.t < c.t1) continue;
      const A = this.byId(c.A), B = this.byId(c.B);
      if (A && B && A.state === 'libre' && B.state === 'libre') {
        const bono = c.guion.cat === 'pique' ? this.rng.int(-22, -8) : this.rng.int(8, 18);
        this.setOp(A, B, bono); this.setOp(B, A, bono);
        if ((A.user || B.user) && c.guion.cat !== 'pique') { this.ev('amistad', { a: this.nm(A), b: this.nm(B), isla: this.isl(A).n, esJugador: true }, { ids: [A.id, B.id] }); }
      }
      activas.splice(i, 1);
      if (A) A.act = ''; if (B) B.act = '';
    }
  };
  Sim.prototype.charlaDe = function (agentId) {
    return (this.charlasActivas || []).find(c => (c.A === agentId || c.B === agentId) && this.t < c.t1);
  };

  // ── Movimiento entre islas (barcos) ──
  Sim.prototype.zarpar = function (a, destId, roba) {
    const crew = this.crewOf(a);
    const orig = D.ISLA[a.isl], dest = D.ISLA[destId];
    if (!dest || a.state !== 'libre') return false;
    if (!orig) return false;
    // Solo se navega por rutas que existen (las especiales cuentan como ruta)
    if (!this.rutas.some(r => (r.a === a.isl && r.b === destId) || (r.b === a.isl && r.a === destId))) return false;
    let ship = null;
    if (crew) ship = this.ships[crew.ship];
    if ((!ship || ship.state !== 'puerto' || ship.isl !== a.isl) && (roba || this.rng.chance(0.6))) {
      ship = null; // intenta robar/botar un bote
      // robar barco en el puerto (o botar un bote prestado)
      if (crew && this.rng.chance(0.55 + a.stats.ing * 0.02)) {
        ship = { id: this.ships.length, crew: crew ? crew.id : -1, isl: a.isl, dest: null, state: 'puerto', t0: 0, dur: 0, hull: 100, x: 0, y: 0, plan: null };
        this.ships.push(ship);
        if (crew) crew.ship = ship.id;
        this.ev('robarco', { a: this.nm(a), isla: orig.n, esJugador: !!a.user }, { ids: [a.id] });
        this.addInf(a, 8e6 * (MULT_MAR[this.islReg(a)] || 1));
      } else {
        ship = { id: this.ships.length, crew: crew ? crew.id : -1, isl: a.isl, dest: null, state: 'puerto', t0: 0, dur: 0, hull: 100, x: 0, y: 0, plan: null };
        this.ships.push(ship);
        if (crew) crew.ship = ship.id;
      }
    }
    if (!ship || ship.state !== 'puerto' || ship.isl !== a.isl) return false;
    const durMin = Math.max(30, Math.round(dist(orig.x, orig.y, dest.x, dest.y) / 5.2));
    ship.state = 'navegando'; ship.dest = destId; ship.t0 = this.t; ship.dur = durMin;
    ship.plan = { x0: orig.x, y0: orig.y, x1: dest.x, y1: dest.y, t0: this.t, dur: durMin };
    if (ship.crew === -1 && !crew) ship.crew = -1; // bote en solitario
    // pasan a navegar el que zarpa y sus compañeros de tripulación presentes
    const viajeros = crew
      ? this.popOf(a.isl).filter(m => m.crew === a.crew && m.state === 'libre')
      : [a];
    for (const m of viajeros) {
      this.leaveIsland(m); m.state = 'navegando';
      m.plan = { ship: ship.id, x0: orig.x, y0: orig.y, x1: dest.x, y1: dest.y, t0: this.t, dur: durMin };
    }
    this.ev(crew && crew.cap === a.id ? 'zarpar' : 'navega', { a: this.nm(a), crew: crew ? crew.name : 'bote de ' + a.name, isla: orig.n, dest: dest.n, esJugador: !!a.user }, { ids: [a.id] });
    a.act = 'Navegando a ' + dest.n;
    return true;
  };
  Sim.prototype.leaveIsland = function (a) {
    const arr = this.pop[a.isl];
    if (arr) { const i = arr.indexOf(a.id); if (i >= 0) arr.splice(i, 1); }
  };
  // ── Secretos de islas y los Cuatro Cubos Rojos (el mar guarda misterios) ──
  const PISTAS_CUBO = {
    tottoland: 'la cama dulce donde duerme un imperio de comida',
    wano: 'el país cerrado tras sus cascadas de nieve',
    zou: 'la espalda del elefante que camina desde hace mil años',
    hachinosu: 'la tumba de piratas que ningún mapa se atreve a nombrar'
  };
  Sim.prototype.initCubos = function () {
    ['tottoland', 'wano', 'zou', 'hachinosu'].forEach(id => {
      if (D.ISLA[id]) this.cubos[id] = { hallado: false, esMio: false, por: null, pistas: 0, pista: null };
    });
  };
  // Pista en taberna: el mundo susurra dónde puede dormir un Cubo Rojo.
  Sim.prototype.pistaCubo = function (a) {
    const libres = Object.keys(this.cubos).filter(id => !this.cubos[id].hallado && this.cubos[id].pistas < 3);
    if (!libres.length) return;
    const c = this.cubos[this.rng.pick(libres)];
    c.pistas++;
    const idCubo = Object.keys(this.cubos).find(k => this.cubos[k] === c);
    const azules = Object.keys(this.cubosAzules || {}).filter(k => this.cubosAzules[k].hallado).length;
    // causa-efecto: cada Cubo Azul leído convierte las pistas poéticas en coordenadas exactas
    c.pista = azules >= 1
      ? 'El Cubo Azul señala sin vueltas: ' + (D.ISLA[idCubo] ? D.ISLA[idCubo].n : 'un lugar imposible')
      : (PISTAS_CUBO[idCubo] || 'un lugar que los mapas esquivan');
    if (a.user) {
      this.ev('pistaCubo', { a: this.nm(a), isla: this.isl(a).n, obj: c.pista }, { ids: [a.id] });
      (a.momentos = a.momentos || []).push({ t: Math.floor(this.t), txt: 'Pista de Cubo Rojo: «' + c.pista + '»' });
    }
  };
  // Hallazgo de Cubo Rojo: el jugador explorando, o un capitán legendario rival.
  Sim.prototype.intentarCubo = function (a, rival) {
    const c = this.cubos[a.isl]; if (!c || c.hallado) return false;
    const pistas = Math.min(3, c.pistas);
    if (!this.rng.chance(rival ? 0.08 : 0.30 * (1 + 0.15 * pistas))) return false;
    c.hallado = true; c.esMio = !!a.user; c.por = a.user ? 'ti' : this.nm(a);
    if (a.user) {
      a.berries += 2e7;
      a.insignias['cuborojo'] = 'cuborojo';
      (a.momentos = a.momentos || []).push({ t: Math.floor(this.t), txt: 'Hallaste el Cubo Rojo de ' + D.ISLA[a.isl].n });
      this.ev('cuboHallado', { a: this.nm(a), isla: D.ISLA[a.isl].n }, { ids: [a.id], impAdd: 2 });
    } else {
      const crew = this.crewOf(a);
      this.ev('cuboRival', { crew: crew ? crew.name : 'un capitán sin bandera', isla: D.ISLA[a.isl].n }, {});
    }
    if (Object.keys(this.cubos).every(k => this.cubos[k].hallado)) {
      this.cubosFin = true;
      this.ev('cubosFin', {}, {});
      this.abrirRutaFinal();
      if (a.user) a.insignias['descifrador'] = 'descifrador'; // reunió los cuatro rojos
    }
    return true;
  };
  // El director siembra secretos por las islas (pocos a la vez, para que importen).
  Sim.prototype.secretoNuevo = function () {
    const pendientes = Object.keys(this.secretos).filter(k => !this.secretos[k].descubierto).length;
    const libres = D.ISLAS.filter(i => !i.noNav && !i.oculta && !this.secretos[i.id]);
    if (!libres.length || pendientes >= 5) return;
    const isl = this.rng.pick(libres);
    const t = this.rng.pick([
      ['un cofre atado con cuerdas de barco fantasma', 'cofre'],
      ['una ruina con letras talladas que nadie sabe leer', 'ruina'],
      ['una cueva que respira vapor tibio', 'cueva'],
      ['un jardín de frutas que solo abre de noche', 'jardin']
    ]);
    this.secretos[isl.id] = { tipo: t[1], obj: t[0], descubierto: false, por: null, t: Math.floor(this.t) };
  };
  // Explorar puede topar con un secreto (el Atlas lo recoge).
  Sim.prototype.intentarSecreto = function (a) {
    const s = this.secretos[a.isl]; if (!s || s.descubierto) return false;
    const suerte = (a.habil.includes('ojo') ? 1.35 : 1) * (a.user ? 1.25 : 1);
    if (!this.rng.chance(0.28 * suerte)) return false;
    s.descubierto = true; s.por = this.nm(a);
    a.berries += this.rng.int(5000, 60000);
    (a.momentos = a.momentos || []).push({ t: Math.floor(this.t), txt: 'Descubriste en ' + D.ISLA[a.isl].n + ': ' + s.obj });
    if (a.user) {
      a.secretosHallados = (a.secretosHallados || 0) + 1;
      if (a.secretosHallados >= 5) a.insignias['explorador'] = 'explorador';
      this.ev('secreto', { a: this.nm(a), isla: D.ISLA[a.isl].n, obj: s.obj }, { ids: [a.id], impAdd: 1 });
    } else {
      this.ev('secreto', { a: this.nm(a), isla: D.ISLA[a.isl].n, obj: s.obj }, {});
    }
    return true;
  };

  // ── Razas: reparto ponderado y bonos. La discriminación no es decorativa:
  // cambia la ley, los precios y radicaliza al oprimido hacia la revolución ──
  const TABLA_RAZAS = [['human', 0.70], ['fishman', 0.10], ['mink', 0.06], ['threeeye', 0.04],
    ['giant', 0.04], ['sky', 0.02], ['longlimb', 0.02], ['tontatta', 0.02],
    ['buccaneer', 0.008], ['lunarian', 0.002]];
  Sim.prototype.razaDe = function () {
    let r = this.rng.rango(0, 1);
    for (const [k, p] of TABLA_RAZAS) { if ((r -= p) <= 0) return k; }
    return 'human';
  };
  Sim.prototype.aplicarRaza = function (a) {
    const bono = (D.RAZAS_SIM[a.raza] || {}).bono || {};
    Object.keys(bono).forEach(k => { a.stats[k] = Math.max(1, (a.stats[k] || 0) + bono[k]); });
  };

  // ── Política del mundo: control de islas, células revolucionarias y tributo ──
  Sim.prototype.semillasPoliticas = function () {
    // bases Marines gobiernan con ley; una isla arranca tiranizada para que la cadena exista desde el día 1
    D.ISLAS.filter(i => i.base && !i.noNav).forEach(i => { this.control[i.id] = 'ley'; });
    const candidatas = D.ISLAS.filter(i => !i.noNav && !i.oculta && !i.base && !i.natal && i.reg !== 'RL');
    if (candidatas.length) this.tiranoNuevo(candidatas);
    // dos células revolucionarias esperando causa
    for (let c = 0; c < 2; c++) {
      const home = this.rng.pick(candidatas.length ? candidatas : D.ISLAS);
      const crew = { id: this.crews.length, name: 'Célula ' + this.rng.pick(D.CREW_ANIMAL), fac: 'rev', cap: null, mem: [], allies: [], wars: [], ship: -1, base: home.id, born: 0 };
      this.crews.push(crew);
      for (let m = 0; m < 3; m++) {
        const a = this.mkAgent({ fac: 'rev', birthIsl: home.id, isl: home.id, level: this.rng.int(6, 16) });
        a.crew = crew.id; crew.mem.push(a.id); if (!crew.cap) crew.cap = a.id;
        this.agents.push(a); this.pushPop(a);
      }
    }
  };
  Sim.prototype.tiranoNuevo = function (pool) {
    const libres = (pool || D.ISLAS.filter(i => !i.noNav && !i.oculta && !i.base && !i.natal && i.reg !== 'RL')).filter(i => this.control[i.id] !== 'tirano');
    if (!libres.length) return;
    const isl = this.rng.pick(libres);
    this.control[isl.id] = 'tirano';
    // canon: si la isla tiene gobernante establecido, el golpe lo nombra (Iceburg, Cobra...)
    if (D.GOBERNANTES[isl.id]) this.ev('tiranoCanon', { isla: isl.n, gobernante: D.GOBERNANTES[isl.id] }, {});
    else this.ev('tirano', { isla: isl.n }, {});
  };
  Sim.prototype.liberarIsla = function (islId, agentes) {
    const isl = D.ISLA[islId]; if (!isl || this.control[islId] !== 'tirano') return false;
    this.control[islId] = 'libre';
    const crew = agentes && agentes.length && this.crewOf(agentes[0]);
    this.ev('liberada', { crew: crew ? crew.name : 'la resistencia', isla: isl.n }, {});
    agentes.forEach(a => {
      this.addInf(a, 3e6);
      a.bounty += 5e6; a.level += 1;
      a.insignias['liberador'] = 'liberador';
    });
    return true;
  };
  // la opresión radicaliza: arresto injusto o tiranía cercana empuja a la célula
  Sim.prototype.radicalizar = function () {
    const candidatos = this.agents.filter(a => !a.user && a.state === 'libre' && a.fac !== 'rev' && a.fac !== 'mar' &&
      D.OPRIMIDAS.includes(a.raza) && (a._injusticia || this.control[a.isl] === 'tirano'));
    if (!candidatos.length) return;
    const a = this.rng.pick(candidatos);
    if (!this.rng.chance(a._injusticia ? 0.6 : 0.2)) return;
    let crew = this.crews.find(c => c.fac === 'rev' && c.mem.length < 6);
    if (!crew) {
      crew = { id: this.crews.length, name: 'Célula ' + this.rng.pick(D.CREW_ANIMAL), fac: 'rev', cap: null, mem: [], allies: [], wars: [], ship: -1, base: a.isl, born: this.t };
      this.crews.push(crew);
    }
    this.leaveIsland(a);
    a.fac = 'rev'; a.crew = crew.id; crew.mem.push(a.id); if (!crew.cap) crew.cap = a.id;
    a.bounty += 2e6; a._injusticia = false;
    this.pushPop(a);
    this.ev('seRev', { a: this.nm(a), isla: this.isl(a).n, crew: crew.name }, { ids: [a.id] });
  };
  // el tributo sangra a los pueblos bajo tirano (causa económica de la revuelta)
  Sim.prototype.tributoTirano = function () {
    const tiranos = Object.keys(this.control).filter(id => this.control[id] === 'tirano' && D.ISLA[id]);
    let pagado = false;
    tiranos.forEach(id => {
      this.popOf(id).filter(a => a.fac === 'ciu' && a.berries > 100).forEach(a => {
        const cuota = Math.max(20, Math.round(a.berries * 0.05));
        a.berries -= cuota; a.anim = 'Melancólico'; pagado = true;
        if (D.OPRIMIDAS.includes(a.raza)) a._injusticia = true;
      });
    });
    if (pagado && this.rng.chance(0.5)) {
      const id = this.rng.pick(tiranos);
      this.ev('tributo', { isla: D.ISLA[id].n }, {});
    }
  };

  // ── Los Cubos Azules: el Siglo Vacío habla; leen la ruta de los rojos ──
  Sim.prototype.initCubosAzules = function () {
    ['ohara', 'skypiea', 'fishman'].forEach(id => { if (D.ISLA[id]) this.cubosAzules[id] = { hallado: false, esMio: false, por: null }; });
  };
  Sim.prototype.intentarCuboAzul = function (a) {
    const c = this.cubosAzules[a.isl]; if (!c || c.hallado) return false;
    const afinidad = a.raza === 'threeeye' ? 1.5 : 1;
    if (!this.rng.chance(0.22 * afinidad)) return false;
    c.hallado = true; c.esMio = !!a.user; c.por = a.user ? 'ti' : this.nm(a);
    if (a.user) {
      a.berries += 5e6;
      a.insignias['cubiazul'] = 'cubiazul';
      (a.momentos = a.momentos || []).push({ t: Math.floor(this.t), txt: 'Revelaste el Cubo Azul de ' + D.ISLA[a.isl].n });
      this.ev('cuboAzul', { a: this.nm(a), isla: D.ISLA[a.isl].n }, { ids: [a.id] });
    } else {
      this.ev('cuboAzul', { a: this.nm(a), isla: D.ISLA[a.isl].n }, {});
    }
    const leidos = Object.keys(this.cubosAzules).filter(k => this.cubosAzules[k].hallado).length;
    if (leidos >= Object.keys(this.cubosAzules).length) this.ev('historiaSecreta', {}, {});
    return true;
  };
  // el Cubo Dorado: solo existe tras los 4 rojos; corona al que lo levanta
  Sim.prototype.intentarCuboDorado = function (a) {
    if (!this.cubosFin || a.isl !== 'laugh' || this.cuboDorado.hallado) return false;
    if (!this.rng.chance(a.user ? 0.5 : 0.08)) return false;
    this.cuboDorado.hallado = true; this.cuboDorado.esMio = !!a.user; this.cuboDorado.por = a.user ? 'ti' : this.nm(a);
    if (a.user) {
      a.berries += 1e9;
      a.insignias['rey'] = 'rey';
      (a.momentos = a.momentos || []).push({ t: Math.floor(this.t), txt: 'Levantaste el Cubo Dorado en la isla final: Rey de los Piratas' });
      this.ev('cuboDorado', { a: this.nm(a) }, { ids: [a.id], impAdd: 1 });
    } else {
      this.ev('eraDorada', { a: this.nm(a) }, {});
    }
    return true;
  };
  // con los 4 rojos leídos, el mar dibuja la ruta final (persistente entre sesiones)
  Sim.prototype.abrirRutaFinal = function () {
    if (!this.cubosFin || !D.ISLA['laugh']) return;
    if (this.rutas.some(r => r.a === 'g5' && r.b === 'laugh')) return;
    this.rutas.push({ a: 'g5', b: 'laugh', danger: 4 });
    (this.vecinos['g5'] || (this.vecinos['g5'] = [])).push('laugh');
    (this.vecinos['laugh'] || (this.vecinos['laugh'] = [])).push('g5');
    this.ev('rutaFinal', {}, {});
  };

  Sim.prototype.llegarIsla = function (a, islId) {
    this.leaveIsland(a);
    a.isl = islId; a.state = 'libre'; a.plan = null; a.pos = { x: this.rng.rango(-0.6, 0.6), y: this.rng.rango(-0.6, 0.6) };
    this.pushPop(a);
    const isl = D.ISLA[islId];
    if (!this.descubiertas[islId] && !isl.oculta) {
      this.descubiertas[islId] = a.id;
      this.ev('primera', { a: this.nm(a), isla: isl.n, esJugador: !!a.user }, { ids: [a.id], impAdd: a.user ? 1 : 0 });
    }
    // el viaje propio se registra en CADA llegada: el Atlas y las insignias no
    // dependen de que el jugador haya pisado la isla antes que nadie
    if (a.user) {
      if (isl.reg === 'NW') a.insignias['nuevomundo'] = 'nuevomundo';
      if (isl.cielo) a.insignias['cielo'] = 'cielo';
      if (isl.bajoMar) a.insignias['bajomar'] = 'bajomar';
      a.islasPisadas = (a.islasPisadas || {}); a.islasPisadas[islId] = 1;
      const n = Object.keys(a.islasPisadas).length;
      if (n >= 15) a.insignias['coleccionista'] = 'coleccionista';
      const blues = { EB: 1, NB: 1, WB: 1, SB: 1 }; let b4 = true;
      for (const b of Object.keys(blues)) if (!Object.keys(a.islasPisadas).some(id => D.ISLA[id] && D.ISLA[id].reg === b)) b4 = false;
      if (b4) a.insignias['cuatromares'] = 'cuatromares';
      // Atlas del Alma: cada pisa queda registrada en su propio viaje
      a.atlas = a.atlas || {};
      const reg = a.atlas[islId] || (a.atlas[islId] = { n: 0, t0: Math.floor(this.t) });
      reg.n++;
      if (islId === 'laugh') a.insignias['final'] = 'final'; // llegar a la isla final merece su insignia
    }
    this.ev('atraca', { a: this.nm(a), isla: isl.n, esJugador: !!a.user }, { ids: [a.id] });
    // un capitán legendario puede hacerse con un Cubo Rojo aunque no seas tú
    if (!a.user && a.level >= 22 && this.cubos[islId] && !this.cubos[islId].hallado && this.rng.chance(0.05)) {
      this.intentarCubo(a, true);
    }
  };

  // ── Taberna: robo y rondas ──
  Sim.prototype.taberna = function (a) {
    const otros = this.popOf(a.isl).filter(x => x.id !== a.id && x.state === 'libre');
    if (!otros.length) return;
    const cod = a.ocultos.codicia;
    if (cod >= 7 && this.rng.chance(0.5)) {
      const v = this.rng.pick(otros);
      const pillado = this.rng.chance(0.25 + (v.stats.ing - a.stats.ing) * 0.05 + Math.max(0, (v.stats.agi - a.stats.agi)) * 0.04 + (['fishman', 'longlimb'].includes(a.raza) ? 0.10 : 0) - (a.raza === 'tontatta' ? 0.08 : 0));
      if (pillado) {
        this.ev('robo_pilla', { a: this.nm(a), b: this.nm(v), isla: this.isl(a).n, esJugador: a.user || v.user }, { ids: [a.id, v.id] });
        this.pelea(v, a, 'robo');
      } else {
        const cuantia = Math.min(v.berries, this.rng.int(100, 1500));
        v.berries -= cuantia; a.berries += cuantia;
        this.ev('robo', { a: this.nm(a), isla: this.isl(a).n, esJugador: a.user }, { ids: [a.id] });
        this.addInf(a, a.fac === 'pir' || a.fac === 'caz' ? 2e6 : 4e6);
        this.setOp(v, a, -25);
      }
    } else if (cod <= 2 && this.rng.chance(0.4)) {
      const ronda = Math.min(a.berries, this.rng.int(100, 600));
      a.berries -= ronda;
      this.ev('ronda', { a: this.nm(a), isla: this.isl(a).n, esJugador: a.user }, { ids: [a.id] });
      otros.forEach(v => this.setOp(v, a, this.rng.int(2, 6)));
    }
    // en la taberna corren los rumores: pistas de los Cubos Rojos
    if (a.user && this.rng.chance(0.3)) this.pistaCubo(a);
  };

  // ── Hallazgos (explorar/tesoro) ──
  Sim.prototype.hallazgo = function (a, conTesoro) {
    const R = this.rng;
    if (this.intentarSecreto(a) || this.intentarCubo(a, false) || this.intentarCuboAzul(a) || this.intentarCuboDorado(a)) return;
    const suerte = (a.habil.includes('ojo') ? 1.3 : 1) * (conTesoro ? 1.6 : 1);
    if (R.chance(0.30 * suerte)) {
      const reg = this.islReg(a);
      const n = R.int(50, 900) * (reg === 'PAR' ? 3 : reg === 'NW' ? 8 : 1);
      a.berries += n;
      this.ev('monedas', { a: this.nm(a), n, isla: this.isl(a).n, esJugador: !!a.user }, { ids: [a.id] });
      return;
    }
    if (R.chance(0.10 * suerte)) {
      const o = R.pick(D.OBJETOS);
      a.cofre = a.cofre || [];
      if (!a.cofre.some(x => x.k === o.k)) {
        a.cofre.push({ k: o.k, n: o.n, r: o.r, d: o.d });
        this.ev('reliquia', { a: this.nm(a), obj: o.n, isla: this.isl(a).n, esJugador: !!a.user }, { ids: [a.id], impAdd: o.r === 'legendaria' ? 2 : 0 });
      }
    }
    if (R.chance(0.06 * suerte) && this.cofres[a.isl] && this.cofres[a.isl].until > this.t) {
      a.berries += R.int(2000, 20000);
      delete this.cofres[a.isl];
      this.ev('hallazgo', { a: this.nm(a), isla: this.isl(a).n, esJugador: !!a.user }, { ids: [a.id] });
    }
    // frutas libres en la isla
    const idx = this.frutasLibres.findIndex(f => f.isl === a.isl);
    if (idx >= 0 && R.chance(0.5)) {
      const f = this.frutasLibres.splice(idx, 1)[0];
      if (!this.comerFruta(a, f.k)) this.frutasLibres.push({ k: f.k, isl: a.isl });
    }
    // botella
    if (R.chance(0.04 * suerte)) {
      const b = R.pick(D.BOTELLAS);
      a.cofre = a.cofre || [];
      a.cofre.push({ k: 'botella' + R.int(0, 9999), n: 'Mensaje en botella', r: 'pococomun', d: b });
    }
  };

  // ── Tripulaciones ──
  Sim.prototype.reclutar = function (a) {
    const crew = this.crewOf(a);
    if (!crew || a.crew < 0 || crew.mem.length >= 12) return;
    const cand = this.popOf(a.isl).find(x => x.id !== a.id && x.fac !== 'mar' && x.crew < 0 && x.state === 'libre' && (x.opinion[a.id] || 0) >= 0);
    if (cand && this.rng.chance(0.4 + (a.ocultos.social + cand.ocultos.social) * 0.03)) {
      cand.crew = crew.id; crew.mem.push(cand.id);
      this.ev('recluta', { a: this.nm(cand), crew: crew.name, esJugador: cand.user || a.user }, { ids: [cand.id, a.id] });
    }
  };
  Sim.prototype.fundar = function (a) {
    if (a.crew >= 0) return false;
    const precio = 200000;
    if (a.berries >= precio) {
      a.berries -= precio;
      const crew = { id: this.crews.length, name: 'Los Piratas del ' + this.rng.pick(D.CREW_ANIMAL), fac: a.fac === 'pir' ? 'pir' : a.fac, cap: a.id, mem: [a.id], allies: [], wars: [], ship: this.ships.length, base: a.isl, born: this.t };
      const ship = { id: this.ships.length, crew: crew.id, isl: a.isl, dest: null, state: 'puerto', t0: 0, dur: 0, hull: 100, x: 0, y: 0, plan: null };
      this.crews.push(crew); this.ships.push(ship);
      a.crew = crew.id; a.rank = 3;
      this.ev('funda', { a: this.nm(a), crew: crew.name, isla: this.isl(a).n, esJugador: !!a.user }, { ids: [a.id] });
      if (a.user) a.insignias['bandera'] = 'bandera';
      return true;
    }
    return false;
  };
  Sim.prototype.abandonar = function (a) {
    const crew = this.crewOf(a); if (!crew) return;
    crew.mem = crew.mem.filter(id => id !== a.id);
    if (crew.cap === a.id) {
      const cand = crew.mem.map(id => this.byId(id)).filter(m => m && m.state === 'libre').sort((p, q) => q.level - p.level)[0];
      if (cand) { crew.cap = cand.id; cand.rank = 3; this.ev('nuevoCap', { a: this.nm(cand), crew: crew.name, esJugador: cand.user }, { ids: [cand.id] }); }
    }
    a.crew = -1; a.rank = 0;
    this.ev('abandona', { a: this.nm(a), crew: crew.name, esJugador: !!a.user }, { ids: [a.id] });
  };
  Sim.prototype.popArrastre = function (cap, preso) {
    const crew = this.crewOf(preso);
    if (crew) {
      crew.mem = crew.mem.filter(id => id !== preso.id);
      if (crew.cap === preso.id) {
        const cand = crew.mem.map(id => this.byId(id)).filter(m => m && m.state === 'libre').sort((p, q) => q.level - p.level)[0];
        if (cand) { crew.cap = cand.id; cand.rank = 3; this.ev('nuevoCap', { a: this.nm(cand), crew: crew.name }, { ids: [cand.id] }); }
      }
      preso.crew = -1;
    }
  };

  // ── Comportamiento: qué hace cada personaje ──
  Sim.prototype.piensa = function (a) {
    if (a.state === 'calabozo' || a.state === 'prision') {
      if (this.t - (a.stateSince || 0) >= (a.duracion || 360)) {
        const eraPrision = a.state === 'prision'; // leer ANTES de sobrescribir el estado
        a.state = 'libre'; a.lowUntil = this.t + (eraPrision ? 720 : 180);
        a.insignias['fuga'] = (eraPrision && a.user) ? 'fuga' : a.insignias['fuga'];
        this.ev('fuga', { a: this.nm(a), isla: this.isl(a).n, esJugador: !!a.user }, { ids: [a.id] });
        if (eraPrision && a.isl === 'impel' && D.ISLA['logue']) this.llegarIsla(a, 'logue'); // Impel Down no tiene rutas: lo sueltan en Logue Town
      }
      return;
    }
    if (a.state === 'navegando') return; // lo mueve el barco
    if (a.hp < 35) { a.act = 'Descansando'; a.hp = Math.min(100, a.hp + 8); return; }
    const isl = this.isl(a);
    const noche = esNoche(this.minOfDay());
    const S = D.SUEÑOS.find(s => s.k === a.sueno);
    const sesgo = (S && S.sesgo) || {};
    const fx = (a.wh && a.wh.until > this.t) ? (a.wh.fx || {}) : {};
    const opts = [
      ['pasear', 0.35 * (fx.pasear || 1)],
      ['taberna', (0.12 + 0.35 * a.ocultos.social + (noche ? 0.4 : 0)) * (fx.taberna || 1) * (sesgo.taberna || 1)],
      ['explorar', (0.10 + 0.5 * a.ocultos.curios) * (fx.explorar || 1) * (sesgo.explorar || 1)],
      ['entrenar', (0.08 + 0.35 * a.ocultos.ambicion) * (fx.entrenar || 1) * (sesgo.entrenar || 1)],
      ['descansar', 0.06 * (fx.descansar || 1)],
      ['tesoro', (0.05 + 0.4 * (a.ocultos.codicia || 0)) * (fx.tesoro || 1)] // el susurro «Busca tesoros» ya tiene acción real
    ];
    if (a.fac === 'mar' || a.fac === 'caz') opts.push(['arrestar', (0.14 + 0.2 * a.ocultos.obed) * (fx.arrestar || 1) * (sesgo.arrestar || 1)]);
    else if (a.fac === 'pir' || a.fac === 'rev') opts.push(['pelea', 0.16 * (fx.pelea || 1) * (sesgo.pelea || 1)]);
    const miCrew = this.crewOf(a);
    // zarpar: con tripulación pesa más; sin ella, bote propio para CUALQUIER facción
    // (antes marines, cazadores y revolucionarios sin crew jamás salían de su base)
    if (a.crew >= 0) opts.push(['zarpar', 0.10 * (fx.zarpar || 1) * (sesgo.zarpar || 1) * (miCrew && miCrew.cap === a.id ? 2.2 : 1)]);
    else opts.push(['zarpar', 0.06 * (fx.zarpar || 1) * (sesgo.zarpar || 1)]);
    if (a.crew < 0 && a.fac === 'pir') opts.push(['fundar', 0.03 * (sesgo.lazos ? 0.5 : 1)]);
    if (a.crew >= 0 && this.crewOf(a).mem.length < 10) opts.push(['recluta', 0.05 * (fx.recluta || 1) * (sesgo.recluta || 1)]);
    if (this.pozo && !this.pozo.fin && a.isl === 'arabasta') opts.push(['cavar', 0.25]);
    const k = this.rng.weighted(opts) || 'pasear';
    this.hacer(a, k);
  };

  Sim.prototype.hacer = function (a, k) {
    const isl = this.isl(a);
    switch (k) {
      case 'pasear': a.act = 'Da un paseo'; a.pos = { x: this.rng.rango(-0.8, 0.8), y: this.rng.rango(-0.8, 0.8) }; break;
      case 'descansar': a.act = 'Descansa'; a.hp = Math.min(100, a.hp + 12); break;
      case 'taberna': {
        a.act = 'En la taberna';
        const otro = this.popOf(a.isl).find(x => x.id !== a.id && x.state === 'libre');
        if (otro && this.rng.chance(0.5 + a.ocultos.social * 0.03)) this.startCharla(a, otro);
        else this.taberna(a);
        break;
      }
      case 'explorar': a.act = 'Explora ' + isl.n; if (this.rng.chance(0.4)) this.hallazgo(a, false); this.ganarXp(a, 1); break;
      case 'tesoro': a.act = 'Busca tesoros'; if (this.rng.chance(0.5)) this.hallazgo(a, true); break;
      case 'entrenar': a.act = 'Entrena'; this.ganarXp(a, 2); a.stats.fue = Math.min(99, a.stats.fue + (this.rng.chance(0.3) ? 1 : 0)); break;
      case 'pelea': { const t = this.findTarget(a, this.popOf(a.isl)); if (t) this.pelea(a, t); else a.act = 'Busca líos (no encuentra)'; break; }
      case 'arrestar': { const t = this.findTarget(a, this.popOf(a.isl)); if (t) this.pelea(a, t); else a.act = 'Patrulla'; break; }
      case 'recluta': a.act = 'Busca tripulación'; this.reclutar(a); break;
      case 'fundar': a.act = 'Piensa en fundar su propia bandera'; if (this.rng.chance(0.4)) this.fundar(a); break;
      case 'zarpar': {
        const miReg = this.islReg(a);
        const vec = (this.vecinos[a.isl] || []).filter(id => {
          const d = D.ISLA[id];
          if (!d) return false;
          if (d.oculta && !(d.final && this.cubosFin)) return false; // la isla final solo se navega tras la ruta dorada
          if (d.reg === 'NW' && a.level < 16) return false;
          if (d.reg === 'PAR' && a.level < 8 && miReg !== 'PAR') return false;
          if ((d.bajoMar || d.cielo) && a.level < 12) return false;
          return true;
        });
        if (vec.length) this.zarpar(a, this.rng.pick(vec));
        break;
      }
      case 'cavar': {
        a.act = 'Cava en el pozo del Oro Rosa';
        if (!this.pozo.fin) {
          this.pozo.cavadores[a.id] = (this.pozo.cavadores[a.id] || 0) + 1;
          a._cavoHoy = true;
        }
        break;
      }
    }
    a.nextThink = this.t + this.rng.int(4, 20);
  };

  // ── Director de sucesos (cada hora) ──
  Sim.prototype.director = function () {
    const R = this.rng;
    // tormentas móviles
    if (R.chance(0.25) && this.storms.length < 3) {
      const isl = R.pick(D.ISLAS.filter(i => !i.noNav && !i.oculta)); // las tormentas no delatan la isla final
      this.storms.push({ x: isl.x + R.rango(-100, 100), y: isl.y + R.rango(-60, 60), r: R.rango(40, 90), until: this.t + R.int(180, 480), islCerca: isl.id });
      this.ev('tormenta', { isla: isl.n }, {});
    }
    for (let i = this.storms.length - 1; i >= 0; i--) {
      const s = this.storms[i];
      if (this.t > s.until) { this.storms.splice(i, 1); continue; }
      s.x += R.rango(-6, 6); s.y += R.rango(-4, 4);
    }
    // festival
    if (R.chance(0.15)) {
      const isl = R.pick(D.ISLAS.filter(i => !i.noNav && !i.oculta));
      this.fest = this.fest || {}; this.fest[isl.id] = this.t + 300;
      this.ev('festival', { isla: isl.n }, {});
    }
    // secretos de islas: el mar guarda misterios que esperan ser pisados
    if (R.chance(0.35)) this.secretoNuevo();
    // política: caída de gobernadores tiranos, revuelta y respuesta de la Marina
    const tiranos = Object.keys(this.control).filter(id => this.control[id] === 'tirano');
    if (R.chance(0.05) && tiranos.length < 4) this.tiranoNuevo();
    tiranos.forEach(id => {
      const rev = this.popOf(id).filter(x => x.fac === 'rev' && x.state === 'libre');
      if (rev.length >= 2 && R.chance(0.3)) this.liberarIsla(id, rev.slice(0, 3));
    });
    if (R.chance(0.4)) this.radicalizar();
    // la Marina extiende su caza a revolucionarios con cartel
    if (R.chance(0.12)) {
      const topRev = this.agents.filter(a => a.fac === 'rev' && a.bounty >= 5e7).sort((p, q) => q.bounty - p.bounty)[0];
      const crewRev = topRev && this.crewOf(topRev);
      if (topRev && crewRev && topRev.state === 'libre') this.ev('flota', { crew: crewRev.name, isla: this.isl(topRev).n }, { ids: [topRev.id] });
    }
    // rumor con cofre
    if (R.chance(0.2)) {
      const isl = R.pick(D.ISLAS.filter(i => !i.noNav && !i.oculta));
      this.cofres[isl.id] = { until: this.t + 2880 };
      this.ev('rumor', { isla: isl.n }, {});
    }
    // flota persigue al más buscado
    if (R.chance(0.12)) {
      const top = this.agents.filter(a => a.fac === 'pir' && a.bounty >= 5e7).sort((p, q) => q.bounty - p.bounty)[0];
      const crew = top && this.crewOf(top);
      if (top && crew && top.state === 'libre') this.ev('flota', { crew: crew.name, isla: this.isl(top).n, esJugador: top.user }, { ids: [top.id] });
    }
  };

  // ── Día a día: amanecer, pozo, reposición ──
  Sim.prototype.daily = function () {
    this.publicarCarteles(false);
    this.tributoTirano();
    // la constancia se premia: cien días de mar
    if (this.user && this.dia() >= 100 && !this.user.insignias['cien']) this.user.insignias['cien'] = 'cien';
    // pozo del Oro Rosa: avanza con los que cavaron + minero ausente
    if (!this.pozo.fin) {
      const cavadores = Object.keys(this.pozo.cavadores);
      const activos = cavadores.filter(id => this.byId(id) && this.byId(id)._cavoHoy);
      const metros = Math.min(2, 0.5 + activos.length * 0.5);
      this.pozo.prof = Math.round((this.pozo.prof + metros) * 10) / 10;
      cavadores.forEach(id => { const a = this.byId(id); if (a) a._cavoHoy = false; });
      const hitos = [50, 100, 150, 200, 230, 240];
      if (hitos.includes(Math.floor(this.pozo.prof))) this.ev('hito', { n: Math.floor(this.pozo.prof) }, {});
      this.ev('cava', { a: 'La cuadrilla del Oro Rosa', n: Math.floor(this.pozo.prof) }, {});
      if (this.pozo.prof >= 240) {
        this.pozo.fin = true;
        const parts = Object.keys(this.pozo.cavadores);
        parts.forEach(id => {
          const a = this.byId(id); if (!a) return;
          const lingotes = Math.min(30, this.pozo.cavadores[id]);
          a.berries += lingotes * 20000;
          a.insignias['ororosa'] = 'ororosa'; // la clave debe existir en D.INSIGNIAS para verse en la ficha
        });
        this.ev('pozoFin', { esJugador: parts.some(id => this.byId(id) && this.byId(id).user) }, {});
      }
    }
  };

  // ── Encuentros en el mar (cada 3 min) ──
  Sim.prototype.encuentrosMar = function () {
    for (const s of this.ships) {
      if (s.state !== 'navegando') continue;
      const crew = this.crews[s.crew];
      if (!crew || !crew.mem.length) continue;
      const cap = this.byId(crew.cap);
      // tormenta daña
      const st = this.storms.find(st => {
        const p = this.posBarco(s); return dist(p.x, p.y, st.x, st.y) < st.r;
      });
      if (st) {
        s.hull = Math.max(0, s.hull - this.rng.int(2, 6));
        if (s.hull <= 20 && !s._naufragio) { s._naufragio = true; this.ev('naufragio', { crew: crew.name, isla: D.ISLA[s.dest || s.isl].n, esJugador: cap && cap.user }, { ids: crew.mem.slice(0, 3) }); }
      }
      if (this.rng.chance(0.004) && s.dest) {
        // Rey Marino (raro y peligroso)
        this.ev('reymar', { isla: D.ISLA[s.dest || s.isl].n }, {});
        if (cap && this.rng.chance(0.35) && cap.state === 'navegando') {
          cap.hp = Math.max(1, cap.hp - 60);
          if (cap.hp <= 1 && cap.user) this.muerte(cap, 'reymar');
        }
      }
    }
  };

  Sim.prototype.posBarco = function (s) {
    if (!s.plan) return { x: D.ISLA[s.isl] ? D.ISLA[s.isl].x : 800, y: D.ISLA[s.isl] ? D.ISLA[s.isl].y : 400 };
    const p = s.plan, k = clamp((this.t - p.t0) / Math.max(1, p.dur), 0, 1);
    return { x: p.x0 + (p.x1 - p.x0) * k, y: p.y0 + (p.y1 - p.y0) * k };
  };

  // ── Muerte y heredero (idea One-Latam: la historia continúa) ──
  Sim.prototype.muerte = function (a, causa) {
    if (!a.user) {
      a.state = 'retirado'; a.act = 'Se retiró. Regenta una taberna en ' + this.isl(a).n;
      this.leaveIsland(a); return;
    }
    const heredero = this.mkAgent({
      fac: a.fac, level: Math.max(1, Math.round(a.level * 0.35)), birthIsl: a.birthIsl, isl: a.isl,
      sueno: a.sueno, oficio: a.oficio, name: a.name.split(' ')[0] + ' Jr.', raza: rollLineageRace(a.raza)
    });
    heredero.epi = 'Heredero de ' + a.name.split(' ')[0];
    heredero.bounty = Math.round(a.bounty * 0.25);
    heredero.user = true; heredero.nacidoT = this.t; heredero.state = 'libre';
    heredero.insignias['heredero'] = 'heredero';
    heredero.ocultos = Object.assign({}, a.ocultos);
    // opiniones heredadas (la mitad hacia la familia)
    Object.keys(a.opinion).forEach(k => { if (!k.endsWith('_f')) heredero.opinion[k] = Math.round((a.opinion[k] || 0) * 0.5); });
    this.agents.push(heredero);
    // despierta en una playa cualquiera: el mar decide dónde empieza la nueva historia
    const playas = D.ISLAS.filter(i => !i.noNav && !i.oculta && (i.reg === 'EB' || i.reg === 'SB'));
    const playa = playas.length ? this.rng.pick(playas) : D.ISLA[a.birthIsl];
    this.mover(heredero, playa.id);
    // la playa del despertar es la primera página de su Atlas
    heredero.atlas = heredero.atlas || {};
    heredero.atlas[playa.id] = { n: 1, t0: Math.floor(this.t) };
    (heredero.momentos = heredero.momentos || []).push({ t: Math.floor(this.t), txt: 'Despertaste en la playa de ' + playa.n });
    this.ev('despierta', { a: this.nm(heredero), isla: playa.n }, { ids: [heredero.id] });
    this.leaveIsland(a);
    a.state = 'muerto';
    this.ev('heredero', { a: this.nm(a), b: this.nm(heredero), isla: this.isl(a).n, esJugador: true }, { ids: [heredero.id] });
    this.user = heredero;
    this.onMuerte && this.onMuerte(a, heredero, causa);
  };

  // ── Susurros del jugador ──
  Sim.prototype.probObediencia = function (a, k) {
    let p = 0.35 + a.ocultos.obed * 0.045 + (a.ocultos.lealtad - 5) * 0.02;
    if (a.anim === 'Irritado' || a.anim === 'Melancólico') p -= 0.12;
    if (a.anim === 'Radiante') p += 0.06;
    if (a.hp < 35 && k !== 'descansar') p -= 0.1;
    if (D.SUEÑOS.find(s => s.k === a.sueno) && a.sueno === 'libertad' && (k === 'pelea' || k === 'zarpar')) p -= 0.05;
    if (a.user && a.nacidoT && this.t - a.nacidoT < 1440) p += 0.15; // primer día te hace caso casi siempre
    return clamp(p, 0.15, 0.92);
  };
  Sim.prototype.doWhisper = function (a, k, objetivoNombre) {
    const p = this.probObediencia(a, k);
    const obedece = this.rng.chance(p);
    const sus = D.SUSURROS.find(s => s.k === k);
    const corta = sus ? sus.n : k;
    // Reinterpretación One-Latam: ingenio alto y no obedece -> hace su propia versión
    if (!obedece && a.stats.ing >= 7 && this.rng.chance(0.35)) {
      a.wh = { k: 'reinterpret', until: this.t + 60, fx: { pasear: 1.4, taberna: 1.6 } };
      this.ev('reinterpret', { a: this.nm(a), corta, esJugador: true }, { ids: [a.id] });
      return { ok: true, obe: false, reinterpret: true };
    }
    if (!obedece) {
      this.ev('susurroNo', { a: this.nm(a), esJugador: true }, { ids: [a.id] });
      a.nextThink = this.t + 3;
      return { ok: true, obe: false };
    }
    a.wh = { k, until: this.t + 240, fx: (sus && sus.fx) || {} };
    a.nextThink = this.t + 1;
    return { ok: true, obe: true };
  };

  // ── Paso principal ──
  Sim.prototype.minOfDay = function () { return this.t % 1440; };
  Sim.prototype.dia = function () { return Math.floor(this.t / 1440) + 1; };
  Sim.prototype.step = function () {
    this.t++;
    const min = this.minOfDay();
    // barcos llegan
    for (const s of this.ships) {
      if (s.state !== 'navegando') continue;
      if (this.t >= s.t0 + s.dur) {
        s.state = 'puerto'; s.isl = s.dest; s.dest = null; s.plan = null;
        s.hull = Math.min(100, s.hull + 35); s._naufragio = false; // el astillero repara al atracar
        const crew = this.crews[s.crew];
        for (const m of this.agents) {
          if (m.state === 'navegando' && m.plan && m.plan.ship === s.id) this.llegarIsla(m, s.isl);
        }
        if (crew) { const cap = this.byId(crew.cap); if (cap && cap.act) cap.act = ''; }
      }
    }
    // agentes piensan
    for (const a of this.agents) {
      if (a.nextThink <= this.t) this.piensa(a);
    }
    this.finCharlas();
    if (this.t % 3 === 0) this.encuentrosMar();
    if (min % 60 === 0) this.director();
    if (min === 360) this.daily(); // amanecer: carteles + pozo
    // ánimo One-Latam: se actualiza poco
    if (this.t % 180 === 0) {
      for (const a of this.agents) {
        if (a.state !== 'libre') continue;
        const r = this.rng.rango(0, 1);
        if (a.hp < 40) a.anim = 'Irritado';
        else if (a.anim === 'Irritado' && r < 0.5) a.anim = 'Tranquilo';
        else if (r < 0.08) a.anim = this.rng.pick(['Radiante', 'Apatía', 'Melancólico', 'Tranquilo']);
        else if (a.anim !== 'Radiante' && r > 0.96) a.anim = 'Radiante';
      }
    }
  };

  // ── Crear personaje del jugador ──
  Sim.prototype.crearJugador = function (cfg) {
    const islasOrigen = { EB: 'foosha', NB: 'minion', WB: 'ohara', SB: 'baterilla' };
    const birth = islasOrigen[cfg.mar] || 'foosha';
    const a = this.mkAgent({
      fac: cfg.camino === 'avent' ? 'ciu' : cfg.camino,
      name: cfg.nombre, level: 1, birthIsl: birth, isl: birth, user: true
    });
    a.nacidoT = this.t; a.bounty = 0; a.inf = 0; a.berries = 10000;
    a.sueno = cfg.sueno; a.oficio = cfg.oficio;
    D.EJES.forEach((e, i) => { a.rasgos[e.k] = cfg.rasgos[e.k] || 0; });
    // stats de los polos elegidos
    D.EJES.forEach(e => { const polo = e.polos[a.rasgos[e.k]]; if (polo && polo.st) for (const k of Object.keys(polo.st)) a.stats[k] += polo.st[k]; });
    a.secreto = cfg.secreto || this.rng.pick(D.SECRETOS).k;
    this.agents.push(a);
    this.pushPop(a);
    this.user = a;
    this.descubiertas[birth] = a.id;
    this.ev('primera', { a: this.nm(a), isla: D.ISLA[birth].n, esJugador: true }, { ids: [a.id] });
    this.publicarCarteles(true);
    return a;
  };

  G.Sim = Sim;
  G.Sim.XP_NEED = XP_NEED; // la ficha y la sim comparten la misma fórmula de nivel
})(typeof window !== 'undefined' ? window : globalThis);
