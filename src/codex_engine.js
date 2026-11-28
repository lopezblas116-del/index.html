import catalogData from "./data/codex_data.json" with { type: "json" };
import islandData from "./data/islands_data.json" with { type: "json" };
import loreData from "./data/lore_data.json" with { type: "json" };
import { renderCatalogo } from "./catalogo_engine.js";
import { DEVIL_FRUITS } from "./devil_fruits.js";
import { RACES } from "./races.js";

const categories = [
  ["islands", "Islas"],
  ["fruits", "Akuma no Mi"],
  ["races", "Razas"],
  ["poneglyphs", "Poneglyphs"],
  ["ships", "Modelos de barcos"],
  ["gobierno", "El Gobierno Mundial"]
];
const silhouettes = Object.freeze({ islands: "◼", fruits: "●", races: "♟", poneglyphs: "▮", ships: "◆", gobierno: "🏛" });

// los rostros del poder: lo que el Gobierno no pone en ningún libro
const GOBIERNO_CATALOGO = [
  { id: "gorosei", name: "Los Cinco Ancianos", texto: "Los máximos líderes del Gobierno Mundial. Decretan la cacería, el tributo y el silencio; nadie ha visto firmar nada: los decretos aparecen, y el mundo obedece." },
  { id: "tenryuubito", name: "Tenryuubito · Nobles Mundiales", texto: "Descendientes de los fundadores. Pasean bajo burbujas para no respirar el mismo aire que la gente, cobran tributo y toman esclavos. Desoírlos sube tu recompensa y tu leyenda." },
  { id: "cp9", name: "Cipher Pol 9", texto: "La agencia que no existe: espionaje y ejecución silenciosa. Sus agentes dominan el Rokushiki; si tu recompensa crece, uno de ellos ya lee tus cartas." },
  { id: "filosofos", name: "Los Filósofos del Vacío", texto: "Leen lo que el Gobierno quemó. Conversan en linterna baja y cobran poco por lo mucho que saben: cada teoría es un recuerdo del siglo que no existe." },
  { id: "arquitecto", name: "El Arquitecto", texto: "Seis planos que reescriben el mundo: la ciudad-puente, el camino de las estrellas, el sello del silencio. Reúnelos todos y la conspiración se dibuja sola: el Gobierno no teme piratas — teme mapas nuevos." }
];

export const CODEX_CATALOG = Object.freeze({
  islands: Object.entries(islandData).map(([id, island]) => ({ id, name: island.name })),
  fruits: catalogData.fruits.map((fruit) => ({
    ...fruit,
    name: DEVIL_FRUITS.find((entry) => entry.id === fruit.id)?.name || fruit.name
  })),
  races: Object.entries(RACES).map(([id, race]) => ({ id, name: race.name })),
  poneglyphs: loreData.poneglyphTopics.map((topic) => ({ id: topic.id, name: topic.title, type: topic.type })),
  ships: catalogData.ships,
  gobierno: GOBIERNO_CATALOGO
});

export function codexProgress(character) {
  const discoveries = new Set(character?.codex?.discoveries || []);
  const entries = categories.flatMap(([key, label]) => CODEX_CATALOG[key].map((entry) => ({
    ...entry,
    key,
    category: label,
    unlocked: discoveries.has(`${key}:${entry.id}`)
  })));
  const total = entries.length;
  const unlocked = entries.filter((entry) => entry.unlocked).length;
  return { entries, total, unlocked, percent: total ? Math.round(unlocked / total * 100) : 0 };
}

export function syncCodex(character) {
  if (!character) return false;
  if (!character.codex || typeof character.codex !== "object" || Array.isArray(character.codex)) {
    character.codex = { discoveries: [] };
  }
  if (!Array.isArray(character.codex.discoveries)) character.codex.discoveries = [];
  const discoveries = new Set(character.codex.discoveries);
  const unlock = (key, id) => {
    if (!id || !CODEX_CATALOG[key]?.some((entry) => entry.id === id)) return;
    discoveries.add(`${key}:${id}`);
  };

  if (!character.location?.atSea) {
    const island = Object.entries(islandData).find(([, entry]) => entry.name === character.location?.island);
    if (island) unlock("islands", island[0]);
  }
  unlock("races", character.race);
  if (character.fruit?.id) unlock("fruits", character.fruit.id);
  if (character.ship?.model) {
    const model = String(character.ship.model).toLocaleLowerCase("es");
    const ship = CODEX_CATALOG.ships.find((entry) => entry.id === model || entry.name.toLocaleLowerCase("es") === model);
    if (ship) unlock("ships", ship.id);
  } else {
    unlock("ships", "caravel");
  }
  for (const translation of Array.isArray(character.archaeology?.translations) ? character.archaeology.translations : []) {
    const topicId = Object.values(loreData.sites).find((site) => site.poi.id === translation.siteId)?.poi.lore;
    if (topicId) unlock("poneglyphs", topicId);
  }

  const next = [...discoveries];
  const changed = next.length !== character.codex.discoveries.length;
  character.codex.discoveries = next;
  return changed;
}

// la pestaña elegida del codex sobrevive al repintado por segundo del panel
let codexTabSel = null;

export function renderCodex(container, character, abrirPanel) {
  const progress = codexProgress(character);
  const summary = document.createElement("section");
  summary.className = "one-hud-codex-progress";
  const heading = document.createElement("h3");
  heading.textContent = `ENCICLOPEDIA DEL MAR · ${progress.percent}%`;
  const count = document.createElement("p");
  count.textContent = `${progress.unlocked} de ${progress.total} descubrimientos registrados.`;
  const bar = document.createElement("progress");
  bar.max = 100;
  bar.value = progress.percent;
  bar.setAttribute("aria-label", `Progreso del códice: ${progress.percent}%`);
  summary.append(heading, count, bar);

  const body = document.createElement("div");
  const buildEnciclopedia = () => {
    const grid = document.createElement("div");
    grid.className = "one-hud-codex-grid";
    for (const [key, label] of categories) {
      const section = document.createElement("section");
      section.className = "one-hud-codex-category";
      const title = document.createElement("h3");
      title.textContent = label;
      const list = document.createElement("div");
      list.className = "one-hud-codex-items";
      for (const entry of progress.entries.filter((item) => item.key === key)) {
        const item = document.createElement("article");
        item.className = `one-hud-codex-item ${entry.unlocked ? "discovered" : "locked"}`;
        const silhouette = document.createElement("span");
        silhouette.className = "one-hud-codex-silhouette";
        silhouette.setAttribute("aria-hidden", "true");
        silhouette.textContent = silhouettes[key];
        const name = document.createElement("span");
        name.textContent = entry.unlocked ? entry.name : "Sin descubrir";
        if (!entry.unlocked) item.setAttribute("aria-label", `${label}: elemento aún no descubierto`);
        else item.setAttribute("aria-label", `${label}: ${entry.name}, descubierto`);
        const lock = document.createElement("span");
        lock.className = "one-hud-codex-lock";
        lock.setAttribute("aria-hidden", "true");
        lock.textContent = entry.unlocked ? "✦" : "🔒";
        item.append(silhouette, name, lock);
        // el lore que el Gobierno no pone en libros: se lee al descubrir
        if (entry.unlocked && entry.texto) {
          const lore = document.createElement("small");
          lore.className = "one-hud-codex-lore";
          lore.textContent = entry.texto;
          item.append(lore);
        }
        list.append(item);
      }
      section.append(title, list);
      grid.append(section);
    }
    body.replaceChildren(grid);
  };
  const buildCatalogo = () => {
    body.replaceChildren();
    renderCatalogo(body);
  };

  // ═══ EL MUNDO VIVO: el universo sentado y latiendo — facciones, control,
  // economía, eventos de mundo y el pulso de AHORA (todo leído del sim real) ═══
  const abrir = typeof abrirPanel === "function" ? abrirPanel : () => {};
  const sim = globalThis.JUEGO?.sim;
  const ABv = globalThis.AB;
  const Dv = globalThis.D;
  const buildMundo = () => {
    const caja = document.createElement("div");
    caja.className = "one-hud-codex-mundo";
    const sec = (titulo, nodo) => {
      const s = document.createElement("section");
      s.className = "one-hud-codex-category";
      const h = document.createElement("h3");
      h.textContent = titulo;
      s.append(h, nodo);
      caja.append(s);
    };
    // el universo AHORA: cifras vivas si zarpo, sentadas si aún no
    const resumen = document.createElement("p");
    resumen.className = "one-hud-codex-lore";
    const islas = Dv?.ISLAS ? Dv.ISLAS.filter((i) => !i.oculta).length : 0;
    if (sim && ABv) {
      const vivos = sim.agents.filter((a) => a.state !== "muerto" && a.state !== "retirado").length;
      const frentes = sim.guerra?.frentes?.length || 0;
      resumen.textContent = `AHORA MISMO: ${vivos} almas vivas en ${islas} islas · ${sim.crews?.length || 0} tripulaciones · ${frentes} frente(s) abierto(s) · ${sim.cargas?.length || 0} convoys en el mar · ${sim.evento ? "evento en curso: " + sim.evento.nom : "ningún evento abierto"}.`;
    } else {
      resumen.textContent = `El universo está sentado: cuatro mares (East, North, South, West) en torno a la Grand Line y la Red Line. ${islas} islas navegables, cada una bajo la ley de la Marina, gobernada por un tirano o libre. Cuando zarpe tu alma, unas 300 almas vivirán este mundo CON vos — y seguirán viviéndolo cuando dejes de mirar.`;
    }
    sec("El universo ahora", resumen);
    // las fuerzas del mundo
    const fuerzas = document.createElement("div");
    fuerzas.className = "one-hud-codex-grid";
    [
      ["pir", "Piratas", "Izaron bandera por un sueño propio. Cada hazaña engorda su cartel; la Marina los caza y los puertos los celebran o los temen."],
      ["mar", "La Marina", "El brazo de la ley del Gobierno Mundial: arresta, escolta, protege sus bases y asedia los nidos piratas en campañas."],
      ["caz", "Cazadores", "Cobran por encargo: arrestos limpios, cabezas con cartel y Reyes del Mar cuando el mar se pone feroz."],
      ["rev", "La Revolución", "Células ocultas que liberan islas de sus tiranos y empujan a los oprimidos a la revuelta."],
      ["gob", "El Gobierno Mundial", "Manda desde Mary Geoise: el Consejo, los Gorosei y el tributo que sangra cada isla bajo la ley."]
    ].forEach(([fac, nom, texto]) => {
      const item = document.createElement("article");
      item.className = "one-hud-codex-item discovered";
      item.innerHTML = `<strong>${nom}</strong><small class="one-hud-codex-lore">${texto}</small>`;
      fuerzas.append(item);
    });
    sec("Las fuerzas del mundo", fuerzas);
    // control de islas
    const control = document.createElement("p");
    control.className = "one-hud-codex-lore";
    control.textContent = "EL CONTROL: cada isla vive bajo la ley de la Marina, gobernada por un tirano que cobra tributo, o libre. Las campañas abren frentes de guerra: la moral avanza o se rompe, y la isla CAE — cambia de manos ante el mundo entero. Si tu isla tiene frente abierto, podés lanzarte desde el pop del puerto.";
    sec("El control de las islas", control);
    // economía
    const eco = document.createElement("p");
    eco.className = "one-hud-codex-lore";
    eco.textContent = "LA ECONOMÍA: cada puerto compra y vende Grano, Rum, Medicina, Armas y Cartas de navegar. El precio respira con el stock y la demanda de cada isla: lo que sobra en un puerto vale oro en el vecino. Los convoys mercantes cruzan el mar y los piratas los asaltan — lo que no llega, encarece. Comprá barato, vendé caro: tu carga viaja en tu barco y tu ganancia se cuenta en la Bitácora.";
    sec("La economía de los mares", eco);
    // eventos de mundo
    const listaEv = document.createElement("div");
    listaEv.className = "one-hud-codex-items";
    const evDesc = {
      caceria: "Un Rey del Mar acecha las aguas: los cazadores cobran por cazarlo.",
      hambruna: "El hambre muerde una región: el grano vale oro y zarpan convoys de ayuda.",
      feria: "Un puerto entra en fiesta: precios de rebaja y el mar entero navega para allá.",
      aurora: "Una luz antigua brilla sobre una isla: los arqueólogos afilan sus calcos.",
      duelo: "Dos jefes se retan por el dominio de una región. Apuesten sus barcos.",
      consejo: "Los Gorosei deliberan: la Marina se tensa y el tributo sube."
    };
    (ABv?.EVENTOS || []).forEach((e) => {
      const item = document.createElement("article");
      const activo = sim?.evento?.k === e.k;
      item.className = `one-hud-codex-item ${activo ? "discovered" : "locked"}`;
      item.innerHTML = `<strong>${activo ? "✦ " : ""}${e.nom}</strong><small class="one-hud-codex-lore">${evDesc[e.k] || ""}${activo ? " · EN CURSO AHORA." : ""}</small>`;
      listaEv.append(item);
    });
    if (!ABv?.EVENTOS) listaEv.append(Object.assign(document.createElement("p"), { textContent: "Los eventos se revelan al zarpar." }));
    sec("Los eventos de mundo", listaEv);
    // el pulso de ahora
    if (sim && ABv?.top) {
      const t = ABv.top(sim);
      const pulso = document.createElement("p");
      pulso.className = "one-hud-codex-lore";
      const busc = t.buscados.slice(0, 3).map((b) => b.n).join(", ") || "nadie con cartel grande";
      const hot = t.hot.slice(0, 2).map((h) => `${h.isl}: ${h.bien} ${h.delta > 0 ? "+" : ""}${Math.round(h.delta * 100)}%`).join(" · ") || "mercados en calma";
      pulso.textContent = `Más buscados: ${busc}. Mercados calientes: ${hot}.${t.frentes.length ? " Frentes: " + t.frentes.map((f) => f.nom || f.isl).join(", ") + "." : ""}`;
      sec("El pulso de ahora", pulso);
    }
    body.replaceChildren(caja);
  };

  // ═══ EL CAMINO DEL ALMA: cómo se progresa en este universo ═══
  const buildCamino = () => {
    const caja = document.createElement("div");
    caja.className = "one-hud-codex-mundo";
    const sec = (titulo, nodo) => {
      const s = document.createElement("section");
      s.className = "one-hud-codex-category";
      const h = document.createElement("h3");
      h.textContent = titulo;
      s.append(h, nodo);
      caja.append(s);
    };
    const nivel = character?.level || 1;
    const xpNeed = globalThis.Sim?.XP_NEED?.(nivel);
    const lineas = [];
    lineas.push(`NIVEL: tu alma está en el nivel ${nivel}${xpNeed ? ` — al siguiente le necesita ${xpNeed.toLocaleString("es")} XP` : ""}. Peleas, hallazgos y encargos dan experiencia; cada nivel te hace más fuerte frente a las almas del mundo.`);
    lineas.push(`RECOMPENSA: ${character?.bounty ? "฿" + Number(character.bounty).toLocaleString("es") + " sobre tu cabeza" : "aún sin cartel grande"}. El cartel crece con cada hazaña: liberar una isla, asaltar un frente, cobrar un evento. Es tu fama — y la lista de la Marina.`);
    lineas.push(`AKUMA NO MI: ${character?.fruit?.name || "ninguna"}. Hay ${DEVIL_FRUITS.length} frutas del diablo repartidas por el mundo; cada una reescribe lo que tu cuerpo puede hacer.`);
    const haki = character?.haki;
    if (haki && typeof haki === "object") {
      const tipos = Object.entries(haki).filter(([, v]) => v && (typeof v !== "object" || v.nivel)).map(([k, v]) => `${k} (${typeof v === "object" ? v.nivel ?? 1 : v})`).join(", ");
      if (tipos) lineas.push(`HAKI despertado: ${tipos}. El haki crece con el combate y te deja tocar el alma de los fuerte.`);
    }
    const u = sim?.user;
    const insig = Object.keys(u?.insignias || character?.insignias || {});
    const catalogo = { liberador: "liberaste una isla del tirano", vanguardia: "luchaste en un frente de guerra", "abismo_caceria": "héroe de La Gran Cacería", "abismo_hambruna": "héroe de La Bodega Vacía", "abismo_feria": "héroe de La Feria de los Mares", "abismo_aurora": "héroe de La Aurora del Siglo", "abismo_duelo": "héroe del Duelo de las Cumbres", "abismo_consejo": "héroe del Consejo del Mundo" };
    lineas.push(`INSIGNIAS: ${insig.length ? insig.map((k) => catalogo[k] || k).join("; ") : "ninguna aún — el mundo las reparte a quien hace historia"}.`);
    const gen = character?.lineage?.generation || character?.generation;
    if (gen) lineas.push(`LINAJE: generación ${gen}. Cuando tu alma muere, tu heredero recoge la bandera: el mundo sigue y recuerda.`);
    const lista = document.createElement("div");
    lineas.forEach((t) => {
      const p = document.createElement("p");
      p.className = "one-hud-codex-lore";
      p.textContent = t;
      lista.append(p);
    });
    sec("Cómo sube tu alma", lista);
    const disc = document.createElement("p");
    disc.className = "one-hud-codex-lore";
    disc.textContent = `DESCUBRIMIENTOS: ${progress.percent}% de la enciclopedia (${progress.unlocked}/${progress.total}). Pisar islas, comer frutas y traducir Poneglyphs desbloquea entradas reales de este códice.`;
    sec("La enciclopedia se escribe al jugar", disc);
    body.replaceChildren(caja);
  };

  // ═══ CÓMO SE JUEGA: la guía del jugador — cada puerta abre su panel ═══
  const buildGuia = () => {
    const caja = document.createElement("div");
    caja.className = "one-hud-codex-mundo";
    const intro = document.createElement("p");
    intro.className = "one-hud-codex-lore";
    intro.textContent = "Tocá para leer. Cada puerta es una parte real del mundo — nada de acá es decoración.";
    caja.append(intro);
    // RETENCIÓN PRIMERO: lista colapsada — el título promete, el cuerpo entrega
    // SOLO cuando se toca. Antes era un muro de texto que nadie leía.
    const filas = [
      ["🧠", "Tu capitán decide solo — y a veces desobedece", "Tiene rasgos, sueño y carácter propios: evalúa cada sugerencia tuya y actúa por su cuenta. Si desobedece, no es un error: es su personalidad.", null],
      ["🎯", "¿Perdiste a tu capitán en el mapa?", "Un toque en el 🎯 de la brújula (o tecla L): la cámara vuela hasta él y el mar lo señala con un ping dorado.", null],
      ["📰", "Bitácora del Mar", "La última hora del mundo: lo que pasó mientras no mirabas, y el chat de tripulaciones.", "news"],
      ["🧭", "Navegar: el Log Pose manda", "Tu rumbo, la carga del Log Pose y el tablón de encargos del puerto. Sin carga no zarpa.", "navigation"],
      ["🥂", "La Taverna: contratos y rumores", "El corazón del puerto: conversaciones, contratos y el mercado donde especular.", "tavern"],
      ["⚓", "Tu Barco: la bodega decide si llegás vivo", "Provisiones, agua, equipo y reliquias para el viaje.", "chest"],
      ["👻", "Tu Alma: haki, fruta y linaje", "Tu tarjeta: nivel, haki, fruta del diablo, linaje y panteón de tu sangre.", "profile"],
      ["📋", "Tablón: contratos del puerto", "Comercio, caza de recompensas y arqueología: cada contrato cambia el mundo.", "boards"],
      ["🌍", "~300 almas viven este mapa sin pedirte permiso", "El Mundo Vivo: el pop de cada isla (mercado, frente, evento, presentes) y el pulso del mundo.", "mundo"],
      ["🔁", "El ciclo en 6 latidos", "1) Mirá la Bitácora: el mundo ya estaba vivo. 2) En Navegar, sugerí un encargo: tu avatar lo resuelve según su carácter. 3) Zarpá cuando el Log Pose cargue. 4) En cada puerto: comprá barato, vendé caro. 5) Con frente abierto, entrá: fama, berries e insignias. 6) El Catálogo y la Enciclopedia se escriben con tus descubrimientos.", null]
    ];
    const lista = document.createElement("div");
    lista.className = "mil-guia";
    for (const [ico, titulo, cuerpo, abrirA] of filas) {
      const det = document.createElement("details");
      det.className = "mil-guia-item";
      const sum = document.createElement("summary");
      const icoEl = document.createElement("span");
      icoEl.className = "mil-guia-ico";
      icoEl.textContent = ico;
      const titEl = document.createElement("span");
      titEl.className = "mil-guia-tit";
      titEl.textContent = titulo;
      sum.append(icoEl, titEl);
      const cuerpoDiv = document.createElement("div");
      cuerpoDiv.className = "mil-guia-cuerpo";
      cuerpoDiv.textContent = cuerpo;
      det.append(sum, cuerpoDiv);
      if (abrirA) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "one-hud-action";
        btn.textContent = "Abrir →";
        btn.addEventListener("click", () => abrir(abrirA));
        const pie = document.createElement("div");
        pie.style.marginTop = "8px";
        pie.append(btn);
        cuerpoDiv.append(pie);
      }
      lista.append(det);
    }
    caja.append(lista);
    body.replaceChildren(caja);
  };

  // el codex recuerda su pestaña elegida aunque el panel se repinte cada segundo;
  // una pestaña pedida (la ? del encabezado, la guía primera vez) gana UNA vez
  const orden = [["Enciclopedia", buildEnciclopedia, "enciclopedia"], ["Catálogo del mundo", buildCatalogo, "catalogo"], ["El Mundo Vivo", buildMundo, "mundo"], ["El Camino del Alma", buildCamino, "alma"], ["Cómo se juega", buildGuia, "guia"]];
  let inicial = 0;
  const pedida = globalThis.__codexTab;
  globalThis.__codexTab = null;
  if (codexTabSel !== null && codexTabSel !== undefined) inicial = codexTabSel;
  else if (pedida) {
    const idx = orden.findIndex(([, , key]) => key === pedida);
    if (idx >= 0) inicial = idx;
  }
  codexTabSel = inicial;
  const tabs = document.createElement("div");
  tabs.className = "one-hud-tabs";
  tabs.setAttribute("role", "tablist");
  orden.forEach(([label, build], index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.textContent = label;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(index === inicial));
    tab.addEventListener("click", () => {
      [...tabs.children].forEach((node, nodeIndex) => node.setAttribute("aria-selected", String(nodeIndex === index)));
      codexTabSel = index;
      orden[index][1]();
    });
    tabs.append(tab);
  });
  container.replaceChildren(summary, tabs, body);
  orden[inicial][1]();
}
