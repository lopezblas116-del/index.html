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
      const datos = { v: 1, seed: J.sim.seed, t: J.sim.t, agents: J.sim.agents, crews: J.sim.crews, ships: J.sim.ships, storms: J.sim.storms, feed: J.sim.feed, archive: J.sim.archive, pop: J.sim.pop, charlasActivas: J.sim.charlasActivas || [], charlaMem: J.sim.charlaMem, frutasLibres: J.sim.frutasLibres, descubiertas: J.sim.descubiertas, cofres: J.sim.cofres, pozo: J.sim.pozo, emperadores: J.sim.emperadores, user: J.sim.user ? J.sim.user.id : null, evId: J.sim.evId, rutas: null, vecinos: null };
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
      sim.evId = d.evId || 0;
      sim.t = d.t;
      sim.byId = function (id) { return this.agents.find(a => a.id === id); };
      sim.user = d.user ? sim.byId(d.user) : null;
      sim.onMuerte = null;
      J.sim = sim;
      return sim;
    } catch (e) { console.warn('Guardado corrupto', e); return null; }
  };

  J.borrar = function () { try { localStorage.removeItem(CLAVE); } catch (e) {} };

  // ── Reanudar/crear el mundo ──
  J.nuevo = function () {
    J.borrar();
    J.sim = new Sim(Math.floor(Math.random() * 90000) + 1000);
    J.sim.onMuerte = (viejo, heredero) => { UI.toast('«' + viejo.name + '» se fue. «' + heredero.name + '» recoge su bandera.'); UI.cerrarFicha(); };
  };

  J.iniciar = function () {
    const cargado = J.cargar();
    if (!cargado) { J.nuevo(); }
    UI.setSim(J.sim);
    MAPA.init($('mapa'), (i) => UI.abrirIsla(i));
    wire();
    UI.renderHeader(); UI.renderFeed(true);
    arrancaTimer();
    let ultimoFrame = 0;
    function animaMapa(t) {
      if (!document.hidden && $('mapa').offsetParent && t - ultimoFrame >= 50) {
        MAPA.render(J.sim, t);
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
        for (let i = 0; i < J.ritmo; i++) sim.step();
      } catch (e) { console.error('Error en la simulación', e); }
      UI.renderHeader();
      if (sim.t % 2 === 0) UI.renderFeed(true);
      const pop = $('pop-isla');
      if (!pop.classList.contains('oculto')) UI.abrirIsla(D.ISLA[selActual()] || null);
      if (sim.user && !$('ficha').classList.contains('oculto')) UI.renderSusurros();
      window.dispatchEvent(new CustomEvent('mil-almas:tick'));
    }, Math.max(60, J.msPorMin));
  }
  const selActual = () => { const p = $('pop-isla'); return p && p.dataset.isl ? p.dataset.isl : null; };

  function wire() {
    $('btn-nuevo').addEventListener('click', () => {
      if (J.sim.user) {
        G.MIL?.setMapView('vivo');
        UI.abrirFicha();
      } else UI.wizardAbrir();
    });
    $('btn-peri').addEventListener('click', UI.abrirPeriodico);
    $('per-cerrar').addEventListener('click', UI.cerrarPeriodico);
    $('btn-ajustes').addEventListener('click', UI.abrirAjustes);
    $('aj-cerrar').addEventListener('click', UI.cerrarAjustes);
    $('btn-sonido').addEventListener('click', () => { const s = G.SFX.toggle(); UI.toast(s ? 'Sonido silenciado' : 'Sonido activado'); });
    $('ficha-cerrar').addEventListener('click', UI.cerrarFicha);
    $('pop-cerrar').addEventListener('click', () => UI.abrirIsla(null));
    $('wz-siguiente').addEventListener('click', UI.wizSiguiente);
    $('wz-atras').addEventListener('click', UI.wizAtras);
    $('wz-cerrar').addEventListener('click', UI.wizardCerrar);
    document.querySelectorAll('.filtro').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.filtro').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      UI.setFiltro(b.dataset.f);
    }));
    document.querySelectorAll('button.ritmo').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('button.ritmo').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      J.ritmo = +b.dataset.r;
      UI.toast('Ritmo ×' + J.ritmo);
    }));
    $('aj-guardar').addEventListener('click', () => J.guardar(false));
    $('aj-exportar').addEventListener('click', () => {
      J.guardar(true);
      const raw = localStorage.getItem(CLAVE);
      const blob = new Blob([raw || '{}'], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'mundo-pirata-' + Date.now() + '.json';
      a.click();
    });
    $('aj-importar').addEventListener('click', () => $('aj-fichero').click());
    $('aj-fichero').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const d = JSON.parse(rd.result);
          if (d.v !== 1 || !d.agents) throw new Error('formato');
          localStorage.setItem(CLAVE, JSON.stringify(d));
          location.reload();
        } catch (err) { UI.toast('Archivo no válido'); }
      };
      rd.readAsText(f);
    });
    $('aj-borrar').addEventListener('click', () => {
      if (confirm('¿Empezar un mundo nuevo? Se borra la partida actual.')) { J.borrar(); location.reload(); }
    });
    $('pop-isla').dataset.isl = '';
    // recuerda la isla del popover al abrirla
    const origAbrir = UI.abrirIsla;
    UI.abrirIsla = function (i) { if (i) $('pop-isla').dataset.isl = i.id; origAbrir(i); };
  }

  window.addEventListener('DOMContentLoaded', J.iniciar);
})(typeof window !== 'undefined' ? window : globalThis);
