// UI: portada viva, feed, wizard de creación, ficha/Tarjeta del Alma, susurros, ajustes.
// Los encuentros conectan el mundo vivo con la política del juego raíz (main.js).
import { islandEncountersFor } from '../island_encounters.js';
import { getMapIslands } from '../map.js';
(function (G) {
  const { esc, fmtBelis, hhmm, esNoche } = G.U;
  const D = G.D;
  const UI = (G.UI = G.UI || {});
  let sim = null; // lo inyecta main
  UI.setSim = function (s) { sim = s; };
  const $ = (id) => document.getElementById(id);

  // ── Utilidades DOM ──
  UI.el = function (html) {
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  };
  UI.textoCharla = function (linea) {
    // *insultos* en rojo
    return esc(linea).replace(/\*(.+?)\*/g, '<span class="insulto">*$1*</span>');
  };

  // ── Cabecera ──
  UI.renderHeader = function () {
    const almas = sim.agents.filter(a => a.state !== 'muerto' && a.state !== 'retirado').length;
    $('cab-almas').textContent = almas.toLocaleString('es');
    $('cab-reloj').textContent = 'Día ' + sim.dia() + ' · ' + hhmm(sim.minOfDay()) + (esNoche(sim.minOfDay()) ? ' 🌙' : '');
    // UN SOLO RELOJ en pantalla: el de la barra del mundo vivo (con su luna).
    // La marca del HUD RPG ya no repite día/hora — no hay dos motores de tiempo visibles.
    // Una sola luz: la atmósfera (noche/día) sigue al MISMO reloj que se pinta.
    // El HUD solo puede añadir "mist" (Franja de Calma); nunca un reloj distinto.
    const luz = esNoche(sim.minOfDay()) ? 'night' : 'day';
    if (document.body.dataset.atmosphere !== 'mist') document.body.dataset.atmosphere = luz;
  };

  // ── Feed ──
  let filtro = 'mimar'; // canon por defecto: tu feed narra TU mar, no el mundo entero
  let leidasHasta = -1; // último id de evento leído: lo que llegó después enciende el aviso rojo
  function sinLeer() {
    if (!sim) return 0;
    return sim.feed.filter((e) => e.i > leidasHasta).length;
  }
  function pintaBadges() {
    const n = sinLeer();
    const marca = (el, clase) => {
      let b = el.querySelector('.' + clase);
      if (n <= 0) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('span'); b.className = clase; el.append(b); }
      b.textContent = n > 9 ? '9+' : String(n);
    };
    document.querySelectorAll('#bottom-nav [data-hud-panel="news"]').forEach((el) => {
      marca(el, 'mil-badge');
      if (n > 0) {
        el.setAttribute('aria-label', `Bitácora: ${n} avisos sin leer`);
        el.title = `${n} avisos del mundo sin leer`;
      }
    });
    // el teleportador también grita: el ítem del menú y el propio orbe
    const itemMenu = document.querySelector('[data-mil-accion="bitacora"]');
    if (itemMenu) marca(itemMenu, 'mil-badge');
    const globo = document.getElementById('mil-globo');
    if (globo) {
      marca(globo, 'mil-badge-globo');
      globo.title = n > 0 ? `${n} avisos del mundo sin leer` : 'Menú del mundo vivo';
    }
  }
  // el mundo no duerme: el orbe y el teleportador se revisan en cada respiro
  setInterval(() => pintaBadges(), 4000);
  UI.marcarLeidas = function () {
    if (sim && sim.feed.length) leidasHasta = sim.feed[sim.feed.length - 1].i;
    pintaBadges();
  };
  UI.setFiltro = function (f) { filtro = f; UI.renderFeed(true); };
  UI.renderFeed = function (soloNuevos) {
    const caja = $('feed');
    if (!caja) return;
    let lista = sim.feed.slice(-120).reverse();
    const usuario = sim.user;
    const marDelUsuario = usuario && D.ISLA[usuario.isl] ? D.ISLA[usuario.isl].reg : null;
    if (filtro === 'mimar') lista = marDelUsuario ? lista.filter(e => e.reg === marDelUsuario || !e.reg || (usuario && e.ids.includes(usuario.id))) : lista;
    if (filtro === 'importante') lista = lista.filter(e => e.imp >= 4);
    if (filtro === 'mio') lista = lista.filter(e => usuario && e.ids.includes(usuario.id));
    const html = lista.map(e => {
      const cls = e.imp >= 6 ? 'imp-alta' : e.imp >= 4 ? 'imp-media' : '';
      const marca = e.imp >= 4 ? '★' : '·';
      const mar = e.reg && D.NOMBRE_MAR[e.reg] ? D.NOMBRE_MAR[e.reg] : '';
      const tag = mar ? '<span class="fmar">' + esc(mar) + '</span>' : '';
      return '<div class="fe ' + cls + '"><span class="fh">' + 'D' + Math.floor(e.t / 1440) + ' ' + hhmm(e.t % 1440) + '</span><span class="fi">' + marca + '</span>' + tag + ' ' + esc(e.txt) + '</div>';
    }).join('');
    caja.innerHTML = html || '<div class="fe vacio">Silencio en el mar…</div>';
    const abierta = !($('mil-feed-drawer')?.classList.contains('oculto'));
    if (abierta) UI.marcarLeidas(); else pintaBadges();
  };

  // ── Popover de isla ──
  // Parte ESTÁTICA (título, región, encuentros, viaje): solo al abrir o cambiar de isla.
  let islaAbierta = null; // la isla cuyo popover está abierto
  UI.abrirIsla = function (i) {
    const pop = $('pop-isla');
    if (!i) { pop.classList.add('oculto'); islaAbierta = null; return; }
    pop.classList.remove('oculto');
    const cambio = !islaAbierta || islaAbierta.id !== i.id;
    islaAbierta = i;
    if (cambio) {
      $('pi-titulo').textContent = i.n;
      $('pi-region').textContent = (D.REGIONS[i.reg] ? D.REGIONS[i.reg].name : i.reg === 'RL' ? 'Línea Roja' : i.reg === 'CB' ? 'Franja de Calma' : 'Bajo el Mar') +
        (i.noNav ? ' · aguas sin viento (no navegable)' : '') + (i.oculta ? ' · Isla oculta' : '');
      // encuentros jugables: crisis narrativa, tributo, sabotaje, comitiva noble
      const pe = $('pi-encuentros');
      if (pe) {
        pe.innerHTML = '';
        const car = window.ONE_LATAM && window.ONE_LATAM.getCharacter && window.ONE_LATAM.getCharacter();
        // el puente real es juegoId (datos_mundo lo asigna a toda isla enlazada)
        const islRaiz = car && getMapIslands(car).find(x => x.id === i.juegoId || x.name === i.n);
        const tarjetas = islRaiz ? islandEncountersFor(islRaiz, car) : [];
        if (car && !islRaiz) {
          pe.innerHTML = '<div class="mil-encuentro vacio"><small>Isla fuera del mapa canónico: la política jugable ocurre en las 28 islas del atlas antiguo.</small></div>';
        }
        tarjetas.forEach(t => {
          const card = document.createElement('div');
          card.className = 'mil-encuentro';
          card.innerHTML = '<b>' + esc(t.title) + '</b><p>' + esc(t.description) + '</p>' + (t.warning ? '<small>' + esc(t.warning) + '</small>' : '');
          (t.actions || []).forEach(act => {
            const btn = document.createElement('button');
            btn.type = 'button'; btn.textContent = act.label;
            btn.addEventListener('click', () => {
              document.dispatchEvent(new CustomEvent('mil-encuentro', { detail: { action: t.action, choice: act.choice } }));
              setTimeout(() => UI.abrirIsla(i), 300);
            });
            card.appendChild(btn);
          });
          if (t.buttonLabel) {
            const btn = document.createElement('button');
            btn.type = 'button'; btn.textContent = t.buttonLabel;
            btn.addEventListener('click', () => {
              document.dispatchEvent(new CustomEvent('mil-encuentro', { detail: { action: t.action } }));
              setTimeout(() => UI.abrirIsla(i), 300);
            });
            card.appendChild(btn);
          }
          pe.appendChild(card);
        });
      }
      const viajar = $('pi-viajar');
      if (viajar) {
        viajar.classList.toggle('oculto', !i.juego);
        viajar.disabled = true;
        viajar.title = 'Viaje directo pendiente: seleccionar un destino solo permite sugerir un rumbo, no zarpar.';
      }
    }
    UI.pintaPopDinamico(i);
  };

  // Parte VIVA (presentes, noticias, control, charlas): barata de refrescar cada tick,
  // sin reconstruir tarjetas ni listeners (antes se re-creaba TODO el popover ~1,2 s).
  UI.pintaPopDinamico = function (i) {
    const presentes = sim.popOf(i.id).filter(a => a.state === 'libre');
    const news = sim.feed.filter(e => e.txt.includes(i.n)).slice(-6).reverse();
    const disc = sim.descubiertas[i.id];
    $('pi-presentes').innerHTML = presentes.length
      ? presentes.slice(0, 10).map(a => {
        const ch = sim.charlaDe(a.id);
        const act = ch ? '<i>charlando</i>' : esc(a.act || a.state);
        return '<div class="pre">' + esc(sim.nm(a)) + ' <small>' + act + '</small></div>';
      }).join('') : '<div class="pre vacio">No hay nadie ahora mismo.</div>';
    // retratos pixel (capa GFX si cargó)
    if (G.GFX && G.GFX.cargado && G.GFX.imgs.personajes) {
      const filas = $('pi-presentes').querySelectorAll('.pre');
      presentes.slice(0, 10).forEach((a, k) => {
        const retr = G.GFX.retrato(a, 3);
        if (retr && filas[k]) { filas[k].prepend(retr); filas[k].classList.add('con-retrato'); }
      });
    }
    $('pi-news').innerHTML = news.length ? news.map(e => '<div class="pn">' + esc(e.txt) + '</div>').join('') : '<div class="pn vacio">Tranquilidad absoluta.</div>';
    $('pi-disc').textContent = disc ? 'Descubierta por ' + esc(sim.nm(sim.byId(disc))) : 'Nadie ha pisado esta isla todavía';
    // control político: ley / tirano / libre (la cadena raza→opresión→revuelta vive aquí)
    const ctrl = sim.control && sim.control[i.id];
    $('pi-control').innerHTML = ctrl ? '<span class="mil-ctrl c-' + ctrl + '">' + (ctrl === 'ley' ? '⚖ Bajo la ley de la Marina' : ctrl === 'tirano' ? '⛓ Gobernador tirano · el tributo sangra' : '🕊 Libre') + '</span>' : '';
    UI.renderBurbujas(i);
  };
  // El reloj de la simulación llama esto cada tick: solo refresca si el popover está abierto.
  UI.tickIsla = function () {
    if (islaAbierta && !$('pop-isla').classList.contains('oculto')) UI.pintaPopDinamico(islaAbierta);
  };

  UI.renderBurbujas = function (i) {
    const caja = $('pi-charlas');
    if (!caja) return;
    const activa = (sim.charlasActivas || []).filter(c => c.isl === i.id && sim.t < c.t1);
    let html = '';
    for (const c of activa) {
      const A = sim.byId(c.A), B = sim.byId(c.B);
      if (!A || !B) continue;
      const idx = Math.min(c.guion.l.length - 1, Math.floor((sim.t - c.t0) / 7));
      const lin = c.guion.l[idx];
      if (!lin) continue;
      const quien = lin[0] === 'A' ? A : B;
      html += '<div class="bubble"><b>' + esc(quien.name) + ':</b> ' + UI.textoCharla(lin[1]) + '</div>';
    }
    caja.innerHTML = html;
  };

  // ── Ficha del jugador (Tarjeta del Alma + susurros) ──
  UI.abrirFicha = function () {
    const a = sim.user;
    if (!a) { UI.toast('Tu alma aún no existe: creala desde la portada.'); return; }
    $('ficha').classList.remove('oculto');
    const S = D.SUEÑOS.find(s => s.k === a.sueno);
    $('ft-nombre').textContent = a.name;
    $('ft-epi').textContent = a.epi ? '«' + a.epi + '»' : 'sin apodo todavía';
    $('ft-fac').textContent = D.FACCIONES[a.fac].n + ' · ' + D.RANGOS[a.fac][Math.min(a.rank, D.RANGOS[a.fac].length - 1)];
    const rz = (D.RAZAS_SIM[a.raza] || D.RAZAS_SIM.human).n;
    $('ft-raza').textContent = rz + (D.OPRIMIDAS.includes(a.raza) ? ' · raza perseguida: la Marina te mira de más' : ' · raza sin tributo de sangre');
    $('ft-sueno').textContent = S ? S.n : '';
    $('ft-frase').textContent = S ? '«' + S.cita + '»' : '';
    $('ft-nivel').textContent = 'Nivel ' + a.level + ' · ' + a.xp + '/' + G.Sim.XP_NEED(a.level) + ' XP';
    $('ft-stats').innerHTML = D.STATS.map(k => '<span><b>' + D.STAT_N[k] + '</b> ' + a.stats[k] + '</span>').join('');
    $('ft-belis').textContent = fmtBelis(a.berries) + ' Belis';
    $('ft-cartel').innerHTML = a.bounty > 0 ? 'Cartel: <b class="oro">' + fmtBelis(a.bounty) + '</b>' : 'Sin cartel. Todavía.';
    $('ft-animo').textContent = 'Ánimo: ' + (a.anim || 'Tranquilo') + ' · HP ' + a.hp + ' · ' + (a.state === 'libre' ? (a.act || 'Libre') : a.state);
    $('ft-fruta').innerHTML = a.fruta ? 'Fruta: <b>' + (D.FRUTAS.find(f => f.k === a.fruta) || {}).n + '</b> (maestría ' + a.maestria + ')' : 'Sin Fruta del Diablo';
    const rasgosTxt = D.EJES.map(e => e.polos[a.rasgos[e.k]].n).join(' · ');
    $('ft-rasgos').textContent = rasgosTxt;
    $('ft-cofre').innerHTML = (a.cofre || []).length
      ? a.cofre.slice(-8).reverse().map(o => '<div class="obj"><span class="rar r-' + o.r + '">' + o.n + '</span> <small>' + esc(o.d || '') + '</small></div>').join('')
      : '<div class="obj vacio">Cofre vacío. A explorar.</div>';
    const insig = Object.keys(a.insignias || {}).filter(k => D.INSIGNIAS[k]);
    $('ft-insignias').innerHTML = insig.length
      ? insig.slice(-6).map(k => '<span class="ins ' + D.INSIGNIAS[k].r + '" title="' + esc(D.INSIGNIAS[k].d) + '">' + D.INSIGNIAS[k].n + '</span>').join('')
      : '<small>Sin insignias aún.</small>';
    UI.renderSusurros();
  };
  UI.cerrarFicha = function () { $('ficha').classList.add('oculto'); };

  // ── Atlas del Alma: islas pisadas, momentos y los Cuatro Cubos Rojos ──
  UI.abrirAtlas = function () {
    const a = sim.user;
    if (!a) { UI.toast('Tu alma aún no existe: creala desde la portada.'); return; }
    $('atlas').classList.remove('oculto');
    const total = D.ISLAS.filter(i => !i.oculta && !i.noNav && i.reg !== 'RL' && i.reg !== 'BM').length;
    const pisadas = Object.keys(a.atlas || {});
    const pct = Math.min(100, Math.round(pisadas.length * 100 / Math.max(1, total)));
    $('at-progreso').innerHTML = '<b>' + pisadas.length + '</b> de ' + total + ' islas cartografiadas (' + pct + '%)';
    $('at-barra').style.width = pct + '%';
    // momentos: los grandes sucesos de TU alma (hemeroteca filtrada por id)
    const mos = (sim.archive || []).filter(r => r.ids && r.ids.includes(a.id)).slice(-12).reverse();
    $('at-momentos').innerHTML = mos.length
      ? mos.map(r => '<div class="obj"><small>Día ' + Math.ceil(r.t / 1440) + '</small> ' + esc(r.txt) + '</div>').join('')
      : '<div class="obj vacio">Tu historia apenas empieza: zarpa, explora, pelea.</div>';
    // islas visitadas
    $('at-islas').innerHTML = pisadas.length
      ? pisadas.map(id => {
          const isl = D.ISLA[id]; if (!isl) return '';
          const d = a.atlas[id];
          const mar = D.REGIONS[isl.reg] ? D.REGIONS[isl.reg].name : isl.reg;
          return '<div class="at-isla"><b>' + esc(isl.n) + '</b><small>' + esc(mar) + ' · ' + d.n + (d.n === 1 ? ' visita' : ' visitas') + '</small></div>';
        }).join('')
      : '<div class="obj vacio">Sin islas aún. El mar espera.</div>';
    // los Cuatro Cubos Rojos
    const cubos = sim.cubos || {};
    $('at-cubos').innerHTML = Object.keys(cubos).map(id => {
      const c = cubos[id], isl = D.ISLA[id]; if (!isl) return '';
      const estado = c.hallado ? (c.esMio ? 'hallado por ti' : 'hallado por ' + esc(c.por || 'otros'))
                               : (c.pistas ? c.pistas + (c.pistas === 1 ? ' pista' : ' pistas') : 'sin pistas');
      return '<div class="at-cubo' + (c.hallado ? ' hallado' : '') + '"><span class="cubo-g"></span><div><b>' + esc(isl.n) + '</b><small>' + estado + '</small>' +
        (c.pista && !c.hallado ? '<em>«' + esc(c.pista) + '»</em>' : '') + '</div></div>';
    }).join('');
    $('at-cubos-nota').textContent = sim.cubosFin
      ? 'Los cuatro Cubos Rojos fueron hallados. La isla final abre sus puertas: una era nueva corre el mar.'
      : 'Cuatro Cubos Rojos duermen en el Nuevo Mundo. Las tabernas susurran pistas; quien reúna los cuatro escribe la próxima era.';
    // Cubos Azules: cada uno leído convierte las pistas poéticas en coordenadas exactas
    const azules = sim.cubosAzules || {};
    const nAzules = Object.keys(azules).filter(k => azules[k].hallado).length;
    $('at-azules').innerHTML = Object.keys(azules).map(id => {
      const c = azules[id], isl = D.ISLA[id]; if (!isl) return '';
      const estado = c.hallado ? (c.esMio ? 'revelado por ti' : 'revelado por ' + esc(c.por || 'otros')) : 'sin revelar';
      return '<div class="at-cubo azul' + (c.hallado ? ' hallado' : '') + '"><span class="cubo-g"></span><div><b>' + esc(isl.n) + '</b><small>' + estado + '</small></div></div>';
    }).join('') + '<p class="mil-muted">' + (nAzules >= 1 ? nAzules + '/3 leídos: tus pistas de Cubos Rojos señalan islas exactas.' : 'Revela uno y las tabernas dejarán de hablar en acertijos.') + '</p>';
    // Cubo Dorado: solo existe tras los cuatro rojos; corona al que lo levanta
    const dor = sim.cuboDorado || { hallado: false, esMio: false, por: null };
    $('at-dorado').innerHTML = '<div class="at-cubo dorado' + (dor.hallado ? ' hallado' : '') + '"><span class="cubo-g"></span><div><b>Isla JAJAJA</b><small>' +
      (dor.hallado ? (dor.esMio ? 'el Cubo Dorado es TUYO: Rey de los Piratas' : 'levantado por ' + esc(dor.por || 'otro')) : (sim.cubosFin ? 'la ruta final está abierta. Nadie ha coronado aún.' : 'sellado: los cuatro Cubos Rojos guardan su ruta')) + '</small></div></div>';
  };
  UI.cerrarAtlas = function () { $('atlas').classList.add('oculto'); };

  UI.renderSusurros = function () {
    const a = sim.user; if (!a) return;
    $('ft-susurros').innerHTML = D.SUSURROS.map(s => {
      const p = sim.probObediencia(a, s.k);
      return '<button class="sus" data-k="' + s.k + '">' + esc(s.n) + ' <small>' + Math.round(p * 100) + '%</small></button>';
    }).join('');
    $('ft-susurros').querySelectorAll('button.sus').forEach(b => {
      b.addEventListener('click', () => {
        const r = sim.doWhisper(a, b.dataset.k);
        UI.toast(r.reinterpret ? 'Reinterpreta tu consejo a su manera…' : r.obe ? 'Te ha hecho caso.' : 'No te ha hecho caso.');
        UI.renderSusurros();
        UI.abrirFicha();
      });
    });
  };

  UI.toast = function (txt) {
    const t = $('toast');
    t.textContent = txt; t.classList.remove('oculto');
    clearTimeout(t._to); t._to = setTimeout(() => t.classList.add('oculto'), 2600);
  };


  // ── Periódico (hemeroteca) ──
  UI.abrirPeriodico = function () {
    $('periodico').classList.remove('oculto');
    const lista = sim.archive.slice(-60).reverse();
    $('per-cuerpo').innerHTML = lista.map(e => '<div class="fe imp-media"><span class="fh">D' + Math.floor(e.t / 1440) + '</span> ' + esc(e.txt) + '</div>').join('') || '<p>Nada importante aún.</p>';
  };
  UI.cerrarPeriodico = function () { $('periodico').classList.add('oculto'); };

  // ── Ajustes ──
  UI.abrirAjustes = function () {
    $('ajustes').classList.remove('oculto');
  };
  UI.cerrarAjustes = function () { $('ajustes').classList.add('oculto'); };
  // ═══ CONTENIDO DEL MUNDO DENTRO DEL PANEL DEL HUD ═══
  // El mundo deja de tener paneles flotantes propios: estos renderizadores
  // escriben en una <section> que el HUD le pasa. Una puerta, un destino,
  // un diseño. (Los modales antiguos siguen existiendo pero ya no se abren.)
  const seccion = (caja, titulo) => {
    const h = document.createElement('h3');
    h.textContent = titulo; h.style.cssText = 'margin:2px 0 8px';
    caja.append(h);
  };
  const fila = (caja, b, s2) => caja.insertAdjacentHTML('beforeend', '<p class="one-hud-muted" style="margin:2px 0">' + esc(b) + (s2 ? ' <small>' + esc(s2) + '</small>' : '') + '</p>');
  const accion = (caja, txt, fn) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'one-hud-action'; b.textContent = txt;
    b.addEventListener('click', fn); caja.append(b);
    return b;
  };

  // ── Última hora: el feed del mar vivo, con sus filtros canónicos ──
  UI.pintaFeedEn = function (caja) {
    seccion(caja, '🐌 Última hora del mar');
    if (!sim || !sim.user) { fila(caja, 'El mundo aún no despierta.'); return; }
    const usuario = sim.user;
    const marDelUsuario = D.ISLA[usuario.isl] ? D.ISLA[usuario.isl].reg : null;
    let lista = sim.feed.slice(-40).reverse();
    if (filtro === 'mimar') lista = marDelUsuario ? lista.filter(e => e.reg === marDelUsuario || !e.reg || e.ids.includes(usuario.id)) : lista;
    if (filtro === 'importante') lista = lista.filter(e => e.imp >= 4);
    if (filtro === 'mio') lista = lista.filter(e => e.ids.includes(usuario.id));
    const chips = document.createElement('div');
    chips.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px';
    [['mimar', 'Mi mar'], ['importante', 'Lo importante'], ['mio', 'Lo mío']].forEach(([k, n]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'filtro' + (filtro === k ? ' sel' : ''); b.dataset.f = k; b.textContent = n;
      b.addEventListener('click', () => { UI.setFiltro(k); });
      chips.append(b);
    });
    caja.append(chips);
    const html = lista.map(e => {
      const cls = e.imp >= 6 ? 'imp-alta' : e.imp >= 4 ? 'imp-media' : '';
      const mar = e.reg && D.NOMBRE_MAR[e.reg] ? '<span class="fmar">' + esc(D.NOMBRE_MAR[e.reg]) + '</span>' : '';
      return '<div class="fe ' + cls + '"><span class="fh">D' + Math.floor(e.t / 1440) + ' ' + hhmm(e.t % 1440) + '</span> ' + mar + esc(e.txt) + '</div>';
    }).join('');
    caja.insertAdjacentHTML('beforeend', html || '<p class="one-hud-muted">Silencio en el mar…</p>');
    UI.marcarLeidas();
  };

  // ── Hemeroteca: todo lo que el mundo vivió ──
  UI.pintaHemerotecaEn = function (caja) {
    seccion(caja, '📰 Hemeroteca');
    if (!sim) { fila(caja, 'El mundo aún no despierta.'); return; }
    const lista = sim.archive.slice(-30).reverse();
    caja.insertAdjacentHTML('beforeend', lista.length
      ? lista.map(e => '<div class="fe imp-media"><span class="fh">D' + Math.floor(e.t / 1440) + '</span> ' + esc(e.txt) + '</div>').join('')
      : '<p class="one-hud-muted">Nada importante aún.</p>');
  };

  // ── Tu alma en el mundo: la ficha viva, dentro del panel Alma del HUD ──
  UI.pintaFichaEn = function (caja) {
    seccion(caja, '👤 Tu alma en el mundo');
    const a = sim && sim.user;
    if (!a) { fila(caja, 'Tu alma aún no existe: creala desde la portada.'); return; }
    const S = D.SUEÑOS.find(x => x.k === a.sueno);
    const rz = (D.RAZAS_SIM[a.raza] || D.RAZAS_SIM.human).n;
    caja.insertAdjacentHTML('beforeend',
      '<div class="one-hud-stats">' +
      '<div><strong>' + esc(a.name) + '</strong><span class="one-hud-muted">' + esc(a.epi ? '«' + a.epi + '»' : 'sin apodo todavía') + '</span></div>' +
      '<div><strong>' + esc(D.FACCIONES[a.fac].n) + '</strong><span>' + esc(D.RANGOS[a.fac][Math.min(a.rank, D.RANGOS[a.fac].length - 1)]) + '</span></div>' +
      '<div><strong>' + esc(rz) + '</strong><span>' + (D.OPRIMIDAS.includes(a.raza) ? 'raza perseguida' : 'raza sin tributo') + '</span></div>' +
      '<div><strong>Nivel ' + a.level + '</strong><span>' + a.xp + '/' + G.Sim.XP_NEED(a.level) + ' XP · ' + esc(D.SUEÑOS.find(x => x.k === a.sueno) ? S.n : '') + '</span></div>' +
      '</div>');
    caja.insertAdjacentHTML('beforeend', '<p class="soul-motto">«' + esc(S ? S.cita : '') + '»</p>');
    fila(caja, fmtBelis(a.berries) + ' Belis' + (a.bounty > 0 ? ' · Cartel: ' + fmtBelis(a.bounty) : ' · Sin cartel. Todavía.'), 'HP ' + a.hp + ' · ' + (a.state === 'libre' ? (a.act || 'Libre') : a.state));
    if (a.fruta) { const F = D.FRUTAS.find(f => f.k === a.fruta); fila(caja, 'Fruta: ' + (F ? F.n : '?'), 'maestría ' + a.maestria); }
    const cofre = (a.cofre || []).slice(-5).reverse();
    if (cofre.length) {
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:6px 0';
      cofre.forEach(o => { const sp = document.createElement('span'); sp.className = 'rar r-' + o.r; sp.textContent = o.n; sp.title = o.d || ''; div.append(sp); });
      caja.append(div);
    } else fila(caja, 'Cofre vacío. A explorar.');
    // susurros: tu voluntad contra su carácter
    const sus = document.createElement('div');
    sus.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:8px 0';
    D.SUSURROS.forEach(x => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'one-hud-action';
      b.textContent = x.n + ' ' + Math.round(sim.probObediencia(a, x.k) * 100) + '%';
      b.addEventListener('click', () => {
        const r = sim.doWhisper(a, x.k);
        UI.toast(r.reinterpret ? 'Reinterpreta tu consejo a su manera…' : r.obe ? 'Te ha hecho caso.' : 'No te ha hecho caso.');
        b.textContent = x.n + ' ' + Math.round(sim.probObediencia(a, x.k) * 100) + '%';
      });
      sus.append(b);
    });
    caja.append(sus);
  };

  // ── Atlas del Alma: progreso, momentos, Cubos ──
  UI.pintaAtlasEn = function (caja) {
    seccion(caja, '🗺️ Atlas del Alma');
    const a = sim && sim.user;
    if (!a) { fila(caja, 'Tu alma aún no existe.'); return; }
    const total = D.ISLAS.filter(i => !i.oculta && !i.noNav && i.reg !== 'RL' && i.reg !== 'BM').length;
    const pisadas = Object.keys(a.atlas || {});
    const pct = Math.min(100, Math.round(pisadas.length * 100 / Math.max(1, total)));
    caja.insertAdjacentHTML('beforeend',
      '<p><b>' + pisadas.length + '</b> de ' + total + ' islas cartografiadas (' + pct + '%)</p>' +
      '<progress max="100" value="' + pct + '" style="width:100%"></progress>');
    const mos = (sim.archive || []).filter(r => r.ids && r.ids.includes(a.id)).slice(-6).reverse();
    caja.insertAdjacentHTML('beforeend', '<h4 style="margin:10px 0 4px">Momentos</h4>' +
      (mos.length ? mos.map(r => '<p class="one-hud-muted" style="margin:2px 0"><small>Día ' + Math.ceil(r.t / 1440) + '</small> ' + esc(r.txt) + '</p>').join('') : '<p class="one-hud-muted">Tu historia apenas empieza: zarpa, explora, pelea.</p>'));
    // los Cuatro Cubos Rojos
    const cubos = sim.cubos || {};
    if (Object.keys(cubos).length) {
      caja.insertAdjacentHTML('beforeend', '<h4 style="margin:10px 0 4px">Cuatro Cubos Rojos</h4>');
      Object.keys(cubos).forEach(id => {
        const c = cubos[id], isl = D.ISLA[id]; if (!isl) return;
        const estado = c.hallado ? (c.esMio ? 'hallado por ti' : 'hallado por ' + esc(c.por || 'otros')) : (c.pistas ? c.pistas + ' pista(s)' : 'sin pistas');
        fila(caja, isl.n, estado + (c.pista && !c.hallado ? ' · «' + esc(c.pista) + '»' : ''));
      });
      fila(caja, sim.cubosFin ? 'La ruta final está abierta.' : 'Las tabernas susurran pistas; quien reúna los cuatro escribe la próxima era.');
    }
  };

  // ── Sistema del mundo: ritmo, sonido, guardado — dentro del panel Mundo ──
  UI.pintaAjustesEn = function (caja) {
    seccion(caja, '⚙️ Sistema del mundo');
    const J = window.JUEGO || {};
    const fil = document.createElement('div');
    fil.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:8px 0';
    fila(caja, 'Ritmo del mundo:');
    [1, 2, 4].forEach(r => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'one-hud-action' + (J.ritmo === r ? '' : '');
      b.textContent = '×' + r;
      b.addEventListener('click', () => { J.ritmo = r; UI.toast('Ritmo ×' + r); });
      fil.append(b);
    });
    caja.append(fil);
    if (window.SFX) {
      const bS = accion(caja, window.SFX.silencio() ? '🔇 Sonido pentatónico: apagado' : '🔊 Sonido pentatónico: encendido', () => {
        window.SFX.toggle();
        bS.textContent = window.SFX.silencio() ? '🔇 Sonido pentatónico: apagado' : '🔊 Sonido pentatónico: encendido';
      });
    }
    if (window.MARSON) {
      const bM = accion(caja, window.MARSON.activo ? '🔊 Mar sonoro: encendido' : '🔇 Mar sonoro: apagado', () => {
        window.MARSON.alternar();
        bM.textContent = window.MARSON.activo ? '🔊 Mar sonoro: encendido' : '🔇 Mar sonoro: apagado';
      });
    }
    accion(caja, '💾 Guardar el mundo', () => J.guardar && J.guardar(false));
    accion(caja, '⬇️ Exportar partida', () => {
      if (!J.guardar) return;
      J.guardar(true);
      try {
        const raw = localStorage.getItem('mp-latam-save-v1');
        const blob = new Blob([raw || '{}'], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'mundo-pirata-' + Date.now() + '.json';
        a.click();
      } catch (e) { UI.toast('No se pudo exportar.'); }
    });
    accion(caja, '🗑️ Empezar un mundo nuevo', () => {
      if (confirm('¿Empezar un mundo nuevo? Se borra la partida actual.')) { if (J.borrar) J.borrar(); location.reload(); }
    });
    fila(caja, 'El Panel GM y los Ajustes del Sistema raíz siguen en el engranaje ⚙️ de la cabecera.');
  };
})(typeof window !== 'undefined' ? window : globalThis);
