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
    // Un solo reloj: el HUD superior refleja el mismo tiempo del mundo vivo.
    const hudDia = document.querySelector('[data-hud-day]');
    if (hudDia) hudDia.textContent = 'Día ' + sim.dia() + ' · ' + hhmm(sim.minOfDay()) + ' · 1:4';
    // Una sola luz: la atmósfera (noche/día) sigue al MISMO reloj que se pinta.
    // El HUD solo puede añadir "mist" (Franja de Calma); nunca un reloj distinto.
    const luz = esNoche(sim.minOfDay()) ? 'night' : 'day';
    if (document.body.dataset.atmosphere !== 'mist') document.body.dataset.atmosphere = luz;
  };

  // ── Feed ──
  let filtro = 'todo';
  let leidasHasta = -1; // último id de evento leído: lo que llegó después enciende el aviso rojo
  function sinLeer() {
    if (!sim) return 0;
    return sim.feed.filter((e) => e.i > leidasHasta).length;
  }
  function pintaBadges() {
    const n = sinLeer();
    document.querySelectorAll('.mil-feed-toggle, #bottom-nav [data-hud-panel="news"]').forEach((el) => {
      let b = el.querySelector('.mil-badge');
      if (n <= 0) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('span'); b.className = 'mil-badge'; el.append(b); }
      b.textContent = n > 9 ? '9+' : String(n);
    });
  }
  UI.marcarLeidas = function () {
    if (sim && sim.feed.length) leidasHasta = sim.feed[sim.feed.length - 1].i;
    pintaBadges();
  };
  UI.setFiltro = function (f) { filtro = f; UI.renderFeed(true); };
  UI.renderFeed = function (soloNuevos) {
    const caja = $('feed');
    if (!caja) return;
    let lista = sim.feed.slice(-120).reverse();
    if (filtro === 'importante') lista = lista.filter(e => e.imp >= 4);
    if (filtro === 'mio') lista = lista.filter(e => sim.user && e.ids.includes(sim.user.id));
    const html = lista.map(e => {
      const cls = e.imp >= 6 ? 'imp-alta' : e.imp >= 4 ? 'imp-media' : '';
      const marca = e.imp >= 4 ? '★' : '·';
      return '<div class="fe ' + cls + '"><span class="fh">' + 'D' + Math.floor(e.t / 1440) + ' ' + hhmm(e.t % 1440) + '</span><span class="fi">' + marca + '</span> ' + esc(e.txt) + '</div>';
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
    if (!a) { UI.wizardAbrir(); return; }
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
    if (!a) { UI.wizardAbrir(); return; }
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

  // ── Wizard de creación (5 pasos) ──
  const W = UI.wiz = { paso: 0, datos: { nombre: '', apariencia: { piel: 0, pelo: 2, sombrero: 0, color: 0 }, camino: null, rasgos: {}, sueno: null, oficio: null, secreto: null } };

  UI.wizardAbrir = function () {
    W.paso = 0;
    W.datos = { nombre: '', apariencia: { piel: 0, pelo: 2, sombrero: 0, color: 0 }, camino: null, rasgos: {}, sueno: null, oficio: null, secreto: null };
    // rasgos al azar como punto de partida
    D.EJES.forEach(e => { W.datos.rasgos[e.k] = Math.random() < 0.5 ? 0 : 1; });
    $('wizard').classList.remove('oculto');
    $('ov-wizard').classList.remove('oculto');
    UI.wizRender();
  };
  UI.wizardCerrar = function () { $('wizard').classList.add('oculto'); $('ov-wizard').classList.add('oculto'); };

  UI.wizRender = function () {
    const pasos = ['Apariencia', 'Camino', 'Carácter', 'Sueño', 'Tarjeta del Alma'];
    $('wz-titulo').textContent = 'Paso ' + (W.paso + 1) + ' · ' + pasos[W.paso];
    $('wz-naveg').innerHTML = pasos.map((p, i) => '<button class="wp ' + (i === W.paso ? 'activo' : '') + '">' + (i + 1) + '</button>').join('');
    const caja = $('wz-cuerpo');
    if (W.paso === 0) caja.innerHTML = wizApariencia();
    else if (W.paso === 1) caja.innerHTML = wizCamino();
    else if (W.paso === 2) caja.innerHTML = wizCaracter();
    else if (W.paso === 3) caja.innerHTML = wizSueno();
    else caja.innerHTML = wizTarjeta();
    wireWiz();
  };

  function wizApariencia() {
    const A = W.datos.apariencia;
    const piel = [0, 1, 2, 3, 4, 5].map(i => '<button data-t="piel" data-v="' + i + '" class="opt ' + (A.piel === i ? 'sel' : '') + '" style="--c:' + PIEL[i] + '"></button>').join('');
    const pelo = ['Calvo', 'Corto', 'Melena', 'Coleta', 'Rizado', 'Moñudo'].map((n, i) => '<button data-t="pelo" data-v="' + i + '" class="chip ' + (A.pelo === i ? 'sel' : '') + '">' + n + '</button>').join('');
    const sombrero = ['Ninguno', 'Sombrero de paja', 'Tricornio', 'Banda', 'Casco', 'Copete', 'Capucha', 'Corona'].map((n, i) => '<button data-t="sombrero" data-v="' + i + '" class="chip ' + (A.sombrero === i ? 'sel' : '') + '">' + n + '</button>').join('');
    const color = ['#e8d9b6', '#2f2f38', '#c0392b', '#2980b9', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22'].map((c, i) => '<button data-t="color" data-v="' + i + '" class="opt ' + (A.color === i ? 'sel' : '') + '" style="--c:' + c + '"></button>').join('');
    return '<h3>¿Cómo es por fuera?</h3><p class="hint">Se le verá así en el mar.</p>' +
      '<div class="prev"><div class="avatar" style="--piel:' + PIEL[A.piel] + ';--pelo:' + PELO[A.pelo] + ';--ropa:' + ROPE[A.color] + '">' + avatarSVG(A) + '</div></div>' +
      '<label>Tono de piel</label><div class="fila">' + piel + '</div>' +
      '<label>Cabello</label><div class="fila chips">' + pelo + '</div>' +
      '<label>Sombrero</label><div class="fila chips">' + sombrero + '</div>' +
      '<label>Color de ropa</label><div class="fila">' + color + '</div>' +
      '<label>Tu nombre en el mar <small>(es también tu usuario: único)</small></label>' +
      '<input id="wz-nombre" maxlength="17" placeholder="Ej. Latam" value="' + esc(W.datos.nombre) + '">';
  }
  const PIEL = ['#f2c99a', '#e0a878', '#c98d62', '#a86f45', '#7d4f2c', '#5b3820'];
  const PELO = ['#2f2f38', '#6b4423', '#d8b64c', '#b03030', '#888888', '#101010'];
  const ROPE = ['#e8d9b6', '#2f2f38', '#c0392b', '#2980b9', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22'];

  function avatarSVG(A) {
    const sombrero = A.sombrero === 1 ? '<path d="M6 9 Q15 -2 24 9 L24 11 Q15 7 6 11 Z" fill="#f1c27d" stroke="#8a6d3b"/>' :
      A.sombrero === 2 ? '<rect x="6" y="4" width="18" height="5" rx="2" fill="#2b2b33"/>' :
        A.sombrero === 3 ? '<rect x="9" y="3" width="12" height="5" rx="1" fill="#3a5a8c"/>' :
          A.sombrero === 4 ? '<rect x="10" y="3" width="10" height="6" rx="3" fill="#5b6672"/>' :
            A.sombrero === 5 ? '<path d="M10 9 L15 2 L20 9 Z" fill="#c0392b"/>' :
              A.sombrero === 6 ? '<path d="M7 10 Q15 -4 23 10 L23 12 Q15 9 7 12 Z" fill="#555"/>' :
                A.sombrero === 7 ? '<path d="M9 9 A6 6 0 0 1 21 9 L21 12 L9 12 Z" fill="#f6e05e" stroke="#b7791f"/>' : '';
    const pelo = A.pelo === 0 ? '' :
      A.pelo === 1 ? '<rect x="9" y="10" width="12" height="3" rx="1" fill="var(--pelo)"/>' :
        A.pelo === 2 ? '<path d="M8 13 Q8 8 15 8 Q22 8 22 13 L22 16 L8 16 Z" fill="var(--pelo)"/>' :
          A.pelo === 3 ? '<rect x="9" y="10" width="12" height="3" rx="1" fill="var(--pelo)"/><rect x="19" y="10" width="4" height="10" rx="2" fill="var(--pelo)"/>' :
            A.pelo === 4 ? '<circle cx="9" cy="12" r="3" fill="var(--pelo)"/><circle cx="21" cy="12" r="3" fill="var(--pelo)"/><rect x="10" y="10" width="10" height="3" rx="1" fill="var(--pelo)"/>' :
              A.pelo === 5 ? '<circle cx="15" cy="8" r="4" fill="var(--pelo)"/>' : '';
    return '<svg viewBox="0 0 30 30" width="96" height="96">' +
      '<rect x="8" y="10" width="14" height="12" rx="4" fill="var(--piel)"/>' +
      pelo + sombrero +
      '<circle cx="12.5" cy="15" r="1.1" fill="#22222a"/><circle cx="17.5" cy="15" r="1.1" fill="#22222a"/>' +
      '<path d="M12 19 Q15 21 18 19" stroke="#22222a" stroke-width="1" fill="none"/>' +
      '<rect x="7" y="22" width="16" height="8" rx="2" fill="var(--ropa)"/>' +
      '</svg>';
  }

  function wizCamino() {
    const caminos = [
      { k: 'pir', n: 'Pirata', d: 'Banderas libres. Empiezas en un barco ajeno y fundarás el tuyo.' },
      { k: 'mar', n: 'Marine', d: 'Orden en los mares. Empiezas en una base y arrestarás carteles.' },
      { k: 'rev', n: 'Revolucionario', d: 'El mundo está torcido. Empiezas en una célula discreta.' },
      { k: 'caz', n: 'Cazarrecompensas', d: 'Los carteles pagan. Empiezas siguiendo papelitos.' },
      { k: 'avent', n: 'Que decida el mar', d: 'El mar te pondrá donde tenga que estar.' }
    ];
    return '<h3>¿Por dónde empieza?</h3><p class="hint">Es un inicio, no una jaula: el mar mueve las banderas.</p>' +
      caminos.map(c => '<button class="tarjeta camino ' + (W.datos.camino === c.k ? 'sel' : '') + '" data-c="' + c.k + '"><b>' + c.n + '</b><small>' + c.d + '</small></button>').join('');
  }

  function wizCaracter() {
    return '<h3>¿Cómo es por dentro?</h3><p class="hint">Elige un polo en cada eje. Cada polo da algo y quita algo.</p>' +
      D.EJES.map((e, i) => {
        return '<div class="eje"><label>' + e.polos[0].n + ' — ' + e.polos[1].n + '</label><div class="eje-btns">' +
          e.polos.map((p, j) => '<button class="tarjeta polo ' + (W.datos.rasgos[e.k] === j ? 'sel' : '') + '" data-e="' + i + '" data-j="' + j + '"><b>' + p.n + '</b><small>' + p.pro + '</small></button>').join('') +
          '</div></div>';
      }).join('') +
      '<label>Oficio</label><div class="fila chips">' + D.OFICIOS.map(o => '<button class="chip oficio ' + (W.datos.oficio === o.k ? 'sel' : '') + '" data-o="' + o.k + '" title="' + o.fx + '">' + o.n + '</button>').join('') + '</div>';
  }

  function wizSueno() {
    return '<h3>¿Qué busca en el mar?</h3><p class="hint">La Brújula de Islas señala su aspiración. Suena pentatónico al pasar la aguja.</p>' +
      '<div class="brujula">' + D.SUEÑOS.map((s, i) => {
        const ang = (i * 360) / D.SUEÑOS.length;
        return '<button class="sueño ' + (W.datos.sueno === s.k ? 'sel' : '') + '" data-s="' + s.k + '" style="--a:' + ang + 'deg;--c:' + s.color + '"><span class="aguja"></span><b>' + s.n + '</b></button>';
      }).join('') + '</div>' +
      (W.datos.sueno ? '<p class="cita">«' + D.SUEÑOS.find(s => s.k === W.datos.sueno).cita + '»</p>' : '');
  }

  function wizTarjeta() {
    const d = W.datos;
    const S = D.SUEÑOS.find(s => s.k === d.sueno);
    const origen = { EB: 'East Blue', NB: 'North Blue', WB: 'West Blue', SB: 'South Blue' }[d.mar || 'EB'];
    return '<h3>Tarjeta del Alma</h3><div class="t-alma"><div class="ta-linea">' + esc(d.nombre || 'Sin nombre') + '</div>' +
      '<div class="ta-linea chico">Un alma ' + D.EJES.map(e => e.polos[d.rasgos[e.k]].n.toLowerCase()).slice(0, 3).join(', ') + ' de ' + origen + '</div>' +
      '<div class="ta-linea chico">' + (d.camino === 'avent' ? 'Que decidió el mar' : D.FACCIONES[d.camino].n) + ' · ' + (D.OFICIOS.find(o => o.k === d.oficio) || {}).n + '</div>' +
      '<div class="ta-linea">Que busca ' + (S ? S.n.toLowerCase() : '…') + '</div>' +
      '<div class="ta-linea chico">Con un secreto que irás descubriendo.</div></div>' +
      '<p class="hint">Podrás susurrarle ideas. Si corre peligro, esta tarjeta arderá… y su historia seguirá con un heredero.</p>';
  }

  function wireWiz() {
    const caja = $('wz-cuerpo');
    caja.querySelectorAll('button[data-t]').forEach(b => b.addEventListener('click', () => {
      W.datos.apariencia[b.dataset.t] = +b.dataset.v; G.SFX.tick(); UI.wizRender();
    }));
    caja.querySelectorAll('button.camino').forEach(b => b.addEventListener('click', () => {
      W.datos.camino = b.dataset.c; G.SFX.tick(); UI.wizRender();
    }));
    caja.querySelectorAll('button.polo').forEach(b => b.addEventListener('click', () => {
      W.datos.rasgos[D.EJES[+b.dataset.e].k] = +b.dataset.j; G.SFX.tick(); UI.wizRender();
    }));
    caja.querySelectorAll('button.oficio').forEach(b => b.addEventListener('click', () => {
      W.datos.oficio = b.dataset.o; G.SFX.tick(); UI.wizRender();
    }));
    caja.querySelectorAll('button.sueño').forEach(b => b.addEventListener('click', () => {
      W.datos.sueno = b.dataset.s; G.SFX.campanilla(); UI.wizRender();
    }));
    const nom = $('wz-nombre');
    if (nom) nom.addEventListener('input', () => { W.datos.nombre = nom.value.trim(); });
  }

  UI.wizSiguiente = function () {
    if (W.paso === 0) {
      if (!W.datos.nombre || W.datos.nombre.length < 2) { UI.toast('Elige tu nombre para seguir'); return; }
    }
    if (W.paso === 1 && !W.datos.camino) { UI.toast('Elige un camino'); return; }
    if (W.paso === 2 && !W.datos.oficio) { W.datos.oficio = D.OFICIOS[0].k; }
    if (W.paso === 3 && !W.datos.sueno) { UI.toast('Gira la brújula y elige un sueño'); return; }
    if (W.paso < 4) {
      // el mar de origen se sortea al ENTRAR a la tarjeta: lo que se ve es lo que se juega
      if (W.paso === 3 && !W.datos.mar) W.datos.mar = W.datos.camino === 'avent'
        ? ['EB', 'NB', 'WB', 'SB'][Math.floor(Math.random() * 4)]
        : ({ pir: 'EB', mar: 'EB', rev: 'WB', caz: 'EB' })[W.datos.camino] || 'EB';
      W.paso++; G.SFX.tick(); UI.wizRender(); return;
    }
    // zarpar
    W.datos.secreto = D.SECRETOS[Math.floor(Math.random() * D.SECRETOS.length)].k;
    if (!W.datos.mar) W.datos.mar = 'EB';
    const a = sim.crearJugador({ nombre: W.datos.nombre, camino: W.datos.camino, mar: W.datos.mar, sueno: W.datos.sueno, oficio: W.datos.oficio, rasgos: W.datos.rasgos, secreto: W.datos.secreto });
    UI.wizardCerrar();
    UI.toast('¡' + a.name + ' abre los ojos en ' + D.ISLA[a.isl].n + '!');
    UI.abrirFicha();
    UI.onZarpado && UI.onZarpado(a);
  };
  UI.wizAtras = function () { if (W.paso > 0) { W.paso--; UI.wizRender(); } };

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
})(typeof window !== 'undefined' ? window : globalThis);
