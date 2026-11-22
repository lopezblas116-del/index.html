// ── ATMOSFERA del mapa: la capa que hace que el mundo se sienta VIVO ──
// Se instala POR FUERA de MAPA.render (después de GFX, que sustituye el render
// del mar): dibuja ENCIMA de todo sin tocar ninguna ruta interior, y si algo
// fallara, su try/catch garantiza que el mapa sigue funcionando igual.
//
//   · Ciclo día/noche ligado al reloj del juego (sim.minOfDay): tinte índigo,
//     ventanas encendidas que titilan, faroles en los muelles, luciérnagas,
//     destello de luna sobre el mar. Al amanecer y anochecer, tinte cálido.
//   · Lluvia y relámpagos dentro de cada tormenta.
//   · Rutas de viaje: toda nave en rumbo deja su línea punteada con punto de
//     progreso; la tuya en oro, con "llegas en…" calculado con la velocidad
//     real de la simulación (dist/5.2 minutos de juego).
//   · Sombras de las nubes a la deriva sobre el mar.
//   · Minimapa-brújula siempre disponible (clicable: vuela adonde cliques).
//   · Isla resaltada bajo el cursor + cursor en mano.
//   · Teclado: flechas/WASD panea, +/- zoom, 0 vuelve a tu isla, Esc sale
//     del modo inmersión. Doble clic: acercar en el punto.
(function (G) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ATM = G.ATM = {};
  let instalado = false;
  let mini = null, miniCtx = null;
  const MINI_W = 148, MINI_H = 82, MINI_ESC = 2; // ×2 interno para nitidez retina

  // ── pure (testeable sin DOM) ──────────────────────────────────────────────
  // 0 = pleno día, 1 = noche cerrada. Amanece 06:00→07:20, anochece 19:40→21:00.
  ATM.factorNoche = function (min) {
    min = ((Number(min) || 0) % 1440 + 1440) % 1440;
    if (min < 360) return 1;
    if (min < 440) return 1 - (min - 360) / 80;
    if (min < 1180) return 0;
    if (min < 1260) return (min - 1180) / 80;
    return 1;
  };
  // duración honesta de una travesía: la simulación navega dist/5.2 minutos de juego
  ATM.etiquetaDuracion = function (dist) {
    const minJuego = Math.max(0, Number(dist) || 0) / 5.2;
    const d = Math.floor(minJuego / 1440), h = Math.round((minJuego % 1440) / 60);
    if (d === 0 && h === 0) return 'menos de 1h';
    if (d === 0) return h + 'h';
    return d + 'd ' + h + 'h';
  };
  // envoltura horizontal: la diferencia más corta en un mundo anular
  ATM.dxEnvuelto = function (dx, W) {
    if (dx > W / 2) return dx - W;
    if (dx < -W / 2) return dx + W;
    return dx;
  };
  // ── fin pure ───────────────────────────────────────────────────────────────

  const cvDe = () => document.getElementById('mapa');

  function instalar() {
    if (instalado || !G.MAPA || !G.MAPA.render) return;
    const original = G.MAPA.render;
    G.MAPA.render = function (sim, t) {
      original(sim, t);
      try { encima(sim, t); } catch (err) { /* la atmósfera jamás rompe el mapa */ }
    };
    instalado = true;
    creaMini();
    conectaInput();
  }
  ATM.instalar = instalar;

  // ── la pasada que pinta ENCIMA de todo el mapa ────────────────────────────
  function encima(sim, t) {
    const cv = cvDe();
    if (!cv || !sim) { if (mini) mini.style.opacity = '0'; return; }
    const MAPA = G.MAPA, D = G.D;
    const enGlobo = MAPA.enGlobo && MAPA.enGlobo();
    if (enGlobo) { if (mini) mini.style.opacity = '0'; return; }
    if (mini) mini.style.opacity = '1';
    const ancho = cv.clientWidth, alto = cv.clientHeight;
    const cam = MAPA.cam, ctx = cv.getContext('2d');
    const noche = ATM.factorNoche(sim.minOfDay ? sim.minOfDay() : 720);
    const vx0 = cam.x - ancho / (2 * cam.z), vx1 = cam.x + ancho / (2 * cam.z);
    const vy0 = cam.y - alto / (2 * cam.z), vy1 = cam.y + alto / (2 * cam.z);
    const vis = (x, y, m) => x + m >= vx0 && x - m <= vx1 && y + m >= vy0 && y - m <= vy1;

    // 1) mundo: rutas, sombras de nubes, lluvia y luces nocturnas
    ctx.save();
    ctx.translate(ancho / 2, alto / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    pintaRutas(sim, t, ctx, cam, D);
    pintaSombrasNubes(t, ctx, cam, D);
    pintaLluvia(sim, t, ctx, cam, D);
    if (noche > 0.04) pintaLuces(sim, t, ctx, cam, D, noche, vis);
    pintaHover(t, ctx, cam, D);
    ctx.restore();

    // 2) tinte día/noche sobre TODA la escena (pantalla completa)
    if (noche > 0.01) {
      ctx.fillStyle = 'rgba(14,24,58,' + (0.34 * noche).toFixed(3) + ')';
      ctx.fillRect(0, 0, ancho, alto);
      ctx.fillStyle = 'rgba(6,12,34,' + (0.24 * noche).toFixed(3) + ')';
      ctx.fillRect(0, 0, ancho, alto);
      const crepusculo = Math.sin(clamp(noche, 0, 1) * Math.PI); // naranja solo en la transición
      if (crepusculo > 0.03) {
        ctx.fillStyle = 'rgba(255,138,60,' + (0.12 * crepusculo).toFixed(3) + ')';
        ctx.fillRect(0, 0, ancho, alto);
      }
    }
    // 3) pantalla: minimapa (siempre, también en modo inmersión: es el sustituto del HUD)
    pintaMini(sim, t, cam, D);
    pintaRosa(ctx, cam, ancho, alto);
  }

  // ── rosa de los vientos: solo en la vista general, el mapa se comporta como mapa ──
  //    Esquina inferior derecha, compacta: no pisa los botones de zoom ni el minimapa.
  function pintaRosa(ctx, cam, ancho, alto) {
    const alfa = Math.min(1, Math.max(0, (0.92 - cam.z) / 0.25));
    if (alfa <= 0.02) return;
    const cx = ancho - 52, cy = alto - 44, R = 30;
    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.strokeStyle = 'rgba(244,208,120,0.8)';
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(244,208,120,0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.72, 0, 7); ctx.stroke();
    // rumbos: cardinales largos, intermedios cortos
    ctx.strokeStyle = 'rgba(244,208,120,0.6)'; ctx.lineWidth = 1;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4, rr = k % 2 ? R * 0.72 : R;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * R * 0.14, cy + Math.sin(a) * R * 0.14);
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      ctx.stroke();
    }
    // aguja norte: rombo en dos tonos
    ctx.fillStyle = 'rgba(246,224,94,0.95)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - R * 0.86); ctx.lineTo(cx + 4, cy); ctx.lineTo(cx - 4, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(120,96,30,0.85)';
    ctx.beginPath();
    ctx.moveTo(cx, cy + R * 0.55); ctx.lineTo(cx + 4, cy); ctx.lineTo(cx - 4, cy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(246,224,94,0.95)';
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, 7); ctx.fill();
    // letras cardinales
    ctx.font = '700 11px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(246,224,94,0.95)';
    ctx.fillText('N', cx, cy - R - 7);
    ctx.font = '600 8px Georgia, serif';
    ctx.fillStyle = 'rgba(244,208,120,0.6)';
    ctx.fillText('E', cx + R + 7, cy);
    ctx.fillText('S', cx, cy + R + 8);
    ctx.fillText('O', cx - R - 7, cy);
    ctx.restore();
  }

  // ── rutas de viaje ────────────────────────────────────────────────────────
  function pintaRutas(sim, t, ctx, cam, D) {
    const ptosCurva = (p, k) => {
      let x1 = p.x1;
      const dx = p.x1 - p.x0;
      if (Math.abs(dx) > D.W / 2) x1 = p.x1 + (dx > 0 ? -D.W : D.W);
      const mx = (p.x0 + x1) / 2, my = Math.min(p.y0, p.y1) - Math.abs(x1 - p.x0) * 0.05 - 10;
      const a = 1 - k;
      return { x: a * a * p.x0 + 2 * a * k * mx + k * k * x1, y: a * a * p.y0 + 2 * a * k * my + k * k * p.y1, mx, my, x1, y1: p.y1 };
    };
    const traza = (p, k, color, dash) => {
      const c = ptosCurva(p, k);
      ctx.strokeStyle = color; ctx.lineWidth = 1.6 / cam.z;
      if (dash) { ctx.setLineDash([6 / cam.z, 6 / cam.z]); ctx.lineDashOffset = -t / 40 / cam.z; } else ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(p.x0, p.y0);
      ctx.quadraticCurveTo(c.mx, c.my, c.x1, c.y1);
      ctx.stroke(); ctx.setLineDash([]);
      return c;
    };
    // las naves del mundo: línea blanca tímida con punto de progreso
    for (const s of sim.ships) {
      if (s.state !== 'navegando' || !s.plan) continue;
      const p = s.plan, k = clamp((sim.t - p.t0) / Math.max(1, p.dur), 0, 1);
      p.k = k;
      const c = traza(p, k, 'rgba(255,255,255,0.30)', true);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(c.x, c.y, 2.6 / cam.z, 0, 7); ctx.fill();
    }
    // tu travesía: oro, con cuenta atrás honesta según la velocidad de la sim
    const u = sim.user;
    if (u && u.plan && u.plan.x0 != null) {
      const p = u.plan, k = clamp((sim.t - p.t0) / Math.max(1, p.dur), 0, 1);
      const c = traza(p, k, 'rgba(246,224,94,0.85)', true);
      const pul = 3.4 / cam.z + Math.sin(t / 260) * 0.8 / cam.z;
      ctx.fillStyle = '#f6e05e';
      ctx.beginPath(); ctx.arc(c.x, c.y, pul, 0, 7); ctx.fill();
      if (cam.z >= 0.7) {
        const restante = Math.max(0, p.t0 + p.dur - sim.t);
        const texto = 'llegas en ' + ATM.etiquetaDuracion(restante * 5.2);
        ctx.font = (11 / cam.z).toFixed(1) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3 / cam.z; ctx.strokeStyle = 'rgba(6,12,26,0.8)';
        const ty = c.my - 8 / cam.z;
        ctx.strokeText(texto, c.mx, ty);
        ctx.fillStyle = '#f4d97a'; ctx.fillText(texto, c.mx, ty);
      }
    }
  }

  // ── sombras de las nubes (la nube blanca ya pinta GFX; su sombra va aquí) ─
  function pintaSombrasNubes(t, ctx, cam, D) {
    const nubes = G.MAPA.nubes || [];
    for (const n of nubes) {
      const x = n.x + n.r * 0.5, y = n.y + n.r * 0.42;
      ctx.fillStyle = 'rgba(6,22,44,0.10)';
      ctx.beginPath(); ctx.ellipse(x, y, n.r, n.r * 0.34, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + n.r * 0.5, y + n.r * 0.1, n.r * 0.55, n.r * 0.26, 0, 0, 7); ctx.fill();
    }
  }

  // ── lluvia y relámpagos dentro de las tormentas ───────────────────────────
  function pintaLluvia(sim, t, ctx, cam, D) {
    if (!sim.storms) return;
    for (let si = 0; si < sim.storms.length; si++) {
      const s = sim.storms[si];
      ctx.save();
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.clip();
      ctx.strokeStyle = 'rgba(205,228,255,0.38)'; ctx.lineWidth = 0.8 / cam.z;
      const gotas = 26;
      for (let k = 0; k < gotas; k++) {
        const h = ((si * 7919 + k * 104729) % 1000) / 1000;
        const gx = s.x - s.r + h * 2 * s.r;
        const cae = ((t * 0.055 * (0.7 + h * 0.6) + h * 900) % (s.r * 2.2));
        const gy = s.y - s.r * 1.1 + cae;
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - 1.6 / cam.z, gy + 5.5 / cam.z); ctx.stroke();
      }
      // relámpago: un destello breve cada ~6 s, con zigzag hasta el centro
      const fase = (t + si * 997) % 6100;
      if (fase < 150) {
        const alfa = 0.55 * (1 - fase / 150);
        ctx.fillStyle = 'rgba(225,235,255,' + (0.20 * alfa * 2).toFixed(3) + ')';
        ctx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
        ctx.strokeStyle = 'rgba(250,252,255,' + alfa.toFixed(3) + ')';
        ctx.lineWidth = 1.6 / cam.z;
        ctx.beginPath();
        let bx = s.x + (si % 2 ? 1 : -1) * s.r * 0.3, by = s.y - s.r * 0.95;
        ctx.moveTo(bx, by);
        for (let seg = 1; seg <= 4; seg++) {
          bx += ((si * (seg + 3)) % 13 - 6) * s.r * 0.09; by += s.r * 0.42;
          ctx.lineTo(bx, by);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ── luces de la noche: ventanas, faroles de muelle, luciérnagas, luna ─────
  function pintaLuces(sim, t, ctx, cam, D, noche, vis) {
    const cerca = cam.z >= 0.62;
    for (const i of G.D.ISLAS) {
      if (i.oculta) continue;
      let encendida = false;
      for (const off of [0, -D.W, D.W]) {
        if (vis(i.x + off, i.y, i.r * 3 + 60)) { encendida = true; break; }
      }
      if (!encendida) continue;
      for (const w of [0, -D.W, D.W]) {
        const cx = i.x + w;
        if (!vis(cx, i.y, i.r * 2.4 + 40)) continue;
        // ventanas: una llama cálida y titilante por edificio
        if (cerca && G.MAPA.edificiosIsla) {
          for (let k = 0; k < G.MAPA.edificiosIsla(i, 0).length; k++) {
            const e = G.MAPA.edificiosIsla(i, 0)[k];
            const titila = 0.72 + 0.28 * Math.sin(t / 130 + k * 2.4 + i.x);
            const px = cx + e.x, py = i.y + (e.wy != null ? e.wy : e.y);
            const r = 3.4 / cam.z + 1.4;
            ctx.fillStyle = 'rgba(255,196,92,' + (0.16 * noche * titila).toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(px, py, r * 2.6, 0, 7); ctx.fill();
            ctx.fillStyle = 'rgba(255,214,120,' + (0.85 * noche * titila).toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(px, py, r * 0.55, 0, 7); ctx.fill();
          }
          // faroles a cada lado del muelle (el muelle mira al sur)
          for (const lado of [-1, 1]) {
            const px = cx + lado * i.r * 0.42, py = i.y + i.r * 0.62;
            const pulso = 0.8 + 0.2 * Math.sin(t / 210 + lado + i.y);
            const r = 4.6 / cam.z + 1.8;
            ctx.fillStyle = 'rgba(255,178,70,' + (0.20 * noche * pulso).toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(px, py, r * 2.8, 0, 7); ctx.fill();
            ctx.fillStyle = 'rgba(255,224,140,' + (0.9 * noche * pulso).toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(px, py, r * 0.6, 0, 7); ctx.fill();
          }
          // luciérnagas: tres motas oro-verde en espiral lenta alrededor de la isla
          for (let k = 0; k < 3; k++) {
            const alfa = 0.35 + 0.3 * Math.sin(t / 500 + k * 2.1 + i.y);
            if (alfa <= 0.1) continue;
            const px = cx + Math.cos(t / 1700 + k * 2.1 + i.x) * i.r * 0.95;
            const py = i.y + Math.sin(t / 2300 + k * 1.3) * i.r * 0.6 - i.r * 0.25;
            ctx.fillStyle = 'rgba(214,255,140,' + (alfa * noche).toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(px, py, 1.7 / cam.z + 0.5, 0, 7); ctx.fill();
          }
        }
      }
    }
    // destello de luna: chispas plateadas fijas sobre el mar abierto
    for (let k = 0; k < 26; k++) {
      const hx = ((k * 7919 + 13) % 1000) / 1000, hy = ((k * 104729 + 7) % 1000) / 1000;
      const px = hx * D.W, py = hy * D.H;
      if (!vis(px, py, 30)) continue;
      const titila = Math.sin(t / 900 + k * 3.1);
      if (titila < 0.55) continue;
      ctx.fillStyle = 'rgba(205,225,255,' + (0.30 * noche * (titila - 0.55) * 2).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(px, py, 1.5 / cam.z + 0.4, 0, 7); ctx.fill();
    }
  }

  // ── hover: la isla bajo el cursor se anuncia con un halo dorado ───────────
  let raton = null; // { mx, my } en píxeles de canvas
  function pintaHover(t, ctx, cam, D) {
    if (!raton || cam.z < 0.5) return;
    const cv = cvDe();
    const wx = cam.x + (raton.mx - cv.clientWidth / 2) / cam.z;
    const wy = cam.y + (raton.my - cv.clientHeight / 2) / cam.z;
    let mejor = null, mejorD = 1e18;
    for (const i of D.ISLAS) {
      if (i.oculta) continue;
      for (const w of [0, -D.W, D.W]) {
        const dx = ATM.dxEnvuelto(i.x + w - wx, D.W), dy = i.y - wy;
        const d = dx * dx + dy * dy, lim = i.r * 1.45 + 8 / cam.z;
        if (d < lim * lim && d < mejorD) { mejorD = d; mejor = { i, w }; }
      }
    }
    if (!mejor) { if (cv) cv.style.cursor = 'default'; return; }
    const { i, w } = mejor;
    const pulso = 1 + Math.sin(t / 420) * 0.05;
    ctx.fillStyle = 'rgba(246,224,94,0.10)';
    ctx.beginPath(); ctx.ellipse(i.x + w, i.y, i.r * 1.5 * pulso, i.r * 1.15 * pulso, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(246,224,94,0.62)'; ctx.lineWidth = 1.8 / cam.z;
    ctx.setLineDash([4 / cam.z, 4 / cam.z]); ctx.lineDashOffset = -t / 50 / cam.z;
    ctx.beginPath(); ctx.ellipse(i.x + w, i.y, i.r * 1.32 * pulso, i.r * 1.02 * pulso, 0, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
    if (cv) cv.style.cursor = 'pointer';
  }

  // ── minimapa-brújula: el mundo entero, tu posición, la tormenta, el rumbo ─
  function creaMini() {
    if (mini || !cvDe() || !cvDe().parentElement) return;
    mini = document.createElement('canvas');
    mini.id = 'mil-minimapa';
    mini.width = MINI_W * MINI_ESC; mini.height = MINI_H * MINI_ESC;
    mini.setAttribute('aria-label', 'Minimapa del mundo: haz clic para volar a ese punto');
    mini.title = 'El mundo entero · clic para volar allí';
    mini.style.cssText = 'position:absolute;left:12px;bottom:12px;width:' + MINI_W + 'px;height:' + MINI_H +
      'px;z-index:6;border-radius:10px;cursor:pointer;transition:opacity .4s ease;box-shadow:0 10px 26px rgba(0,0,0,0.45);';
    mini.addEventListener('click', (e) => {
      const MAPA = G.MAPA, D = G.D;
      const r = mini.getBoundingClientRect();
      const wx = clamp((e.clientX - r.left) / (MINI_W / D.W), 0, D.W);
      const wy = clamp((e.clientY - r.top) / (MINI_H / D.H), 0, D.H);
      MAPA.volar(wx, wy, Math.max(MAPA.cam.z, 1.35), 750);
    });
    cvDe().parentElement.appendChild(mini);
    miniCtx = mini.getContext('2d');
  }

  function pintaMini(sim, t, cam, D) {
    if (!miniCtx) return;
    const mctx = miniCtx;
    mctx.setTransform(MINI_ESC, 0, 0, MINI_ESC, 0, 0);
    mctx.clearRect(0, 0, MINI_W, MINI_H);
    const ex = 3, iw = MINI_W - ex * 2, ih = MINI_H - ex * 2;
    const sx = iw / D.W, sy = ih / D.H;
    mctx.fillStyle = 'rgba(7,14,30,0.85)';
    mctx.beginPath();
    if (mctx.roundRect) mctx.roundRect(0, 0, MINI_W, MINI_H, 10); else mctx.rect(0, 0, MINI_W, MINI_H);
    mctx.fill();
    mctx.strokeStyle = 'rgba(244,193,26,0.5)'; mctx.lineWidth = 1;
    mctx.stroke();
    mctx.fillStyle = '#2565ad';
    mctx.fillRect(ex, ex, iw, ih);
    // muralla (costura del mundo): línea vertical tenue
    mctx.fillStyle = 'rgba(255,255,255,0.18)';
    mctx.fillRect(ex + (D.W / 2) * sx, ex, 1, ih);
    // tormentas: puntos rojos vivos
    if (sim.storms) {
      for (const s of sim.storms) {
        mctx.fillStyle = 'rgba(255,96,60,0.9)';
        mctx.beginPath(); mctx.arc(ex + s.x * sx, ex + s.y * sy, 2.4, 0, 7); mctx.fill();
      }
    }
    // islas: oro las del juego, espuma las demás
    for (const i of D.ISLAS) {
      if (i.oculta) continue;
      mctx.fillStyle = i.juego ? '#f4c445' : 'rgba(255,255,255,0.8)';
      mctx.beginPath(); mctx.arc(ex + i.x * sx, ex + i.y * sy, Math.max(1.3, i.r * sx * 1.7), 0, 7); mctx.fill();
      if (i.juego) {
        mctx.strokeStyle = 'rgba(0,0,0,0.4)'; mctx.lineWidth = 0.5; mctx.stroke();
      }
    }
    // tu isla de origen: rombo con halo
    const u = sim.user;
    if (u && u.isl && D.ISLA[u.isl]) {
      const i = D.ISLA[u.isl];
      const px = ex + i.x * sx, py = ex + i.y * sy;
      mctx.strokeStyle = 'rgba(246,224,94,0.9)'; mctx.lineWidth = 1.2;
      mctx.strokeRect(px - 3.5, py - 3.5, 7, 7);
    }
    // lo que ves ahora mismo: rectángulo de la cámara (con envoltura)
    const vw = (cvDe().clientWidth / cam.z) * sx, vh = (cvDe().clientHeight / cam.z) * sy;
    mctx.strokeStyle = 'rgba(255,255,255,0.95)'; mctx.lineWidth = 1.1;
    for (const d of [-D.W, 0, D.W]) {
      mctx.strokeRect(ex + (cam.x + d) * sx - vw / 2, ex + cam.y * sy - vh / 2, vw, vh);
    }
    // N de norte
    mctx.fillStyle = 'rgba(244,193,26,0.9)';
    mctx.font = 'bold 8px system-ui, sans-serif';
    mctx.textAlign = 'center';
    mctx.fillText('N', MINI_W - 9, 12);
  }

  // ── entrada: teclado, doble clic, seguimiento del ratón para hover ─────────
  function conectaInput() {
    const MAPA = G.MAPA, D = G.D, cv = cvDe();
    if (!cv) return;
    cv.addEventListener('dblclick', (e) => {
      e.preventDefault();
      MAPA.zoom(1, e.clientX, e.clientY); MAPA.zoom(1, e.clientX, e.clientY);
    });
    cv.addEventListener('mousemove', (e) => {
      const r = cv.getBoundingClientRect();
      raton = { mx: e.clientX - r.left, my: e.clientY - r.top };
    });
    cv.addEventListener('mouseleave', () => { raton = null; });
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.metaKey || e.ctrlKey || e.altKey) return;
      const paso = 90 / MAPA.cam.z;
      const panea = (dx, dy) => {
        MAPA.cancelaVueloPublica && MAPA.cancelaVueloPublica();
        MAPA.cam.x = ((MAPA.cam.x + dx) % D.W + D.W) % D.W;
        MAPA.cam.y = clamp(MAPA.cam.y + dy, 0, D.H);
      };
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A': panea(-paso, 0); e.preventDefault(); break;
        case 'ArrowRight': case 'd': case 'D': panea(paso, 0); e.preventDefault(); break;
        case 'ArrowUp': case 'w': case 'W': panea(0, -paso); e.preventDefault(); break;
        case 'ArrowDown': case 's': case 'S': panea(0, paso); e.preventDefault(); break;
        case '+': case '=': MAPA.zoom(1); e.preventDefault(); break;
        case '-': case '_': MAPA.zoom(-1); e.preventDefault(); break;
        case '0': {
          const u = G.JUEGO && G.JUEGO.sim && G.JUEGO.sim.user;
          const isla = u && u.isl && D.ISLA[u.isl];
          if (isla) MAPA.volar(isla.x, isla.y, 1.3, 750);
          e.preventDefault(); break;
        }
        case 'Escape':
          if (MAPA.enCine && MAPA.enCine()) { MAPA.volar(MAPA.cam.x, MAPA.cam.y, 1.25, 700); e.preventDefault(); }
          break;
      }
    });
  }

  // ── arranque: envolver SIEMPRE DESPUÉS de GFX (que sustituye el render del mar).
  //    GFX carga sprites de forma asíncrona; sondeo hasta ver la bandera (con tope). ──
  if (typeof window !== 'undefined') {
    const arranca = () => {
      const t0 = Date.now();
      const sondeo = setInterval(() => {
        const gfxListo = G.GFX && G.GFX.instalado;
        if (gfxListo || Date.now() - t0 > 5000) { clearInterval(sondeo); instalar(); }
      }, 120);
    };
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', arranca);
    else arranca();
  }
})(typeof window !== 'undefined' ? window : globalThis);
