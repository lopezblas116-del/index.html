// Puente Mil Almas ↔ One-Latam: conecta la simulación del mundo vivo con los
// contenedores que YA EXISTEN en index.html del repo (sin modificar sus módulos).
// Cada binding es defensivo: si el elemento/módulo no está, se omite.
//
// Uso en el repo (después de cargar los módulos de mundo/):
//   PUENTE.config = { baseAssets: 'assets/sprites/' };
//   PUENTE.activar();   // en main.js, tras crear el Sim (window.JUEGO.sim)
(function (G) {
  const D = G.D, U = G.U;
  const PUENTE = (G.PUENTE = G.PUENTE || {});
  const $ = (id) => document.getElementById(id);
  let timer = null;

  PUENTE.config = { actualizaMs: 1000, feedMax: 40 };

  // The host game renders these panels itself; the bridge must not overwrite them.
  PUENTE.bindings = [];

  PUENTE.actualizar = function () {
    const sim = G.JUEGO && G.JUEGO.sim;
    if (!sim) return;
    for (const b of PUENTE.bindings) {
      const el = $(b.id);
      if (!el) continue;
      try { b.fn(el, sim); } catch (e) { console.warn('[puente]', b.id, e); }
    }
    // reloj si el mapa no pinta su propio HUD
    if (PUENTE.onTick) PUENTE.onTick(sim);
  };

  PUENTE.activar = function (opts) {
    Object.assign(PUENTE.config, opts || {});
    clearInterval(timer);
    timer = setInterval(PUENTE.actualizar, PUENTE.config.actualizaMs);
    PUENTE.actualizar();
    return PUENTE;
  };
  PUENTE.desactivar = function () { clearInterval(timer); };

  // Susurros: conecta el input existente (#whisper-input) con el motor.
  // Su UI tiene sintonía/rebeldía: aquí mapeamos a la probabilidad del motor.
  PUENTE.conectarSusurros = function () {
    const input = $('whisper-input');
    if (!input) return;
    const btn = input.closest('form') || input.parentElement;
    btn.addEventListener('submit', (e) => {
      e.preventDefault();
      const texto = input.value.trim();
      if (!texto || !G.JUEGO.sim || !G.JUEGO.sim.user) return;
      const k = PUENTE.clasificarSusurro(texto);
      const r = G.JUEGO.sim.doWhisper(G.JUEGO.sim.user, k);
      G.UI.toast(r.reinterpret ? 'Reinterpreta tu consejo a su manera…' : r.obe ? 'Te ha hecho caso.' : 'No te ha hecho caso.');
      input.value = '';
    });
  };
  // Clasificación simple por palabras clave → tipo de susurro del motor
  PUENTE.clasificarSusurro = function (t) {
    const s = t.toLowerCase();
    if (/explora|explorar|revisa/.test(s)) return 'explorar';
    if (/tesoro|cofre|busca|oro/.test(s)) return 'tesoro';
    if (/taberna|bebe|canta/.test(s)) return 'taberna';
    if (/entrena|fuerte|practica/.test(s)) return 'entrenar';
    if (/pelea|ataca|golpea/.test(s)) return 'pelea';
    if (/zarpa|vete|navega|marchate/.test(s)) return 'zarpar';
    if (/descansa|duerme|cura/.test(s)) return 'descansar';
    if (/amigo|social|habla/.test(s)) return 'amigos';
    if (/cuidado|ojo|prudencia|evita/.test(s)) return 'cuidado';
    if (/quedate|espera|sigue aqui/.test(s)) return 'quedate';
    return 'explorar';
  };
})(typeof window !== 'undefined' ? window : globalThis);
