// Main: arranque, reloj de simulación, guardado en localStorage, sonido pentatónico.
(function (G) {
  const D = G.D, U = G.U, UI = G.UI, MAPA = G.MAPA, Sim = G.Sim;
  const $ = (id) => document.getElementById(id);
  const CLAVE = 'mp-latam-save-v1';

  // ── Sonido pentatónico (Web Audio, sin librerías) ──
  G.SFX = (function () {
    let ctx = null, silencio = false;
    try { silencio = localStorage.getItem('mp-latam-silencio') === '1'; } catch (e) {}
    const ac = () => {
      if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    };
    const P = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    let idx = 0;
    const tono = (f, dur, type, vol) => {
      const c = ac(); if (!c || silencio) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur + 0.05);
    };
    return {
      tick() { idx = (idx + 1) % P.length; tono(523.25 * Math.pow(2, P[idx] / 12), 0.12, 'triangle', 0.06); },
      campanilla() { tono(1046.5, 0.35, 'sine', 0.09); tono(1318.5, 0.3, 'sine', 0.05); },
      sello() { tono(392, 0.2, 'square', 0.05); setTimeout(() => tono(523.25, 0.3, 'square', 0.05), 120); },
      toggle() {
        silencio = !silencio;
        try { localStorage.setItem('mp-latam-silencio', silencio ? '1' : '0'); } catch (e) {}
        return silencio;
      },
      silencio() { return silencio; }
    };
  })();

  // ── Estado global del juego ──
  const J = G.JUEGO = { sim: null, ritmo: 1, msPorMin: 1200, timer: null, ultimoGuardado: 0 };

  J.guardar = function (silencioso) {
    if (!J.sim) return;
    try {
      const datos = { v: 1, seed: J.sim.seed, t: J.sim.t, agents: J.sim.agents, crews: J.sim.crews, ships: J.sim.ships, storms: J.sim.storms, feed: J.sim.feed, archive: J.sim.archive, pop: J.sim.pop, charlasActivas: J.sim.charlasActivas || [], charlaMem: J.sim.charlaMem, frutasLibres: J.sim.frutasLibres, descubiertas: J.sim.descubiertas, cofres: J.sim.cofres, secretos: J.sim.secretos, cubos: J.sim.cubos, cubosFin: J.sim.cubosFin, cubosAzules: J.sim.cubosAzules, cuboDorado: J.sim.cuboDorado, control: J.sim.control, pozo: J.sim.pozo, emperadores: J.sim.emperadores, user: J.sim.user ? J.sim.user.id : null, evId: J.sim.evId, rutas: null, vecinos: null };
      localStorage.setItem(CLAVE, JSON.stringify(datos));
      if (!silencioso) UI.toast('Partida guardada.');
    } catch (e) { UI.toast('No se pudo guardar (almacenamiento lleno)'); }
  };

  J.cargar = function () {
    let raw = null;
    try { raw = localStorage.getItem(CLAVE); } catch (e) {}
    if (!raw) return null;
    try {
      const d = JSON.parse(raw);
      if (d.v !== 1 || !d.agents) return null;
      const sim = new Sim(d.seed);
      // reemplaza el mundo generado por el guardado
      sim.agents = d.agents; sim.crews = d.crews; sim.ships = d.ships; sim.storms = d.storms || [];
      sim.feed = d.feed || []; sim.archive = d.archive || []; sim.pop = d.pop || {};
      sim.charlasActivas = d.charlasActivas || []; sim.charlaMem = d.charlaMem || {};
      sim.frutasLibres = d.frutasLibres || []; sim.descubiertas = d.descubiertas || {};
      sim.cofres = d.cofres || {}; sim.pozo = d.pozo; sim.emperadores = d.emperadores || [];
      if (d.secretos) sim.secretos = d.secretos;
      if (d.cubos) { sim.cubos = d.cubos; sim.cubosFin = !!d.cubosFin; }
      if (d.cubosAzules) sim.cubosAzules = d.cubosAzules;
      if (d.cuboDorado) sim.cuboDorado = d.cuboDorado;
      if (d.control) sim.control = d.control;
      sim.abrirRutaFinal(); // las rutas se recalculan al cargar: reabre la final si la saga ya cerró
      sim.resemillarIds && sim.resemillarIds(); // los ids nuevos no pueden colisionar con herederos guardados
      sim.ensureJefes && sim.ensureJefes(); // el que manda existe también en mundos guardados antes
      // migración de mundos antiguos (creados antes de las razas y la política):
      // cada alma recibe raza por sorteo ponderado con la semilla del mundo, y
      // el mapa político arranca si no existía (bases de la Marina, tirano, células rev)
      const sinRaza = sim.agents.some(a => !a.raza);
      if (sinRaza) sim.agents.forEach(a => { if (!a.raza) { a.raza = sim.razaDe(); sim.aplicarRaza(a); } });
      // los crews guardados pisan los frescos: re-semilla política si no hay células rev
      if (!sim.crews.some(c => c.fac === 'rev')) sim.semillasPoliticas();
      sim.evId = d.evId || 0;
      sim.t = d.t;
      sim.byId = function (id) { return this.agents.find(a => a.id === id); };
      sim.user = d.user ? sim.byId(d.user) : null;
      sim.onMuerte = onMuerteHandler; // sin esto, morir en una partida cargada pasaba en silencio
      if (window.AB) AB.ensure(sim); // el abismo migra con el mundo: mercados, guerra, eventos
      J.sim = sim;
      return sim;
    } catch (e) { console.warn('Guardado corrupto', e); return null; }
  };

  J.borrar = function () { try { localStorage.removeItem(CLAVE); } catch (e) {} };

  // ── Reanudar/crear el mundo ──
  const onMuerteHandler = (viejo, heredero) => { UI.toast('«' + viejo.name + '» se fue. «' + heredero.name + '» recoge su bandera.'); UI.cerrarFicha(); };
  J.nuevo = function () {
    J.borrar();
    J.sim = new Sim(Math.floor(Math.random() * 90000) + 1000);
    J.sim.ensureJefes && J.sim.ensureJefes(); // cada isla canónica nace con su jefe
    if (window.AB) AB.ensure(J.sim); // y nace con su abismo: mercados, guerra y eventos
    J.sim.onMuerte = onMuerteHandler;
  };

  J.iniciar = function () {
    const cargado = J.cargar();
    if (!cargado) { J.nuevo(); }
    UI.setSim(J.sim);
    // LOS TESTIGOS DEL MUNDO: cada evento importante deja huella VISIBLE en el mapa
    // (anillo expansivo, icono, humo de pelea) — lo que leés en la bitácora lo VES pasar.
    J.sim.onEvento = function (rec, vars) {
      try {
        if (!rec.imp || rec.imp < 4) return;
        const nIsla = vars && (vars.isla || vars.dest);
        const isl = nIsla ? D.ISLAS.find((x) => x.n === nIsla) : null;
        let x = isl ? isl.x : null, y = isl ? isl.y : null;
        if (x == null && rec.ids && rec.ids.length) {
          const a = J.sim.byId ? J.sim.byId(rec.ids[0]) : null;
          if (a && a.isl && D.ISLA[a.isl]) { x = D.ISLA[a.isl].x; y = D.ISLA[a.isl].y; }
        }
        if (x == null) return;
        const pings = J.sim._pings = J.sim._pings || [];
        pings.push({ x, y, t0: performance.now(), key: rec.key, imp: rec.imp });
        if (pings.length > 30) pings.splice(0, pings.length - 30);
      } catch (e) { /* un ping perdido no tumba nada */ }
    };
    MAPA.init($('mapa'), (i) => { if (i && typeof MAPA.enfocarIsla === 'function') MAPA.enfocarIsla(i); UI.abrirIsla(i); });
    wire();
    UI.renderHeader(); UI.renderFeed(true);
    arrancaTimer();
    let ultimoFrame = 0;
    function animaMapa(t) {
      // Rápido durante el vuelo, con el zoom cerca y MIENTRAS HAYA GESTOS (arrastre/pinza/rueda):
      // así el mapa se siente fluido al tocarlo y ahorra batería en reposo.
      const rapido = (typeof MAPA.volando === 'function' && MAPA.volando()) || MAPA.cam.z >= (MAPA.LOD_ZOOM || 1.5) || MAPA.interactuando;
      if (!document.hidden && $('mapa').offsetParent && t - ultimoFrame >= (rapido ? 16 : 33)) {
        // La cámara avanza ANTES de renderizar: funciona igual con el mapa base o con GFX.
        if (typeof MAPA.volando === 'function' && MAPA.volando() && typeof MAPA.avanzaVuelo === 'function') MAPA.avanzaVuelo(t);
        MAPA.render(J.sim, t);
        // pista del globo visible solo en modo globo (una sola vez por frame, sirve a MAPA y GFX)
        const pista = MAPA._pista;
        if (pista) pista.style.opacity = MAPA.enGlobo && MAPA.enGlobo() ? '0.95' : '0';
        ultimoFrame = t;
      }
      requestAnimationFrame(animaMapa);
    }
    requestAnimationFrame(animaMapa);
    window.dispatchEvent(new CustomEvent('mil-almas:ready'));
    setInterval(() => J.guardar(true), 8000);
  };

  function arrancaTimer() {
    clearInterval(J.timer);
    J.timer = setInterval(() => {
      const sim = J.sim;
      try {
        for (let i = 0; i < J.ritmo; i++) {
          sim.step();
          if (window.AB) AB.minuto(sim); // el abismo late con cada minuto del mundo
        }
      } catch (e) { console.error('Error en la simulación', e); }
      UI.renderHeader();
      if (sim.t % 2 === 0) UI.renderFeed(true);
      const pop = $('pop-isla');
      if (!pop.classList.contains('oculto') && UI.tickIsla) UI.tickIsla(); // refresco barato, sin reconstruir el popover
      if (sim.user && !$('ficha').classList.contains('oculto')) UI.renderSusurros();
      if (UI.pintaHint) UI.pintaHint(); // la brújula del jugador: qué puedo hacer AHORA
      window.dispatchEvent(new CustomEvent('mil-almas:tick'));
    }, Math.max(60, J.msPorMin));
  }
  function wire() {
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    // botones del extinto menú globo: sus puertas viven ahora en el dock SAO
    on('ficha-cerrar', 'click', UI.cerrarFicha);
    on('pop-cerrar', 'click', () => UI.abrirIsla(null));
    // EL ABISMO EN EL POP: mercado (comprar/vender), frente y evento — un solo dispatcher
    ['pi-mercado', 'pi-frente', 'pi-evento'].forEach((id) => {
      const caja = $(id);
      if (caja && !caja._ab) {
        caja._ab = true;
        caja.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-ab]');
          if (!btn) return;
          const parts = btn.dataset.ab.split(':');
          const r = AB.accion(sim, parts[0], parts[1]);
          if (r && r.msg) UI.toast(r.msg);
        });
      }
    });
    
    
    
    
    
    $('pop-isla').dataset.isl = '';
    // recuerda la isla del popover al abrirla
    const origAbrir = UI.abrirIsla;
    UI.abrirIsla = function (i) { if (i) $('pop-isla').dataset.isl = i.id; origAbrir(i); };
  }

  window.addEventListener('DOMContentLoaded', J.iniciar);
})(typeof window !== 'undefined' ? window : globalThis);
