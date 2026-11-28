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
  // ruido determinista (la misma semilla del mapa): posiciones estables sin estado
  const ruido = (k) => { const v = Math.sin(k * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

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
    pintaCardumenes(sim, t, ctx, cam, D, vis);
    pintaLluvia(sim, t, ctx, cam, D);
    if (noche > 0.3) pintaAurora(t, ctx, cam, D, noche); // las Franjas de Calma resplandecen de noche
    pintaArcoiris(sim, t, ctx, cam, D, vis);             // la promesa tras cada tormenta
    if (noche > 0.04) pintaLuces(sim, t, ctx, cam, D, noche, vis);
    if (noche > 0.25) pintaBioluma(t, ctx, cam, D, noche, vis); // el mar enciende su propio cielo
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
        pintaRayos(ctx, crepusculo, ancho, alto); // columnas de sol bajo en el horizonte
      }
    }
    // 2.5) TESTIGOS DEL MUNDO: lo que la bitácora cuenta, el mar lo MUESTRA.
    //      Dibujo en coordenadas de mundo (mismo transform que el resto de la capa).
    ctx.save();
    ctx.translate(ancho / 2, alto / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
    const ahora = performance.now();
    const pings = sim._pings || [];
    const ICONOS = {
      tesoro: ['💰', '255,214,120'], combate: ['⚔️', '255,130,100'],
      social: ['✨', '195,155,255'], fama: ['🏴', '255,214,120'], aviso: ['📰', '225,238,250'], capitan: ['🎯', '246,224,94']
    };
    const tipoDe = { monedas: 'tesoro', reliquia: 'tesoro', hallazgo: 'tesoro', secreto: 'tesoro', cava: 'tesoro', cuboHallado: 'tesoro', cuboAzul: 'tesoro', cuboDorado: 'tesoro', cubosFin: 'tesoro', rutaFinal: 'tesoro', hito: 'tesoro', pozoFin: 'tesoro', derrota: 'combate', robo: 'combate', robo_pilla: 'combate', arresto: 'combate', arresto_gran: 'combate', naufragio: 'combate', fuga: 'combate', rescate: 'combate', funda: 'social', recluta: 'social', abandona: 'social', nuevoCap: 'social', amistad: 'social', rivalidad: 'social', heredero: 'social', despierta: 'social', nivel: 'social', habilidad: 'social', festival: 'social', cartel: 'fama', sube: 'fama', supernova: 'fama', emperador: 'fama', reymar: 'fama', flota: 'fama', primera: 'fama', fruta: 'social' };
    for (const p of pings) {
      const edad = ahora - p.t0;
      if (edad > 6500) continue;
      if (!vis(p.x, p.y, 40)) continue;
      const par = ICONOS[p.key] || ICONOS[tipoDe[p.key]] || ICONOS.aviso;
      const k = edad / 6500;
      const alfa = (k < 0.12 ? k / 0.12 : 1 - Math.max(0, (k - 0.72) / 0.28));
      ctx.save();
      // anillo expansivo doble: el mar reacciona
      ctx.globalAlpha = alfa * 0.75;
      ctx.strokeStyle = 'rgba(' + par[1] + ',1)'; ctx.lineWidth = 1.6 / cam.z;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5 + k * 30, 0, 7); ctx.stroke();
      ctx.globalAlpha = alfa * 0.35;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5 + k * 52, 0, 7); ctx.stroke();
      // icono que asciende y se apaga
      ctx.globalAlpha = alfa;
      ctx.font = (13 / cam.z).toFixed(1) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(par[0], p.x, p.y - 10 / cam.z - k * 16 / cam.z);
      // pelea o saqueo: humo que sube de la isla
      if (tipoDe[p.key] === 'combate') {
        ctx.globalAlpha = alfa * 0.3; ctx.fillStyle = '#cfd8e0';
        for (let q = 0; q < 3; q++) {
          const off = (edad / 900 + q * 0.45) % 1.6;
          ctx.beginPath(); ctx.arc(p.x + (q - 1) * 6 / cam.z, p.y - off * 26 / cam.z, (2.5 + off * 3) / cam.z, 0, 7); ctx.fill();
        }
      }
      ctx.restore();
    }
    // LAS CHARLAS SE VEN: burbuja sobre la isla donde dos almas conversan AHORA
    if (cam.z >= 0.9 && sim.charlasActivas && sim.charlasActivas.length) {
      ctx.save();
      ctx.font = '600 ' + (11 / cam.z).toFixed(1) + 'px Manrope, sans-serif';
      let vistas = 0;
      for (const c of sim.charlasActivas) {
        if (vistas >= 3) break;
        if (!(sim.t < c.t1) || !c.guion || !c.guion.l) continue;
        const isl = D.ISLA[c.isl]; if (!isl || !vis(isl.x, isl.y, 60)) continue;
        const A = sim.byId(c.A), B = sim.byId(c.B); if (!A || !B) continue;
        const idx = Math.min(c.guion.l.length - 1, Math.floor((sim.t - c.t0) / 7));
        const lin = c.guion.l[idx]; if (!lin) continue;
        const quien = lin[0] === 'A' ? A : B;
        const texto = String(lin[1]);
        const txt = quien.name + ': ' + texto.slice(0, 40) + (texto.length > 40 ? '…' : '');
        const tw = ctx.measureText(txt).width + 14 / cam.z, fh = 16 / cam.z;
        const bx = isl.x - tw / 2, by = isl.y - isl.r - 26 / cam.z;
        ctx.globalAlpha = 0.94;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, tw, fh, 4 / cam.z); else ctx.rect(bx, by, tw, fh);
        ctx.fillStyle = 'rgba(14,24,46,0.92)'; ctx.fill();
        ctx.strokeStyle = 'rgba(130,200,255,0.55)'; ctx.lineWidth = 0.8 / cam.z; ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(isl.x - 3 / cam.z, by + fh); ctx.lineTo(isl.x, by + fh + 5 / cam.z); ctx.lineTo(isl.x + 3 / cam.z, by + fh);
        ctx.closePath();
        ctx.fillStyle = 'rgba(14,24,46,0.92)'; ctx.fill();
        ctx.fillStyle = '#eaf2fc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(txt, isl.x, by + fh / 2);
        vistas++;
      }
      ctx.restore();
    }
    ctx.restore();
    // 3) pantalla: luz de escena (como la del globo) + minimapa + rosa de los vientos
    pintaLuzEscena(ctx, cam, ancho, alto);
    pintaMini(sim, t, cam, D);
    pintaRosa(ctx, cam, ancho, alto);
  }

  // ── cardúmenes: la vida bajo la superficie. Escuelas que vagan y huyen de
  //    las naves; de lejos son vetas oscuras, de cerca pequeñas sombras con cola ──
  let _cardumenes = null;
  function pintaCardumenes(sim, t, ctx, cam, D, vis) {
    if (!_cardumenes) {
      _cardumenes = [];
      for (let e = 0; e < 7; e++) {
        const esc = { x: ruido(e * 13.7 + 2) * D.W, y: 120 + ruido(e * 7.3 + 5) * (D.H - 240), vx: 0, vy: 0 };
        esc.pes = [];
        for (let p = 0; p < 6; p++) esc.pes.push({ a: ruido(e * 9 + p * 3.3) * 7, r: 7 + ruido(e + p) * 22, f: 0.8 + ruido(e * 3 + p) * 0.9 });
        _cardumenes.push(esc);
      }
    }
    const naves = (sim.ships || []).map(s => [s.x, s.y]);
    ctx.fillStyle = 'rgba(16,38,66,0.5)';
    for (const esc of _cardumenes) {
      // huida: la nave más cercana empuja la escuela (pánico esprín)
      let huye = null, dMin = 1e9;
      for (const [sx, sy] of naves) { const d = Math.hypot(sx - esc.x, sy - esc.y); if (d < dMin) { dMin = d; huye = [sx, sy]; } }
      const panico = huye && dMin < 130;
      const vel = panico ? 3.1 : 0.55;
      if (huye && panico) { const dx = esc.x - huye[0], dy = esc.y - huye[1], m = Math.hypot(dx, dy) || 1; esc.vx += (dx / m) * 0.5; esc.vy += (dy / m) * 0.5; }
      esc.vx += Math.sin(t / 3400 + esc.x * 0.01) * 0.03; esc.vy += Math.cos(t / 4100 + esc.y * 0.013) * 0.02;
      esc.vx *= 0.96; esc.vy *= 0.96;
      esc.x = ((esc.x + esc.vx * vel) % D.W + D.W) % D.W;
      esc.y = Math.max(60, Math.min(D.H - 60, esc.y + esc.vy * vel));
      if (!vis(esc.x, esc.y, 70)) continue;
      const ang = Math.atan2(esc.vy * vel + Math.sin(t / 2600 + esc.x) * 0.3, esc.vx * vel + 0.2);
      for (const p of esc.pes) {
        const ox = Math.cos(p.a + t / 900 * p.f) * p.r, oy = Math.sin(p.a * 1.7 + t / 1100 * p.f) * p.r * 0.6;
        ctx.save();
        ctx.translate(esc.x + ox, esc.y + oy); ctx.rotate(ang);
        ctx.beginPath(); ctx.ellipse(0, 0, 4.2, 1.5, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-3.6, 0); ctx.lineTo(-6, -1.8); ctx.lineTo(-6, 1.8); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }

  // ── aurora: sobre las Franjas de Calma, cortinas de luz que suben del mar ──
  // Las bandas miden ~60 unidades: la aurora no cabe adentro — SUBE desde ellas,
  // como cortinas verticales que se mecenden. Cada cortina: gradiente vertical
  // horneado al vuelo, vaivén de fase lenta, tres temperaturas de color.
  function pintaAurora(t, ctx, cam, D, noche) {
    const bandas = [[D.CB_T, D.GL_Y0], [D.GL_Y1, D.CB_B]];
    const vt = cam.y - 500 / cam.z, vb = cam.y + 500 / cam.z;
    for (const [a, b] of bandas) {
      if (vb < a - 140 || vt > b + 60) continue;
      const x0 = Math.max(0, cam.x - 620 / cam.z), x1 = Math.min(D.W, cam.x + 620 / cam.z);
      const yC = (a + b) / 2, altoB = Math.max(40, b - a);
      for (let x = Math.ceil(x0 / 56) * 56; x < x1; x += 56) {
        const sem = ruido(x * 0.031);
        const fase = t / 3400 + sem * 9.4;
        const h = altoB * (1.6 + sem * 2.0), ancho = 4.5 + sem * 5.5;
        const sway = Math.sin(fase + x / 210) * altoB * 0.3;
        const hue = sem < 0.5 ? '120,255,205' : (sem < 0.8 ? '150,120,255' : '90,225,255');
        const g = ctx.createLinearGradient(0, yC + altoB * 0.45, 0, yC - h);
        g.addColorStop(0, 'rgba(' + hue + ',' + (0.17 * noche).toFixed(3) + ')');
        g.addColorStop(0.5, 'rgba(' + hue + ',' + (0.10 * noche).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + hue + ',0)');
        ctx.strokeStyle = g; ctx.lineWidth = ancho; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + sway * 0.4, yC + altoB * 0.45);
        ctx.quadraticCurveTo(x + sway, yC - h * 0.5, x + sway * 1.8, yC - h);
        ctx.stroke();
      }
    }
  }

  // ── bioluminiscencia: de noche el mar responde con su propia luz ──
  let _bioChispa = null;
  function pintaBioluma(t, ctx, cam, D, noche, vis) {
    if (!_bioChispa) {
      const c = document.createElement('canvas'); c.width = c.height = 9;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(4.5, 4.5, 0, 4.5, 4.5, 4.5);
      gr.addColorStop(0, 'rgba(170,255,235,0.9)'); gr.addColorStop(0.5, 'rgba(110,230,255,0.35)'); gr.addColorStop(1, 'rgba(110,230,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 9, 9);
      _bioChispa = c;
      _bioChispa.pts = [];
      for (let k = 0; k < 54; k++) _bioChispa.pts.push([ruido(k * 7.1 + 40) * D.W, 90 + ruido(k * 3.9 + 91) * (D.H - 180), ruido(k * 11.3) * 7]);
    }
    for (const [x, y, f] of _bioChispa.pts) {
      if (!vis(x, y, 30)) continue;
      const titila = 0.16 + 0.34 * Math.sin(t / 900 + f * 9);
      ctx.globalAlpha = Math.max(0, titila * noche);
      ctx.drawImage(_bioChispa, x - 4.5, y - 4.5);
    }
    ctx.globalAlpha = 1;
  }

  // ── arcoíris: cuando una tormenta se disipa, su promesa queda en el cielo ──
  let _iris = { x: 0, y: 0, hasta: 0, prox: 60000, sprite: null, prev: null };
  function pintaArcoiris(sim, t, ctx, cam, D, vis) {
    const ids = (sim.storms || []).map(s => s);
    if (_iris.prev) for (const vieja of _iris.prev) {
      if (!ids.some(s => s === vieja) && t > _iris.hasta) { _iris.x = vieja.x; _iris.y = vieja.y + vieja.r * 0.4; _iris.hasta = t + 26000; }
    }
    _iris.prev = ids;
    if (t > _iris.prox) { // incluso sin tormenta que seguir: una cada tanto, cerca de la Gran Ruta
      _iris.x = ruido(t / 9e5) * D.W; _iris.y = (D.GL_Y0 + D.GL_Y1) / 2 - 60; _iris.hasta = t + 20000;
      _iris.prox = t + 190000;
    }
    if (t >= _iris.hasta || !_iris.sprite) {
      if (!_iris.sprite) { // arco de siete bandas, horneado una vez
        const c = document.createElement('canvas'); c.width = 560; c.height = 290;
        const g = c.getContext('2d');
        const cols = ['rgba(255,90,90,', 'rgba(255,170,70,', 'rgba(255,240,110,', 'rgba(120,225,130,', 'rgba(105,190,255,', 'rgba(130,120,240,', 'rgba(190,120,230,'];
        for (let b = 0; b < 7; b++) {
          g.strokeStyle = cols[b] + '0.13)'; g.lineWidth = 9;
          g.beginPath(); g.arc(280, 285, 240 - b * 10, Math.PI, 0); g.stroke();
        }
        _iris.sprite = c;
      }
      if (t >= _iris.hasta) return;
    }
    if (!vis(_iris.x, _iris.y, 300)) return;
    ctx.globalAlpha = 0.75 + Math.sin(t / 1300) * 0.25;
    ctx.drawImage(_iris.sprite, _iris.x - 280, _iris.y - 285);
    ctx.globalAlpha = 1;
  }

  // ── god rays: columnas de sol bajo, solo en la transición día/noche ──
  let _rayo = null;
  function pintaRayos(ctx, crepusculo, ancho, alto) {
    if (!_rayo) { // un haz horneado: trapecio de luz que se desvanece hacia abajo
      const c = document.createElement('canvas'); c.width = 240; c.height = 560;
      const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, 560);
      gr.addColorStop(0, 'rgba(255,205,130,0.14)'); gr.addColorStop(0.7, 'rgba(255,190,110,0.05)'); gr.addColorStop(1, 'rgba(255,180,100,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(40, 0); g.lineTo(200, 0); g.lineTo(150, 560); g.lineTo(30, 560); g.closePath(); g.fill();
      _rayo = c;
    }
    for (let k = 0; k < 3; k++) {
      const x = ancho * (0.18 + k * 0.3), esc = alto / 560, vaiv = Math.sin(k * 2.4 + k) * 24;
      ctx.save();
      ctx.translate(x + vaiv, -20); ctx.rotate(0.16 - k * 0.07); ctx.scale(1, esc);
      ctx.globalAlpha = Math.min(1, crepusculo * (0.9 - k * 0.22));
      ctx.drawImage(_rayo, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ── luz de escena: el mapa plano respira como el globo — brillo suave al
  //    noroeste y borde que se hunde, solo en la vista general ──
  function pintaLuzEscena(ctx, cam, ancho, alto) {
    const alfa = Math.min(1, Math.max(0, (0.95 - cam.z) / 0.35));
    if (alfa <= 0.02) return;
    const luz = ctx.createRadialGradient(ancho * 0.38, alto * 0.32, Math.min(ancho, alto) * 0.18, ancho / 2, alto / 2, Math.max(ancho, alto) * 0.78);
    luz.addColorStop(0, 'rgba(255,246,220,' + (0.06 * alfa).toFixed(3) + ')');
    luz.addColorStop(0.55, 'rgba(255,255,255,0)');
    luz.addColorStop(1, 'rgba(4,10,24,' + (0.13 * alfa).toFixed(3) + ')');
    ctx.fillStyle = luz;
    ctx.fillRect(0, 0, ancho, alto);
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
    // RUTAS CON PORTAL: un plan con pts se dibuja por tramos (cada uno su curva),
    // así la ruta dorada se dobla por la montaña o por el buceo bajo el muro.
    const tramosDe = (p) => {
      const P = p.pts && p.pts.length > 1 ? p.pts : [{ x: p.x0, y: p.y0 }, { x: p.x1, y: p.y1 }];
      const segs = [];
      for (let i = 0; i < P.length - 1; i++) {
        let ax = P[i].x, ay = P[i].y, bx = P[i + 1].x, by = P[i + 1].y;
        const dx = bx - ax;
        if (Math.abs(dx) > D.W / 2) bx += dx > 0 ? -D.W : D.W;
        segs.push({ ax, ay, bx, by, len: Math.hypot(bx - ax, by - ay) || 0.001 });
      }
      return segs;
    };
    const puntoEnTramos = (segs, d) => {
      let acc = 0;
      for (const s of segs) {
        if (d <= acc + s.len || s === segs[segs.length - 1]) {
          const k = Math.min(1, Math.max(0, (d - acc) / s.len));
          const mx = (s.ax + s.bx) / 2, my = Math.min(s.ay, s.by) - Math.abs(s.bx - s.ax) * 0.05 - 10;
          return { x: s.ax + (s.bx - s.ax) * k, y: s.ay + (s.by - s.ay) * k, mx, my };
        }
        acc += s.len;
      }
      const u = segs[segs.length - 1];
      return { x: u.bx, y: u.by, mx: (u.ax + u.bx) / 2, my: u.ay };
    };
    const traza = (p, k, color, dash) => {
      const segs = tramosDe(p);
      const total = segs.reduce((n, s) => n + s.len, 0);
      ctx.strokeStyle = color; ctx.lineWidth = 1.6 / cam.z;
      if (dash) { ctx.setLineDash([6 / cam.z, 6 / cam.z]); ctx.lineDashOffset = -t / 40 / cam.z; } else ctx.setLineDash([]);
      for (const s of segs) {
        const mx = (s.ax + s.bx) / 2, my = Math.min(s.ay, s.by) - Math.abs(s.bx - s.ax) * 0.05 - 10;
        ctx.beginPath(); ctx.moveTo(s.ax, s.ay);
        ctx.quadraticCurveTo(mx, my, s.bx, s.by);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      return puntoEnTramos(segs, k * total);
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

  // ── pure: la posición real de tu capitán en coordenadas de mundo ──
  // EXACTA a lo que dibuja el mapa: en tierra, isl.x + pos.x * r * 0.7 (y con *0.5);
  // en el mar, el barco interpolado sobre los pts del plan con el progreso real.
  ATM.posicionCapitan = function (sim) {
    const u = sim && sim.user;
    if (!u) return null;
    if (u.plan && u.plan.x1 != null) {
      const prog = clamp(((Number(sim.t) || 0) - (Number(u.plan.t0) || 0)) / Math.max(1, Number(u.plan.dur) || 1), 0, 1);
      const P = u.plan.pts && u.plan.pts.length > 1 ? u.plan.pts : [{ x: u.plan.x0 != null ? u.plan.x0 : u.plan.x1, y: u.plan.y0 != null ? u.plan.y0 : u.plan.y1 }, { x: u.plan.x1, y: u.plan.y1 }];
      if (!P[0] || P[0].x == null || !P[1] || P[1].x == null) return null;
      const lens = []; let total = 0;
      for (let i = 0; i < P.length - 1; i++) { const L = Math.hypot(P[i + 1].x - P[i].x, P[i + 1].y - P[i].y) || 0.001; lens.push(L); total += L; }
      let dd = prog * total;
      let wx = P[0].x, wy = P[0].y;
      for (let i = 0; i < lens.length; i++) {
        if (dd <= lens[i] || i === lens.length - 1) {
          const kk = clamp(dd / lens[i], 0, 1);
          wx = P[i].x + (P[i + 1].x - P[i].x) * kk;
          wy = P[i].y + (P[i + 1].y - P[i].y) * kk;
          break;
        }
        dd -= lens[i];
      }
      return { x: wx, y: wy, mar: true };
    }
    if (!u.isl || !G.D || !G.D.ISLA) return null;
    const isl = G.D.ISLA[u.isl];
    if (!isl) return null;
    return {
      x: isl.x + (Number(u.pos && u.pos.x) || 0) * isl.r * 0.7,
      y: isl.y + (Number(u.pos && u.pos.y) || 0) * isl.r * 0.5,
      mar: false
    };
  };

  // ── UBICAR A TU CAPITÁN: un tap en la brújula y el mar te lo señala ──
  // El amigo del capitán probó y no encontraba su avatar: la brújula mostraba el
  // mundo, pero no a VOS. Vuela a tu posición real (tierra o mar) y suelta un
  // ping 🎯 dorado sobre el sistema de testigos que ya existía.
  ATM.ubicarCapitan = function () {
    const sim = G.JUEGO && G.JUEGO.sim, MAPA = G.MAPA;
    if (!sim || !sim.user || !MAPA || !MAPA.volar || !MAPA.cam) return false;
    const pc = ATM.posicionCapitan(sim);
    if (!pc || !Number.isFinite(pc.x) || !Number.isFinite(pc.y)) return false;
    MAPA.volar(pc.x, pc.y, Math.max(MAPA.cam.z, pc.mar ? 1.6 : 2.3), 900);
    try { if (G.SONIDO) G.SONIDO.play('ping'); } catch (e) { /* un ping mudo no tumba nada */ }
    const ahora = performance.now();
    sim._pings = (sim._pings || []).filter((q) => ahora - q.t0 < 6500);
    sim._pings.push({ x: pc.x, y: pc.y, t0: ahora, key: 'capitan' });
    return true;
  };

  // ── minimapa-brújula: el mundo entero, tu posición, la tormenta, el rumbo ─
  function creaMini() {
    if (mini || !cvDe() || !cvDe().parentElement) return;
    mini = document.createElement('canvas');
    mini.id = 'mil-minimapa';
    mini.width = MINI_W * MINI_ESC; mini.height = MINI_H * MINI_ESC;
    mini.setAttribute('aria-label', 'Minimapa del mundo: haz clic para volar a ese punto');
    mini.title = 'Minimapa del MUNDO ENTERO · islas, tormentas y tu posición — clic para volar a ese punto';
    // rótulo permanente: el cuadrado se explica solo (nadie adivina qué es)
    const etiqueta = document.createElement('span');
    etiqueta.className = 'mil-minimapa-etiqueta';
    etiqueta.textContent = 'MUNDO';
    etiqueta.style.cssText = 'position:absolute;left:14px;bottom:16px;z-index:7;pointer-events:none;font:800 8px/1 system-ui,sans-serif;letter-spacing:.22em;color:rgba(244,193,26,.85);text-shadow:0 1px 3px rgba(0,0,0,.8);';
    cvDe().parentElement.appendChild(etiqueta);
    mini._etiqueta = etiqueta;
    mini.style.cssText = 'position:absolute;left:12px;bottom:12px;width:' + MINI_W + 'px;height:' + MINI_H +
      'px;z-index:6;border-radius:10px;cursor:pointer;transition:opacity .4s ease;box-shadow:0 10px 26px rgba(0,0,0,0.45);border:1px solid rgba(244,193,26,0.45);';
    mini.addEventListener('click', (e) => {
      const MAPA = G.MAPA, D = G.D;
      const r = mini.getBoundingClientRect();
      const wx = clamp((e.clientX - r.left) / (MINI_W / D.W), 0, D.W);
      const wy = clamp((e.clientY - r.top) / (MINI_H / D.H), 0, D.H);
      MAPA.volar(wx, wy, Math.max(MAPA.cam.z, 1.35), 750);
    });
    cvDe().parentElement.appendChild(mini);
    miniCtx = mini.getContext('2d');
    // EL TAP QUE SALVA: el botón vive sobre la brújula, siempre al alcance del pulgar
    const padreMini = cvDe().parentElement;
    if (!padreMini.querySelector('#mil-ubicar')) {
      const ubicar = document.createElement('button');
      ubicar.type = 'button';
      ubicar.id = 'mil-ubicar';
      ubicar.textContent = '🎯';
      // anclado a la GEOMETRÍA de la brújula (la misma esquina del minimapa):
      // position:absolute resuelve contra el contenedor del lienzo, no contra el mini
      ubicar.style.cssText = 'position:absolute;left:' + (12 + MINI_W - 18) + 'px;bottom:' + (12 + MINI_H - 18) + 'px;';
      ubicar.setAttribute('aria-label', 'Encontrar a tu capitán: vuela hasta él y lo señala con un ping dorado');
      ubicar.title = 'Encontrar a tu capitán (tecla L)';
      ubicar.addEventListener('click', (e) => { e.stopPropagation(); ATM.ubicarCapitan(); });
      padreMini.appendChild(ubicar);
    }
  }

  function pintaMini(sim, t, cam, D) {
    if (!miniCtx) return;
    if (mini) mini.style.opacity = cam.z > 2.6 ? '0.25' : '1'; // de cerca, el minimapa se aparta
    if (mini && mini._etiqueta) mini._etiqueta.style.opacity = cam.z > 2.6 ? '0' : '1';
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
    // los cuatro BLUE: el mismo mapa que el grande, de un vistazo
    for (const bl of [
      [0, 0, D.RL_X, D.GL_Y0, 'rgba(120,190,225,0.14)'],
      [D.RL_X, 0, D.W, D.GL_Y0, 'rgba(150,210,235,0.11)'],
      [0, D.GL_Y1, D.RL_X, D.H, 'rgba(62,84,142,0.16)'],
      [D.RL_X, D.GL_Y1, D.W, D.H, 'rgba(92,180,170,0.14)']
    ]) {
      mctx.fillStyle = bl[4];
      mctx.fillRect(ex + bl[0] * sx, ex + bl[1] * sy, (bl[2] - bl[0]) * sx, (bl[3] - bl[1]) * sy);
    }
    // la Muralla Roja (costura del mundo): cordillera roja canónica
    mctx.fillStyle = 'rgba(255,118,88,0.55)';
    mctx.fillRect(ex + (D.RL_X * sx) - 1, ex, 2.5, ih);
    // tormentas: puntos rojos vivos
    if (sim.storms) {
      for (const s of sim.storms) {
        mctx.fillStyle = 'rgba(255,96,60,0.9)';
        mctx.beginPath(); mctx.arc(ex + s.x * sx, ex + s.y * sy, 2.4, 0, 7); mctx.fill();
      }
    }
    // EL MUNDO VIVO EN LA BRÚJULA: ✦ donde hay evento, ⚔ donde hay frente —
    // ahora sabés dónde mirar sin abrir panel alguno
    const latidoMini = Math.sin(t / 260);
    if (sim.evento && sim.evento.isl && D.ISLA[sim.evento.isl]) {
      const iEv = D.ISLA[sim.evento.isl];
      mctx.fillStyle = 'rgba(255,214,120,' + (0.75 + latidoMini * 0.25) + ')';
      mctx.font = 'bold 9px system-ui, sans-serif';
      mctx.fillText('✦', ex + iEv.x * sx - 3, ex + iEv.y * sy + 3);
    }
    if (sim.guerra && sim.guerra.frentes) {
      for (const f of sim.guerra.frentes) {
        if (!f.isl || !D.ISLA[f.isl]) continue;
        const iF = D.ISLA[f.isl];
        mctx.fillStyle = 'rgba(255,110,80,' + (0.75 + latidoMini * 0.25) + ')';
        mctx.font = 'bold 9px system-ui, sans-serif';
        mctx.fillText('⚔', ex + iF.x * sx - 3.5, ex + iF.y * sy + 3);
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
    // TU CAPITÁN sobre la brújula: un punto vivo donde pisa (tierra o mar), no solo su isla
    const pc = ATM.posicionCapitan(sim);
    if (pc) {
      const qx = ex + pc.x * sx, qy = ex + pc.y * sy;
      const latido = 1.5 + Math.sin(t / 240) * 0.45;
      mctx.fillStyle = '#ffe97a';
      mctx.beginPath(); mctx.arc(qx, qy, latido, 0, 7); mctx.fill();
      mctx.strokeStyle = 'rgba(255,224,94,0.7)'; mctx.lineWidth = 1;
      mctx.beginPath(); mctx.arc(qx, qy, latido + 2.4 + Math.sin(t / 240 + 1.2) * 0.7, 0, 7); mctx.stroke();
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
      if (G.UI && G.UI.abrirIsla) G.UI.abrirIsla(null); // acercarse con doble clic no debe dejar el popover abierto encima
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
        case 'l': case 'L': ATM.ubicarCapitan(); e.preventDefault(); break;
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
