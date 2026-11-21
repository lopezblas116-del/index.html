// Mapa del mundo: GLOBO 16-bit girable que baja al mar con el zoom, mares, Muralla Roja,
// Franjas de Calma, islas pixel, barcos y tormentas. Zoom con pinza (dos dedos) y rueda.
(function (G) {
  const { clamp, dist } = G.U;
  const D = G.D;
  const MAPA = (G.MAPA = {});

  // Zoom: 0.5 = globo completo (esfera), 0.62 = aterrizando en el mar, 6.0 = dioramas.
  // La rueda y los botones mueven un OBJETIVO (zT) y la cámara lo persigue: zoom lupa, no salto.
  const Z_MIN = 0.5, Z_MAX = 6.0, UMBRAL_GLOBO = 0.62;
  MAPA.LOD_ZOOM = 1.5;          // entrar al diorama
  MAPA.LOD_SALIDA = 1.12;       // salir del diorama (histéresis: alejarse un poco no te expulsa)
  let cv = null, ctx = null, cam = { x: D.W / 2, y: D.H / 2, z: Z_MIN }, ancho = 0, alto = 0;
  let zT = cam.z;               // objetivo de zoom (la lupa persigue esto)
  let ultT = 0;                 // timestamp del último frame, para el easing del zoom
  let vuelo = null;
  let selIsl = null, onSel = null, base = null, eventoIsl = new Set(), eventoT = -1e9;
  // ── Globo ──
  let rotLon = -0.35;                 // rotación horizontal actual (radianes)
  let TEX = null;                     // textura del mundo para la esfera
  const nubes = [];
  for (let i = 0; i < 26; i++) {
    nubes.push({ x: Math.random() * D.W, y: Math.random() * D.H, r: 16 + Math.random() * 30, v: 1.0 + Math.random() * 1.8 });
  }

  // Mezcla globo→mar: 1 = esfera pura, 0 = mapa plano. El zoom con el dedo la recorre.
  function globoF() { return clamp((UMBRAL_GLOBO - cam.z) / (UMBRAL_GLOBO - Z_MIN), 0, 1); }
  MAPA.enGlobo = function () { return globoF() > 0.5; };

  MAPA.init = function (canvas, cbSel) {
    cv = canvas; ctx = cv.getContext('2d'); onSel = cbSel;
    cv.style.touchAction = 'none'; // el navegador no se queda con los gestos del mapa
    const fit = () => {
      const r = cv.parentElement.getBoundingClientRect();
      ancho = r.width; alto = r.height;
      cv.width = Math.round(ancho * devicePixelRatio); cv.height = Math.round(alto * devicePixelRatio);
      cv.style.width = ancho + 'px'; cv.style.height = alto + 'px';
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      base = null; TEX = null; estrellado = null;
    };
    MAPA.resize = fit;
    fit();
    window.addEventListener('resize', fit);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(cv.parentElement);
    // pista de interacción (como la referencia): visible con el globo, se apaga al bajar al mar
    if (cv.parentElement && !cv.parentElement.querySelector('.pista-globo')) {
      const p = document.createElement('div');
      p.className = 'pista-globo';
      p.textContent = 'Girá el globo · acercate con el zoom para bajar al mar · tocá una isla';
      p.style.cssText = 'position:absolute;left:50%;bottom:76px;transform:translateX(-50%);max-width:92%;padding:8px 14px;background:rgba(10,18,34,0.82);border:1px solid rgba(244,193,26,0.5);border-radius:999px;color:#f4d97a;font:600 13px/1.3 system-ui,sans-serif;text-align:center;pointer-events:none;transition:opacity .8s;z-index:5;opacity:.95';
      if (getComputedStyle(cv.parentElement).position === 'static') cv.parentElement.style.position = 'relative';
      cv.parentElement.appendChild(p);
      MAPA._pista = p;
    }
    // ── interacción: arrastre, rueda, y PINZA con dos dedos centrada en el punto medio ──
    let drag = null, pellizco = null;
    const gira = (dx) => { rotLon += dx * 0.0045; };
    cv.addEventListener('mousedown', e => {
      vuelo = null;
      drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, movio: false };
    });
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.movio = true;
      if (globoF() > 0.5) gira(dx);
      else { cam.x = clamp(drag.cx - dx / cam.z, 0, D.W); cam.y = clamp(drag.cy - dy / cam.z, 0, D.H); }
      drag.x = e.clientX; drag.y = e.clientY; drag.cx = cam.x; drag.cy = cam.y;
    });
    window.addEventListener('mouseup', e => { if (drag && !drag.movio) MAPA.click(e); drag = null; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      MAPA.zoom(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY);
    }, { passive: false });
    cv.addEventListener('touchstart', e => {
      vuelo = null;
      if (e.touches.length === 1) {
        drag = { x: e.touches[0].clientX, y: e.touches[0].clientY, cx: cam.x, cy: cam.y, movio: false };
      } else if (e.touches.length >= 2) {
        drag = null;
        const [a, b] = e.touches;
        const r = cv.getBoundingClientRect();
        const mx = (a.clientX + b.clientX) / 2 - r.left, my = (a.clientY + b.clientY) / 2 - r.top;
        // punto del mundo que queda clavado bajo el punto medio de los dedos
        pellizco = {
          d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1,
          z0: cam.z,
          wx: cam.x + (mx - ancho / 2) / cam.z,
          wy: cam.y + (my - alto / 2) / cam.z,
          mx, my
        };
      }
    }, { passive: true });
    cv.addEventListener('touchmove', e => {
      if (pellizco && e.touches.length >= 2) {
        e.preventDefault();
        const [a, b] = e.touches;
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const r = cv.getBoundingClientRect();
        const mx = (a.clientX + b.clientX) / 2 - r.left, my = (a.clientY + b.clientY) / 2 - r.top;
        cam.z = clamp(pellizco.z0 * (d / pellizco.d0), Z_MIN, Z_MAX);
        zT = cam.z; // la pinza es entrada viva: el objetivo la sigue sin retraso
        if (globoF() < 0.5) {
          // el punto del mundo bajo los dedos sigue bajo los dedos: zoom real, no centrado
          cam.x = clamp(pellizco.wx - (mx - ancho / 2) / cam.z, 0, D.W);
          cam.y = clamp(pellizco.wy - (my - alto / 2) / cam.z, 0, D.H);
        } else {
          gira(mx - pellizco.mx);
          pellizco.mx = mx;
        }
        return;
      }
      if (drag && e.touches.length === 1) {
        e.preventDefault();
        const dx = e.touches[0].clientX - drag.x, dy = e.touches[0].clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.movio = true;
        if (globoF() > 0.5) gira(dx);
        else { cam.x = clamp(drag.cx - dx / cam.z, 0, D.W); cam.y = clamp(drag.cy - dy / cam.z, 0, D.H); }
        drag.x = e.touches[0].clientX; drag.y = e.touches[0].clientY; drag.cx = cam.x; drag.cy = cam.y;
      }
    }, { passive: false });
    cv.addEventListener('touchend', e => {
      if (pellizco && e.touches.length < 2) {
        pellizco = null;
        if (e.touches.length === 1) drag = { x: e.touches[0].clientX, y: e.touches[0].clientY, cx: cam.x, cy: cam.y, movio: true };
      }
      if (drag && e.touches.length === 0 && !drag.movio) {
        const t = e.changedTouches[0];
        MAPA.click({ clientX: t.clientX, clientY: t.clientY });
      }
      if (e.touches.length === 0) drag = null;
    });
  };

  // Clic / toque: convierte pantalla → punto del mundo (o del globo) y busca la isla.
  MAPA.click = function (e) {
    const r = cv.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const g = globoF();
    let wx, wy;
    if (g > 0.5) {
      // desproyección esférica: toque sobre el globo → longitud/latitud → mundo
      const R = radioGlobo(g);
      const dx = (px - ancho / 2) / R, dy = (py - alto / 2) / R;
      if (dx * dx + dy * dy > 1) { selIsl = null; onSel && onSel(null); return; } // toque en el espacio
      const phi = Math.asin(clamp(dy, -1, 1)); // latitud real: y = R·sen(φ)
      const cf = Math.max(0.3, Math.cos(phi));
      const lam = Math.asin(clamp(dx / cf, -1, 1));
      wx = (((rotLon + lam + Math.PI) / (2 * Math.PI)) % 1) * D.W;
      if (wx < 0) wx += D.W;
      wy = clamp((phi + Math.PI / 2) / Math.PI, 0.02, 0.98) * D.H;
    } else {
      wx = px / cam.z + cam.x - ancho / (2 * cam.z);
      wy = py / cam.z + cam.y - alto / (2 * cam.z);
    }
    MAPA.clickEn(wx, wy);
  };

  MAPA.clickEn = function (wx, wy) {
    // islas (con envoltura horizontal)
    for (const i of D.ISLAS) {
      for (const off of [0, -D.W, D.W]) {
        if (dist(wx, wy, i.x + off, i.y) < Math.max(14, i.r + (cam.z < 1 ? 10 : 0))) { selIsl = i; onSel && onSel(i); return; }
      }
    }
    selIsl = null; onSel && onSel(null);
  };

  MAPA.centra = function (x, y) { cam.x = x; cam.y = y; };
  // Encuadre completo de una isla: calcula el zoom para que el diorama ENTRE entero en pantalla
  // y vuela hasta allí. Es el "acercar a una isla y verla completa, no una porción".
  MAPA.enfocarIsla = function (i) {
    if (!i || !ancho) return;
    const r = rectDiorama(i, 0);
    const z = clamp(Math.min(ancho / (r.w + 90), alto / (r.h + 150)), 1.35, 4.2);
    dioramasActivos.add(i.id); // forzar el diorama: el clic ES intención de ver la escena
    vuelo = { t0: performance.now(), dur: 750, fx: cam.x, fy: cam.y, fz: cam.z, tx: clamp(i.x, 0, D.W), ty: clamp(i.y + 36, 0, D.H), tz: clamp(z, Z_MIN, Z_MAX) }; // +36: baja la escena por debajo de la barra del HUD
    zT = vuelo.tz;
  };
  // Vuelo suave: interpola la cámara hacia el destino con easing cúbico (sensación fluida).
  MAPA.volar = function (x, y, z, dur = 650) {
    vuelo = { t0: performance.now(), dur: Math.max(1, dur), fx: cam.x, fy: cam.y, fz: cam.z, tx: clamp(x, 0, D.W), ty: clamp(y, 0, D.H), tz: clamp(z, Z_MIN, Z_MAX) };
  };
  MAPA.volando = function () { return Boolean(vuelo); };
  MAPA.avanzaVuelo = function (t) { avanzaVuelo(t); };
  function avanzaVuelo(t) {
    if (!vuelo) return;
    const k = clamp((t - vuelo.t0) / vuelo.dur, 0, 1);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    cam.x = vuelo.fx + (vuelo.tx - vuelo.fx) * e;
    cam.y = vuelo.fy + (vuelo.ty - vuelo.fy) * e;
    cam.z = vuelo.fz + (vuelo.tz - vuelo.fz) * e;
    zT = cam.z; // el vuelo manda: el objetivo acompaña para que la lupa no pelee con él
    if (k >= 1) vuelo = null;
  }
  // zoom(direction, cx, cy): mueve el OBJETIVO de zoom (la lupa); con foco opcional en el cursor
  MAPA.zoom = function (direction, cx, cy) {
    const z0 = zT;
    zT = clamp(zT * (direction > 0 ? 1.16 : 0.86), Z_MIN, Z_MAX);
    if (cx != null && globoFT(zT) < 0.5 && cv) {
      const r = cv.getBoundingClientRect();
      const mx = cx - r.left, my = cy - r.top;
      const wx = cam.x + (mx - ancho / 2) / z0, wy = cam.y + (my - alto / 2) / z0;
      cam.x = clamp(wx - (mx - ancho / 2) / zT, 0, D.W);
      cam.y = clamp(wy - (my - alto / 2) / zT, 0, D.H);
    }
  };
  // mezcla globo evaluada sobre el objetivo (para decidir el anclaje antes de mover la cámara)
  function globoFT(z) { return clamp((UMBRAL_GLOBO - z) / (UMBRAL_GLOBO - Z_MIN), 0, 1); }
  // La cámara persigue el objetivo: sensación de lupa (easing independiente del framerate).
  function pasaZoom(t) {
    const dt = Math.min(100, Math.max(1, t - ultT));
    const k = 1 - Math.pow(0.72, dt / 50); // ~28% por frame a 20fps, más rápido a 60
    if (Math.abs(zT - cam.z) > 0.001) cam.z = clamp(cam.z + (zT - cam.z) * k, Z_MIN, Z_MAX);
    ultT = t;
  }

  // ── Dioramas 16-bit EN el mapa: al acercar el zoom, cada isla se convierte en su escena completa ──
  MAPA.LOD_ZOOM = 1.5;
  let apiEscenas = null;
  // fusion inyecta: { juegoDe, npcsDe, personajeDe, pinta } — el mundo no depende de la app.
  MAPA.configuraEscenas = function (api) { apiEscenas = api; };

  function rectDiorama(i, off) {
    const w = Math.min(Math.max(i.r * 30, 300), 560); // tope: dioramas que siempre caben en pantalla
    const h = w * 400 / 640;
    return { x: i.x - w / 2 + off, y: i.y - h / 2, w, h };
  }
  MAPA.rectDiorama = rectDiorama;

  MAPA.dibujaEscenaIsla = function (c2, i, t, off) {
    const r = rectDiorama(i, off);
    // culling: solo se dibuja si el diorama cruza la vista actual
    const margenX = ancho / (2 * cam.z) + r.w * 0.6, margenY = alto / (2 * cam.z) + r.h * 0.6;
    if (Math.abs(r.x + r.w / 2 - cam.x) > margenX || Math.abs(r.y + r.h / 2 - cam.y) > margenY) return true;
    const s = r.w / 640;
    const juego = apiEscenas?.juegoDe ? apiEscenas.juegoDe(i) : null;
    if (juego && apiEscenas?.pinta) {
      // NPCs: temáticos de la isla + almas presentes del sim (copia nueva, sin mutar la isla).
      const escena = { ...juego, npcs: [...(juego.npcs || []), ...(apiEscenas.npcsDe ? apiEscenas.npcsDe(i) : [])].slice(0, 10) };
      const pers = apiEscenas.personajeDe ? apiEscenas.personajeDe(juego) : null;
      c2.save();
      c2.translate(r.x, r.y);
      c2.scale(s, s);
      c2.beginPath();
      c2.moveTo(26, 0);
      c2.arcTo(640, 0, 640, 400, 26);
      c2.arcTo(640, 400, 0, 400, 26);
      c2.arcTo(0, 400, 0, 0, 26);
      c2.arcTo(0, 0, 640, 0, 26);
      c2.closePath();
      c2.clip();
      apiEscenas.pinta(c2, escena, pers, t);
      c2.restore();
    } else {
      // isla de simulación (sin escena del catálogo): diorama temático procedural cacheado
      if (!i._dio) i._dio = renderDioramaTema(i);
      c2.save();
      c2.translate(r.x, r.y);
      c2.scale(s, s);
      c2.beginPath();
      c2.moveTo(26, 0);
      c2.arcTo(640, 0, 640, 400, 26);
      c2.arcTo(640, 400, 0, 400, 26);
      c2.arcTo(0, 400, 0, 0, 26);
      c2.arcTo(0, 0, 640, 0, 26);
      c2.closePath();
      c2.clip();
      c2.drawImage(i._dio, 0, 0);
      propsVivas(c2, i, t);
      c2.restore();
    }
    // marco dorado y nombre, fuera del recorte
    c2.save();
    c2.translate(r.x, r.y);
    c2.scale(s, s);
    c2.strokeStyle = 'rgba(244,193,26,0.75)';
    c2.lineWidth = 5 / cam.z;
    c2.beginPath();
    c2.moveTo(26, 0);
    c2.arcTo(640, 0, 640, 400, 26);
    c2.arcTo(640, 400, 0, 400, 26);
    c2.arcTo(0, 400, 0, 0, 26);
    c2.arcTo(0, 0, 640, 0, 26);
    c2.closePath();
    c2.stroke();
    c2.restore();
    // rótulo con tamaño constante en pantalla (unidades de mundo = px_pantalla / zoom)
    const fs = Math.max(7, 16 / cam.z);
    const lw = Math.max(130 / cam.z, i.n.length * fs * 0.62 + 18 / cam.z);
    const bh = 24 / cam.z;
    c2.fillStyle = 'rgba(12,22,38,0.72)';
    c2.fillRect(i.x + off - lw / 2, r.y - bh - 6 / cam.z, lw, bh);
    c2.strokeStyle = 'rgba(244,193,26,0.6)';
    c2.lineWidth = 1.2 / cam.z;
    c2.strokeRect(i.x + off - lw / 2, r.y - bh - 6 / cam.z, lw, bh);
    c2.font = '700 ' + fs + 'px system-ui, sans-serif';
    c2.fillStyle = '#f4d97a';
    c2.textAlign = 'center';
    c2.fillText(i.n, i.x + off, r.y - 11 / cam.z);
    return true;
  };
  // Exposiciones para la capa de gráficos mejorados (GFX)
  MAPA.cam = cam;
  MAPA.nubes = nubes;
  MAPA.formaIslaPublica = formaIsla;

  function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

  // isla tipo blob pixel: polígono irregular fijo por semilla del nombre
  function formaIsla(i) {
    if (i._pts) return i._pts;
    let h = 0;
    for (const ch of i.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const pts = [], n = 9;
    for (let k = 0; k < n; k++) {
      h = (h * 1103515245 + 12345) >>> 0;
      const ang = (k / n) * Math.PI * 2;
      const rr = i.r * (0.72 + ((h >>> 16) % 100) / 100 * 0.5);
      pts.push([Math.cos(ang) * rr, Math.sin(ang) * rr * 0.82]);
    }
    i._pts = pts; return pts;
  }

  // ── Dioramas temáticos para islas de simulación (sin escena del catálogo) ──
  // Se pre-renderizan una vez por isla (640×400) y en vivo solo se animan olas y almas.
  function renderDioramaTema(i) {
    const T = D.TEMAS[i.tema] || D.TEMAS.verde;
    const tema = i.tema || 'verde';
    const c = document.createElement('canvas');
    c.width = 640; c.height = 400;
    const g = c.getContext('2d');
    const cielos = { desierto: ['#ffdca6', '#ffb371'], blanco: ['#cfe4ff', '#f0f8ff'], industrial: ['#a8b8cc', '#d2dfe9'], prision: ['#2e3d59', '#5a7095'], mar: ['#7fc3ee', '#cfeeff'], tropical: ['#ffe8b8', '#ffcb8f'], fortaleza: ['#9fc0e8', '#dcecfb'] };
    const [cs1, cs2] = cielos[tema] || ['#a4dcf4', '#ddf2ff'];
    const sky = g.createLinearGradient(0, 0, 0, 208);
    sky.addColorStop(0, cs1); sky.addColorStop(1, cs2);
    g.fillStyle = sky; g.fillRect(0, 0, 640, 208);
    // astro y nubes fijas
    g.fillStyle = tema === 'prision' ? 'rgba(210,225,255,0.5)' : 'rgba(255,240,190,0.9)';
    g.beginPath(); g.arc(540, 60, 26, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let k = 0; k < 3; k++) {
      const cx = 60 + ruido(k * 3.3 + i.r) * 380, cy = 40 + ruido(k * 7.1) * 60;
      g.beginPath(); g.ellipse(cx, cy, 34, 12, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(cx + 22, cy - 8, 22, 9, 0, 0, 7); g.fill();
    }
    // mar de fondo con horizonte
    g.fillStyle = '#2a6cb0'; g.fillRect(0, 200, 640, 60);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    for (let k = 0; k < 14; k++) g.fillRect(20 + ruido(k * 2.7 + i.r) * 600, 208 + ruido(k * 5.3) * 44, 22, 2);
    // terreno: playa y tierra con borde pixelado
    g.fillStyle = rgb(T.sand); g.fillRect(0, 248, 640, 152);
    g.fillStyle = rgb(T.land); g.fillRect(0, 266, 640, 134);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 264, 640, 4);
    // props por tema
    const arbusto = (x, y, s, col) => { g.fillStyle = col; g.fillRect(x, y, 10 * s, 8 * s); g.fillRect(x + 3 * s, y - 5 * s, 6 * s, 6 * s); };
    const palmera = (x, y, s) => {
      g.fillStyle = '#8a5a33'; g.fillRect(x, y - 26 * s, 5 * s, 26 * s);
      g.fillStyle = rgb(T.tree); g.fillRect(x - 14 * s, y - 34 * s, 33 * s, 9 * s);
      g.fillRect(x + 8 * s, y - 40 * s, 8 * s, 8 * s);
    };
    const pino = (x, y, s, col) => { g.fillStyle = '#6b4a2f'; g.fillRect(x + 4 * s, y - 8 * s, 4 * s, 8 * s); g.fillStyle = col || rgb(T.tree); g.fillRect(x - 6 * s, y - 30 * s, 24 * s, 23 * s); g.fillRect(x - 3 * s, y - 38 * s, 18 * s, 9 * s); };
    const casa = (x, y, s, techo) => { g.fillStyle = '#f0e6d2'; g.fillRect(x, y - 18 * s, 26 * s, 18 * s); g.fillStyle = techo; g.fillRect(x - 3 * s, y - 24 * s, 32 * s, 7 * s); g.fillStyle = '#6b4a2f'; g.fillRect(x + 10 * s, y - 10 * s, 6 * s, 10 * s); };
    const fabrica = (x, y, s) => { g.fillStyle = '#9aa5b1'; g.fillRect(x, y - 34 * s, 48 * s, 34 * s); g.fillStyle = '#7d8794'; g.fillRect(x + 6 * s, y - 52 * s, 10 * s, 20 * s); g.fillRect(x + 24 * s, y - 60 * s, 10 * s, 28 * s); g.fillStyle = 'rgba(230,235,240,0.75)'; g.fillRect(x + 27 * s, y - 74 * s, 4 * s, 14 * s); };
    const duna = (x, y, s) => { g.fillStyle = '#e8c98a'; g.beginPath(); g.ellipse(x, y, 60 * s, 14 * s, 0, Math.PI, 0); g.fill(); };
    const cactusP = (x, y, s) => { g.fillStyle = '#3f8f4f'; g.fillRect(x, y - 22 * s, 7 * s, 22 * s); g.fillRect(x - 8 * s, y - 16 * s, 8 * s, 5 * s); g.fillRect(x + 7 * s, y - 12 * s, 8 * s, 5 * s); };
    const iglu = (x, y, s) => { g.fillStyle = '#eef6ff'; g.beginPath(); g.arc(x, y - 12 * s, 16 * s, Math.PI, 0); g.fill(); g.fillStyle = '#b8d4ee'; g.fillRect(x - 4 * s, y - 9 * s, 8 * s, 9 * s); };
    const muro = (x, y, s) => { g.fillStyle = '#8d99a6'; g.fillRect(x, y - 44 * s, 130 * s, 44 * s); g.fillStyle = '#76828e'; for (let k = 0; k < 5; k++) g.fillRect(x + 8 * s + k * 26 * s, y - 52 * s, 14 * s, 9 * s); };
    const torre = (x, y, s) => { g.fillStyle = '#6d7884'; g.fillRect(x, y - 64 * s, 16 * s, 64 * s); g.fillStyle = '#2b6cb0'; g.fillRect(x + 2 * s, y - 74 * s, 12 * s, 11 * s); };
    const reja = (x, y, s) => { g.fillStyle = '#4a5568'; g.fillRect(x, y - 40 * s, 90 * s, 6 * s); for (let k = 0; k < 7; k++) g.fillRect(x + 4 * s + k * 13 * s, y - 40 * s, 4 * s, 40 * s); };
    const farol = (x, y, s) => { g.fillStyle = '#e8e2d2'; g.fillRect(x, y - 56 * s, 10 * s, 56 * s); g.fillStyle = '#d33'; g.fillRect(x + 1 * s, y - 64 * s, 8 * s, 9 * s); };
    const roca = (x, y, s) => { g.fillStyle = '#78838f'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18 * s, y - 34 * s); g.lineTo(x + 34 * s, y); g.closePath(); g.fill(); };
    let k = 0;
    switch (tema) {
      case 'desierto':
        duna(120, 300, 1); duna(420, 330, 1.2); duna(260, 355, 0.9);
        cactusP(90, 330, 1); cactusP(540, 345, 1.2); cactusP(330, 360, 0.9);
        g.fillStyle = '#d9b36c'; g.beginPath(); g.moveTo(380, 352); g.lineTo(430, 268); g.lineTo(480, 352); g.closePath(); g.fill(); // pirámide
        break;
      case 'blanco':
        for (k = 0; k < 7; k++) pino(40 + k * 88, 320 + ruido(k) * 40, 1, '#dfeefc');
        iglu(300, 340, 1.2); iglu(500, 360, 1);
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, 266, 640, 8); // nieve fresca
        break;
      case 'industrial':
        fabrica(70, 330, 1); fabrica(250, 350, 1.2); fabrica(450, 325, 0.9);
        for (k = 0; k < 5; k++) { g.fillStyle = '#5f6a76'; g.fillRect(120 + k * 96, 300, 12, 26); } // chimeneas
        break;
      case 'fortaleza':
        muro(160, 340, 1.4); torre(140, 340, 1); torre(420, 340, 1.1);
        g.fillStyle = '#2b6cb0'; g.fillRect(300, 268, 8, 22); g.fillStyle = '#f5f0e6'; g.fillRect(308, 268, 14, 9); // bandera
        break;
      case 'prision':
        reja(200, 350, 1.4); g.fillStyle = '#3a4658'; g.fillRect(120, 290, 400, 20); // muralla alta
        farol(480, 350, 0.8);
        break;
      case 'mar': // restaurante flotante estilo Baratie
        g.fillStyle = '#6b4a2f'; g.fillRect(180, 296, 280, 18);
        casa(240, 296, 1.6, '#d33'); farol(200, 296, 0.6);
        break;
      case 'tropical':
        palmera(90, 330, 1.1); palmera(200, 360, 0.9); palmera(420, 330, 1.2); palmera(560, 355, 1);
        casa(300, 350, 1.1, '#c98a3d');
        break;
      case 'ciudad': case 'puerto':
        farol(80, 345, 1.1);
        for (k = 0; k < 4; k++) casa(140 + k * 90, 330 + (k % 2) * 26, 1 + ruido(k) * 0.4, ['#c0533d', '#3d6bc0', '#c9a13d', '#4f8f5f'][k]);
        g.fillStyle = '#8a5a33'; g.fillRect(40, 356, 560, 10); // muelle
        break;
      case 'rocosa':
        roca(110, 340, 1.4); roca(300, 355, 1); roca(480, 330, 1.7); roca(560, 360, 0.9);
        break;
      default: // verde, bosque, jungla
        for (k = 0; k < 6; k++) pino(50 + k * 104, 320 + ruido(k * 1.7 + i.r) * 46, 0.9 + ruido(k) * 0.5);
        arbusto(180, 355, 1.2, rgb(T.land2)); arbusto(400, 345, 1, rgb(T.land2));
        casa(500, 350, 1, '#7a9a4d');
    }
    return c;
  }
  // Capa viva encima del diorama cacheado: olas del horizonte y almas caminando.
  function propsVivas(g, i, t) {
    g.fillStyle = 'rgba(255,255,255,0.3)';
    for (let k = 0; k < 5; k++) {
      const x = ((t / 26 + k * 137 + i.r * 9) % 620) + 10;
      g.fillRect(x, 212 + (k % 3) * 14, 20, 2);
    }
    const n = 2 + (Math.floor(i.r) % 3);
    for (let k = 0; k < n; k++) {
      const x = 80 + ruido(k * 9.3 + i.r) * 480;
      const y = 296 + ruido(k * 3.1) * 60;
      const paseo = Math.sin(t / 1400 + k * 2.4) * 26;
      g.fillStyle = '#3d2f23'; g.fillRect(x + paseo, y - 8, 5, 9); // cuerpo
      g.fillStyle = '#e8c8a0'; g.fillRect(x + paseo + 1, y - 12, 3, 4); // cabeza
    }
  }

  function sombraIsla(i, ox) {
    ctx.beginPath();
    ctx.ellipse(i.x + ox + 2, i.y + i.r * 0.5, i.r * 1.25, i.r * 0.7, 0, 0, 7);
    ctx.fillStyle = 'rgba(10,30,50,0.25)'; ctx.fill();
  }

  // 2 a 5 puntitos blancos (edificios) sobre la tierra, deterministas por isla
  function edificiosIsla(i, ox) {
    if (!i.edif) {
      let h = 7;
      for (const ch of i.id) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
      i.edif = [];
      const n = 2 + (h % 4);
      for (let k = 0; k < n; k++) {
        h = (h * 1103515245 + 12345) >>> 0;
        const a = ((h >>> 8) % 628) / 100, rr = i.r * 0.45 * (((h >>> 16) % 100) / 100);
        i.edif.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr * 0.7 });
      }
    }
    ctx.fillStyle = '#fff';
    for (const e of i.edif) ctx.fillRect(Math.round(i.x + ox + e.x), Math.round(i.y + e.y), 2, 2);
  }

  // anillo blanco punteado girando en islas con evento activo
  function anilloIsla(i, ox, t) {
    if (!eventoIsl.has(i.id)) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]); ctx.lineDashOffset = -t / 80;
    ctx.beginPath(); ctx.arc(i.x + ox, i.y, i.r * 1.9, 0, 7); ctx.stroke();
    ctx.restore();
  }

  // en la vista general solo se rotulan islas del juego, bases y sedes: el resto, al acercar
  function rotulable(i) {
    return cam.z >= 0.95 || i.juego || i.base || i.tribunal || i.cuartel || i.natal;
  }

  // Histéresis del diorama: entra a LOD_ZOOM (1.5), solo sale bajando de LOD_SALIDA (1.12).
  // Así "alejar un poco" no te expulsa de la isla. La usan el mapa base y GFX.
  // Mientras hay un vuelo en curso NO se borra la marca: el vuelo cruza zooms bajos
  // al despegar y borrarla anularía el encuadre del clic.
  const dioramasActivos = new Set();
  MAPA.usaDiorama = function (i) {
    if (dioramasActivos.has(i.id)) {
      if (cam.z >= MAPA.LOD_SALIDA) return true;
      if (!vuelo) dioramasActivos.delete(i.id);
      return false;
    }
    return cam.z >= MAPA.LOD_ZOOM;
  };

  // Marcas del mundo sobre cada isla: secretos sin descubrir (?) y Cubos Rojos hallados.
  // Tamaño compensado por zoom: se ven igual de chicos en pantalla a cualquier escala.
  MAPA.marcasIsla = function (c2, i, t, ox) {
    const sm = MAPA._sim;
    if (!sm) return;
    const s = 1 / cam.z;
    const sec = sm.secretos && sm.secretos[i.id];
    if (sec && !sec.descubierto) {
      const pul = 7 + Math.sin(t / 380 + i.x * 1.7) * 1.6;
      c2.save();
      c2.globalAlpha = 0.9;
      c2.fillStyle = '#1d3a63'; c2.strokeStyle = '#f6e05e'; c2.lineWidth = 1.6 * s;
      c2.beginPath(); c2.arc(i.x + ox, i.y - i.r - 16 * s, pul * s, 0, 7); c2.fill(); c2.stroke();
      c2.fillStyle = '#f6e05e'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
      c2.font = 'bold ' + (13 * s) + 'px ui-sans-serif, system-ui, sans-serif';
      c2.fillText('?', i.x + ox, i.y - i.r - 16 * s);
      c2.restore();
    }
    const cb = sm.cubos && sm.cubos[i.id];
    if (cb && cb.hallado) {
      const y = i.y - i.r - 14 * s + Math.sin(t / 600 + i.x) * 1.5 * s;
      c2.save();
      c2.fillStyle = '#8a2b22'; c2.fillRect(i.x + ox - 6 * s, y - 6 * s, 12 * s, 12 * s);
      c2.fillStyle = '#e74c3c'; c2.fillRect(i.x + ox - 6 * s, y - 6 * s, 12 * s, 5 * s);
      c2.strokeStyle = 'rgba(0,0,0,0.35)'; c2.lineWidth = 1 * s;
      c2.strokeRect(i.x + ox - 6 * s, y - 6 * s, 12 * s, 12 * s);
      c2.restore();
    }
  };

  function dibujaIsla(i, ox, t) {
    // Con el zoom acercado, la isla ES su diorama 16-bit (NPCs caminando incluidos).
    if (MAPA.usaDiorama(i) && MAPA.dibujaEscenaIsla(ctx, i, t, ox)) return;
    const T = D.TEMAS[i.tema] || D.TEMAS.verde;
    const pts = formaIsla(i);
    sombraIsla(i, ox);
    // agua clara alrededor (bajío)
    ctx.beginPath();
    ctx.ellipse(i.x + ox, i.y, i.r * 1.5, i.r * 1.22, 0, 0, 7);
    ctx.fillStyle = 'rgba(120,190,220,0.35)'; ctx.fill();
    // arena
    ctx.beginPath();
    ctx.moveTo(i.x + ox + pts[0][0], i.y + pts[0][1]);
    for (const p of pts) ctx.lineTo(i.x + ox + p[0], i.y + p[1]);
    ctx.closePath();
    ctx.fillStyle = rgb(T.sand); ctx.fill();
    // tierra
    ctx.save(); ctx.translate(i.x + ox, i.y); ctx.scale(0.8, 0.8); ctx.translate(-(i.x + ox), -i.y);
    ctx.beginPath();
    ctx.moveTo(i.x + ox + pts[0][0], i.y + pts[0][1]);
    for (const p of pts) ctx.lineTo(i.x + ox + p[0], i.y + p[1]);
    ctx.closePath();
    ctx.fillStyle = rgb(T.land); ctx.fill();
    ctx.restore();
    // árboles / rasgos
    if (!i.decoDib) {
      i.decoDib = [];
      const T2 = T;
      const nn = Math.round(6 + T2.trees * 12);
      for (let k = 0; k < nn; k++) {
        const a = (k / nn) * Math.PI * 2 + i.r;
        const rr = i.r * 0.55;
        i.decoDib.push({ x: Math.cos(a * 3.1) * rr * 0.7, y: Math.sin(a * 2.3) * rr * 0.55, t: (k % 3) });
      }
    }
    for (const d of i.decoDib) {
      const px = i.x + ox + d.x, py = i.y + d.y;
      if (d.t === 0) { ctx.fillStyle = rgb(T.tree); ctx.fillRect(px - 1, py - 4, 2, 6); }
      else if (d.t === 1) { ctx.fillStyle = rgb(T.roof[d.x % T.roof.length | 0] || T.roof[0]); ctx.fillRect(px - 3, py - 2, 6, 4); }
      else { ctx.fillStyle = rgb(T.land2); ctx.fillRect(px - 2, py - 1, 5, 3); }
    }
    edificiosIsla(i, ox);
    anilloIsla(i, ox, t);
    // banderín de base de Marina / símbolo especial
    if (i.base) { ctx.fillStyle = '#f5f0e6'; ctx.fillRect(i.x + ox - 1, i.y - i.r - 9, 2, 9); ctx.fillStyle = '#2b6cb0'; ctx.fillRect(i.x + ox + 1, i.y - i.r - 9, 7, 5); }
    if (i.tribunal) { ctx.fillStyle = '#d69e2e'; ctx.beginPath(); ctx.arc(i.x + ox, i.y - i.r - 8, 3.5, 0, 7); ctx.fill(); }
    if (i.cruce || i.entrada) { ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.arc(i.x + ox, i.y - i.r - 8, 3.5, 0, 7); ctx.fill(); }
    // olas
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    const wob = Math.sin(t / 900 + i.x) * 1.6;
    ctx.beginPath(); ctx.moveTo(i.x + ox - i.r * 1.7, i.y + i.r * 1.15 + wob); ctx.lineTo(i.x + ox - i.r * 1.7 + 7, i.y + i.r * 1.15 + wob); ctx.stroke();
    if (rotulable(i)) {
      ctx.font = '600 ' + (i.r > 26 ? 11 : 9) + 'px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.textAlign = 'center';
      ctx.fillText(i.n, i.x + ox, i.y + i.r + 13);
    }
    if (selIsl === i) {
      ctx.strokeStyle = '#f6e05e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(i.x + ox, i.y, i.r + 7, 0, 7); ctx.stroke();
    }
    MAPA.marcasIsla(ctx, i, t, ox);
    // islas del cielo: puff de nubes sosteniendo la isla (Skypiea y compañía)
    if (i.cielo || i.id === 'skypiea') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const bob = Math.sin(t / 1100 + i.x) * 2;
      ctx.beginPath(); ctx.ellipse(i.x + ox - 14, i.y + i.r + 10 + bob, 16, 6, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(i.x + ox + 16, i.y + i.r + 13 - bob, 20, 7, 0, 0, 7); ctx.fill();
    }
  }

  function dibujaBarco(s, sim, t) {
    let x, y, ang;
    if (s.state === 'navegando' && s.plan) {
      const k = clamp((sim.t - s.plan.t0) / Math.max(1, s.plan.dur), 0, 1);
      const x0 = s.plan.x0, x1 = s.plan.x1;
      let dx = x1 - x0;
      if (Math.abs(dx) > D.W / 2) { // ruta que cruza el borde: interpola por el lado corto
        const sx = dx > 0 ? -D.W : D.W;
        x = ((x0 + dx * k + sx + D.W) % D.W);
      } else x = x0 + dx * k;
      y = s.plan.y0 + (s.plan.y1 - s.plan.y0) * k;
      ang = Math.atan2(s.plan.y1 - s.plan.y0, dx + (Math.abs(dx) > D.W / 2 ? (dx > 0 ? -D.W : D.W) : 0));
    } else {
      const isl = D.ISLA[s.isl]; if (!isl) return;
      x = isl.x + Math.sin(t / 800 + s.id) * 6; y = isl.y + isl.r + 10; ang = 0;
    }
    // estela
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x - Math.cos(ang) * 9, y - Math.sin(ang) * 9); ctx.lineTo(x - Math.cos(ang) * 16, y - Math.sin(ang) * 16); ctx.stroke();
    // casco
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = '#6b4a2f'; ctx.fillRect(-5, -3, 10, 6);
    ctx.fillStyle = '#f0e6d2'; ctx.fillRect(-1, -4, 2, 8);
    ctx.fillStyle = s.crew >= 0 && sim.crews[s.crew] ? '#d33' : '#8a6d3b';
    ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(0, -10); ctx.lineTo(7, -6); ctx.closePath(); ctx.fill();
    ctx.restore();
    s._px = x; s._py = y;
  }

  // ruido determinista (semilla fija) para texturas de la capa base
  function ruido(k) { const v = Math.sin(k * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }

  // ── Capa base: océano texturizado, Franjas de Calma, Gran Ruta y Muralla Roja como continente ──
  function crearBase() {
    const esc = D.W > 2000 ? 1.4 : 2;
    const cb = document.createElement('canvas');
    cb.width = Math.round(D.W * esc); cb.height = Math.round(D.H * esc);
    const c = cb.getContext('2d');
    c.scale(esc, esc);
    // océano con profundidad: gradiente vertical suave
    const grad = c.createLinearGradient(0, 0, 0, D.H);
    grad.addColorStop(0, '#1d5a99'); grad.addColorStop(0.5, '#2265ab'); grad.addColorStop(1, '#1d5a99');
    c.fillStyle = grad; c.fillRect(0, 0, D.W, D.H);
    // manchas amplias de tono sutil
    c.fillStyle = '#2365ad';
    for (let k = 0; k < 22; k++) {
      c.beginPath();
      c.ellipse(ruido(k + 1) * D.W, ruido(k + 50) * D.H, 110 + ruido(k + 99) * 170, 50 + ruido(k + 7) * 80, ruido(k + 3) * 3, 0, 7);
      c.fill();
    }
    // textura de olas: guiones cortos deterministas por todo el mar
    c.strokeStyle = 'rgba(255,255,255,0.055)'; c.lineWidth = 1.2;
    for (let k = 0; k < 1100; k++) {
      const x = ruido(k * 3.1) * D.W, y = ruido(k * 7.7) * D.H, l = 8 + ruido(k) * 14;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y); c.stroke();
    }
    // ── Franjas de Calma: banda gris-verde pálida con borde punteado ──
    for (const [a, b] of [[D.CB_T, D.GL_Y0], [D.GL_Y1, D.CB_B]]) {
      c.fillStyle = 'rgba(148,172,166,0.38)';
      c.fillRect(0, a, D.W, b - a);
      c.strokeStyle = 'rgba(230,240,236,0.4)'; c.lineWidth = 1.5; c.setLineDash([10, 12]);
      c.beginPath(); c.moveTo(0, a + 1); c.lineTo(D.W, a + 1); c.moveTo(0, b - 1); c.lineTo(D.W, b - 1); c.stroke();
      c.setLineDash([]);
    }
    // ── Gran Ruta: corredor más claro con retícula tenue de navegación ──
    c.fillStyle = 'rgba(255,255,255,0.05)';
    c.fillRect(0, D.GL_Y0, D.W, D.GL_Y1 - D.GL_Y0);
    c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 1;
    for (let x = 130; x < D.W; x += 260) { c.beginPath(); c.moveTo(x, D.GL_Y0); c.lineTo(x, D.GL_Y1); c.stroke(); }
    // ── rótulos: una vez por zona, sin spam ──
    c.textAlign = 'center';
    c.font = '700 30px Georgia, serif'; c.fillStyle = 'rgba(255,255,255,0.26)';
    c.fillText('M A R   D E L   N O R T E', 650, 250);
    c.fillText('M A R   D E L   E S T E', 1950, 250);
    c.fillText('M A R   D E L   O E S T E', 650, 1190);
    c.fillText('M A R   D E L   S U R', 1950, 1190);
    c.font = '700 26px Georgia, serif'; c.fillStyle = 'rgba(255,244,214,0.34)';
    c.fillText('N U E V O   M U N D O', 650, D.GL_Y0 + 105);
    c.fillText('P A R A Í S O', 1950, D.GL_Y0 + 105);
    c.font = '600 13px Georgia, serif'; c.fillStyle = 'rgba(238,246,242,0.55)';
    for (let x = 450; x < D.W; x += 900) {
      c.fillText('F R A N J A   D E   C A L M A', x, (D.CB_T + D.GL_Y0) / 2 + 4);
      c.fillText('F R A N J A   D E   C A L M A', x, (D.GL_Y1 + D.CB_B) / 2 + 4);
    }
    // ── Muralla Roja: continente ancho (~64px) rugoso con relieve ──
    const x0 = D.RL_X, hw = 32, paso = 10;
    c.beginPath();
    for (let y = 0; y <= D.H; y += paso) c.lineTo(x0 - hw + (ruido(y / paso) - 0.5) * 10, y);
    for (let y = D.H; y >= 0; y -= paso) c.lineTo(x0 + hw + (ruido(y / paso + 500) - 0.5) * 10, y);
    c.closePath(); c.fillStyle = '#a8553f'; c.fill();
    for (let k = 0; k < 80; k++) {
      const y = ruido(k * 13.7) * D.H, dy = (ruido(k * 3.3) - 0.5) * hw * 1.15, rr3 = 6 + ruido(k * 9.1) * 16;
      c.fillStyle = k % 2 ? 'rgba(201,122,90,0.5)' : 'rgba(120,56,40,0.45)';
      c.beginPath(); c.ellipse(x0 + dy, y, rr3, rr3 * 0.6, 0, 0, 7); c.fill();
    }
    c.fillStyle = 'rgba(212,150,118,0.45)';
    c.fillRect(x0 - 12, 0, 5, D.H); c.fillRect(x0 + 7, 0, 5, D.H);
    c.font = '700 13px Georgia, serif'; c.fillStyle = 'rgba(255,238,226,0.85)';
    c.save(); c.translate(x0 - 8, D.H - 130); c.rotate(-Math.PI / 2); c.fillText('M U R A L L A   R O J A', 0, 0); c.restore();
    // ── El anillo continúa: SEGUNDA franja de la Muralla Roja en el costurero del mapa ──
    // (la Red Line rodea el mundo: en el mapa plano se ve dos veces, como en la referencia)
    const hw2 = 20;
    for (const xs of [0, D.W]) {
      c.beginPath();
      for (let y = 0; y <= D.H; y += paso) c.lineTo(xs - hw2 + (ruido(y / paso + 900) - 0.5) * 8, y);
      for (let y = D.H; y >= 0; y -= paso) c.lineTo(xs + hw2 + (ruido(y / paso + 1300) - 0.5) * 8, y);
      c.closePath(); c.fillStyle = '#9c4c38'; c.fill();
      c.fillStyle = 'rgba(212,150,118,0.4)'; c.fillRect(xs - 9, 0, 4, D.H);
    }
    // corrientes del Reverse Mountain: las rutas del mundo convergen en el cruce (la X del mapa)
    c.save();
    c.strokeStyle = 'rgba(140,200,255,0.5)'; c.lineWidth = 3;
    const cruce = { x: D.RL_X, y: (D.GL_Y0 + D.GL_Y1) / 2 - 15 };
    for (const a of [0.62, Math.PI - 0.62, Math.PI + 0.62, -0.62]) {
      c.beginPath();
      c.moveTo(cruce.x + Math.cos(a) * 130, cruce.y + Math.sin(a) * 78);
      c.lineTo(cruce.x + Math.cos(a) * 14, cruce.y + Math.sin(a) * 9);
      c.stroke();
    }
    c.restore();
    // ── Estilo carta náutica: ruta dorada de la Gran Ruta ──
    const rutaIds = ['dawn', 'shells', 'baratie', 'arlong', 'loguetown', 'sabaody', 'ohara', 'wano'];
    const ruta = rutaIds.map(id => D.ISLAS.find(i => i.juegoId === id)).filter(Boolean);
    if (ruta.length > 1) {
      c.save();
      c.strokeStyle = 'rgba(244,193,26,0.42)'; c.lineWidth = 2.5; c.setLineDash([14, 10]);
      c.beginPath();
      ruta.forEach((p, k) => {
        if (!k) { c.moveTo(p.x, p.y); return; }
        const prev = ruta[k - 1], mx = (prev.x + p.x) / 2, my = (prev.y + p.y) / 2 - 30;
        c.quadraticCurveTo(mx, my, p.x, p.y);
      });
      c.stroke();
      c.restore();
    }
    // ── Rosa de los vientos ──
    const rx = 150, ry = D.H - 118, rr2 = 46;
    c.save();
    c.strokeStyle = 'rgba(255,240,210,0.5)'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(rx, ry, rr2, 0, 7); c.stroke();
    c.beginPath(); c.arc(rx, ry, rr2 * 0.66, 0, 7); c.stroke();
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 - Math.PI / 2;
      const largo = k % 2 ? rr2 * 0.62 : rr2 * 0.98;
      c.beginPath();
      c.moveTo(rx + Math.cos(a) * largo, ry + Math.sin(a) * largo);
      c.lineTo(rx + Math.cos(a + 0.26) * largo * 0.26, ry + Math.sin(a + 0.26) * largo * 0.26);
      c.lineTo(rx + Math.cos(a - 0.26) * largo * 0.26, ry + Math.sin(a - 0.26) * largo * 0.26);
      c.closePath();
      c.fillStyle = k % 2 ? 'rgba(255,240,210,0.32)' : 'rgba(255,240,210,0.6)';
      c.fill();
    }
    c.fillStyle = 'rgba(255,240,210,0.75)'; c.font = '700 13px Georgia, serif'; c.textAlign = 'center';
    c.fillText('N', rx, ry - rr2 - 7);
    c.restore();
    // ── Marco de carta náutica con marcas de coordenadas ──
    c.save();
    c.strokeStyle = 'rgba(255,240,210,0.22)'; c.lineWidth = 1.2;
    c.strokeRect(10, 10, D.W - 20, D.H - 20);
    c.beginPath();
    for (let x = 110; x < D.W - 20; x += 200) { c.moveTo(x, 10); c.lineTo(x, 22); c.moveTo(x, D.H - 10); c.lineTo(x, D.H - 22); }
    for (let y = 110; y < D.H - 20; y += 200) { c.moveTo(10, y); c.lineTo(22, y); c.moveTo(D.W - 10, y); c.lineTo(D.W - 22, y); }
    c.stroke();
    c.restore();
    return cb;
  }

  // ── GLOBO 16-bit: el mundo entero como esfera girable; con el zoom te bajas al mar ──
  let estrellado = null;
  function radioGlobo(g) {
    return Math.min(ancho, alto) * 0.48 * (0.58 + 0.42 * (1 - g));
  }

  // ── Textura del globo: océano pintado con bandas de calma, islas como sprites pixel
  //    con arena y terreno temático, y la Muralla Roja como cordillera rugosa ──
  function crearTextura() {
    const tw = 2048, th = 1024;
    const t = document.createElement('canvas');
    t.width = tw; t.height = th;
    const g2 = t.getContext('2d');
    const escX = tw / D.W, escY = th / D.H;
    // océano: profundo en los polos, vivo en el ecuador
    const oc = g2.createLinearGradient(0, 0, 0, th);
    oc.addColorStop(0, '#1a4d8c'); oc.addColorStop(0.24, '#2b6db3');
    oc.addColorStop(0.5, '#2f79c2'); oc.addColorStop(0.76, '#2b6db3'); oc.addColorStop(1, '#1a4d8c');
    g2.fillStyle = oc; g2.fillRect(0, 0, tw, th);
    // manchas amplias de tono: el mar nunca es un color plano
    for (let k = 0; k < 26; k++) {
      g2.fillStyle = k % 2 ? 'rgba(96,168,226,0.12)' : 'rgba(8,38,88,0.12)';
      g2.beginPath();
      g2.ellipse(ruido(k + 21) * tw, ruido(k + 57) * th, 140 + ruido(k + 91) * 220, 60 + ruido(k + 13) * 110, ruido(k + 5) * 3, 0, 7);
      g2.fill();
    }
    // Franjas de Calma: bandas claras al norte y al sur de la Gran Ruta
    const bandaCalma = (y0, y1) => {
      g2.fillStyle = 'rgba(152,202,236,0.28)';
      g2.fillRect(0, y0, tw, y1 - y0);
      g2.fillStyle = 'rgba(198,228,246,0.20)';
      for (let x = 0; x < tw; x += 24) {
        g2.fillRect(x + ((y0 / 24) % 1) * 12, y0 + 6 + ruido(x * 0.7 + y0) * (y1 - y0 - 14), 13, 2);
      }
    };
    bandaCalma(D.GL_Y0 * escY - 64, D.GL_Y0 * escY);
    bandaCalma(D.GL_Y1 * escY, D.GL_Y1 * escY + 64);
    // rótulos de mares grabados en la textura (van girando con el globo)
    g2.fillStyle = 'rgba(220,240,255,0.34)';
    g2.font = '600 34px system-ui, sans-serif';
    g2.textAlign = 'center';
    const sellos = [
      ['E A S T  B L U E', 0.16, 0.62], ['N O R T H  B L U E', 0.22, 0.3],
      ['W E S T  B L U E', 0.62, 0.3], ['S O U T H  B L U E', 0.68, 0.74],
      ['P A R A Í S O', 0.78, 0.46], ['N U E V O  M U N D O', 0.9, 0.52]
    ];
    for (const [txt, fx, fy] of sellos) g2.fillText(txt, fx * tw, fy * th);
    g2.fillStyle = 'rgba(215,235,250,0.30)';
    g2.font = '600 20px system-ui, sans-serif';
    for (const fy of [D.GL_Y0 * escY - 26, D.GL_Y1 * escY + 34]) {
      for (const fx of [0.12, 0.42, 0.72]) g2.fillText('F R A N J A  D E  C A L M A', fx * tw, fy);
    }
    // Muralla Roja: cordillera rugosa de polo a polo con vetas y cumbres
    const rx = D.RL_X * escX, paso = 30;
    const muroGrad = g2.createLinearGradient(0, 0, 0, th);
    muroGrad.addColorStop(0, '#a8503a'); muroGrad.addColorStop(0.5, '#93402c'); muroGrad.addColorStop(1, '#a8503a');
    const borde = (dir) => {
      const pts = [];
      for (let y = -paso; y <= th + paso; y += paso) {
        const w = (26 + ruido(y * 0.07 + (dir > 0 ? 5 : 9)) * 30) * (1 + 0.25 * Math.sin((y / th) * 6));
        pts.push([rx + dir * w + Math.sin((y / th) * 9 + 1.7) * 22 + (ruido(y * 0.11) - 0.5) * 26, y]);
      }
      return pts;
    };
    const izq = borde(-1), der = borde(1);
    g2.beginPath();
    izq.forEach(([X, y], k) => { if (k) g2.lineTo(X, y); else g2.moveTo(X, y); });
    der.reverse().forEach(([X, y]) => g2.lineTo(X, y));
    g2.closePath();
    g2.fillStyle = muroGrad; g2.fill();
    // vetas rocosas: trazos oscuros y cumbres iluminadas
    for (let q = 0; q < 130; q++) {
      const y = ruido(q * 3.3) * th;
      const X = rx + (ruido(q * 7.7) - 0.5) * 90 + Math.sin((y / th) * 9 + 1.7) * 22;
      const an = 3 + ruido(q * 9.1) * 9;
      g2.strokeStyle = q % 3 ? 'rgba(70,26,18,0.5)' : 'rgba(230,150,120,0.4)';
      g2.lineWidth = 1.6 + ruido(q) * 2;
      g2.beginPath();
      g2.moveTo(X - an, y - 3 + ruido(q * 2) * 6);
      g2.lineTo(X + an * 0.7, y + 2 + ruido(q * 4.4) * 5);
      g2.stroke();
    }
    // rótulo vertical de la muralla
    g2.save();
    g2.translate(rx + 92, th * 0.24);
    g2.rotate(Math.PI / 2);
    g2.fillStyle = 'rgba(255,220,205,0.55)';
    g2.font = '700 30px Georgia, serif';
    g2.textAlign = 'center';
    g2.fillText('M U R A L L A   R O J A', 0, 0);
    g2.restore();
    // islas como sprites pixel: arena irregular, terreno temático y detalles
    for (const i of D.ISLAS) {
      if (i.oculta) continue;
      const T = D.TEMAS[i.tema] || D.TEMAS.verde;
      const px = i.x * escX, py = i.y * escY;
      const rp = clamp(i.r * 0.52 * escX + 4, 6, 30);
      const K = 10, pts = [];
      for (let k = 0; k < K; k++) {
        const a = (k / K) * 6.2832, w = 0.62 + ruido(i.x * 0.13 + k * 3.1) * 0.55;
        pts.push([Math.cos(a) * rp * w, Math.sin(a) * rp * w * 0.76]);
      }
      const blob = (escF, color) => {
        g2.fillStyle = color;
        g2.beginPath();
        pts.forEach(([dx, dy], k) => {
          const X = px + dx * escF, Y = py + dy * escF;
          if (k) g2.lineTo(X, Y); else g2.moveTo(X, Y);
        });
        g2.closePath(); g2.fill();
      };
      const envuelve = (px - rp < 0 || px + rp > tw) ? [0, -tw, tw] : [0];
      for (const off of envuelve) {
        g2.save(); g2.translate(off, 0);
        blob(1.18, 'rgba(236,218,152,0.92)'); // arena perimetral
        blob(0.84, rgb(T.land));
        blob(0.52, rgb(T.land2));
        const nArboles = Math.round(2 + (T.trees || 0.3) * 6);
        for (let q = 0; q < nArboles; q++) {
          const a = ruido(i.y * 0.7 + q * 7.7) * 6.2832;
          const rr = rp * 0.42 * (0.3 + ruido(q * 13.1 + i.x * 0.11) * 0.7);
          g2.fillStyle = rgb(T.tree);
          g2.fillRect(px + Math.cos(a) * rr - 1.5, py + Math.sin(a) * rr - 1.5, 3, 3);
        }
        if (rp > 13 && (T.dense || (T.roof && T.roof.length > 1))) {
          g2.fillStyle = rgb(T.roof[0]);
          g2.fillRect(px - rp * 0.26, py - rp * 0.3, 4, 3);
          g2.fillStyle = rgb(T.roof[1 % T.roof.length] || T.roof[0]);
          g2.fillRect(px + rp * 0.14, py + rp * 0.12, 3, 3);
        }
        g2.restore();
      }
    }
    return t;
  }

  function dibujaEstrellas(t, alpha) {
    if (!estrellado) {
      estrellado = [];
      for (let k = 0; k < 150; k++) {
        estrellado.push({ x: ruido(k * 3.7) * ancho, y: ruido(k * 9.3) * alto, r: 0.5 + ruido(k * 1.3) * 1.3, tw: ruido(k * 5.1) * 6.28 });
      }
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#060d1f';
    ctx.fillRect(0, 0, ancho, alto);
    for (const s of estrellado) {
      ctx.globalAlpha = alpha * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 900 + s.tw)));
      ctx.fillStyle = '#cfe2ff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  // Esfera en caché: se repinta solo cuando giró o cambió el tamaño; el resto de frames es un blit.
  let esferaCache = null, esferaRot = 1e9, esferaR = -1;

  function pintaEsfera(Rs, texW, texH) {
    const S = Math.round(Rs * 2);
    esferaCache.width = S; esferaCache.height = S;
    const e2 = esferaCache.getContext('2d');
    const cc = Rs;
    e2.save();
    e2.beginPath(); e2.arc(cc, cc, Rs, 0, 7); e2.clip();
    // proyección ortográfica por celdas: franjas de longitud × bandas de latitud.
    // La anchura se escala con cos(latitud): compresión polar real, como el referente.
    const N = 72, M = 16;
    for (let k = 0; k < N; k++) {
      const l1 = -Math.PI / 2 + (k / N) * Math.PI, l2 = l1 + Math.PI / N;
      const s1 = Math.sin(l1), s2 = Math.sin(l2);
      if (s2 - s1 < 0.0015) continue;
      for (let j = 0; j < M; j++) {
        const f1 = -Math.PI / 2 + (j / M) * Math.PI, f2 = f1 + Math.PI / M;
        const cf = Math.cos((f1 + f2) / 2);
        const dw = (s2 - s1) * Rs * cf + 0.8, dx = cc + s1 * Rs * cf;
        if (dw < 0.4) continue;
        const dy = cc + Math.sin(f1) * Rs, dh = (Math.sin(f2) - Math.sin(f1)) * Rs + 0.8;
        let sxT = (((rotLon + (l1 + l2) / 2 + Math.PI) / (2 * Math.PI)) % 1) * texW - texW / (4 * N);
        if (sxT < 0) sxT += texW;
        const swT = texW / (2 * N), syT = ((f1 + Math.PI / 2) / Math.PI) * texH, shT = texH / M;
        if (sxT + swT <= texW) {
          e2.drawImage(TEX, sxT, syT, swT, shT, dx, dy, dw, dh);
        } else { // la franja cruza el borde del mundo: dos trozos
          const w1 = texW - sxT, w2 = swT - w1;
          e2.drawImage(TEX, sxT, syT, w1, shT, dx, dy, dw * (w1 / swT), dh);
          e2.drawImage(TEX, 0, syT, w2, shT, dx + dw * (w1 / swT), dy, dw * (w2 / swT), dh);
        }
      }
    }
    e2.restore();
  }

  function dibujaEsfera(t, alpha) {
    if (!TEX) TEX = crearTextura();
    const g = globoF();
    const cx = ancho / 2, cy = alto / 2;
    const R = radioGlobo(g);
    if (!esferaCache) esferaCache = document.createElement('canvas');
    if (Math.abs(rotLon - esferaRot) > 0.008 || Math.abs(R - esferaR) > 1.2) {
      pintaEsfera(R * devicePixelRatio, TEX.width, TEX.height);
      esferaRot = rotLon; esferaR = R;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    // doble halo atmosférico: el globo respira en el espacio
    ctx.beginPath(); ctx.arc(cx, cy, R + 16, 0, 7);
    ctx.fillStyle = 'rgba(90,150,230,0.10)'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, 7);
    ctx.fillStyle = 'rgba(110,170,255,0.18)'; ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
    ctx.drawImage(esferaCache, cx - R, cy - R, 2 * R, 2 * R);
    ctx.restore();
    // sombreado esférico: luz arriba-izquierda, limbo oscuro
    const som = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    som.addColorStop(0, 'rgba(255,255,255,0.12)');
    som.addColorStop(0.55, 'rgba(0,0,0,0)');
    som.addColorStop(0.82, 'rgba(4,8,20,0.26)');
    som.addColorStop(1, 'rgba(3,6,16,0.66)');
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7);
    ctx.fillStyle = som; ctx.fill();
    ctx.strokeStyle = 'rgba(140,190,255,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();

    // ── capa viva proyectada: islas con nombre, barcos y avisos del mundo ──
    const proyecta = (wx, wy) => {
      let lam = (wx / D.W) * 2 * Math.PI - rotLon;
      lam = ((lam + Math.PI * 3) % (2 * Math.PI)) - Math.PI;
      if (Math.abs(lam) > 1.45) return null;
      const phi = (wy / D.H) * Math.PI - Math.PI / 2;
      const frente = Math.cos(lam) * Math.cos(phi);
      if (frente < 0.15) return null; // de perfil o al otro lado
      return { x: cx + Math.sin(lam) * Math.cos(phi) * R, y: cy + Math.sin(phi) * R, k: frente };
    };
    const posBarco = (s) => {
      if (s.plan) {
        const kk = clamp(((t - s.plan.t0) / Math.max(1, s.plan.dur)), 0, 1);
        return { x: s.plan.x0 + (s.plan.x1 - s.plan.x0) * kk, y: s.plan.y0 + (s.plan.y1 - s.plan.y0) * kk };
      }
      const isl = D.ISLA[s.isl];
      return isl ? { x: isl.x, y: isl.y } : null;
    };
    // avisos: crisis o tormenta sobre una isla (pulso dorado)
    for (const id of eventoIsl) {
      const i = D.ISLA[id]; if (!i) continue;
      const p = proyecta(i.x, i.y); if (!p) continue;
      ctx.strokeStyle = 'rgba(246,224,94,' + (0.45 + 0.35 * Math.sin(t / 320)).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 8 + Math.sin(t / 320) * 2.5, 0, 7); ctx.stroke();
    }
    // barcos navegando: velitas doradas que cuentan que el mundo se mueve
    if (MAPA._sim) for (const s of MAPA._sim.ships || []) {
      const pos = posBarco(s); if (!pos) continue;
      const p = proyecta(pos.x, pos.y); if (!p) continue;
      ctx.fillStyle = 'rgba(255,232,150,' + (0.55 + 0.35 * p.k).toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x + 3.4, p.y + 2); ctx.lineTo(p.x - 3.4, p.y + 2);
      ctx.closePath(); ctx.fill();
    }
    // etiquetas de las islas mayores, sin amontonarse: se prioriza por tamaño
    // y una etiqueta que chocaría con otra ya dibujada se deja para el acercamiento
    ctx.textAlign = 'center';
    const puestas = [];
    const grandes = D.ISLAS.filter(i => !i.oculta && i.r >= 20).sort((a, b) => b.r - a.r);
    for (const i of grandes) {
      const p = proyecta(i.x, i.y); if (!p || p.k < 0.3) continue;
      ctx.font = '600 10px system-ui, sans-serif';
      const wT = ctx.measureText(i.n).width;
      const caja = { x0: p.x - wT / 2 - 3, x1: p.x + wT / 2 + 3, y0: p.y + 4, y1: p.y + 18 };
      if (puestas.some(q => caja.x0 < q.x1 && caja.x1 > q.x0 && caja.y0 < q.y1 && caja.y1 > q.y0)) continue;
      if (puestas.length >= 9) break;
      puestas.push(caja);
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = 'rgba(6,12,26,0.78)';
      ctx.strokeText(i.n, p.x, p.y + 15);
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      ctx.fillText(i.n, p.x, p.y + 15);
      if (selIsl === i) {
        ctx.strokeStyle = '#f6e05e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, 7); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // La simulación conserva las tormentas activas; las crisis del juego se sincronizan desde fusion.
  function actualizaEventos(sim, t) {
    if (t - eventoT < 500) return;
    eventoT = t;
    eventoIsl = new Set();
    for (const i of D.ISLAS) {
      if (sim._fusionCrisisIsland === i.id || (sim.storms || []).some(s => dist(s.x, s.y, i.x, i.y) < s.r + i.r)) eventoIsl.add(i.id);
    }
  }

  function dibujaCubo(px, py) {
    const s = 5; // media arista isométrica (~10px de ancho)
    ctx.fillStyle = 'rgba(10,30,50,0.35)';
    ctx.beginPath(); ctx.ellipse(px, py + 2, s * 1.5, s * 0.7, 0, 0, 7); ctx.fill();
    const cy = py - s; // centro de la cara superior
    ctx.fillStyle = '#e05252';
    ctx.beginPath(); ctx.moveTo(px, cy - s); ctx.lineTo(px + s, cy - s / 2); ctx.lineTo(px, cy); ctx.lineTo(px - s, cy - s / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b03a3a';
    ctx.beginPath(); ctx.moveTo(px - s, cy - s / 2); ctx.lineTo(px, cy); ctx.lineTo(px, cy + s); ctx.lineTo(px - s, cy + s / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8f2f2f';
    ctx.beginPath(); ctx.moveTo(px + s, cy - s / 2); ctx.lineTo(px, cy); ctx.lineTo(px, cy + s); ctx.lineTo(px + s, cy + s / 2); ctx.closePath(); ctx.fill();
  }

  MAPA.capaBase = function () { return base || (base = crearBase()); };
  MAPA.actualizaEventos = actualizaEventos;
  MAPA.sombraIsla = sombraIsla;
  MAPA.edificiosIsla = edificiosIsla;
  MAPA.anilloIsla = anilloIsla;
  MAPA.cubo = dibujaCubo;
  MAPA.etiquetaIsla = function (i, ox) {
    if (!rotulable(i)) return;
    ctx.font = '600 ' + (i.r > 26 ? 11 : 9) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'center';
    ctx.fillText(i.n, i.x + ox, i.y + i.r + 13);
    if (selIsl === i) {
      ctx.strokeStyle = '#f6e05e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(i.x + ox, i.y, i.r + 7, 0, 7); ctx.stroke();
    }
  };

  MAPA.render = function (sim, t) {
    if (!ctx) return;
    MAPA._sim = sim; // las marcas de isla (secretos, cubos) leen el estado del mundo
    pasaZoom(t); // la lupa persigue su objetivo ANTES de calcular la mezcla del globo
    const g = globoF();
    if (g >= 0.999) {
      // vista globo: espacio + esfera. Sin capas de mundo (rendimiento).
      dibujaEstrellas(t, 1);
      dibujaEsfera(t, 1);
      return;
    }
    // capa base estática (mar, franjas, muralla, rótulos): se pre-renderiza una vez por refit/resize
    ctx.fillStyle = '#2161a7'; ctx.fillRect(0, 0, ancho, alto);
    if (!base) base = crearBase();
    actualizaEventos(sim, t);
    ctx.save();
    ctx.translate(ancho / 2, alto / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    for (const off of [-D.W, 0, D.W]) ctx.drawImage(base, off, 0, D.W, D.H);
    // tormentas
    for (const s of sim.storms) {
      ctx.fillStyle = 'rgba(30,40,60,0.55)';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(180,200,255,0.5)';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.7, 0, 7); ctx.stroke();
    }
    // islas: SOLO las que cruzan la vista (culling con margen por diorama) — antes se pintaban
    // todas ×3 envolturas siempre y eso era el tirón de rendimiento.
    const vx0 = cam.x - ancho / (2 * cam.z), vx1 = cam.x + ancho / (2 * cam.z);
    const vy0 = cam.y - alto / (2 * cam.z), vy1 = cam.y + alto / (2 * cam.z);
    for (const i of D.ISLAS) {
      if (i.oculta) continue;
      const mg = Math.max(190, i.r * 16);
      for (const off of [0, -D.W, D.W]) {
        const x = i.x + off;
        if (x + mg < vx0 || x - mg > vx1 || i.y + mg < vy0 || i.y - mg > vy1) continue;
        dibujaIsla(i, off, t);
      }
    }
    // barcos
    for (const s of sim.ships) dibujaBarco(s, sim, t);
    // nubes
    for (const n of nubes) {
      n.x += n.v / 60; if (n.x > D.W + 60) n.x = -60;
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.beginPath(); ctx.ellipse(n.x, n.y, n.r, n.r * 0.42, 0, 0, 7); ctx.fill();
    }
    // tu avatar (el cubo solo con zoom lejos; cerca, el diorama muestra el sprite 16-bit)
    const u = sim.user;
    if (u && u.isl && !sim._fusionAtSea && cam.z < MAPA.LOD_ZOOM) {
      const isl = D.ISLA[u.isl];
      if (isl && !u.plan) {
        const px = isl.x + u.pos.x * isl.r * 0.7, py = isl.y + u.pos.y * isl.r * 0.5;
        dibujaCubo(px, py);
        ctx.strokeStyle = '#f6e05e'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py - 5, 12 + Math.sin(t / 300) * 2, 0, 7); ctx.stroke();
      }
    }
    ctx.restore();
    // aterrizaje/despegue: la esfera se superpone mientras el zoom cruza el umbral
    if (g > 0.001) {
      dibujaEstrellas(t, clamp((g - 0.7) / 0.3, 0, 1));
      dibujaEsfera(t, g);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
