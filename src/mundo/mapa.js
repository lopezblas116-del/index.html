// Mapa del mundo: GLOBO 16-bit girable que baja al mar con el zoom, mares, Muralla Roja,
// Franjas de Calma, islas pixel, barcos y tormentas. Zoom con pinza (dos dedos) y rueda.
(function (G) {
  const { clamp, dist } = G.U;
  const D = G.D;
  const MAPA = (G.MAPA = {});

  // Zoom: 0.5 = globo completo (esfera), 0.62 = aterrizando en el mar, 6.0 = dioramas.
  // La rueda y los botones mueven un OBJETIVO (zT) y la cámara lo persigue: zoom lupa, no salto.
  const Z_MIN = 0.42, Z_MAX = 9.5, UMBRAL_GLOBO = 0.48; // el globo solo entra en la franja 0.42-0.48: alejar desde una isla vuelve al MAR, nunca te expulsa a la esfera
  MAPA.LOD_ZOOM = 1.5;          // entrar al diorama
  MAPA.LOD_SALIDA = 1.12;       // salir del diorama (histéresis: alejarse un poco no te expulsa)
  let cv = null, ctx = null, cam = { x: D.W / 2, y: D.H / 2, z: Z_MIN }, ancho = 0, alto = 0;
  let zT = cam.z;               // objetivo de zoom (la lupa persigue esto)
  let ultT = 0;                 // timestamp del último frame, para el easing del zoom
  let vuelo = null;
  let selIsl = null, onSel = null, base = null, eventoIsl = new Set(), eventoT = -1e9;
  // ── Globo ──
  let rotLon = -0.35;                 // rotación horizontal actual (radianes)
  const envuelveX = (x) => ((x % D.W) + D.W) % D.W; // el mapa es un anillo: la costura se cruza sin salto
  let TEX = null;                     // textura del mundo para la esfera
  const nubes = [];
  for (let i = 0; i < 26; i++) {
    nubes.push({ x: Math.random() * D.W, y: Math.random() * D.H, r: 16 + Math.random() * 30, v: 1.0 + Math.random() * 1.8 });
  }
  // nubes del GLOBO: parches atmosféricos deterministas que derivan y giran con la esfera
  const nubesGlobo = [];
  for (let k = 0; k < 15; k++) {
    nubesGlobo.push({
      lx: ruido(k * 7.3) * D.W,
      fy: 0.14 + ruido(k * 3.1) * 0.72,
      r: 22 + ruido(k * 5.7) * 40,
      v: 0.02 + ruido(k * 9.7) * 0.05
    });
  }

  // Mezcla globo→mar: 1 = esfera pura, 0 = mapa plano. El zoom con el dedo la recorre.
  function globoF() { return clamp((UMBRAL_GLOBO - cam.z) / (UMBRAL_GLOBO - Z_MIN), 0, 1); }
  MAPA.enGlobo = function () { return globoF() > 0.5; };

  MAPA.init = function (canvas, cbSel) {
    cv = canvas; ctx = cv.getContext('2d'); onSel = cbSel;
    cv.style.touchAction = 'none'; // el navegador no se queda con los gestos del mapa
    const fit = () => {
      const r = cv.parentElement.getBoundingClientRect();
      // PERF: si el tamaño no cambió, no invalidar NADA. El ResizeObserver del padre
      // puede re-dispararse con nuestro propio ajuste del canvas: sin este guardia,
      // cada disparo tiraba la capa base horneada y el mundo se re-cocinaba por frame.
      if (Math.round(r.width) === Math.round(ancho) && Math.round(r.height) === Math.round(alto) && base) return;
      ancho = r.width; alto = r.height;
      const DPR = Math.min(window.devicePixelRatio || 1, 2); // tope 2: 3x en móviles cuadruplica el costo sin ganancia visible
      cv.width = Math.round(ancho * DPR); cv.height = Math.round(alto * DPR);
      cv.style.width = ancho + 'px'; cv.style.height = alto + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.imageSmoothingEnabled = false; // pixel art nítido: ningún escalado borroso
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
      p.style.cssText = 'position:absolute;left:50%;bottom:106px;transform:translateX(-50%);max-width:92%;padding:8px 14px;background:rgba(10,18,34,0.82);border:1px solid rgba(244,193,26,0.5);border-radius:999px;color:#f4d97a;font:600 13px/1.3 system-ui,sans-serif;text-align:center;pointer-events:none;transition:opacity .8s;z-index:5;opacity:.95';
      if (getComputedStyle(cv.parentElement).position === 'static') cv.parentElement.style.position = 'relative';
      cv.parentElement.appendChild(p);
      MAPA._pista = p;
    }
    // ── modo inmersión: píldora "Alejar" + banner breve con el nombre de la isla ──
    if (cv.parentElement && !cv.parentElement.querySelector('#mil-salir-cine')) {
      const salir = document.createElement('button');
      salir.type = 'button';
      salir.id = 'mil-salir-cine';
      salir.textContent = '⤡ Alejar';
      salir.setAttribute('aria-label', 'Alejar y salir del modo inmersión');
      salir.addEventListener('click', () => MAPA.volar(cam.x, cam.y, 1.25, 720));
      cv.parentElement.appendChild(salir);
      const nombre = document.createElement('div');
      nombre.id = 'mil-cine-nombre';
      nombre.setAttribute('role', 'status');
      cv.parentElement.appendChild(nombre);
      MAPA._cineNombre = nombre;
    }
    // el joystick se jubiló: el dedo manda — arrastre mueve, pinza acerca, rueda fija

    // ── interacción: arrastre, rueda, y PINZA con dos dedos centrada en el punto medio ──
    let drag = null, pellizco = null;
    // fluidez: mientras hay gestos el mapa corre a 60 fps (animaMapa consulta este flag)
    MAPA.interactuando = false;
    let quietoTimer = null;
    const toca = () => {
      MAPA.interactuando = true;
      clearTimeout(quietoTimer);
      quietoTimer = setTimeout(() => { MAPA.interactuando = false; }, 450);
    };
    const gira = (dx) => { rotLon += dx * 0.0045; };
    cv.addEventListener('mousedown', e => {
      cancelaVuelo(); // el arrastre toma el control
      toca();
      drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, movio: false };
    });
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      toca();
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.movio = true;
      if (globoF() > 0.5) gira(dx);
      else { cam.x = envuelveX(drag.cx - dx / cam.z); cam.y = clamp(drag.cy - dy / cam.z, 0, D.H); }
      drag.x = e.clientX; drag.y = e.clientY; drag.cx = cam.x; drag.cy = cam.y;
    });
    window.addEventListener('mouseup', e => { if (drag && !drag.movio) MAPA.click(e); drag = null; toca(); });
    // hover sin arrastre: isla bajo el cursor → resalte + cursor de mano (no corre en globo)
    window.addEventListener('mousemove', e => {
      if (drag) { cv.style.cursor = 'grabbing'; return; }
      const r = cv.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      if (px < 0 || py < 0 || px > r.width || py > r.height || globoF() > 0.5) {
        MAPA._hoverIsla = null;
        if (px >= 0 && py >= 0 && px <= r.width && py <= r.height && globoF() > 0.5) cv.style.cursor = 'grab';
        return;
      }
      const wx = px / cam.z + cam.x - ancho / (2 * cam.z);
      const wy = py / cam.z + cam.y - alto / (2 * cam.z);
      MAPA._hoverIsla = islaEn(wx, wy);
      cv.style.cursor = MAPA._hoverIsla ? 'pointer' : 'default';
    });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      cancelaVuelo(); // la lupa manda: un giro de rueda a mitad de vuelo toma el control
      toca();
      MAPA.zoom(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY);
    }, { passive: false });
    cv.addEventListener('touchstart', e => {
      cancelaVuelo(); // el dedo toma el control
      toca();
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
      toca();
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
          cam.x = envuelveX(pellizco.wx - (mx - ancho / 2) / cam.z);
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
        else { cam.x = envuelveX(drag.cx - dx / cam.z); cam.y = clamp(drag.cy - dy / cam.z, 0, D.H); }
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
      toca();
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
    // tu capitán camina: toque sobre TU isla con zoom cercano = caminar hasta el punto
    const u = MAPA._sim && MAPA._sim.user;
    if (u && u.isl && cam.z >= DETALLE_Z && !MAPA._sim._fusionAtSea) {
      const propia = D.ISLA[u.isl];
      if (propia && dist(wx, wy, propia.x, propia.y) < propia.r * 1.15) {
        MAPA._caminar = {
          x: clamp((wx - propia.x) / (propia.r * 0.7), -1, 1),
          y: clamp((wy - propia.y) / (propia.r * 0.5), -1, 1)
        };
        return;
      }
    }
    // islas (con envoltura horizontal)
    for (const i of D.ISLAS) {
      for (const off of [0, -D.W, D.W]) {
        if (dist(wx, wy, i.x + off, i.y) < Math.max(14, i.r + (cam.z < 1 ? 10 : 0))) { selIsl = i; onSel && onSel(i); return; }
      }
    }
    selIsl = null; onSel && onSel(null);
  };

  MAPA.centra = function (x, y) { cam.x = x; cam.y = y; };
  // Encuadre completo de una isla: calcula el zoom para que la isla DENTRO del
  // mapa entre entera en pantalla (con su playa, aldea y muelle) y vuela hasta allí.
  MAPA.enfocarIsla = function (i) {
    if (!i || !ancho) return;
    MAPA._enfocada = i; // la isla encuadrada: el banner del modo inmersión la nombra
    // ENTRAR de verdad: la isla ocupa buena parte de la pantalla (tope 7, casi 1:1 con el sprite)
    const z = clamp(Math.min(ancho / (i.r * 4.4), alto / (i.r * 2.6)), 1.35, 7);
    vuelo = creaVuelo(i.x, i.y + 22, z, 750);
    zT = vuelo.tz;
  };
  // ── Vuelo cinematográfico ──
  // Ruta más corta con envoltura horizontal (el mapa es un anillo: la Muralla se cruza por el
  // costurero), duración según distancia y "respiro orbital": los cruces largos elevan la cámara
  // hasta el globo y aterrizan en el destino. La estela dorada dibuja la ruta mientras vuela.
  function distX(d) { if (d > D.W / 2) d -= D.W; else if (d < -D.W / 2) d += D.W; return d; }
  function creaVuelo(x, y, z, dur) {
    const tz = clamp(z, Z_MIN, Z_MAX);
    const dx = distX(x - cam.x), dy = clamp(y, 0, D.H) - cam.y;
    const dNorm = clamp(Math.hypot(dx, dy) / (D.W * 0.8), 0, 1); // 0 = vecino, 1 = cruce del mundo
    const v = {
      t0: performance.now(),
      dur: Math.max(Math.max(1, dur), 700 + 1050 * dNorm),
      fx: cam.x, fy: cam.y, fz: cam.z,
      tx: cam.x + dx, ty: clamp(y, 0, D.H), tz,
      dip: dNorm * (cam.z + tz) / 2 // a cruce completo la cámara llega justo al globo (Z_MIN)
    };
    creaEstela(v);
    return v;
  }
  MAPA.volar = function (x, y, z, dur = 650) {
    vuelo = creaVuelo(x, y, z, dur);
  };
  MAPA.volando = function () { return Boolean(vuelo); };
  MAPA.avanzaVuelo = function (t) { avanzaVuelo(t); };
  // La lupa (rueda / pinza / arrastre) toma el control: el vuelo cede y su estela se desvanece.
  function cancelaVuelo() {
    if (!vuelo) return;
    if (estela && !estela.fin) estela.fin = performance.now();
    vuelo = null;
  }
  function avanzaVuelo(t) {
    if (!vuelo) return;
    const k = clamp((t - vuelo.t0) / vuelo.dur, 0, 1);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    cam.x = vuelo.fx + (vuelo.tx - vuelo.fx) * e;
    cam.y = vuelo.fy + (vuelo.ty - vuelo.fy) * e;
    cam.z = clamp(vuelo.fz + (vuelo.tz - vuelo.fz) * e - vuelo.dip * Math.sin(Math.PI * e), Z_MIN, Z_MAX);
    zT = cam.z; // el vuelo manda: el objetivo acompaña para que la lupa no pelee con él
    if (estela) estela.prog = e;
    if (k >= 1) {
      if (estela) estela.fin = t; // la ruta dorada se apaga sola tras el aterrizaje
      cam.x = ((cam.x % D.W) + D.W) % D.W;
      vuelo = null;
    }
  }
  // ── Estela del vuelo: la Gran Ruta se dibuja sola hacia el destino (curva + cometa dorado) ──
  let estela = null; // { pts, t0, prog, fin }
  function creaEstela(v) {
    const ax = cam.x, ay = cam.y, bx = v.tx, by = v.ty;
    const lift = Math.min(230, 55 + Math.abs(bx - ax) * 0.14);
    const cyy = Math.min(ay, by) - lift;
    const pts = [];
    for (let k = 0; k <= 28; k++) {
      const u = k / 28, iu = 1 - u;
      pts.push({ x: iu * iu * ax + 2 * iu * u * ((ax + bx) / 2) + u * u * bx, y: iu * iu * ay + 2 * iu * u * cyy + u * u * by });
    }
    estela = { pts, t0: v.t0, prog: 0, fin: 0 };
  }
  function pintaEstelaVuelo(t) {
    if (!estela) return;
    const alpha = estela.fin ? clamp(1 - (t - estela.fin) / 430, 0, 1) * 0.8 : 0.8;
    if (alpha <= 0) { estela = null; return; }
    const prog = estela.fin ? 1 : (estela.prog || 0);
    const n = Math.max(2, Math.round(estela.pts.length * prog));
    const inv = 1 / Math.max(0.35, cam.z);
    ctx.save();
    ctx.globalAlpha = alpha;
    for (const off of [0, -D.W, D.W]) {
      ctx.save(); ctx.translate(off, 0);
      ctx.strokeStyle = 'rgba(244,193,26,0.9)'; ctx.lineWidth = 2.6 * inv;
      ctx.setLineDash([10 * inv, 9 * inv]); ctx.lineDashOffset = -t / 22;
      ctx.beginPath();
      for (let k = 0; k < n; k++) { const p = estela.pts[k]; if (k) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
      ctx.stroke();
      if (!estela.fin && n > 1) { // cometa: halo suave + núcleo brillante al frente de la ruta
        const p = estela.pts[n - 1];
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16 * inv);
        g.addColorStop(0, 'rgba(255,224,130,0.5)'); g.addColorStop(1, 'rgba(255,224,130,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 16 * inv, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(p.x, p.y, 3.6 * inv, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.setLineDash([]);
  }
  // zoom(direction, cx, cy): mueve el OBJETIVO de zoom (la lupa); con foco opcional en el cursor
  MAPA.zoom = function (direction, cx, cy) {
    const z0 = zT;
    zT = clamp(zT * (direction > 0 ? 1.16 : 0.86), Z_MIN, Z_MAX);
    if (cx != null && globoFT(zT) < 0.5 && cv) {
      const r = cv.getBoundingClientRect();
      const mx = cx - r.left, my = cy - r.top;
      const wx = cam.x + (mx - ancho / 2) / z0, wy = cam.y + (my - alto / 2) / z0;
      cam.x = envuelveX(wx - (mx - ancho / 2) / zT);
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

  // ── UN SOLO MAPA: la isla crece DENTRO del mapa (sin escenas-rectángulo).
  //    LOD_ZOOM queda como umbral del modo inmersión y del ritmo de animación. ──
  MAPA.LOD_ZOOM = 1.5;
  // Exposiciones para la capa de gráficos mejorados (GFX)
  MAPA.cam = cam;
  MAPA.nubes = nubes;
  MAPA.formaIslaPublica = formaIsla;
  MAPA.pintaIslaVista = pintaIslaVista;
  MAPA.selIslaPublica = () => selIsl;

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

  // ── Vista media de la isla: bajío claro, espuma, arena, tierra con parches,
  //    árboles en anillo exterior y casas interiores — nada apilado ni confeti ──
  function pintaIslaVista(i, ox, t) {
    const T = D.TEMAS[i.tema] || D.TEMAS.verde;
    const pts = formaIsla(i);
    const cx = i.x + ox, cy = i.y, r = i.r;
    // bajío: halo de agua MÁS CLARO que el mar (nunca oscuro), con borde suave
    const baj = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.62);
    baj.addColorStop(0, 'rgba(168,216,238,0.55)');
    baj.addColorStop(0.7, 'rgba(150,205,232,0.30)');
    baj.addColorStop(1, 'rgba(150,205,232,0)');
    ctx.fillStyle = baj;
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.62, r * 1.3, 0, 0, 7); ctx.fill();
    // espuma: aro blanco irregular que respira con las olas
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.6;
    const pulso = 1 + Math.sin(t / 1100 + i.x * 0.3) * 0.02;
    ctx.beginPath();
    pts.forEach(([dx, dy], k) => {
      const X = cx + dx * 1.18 * pulso, Y = cy + dy * 1.18 * pulso;
      if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    });
    ctx.closePath(); ctx.stroke();
    ctx.restore();
    // arena
    const camino = () => {
      ctx.beginPath();
      pts.forEach(([dx, dy], k) => {
        const X = cx + dx, Y = cy + dy;
        if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      });
      ctx.closePath();
    };
    camino();
    ctx.fillStyle = rgb(T.sand); ctx.fill();
    ctx.strokeStyle = 'rgba(120,96,54,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    // tierra (blob interior) con parches de segundo tono recortados dentro
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(0.78, 0.72); ctx.translate(-cx, -cy);
    camino();
    ctx.fillStyle = rgb(T.land); ctx.fill();
    ctx.save(); ctx.clip();
    for (let q = 0; q < 5; q++) {
      const a = q * 1.257 + i.r * 0.13, rr = r * (0.18 + ruido(q * 7.7 + i.r) * 0.34);
      ctx.fillStyle = 'rgba(' + T.land2.join(',') + ',0.8)';
      ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, r * 0.3, r * 0.24, a, 0, 7); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
    // ── decoración determinista sin superposiciones: casas al centro, árboles al anillo ──
    let h = 7;
    for (const ch of i.id) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
    const nCasas = 1 + (h % 3) + (i.r > 30 ? 1 : 0);
    const casas = [];
    for (let k = 0; k < nCasas; k++) {
      h = (h * 1103515245 + 12345) >>> 0;
      const a = (k / nCasas) * 6.2832 + ((h >>> 8) % 100) / 100 * 0.9;
      const rr = r * 0.3 * (0.5 + ((h >>> 16) % 100) / 100);
      casas.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.7, s: 0.8 + ((h >>> 20) % 100) / 250, roof: T.roof[k % T.roof.length] });
    }
    for (const c2 of casas) {
      const s = c2.s;
      ctx.fillStyle = 'rgba(20,34,52,0.28)';
      ctx.fillRect(c2.x - 7 * s, c2.y + 2 * s, 16 * s, 3.5 * s);
      ctx.fillStyle = rgb(T.wall);
      ctx.fillRect(c2.x - 7 * s, c2.y - 7 * s, 14 * s, 9 * s);
      ctx.fillStyle = rgb(c2.roof);
      ctx.fillRect(c2.x - 9 * s, c2.y - 11 * s, 18 * s, 5 * s);
      ctx.fillRect(c2.x - 5 * s, c2.y - 13 * s, 10 * s, 2.5 * s);
      ctx.fillStyle = 'rgba(30,20,12,0.55)';
      ctx.fillRect(c2.x - 2 * s, c2.y - 1 * s, 4 * s, 4 * s);
      ctx.strokeStyle = 'rgba(35,25,15,0.45)'; ctx.lineWidth = 0.8;
      ctx.strokeRect(c2.x - 9 * s, c2.y - 13 * s, 18 * s, 14 * s);
    }
    const nArboles = Math.round(4 + (T.trees || 0.3) * 9);
    for (let k = 0; k < nArboles; k++) {
      const a = (k / nArboles) * 6.2832 + i.r * 0.07 + (ruido(k * 13.3 + i.r) - 0.5) * 0.42;
      const rr = r * (0.58 + ruido(k * 3.9 + i.x) * 0.22);
      const px2 = cx + Math.cos(a) * rr, py2 = cy + Math.sin(a) * rr * 0.78;
      ctx.fillStyle = 'rgba(20,34,52,0.22)';
      ctx.beginPath(); ctx.ellipse(px2, py2 + 1.5, 4.5, 2, 0, 0, 7); ctx.fill();
      if (T.palms) { // palmera: trono curvado y penachos
        ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(px2, py2); ctx.quadraticCurveTo(px2 + 1.5, py2 - 5, px2 + 2.5, py2 - 9); ctx.stroke();
        ctx.strokeStyle = rgb(T.tree); ctx.lineWidth = 1.7;
        for (const fr of [-1, 0, 1]) {
          ctx.beginPath(); ctx.moveTo(px2 + 2.5, py2 - 9);
          ctx.quadraticCurveTo(px2 + 2.5 + fr * 5, py2 - 12, px2 + 2.5 + fr * 7, py2 - 8); ctx.stroke();
        }
      } else { // pinito: copa en dos pisos con luz
        ctx.fillStyle = '#5b3f28';
        ctx.fillRect(px2 - 1, py2 - 4, 2, 5);
        ctx.fillStyle = rgb(T.tree);
        ctx.beginPath(); ctx.moveTo(px2 - 4.5, py2 - 3); ctx.lineTo(px2, py2 - 12); ctx.lineTo(px2 + 4.5, py2 - 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.beginPath(); ctx.moveTo(px2 - 2.4, py2 - 5); ctx.lineTo(px2, py2 - 11); ctx.lineTo(px2 + 1.6, py2 - 5); ctx.closePath(); ctx.fill();
      }
    }
    // muelle en islas grandes: tablones hacia el mar con un bote
    if (i.r > 26) {
      const mx = cx, my = cy + r * 0.72, saliente = r * 0.62;
      ctx.fillStyle = '#8a5a33';
      ctx.fillRect(mx - 4, my, 8, saliente);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let q = 1; q < 4; q++) ctx.fillRect(mx - 4, my + q * saliente / 4, 8, 1.4);
      ctx.fillStyle = '#614536';
      ctx.fillRect(mx + r * 0.18, my + saliente + 2, 14, 6);
      ctx.fillStyle = '#e6dec4';
      ctx.fillRect(mx + r * 0.18 + 5, my + saliente - 6, 1.6, 7);
    }
    // banderines institucionales (base, tribunal, cruce) — sobre la casa central
    if (i.base) {
      ctx.fillStyle = '#5b3f28'; ctx.fillRect(cx + 4, cy - r * 0.5 - 12, 2, 12);
      ctx.fillStyle = '#2b6cb0'; ctx.fillRect(cx + 6, cy - r * 0.5 - 12, 9, 6);
    }
    if (i.tribunal) {
      ctx.fillStyle = '#5b3f28'; ctx.fillRect(cx - 9, cy - r * 0.5 - 12, 2, 12);
      ctx.fillStyle = '#d69e2e'; ctx.beginPath(); ctx.arc(cx - 8, cy - r * 0.5 - 13, 4.5, 0, 7); ctx.fill();
    }
    if (i.cruce || i.entrada) {
      ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.arc(cx, cy - r * 0.5 - 10, 4.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#b03a3a'; ctx.fillRect(cx - 1.2, cy - r * 0.5 - 14, 2.4, 8);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  UN SOLO MAPA — islas pixel-art detalladas que crecen DENTRO del mapa.
  //  Al acercar el zoom la isla NO se sustituye por una escena aparte:
  //  revela playa, terreno con textura, relieve, aldea temática y muelle,
  //  todo pre-renderizado una vez por isla (sprite cacheado, LRU) y escalado
  //  sin suavizado: píxeles nítidos con la misma estética del globo.
  // ═══════════════════════════════════════════════════════════════════════
  const DETALLE_Z = 1.12;
  MAPA.usaDetalle = function () { return cam.z >= DETALLE_Z; };

  function hIsla(i, k) { // hash determinista isla+slot: el mismo arte cada frame
    let h = 7;
    for (const ch of i.id + '#' + k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return (h ^ (h >>> 13)) >>> 0;
  }
  const rIsla = (i, k) => (hIsla(i, k) % 1000) / 1000;
  const ES_MOVIL = (typeof screen !== 'undefined' && Math.min(screen.width || 0, screen.height || 0) < 820) || (typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent || ''));
  const SPR_S = ES_MOVIL ? 5 : 6;
  // px del sprite por unidad de mundo. Con las islas grandes 8px eran ~18MB por isla
  // (×16 en caché ≈ 280MB: la GPU del teléfono se ahogaba). 5-6 mantiene el pixel art nítido.

  // ── EL LAYOUT canónico de cada isla: UNA lista determinista de casas, árboles
  //    y adornos compartida por TODO el arte. El zoom ya no cambia de artista:
  //    la misma aldea gana resolución. La noche enciende ESTAS ventanas. ──
  function layoutIsla(i) {
    if (i._lay) return i._lay;
    const T = D.TEMAS[i.tema] || D.TEMAS.verde;
    const tema = i.tema || 'verde';
    const r = i.r;
    const baseCasas = { ciudad: 6, puerto: 4, fortaleza: 3, prision: 0, japon: 5, dulce: 4, gobierno: 5 }[tema] ?? (3 + Math.floor(rIsla(i, 7) * 4));
    const dens = Math.max(1, Math.min(1.6, r / 27)); // islas más grandes: más pueblo, misma proporción
    const nCasas = Math.round(baseCasas * dens);
    const casas = [];
    for (let q = 0; q < nCasas; q++) {
      const a = rIsla(i, 100 + q * 3) * 6.2832;
      const rr = r * (0.14 + rIsla(i, 130 + q) * 0.36);
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.7 + 2, s = 0.9 + rIsla(i, 160 + q) * 0.5;
      casas.push({ x, y, wy: y - 4.4 * s, s, roof: T.roof[q % T.roof.length] });
    }
    const nArb = Math.round((7 + (T.trees || 0.3) * 10) * Math.max(1, Math.min(1.5, r / 27)));
    const arboles = [];
    for (let q = 0; q < nArb; q++) {
      const a = (q / nArb) * 6.2832 + (rIsla(i, 200 + q) - 0.5) * 0.5;
      const rr = r * (0.5 + rIsla(i, 230 + q) * 0.3);
      arboles.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr * 0.76, s: 0.8 + rIsla(i, 260 + q) * 0.5 });
    }
    // adornos de interior: arbustos, matas, rocas y flores (la vida de cerca)
    const adornos = [];
    const nAd = 6 + Math.floor(rIsla(i, 9) * 5);
    for (let q = 0; q < nAd; q++) {
      const a = rIsla(i, 400 + q) * 6.2832;
      const rr = r * (0.2 + rIsla(i, 430 + q) * 0.52);
      adornos.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr * 0.66, t: rIsla(i, 460 + q) });
    }
    i._lay = { casas, arboles, adornos };
    return i._lay;
  }

  // Chaikin ×2: la MISMA silueta de formaIsla con costa orgánica (continuidad al hacer zoom)
  function suaviza(pts, iter) {
    let out = pts;
    for (let n = 0; n < iter; n++) {
      const nx = [];
      for (let k = 0; k < out.length; k++) {
        const a = out[k], b = out[(k + 1) % out.length];
        nx.push([a[0] * 0.72 + b[0] * 0.28, a[1] * 0.72 + b[1] * 0.28]);
        nx.push([a[0] * 0.28 + b[0] * 0.72, a[1] * 0.28 + b[1] * 0.72]);
      }
      out = nx;
    }
    return out;
  }

  const cacheSprites = new Map();
  // día/noche: DOS caches coexistentes (d: / n: prefijo en la clave). El dataset
  // de <body> lo escriben DOS módulos (hud.js con el reloj real y mundo/ui.js con
  // la atmósfera del sim) y puede alternar entre frames: vaciar la caché en cada
  // cambio re-cocinaba TODAS las islas visibles cada frame (medido: 193ms/frame).
  // Con claves separadas el parpadeo es gratis y el pueblo se enciende y apaga solo.
  const esNoche = () => document.body?.dataset.atmosphere === 'night';
  function spriteDetalle(i) {
    const clave = (esNoche() ? 'n:' : 'd:') + i.id;
    const hit = cacheSprites.get(clave);
    if (hit) { cacheSprites.delete(clave); cacheSprites.set(clave, hit); return hit; }
    const T = D.TEMAS[i.tema] || D.TEMAS.verde;
    const r = i.r, tema = i.tema || 'verde';
    const R = Math.ceil(r * 1.9 + 54);
    const c = document.createElement('canvas');
    c.width = c.height = R * 2 * SPR_S;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.scale(SPR_S, SPR_S);
    g.translate(R, R);
    const rgb2 = (col) => 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
    const el = (x, y, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
    const rc = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const pts = suaviza(formaIsla(i), 2);
    const poly = (esc, col, stroke, lw) => {
      g.beginPath();
      pts.forEach(([dx, dy], k) => { const X = dx * esc, Y = dy * esc; if (k) g.lineTo(X, Y); else g.moveTo(X, Y); });
      g.closePath();
      if (col) { g.fillStyle = col; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
    };
    const clipLand = () => { g.save(); g.beginPath(); pts.forEach(([dx, dy], k) => { const X = dx * 0.82, Y = dy * 0.82; if (k) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); g.clip(); };

    // ── sombra, bajío y arena ──
    el(2, 5, r * 1.62, r * 1.3, 'rgba(6,26,48,0.30)');
    el(0, 0, r * 1.95, r * 1.56, 'rgba(16,58,110,0.12)'); // aguas profundas: borde cartográfico
    el(0, 0, r * 1.68, r * 1.36, 'rgba(150,205,232,0.30)');
    el(0, 0, r * 1.38, r * 1.12, 'rgba(168,216,238,0.42)');
    poly(1.04, rgb2(T.sand), 'rgba(255,255,255,0.5)', 1.2);
    poly(0.92, 'rgba(196,168,104,0.55)'); // arena mojada
    poly(0.82, rgb2(T.land));
    // textura dither del terreno: grano determinista en dos tonos
    clipLand();
    for (let yy = -r * 0.9; yy < r * 0.9; yy += 1.4) {
      for (let xx = -r * 0.9; xx < r * 0.9; xx += 1.4) {
        const n = rIsla(i, Math.floor(xx * 3.7 + yy * 91) % 9973);
        if (n > 0.72) rc(xx, yy, 1.1, 1.1, 'rgba(' + T.land2.join(',') + ',0.6)');
        else if (n < 0.1) rc(xx, yy, 1.1, 1.1, 'rgba(255,255,255,0.08)');
      }
    }
    for (let q = 0; q < 4; q++) {
      const a = rIsla(i, 40 + q) * 6.2832, rr = r * (0.16 + rIsla(i, 60 + q) * 0.3);
      el(Math.cos(a) * rr, Math.sin(a) * rr * 0.72, r * 0.3, r * 0.22, 'rgba(' + T.land2.join(',') + ',0.75)');
    }
    // luz solar del noroeste: el terreno brilla hacia el sol, se apaga al sureste
    const sol = g.createRadialGradient(-r * 0.45, -r * 0.5, r * 0.15, 0, 0, r * 1.35);
    sol.addColorStop(0, 'rgba(255,246,214,0.12)');
    sol.addColorStop(0.55, 'rgba(255,255,255,0)');
    sol.addColorStop(1, 'rgba(8,20,40,0.16)');
    g.fillStyle = sol; g.fillRect(-r * 1.1, -r * 1.1, r * 2.2, r * 2.2);
    // hallazgos de playa: conchas y madera a la deriva en el anillo de arena
    for (let q = 0; q < 4; q++) {
      const a = rIsla(i, 500 + q) * 6.2832, rr = r * (0.9 + rIsla(i, 530 + q) * 0.1);
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.8;
      if (q % 2) { el(px, py, 1.4, 1.1, 'rgba(255,252,240,0.85)'); el(px + 0.5, py - 0.4, 0.5, 0.4, '#e8a0c0'); }
      else { g.strokeStyle = 'rgba(122,82,54,0.75)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px - 2.4, py + 0.8); g.lineTo(px + 2.2, py - 0.6); g.stroke(); }
    }
    g.restore();

    // ── vegetación en el anillo exterior (determinista, con sombra) ──
    const palmeraP = (x, y, s) => {
      el(x + 1, y + 1, 5 * s, 2 * s, 'rgba(6,26,48,0.25)');
      for (let k = 0; k < 6; k++) rc(x + k * 0.9 * s - 1, y - k * 2.1 * s, 1.8 * s, 2.4 * s, '#8a5a33');
      const tx = x + 4.5 * s, ty = y - 12 * s;
      rc(tx - 7 * s, ty - 1 * s, 15 * s, 2.6 * s, rgb2(T.tree));
      rc(tx - 4 * s, ty - 3.4 * s, 11 * s, 2.6 * s, rgb2(T.tree));
      rc(tx + 3 * s, ty + 1 * s, 8 * s, 2.4 * s, rgb2(T.tree));
      rc(tx - 9 * s, ty + 1.2 * s, 8 * s, 2.2 * s, rgb2(T.tree));
      rc(tx - 2 * s, ty - 2 * s, 6 * s, 1.6 * s, 'rgba(255,255,255,0.18)');
      el(tx - 1, ty + 2, 1 * s, 1 * s, '#6b4a2f'); el(tx + 1.5, ty + 2.6, 1 * s, 1 * s, '#6b4a2f');
    };
    const pinoP = (x, y, s, nieve) => {
      el(x + 1, y + 1, 4 * s, 1.8 * s, 'rgba(6,26,48,0.25)');
      rc(x - 0.8 * s, y - 3 * s, 1.6 * s, 4 * s, '#5b3f28');
      const tri = (x0, y0, w0, h0, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x0 - w0, y0); g.lineTo(x0, y0 - h0); g.lineTo(x0 + w0, y0); g.closePath(); g.fill(); };
      tri(x, y - 3 * s, 5 * s, 8 * s, rgb2(T.tree));
      tri(x, y - 8 * s, 4 * s, 7 * s, rgb2(T.tree));
      tri(x, y - 12 * s, 2.6 * s, 5 * s, rgb2(T.tree));
      if (nieve) { tri(x, y - 12 * s, 2.4 * s, 4 * s, 'rgba(238,248,255,0.9)'); rc(x - 3 * s, y - 6 * s, 6 * s, 1.2 * s, 'rgba(238,248,255,0.75)'); }
    };
    const cactusP = (x, y, s) => {
      el(x + 1, y + 1, 3.6 * s, 1.6 * s, 'rgba(6,26,48,0.25)');
      rc(x - 1 * s, y - 8 * s, 2 * s, 8 * s, '#3f8f4f');
      rc(x - 3.4 * s, y - 6 * s, 2.4 * s, 1.6 * s, '#3f8f4f'); rc(x - 3.4 * s, y - 8 * s, 1.4 * s, 3 * s, '#3f8f4f');
      rc(x + 1.6 * s, y - 5 * s, 2.4 * s, 1.6 * s, '#3f8f4f'); rc(x + 3 * s, y - 7.4 * s, 1.4 * s, 3.4 * s, '#3f8f4f');
    };
    const chimeneas = [];
    const casaP = (x, y, s, roof) => {
      rc(x - 6.6 * s, y + 1.8 * s, 14 * s, 2.6 * s, 'rgba(6,26,48,0.28)');
      rc(x - 5.6 * s, y - 5.6 * s, 11.2 * s, 7 * s, rgb2(T.wall));
      rc(x - 5.6 * s, y - 5.6 * s, 11.2 * s, 1.1 * s, 'rgba(255,255,255,0.2)'); // luz del norte en la fachada
      rc(x + 3.4 * s, y - 4.6 * s, 2.2 * s, 6 * s, 'rgba(0,0,0,0.1)'); // sombra del este
      g.strokeStyle = 'rgba(30,22,12,0.5)'; g.lineWidth = 0.5; g.strokeRect(x - 5.6 * s, y - 5.6 * s, 11.2 * s, 7 * s);
      rc(x - 7.4 * s, y - 9 * s, 14.8 * s, 3.6 * s, rgb2(roof));
      rc(x - 7.4 * s, y - 9 * s, 14.8 * s, 1.1 * s, 'rgba(255,255,255,0.25)'); // cumbrera iluminada
      rc(x - 7.4 * s, y - 5.8 * s, 14.8 * s, 0.7 * s, 'rgba(0,0,0,0.18)'); // alero en sombra
      rc(x - 1.7 * s, y - 2.4 * s, 3.4 * s, 4.6 * s, 'rgba(60,42,26,0.85)'); // puerta
      // ventanas: de día vidrio neutro; de noche se encienden — halo cálido,
      // la del fondo del mar también, y un charco de luz en el suelo
      if (noche) {
        rc(x - 5.1 * s, y - 4.4 * s, 3.2 * s, 3.2 * s, 'rgba(255,214,120,0.26)');
        rc(x - 4.6 * s, y - 3.9 * s, 2.2 * s, 2.2 * s, 'rgba(255,226,140,0.98)');
        rc(x + 2.4 * s, y - 3.9 * s, 2.2 * s, 2.2 * s, 'rgba(255,214,120,0.9)');
        el(x - 3.2 * s, y + 2.8 * s, 7.4 * s, 2.6 * s, 'rgba(255,214,120,0.13)');
        g.strokeStyle = 'rgba(30,22,12,0.35)'; g.lineWidth = 0.4;
        g.strokeRect(x - 4.6 * s, y - 3.9 * s, 2.2 * s, 2.2 * s);
        g.strokeRect(x + 2.4 * s, y - 3.9 * s, 2.2 * s, 2.2 * s);
      } else {
        rc(x - 4.6 * s, y - 3.9 * s, 2.2 * s, 2.2 * s, 'rgba(196,218,230,0.72)');
        rc(x + 2.4 * s, y - 3.9 * s, 2.2 * s, 2.2 * s, 'rgba(120,150,180,0.6)');
        g.strokeStyle = 'rgba(30,22,12,0.55)'; g.lineWidth = 0.4;
        g.strokeRect(x - 4.6 * s, y - 3.9 * s, 2.2 * s, 2.2 * s);
        g.strokeRect(x + 2.4 * s, y - 3.9 * s, 2.2 * s, 2.2 * s);
      }
      g.strokeRect(x + 2.4 * s, y - 3.9 * s, 2.2 * s, 2.2 * s);
      if (rIsla(i, 700 + Math.round(x * 7 + y * 13)) > 0.62) { // alguna casa echa humo
        rc(x + 4 * s, y - 11.6 * s, 2.2 * s, 3.4 * s, '#8a6d5a');
        rc(x + 4.4 * s, y - 12.2 * s, 1.4 * s, 0.8 * s, 'rgba(255,255,255,0.2)');
      }
    };
    // ── relieve: montañas con cara en luz y en sombra (por tema) ──
    const tri = (x0, y0, w0, h0, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x0 - w0, y0); g.lineTo(x0, y0 - h0); g.lineTo(x0 + w0, y0); g.closePath(); g.fill(); };
    const nieveTema = tema === 'nieve' || tema === 'blanco';
    const nMont = { rocosa: 2, japon: 1, oscuro: 1, nieve: 1, blanco: 1, bosque: 1, burbujas: 0 }[tema] ?? (rIsla(i, 5) > 0.6 ? 1 : 0);
    for (let q = 0; q < nMont; q++) {
      const mx = (rIsla(i, 70 + q) - 0.5) * r * 0.9, my = (rIsla(i, 80 + q) - 0.3) * r * 0.5;
      const mw = r * (0.5 + rIsla(i, 90 + q) * 0.3), mh = mw * (0.72 + rIsla(i, 95 + q) * 0.4);
      el(mx + mw * 0.15, my + 1.6, mw * 0.85, mw * 0.2, 'rgba(6,26,48,0.18)'); // asiento en el terreno
      tri(mx, my, mw, mh, '#5d6a76');
      tri(mx + mw * 0.42, my, mw * 0.58, mh * 0.86, 'rgba(255,255,255,0.14)');
      if (nieveTema) tri(mx, my - mh * 0.78, mw * 0.3, mh * 0.3, 'rgba(240,248,255,0.92)');
    }
    if (tema === 'desierto') {
      el(-r * 0.4, r * 0.28, r * 0.5, r * 0.14, '#e8c98a');
      el(r * 0.3, r * 0.42, r * 0.44, r * 0.12, '#dfbe7e');
    }

    // ── aldea temática: el LAYOUT compartido — las mismas casas a todo zoom ──
    const lay = layoutIsla(i);
    // caminos de tierra: del muelle a la plaza y de la plaza a cada casa
    clipLand();
    const camino = (x0, y0, x1, y1, w) => {
      g.strokeStyle = 'rgba(146,112,66,0.55)'; g.lineWidth = w; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, y0);
      g.quadraticCurveTo((x0 + x1) / 2 + (y1 - y0) * 0.18, (y0 + y1) / 2 - (x1 - x0) * 0.18, x1, y1);
      g.stroke();
    };
    camino(0, r * 0.78, 0, r * 0.1, 2.6);
    for (const c of lay.casas) camino(0, r * 0.1, c.x, c.y, 1.7);
    g.restore();
    // plaza central: pozo de piedra donde todo converge
    el(0, r * 0.06 + 1, 3.6, 2.7, 'rgba(6,26,48,0.22)');
    el(0, r * 0.04, 3.2, 2.4, '#9aa8b4'); el(0, r * 0.04, 1.5, 1.1, '#5d6a76');
    for (const c of lay.casas) casaP(c.x, c.y, c.s, c.roof);
    if (i.base || tema === 'fortaleza') { // bastión de la Marina: muralla + torres + asta
      rc(-r * 0.62, r * 0.1, r * 1.24, r * 0.5, '#9aa8b4');
      rc(-r * 0.62, r * 0.1, r * 1.24, r * 0.1, 'rgba(255,255,255,0.25)');
      for (const tx of [-r * 0.62, 0, r * 0.5]) {
        rc(tx, r * 0.1 - r * 0.34, r * 0.16, r * 0.34, '#8794a1');
        for (let m = 0; m < 3; m++) rc(tx + m * r * 0.06, r * 0.1 - r * 0.4, r * 0.035, r * 0.07, '#8794a1');
      }
      rc(-r * 0.18, r * 0.1 - r * 0.62, r * 0.36, r * 0.62, '#7d8b98');
      rc(-r * 0.1, r * 0.1 - r * 0.5, r * 0.2, r * 0.2, 'rgba(20,30,44,0.55)');
      i._flag = [0, r * 0.1 - r * 0.62 - 6];
      rc(-0.7, r * 0.1 - r * 0.62 - 8, 1.4, 8, '#5b3f28');
    }
    if (i.tribunal && i.id !== 'enies') { rc(-r * 0.4, -r * 0.62, r * 0.8, r * 0.4, '#e8e2d2'); rc(-r * 0.44, -r * 0.68, r * 0.88, r * 0.1, '#d69e2e'); el(0, -r * 0.48, r * 0.12, r * 0.12, '#d69e2e'); }
    if (tema === 'prision') {
      rc(-r * 0.66, -r * 0.5, r * 1.32, r * 0.8, '#3a4658');
      for (let m = 0; m < 8; m++) rc(-r * 0.6 + m * r * 0.16, -r * 0.7, r * 0.05, r * 1.1, '#4a5568');
      rc(-r * 0.1, -r * 1.05, r * 0.2, r * 0.6, '#2e3a4c');
      i._flag = [r * 0.1, -r * 1.05 - 6];
      rc(r * 0.1 - 0.7, -r * 1.05 - 8, 1.4, 8, '#5b3f28');
    }
    if (i.restaurante || tema === 'mar') { // casco flotante estilo Baratie
      rc(-r * 0.62, r * 0.24, r * 1.24, r * 0.3, '#6b4a2f');
      casaP(0, r * 0.24, 1.5, '#c0392b');
      rc(0 - 0.8, r * 0.24 - r * 0.9, 1.6, r * 0.7, '#8a6d3b');
      i._flag = [0, r * 0.24 - r * 0.9];
    }
    if (tema === 'burbujas') { // manglares de Yarukiman: troncos gruesos + copa ancha
      for (const tx of [-r * 0.34, r * 0.1, r * 0.4]) {
        rc(tx - 1.6, -r * 0.2 - r * 0.5, 3.2, r * 0.6, '#7a5236');
        el(tx, -r * 0.2 - r * 0.62, r * 0.3, r * 0.16, rgb2(T.tree));
        el(tx - r * 0.14, -r * 0.2 - r * 0.7, r * 0.18, r * 0.1, 'rgba(255,255,255,0.16)');
      }
    }
    if (tema === 'japon') { // meseta con muralla y gran portal
      rc(-r * 0.5, -r * 0.1, r, r * 0.14, '#7a5236');
      rc(-r * 0.42, -r * 0.24, r * 0.84, r * 0.14, '#8a6142');
      rc(-r * 0.3, -r * 0.66, 2.4, r * 0.42, '#b03a3a'); rc(r * 0.3 - 2.4, -r * 0.66, 2.4, r * 0.42, '#b03a3a');
      rc(-r * 0.42, -r * 0.66, r * 0.84, 2, '#b03a3a');
      rc(-r * 0.34, -r * 0.76, r * 0.68, 1.6, '#2b6cb0');
    }
    if (tema === 'dulce') {
      rc(-r * 0.34, -r * 0.3, r * 0.68, r * 0.16, '#f2a7c3');
      rc(-r * 0.26, -r * 0.5, r * 0.52, r * 0.16, '#f7c6d9');
      rc(-r * 0.16, -r * 0.68, r * 0.32, r * 0.16, '#fddfe9');
      for (const dx of [-r * 0.3, 0, r * 0.3]) el(dx, -r * 0.3 + 1, 2.4, 1.6, '#fff0f5');
    }
    if (tema === 'nubes') { // base de nubes bajo la isla (Isla del Cielo)
      el(-r * 0.3, r * 0.72, r * 0.42, r * 0.16, 'rgba(255,255,255,0.85)');
      el(r * 0.26, r * 0.82, r * 0.34, r * 0.13, 'rgba(255,255,255,0.7)');
    }
    if (tema === 'oscuro' && i.fantasma) { // navío fantasma varado
      rc(-r * 0.5, r * 0.3, r, r * 0.22, '#2c3440');
      rc(-r * 0.3, -r * 0.4, 1.6, r * 0.66, '#3c4654');
      rc(-r * 0.14, -r * 0.34, r * 0.34, r * 0.2, 'rgba(190,210,235,0.4)');
    }
    if (i.natal) { // Villa Foosha: el molino de viento
      rc(-3, -r * 0.52, 6, r * 0.34, '#e6dec4');
      rc(-4, -r * 0.6, 8, 3.6, '#c0533d');
      g.save(); g.translate(0, -r * 0.5);
      for (let q = 0; q < 4; q++) { g.rotate(Math.PI / 2); rc(1.2, -1.2, r * 0.42, 2.2, '#f0e6d2'); }
      g.restore();
    }
    if (i.entrada) { // Monte Contracorriente: la montaña invertida con cascada ascendente
      tri(0, r * 0.4, r * 1.1, r * 1.5, '#5d6a76');
      tri(r * 0.4, r * 0.4, r * 0.7, r * 1.3, 'rgba(255,255,255,0.14)');
      rc(-2.2, -r * 1.1, 4.4, r * 1.3, 'rgba(150,205,238,0.75)');
      for (let q = 0; q < 5; q++) el(-1.6 + q, -r * 1.1 - q * 4, 1.6, 1, 'rgba(200,230,250,0.6)');
    }
    // ── LANDMARKS CANÓNICOS: cada isla icónica con su hito propio de One Piece ──
    // (misma mano que el resto del arte: bloques planos, luz del norte, sombra del este)
    if (i.id === 'arabasta') { // el palacio de Alubarna: cúpula dorada sobre el desierto
      el(0, r * 0.3 + 2, r * 0.4, r * 0.12, 'rgba(6,26,48,0.22)');
      rc(-r * 0.34, -r * 0.16, r * 0.68, r * 0.42, '#e8d9b8');
      rc(-r * 0.34, -r * 0.16, r * 0.68, r * 0.09, 'rgba(255,255,255,0.22)');
      rc(-r * 0.34, r * 0.18, r * 0.68, r * 0.09, 'rgba(0,0,0,0.12)');
      for (const tx of [-r * 0.34, r * 0.16]) { rc(tx, -r * 0.5, r * 0.18, r * 0.38, '#dccdaa'); el(tx + r * 0.09, -r * 0.5, r * 0.09, r * 0.09, '#c9a227'); }
      rc(-r * 0.12, -r * 0.66, r * 0.24, r * 0.5, '#e8d9b8');
      g.fillStyle = '#d4af37'; g.beginPath(); g.arc(0, -r * 0.66, r * 0.16, Math.PI, 0); g.closePath(); g.fill();
      el(-r * 0.05, -r * 0.72, r * 0.06, r * 0.05, 'rgba(255,246,214,0.55)');
      el(0, r * 0.3, r * 0.06, r * 0.05, '#4a90c2'); // el oasis bajo el palacio
      palmeraP(-r * 0.42, r * 0.34, 1); palmeraP(r * 0.44, r * 0.3, 1);
    }
    if (i.id === 'drum') { // castillo Drum: la fortaleza en la cima de la montaña nevada
      tri(0, r * 0.62, r * 1.05, r * 1.15, '#7f8ea0');
      tri(r * 0.4, r * 0.62, r * 0.62, r * 0.98, 'rgba(255,255,255,0.16)');
      tri(0, r * 0.62 - r * 0.86, r * 0.3, r * 0.32, 'rgba(240,248,255,0.92)');
      const dy = r * 0.62 - r * 0.9;
      el(0, dy + 2, r * 0.16, r * 0.06, 'rgba(6,26,48,0.25)');
      rc(-r * 0.11, dy - r * 0.22, r * 0.22, r * 0.24, '#e8e4d4');
      for (const tx of [-r * 0.13, r * 0.04]) { rc(tx, dy - r * 0.34, r * 0.09, r * 0.36, '#e8e4d4'); tri(tx + r * 0.045, dy - r * 0.34, r * 0.07, r * 0.12, '#4a6fa5'); }
      tri(0, dy - r * 0.34, r * 0.12, r * 0.14, '#4a6fa5');
      rc(0, dy - r * 0.58, 1.2, r * 0.14, '#5b3f28'); el(0.6, dy - r * 0.6, 2.2, 1.6, '#e8a0c0'); // la bandera del cerezo rosa
    }
    if (i.id === 'skypiea') { // el arca con la campana dorada de Shandora
      rc(-r * 0.44, -r * 0.06, r * 0.88, r * 0.12, '#d8cfa8');
      rc(-r * 0.36, -r * 0.12, r * 0.72, r * 0.07, '#c9bd92');
      for (const tx of [-r * 0.32, r * 0.2]) rc(tx, -r * 0.4, 2, r * 0.34, '#b8a878');
      rc(-r * 0.4, -r * 0.44, r * 0.8, r * 0.08, '#d8cfa8');
      rc(0 - 0.8, -r * 0.36, 1.6, r * 0.22, '#8a6d3b');
      const cy2 = -r * 0.14 + r * 0.22;
      g.fillStyle = '#d4af37'; g.beginPath(); g.arc(0, cy2, r * 0.13, Math.PI, 0); g.closePath(); g.fill();
      rc(-r * 0.13, cy2, r * 0.26, r * 0.12, '#d4af37');
      el(-r * 0.04, cy2 + r * 0.1, r * 0.05, r * 0.04, 'rgba(255,246,214,0.6)');
      el(0, cy2 + r * 0.16, 2, 1.6, '#8a6d3b');
      el(-r * 0.34, r * 0.66, r * 0.3, r * 0.1, 'rgba(255,255,255,0.8)'); el(r * 0.3, r * 0.74, r * 0.22, r * 0.09, 'rgba(255,255,255,0.6)');
    }
    if (i.id === 'enies') { // la Torre de la Justicia sobre la corriente del vacío
      el(0, r * 0.36, r * 0.5, r * 0.16, '#cfc4a0');
      rc(-r * 0.42, r * 0.22, r * 0.84, r * 0.18, '#e8e2d2');
      rc(-r * 0.24, -r * 0.42, r * 0.48, r * 0.68, '#f2eee2');
      rc(-r * 0.24, -r * 0.42, r * 0.48, r * 0.1, 'rgba(255,255,255,0.3)');
      for (let m = 0; m < 3; m++) rc(-r * 0.16 + m * r * 0.16, -r * 0.24, r * 0.08, r * 0.12, 'rgba(120,150,180,0.7)');
      tri(-r * 0.3, -r * 0.42, r * 0.3, r * 0.14, '#d9d2bc'); tri(r * 0.3, -r * 0.42, r * 0.3, r * 0.14, '#d9d2bc');
      tri(0, -r * 0.42, r * 0.3, r * 0.2, '#c9a227');
      rc(0 - 0.7, -r * 0.62 - 8, 1.4, 8, '#5b3f28'); i._flag = [0, -r * 0.62 - 6];
      rc(-r * 0.6, r * 0.4, r * 0.24, r * 0.34, 'rgba(150,205,238,0.6)'); // la cascada que cae al vacío
      for (let q = 0; q < 3; q++) el(-r * 0.48 + q * 2, r * 0.76 + q * 2, 3, 1.2, 'rgba(150,205,238,0.4)');
    }
    if (i.id === 'zou') { // ¡el gigante elefante Zunesha! la isla es su espalda
      const ey = r * 0.62;
      g.strokeStyle = '#6f7d8c'; g.lineWidth = r * 0.1; g.lineCap = 'round';
      g.beginPath(); g.moveTo(r * 0.72, ey - r * 0.3); g.quadraticCurveTo(r * 1.05, ey - r * 0.1, r * 1.0, ey + r * 0.5); g.stroke();
      g.strokeStyle = '#5d6a78'; g.lineWidth = r * 0.055;
      g.beginPath(); g.moveTo(r * 0.78, ey - r * 0.24); g.quadraticCurveTo(r * 1.02, ey - r * 0.05, r * 0.98, ey + r * 0.44); g.stroke();
      el(r * 0.62, ey - r * 0.38, r * 0.34, r * 0.3, '#7f8ea0');
      el(r * 0.44, ey - r * 0.44, r * 0.16, r * 0.24, '#5d6a78');
      el(r * 0.72, ey - r * 0.42, r * 0.05, r * 0.05, '#f2eee2'); el(r * 0.72, ey - r * 0.42, r * 0.022, r * 0.022, '#1a202c');
      el(r * 0.62, ey - r * 0.34, r * 0.1, r * 0.05, 'rgba(255,255,255,0.15)');
      for (const lx of [-r * 0.52, -r * 0.2, r * 0.18]) { rc(lx, ey + r * 0.2, r * 0.14, r * 0.5, '#6f7d8c'); rc(lx + 1, ey + r * 0.2, r * 0.05, r * 0.5, 'rgba(255,255,255,0.12)'); }
    }
    if (i.id === 'dressrosa') { // el Coliseo Corrida: anillo de piedra con arcos
      el(0, -r * 0.12, r * 0.44, r * 0.3, '#c8b48a');
      el(0, -r * 0.14, r * 0.34, r * 0.21, '#e0cba0');
      el(0, -r * 0.16, r * 0.22, r * 0.12, '#d69e5e');
      g.strokeStyle = '#a8906a'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, -r * 0.12, r * 0.44, r * 0.3, 0, 0, 7); g.stroke();
      for (let m = 0; m < 8; m++) { const a = m / 8 * 6.2832; el(Math.cos(a) * r * 0.39, -r * 0.12 + Math.sin(a) * r * 0.26, r * 0.045, r * 0.03, 'rgba(60,48,34,0.6)'); }
      for (const fx of [-r * 0.5, r * 0.5]) { rc(fx, -r * 0.34, 1.2, r * 0.14, '#5b3f28'); el(fx + 0.6, -r * 0.36, 2, 1.5, '#d33'); }
    }
    if (i.id === 'logue') { // la plataforma de ejecución: donde todo empezó
      el(0, r * 0.28 + 2, r * 0.3, r * 0.1, 'rgba(6,26,48,0.2)');
      rc(-r * 0.22, r * 0.06, r * 0.44, r * 0.16, '#d9c9a8');
      rc(-r * 0.16, r * 0.22, r * 0.32, r * 0.08, '#c9b894');
      rc(-r * 0.14, -r * 0.34, 2, r * 0.4, '#8a7a5c'); rc(r * 0.14 - 2, -r * 0.34, 2, r * 0.4, '#8a7a5c');
      rc(-r * 0.16, -r * 0.36, r * 0.32, 2.2, '#8a7a5c');
      i._flag = [0, -r * 0.36]; rc(-0.7, -r * 0.36 - 7, 1.4, 7, '#5b3f28');
    }
    if (i.id === 'ohara') { // el Árbol del Conocimiento: la biblioteca vive en la copa
      el(r * 0.3, r * 0.3 + 1, r * 0.2, r * 0.07, 'rgba(6,26,48,0.18)');
      rc(r * 0.26, -r * 0.3, r * 0.09, r * 0.58, '#6b4a2f');
      el(r * 0.3, -r * 0.42, r * 0.3, r * 0.24, '#3e7c48');
      el(r * 0.3, -r * 0.5, r * 0.2, r * 0.16, '#4a9060');
      rc(r * 0.24, -r * 0.48, r * 0.14, r * 0.1, '#e8d9b8');
      rc(r * 0.26, -r * 0.46, r * 0.03, r * 0.03, '#4a6fa5'); rc(r * 0.3, -r * 0.46, r * 0.03, r * 0.03, '#4a6fa5'); rc(r * 0.34, -r * 0.46, r * 0.03, r * 0.03, '#4a6fa5');
      el(r * 0.3, -r * 0.42, r * 0.22, r * 0.12, 'rgba(255,255,255,0.12)');
    }
    if (i.id === 'lily') { // los arcos de la tribuna Kuja: serpientes de piedra
      for (const [ax, ay, w] of [[-r * 0.34, r * 0.3, r * 0.34], [r * 0.3, r * 0.16, r * 0.3]]) {
        g.strokeStyle = '#5e7d5a'; g.lineWidth = r * 0.07;
        g.beginPath(); g.arc(ax, ay, w, Math.PI * 0.9, Math.PI * 1.9); g.stroke();
        el(ax + w * 0.9, ay - w * 0.5, r * 0.05, r * 0.04, '#3e5e42');
      }
      el(0, r * 0.1, r * 0.16, r * 0.1, '#8a7a9e');
      tri(0, r * 0.1, r * 0.14, r * 0.14, '#6e5e84');
    }
    if (i.id === 'littlegarden') { // los dinosaurios prehistóricos siguen vivos aquí
      el(-r * 0.3, r * 0.3 + 1, r * 0.3, r * 0.05, 'rgba(6,26,48,0.15)');
      el(-r * 0.3, r * 0.3, r * 0.26, r * 0.12, '#5a6e4a');
      g.strokeStyle = '#5a6e4a'; g.lineWidth = r * 0.06; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-r * 0.12, r * 0.28); g.quadraticCurveTo(0, -r * 0.05, r * 0.14, -r * 0.02); g.stroke();
      el(r * 0.17, -r * 0.04, r * 0.05, r * 0.04, '#5a6e4a');
      el(r * 0.34, r * 0.36, r * 0.16, r * 0.1, '#7a5e46');
      el(r * 0.44, r * 0.3, r * 0.09, r * 0.08, '#7a5e46');
      tri(r * 0.5, r * 0.3, r * 0.07, r * 0.05, '#7a5e46');
      el(r * 0.47, r * 0.27, 0.8, 0.8, '#f2eee2'); el(r * 0.47, r * 0.27, 0.35, 0.35, '#1a202c');
      tri(-r * 0.5, r * 0.1, r * 0.24, r * 0.3, '#6e5a48');
      el(-r * 0.5, r * 0.1 - r * 0.3 + 1, r * 0.06, r * 0.03, '#d65a3a');
      el(-r * 0.5, r * 0.1 - r * 0.44, r * 0.1, r * 0.04, 'rgba(200,190,180,0.4)');
    }
    // árboles por tema en el anillo — el LAYOUT compartido (los mismos a todo zoom)
    for (const a2 of lay.arboles) {
      const px = a2.x, py = a2.y, s = a2.s;
      if (T.palms || tema === 'jungla') palmeraP(px, py, tema === 'jungla' ? s * 1.3 : s);
      else if (tema === 'desierto') cactusP(px, py, s);
      else if (tema === 'oscuro') { rc(px - 0.7, py - 5 * s, 1.4, 5 * s, '#3c3440'); rc(px - 3 * s, py - 7 * s, 2.6 * s, 1.2, '#3c3440'); rc(px + 0.6, py - 9 * s, 1.2, 2.8 * s, '#3c3440'); }
      else pinoP(px, py, s, nieveTema);
    }
    // adornos de interior: arbustos, matas de hierba, rocas y flores
    for (const ad of lay.adornos) {
      const px = ad.x, py = ad.y;
      if (ad.t < 0.38) { el(px, py + 0.8, 2.6, 1.7, 'rgba(' + T.land2.join(',') + ',0.95)'); el(px - 0.8, py - 0.4, 1.6, 1.2, 'rgba(255,255,255,0.14)'); }
      else if (ad.t < 0.62) {
        g.strokeStyle = rgb2(T.tree); g.lineWidth = 0.8; g.lineCap = 'round';
        for (const dx of [-1, 0, 1]) { g.beginPath(); g.moveTo(px + dx * 1.1, py + 1); g.lineTo(px + dx * 1.6, py - 2.4); g.stroke(); }
      }
      else if (ad.t < 0.82) { el(px, py, 2.2, 1.7, '#8a95a1'); el(px - 0.7, py - 0.7, 1.1, 0.8, 'rgba(255,255,255,0.22)'); }
      else { el(px, py, 0.9, 0.9, tema === 'dulce' ? '#fff0f5' : '#e8a0c0'); el(px + 1.8, py + 0.6, 0.7, 0.7, '#f6e05e'); }
    }
    if (tema === 'industrial') { // fábrica + chimeneas (humo vivo encima)
      rc(-r * 0.4, r * 0.06, r * 0.56, r * 0.3, '#9aa5b1');
      rc(-r * 0.24, r * 0.06 - r * 0.22, r * 0.1, r * 0.22, '#7d8794');
      rc(r * 0.04, r * 0.06 - r * 0.3, r * 0.1, r * 0.3, '#7d8794');
      chimeneas.push([r * 0.09, r * 0.06 - r * 0.3]);
      chimeneas.push([-r * 0.19, r * 0.06 - r * 0.22]);
    }
    // ── muelle con bote y farol ──
    if (r >= 22 && tema !== 'nubes') {
      const my = r * 0.82;
      rc(-3.6, my, 7.2, r * 0.5, '#8a5a33');
      for (let q = 1; q < 5; q++) rc(-3.6, my + q * r * 0.5 / 5, 7.2, 0.7, 'rgba(0,0,0,0.2)');
      rc(r * 0.26, my + r * 0.5 + 1, 12, 5, '#614536');
      rc(r * 0.26 + 4, my + r * 0.5 - 4, 1.6, 5, '#e6dec4');
      rc(-r * 0.62, my - 6, 2.4, 6, '#e8e2d2'); rc(-r * 0.62 + 0.4, my - 8.4, 1.6, 2.6, '#d33');
    }
    i._chimeneas = chimeneas;
    // LRU generoso: al alejar el zoom la vista entra >40 islas y una cache chica
    // re-cocinaba sprites completos cada frame (medido: islas 133ms/frame).
    // 48 por caché (día y noche viven juntas) cubre la peor vista con margen.
    if (cacheSprites.size > 48) cacheSprites.delete(cacheSprites.keys().next().value);
    const entry = { c, R };
    cacheSprites.set(clave, entry);
    return entry;
  }

  // ── el mismo arte, en MINIATURA: a lo lejos se dibuja esta copia reducida
  //    (suavizada) para que el mapa general se vea denso y estable, sin vibrar.
  //    De cerca el sprite grande toma el relevo: ES el mismo arte, solo más cerca. ──
  const cacheLejos = new Map();
  function spriteLejos(i) {
    const hit = cacheLejos.get(i.id);
    if (hit) { cacheLejos.delete(i.id); cacheLejos.set(i.id, hit); return hit; }
    const big = spriteDetalle(i);
    const F = 2; // píxeles del mini-sprite por unidad de mundo
    const c = document.createElement('canvas');
    c.width = c.height = Math.max(4, Math.round(big.R * 2 * F));
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(big.c, 0, 0, c.width, c.height);
    const entry = { c, R: big.R };
    if (cacheLejos.size > 64) cacheLejos.delete(cacheLejos.keys().next().value);
    cacheLejos.set(i.id, entry);
    return entry;
  }

  // ── la isla detallada EN el mapa: sprite + espuma viva + bandera de facción ──
  function pintaIslaDetalle(i, ox, t) {
    const lejos = cam.z < 0.85; // vista general: el mismo arte en miniatura suavizada
    const sp = lejos ? spriteLejos(i) : spriteDetalle(i);
    const cx = i.x + ox, cy = i.y, r = i.r;
    ctx.save();
    // pixel art en todo zoom: píxel nítido de cerca y de lejos
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sp.c, cx - sp.R, cy - sp.R, sp.R * 2, sp.R * 2);
    ctx.restore();
    if (!lejos) { // espuma y crestas solo de cerca: de lejos la costa horneada basta
    // espuma que respira alrededor de la costa
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.4;
    const pulso = 1.05 + Math.sin(t / 1100 + i.x * 0.3) * 0.02;
    const pts = suaviza(formaIsla(i), 2);
    ctx.beginPath();
    pts.forEach(([dx, dy], k) => {
      const X = cx + dx * pulso, Y = cy + dy * pulso;
      if (k) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
    });
    ctx.closePath(); ctx.stroke();
    // crestas de ola alrededor (deterministas, derivan con el tiempo): solo al acercar
    if (cam.z >= 0.85) {
      ctx.lineWidth = 1;
      for (let q = 0; q < 5; q++) {
        const a = rIsla(i, 300 + q) * 6.2832;
        const rr = r * (1.32 + rIsla(i, 330 + q) * 0.4);
        const wx = cx + Math.cos(a) * rr, wy = cy + Math.sin(a) * rr * 0.8;
        const fase = Math.sin(t / 950 + q * 2.1 + i.x * 0.2) * 3;
        ctx.beginPath(); ctx.moveTo(wx - 4 + fase, wy); ctx.lineTo(wx + 3 + fase, wy); ctx.stroke();
      }
    }
    ctx.restore();
    }
    // humo vivo de chimeneas industriales (solo tiene sentido de cerca)
    if (i._chimeneas && cam.z >= 0.8) for (const [sx, sy] of i._chimeneas) {
      for (let q = 0; q < 3; q++) {
        const k = ((t / 1400 + q * 0.33) % 1);
        elVivo(cx + sx + Math.sin(t / 800 + q * 3) * 2.4, cy + sy - 4 - k * 14, (1.6 + k * 2.6), 'rgba(226,232,238,' + (0.4 * (1 - k)).toFixed(2) + ')');
      }
    }
    // bandera de facción: la tela ondea, el color lo manda el control del mundo
    if (i._flag && !lejos) {
      const [fx, fy] = i._flag;
      const fac = (MAPA._sim && MAPA._sim.control && MAPA._sim.control[i.id]) || '';
      const color = fac === 'ley' ? '#2b6cb0' : fac === 'tirano' ? '#7d3c98' : '#c9a13d'; // control real: ley/tirano/libre
      const onda = Math.sin(t / 300 + i.x) * 1.6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx + fx, cy + fy);
      ctx.lineTo(cx + fx + 11, cy + fy + 1.4 + onda * 0.4);
      ctx.lineTo(cx + fx + 11, cy + fy + 5.4 + onda * 0.4);
      ctx.lineTo(cx + fx, cy + fy + 4);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.5; ctx.stroke();
    }
  }
  function elVivo(x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }

  // ── el capitán en el mapa: figura pixel a zoom cercano, cubo a lo lejos ──
  function avatarMundo(sim, t) {
    const u = sim && sim.user;
    if (!u || !u.isl || sim._fusionAtSea || u.plan) return;
    const isl = D.ISLA[u.isl];
    if (!isl) return;
    // el capitán PISA la isla: camina hacia el punto tocado (tap-to-walk), no flota
    let caminando = false;
    if (MAPA._caminar) {
      const dx = MAPA._caminar.x - u.pos.x, dy = MAPA._caminar.y - u.pos.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.015) { const paso = Math.min(d, 0.006); u.pos.x += (dx / d) * paso; u.pos.y += (dy / d) * paso; caminando = true; }
      else MAPA._caminar = null;
    }
    const pasoX = caminando && Math.floor(t / 150) % 2 ? 1 : -1;
    const px = isl.x + u.pos.x * isl.r * 0.7, py = isl.y + u.pos.y * isl.r * 0.5 + bobIsla(isl, t);
    const bob = caminando ? Math.sin(t / 150) * 0.16 : 0; // en tierra NO flota: solo el vaivén del paso
    ctx.save();
    if (cam.z >= DETALLE_Z) {
      // sombra + mini capitán en la MISMA tinta del mundo: outline, luz del norte,
      // ojos y sonrisa — proporción de héroe (algo más alto que una casa, nunca gigante)
      const s = 1.15 * clamp(cam.z / 2.6, 1, 2.0);
      const O = 'rgba(30,22,12,0.55)';
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(px + 0.2 * s, py + 0.5 * s, 2.1 * s, 0.85 * s, 0, 0, 7);
      ctx.fillStyle = 'rgba(6,26,48,0.35)';
      ctx.fill();
      ctx.restore();
      // pantalón azul corto + botas con puntas: las piernas alternan al caminar
      ctx.fillStyle = '#3a5a8c'; ctx.fillRect(px - 1 * s + pasoX * 0.22 * s, py - 1.9 * s + bob, 0.95 * s, 1.15 * s); ctx.fillRect(px + 0.05 * s - pasoX * 0.22 * s, py - 1.9 * s + bob, 0.95 * s, 1.15 * s);
      ctx.fillStyle = '#4a3120'; ctx.fillRect(px - 1.1 * s + pasoX * 0.3 * s, py - 0.85 * s + bob, 1.05 * s, 0.85 * s); ctx.fillRect(px + 0.05 * s - pasoX * 0.3 * s, py - 0.85 * s + bob, 1.05 * s, 0.85 * s);
      ctx.strokeStyle = O; ctx.lineWidth = 0.35;
      ctx.strokeRect(px - 1.1 * s + pasoX * 0.3 * s, py - 0.85 * s + bob, 1.05 * s, 0.85 * s); ctx.strokeRect(px + 0.05 * s - pasoX * 0.3 * s, py - 0.85 * s + bob, 1.05 * s, 0.85 * s);
      // torso: camisa roja con luz del norte y dos botones
      ctx.fillStyle = '#c0392b'; ctx.fillRect(px - 1.1 * s, py - 3.7 * s + bob, 2.2 * s, 1.85 * s);
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(px - 1.1 * s, py - 3.7 * s + bob, 2.2 * s, 0.4 * s);
      ctx.strokeStyle = O; ctx.strokeRect(px - 1.1 * s, py - 3.7 * s + bob, 2.2 * s, 1.85 * s);
      ctx.fillStyle = 'rgba(30,22,12,0.5)'; ctx.fillRect(px - 0.2 * s, py - 3.35 * s + bob, 0.4 * s, 0.4 * s); ctx.fillRect(px - 0.2 * s, py - 2.55 * s + bob, 0.4 * s, 0.4 * s);
      // brazos con puños: la piel del capitán es de mar
      ctx.fillStyle = '#e8c8a0'; ctx.fillRect(px - 1.6 * s, py - 3.5 * s + bob, 0.5 * s, 1.55 * s); ctx.fillRect(px + 1.1 * s, py - 3.5 * s + bob, 0.5 * s, 1.55 * s);
      ctx.fillStyle = '#d4a97f'; ctx.fillRect(px - 1.6 * s, py - 2.05 * s + bob, 0.5 * s, 0.5 * s); ctx.fillRect(px + 1.1 * s, py - 2.05 * s + bob, 0.5 * s, 0.5 * s);
      // cara: piel, ojos y la sonrisa del que ya eligió su mar
      ctx.fillStyle = '#e8c8a0'; ctx.fillRect(px - 0.85 * s, py - 5 * s + bob, 1.7 * s, 1.35 * s);
      ctx.fillStyle = '#2b1c10'; ctx.fillRect(px - 0.55 * s, py - 4.6 * s + bob, 0.35 * s, 0.45 * s); ctx.fillRect(px + 0.2 * s, py - 4.6 * s + bob, 0.35 * s, 0.45 * s);
      ctx.fillRect(px - 0.15 * s, py - 3.95 * s + bob, 0.3 * s, 0.16 * s);
      // sombrero de paja: ala ancha, copa, cinta roja y brillo del ala
      ctx.fillStyle = '#e6c356'; ctx.fillRect(px - 1.55 * s, py - 5.7 * s + bob, 3.1 * s, 0.75 * s);
      ctx.fillStyle = '#b03a3a'; ctx.fillRect(px - 1.55 * s, py - 5.05 * s + bob, 3.1 * s, 0.4 * s);
      ctx.fillStyle = '#e6c356'; ctx.fillRect(px - 0.95 * s, py - 6.35 * s + bob, 1.9 * s, 0.65 * s);
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(px - 1.55 * s, py - 5.7 * s + bob, 3.1 * s, 0.22 * s);
      ctx.strokeStyle = O;
      ctx.strokeRect(px - 1.55 * s, py - 5.7 * s + bob, 3.1 * s, 1.1 * s); ctx.strokeRect(px - 0.95 * s, py - 6.35 * s + bob, 1.9 * s, 0.65 * s);
      ctx.strokeStyle = '#f6e05e'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.arc(px, py - 2.6 * s + bob, 3.6 * s + Math.sin(t / 300) * 0.5, 0, 7); ctx.stroke();
      // nombre flotante sobre el capitán: chip oscuro redondeado, texto legible a todo zoom
      const nombre = (u.name || 'Capitán');
      ctx.font = `600 ${(11 / cam.z).toFixed(1)}px Manrope, sans-serif`;
      const tw2 = ctx.measureText(nombre).width + 10 / cam.z, fh = 15 / cam.z;
      const bx = px - tw2 / 2, by = py - 7.6 * s - 20 / cam.z;
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, tw2, fh, 4 / cam.z); else ctx.rect(bx, by, tw2, fh);
      ctx.fillStyle = 'rgba(18,29,54,0.92)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(244,180,26,0.45)'; ctx.lineWidth = 0.8 / cam.z; ctx.stroke();
      ctx.fillStyle = '#f0f6fc';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(nombre, px, by + fh / 2);
      ctx.restore();
    } else {
      dibujaCubo(px, py);
      ctx.strokeStyle = '#f6e05e'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(px, py - 5, 12 + Math.sin(t / 300) * 2, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }
  MAPA.avatarMundo = avatarMundo;
  MAPA.edificiosIsla = edificiosIsla; // las casas del layout (la noche enciende sus ventanas)
  MAPA.layoutIsla = layoutIsla;       // el layout canónico compartido por todo el arte

  function sombraIsla(i, ox) {
    ctx.beginPath();
    ctx.ellipse(i.x + ox + 2, i.y + i.r * 0.5 + 8, i.r * 1.25, i.r * 0.7, 0, 0, 7);
    ctx.fillStyle = 'rgba(4,12,26,0.5)'; ctx.fill();
  }

  // ── flotación: cada isla sube y baja lento con su propia fase (el mar la mece) ──
  // La sombra del agua NO flota: la isla se mece sobre su sombra, como en UMP.
  function bobIsla(i, t) { return Math.sin(t / 2800 + i.x * 0.13) * 3 - 3; }
  MAPA.bobIsla = bobIsla;

  // ── pintaIslaConVida: flotación + resaltado al pasar el cursor ──
  // Un solo envoltorio para mapa base y GFX: bajo el cursor la isla crece un
  // 3.5% con suavizado y su bajío se enciende (luz de agua poco profunda).
  function pintaIslaConVida(i, off, t) {
    const hov = MAPA._hoverIsla === i;
    // escala de hover suavizada (lerp por frame: entra y sale sin salto)
    i._hs = (i._hs || 1) + ((hov ? 1.035 : 1) - (i._hs || 1)) * 0.12;
    const cx = i.x + off, cy = i.y, r = i.r;
    // halo de agua somera horneado: el gradiente se cocina UNA vez, cada frame es un blit
    if (!MAPA._haloSprite) {
      const H = 96, hc = document.createElement('canvas');
      hc.width = hc.height = H * 2;
      const hg = hc.getContext('2d');
      const grad = hg.createRadialGradient(H, H, H * 0.42, H, H, H);
      grad.addColorStop(0, 'rgba(150,220,255,0.55)');
      grad.addColorStop(0.55, 'rgba(150,220,255,0.22)');
      grad.addColorStop(1, 'rgba(150,220,255,0)');
      hg.fillStyle = grad; hg.fillRect(0, 0, H * 2, H * 2);
      MAPA._haloSprite = hc;
    }
    const HR = r * 1.8;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(MAPA._haloSprite, cx - HR, cy - HR, HR * 2, HR * 2);
    ctx.imageSmoothingEnabled = false;
    if (hov) {
      const pulso = 1 + Math.sin(t / 500) * 0.03;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.55 * pulso, r * 1.22 * pulso, 0, 0, 7);
      ctx.fillStyle = 'rgba(140,215,255,0.28)'; ctx.fill();
      ctx.strokeStyle = 'rgba(190,235,255,0.55)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(0, bobIsla(i, t));
    if (i._hs !== 1) {
      ctx.translate(cx, cy); ctx.scale(i._hs, i._hs); ctx.translate(-cx, -cy);
    }
    dibujaIsla(i, off, t);
    ctx.restore();
  }
  MAPA.pintaIslaConVida = pintaIslaConVida;

  // ── hover: isla bajo el cursor (resalta y pone el cursor de mano) ──
  const islaEn = (wx, wy) => {
    for (const i of D.ISLAS) {
      for (const off of [0, -D.W, D.W]) {
        if (dist(wx, wy, i.x + off, i.y) < Math.max(14, i.r + 10)) return i;
      }
    }
    return null;
  };
  MAPA.islaEn = islaEn;

  // Las VENTANAS que enciende la noche son las de las casas reales del LAYOUT:
  // la misma lista que pinta el sprite, casa por casa, con la altura de su ventana.
  function edificiosIsla(i) {
    return layoutIsla(i).casas;
  }

  // anillo blanco punteado girando en islas con evento activo;
  // al acercar se hace sutil: avisa sin tapar el arte de la isla
  function anilloIsla(i, ox, t) {
    if (!eventoIsl.has(i.id)) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0.32, 1 - (cam.z - 1.1) / 1.1);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]); ctx.lineDashOffset = -t / 80;
    ctx.beginPath(); ctx.arc(i.x + ox, i.y, i.r * 1.9, 0, 7); ctx.stroke();
    ctx.restore();
  }

  // en la vista general solo se rotulan islas del juego, bases y sedes: el resto, al acercar
  function rotulable(i) {
    return cam.z >= 0.95 || i.juego || i.base || i.tribunal || i.cuartel || i.natal;
  }

  // ── Modo inmersión: al acercar el zoom el HUD se retira (clase mil-cine en <body>)
  //    y queda SOLO la isla en pixel art, sin interferencia de nada. La píldora
  //    "Alejar" (o la lupa / la pinza) te devuelve. Histéresis: entra a 2.0, sale a 1.7. ──
  const CINE_ENTRA = 2.0, CINE_SALE = 1.7;
  let cineActivo = false;
  MAPA.enCine = () => cineActivo;
  function muestraNombreCine() {
    const el = MAPA._cineNombre;
    if (!el) return;
    const sm = MAPA._sim;
    // nombre honesto: la isla encuadrada, o la más cercana a la cámara (llegues como llegues)
    let isla = selIsl || MAPA._enfocada || null;
    if (!isla) {
      let mejorD = 1e18;
      for (const i of D.ISLAS) {
        if (i.oculta) continue;
        const dx = distX(i.x - cam.x), d = dx * dx + (i.y - cam.y) * (i.y - cam.y);
        if (d < mejorD) { mejorD = d; isla = i; }
      }
      if (isla && mejorD > 260 * 260) isla = null; // demasiado lejos: no hay isla protagonizando
    }
    if (!isla) isla = (sm && sm.user && D.ISLA[sm.user.isl]) || null;
    if (!isla) return;
    el.textContent = isla.n;
    el.classList.add('ver');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('ver'), 2800);
  }
  function actualizaCine() {
    const cine = cam.z >= (cineActivo ? CINE_SALE : CINE_ENTRA);
    if (cine === cineActivo) return;
    cineActivo = cine;
    document.body.classList.toggle('mil-cine', cine);
    if (cine) muestraNombreCine();
  }
  // GFX sustituye el render del mar: expone el easing de la lupa y el vigilante
  // del modo inmersión para que la capa mejorada los llame en cada frame
  MAPA.actualizaCinePublica = actualizaCine;
  MAPA.pasaZoomPublica = function (t) { pasaZoom(t); };
  MAPA.cancelaVueloPublica = function () { cancelaVuelo(); }; // el teclado panea sin pelear con un vuelo

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
    // UN SOLO ARTISTA a todo zoom: la MISMA isla pixel-art (sprite) de lejos a cerca.
    // El acercamiento no cambia de dibujo: el arte escala y gana nitidez —
    // así la entrada a la isla es un adentrarse real, sin salto ni cambio de artista.
    pintaIslaDetalle(i, ox, t);
    anilloIsla(i, ox, t);
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
  MAPA.dibujaIslaPublica = dibujaIsla;

  // tormenta: disco de mala fama + espiral de viento girando + destello eléctrico ocasional
  function pintaTormenta(s, t) {
    ctx.fillStyle = 'rgba(24,36,56,0.5)';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(t / 650);
    ctx.strokeStyle = 'rgba(190,210,255,0.5)';
    ctx.lineWidth = 2;
    for (const br of [0.38, 0.62, 0.85]) {
      ctx.beginPath();
      ctx.arc(0, 0, s.r * br, 0, 2.4);
      ctx.stroke();
    }
    if (Math.sin(t / 260 + s.x * 0.7) > 0.93) {
      ctx.strokeStyle = 'rgba(255,255,214,0.9)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-s.r * 0.28, -s.r * 0.42);
      ctx.lineTo(s.r * 0.08, -s.r * 0.05);
      ctx.lineTo(-s.r * 0.06, s.r * 0.05);
      ctx.lineTo(s.r * 0.24, s.r * 0.44);
      ctx.stroke();
    }
    ctx.restore();
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
      // anclado en el AGUA, fuera del bajío: nunca encima de la arena ni del muelle
      const lado = (s.id % 2) ? 1 : -1;
      x = isl.x + lado * (isl.r * 1.45 + 14) + Math.sin(t / 800 + s.id) * 3;
      y = isl.y + isl.r * 0.55 + 14;
      ang = lado > 0 ? 0 : Math.PI;
    }
    s._px = x; s._py = y;
    y += Math.sin(t / 700 + s.id * 1.7) * 0.9; // balanceo: ningún barco quieto en el agua
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
  }

  // ruido determinista (semilla fija) para texturas de la capa base
  function ruido(k) { const v = Math.sin(k * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }

  // ── Capa base: océano texturizado, Franjas de Calma, Gran Ruta y Muralla Roja como continente ──
  function crearBase() {
    MAPA._nCrea=(MAPA._nCrea||0)+1;
    const esc = D.W > 2000 ? 1.4 : 2;
    const cb = document.createElement('canvas');
    cb.width = Math.round(D.W * esc); cb.height = Math.round(D.H * esc);
    const c = cb.getContext('2d');
    c.scale(esc, esc);
    // océano profundo sólido + olas como trazos dispersos (el idioma del mar de la referencia)
    c.fillStyle = '#154584'; c.fillRect(0, 0, D.W, D.H);
    c.strokeStyle = 'rgba(255,255,255,0.13)'; c.lineWidth = 1.5;
    c.fillStyle = 'rgba(255,255,255,0.12)';
    for (let y = 24; y < D.H; y += 40) {
      const dent = 1 + (Math.floor(y / 40) % 2); // filas alternadas: densidad variable
      for (let x = 18; x < D.W; x += 74 * dent) {
        const n = ruido(x * 0.013 + y * 0.031), n2 = ruido(x * 0.007 + y * 0.017);
        if (n < 0.22) continue; // huecos: el mar respira
        const len = 5 + n2 * 11, yy = y + (ruido(x * 0.05 + y) - 0.5) * 12;
        const xx = x + n2 * 26;
        c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx + len, yy + (ruido(xx + y) - 0.5) * 2); c.stroke();
        if (n > 0.93) { c.beginPath(); c.arc(xx + len + 5, yy - 4, 1.1, 0, 7); c.fill(); } // chispa de sol
      }
    }
    // ── Franjas de Calma: banda gris-verde pálida con borde punteado ──
    for (const [a, b] of [[D.CB_T, D.GL_Y0], [D.GL_Y1, D.CB_B]]) {
      c.fillStyle = 'rgba(74,124,126,0.5)';
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
    // ── rótulos: sellos de los océanos — LOS MISMOS del globo (canon One Piece) ──
    c.textAlign = 'center';
    c.font = '600 34px system-ui, sans-serif'; c.fillStyle = 'rgba(220,240,255,0.34)';
    c.fillText('N O R T H  B L U E', 650, 250);
    c.fillText('E A S T  B L U E', 1950, 250);
    c.fillText('W E S T  B L U E', 650, 1190);
    c.fillText('S O U T H  B L U E', 1950, 1190);
    c.font = '700 26px Georgia, serif'; c.fillStyle = 'rgba(255,244,214,0.34)';
    c.fillText('N U E V O   M U N D O', 650, D.GL_Y0 + 105);
    c.fillText('P A R A Í S O', 1950, D.GL_Y0 + 105);
    c.font = '600 13px Georgia, serif'; c.fillStyle = 'rgba(238,246,242,0.55)';
    for (let x = 450; x < D.W; x += 900) {
      c.fillText('F R A N J A   D E   C A L M A', x, (D.CB_T + D.GL_Y0) / 2 + 4);
      c.fillText('F R A N J A   D E   C A L M A', x, (D.GL_Y1 + D.CB_B) / 2 + 4);
    }
    // ── Muralla Roja: cordillera rugosa de polo a polo — EL MISMO relieve que el globo ──
    const x0 = D.RL_X, paso = 12;
    const muroGrad = c.createLinearGradient(0, 0, 0, D.H);
    muroGrad.addColorStop(0, '#7f2d22'); muroGrad.addColorStop(0.5, '#a33b2b'); muroGrad.addColorStop(1, '#7f2d22');
    const bordeMuro = (dir) => {
      const pts = [];
      for (let y = -paso; y <= D.H + paso; y += paso) {
        const w = (26 + ruido(y * 0.07 + (dir > 0 ? 5 : 9)) * 30) * (1 + 0.22 * Math.sin((y / D.H) * 6));
        pts.push([x0 + dir * w + Math.sin((y / D.H) * 9 + 1.7) * 14 + (ruido(y * 0.11) - 0.5) * 16, y]);
      }
      return pts;
    };
    const izqM = bordeMuro(-1), derM = bordeMuro(1);
    c.beginPath();
    izqM.forEach(([X, y], k) => { if (k) c.lineTo(X, y); else c.moveTo(X, y); });
    derM.reverse().forEach(([X, y]) => c.lineTo(X, y));
    c.closePath();
    c.fillStyle = muroGrad; c.fill();
    // vetas rocosas y cumbres iluminadas: trazos curvos orgánicos (los mismos del globo)
    for (let q = 0; q < 110; q++) {
      const y = ruido(q * 3.3) * D.H;
      const X = x0 + (ruido(q * 7.7) - 0.5) * 70 + Math.sin((y / D.H) * 9 + 1.7) * 14;
      const an = 3 + ruido(q * 9.1) * 8;
      c.strokeStyle = q % 3 ? 'rgba(70,26,18,0.5)' : 'rgba(230,150,120,0.4)';
      c.lineWidth = 1.5 + ruido(q) * 1.8;
      c.beginPath();
      c.moveTo(X - an, y - 4 + ruido(q * 2) * 7);
      c.quadraticCurveTo(X + (ruido(q * 5.5) - 0.5) * 9, y + (ruido(q * 6.1) - 0.5) * 7, X + an * 0.8, y + 3 + ruido(q * 4.4) * 5);
      c.stroke();
    }
    // pliegues secundarios: dos crestas oscuras paralelas dan volumen de cordillera
    for (const desp of [-14, 11]) {
      c.strokeStyle = 'rgba(58,20,14,0.32)'; c.lineWidth = 2.6;
      c.beginPath();
      for (let y = 0; y <= D.H; y += 22) {
        const X = x0 + desp + Math.sin((y / D.H) * 9 + 1.7) * 12 + (ruido(y * 0.13 + desp) - 0.5) * 12;
        if (y) c.lineTo(X, y); else c.moveTo(X, y);
      }
      c.stroke();
    }
    // sombra de altura en el agua: la cordillera proyecta borde a sus costados
    const sombIzq = c.createLinearGradient(x0 - 115, 0, x0 - 45, 0);
    sombIzq.addColorStop(0, 'rgba(6,20,40,0)'); sombIzq.addColorStop(1, 'rgba(6,20,40,0.26)');
    c.fillStyle = sombIzq; c.fillRect(x0 - 115, 0, 70, D.H);
    const sombDer = c.createLinearGradient(x0 + 115, 0, x0 + 45, 0);
    sombDer.addColorStop(0, 'rgba(6,20,40,0)'); sombDer.addColorStop(1, 'rgba(6,20,40,0.26)');
    c.fillStyle = sombDer; c.fillRect(x0 + 45, 0, 70, D.H);
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
    // ── niebla cartográfica: el mundo se apaga en los bordes (lo que aún no navegaste) ──
    const niebla = (x0, y0, w, h, horiz, inv) => {
      const gr = horiz ? c.createLinearGradient(x0, 0, x0 + (inv ? -w : w), 0)
                       : c.createLinearGradient(0, y0, 0, y0 + (inv ? -h : h));
      gr.addColorStop(0, 'rgba(7,16,32,0.42)'); gr.addColorStop(1, 'rgba(7,16,32,0)');
      c.fillStyle = gr; c.fillRect(x0, y0, w, h);
    };
    niebla(0, 0, 190, D.H, true, false);
    niebla(D.W - 190, 0, 190, D.H, true, true);
    niebla(0, 0, D.W, 130, false, false);
    niebla(0, D.H - 130, D.W, 130, false, true);
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
    // océano: profundo en los polos, vivo y saturado en el ecuador
    g2.fillStyle = '#154584'; g2.fillRect(0, 0, tw, th);
    g2.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < th; y += Math.max(8, Math.round(30 * escY))) g2.fillRect(0, y, tw, 1);
    // Franjas de Calma: bandas claras al norte y al sur de la Gran Ruta
    const bandaCalma = (y0, y1) => {
      g2.fillStyle = 'rgba(74,124,126,0.5)';
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
    muroGrad.addColorStop(0, '#7f2d22'); muroGrad.addColorStop(0.5, '#a33b2b'); muroGrad.addColorStop(1, '#7f2d22');
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
    // vetas rocosas: trazos curvos oscuros y cumbres iluminadas (orgánicas, no rectas)
    for (let q = 0; q < 150; q++) {
      const y = ruido(q * 3.3) * th;
      const X = rx + (ruido(q * 7.7) - 0.5) * 90 + Math.sin((y / th) * 9 + 1.7) * 22;
      const an = 3 + ruido(q * 9.1) * 9;
      g2.strokeStyle = q % 3 ? 'rgba(70,26,18,0.5)' : 'rgba(230,150,120,0.4)';
      g2.lineWidth = 1.6 + ruido(q) * 2;
      g2.beginPath();
      g2.moveTo(X - an, y - 4 + ruido(q * 2) * 7);
      g2.quadraticCurveTo(X + (ruido(q * 5.5) - 0.5) * 10, y + (ruido(q * 6.1) - 0.5) * 8, X + an * 0.8, y + 3 + ruido(q * 4.4) * 6);
      g2.stroke();
    }
    // pliegues secundarios: dos crestas oscuras paralelas le dan volumen de cordillera
    for (const desp of [-16, 13]) {
      g2.strokeStyle = 'rgba(58,20,14,0.32)';
      g2.lineWidth = 3;
      g2.beginPath();
      for (let y = 0; y <= th; y += 26) {
        const X = rx + desp + Math.sin((y / th) * 9 + 1.7) * 20 + (ruido(y * 0.13 + desp) - 0.5) * 18;
        if (y) g2.lineTo(X, y); else g2.moveTo(X, y);
      }
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
      const rp = clamp(i.r * 0.56 * escX + 4.5, 7, 32);
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
      const blobStroke = (escF, color, lw) => {
        g2.strokeStyle = color; g2.lineWidth = lw;
        g2.beginPath();
        pts.forEach(([dx, dy], k) => {
          const X = px + dx * escF, Y = py + dy * escF;
          if (k) g2.lineTo(X, Y); else g2.moveTo(X, Y);
        });
        g2.closePath(); g2.stroke();
      };
      const envuelve = (px - rp < 0 || px + rp > tw) ? [0, -tw, tw] : [0];
      for (const off of envuelve) {
        g2.save(); g2.translate(off, 0);
        blob(1.18, 'rgba(236,218,152,0.92)'); // arena perimetral
        blobStroke(1.18, 'rgba(92,72,36,0.42)', 1.4); // contorno: definición pixel-art contra el mar
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

    // proyección mundo→esfera (compartida por nubes, barcos, avisos y etiquetas)
    const proyecta = (wx, wy) => {
      let lam = (wx / D.W) * 2 * Math.PI - rotLon - Math.PI; // MISMA convención que la textura y el clic (antes quedaba espejado 180°)
      lam = ((lam + Math.PI * 3) % (2 * Math.PI)) - Math.PI;
      if (Math.abs(lam) > 1.45) return null;
      const phi = (wy / D.H) * Math.PI - Math.PI / 2;
      const frente = Math.cos(lam) * Math.cos(phi);
      if (frente < 0.15) return null; // de perfil o al otro lado
      return { x: cx + Math.sin(lam) * Math.cos(phi) * R, y: cy + Math.sin(phi) * R, k: frente };
    };

    // nubes sobre la esfera: parches suaves que derivan y se comprimen hacia el limbo
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip();
    for (const nc of nubesGlobo) {
      nc.lx += nc.v; if (nc.lx >= D.W) nc.lx -= D.W;
      const p = proyecta(nc.lx, nc.fy * D.H);
      if (!p || p.k < 0.2) continue;
      const esc = 0.45 + 0.55 * p.k;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.10 + 0.12 * p.k).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, nc.r * esc, nc.r * esc * 0.36, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(p.x + nc.r * 0.5 * esc, p.y + nc.r * 0.14, nc.r * 0.55 * esc, nc.r * 0.28 * esc, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(p.x - nc.r * 0.45 * esc, p.y + nc.r * 0.1, nc.r * 0.42 * esc, nc.r * 0.24 * esc, 0, 0, 7); ctx.fill();
    }
    ctx.restore();

    // ── capa viva proyectada: islas con nombre, barcos y avisos del mundo ──
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

  MAPA.capaBase = function () { MAPA._nBase=(MAPA._nBase||0)+1; return base || (base = crearBase()); };
  MAPA.actualizaEventos = actualizaEventos;
  MAPA.sombraIsla = sombraIsla;
  MAPA.pintaTormenta = pintaTormenta;
  MAPA.edificiosIsla = edificiosIsla;
  MAPA.anilloIsla = anilloIsla;
  MAPA.cubo = dibujaCubo;
  MAPA.etiquetaIsla = function (i, ox) {
    if (!rotulable(i)) return;
    // UN SOLO MAPA: al acercar el zoom el nombre se desvanece — la isla habla por sí sola.
    // El nombre queda en el popover al tocar la isla y en el banner breve del modo inmersión.
    const alpha = clamp(1 - (cam.z - 1.32) / 0.3, 0, 1);
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    // chip de etiqueta: fondo azul noche, texto blanco 12px, radio 4px, bandera 🚩 (idioma de la referencia)
    ctx.font = '600 12px Manrope, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const rotulo = '\ud83d\udea9 ' + i.n;
    const wCh = ctx.measureText(rotulo).width + 16, hCh = 20;
    const bx = i.x + ox - wCh / 2, by = i.y + i.r + 9;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, wCh, hCh, 4); else ctx.rect(bx, by, wCh, hCh);
    ctx.fillStyle = '#0b1329'; ctx.fill();
    ctx.strokeStyle = 'rgba(244,180,26,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(rotulo, bx + wCh / 2, by + hCh / 2 + 0.5);
    if (selIsl === i) {
      ctx.strokeStyle = '#f6e05e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(i.x + ox, i.y, i.r + 7, 0, 7); ctx.stroke();
    }
    ctx.restore();
  };

  // ── Reyes del Mar: las serpientes que patrullan las Franjas de Calma ──
  //    Deterministas desde t (sin estado por frame): ondulan, avanzan despacio,
  //    se envuelven por el borde del mundo y solo viven en las aguas sin viento.
  let reyesMar = null;
  function initReyes() {
    reyesMar = [];
    for (const banda of [[D.CB_T, D.GL_Y0, 1], [D.GL_Y1, D.CB_B, -1]]) {
      for (let k = 0; k < 3; k++) {
        reyesMar.push({
          x: ruido(k * 7.3 + banda[0]) * D.W,
          y: banda[0] + (banda[1] - banda[0]) * (0.28 + ruido(k * 3.1 + banda[0] * 0.7) * 0.44),
          v: (9 + ruido(k * 9.7) * 10) * banda[2],
          f: 0.8 + ruido(k * 5.3) * 0.6,
          L: 78 + ruido(k * 11.3) * 54
        });
      }
    }
  }
  MAPA.pintaReyesMar = function (t) {
    if (!reyesMar) initReyes();
    const vx0 = cam.x - ancho / (2 * cam.z) - 160, vx1 = cam.x + ancho / (2 * cam.z) + 160;
    ctx.save();
    for (const r of reyesMar) {
      const x = ((r.x + (t / 1000) * r.v) % D.W + D.W) % D.W;
      if (x < vx0 || x > vx1) continue;
      const y = r.y + Math.sin(t / 2600 + r.x * 0.01) * 5;
      // cada tanto, un rey sube a respirar: arco del lomo, salpicadura y anillo de espuma
      if (!r._sup) r._sup = { prox: t + 16000 + (r.x * 7.9 % 44000), spl: 0 };
      let sum = 0, esc = 1, arco = 0;
      if (t >= r._sup.prox && t < r._sup.prox + 5200) {
        const f = (t - r._sup.prox) / 5200;
        arco = Math.sin(f * Math.PI);
        sum = arco * 26; esc = 1 + arco * 0.5;
        r._sup.spl = (f > 0.06 && f < 0.26) ? arco : 0;
      } else if (t >= r._sup.prox + 5200) {
        r._sup.prox = t + 34000 + (r.y * 5.3 % 46000);
        r._sup.spl = 0;
      }
      ctx.save();
      ctx.translate(x, y - sum); ctx.scale((r.v > 0 ? 1 : -1) * esc, esc);
      if (r._sup.spl) { // gotas y espuma en el instante de romper la superficie
        ctx.fillStyle = 'rgba(235,248,255,' + (0.55 * arco).toFixed(2) + ')';
        for (let p = 0; p < 7; p++) {
          const a = ruido(p * 3.1 + r.x) * Math.PI - Math.PI * 0.9, dd = 8 + ruido(p + Math.floor(t / 90)) * 20;
          ctx.beginPath(); ctx.arc(r.L * 0.45 + Math.cos(a) * dd * 1.7, Math.sin(a) * dd - 6, 1.5 + ruido(p * 2) * 1.7, 0, 7); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(235,248,255,' + (0.35 * arco).toFixed(2) + ')'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.ellipse(r.L * 0.45, 8, r.L * 0.6, 10 * arco + 3, 0, 0, 7); ctx.stroke();
      }
      const fase = (t / 900) * r.f;
      // estela suave que deja a flote
      ctx.strokeStyle = 'rgba(230,244,252,0.14)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r.L * 0.5 - 6, 6); ctx.lineTo(-r.L * 0.5 + 12, 6); ctx.stroke();
      // cuerpo serpenteante que se afina hacia la cola, con lomo iluminado
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let s = 0; s <= 12; s++) {
        const u = s / 12, px = r.L * 0.5 - u * r.L;
        const py = Math.sin(fase + u * 4.4) * (4 + u * 9);
        if (s) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.strokeStyle = 'rgba(13,33,58,0.46)'; ctx.lineWidth = 7.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(26,56,92,0.5)'; ctx.lineWidth = 3; ctx.stroke();
      // crestas dorsales siguiendo la onda
      ctx.fillStyle = 'rgba(13,33,58,0.5)';
      for (let s = 2; s <= 10; s += 2) {
        const u = s / 12, px = r.L * 0.5 - u * r.L;
        const py = Math.sin(fase + u * 4.4) * (4 + u * 9);
        const sgn = Math.cos(fase + u * 4.4) > 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(px - 2, py - 3 * sgn);
        ctx.lineTo(px, py - (7 + u * 4) * sgn);
        ctx.lineTo(px + 2, py - 3 * sgn);
        ctx.closePath(); ctx.fill();
      }
      // cabeza y ojo
      const hy = Math.sin(fase) * 4;
      ctx.fillStyle = 'rgba(13,33,58,0.55)';
      ctx.beginPath(); ctx.ellipse(r.L * 0.5 + 5, hy, 7, 4.6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(210,235,250,0.55)';
      ctx.beginPath(); ctx.arc(r.L * 0.5 + 8, hy - 1.4, 1.3, 0, 7); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };

  MAPA.render = function (sim, t) {
    if (!ctx || !ancho || !alto) return; // el mapa puede iniciar oculto (canvas sin medir): no pintar hasta el refit
    MAPA._sim = sim; // las marcas de isla (secretos, cubos) leen el estado del mundo
    pasaZoom(t); // la lupa persigue su objetivo ANTES de calcular la mezcla del globo
    actualizaCine(); // el HUD se retira solo al acercar (modo inmersión), antes de cualquier retorno
    const g = globoF();
    ctx.imageSmoothingEnabled = g < 0.5; // en el mar, píxeles nítidos; en el globo, mezcla suave de celdas
    if (g >= 0.999) {
      // vista globo: espacio + esfera. Sin capas de mundo (rendimiento).
      dibujaEstrellas(t, 1);
      dibujaEsfera(t, 1);
      return;
    }
    // capa base estática (mar, franjas, muralla, rótulos): se pre-renderiza una vez por refit/resize
    // azul profundo tipo UMP: sin cuadrícula, el brillo lo ponen las olas y la espuma
    ctx.fillStyle = '#1a4f8b'; ctx.fillRect(0, 0, ancho, alto);
    if (!base) base = crearBase();
    actualizaEventos(sim, t);
    ctx.save();
    ctx.translate(ancho / 2, alto / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    for (const off of [-D.W, 0, D.W]) ctx.drawImage(base, off, 0, D.W, D.H);
    // los Reyes del Mar patrullan las Franjas de Calma: el mapa cuenta la historia
    MAPA.pintaReyesMar(t);
    // tormentas: espiral de viento girando + destello eléctrico ocasional
    for (const s of sim.storms) pintaTormenta(s, t);
    // estela del vuelo: la ruta dorada se dibuja sola hacia el destino (bajo las islas)
    pintaEstelaVuelo(t);
    // islas: SOLO las que cruzan la vista (culling con margen por diorama).
    // Orden por prioridad: la seleccionada primero y luego por cercanía a la cámara.
    const vx0 = cam.x - ancho / (2 * cam.z), vx1 = cam.x + ancho / (2 * cam.z);
    const vy0 = cam.y - alto / (2 * cam.z), vy1 = cam.y + alto / (2 * cam.z);
    const visibles = [];
    for (const i of D.ISLAS) {
      if (i.oculta) continue;
      const mg = i.r * 2.6 + 80; // el sprite y su halo llegan a ~r*2.2: margen justo, no r*16
      let entra = false;
      for (const off of [0, -D.W, D.W]) {
        const x = i.x + off;
        if (x + mg >= vx0 && x - mg <= vx1 && i.y + mg >= vy0 && i.y - mg <= vy1) { entra = true; break; }
      }
      if (entra) visibles.push(i);
    }
    visibles.sort((a, b) => {
      if (selIsl === a) return -1;
      if (selIsl === b) return 1;
      return (a.x - cam.x) * (a.x - cam.x) + (a.y - cam.y) * (a.y - cam.y)
        - ((b.x - cam.x) * (b.x - cam.x) + (b.y - cam.y) * (b.y - cam.y));
    });
    // islas visibles: cada una se dibuja en la envoltura más cercana a la cámara
    const mejorEnvoltura = (i) => {
      const mg = i.r * 2.6 + 80;
      let mejor = null, mejorD = 1e18;
      for (const off of [0, -D.W, D.W]) {
        const x = i.x + off;
        if (x + mg < vx0 || x - mg > vx1 || i.y + mg < vy0 || i.y - mg > vy1) continue;
        const d = (x - cam.x) * (x - cam.x) + (i.y - cam.y) * (i.y - cam.y);
        if (d < mejorD) { mejorD = d; mejor = off; }
      }
      return mejor;
    };
    const dibujadas = [];
    for (const i of visibles) {
      const off = mejorEnvoltura(i);
      if (off === null) continue;
      pintaIslaConVida(i, off, t); // flotación + hover: la isla se mece y responde al cursor
      dibujadas.push([i, off]);
    }
    // barcos y luego etiquetas: ningún barco tapa un rótulo
    for (const s of sim.ships) dibujaBarco(s, sim, t);
    for (const [i, off] of dibujadas) MAPA.etiquetaIsla(i, off);
    // nubes: puffs suaves de tres lóbulos, nunca elipses duras
    for (const n of nubes) {
      n.x += n.v / 60; if (n.x > D.W + 60) n.x = -60;
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.ellipse(n.x, n.y, n.r, n.r * 0.36, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(n.x + n.r * 0.55, n.y + n.r * 0.1, n.r * 0.6, n.r * 0.28, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(n.x - n.r * 0.5, n.y + n.r * 0.08, n.r * 0.48, n.r * 0.24, 0, 0, 7); ctx.fill();
    }
    // tu capitán: figura pixel con sombrero de paja a zoom cercano, cubo y anillo a lo lejos
    avatarMundo(sim, t);
    ctx.restore();
    // aterrizaje/despegue: la esfera se superpone mientras el zoom cruza el umbral
    if (g > 0.001) {
      dibujaEstrellas(t, clamp((g - 0.7) / 0.3, 0, 1));
      dibujaEsfera(t, g);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
