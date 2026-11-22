// Capa de gráficos mejorados para el mapa de Mil Almas / One-Latam.
// Carga sprites (assets/sprites/ o data-URIs en window.SPRITES) y redibuja el mundo con más detalle.
// Se activa sola tras cargar el mapa: si G.SPRITES o el path no existe, el mapa base sigue funcionando.
(function (G) {
  const D = G.D, U = G.U;
  const clamp = U.clamp, dist = U.dist;
  const GFX = (G.GFX = G.GFX || {});

  GFX.basePath = (typeof window !== 'undefined' && window.MIL_ALMAS_ASSETS) || 'assets/sprites/';

  GFX.imgs = {};
  GFX.cargado = false;
  GFX.cargar = function (cb) {
    if (G.SPRITES) {
      // SPRITES puede traer data-URIs (string) u Image ya listas: normalizamos a Image
      const noms = Object.keys(G.SPRITES);
      let faltan = noms.length;
      if (!faltan) { cb && cb(false); return; }
      noms.forEach(n => {
        const v = G.SPRITES[n];
        if (v && v.tagName === 'IMG') { GFX.imgs[n] = v; if (--faltan === 0) { GFX.cargado = true; cb && cb(true); } return; }
        const im = new Image();
        im.onload = () => { GFX.imgs[n] = im; if (--faltan === 0) { GFX.cargado = true; cb && cb(true); } };
        im.onerror = () => { if (--faltan === 0) cb && cb(false); };
        im.src = v;
      });
      return;
    }
    if (typeof window === 'undefined' || !window.Image) { cb && cb(false); return; }
    const noms = ['personajes', 'barcos', 'marcadores', 'nubes'];
    let faltan = noms.length;
    noms.forEach(n => {
      const im = new Image();
      im.onload = () => { GFX.imgs[n] = im; if (--faltan === 0) { GFX.cargado = true; cb && cb(true); } };
      im.onerror = () => { if (--faltan === 0) cb && cb(false); };
      im.src = GFX.basePath + n + '.png';
    });
  };

  // ── Ruido determinista para textura de islas (mismo resultado cada frame) ──
  function hash2(x, y) {
    let h = (x * 374761393 + y * 668265263) >>> 0;
    h = (h ^ (h >>> 13)) * 1274126177 >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ── Mejora de islas: textura, sombras, marcadores ──
  const MARCADORES = { palmera: 0, casa: 1, torre: 2, arbol: 3, roca: 4, calavera: 5 };
  GFX.pintaIslaMejorada = function (ctx, i, t, ox) {
    const T = D.TEMAS[i.tema] || D.TEMAS.verde;
    const pts = i._pts || G.MAPA.formaIslaPublica(i);
    const r = i.r;
    ox = ox || 0;
    // sombra al mar
    ctx.beginPath();
    ctx.ellipse(i.x + ox + 3, i.y + 4, r * 1.52, r * 1.24, 0, 0, 7);
    ctx.fillStyle = 'rgba(4,20,38,0.35)'; ctx.fill();
    // bajío
    ctx.beginPath();
    ctx.ellipse(i.x + ox, i.y, r * 1.5, r * 1.22, 0, 0, 7);
    ctx.fillStyle = 'rgba(120,195,225,0.32)'; ctx.fill();
    // arena con borde brillante
    ctx.beginPath();
    ctx.moveTo(i.x + ox + pts[0][0], i.y + pts[0][1]);
    for (const p of pts) ctx.lineTo(i.x + ox + p[0], i.y + p[1]);
    ctx.closePath();
    ctx.fillStyle = 'rgb(' + T.sand.join(',') + ')'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    // tierra con textura de ruido (grano determinista)
    ctx.save(); ctx.translate(i.x + ox, i.y); ctx.scale(0.8, 0.8); ctx.translate(-(i.x + ox), -i.y);
    ctx.beginPath();
    ctx.moveTo(i.x + ox + pts[0][0], i.y + pts[0][1]);
    for (const p of pts) ctx.lineTo(i.x + ox + p[0], i.y + p[1]);
    ctx.closePath();
    ctx.fillStyle = 'rgb(' + T.land.join(',') + ')'; ctx.fill();
    ctx.save(); ctx.clip();
    const paso = 2;
    for (let y = -r; y < r; y += paso) {
      for (let x = -r; x < r; x += paso) {
        const n = hash2(Math.floor((i.x + ox + x) * 3), Math.floor((i.y + y) * 3));
        if (n > 0.62) {
          ctx.fillStyle = 'rgba(' + T.land2.join(',') + ',0.55)';
          ctx.fillRect(i.x + ox + x, i.y + y, paso, paso);
        } else if (n < 0.12) {
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.fillRect(i.x + ox + x, i.y + y, paso, paso);
        }
      }
    }
    ctx.restore(); ctx.restore();
    // decoración con sprites si hay, si no la clásica
    if (!i.decoDib) {
      i.decoDib = [];
      const nn = Math.round(5 + T.trees * 10);
      for (let k = 0; k < nn; k++) {
        const a = (k / nn) * Math.PI * 2 + r;
        const rr = r * 0.55;
        i.decoDib.push({ x: Math.cos(a * 3.1) * rr * 0.7, y: Math.sin(a * 2.3) * rr * 0.5, t: k % 6 });
      }
    }
    const marc = GFX.imgs.marcadores;
    for (const d of i.decoDib) {
      const px = i.x + ox + d.x, py = i.y + d.y;
      if (marc) {
        ctx.drawImage(marc, d.t * 16, 0, 16, 16, px - 5, py - 7, 10, 10);
      } else {
        ctx.fillStyle = 'rgb(' + T.tree.join(',') + ')'; ctx.fillRect(px - 1, py - 4, 2, 6);
      }
    }
  };

  // ── Barcos con sprite rotado ──
  const FAC_IDX = { pir: 0, mar: 1, rev: 2, caz: 3 };
  GFX.pintaBarco = function (ctx, s, sim, t, x, y, ang) {
    const barcos = GFX.imgs.barcos;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(ang) * 10, y - Math.sin(ang) * 10);
    ctx.lineTo(x - Math.cos(ang) * 17, y - Math.sin(ang) * 17);
    ctx.stroke();
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2); // el sprite mira hacia arriba
    if (barcos) {
      const crew = sim.crews[s.crew];
      const fac = crew && sim.byId(crew.cap) ? sim.byId(crew.cap).fac : 'pir';
      const idx = FAC_IDX[fac] || 0;
      // sombra
      ctx.drawImage(barcos, idx * 24, 0, 24, 24, -12 + 1.5, -12 + 2, 24, 24);
      ctx.drawImage(barcos, idx * 24, 0, 24, 24, -12, -12, 24, 24);
    } else {
      ctx.fillStyle = '#6b4a2f'; ctx.fillRect(-5, -3, 10, 6);
    }
    ctx.restore();
  };

  // ── Agua animada (dos capas de olas suaves) ──
  GFX.pintaAgua = function (ctx, ancho, alto, t, cam, Wm, Hm) {
    // brillos de ola que se desplazan lentamente
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#cfe8f7';
    const sep = 34, vel = 12;
    const x0 = Math.floor((cam.x - ancho / (2 * cam.z)) / sep) * sep;
    const y0 = Math.floor((cam.y - alto / (2 * cam.z)) / sep) * sep;
    for (let y = y0; y < cam.y + alto / (2 * cam.z) + sep; y += sep) {
      for (let x = x0; x < cam.x + ancho / (2 * cam.z) + sep; x += sep) {
        const fase = Math.sin(t / 900 + x * 0.05 + y * 0.03);
        const dx = fase * vel;
        ctx.beginPath();
        ctx.moveTo(x + dx, y); ctx.lineTo(x + dx + 7, y);
        ctx.moveTo(x + dx - 3, y + 2); ctx.lineTo(x + dx + 2, y + 2);
        ctx.lineWidth = 1.2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      }
    }
    ctx.restore();
  };

  // ── Nubes con sprite ──
  GFX.pintaNubes = function (ctx, t, cam, ancho, alto, nubes) {
    const nub = GFX.imgs.nubes;
    for (const n of nubes) {
      n.x += n.v / 60; if (n.x > D.W + 60) n.x = -60;
      if (nub) {
        ctx.globalAlpha = 0.30;
        ctx.drawImage(nub, (n.x + D.W) % D.W - n.r, n.y - n.r * 0.5, n.r * 2.2, n.r * 1.1);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.11)';
        ctx.beginPath(); ctx.ellipse(n.x, n.y, n.r, n.r * 0.36, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(n.x + n.r * 0.55, n.y + n.r * 0.1, n.r * 0.6, n.r * 0.28, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(n.x - n.r * 0.5, n.y + n.r * 0.08, n.r * 0.48, n.r * 0.24, 0, 0, 7); ctx.fill();
      }
    }
  };

  // ── Viñeta y profundidad ──
  GFX.vineta = function (ctx, ancho, alto) {
    const g = ctx.createRadialGradient(ancho / 2, alto / 2, Math.min(ancho, alto) * 0.42, ancho / 2, alto / 2, Math.max(ancho, alto) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(2,8,16,0.5)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, ancho, alto);
  };

  // ── Retrato pixel de un agente (para popovers/ficha) ──
  GFX.retrato = function (agent, escala) {
    const per = GFX.imgs.personajes;
    if (!per || typeof document === 'undefined') return '';
    const es = escala || 4;
    const cv = document.createElement('canvas');
    cv.width = 16 * es; cv.height = 16 * es;
    cv.className = 'retrato-pixel';
    const c2 = cv.getContext('2d');
    c2.imageSmoothingEnabled = false;
    const col = (agent._spriteCol != null ? agent._spriteCol : (agent._spriteCol = Math.floor(Math.random() * 8)));
    const fila = 0;
    c2.drawImage(per, col * 16, fila * 16, 16, 16, 0, 0, 16 * es, 16 * es);
    return cv;
  };

  // ── Instalación: parchea MAPA.render una vez cargados los sprites ──
  GFX.instalar = function () {
    if (!G.MAPA || !G.MAPA.render) return false;
    const original = G.MAPA.render;
    G.MAPA.render = function (sim, t) {
      const cv = document.getElementById('mapa');
      if (!cv || !GFX.cargado) { return original(sim, t); }
      const ctx = cv.getContext('2d');
      const ancho = cv.clientWidth, alto = cv.clientHeight;
      const cam = G.MAPA.cam || { x: D.W / 2, y: D.H / 2, z: 1 };
      const M = G.MAPA;
      // vista globo: el mapa base se encarga de todo (esfera + espacio), sin capas mejoradas
      if (M.enGlobo && M.enGlobo()) return original(sim, t);
      // la lupa persigue su objetivo y el modo inmersión vigila el zoom TAMBIÉN aquí:
      // GFX sustituye el render del mar, así que estos dos relojes no pueden vivir solo en el original
      if (M.pasaZoomPublica) M.pasaZoomPublica(t);
      if (M.actualizaCinePublica) M.actualizaCinePublica();
      ctx.imageSmoothingEnabled = false; // pixel art nítido también en la capa GFX
      ctx.fillStyle = '#2161a7'; ctx.fillRect(0, 0, ancho, alto);
      // vista del mundo (para el culling: no pintar lo que no se ve)
      const vx0 = cam.x - ancho / (2 * cam.z), vx1 = cam.x + ancho / (2 * cam.z);
      const vy0 = cam.y - alto / (2 * cam.z), vy1 = cam.y + alto / (2 * cam.z);
      ctx.save();
      ctx.translate(ancho / 2, alto / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
      // capa base unificada (mar, franjas, muralla y rótulos) del mapa único — solo envolturas visibles
      for (const off of [-D.W, 0, D.W]) {
        if (off + D.W < vx0 - 40 || off > vx1 + 40) continue;
        ctx.drawImage(M.capaBase(), off, 0, D.W, D.H);
      }
      M.actualizaEventos(sim, t);
      GFX.pintaAgua(ctx, ancho, alto, t, cam, D.W, D.H);
      for (const s of sim.storms) {
        if (M.pintaTormenta) M.pintaTormenta(s, t);
        else {
          ctx.fillStyle = 'rgba(30,40,60,0.55)';
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
        }
      }
      // islas en PASADAS: reservas de diorama → blobs no tapados → dioramas encima.
      const visibles = [];
      for (const i of D.ISLAS) {
        if (i.oculta) continue;
        const mg = Math.max(190, i.r * 16);
        let entra = false;
        for (const off of [0, -D.W, D.W]) {
          const x = i.x + off;
          if (x + mg >= vx0 && x - mg <= vx1 && i.y + mg >= vy0 && i.y - mg <= vy1) { entra = true; break; }
        }
        if (entra) visibles.push(i);
      }
      const sel = M.selIslaPublica ? M.selIslaPublica() : null;
      visibles.sort((a, b) => {
        if (sel === a) return -1;
        if (sel === b) return 1;
        return (a.x - cam.x) * (a.x - cam.x) + (a.y - cam.y) * (a.y - cam.y)
          - ((b.x - cam.x) * (b.x - cam.x) + (b.y - cam.y) * (b.y - cam.y));
      });
      const mejorEnv = (i) => {
        const mg = Math.max(190, i.r * 16);
        let mejor = null, mejorD = 1e18;
        for (const off of [0, -D.W, D.W]) {
          const x = i.x + off;
          if (x + mg < vx0 || x - mg > vx1 || i.y + mg < vy0 || i.y - mg > vy1) continue;
          const d = (x - cam.x) * (x - cam.x) + (i.y - cam.y) * (i.y - cam.y);
          if (d < mejorD) { mejorD = d; mejor = off; }
        }
        return mejor;
      };
      const conDiorama = new Map();
      for (const i of visibles) {
        if (!M.usaDiorama(i)) continue;
        const off = mejorEnv(i);
        if (off === null) continue;
        if (M.reservaDiorama(i, off, t)) conDiorama.set(i.id, off);
      }
      const dibujadas = [];
      for (const i of visibles) {
        if (conDiorama.has(i.id)) continue;
        const off = mejorEnv(i);
        if (off === null) continue;
        const cx = i.x + off, cy = i.y;
        if (M.bajoDiorama(cx - i.r * 1.85, cy - i.r * 1.5, cx + i.r * 1.85, cy + i.r * 1.6, t)) continue;
        // UN SOLO MAPA: la misma isla detallada del mapa base (detalle cerca, vista media lejos)
        if (M.dibujaIslaPublica) M.dibujaIslaPublica(i, off, t);
        else { M.sombraIsla(i, off); M.pintaIslaVista(i, off, t); M.anilloIsla(i, off, t); if (M.marcasIsla) M.marcasIsla(ctx, i, t, off); }
        dibujadas.push([i, off]);
      }
      for (const [id, off] of conDiorama) {
        const i = D.ISLA[id];
        if (i && M.dibujaEscenaIsla) M.dibujaEscenaIsla(ctx, i, t, off);
      }
      // barcos con sprite (recalcula posición como el mapa base);
      // UN SOLO MAPA: los anclados también se ven a zoom cercano (no hay dioramas que los tapen)
      for (const s of sim.ships) {
        let x, y, ang;
        if (s.state === 'navegando' && s.plan) {
          const k = clamp((sim.t - s.plan.t0) / Math.max(1, s.plan.dur), 0, 1);
          const dx = s.plan.x1 - s.plan.x0;
          if (Math.abs(dx) > D.W / 2) {
            const sx = dx > 0 ? -D.W : D.W;
            x = ((s.plan.x0 + dx * k + sx + D.W) % D.W);
          } else x = s.plan.x0 + dx * k;
          y = s.plan.y0 + (s.plan.y1 - s.plan.y0) * k;
          ang = Math.atan2(s.plan.y1 - s.plan.y0, dx + (Math.abs(dx) > D.W / 2 ? (dx > 0 ? -D.W : D.W) : 0));
        } else {
          const isl = D.ISLA[s.isl]; if (!isl) continue;
          // anclado en el AGUA, fuera del bajío: nunca encima de la arena
          const lado = (s.id % 2) ? 1 : -1;
          x = isl.x + lado * (isl.r * 1.45 + 14) + Math.sin(t / 800 + s.id) * 3;
          y = isl.y + isl.r * 0.55 + 14;
          ang = lado > 0 ? 0 : Math.PI;
        }
        if (x < vx0 - 30 || x > vx1 + 30 || y < vy0 - 30 || y > vy1 + 30) continue; // culling de barcos
        if (M.bajoDiorama(x - 16, y - 16, x + 16, y + 16, t)) continue; // no cruzan por encima de una escena
        GFX.pintaBarco(ctx, s, sim, t, x, y + Math.sin(t / 700 + s.id * 1.7) * 0.9, ang);
      }
      // etiquetas al final: ningún barco las tapa y ninguna cae bajo un diorama
      for (const [i, off] of dibujadas) {
        if (!M.bajoDiorama(i.x + off - i.r - 6, i.y - i.r - 6, i.x + off + i.r + 30, i.y + i.r + 20, t)) M.etiquetaIsla(i, off);
      }
      GFX.pintaNubes(ctx, t, cam, ancho, alto, G.MAPA.nubes || []);
      // tu capitán: figura pixel a zoom cercano, cubo y anillo a lo lejos (misma función que el mapa base)
      if (M.avatarMundo) M.avatarMundo(sim, t);
      else {
        const u = sim.user;
        if (u && u.isl && !sim._fusionAtSea) {
          const isl = D.ISLA[u.isl];
          if (isl && !u.plan) {
            const px = isl.x + u.pos.x * isl.r * 0.7, py = isl.y + u.pos.y * isl.r * 0.5;
            if (M.cubo) M.cubo(px, py);
            ctx.strokeStyle = '#f6e05e'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(px, py - 5, 12 + Math.sin(t / 300) * 2, 0, 7); ctx.stroke();
          }
        }
      }
      ctx.restore();
    };
    GFX.instalado = true; // la atmósfera espera esta bandera para envolver el render AL FINAL
    return true;
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      GFX.cargar((ok) => { if (ok) GFX.instalar(); });
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
