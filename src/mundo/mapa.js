// Mapa del mundo en canvas: mares, Muralla Roja, Franjas de Calma, islas pixel, barcos y tormentas.
(function (G) {
  const { clamp, dist } = G.U;
  const D = G.D;
  const MAPA = (G.MAPA = {});

  let cv = null, ctx = null, cam = { x: 800, y: 400, z: 1 }, ancho = 0, alto = 0;
  let vuelo = null;
  let selIsl = null, onSel = null, base = null, eventoIsl = new Set(), eventoT = -1e9;
  const nubes = [];
  for (let i = 0; i < 26; i++) {
    nubes.push({ x: Math.random() * D.W, y: Math.random() * D.H, r: 16 + Math.random() * 30, v: 1.0 + Math.random() * 1.8 });
  }

  MAPA.init = function (canvas, cbSel) {
    cv = canvas; ctx = cv.getContext('2d'); onSel = cbSel;
    const fit = () => {
      const r = cv.parentElement.getBoundingClientRect();
      ancho = r.width; alto = r.height;
      cv.width = Math.round(ancho * devicePixelRatio); cv.height = Math.round(alto * devicePixelRatio);
      cv.style.width = ancho + 'px'; cv.style.height = alto + 'px';
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      base = null;
    };
    MAPA.resize = fit;
    fit();
    window.addEventListener('resize', fit);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(cv.parentElement);
    // interacción
    let drag = null;
    cv.addEventListener('mousedown', e => { vuelo = null; drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, movio: false }; });
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.movio = true;
      cam.x = clamp(drag.cx - dx / cam.z, 0, D.W); cam.y = clamp(drag.cy - dy / cam.z, 0, D.H);
    });
    window.addEventListener('mouseup', e => { if (drag && !drag.movio) MAPA.click(e); drag = null; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const nz = clamp(cam.z * (e.deltaY < 0 ? 1.15 : 0.87), 0.55, 6.0);
      cam.z = nz;
    }, { passive: false });
    cv.addEventListener('touchstart', e => {
      vuelo = null;
      if (e.touches.length === 1) drag = { x: e.touches[0].clientX, y: e.touches[0].clientY, cx: cam.x, cy: cam.y, movio: false };
    }, { passive: true });
    cv.addEventListener('touchmove', e => {
      if (!drag || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - drag.x, dy = e.touches[0].clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.movio = true;
      cam.x = clamp(drag.cx - dx / cam.z, 0, D.W); cam.y = clamp(drag.cy - dy / cam.z, 0, D.H);
    }, { passive: true });
    cv.addEventListener('touchend', e => {
      if (drag && !drag.movio) {
        const t = e.changedTouches[0];
        MAPA.click({ clientX: t.clientX, clientY: t.clientY });
      }
      drag = null;
    });
  };

  MAPA.click = function (e) {
    const r = cv.getBoundingClientRect();
    const wx = (e.clientX - r.left) / cam.z + cam.x - ancho / (2 * cam.z);
    const wy = (e.clientY - r.top) / cam.z + cam.y - alto / (2 * cam.z);
    // islas (con envoltura horizontal)
    for (const i of D.ISLAS) {
      for (const off of [0, -D.W, D.W]) {
        if (dist(wx, wy, i.x + off, i.y) < Math.max(14, i.r)) { selIsl = i; onSel && onSel(i); return; }
      }
    }
    selIsl = null; onSel && onSel(null);
  };

  MAPA.centra = function (x, y) { cam.x = x; cam.y = y; };
  // Vuelo suave: interpola la cámara hacia el destino con easing cúbico (sensación fluida).
  MAPA.volar = function (x, y, z, dur = 650) {
    vuelo = { t0: performance.now(), dur: Math.max(1, dur), fx: cam.x, fy: cam.y, fz: cam.z, tx: clamp(x, 0, D.W), ty: clamp(y, 0, D.H), tz: clamp(z, 0.55, 6.0) };
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
    if (k >= 1) vuelo = null;
  }
  MAPA.zoom = function (direction) { cam.z = clamp(cam.z * (direction > 0 ? 1.15 : 0.87), 0.55, 6.0); };

  // ── Dioramas 16-bit EN el mapa: al acercar el zoom, cada isla se convierte en su escena completa ──
  MAPA.LOD_ZOOM = 1.5;
  let apiEscenas = null;
  // fusion inyecta: { juegoDe, npcsDe, personajeDe, pinta } — el mundo no depende de la app.
  MAPA.configuraEscenas = function (api) { apiEscenas = api; };

  function rectDiorama(i, off) {
    const w = Math.max(i.r * 30, 300);
    const h = w * 400 / 640;
    return { x: i.x - w / 2 + off, y: i.y - h / 2, w, h };
  }
  MAPA.rectDiorama = rectDiorama;

  MAPA.dibujaEscenaIsla = function (c2, i, t, off) {
    if (!apiEscenas?.juegoDe || !apiEscenas?.pinta) return false;
    const juego = apiEscenas.juegoDe(i);
    if (!juego) return false;
    const r = rectDiorama(i, off);
    // culling: solo se dibuja si el diorama cruza la vista actual
    const margenX = ancho / (2 * cam.z) + r.w * 0.6, margenY = alto / (2 * cam.z) + r.h * 0.6;
    if (Math.abs(r.x + r.w / 2 - cam.x) > margenX || Math.abs(r.y + r.h / 2 - cam.y) > margenY) return true;
    const s = r.w / 640;
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

  function dibujaIsla(i, ox, t) {
    // Con el zoom acercado, la isla ES su diorama 16-bit (NPCs caminando incluidos).
    if (cam.z >= MAPA.LOD_ZOOM && MAPA.dibujaEscenaIsla(ctx, i, t, ox)) return;
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
    // nombre
    ctx.font = '600 ' + (i.r > 26 ? 11 : 9) + 'px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'center';
    ctx.fillText(i.n, i.x + ox, i.y + i.r + 13);
    if (selIsl === i) {
      ctx.strokeStyle = '#f6e05e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(i.x + ox, i.y, i.r + 7, 0, 7); ctx.stroke();
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

  // ruido determinista (semilla fija) para la rugosidad de la Muralla Roja
  function ruido(k) { const v = Math.sin(k * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }

  function crearBase() {
    const esc = 2;
    const cb = document.createElement('canvas');
    cb.width = D.W * esc; cb.height = D.H * esc;
    const c = cb.getContext('2d');
    c.scale(esc, esc);
    c.fillStyle = '#2161a7'; c.fillRect(0, 0, D.W, D.H);
    // manchas amplias de tono sutil
    c.fillStyle = '#2365ad';
    for (let k = 0; k < 14; k++) {
      c.beginPath();
      c.ellipse(ruido(k + 1) * D.W, ruido(k + 50) * D.H, 90 + ruido(k + 99) * 130, 40 + ruido(k + 7) * 60, ruido(k + 3) * 3, 0, 7);
      c.fill();
    }
    // Franjas de Calma y Gran Ruta
    c.fillStyle = 'rgba(87,147,153,0.45)';
    c.fillRect(0, D.CB_T, D.W, D.GL_Y0 - D.CB_T);
    c.fillRect(0, D.GL_Y1, D.W, D.CB_B - D.GL_Y1);
    c.fillStyle = 'rgba(255,255,255,0.06)';
    c.fillRect(0, D.GL_Y0, D.W, D.GL_Y1 - D.GL_Y0);
    c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,0.35)'; c.font = '12px Georgia, serif';
    for (let x = 210; x < D.W; x += 420) {
      c.fillText('F R A N J A   D E   C A L M A', x, D.CB_T + 14);
      c.fillText('F R A N J A   D E   C A L M A', x, D.CB_B - 6);
    }
    // rótulos de mares y de la Gran Ruta
    c.font = '700 26px Georgia, serif'; c.fillStyle = 'rgba(255,255,255,0.30)';
    c.fillText('M A R   D E L   N O R T E', 390, 60);
    c.fillText('M A R   D E L   E S T E', 1210, 60);
    c.fillText('M A R   D E L   O E S T E', 390, 770);
    c.fillText('M A R   D E L   S U R', 1210, 770);
    c.fillText('N U E V O   M U N D O', 390, D.GL_Y0 + 68);
    c.fillText('P A R A Í S O', 1210, D.GL_Y0 + 68);
    // Muralla Roja rugosa (~38px)
    const x0 = D.RL_X, paso = 8;
    c.beginPath();
    for (let y = 0; y <= D.H; y += paso) c.lineTo(x0 - 19 + (ruido(y / paso) - 0.5) * 7, y);
    for (let y = D.H; y >= 0; y -= paso) c.lineTo(x0 + 19 + (ruido(y / paso + 500) - 0.5) * 7, y);
    c.closePath(); c.fillStyle = '#b15f47'; c.fill();
    c.fillStyle = '#c97a5a';
    c.fillRect(x0 - 11, 0, 6, D.H); c.fillRect(x0 + 5, 0, 6, D.H);
    c.font = '700 12px Georgia, serif'; c.fillStyle = 'rgba(255,240,230,0.9)';
    c.save(); c.translate(x0 + 4, D.H - 60); c.rotate(-Math.PI / 2); c.fillText('M U R A L L A   R O J A', 0, 0); c.restore();
    // ── Estilo carta náutica: ruta dorada de la Gran Ruta ──
    const rutaIds = ['dawn', 'shells', 'baratie', 'arlong', 'loguetown', 'sabaody', 'ohara', 'wano'];
    const ruta = rutaIds.map(id => D.ISLAS.find(i => i.juegoId === id)).filter(Boolean);
    if (ruta.length > 1) {
      c.save();
      c.strokeStyle = 'rgba(244,193,26,0.42)'; c.lineWidth = 2.5; c.setLineDash([14, 10]);
      c.beginPath();
      ruta.forEach((p, k) => {
        if (!k) { c.moveTo(p.x, p.y); return; }
        const prev = ruta[k - 1], mx = (prev.x + p.x) / 2, my = (prev.y + p.y) / 2 - 26;
        c.quadraticCurveTo(mx, my, p.x, p.y);
      });
      c.stroke();
      c.restore();
    }
    // ── Rosa de los vientos ──
    const rx = 150, ry = D.H - 118, rr = 46;
    c.save();
    c.strokeStyle = 'rgba(255,240,210,0.5)'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(rx, ry, rr, 0, 7); c.stroke();
    c.beginPath(); c.arc(rx, ry, rr * 0.66, 0, 7); c.stroke();
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 - Math.PI / 2;
      const largo = k % 2 ? rr * 0.62 : rr * 0.98;
      c.beginPath();
      c.moveTo(rx + Math.cos(a) * largo, ry + Math.sin(a) * largo);
      c.lineTo(rx + Math.cos(a + 0.26) * largo * 0.26, ry + Math.sin(a + 0.26) * largo * 0.26);
      c.lineTo(rx + Math.cos(a - 0.26) * largo * 0.26, ry + Math.sin(a - 0.26) * largo * 0.26);
      c.closePath();
      c.fillStyle = k % 2 ? 'rgba(255,240,210,0.32)' : 'rgba(255,240,210,0.6)';
      c.fill();
    }
    c.fillStyle = 'rgba(255,240,210,0.75)'; c.font = '700 13px Georgia, serif'; c.textAlign = 'center';
    c.fillText('N', rx, ry - rr - 7);
    c.restore();
    // ── Marco de carta náutica con marcas de coordenadas ──
    c.save();
    c.strokeStyle = 'rgba(255,240,210,0.25)'; c.lineWidth = 1.2;
    c.strokeRect(10, 10, D.W - 20, D.H - 20);
    c.beginPath();
    for (let x = 60; x < D.W - 20; x += 120) { c.moveTo(x, 10); c.lineTo(x, 20); c.moveTo(x, D.H - 10); c.lineTo(x, D.H - 20); }
    for (let y = 60; y < D.H - 20; y += 120) { c.moveTo(10, y); c.lineTo(20, y); c.moveTo(D.W - 10, y); c.lineTo(D.W - 20, y); }
    c.stroke();
    c.restore();
    return cb;
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
    // islas
    for (const i of D.ISLAS) {
      if (i.oculta) continue;
      for (const off of [0, -D.W, D.W]) dibujaIsla(i, off, t);
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
  };
})(typeof window !== 'undefined' ? window : globalThis);
