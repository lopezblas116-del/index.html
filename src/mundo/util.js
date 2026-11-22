// Utilidades: RNG con semilla, matemáticas, selección ponderada, texto.
(function (G) {
  const U = (G.U = G.U || {});

  // RNG determinista (mulberry32). La semilla se guarda con la partida para reproducir.
  U.rng = function (seed) {
    let a = seed >>> 0;
    const next = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      rango(min, max) { return min + next() * (max - min); },
      int(min, max) { return Math.floor(min + next() * (max - min + 1)); },
      pick(arr) { return arr[Math.floor(next() * arr.length)]; },
      chance(p) { return next() < p; },
      weighted(pairs) { // [[valor, peso], ...]
        let total = 0;
        for (const p of pairs) total += Math.max(0, p[1]);
        if (total <= 0) return null;
        let r = next() * total;
        for (const p of pairs) { r -= Math.max(0, p[1]); if (r <= 0) return p[0]; }
        return pairs[pairs.length - 1][0];
      }
    };
  };

  U.clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  U.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  U.lerp = (a, b, t) => a + (b - a) * t;

  // Texto con marcadores {a} {b} {isla} {dest} {crew} {n} ...
  U.fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? String(vars[k]) : m));
  U.cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Cifras "bonitas" para recompensas: 12.340.000 -> 12.000.000 / 128.500 -> 130.000
  U.cifraBonita = function (v) {
    if (v < 1000) return 0;
    if (v >= 1e9) return Math.round(v / 1e8) * 1e8;
    if (v >= 1e8) return Math.round(v / 1e7) * 1e7;
    if (v >= 1e6) return Math.round(v / 1e6) * 1e6;
    if (v >= 1e4) return Math.round(v / 1e4) * 1e4;
    if (v >= 1e3) return Math.round(v / 1e3) * 1e3;
    return Math.max(1000, Math.round(v / 100) * 100);
  };
  U.fmtBelis = function (v) {
    if (v >= 1e9) return (v / 1e9).toFixed(v % 1e9 ? 1 : 0).replace('.0', '') + '.000.000.000';
    if (v >= 1e6) return (v / 1e6).toFixed(v % 1e6 ? 1 : 0).replace('.0', '') + '.000.000';
    if (v >= 1e3) return (v / 1e3).toFixed(v % 1e3 ? 1 : 0).replace('.0', '') + '.000';
    return String(Math.round(v));
  };

  U.hhmm = function (minDelDia) {
    const h = Math.floor(minDelDia / 60) % 24, m = Math.floor(minDelDia % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  };
  U.esNoche = (minDelDia) => minDelDia < 6 * 60 || minDelDia >= 21 * 60;

  // Crea un id corto y estable
  U.uid = (function () { let n = 0; return (p) => (p || 'x') + (++n); })();
})(typeof window !== 'undefined' ? window : globalThis);
