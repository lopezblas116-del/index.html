// ── SONIDO del mundo: síntesis WebAudio, CERO assets ──
// El ping aterriza, la moneda canta, el cuerno anuncia el zarpe: el "juice"
// que convierte un sistema en sensación. Nace LAZY con el primer gesto del
// usuario (política de autoplay) y se apaga con el 🔊/🔇 del HUD (persistente).
// Node-safe: sin window no hay contexto y play() es un no-op silencioso.
(function (G) {
  'use strict';
  const S = G.SONIDO = {};
  let ctx = null;
  let mudo = false;
  try { mudo = localStorage.getItem('onelatam-mute') === '1'; } catch (e) { /* storage bloqueado */ }
  const despertar = () => {
    if (typeof window === 'undefined') return;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', despertar, { passive: true });
    window.addEventListener('keydown', despertar, { passive: true });
  }
  // tono con envolvente: f0→f1, duración s, tipo de onda, volumen 0..1, cuando (s)
  function tono(f0, f1, dur, tipo, vol, cuando) {
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + (cuando || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo || 'sine';
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  S.mudo = function () { return mudo; };
  S.toggle = function () { mudo = !mudo; try { localStorage.setItem('onelatam-mute', mudo ? '1' : '0'); } catch (e) { /* igual cambia en memoria */ } return mudo; };
  // presets: cada momento del mundo con su propia voz
  const PRESETS = {
    ping: () => { tono(920, 560, 0.16, 'sine', 0.14); tono(1380, 920, 0.1, 'sine', 0.06, 0.02); },
    moneda: () => { tono(1240, 1240, 0.07, 'triangle', 0.1); tono(1860, 1860, 0.09, 'triangle', 0.09, 0.07); },
    fallo: () => { tono(220, 130, 0.22, 'square', 0.07); },
    evento: () => { tono(660, 660, 0.14, 'sine', 0.08); tono(990, 990, 0.16, 'sine', 0.07, 0.1); },
    cuerno: () => { tono(196, 147, 0.5, 'sawtooth', 0.1); tono(98, 98, 0.55, 'sawtooth', 0.06, 0.04); },
    nivel: () => { tono(523, 523, 0.09, 'sine', 0.09); tono(659, 659, 0.09, 'sine', 0.09, 0.09); tono(784, 784, 0.14, 'sine', 0.1, 0.18); },
    heredero: () => { tono(311, 311, 0.4, 'sine', 0.12); tono(233, 233, 0.55, 'sine', 0.1, 0.3); }
  };
  S.play = function (nombre) {
    if (mudo || !ctx) return;
    try { const p = PRESETS[nombre]; if (p) p(); } catch (e) { /* un sonido roto no tumba nada */ }
  };
})(typeof window !== 'undefined' ? window : globalThis);
