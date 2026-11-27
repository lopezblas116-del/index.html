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
  UI.setFiltro = function (f) {
    filtro = f; UI.renderFeed(true);
    if (UI._refrescoFeed) UI._refrescoFeed(); // la Bitácora del HUD se repinta con el filtro nuevo
  };
  UI.renderFeed = function (soloNuevos) {
    const caja = $('feed');
    if (!caja || !caja.offsetParent) return; // el drawer viejo ya no existe: no pintar en lo invisible
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
      // EL QUE MANDA AQUÍ: la visión del spec hecha alma viva — se ve ANTES de pisar
      const jefe = D.JEFES && D.JEFES[i.id];
      const S = window.JUEGO && window.JUEGO.sim;
      const vive = jefe ? (S && S.agents || []).some(a => a.jefe && a.isl === i.id && a.state !== 'retirado') : false;
      // EL MONOLITO: si la isla enlazada tiene Poneglyph, se ve y se toca
      const pm = document.getElementById('pi-poneglyph');
      if (pm) pm.remove();
      const carM = window.ONE_LATAM && window.ONE_LATAM.getCharacter && window.ONE_LATAM.getCharacter();
      const islRaiz = carM && getMapIslands(carM).find(x => x.id === i.juegoId || x.name === i.n);
      const mono = islRaiz && (islRaiz.pois || []).find(p => p.type === 'poneglyph');
      if (mono) {
        const tipo = { blue: 'Historia', red: 'Ruta', gold: 'Tesoro' }[mono.glyphType || 'blue'] || 'Historia';
        const caja = document.createElement('div');
        caja.id = 'pi-poneglyph';
        caja.className = 'mil-encuentro';
        caja.innerHTML = '<b>📜 Monolito Poneglyph · ' + tipo + '</b><p>Glifos antiguos tallados en piedra viva. Los que saben leer la historia oculta pueden tomar un calco.</p>';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Examinar el monolito';
        btn.addEventListener('click', () => {
          const c = window.ONE_LATAM && window.ONE_LATAM.getCharacter && window.ONE_LATAM.getCharacter();
          if (!c) return;
          if (c.location?.island !== islRaiz.name || c.location?.atSea) {
            document.dispatchEvent(new CustomEvent('onepiece:systems-toast', { detail: { message: 'El monolito espera en ' + islRaiz.name + ': hay que pisar la isla.' } }));
            return;
          }
          // ACONSEJAR, NO CONTROLAR: el monolito queda como sugerencia y el
          // propio avatar camina hasta él en el próximo latido y lo examina
          c.localSuggestion = mono.id;
          c.location.localVenue = { id: mono.id, name: mono.name, type: 'poneglyph' };
          const mod = window.__ARQUEOLOGIA__;
          const res = mod && mod.examinePoneglyph ? mod.examinePoneglyph(c, islRaiz, mono) : null;
          if (!res) {
            document.dispatchEvent(new CustomEvent('onepiece:systems-toast', { detail: { message: 'El monolito ya dio lo que tenía.' } }));
          } else if (res.inaccessible) {
            document.dispatchEvent(new CustomEvent('onepiece:systems-toast', { detail: { message: 'Glifos indescifrables por ahora: se necesita la Tribu del Tres Ojos, oficio arqueólogo o un tomo de glifos. De todos modos, va camino a la piedra.' } }));
          } else {
            document.dispatchEvent(new CustomEvent('onepiece:systems-toast', { detail: { message: 'Calco tomado: «' + res.title + '». Va directo a tu Tarjeta del Alma.' } }));
          }
          UI.abrirIsla(i);
        });
        caja.appendChild(btn);
        $('pi-region').insertAdjacentElement('afterend', caja);
      }
      let pj = document.getElementById('pi-jefe');
      if (!pj) { pj = document.createElement('p'); pj.id = 'pi-jefe'; pj.className = 'one-hud-muted'; pj.style.margin = '4px 0'; $('pi-region').insertAdjacentElement('afterend', pj); }
      pj.textContent = !jefe ? '👑 Sin amo conocido: tierra libre.'
        : vive ? '👑 Manda aquí: ' + jefe.nombre + ' · nivel ' + jefe.nivel + (jefe.recompensa ? ' · cabeza por ฿' + (jefe.recompensa >= 1e9 ? (jefe.recompensa / 1e9) + 'B' : (jefe.recompensa / 1e6) + 'M') : ' · ' + (jefe.fac === 'mar' ? 'rango de la Marina' : 'corona sin precio')) + ' — ' + jefe.d
        : '👑 ' + jefe.nombre + ' ya no manda: la isla respira libre.';
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
          pe.innerHTML = '<div class="mil-encuentro vacio"><small>Isla fuera del mapa canónico: la política jugable ocurre en las 29 islas del atlas antiguo.</small></div>';
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
        const u = sim.user;
        const aqui = u && !sim._fusionAtSea && u.isl === i.id;
        viajar.classList.toggle('oculto', !i.juego || aqui);
        viajar.disabled = Boolean(sim._fusionAtSea);
        viajar.textContent = sim._fusionAtSea ? '⛵ En alta mar: primero hay que llegar a puerto' : '⛵ Pedir a tu avatar zarpar aquí';
        viajar.title = 'El avatar evalúa el rumbo con su carácter; si acepta, el viaje toma tiempo y el mar cobra';
        // EL ZARPE ES DEL AVATAR: pedís, él evalúa (suggestSail), el mar decide.
        // El viaje corre en el motor y la cámara sigue la ruta dorada.
        viajar.onclick = () => {
          document.dispatchEvent(new CustomEvent('onepiece:hud-sail-suggest', { detail: { location: { name: i.n, x: i.x, y: i.y } } }));
          MAPA.volar(i.x, i.y, 1.5, 800);
        };
      }
    }
    // LA CARTA POR CAPAS: la isla se VE primero (lugares, gente, ambiente); cada
    // lugar se abre recién al pedirlo — un panel por lugar, nada apilado.
    UI.renderLugares(i);
    const lugarCaja = $('pi-lugar');
    if (lugarCaja) lugarCaja.classList.add('oculto');
    const cartaCaja = $('pi-carta');
    if (cartaCaja) cartaCaja.classList.remove('oculto');
    UI.pintaPopDinamico(i);
  };

  // Parte VIVA del pop: portada (control, qué se cuenta de la isla, ambiente) y
  // el subpanel abierto respira con el tick. Barata: nada se reconstruye entero.
  const belis = (n) => '฿' + Math.round(n).toLocaleString('es');
  UI.pintaPopDinamico = function (i) {
    const disc = sim.descubiertas[i.id];
    const discEl = $('pi-disc');
    if (discEl) discEl.textContent = disc ? 'Descubierta por ' + esc(sim.nm(sim.byId(disc))) : 'Nadie ha pisado esta isla todavía';
    // control político: ley / tirano / libre (la cadena raza→opresión→revuelta vive aquí)
    const ctrl = sim.control && sim.control[i.id];
    const ctrlEl = $('pi-control');
    if (ctrlEl) ctrlEl.innerHTML = ctrl ? '<span class="mil-ctrl c-' + ctrl + '">' + (ctrl === 'ley' ? '⚖ Bajo la ley de la Marina' : ctrl === 'tirano' ? '⛓ Gobernador tirano · el tributo sangra' : '🕊 Libre') + '</span>' : '';
    // LA VISTA DE LEJOS: papeles públicos de la isla mientras tu avatar no esté en ella
    const u = sim.user;
    const aqui = u && !sim._fusionAtSea && u.isl === i.id;
    const dis = $('pi-distante');
    if (dis) {
      if (aqui) {
        dis.innerHTML = '<p class="mil-estoy">⚓ Tu avatar está en este puerto: entrá a los lugares de la isla.</p>';
      } else {
        const AB = globalThis.AB;
        const filas = AB ? AB.precioFila(sim, i.id).slice(0, 3) : [];
        const nAlmas = sim.popOf(i.id).filter(a => a.state === 'libre').length;
        const lejos = sim._fusionAtSea ? 'Están en alta mar. ' : 'Tu avatar está en otro puerto. ';
        dis.innerHTML = '<p class="mil-lejos">' + lejos + 'Lo que cuentan de ' + esc(i.n) + ':</p>' +
          (filas.length ? filas.map(f => '<span class="mil-pase">' + esc(f.n) + ' <b>' + belis(f.p) + '</b>' + (f.dir > 0 ? ' ▲' : f.dir < 0 ? ' ▼' : '') + '</span>').join('') : '<span class="mil-pase">sin mercado conocido</span>') +
          '<span class="mil-pase">' + nAlmas + ' alma' + (nAlmas === 1 ? '' : 's') + ' presente' + (nAlmas === 1 ? '' : 's') + '</span>';
      }
    }
    UI.renderLugares(i); // los chips reflejan dónde estás: activos en el puerto, de lejos solo se miran
    UI.pintaAbismo(i);
    UI.renderBurbujas(i);
    UI.pintaLugar(i); // el subpanel abierto sigue los precios y la gente en vivo
  };

  // ═══ EL ABISMO EN EL POP: frente de guerra con su moral y el evento de mundo
  // al que te puedes unir — en la PORTADA; el mercado vive en su lugar (capas) ═══
  UI.pintaAbismo = function (i) {
    const AB = globalThis.AB;
    const cajaF = $('pi-frente'), cajaE = $('pi-evento');
    if (!cajaF || !AB || !sim) return;
    // frente de guerra: barra de moral y el botón de lanzarse
    const fr = (sim.guerra && sim.guerra.frentes || []).find((f) => f.isl === i.id);
    cajaF.innerHTML = fr
      ? '<div class="ab-frente"><b>⚔ ' + esc(fr.nom || 'Frente abierto') + '</b>' +
        '<span class="ab-barra" aria-hidden="true"><i style="width:' + Math.max(0, Math.min(100, fr.moral)) + '%"></i></span>' +
        '<small>' + esc(fr.desc || '') + '</small>' +
        '<button type="button" class="ab-btn ab-btn-grande" data-ab="frente">⚔ Lanzarse al frente</button></div>'
      : '';
    // evento de mundo: se puede unir si tu isla (o tu mar) es el escenario
    const ev = sim.evento;
    const enEscenario = ev && ((ev.isl && ev.isl === i.id) || (ev.reg && ev.reg === i.reg));
    cajaE.innerHTML = enEscenario
      ? '<div class="ab-evento"><b>✦ ' + esc(ev.nom) + '</b><small>El mundo lo narra. Los héroes cobran al cerrar.</small>' +
        '<button type="button" class="ab-btn ab-btn-grande" data-ab="evento">✦ Unirme al evento</button></div>'
      : '';
  };

  // ═══ LA ISLA POR CAPAS: portada → lugares → un panel por lugar ═══
  // Simple para el jugador (tocá lo que querés ver), prolijo para el código:
  // cada lugar es un builder que llena #pi-lugar-cuerpo y delega en los sistemas
  // que ya existían (mercado del abismo, coliseo, astillero, tablón del raíz).
  const LUGARES = [
    ['mercado', '🏪', 'Mercado del puerto', 'Los precios que respiran con el mar', 'oro'],
    ['taberna', '🍺', 'Taberna del puerto', 'Rumores que se cuentan hoy', 'vida'],
    ['tablón', '📋', 'Tablón de encargos', 'El puerto paga por hacer', 'tierra'],
    ['coliseo', '⚔️', 'Coliseo', 'La arena paga al que aguantó', 'peligro'],
    ['astillero', '⚓', 'Astillero', 'El casco que te salva el viaje', 'mar'],
    ['almas', '👻', 'Almas presentes', 'Quien anda por el puerto ahora', 'arcano']
  ];
  UI.renderLugares = function (i) {
    const caja = $('pi-lugares');
    if (!caja) return;
    const u = sim.user;
    const aqui = u && !sim._fusionAtSea && u.isl === i.id;
    caja.innerHTML = '';
    const h = document.createElement('h3');
    h.textContent = aqui ? 'Lugares de ' + i.n : 'Lugares de la isla (se abren al pisar el puerto)';
    caja.append(h);
    const grid = document.createElement('div');
    grid.className = 'mil-lugares';
    for (const [key, icono, nom, desc, tono] of LUGARES) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'mil-lugar tono-' + tono + (aqui ? ' abierto' : ' a-distancia');
      chip.innerHTML = '<span class="mil-lugar-icono">' + icono + '</span><span class="mil-lugar-nombre">' + nom + '</span><small>' + (aqui ? desc : 'de lejos solo se mira') + '</small>';
      if (aqui) {
        chip.addEventListener('click', () => UI.abrirLugar(i, key));
      } else {
        chip.disabled = true;
        chip.title = 'Entrá al puerto para abrir ' + nom;
      }
      grid.append(chip);
    }
    caja.append(grid);
  };

  // el cuerpo de cada lugar, vivo con el tick (precios, gente, charlas)
  UI.pintaLugar = function (i) {
    const caja = $('pi-lugar');
    if (!caja || caja.classList.contains('oculto') || caja.dataset.key !== i.id) return;
    const clave = caja.dataset.lugar;
    const cuerpo = $('pi-lugar-cuerpo');
    if (!cuerpo) return;
    const build = {
      mercado: UI.lugarMercado,
      taberna: UI.lugarTaberna,
      tablon: UI.lugarTablon,
      coliseo: UI.lugarColiseo,
      astillero: UI.lugarAstillero,
      almas: UI.lugarAlmas
    }[clave];
    if (build) build(cuerpo, i);
  };

  UI.abrirLugar = function (i, clave) {
    const caja = $('pi-lugar'), carta = $('pi-carta'), cuerpo = $('pi-lugar-cuerpo');
    if (!caja || !carta || !cuerpo) return;
    caja.dataset.key = i.id;
    caja.dataset.lugar = clave;
    const lugar = LUGARES.find((l) => l[0] === clave);
    $('pi-lugar-titulo').textContent = (lugar ? lugar[1] + ' ' : '') + (lugar ? lugar[2] : clave);
    caja.classList.remove('oculto');
    carta.classList.add('oculto');
    UI.pintaLugar(i);
  };

  UI.volverCarta = function () {
    const caja = $('pi-lugar'), carta = $('pi-carta');
    if (!caja) return;
    caja.classList.add('oculto');
    caja.dataset.lugar = '';
    if (carta) carta.classList.remove('oculto');
    if (islaAbierta) UI.pintaPopDinamico(islaAbierta);
  };

  // ── MERCADO: las mismas filas vivas del abismo, ahora con techo propio ──
  UI.lugarMercado = function (cuerpo, i) {
    const AB = globalThis.AB;
    const filas = AB ? AB.precioFila(sim, i.id) : [];
    cuerpo.innerHTML = filas.length
      ? filas.map((f) =>
          '<div class="ab-fila"><span class="ab-bien">' + esc(f.n) + '</span>' +
          '<span class="ab-p ' + (f.dir > 0 ? 'sube' : f.dir < 0 ? 'baja' : '') + '">' + belis(f.p) + (f.dir > 0 ? ' ▲' : f.dir < 0 ? ' ▼' : '') + '</span>' +
          '<button type="button" class="ab-btn" data-ab="comprar:' + f.k + '" aria-label="Comprar ' + esc(f.n) + '" title="Comprar 1">＋</button>' +
          '<button type="button" class="ab-btn" data-ab="vender:' + f.k + '" aria-label="Vender ' + esc(f.n) + '" title="Vender 1">－</button></div>').join('') +
        '<p class="mil-muted ab-carga">Carga del barco: ' + AB.cargaDe(sim) + '/' + AB.cargaCap(sim) + ' unidades · el precio respira con el stock y la demanda</p>' +
        '<p class="mil-muted">Comprá barato en la isla que sobra, vendé caro en la que falta: la ganancia es tu mapa.</p>'
      : '<p class="mil-muted">Sin mercado abierto en esta isla.</p>';
  };

  // ── TABERNA: rumores que SE GENERAN de los datos reales del mundo (nada inventado:
  //    precios, control, frentes, cartel de buscados, jefes vistos) con giro de dudas ──
  UI.rumoresDe = function (i) {
    const AB = globalThis.AB;
    const h = (i.id || '') + ':' + Math.floor((sim.t || 0) / 60); // rotación por hora de mundo
    let s = 7;
    for (const ch of h) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    const ale = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 16) % 100; };
    const lineas = [];
    const filas = AB ? AB.precioFila(sim, i.id) : [];
    if (filas.length) {
      const f = filas[(ale() % filas.length + filas.length) % filas.length];
      lineas.push('Dicen que ' + f.n + ' se paga a ' + belis(f.p) + ' en este muelle' + (f.dir > 0 ? ' — y no deja de subir' : f.dir < 0 ? ' — dicen que cayó de golpe' : ''));
    }
    const ctrl = sim.control && sim.control[i.id];
    if (ctrl === 'tirano') lineas.push('El gobernador subió el tributo otra vez: las mesas hablan de poco más.');
    if (ctrl === 'libre') lineas.push('Sin amo que cobre, el puerto respira — por ahora.');
    if (ctrl === 'ley') lineas.push('La patrulla de la Marina pasa cada hora; hasta los gaviotas obedecen.');
    const fr = (sim.guerra && sim.guerra.frentes || []).find((f) => f.isl === i.id);
    if (fr) lineas.push('Se escuchan cañones desde el frente. Nadie apuesta ya a una banda.');
    if (sim.evento) lineas.push('En tres mesas distintas contaron lo mismo: ' + sim.evento.nom + '. Nadie se anima a ignorarlo.');
    const ABt = AB && sim && globalThis.AB.top ? globalThis.AB.top(sim) : null;
    if (ABt && ABt.buscados.length) {
      const b = ABt.buscados[ale() % Math.min(3, ABt.buscados.length)];
      lineas.push('Cartel nuevo en la comisaría: ' + b.n + ' — la cabeza vale ' + belis(b.b || 0) + '.');
    }
    const jefe = sim.agents && sim.agents.find((a) => a.jefe && a.isl === i.id && a.state !== 'retirado');
    if (jefe) lineas.push('Un pescador jura que vio a ' + sim.nm(jefe) + ' desembarcar al alba. Mejor no mirarle la cara.');
    const carga = sim.cargas && sim.cargas.length ? sim.cargas[0] : null;
    if (carga && carga.bien) lineas.push('Zarpó un convoy cargado de ' + carga.bien + ' esta mañana. Hay ojos que lo siguen.');
    if (lineas.length && ale() < 30) lineas.push('…pero la boca que lo contó ya había corrido tres rones.');
    return lineas.length ? lineas : ['En la taberna solo se habla del viento: nada digno de copla.'];
  };
  UI.lugarTaberna = function (cuerpo, i) {
    cuerpo.innerHTML = '<h4>Lo que se cuenta hoy</h4>' + UI.rumoresDe(i).map((r) => '<p class="mil-rumor">🗨 ' + esc(r) + '</p>').join('') +
      '<h4>Quien anda por el puerto</h4><div id="pi-taberna-gente"></div>';
    const gente = $('pi-taberna-gente');
    UI.htmlPresentes(gente, i);
  };

  // ── TABLÓN: los encargos del día del puerto (motor raíz, sugerir no es controlar) ──
  UI.lugarTablon = function (cuerpo, i) {
    const car = window.ONE_LATAM && window.ONE_LATAM.getCharacter && window.ONE_LATAM.getCharacter();
    const TAB = window.__TABLON__;
    const encargos = TAB && car ? TAB.encargos(car) : [];
    if (!encargos.length) {
      cuerpo.innerHTML = '<p class="mil-muted">El tablón queda en silencio hoy (o tu avatar está en mar abierto).</p>';
      return;
    }
    const nivelRiesgo = { 1: 'bajo', 2: 'medio', 3: 'alto' };
    cuerpo.innerHTML = '<p class="mil-muted">Le señalás el encargo a tu avatar: él decide ir y el mundo responde a su carácter.</p>';
    for (const encargo of encargos) {
      const fila = document.createElement('div');
      fila.className = 'mil-encargo';
      fila.innerHTML = '<div><span class="mil-riesgo r-' + nivelRiesgo[encargo.riesgo] + '">riesgo ' + nivelRiesgo[encargo.riesgo] + '</span> <b>' + esc(encargo.nombre) + '</b><small>' + esc(encargo.texto) + ' · Pago ฿' + encargo.pago + '</small></div>';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ab-btn';
      btn.textContent = 'Sugerir';
      btn.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('onepiece:hud-tablon-suggest', { detail: { encargoId: encargo.id } }));
      });
      fila.append(btn);
      cuerpo.append(fila);
    }
  };

  // ── COLISEO: la arena del puerto; el avatar baja con su temple de rasgos ──
  UI.lugarColiseo = function (cuerpo, i) {
    const car = window.ONE_LATAM && window.ONE_LATAM.getCharacter && window.ONE_LATAM.getCharacter();
    const hoy = Number(car?.world?.day) || 0;
    const peleoHoy = car?.coliseo?.fightDay === hoy;
    cuerpo.innerHTML = '<p class="mil-rumor">⚔ El coliseo abre al alba: ฿15 la entrada. Los rasgos de tu avatar deciden el temple en la arena — la multitud lo recuerda si gana con estilo.</p>' +
      '<p class="mil-muted">Récord de hoy: ' + (peleoHoy ? 'ya peleó hoy — la arena da una función por día.' : 'aún no bajó hoy.') + '</p>';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ab-btn ab-btn-grande';
    btn.textContent = peleoHoy ? 'Ya bajó hoy' : '⚔ Bajar a la arena (฿15)';
    btn.disabled = peleoHoy;
    btn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('onepiece:hud-coliseo-fight'));
    });
    cuerpo.append(btn);
  };

  // ── ASTILLERO: el muelle paga, el casco se cuida — acciones reales del raíz ──
  UI.lugarAstillero = function (cuerpo, i) {
    const car = window.ONE_LATAM && window.ONE_LATAM.getCharacter && window.ONE_LATAM.getCharacter();
    const casco = car?.ship?.acquired ? '🚢 Casco de tu carabela: ' + Math.round(car.ship.health) + '%' : 'Sin barco propio: la faena del muelle financia el primero (฿90).';
    cuerpo.innerHTML = '<p class="mil-rumor">' + casco + '</p>';
    const acciones = document.createElement('div');
    acciones.className = 'mil-lugares';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mil-lugar tono-mar abierto';
    btn.innerHTML = '<span class="mil-lugar-icono">⚒</span><span class="mil-lugar-nombre">Jornada portuaria</span><small>braza y cajas · +฿45</small>';
    btn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('onepiece:hud-shipyard-action', { detail: { action: 'work' } }));
    });
    acciones.append(btn);
    if (car && !car.ship?.acquired) {
      const b2 = document.createElement('button');
      b2.type = 'button';
      b2.className = 'mil-lugar tono-mar abierto';
      b2.innerHTML = '<span class="mil-lugar-icono">💰</span><span class="mil-lugar-nombre">Comprar la carabela</span><small>฿90 · tu primer zarpe</small>';
      b2.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('onepiece:hud-shipyard-action', { detail: { action: 'purchase' } }));
      });
      acciones.append(b2);
    }
    cuerpo.append(acciones);
  };

  // ── ALMAS: quien anda por el puerto; un toque abre su carta viva ──
  UI.lugarAlmas = function (cuerpo, i) {
    cuerpo.innerHTML = '';
    UI.htmlPresentes(cuerpo, i);
  };

  // la lista de presentes, compartida por taberna y almas (retratos si cargó GFX)
  UI.htmlPresentes = function (caja, i) {
    if (!caja) return;
    const presentes = sim.popOf(i.id).filter(a => a.state === 'libre');
    caja.innerHTML = presentes.length
      ? presentes.slice(0, 12).map(a => {
        const ch = sim.charlaDe(a.id);
        const act = ch ? '<i>charlando</i>' : esc(a.act || a.state);
        return '<div class="pre" data-id="' + a.id + '" style="cursor:pointer" title="Ver su carta">' + esc(sim.nm(a)) + ' <small>' + act + '</small></div>';
      }).join('') : '<div class="pre vacio">No hay nadie ahora mismo.</div>';
    caja.querySelectorAll('.pre').forEach((fila) => {
      fila.addEventListener('click', () => {
        const al = presentes.find(x => x.id === fila.dataset.id);
        if (al) UI.abrirFicha(al);
      });
    });
    // retratos pixel (capa GFX si cargó)
    if (G.GFX && G.GFX.cargado && G.GFX.imgs.personajes) {
      const filas = caja.querySelectorAll('.pre');
      presentes.slice(0, 12).forEach((a, k) => {
        const retr = G.GFX.retrato(a, 3);
        if (retr && filas[k]) { retr.classList.add('con-retrato'); filas[k].prepend(retr); }
      });
    }
  };

  // ═══ LA BRÚJULA DEL JUGADOR: una línea que le dice qué puede hacer AHORA ═══
  // Prioridad real: evento de mundo > frente en tu isla > carga con ganancia >
  // primer mercado > el pulso del mundo. Un click abre el Mundo (donde vive todo).
  UI.pintaHint = function () {
    const el = $('hud-hint');
    if (!el || !sim) return;
    try {
      const u = sim.user;
      const ev = sim.evento;
      const frente = (sim.guerra && sim.guerra.frentes || []).find((f) => f.isl === u?.isl);
      const AB = globalThis.AB;
      let txt = 'El mundo late sin vos: el pulso está en el mapa (botón Mundo)';
      if (ev) {
        txt = '✦ ' + ev.nom + (ev.isl && D.ISLA[ev.isl] ? ' · ' + D.ISLA[ev.isl].n : '') + ': está pasando — los héroes cobran al cerrar';
      } else if (frente) {
        txt = '⚔ Frente abierto en tu isla (' + (D.ISLA[frente.isl] ? D.ISLA[frente.isl].n : '') + '): lánzate desde el pop del puerto';
      } else if (u && u.cargo && Object.keys(u.cargo).length && AB) {
        const k = Object.keys(u.cargo)[0];
        const p = AB.precio(sim, u.isl, k);
        if (p && p > u.cargo[k].costo) txt = '💰 Tu ' + k + ' vale ฿' + p.toLocaleString('es') + ' en este puerto (pagaste ฿' + Math.round(u.cargo[k].costo).toLocaleString('es') + '): vendé en el pop de la isla';
        else txt = '📦 Llevás carga en tu barco: mirá los precios del puerto en el pop de cada isla';
      } else if (u) {
        txt = 'El mercado del puerto compra y vende: comprá barato en una isla y vendé caro en la vecina';
      }
      el.textContent = txt;
      el.hidden = false;
    } catch (e) { el.hidden = true; /* la brújula no tumba nada */ }
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
  UI.abrirFicha = function (agente) {
    const a = agente || sim.user;
    if (!a) { UI.toast('Tu alma aún no existe: creala desde la portada.'); return; }
    $('ficha').classList.remove('oculto');
    $('ficha')._a = a;
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
    $('ft-belis').textContent = fmtBelis(a.berries) + ' Berries (฿)';
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
  

  UI.renderSusurros = function () {
    const a = $('ficha')._a || sim.user; if (!a) return;
    $('ft-susurros').innerHTML = D.SUSURROS.map(s => {
      const p = sim.probObediencia(a, s.k);
      return '<button class="sus" data-k="' + s.k + '">' + esc(s.n) + ' <small>' + Math.round(p * 100) + '%</small></button>';
    }).join('');
    $('ft-susurros').querySelectorAll('button.sus').forEach(b => {
      b.addEventListener('click', () => {
        const r = sim.doWhisper(a, b.dataset.k);
        UI.toast(r.reinterpret ? 'Reinterpreta tu consejo a su manera…' : r.obe ? 'Te ha hecho caso.' : 'No te ha hecho caso.');
        UI.renderSusurros();
        UI.abrirFicha(a);
      });
    });
  };

  UI.toast = function (txt) {
    const t = $('toast');
    t.textContent = txt; t.classList.remove('oculto');
    clearTimeout(t._to); t._to = setTimeout(() => t.classList.add('oculto'), 2600);
  };


  

  
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
    UI._refrescoFeed = () => { caja.innerHTML = ''; UI.pintaFeedEn(caja); };
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
    // LA RUTA DEL LOG POSE: la progresión canónica de la Gran Ruta — Paraíso
    // y Nuevo Mundo en orden de visita, marcada con ✓ donde ya pusiste pieza
    const ruta = D.RUTA_GL || {};
    const marca = (id) => ((a.islasPisadas && a.islasPisadas[id]) || (a.atlas && a.atlas[id])) ? ' ✓' : '';
    const pintaRuta = (etiqueta, ids) => {
      if (!ids || !ids.length) return;
      const seq = ids.map(id => (D.ISLA[id] ? D.ISLA[id].n : id) + marca(id)).join(' → ');
      caja.insertAdjacentHTML('beforeend', '<h4 style="margin:10px 0 4px">' + etiqueta + '</h4>' +
        '<p class="one-hud-muted" style="margin:2px 0">' + esc(seq) + '</p>');
    };
    pintaRuta('Ruta del Log Pose · Paraíso', ruta.PAR);
    pintaRuta('Ruta del Log Pose · Nuevo Mundo', ruta.NW);
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
    // el sonido vive en SU puerta (el chip flotante del mar y el engranaje): aquí no se repite
    accion(caja, '💾 Guardar el mundo', () => J.guardar && J.guardar(false));
    accion(caja, '📂 Importar partida', () => {
      // el importar vive aquí: su única puerta es este panel (el modal viejo se retiró)
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/json';
      inp.addEventListener('change', () => {
        const f = inp.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          try {
            const d = JSON.parse(rd.result);
            if (d.v !== 1 || !d.agents) throw new Error('formato');
            localStorage.setItem('mp-latam-save-v1', JSON.stringify(d));
            location.reload();
          } catch (err) { UI.toast('Archivo no válido'); }
        };
        rd.readAsText(f);
      });
      inp.click();
    });
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
