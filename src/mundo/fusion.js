import { getMapIslands } from "../map.js";

const MAP_IDS = {
  "East Blue": "EB",
  "North Blue": "NB",
  "West Blue": "WB",
  "South Blue": "SB"
};
const HOME_ISLANDS = { EB: "foosha", NB: "minion", WB: "ohara", SB: "baterilla" };
const FACTIONS = { Pirata: "pir", Marine: "mar", Aventurero: "ciu", Revolucionario: "rev", Cazarrecompensas: "caz" };
const DREAMS = {
  Libertad: "libertad",
  Poder: "poder",
  Riqueza: "riqueza",
  Fama: "gloria",
  Lazos: "lazos",
  Conocimiento: "conocimiento",
  "Destrucción": "destruccion"
};
const PROFESSIONS = {
  Navegante: "navegante",
  Arqueóloga: "arqueologo",
  Médico: "medico",
  Cocinero: "cocinero",
  Artillero: "tirador"
};
const TRAIT_POLES = {
  Valiente: ["valor", 0],
  Prudente: ["valor", 1],
  Astuto: ["astucia", 0],
  Honrado: ["astucia", 1],
  Impulsivo: ["mente", 1],
  Agresivo: ["genio", 0],
  Rebelde: ["lazos", 1],
  Leal: ["lazos", 0]
};
const byId = (id) => document.getElementById(id);
let lastCharacter = null;

// Apariencia pixel determinista para almas del sim sin retrato definido.
function aparicionDe(agente) {
  // el alma del JUGADOR muestra su cara real, no un hash al azar
  if (agente.user && agente._apariencia) {
    return {
      name: agente.name,
      skin: agente._apariencia.skin || 'Clara',
      hair: agente._apariencia.hair || 'Negro',
      outfit: agente._apariencia.outfitColor || 'Rojo'
    };
  }
  let h = 0;
  for (const ch of String(agente.id)) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return {
    name: agente.name,
    skin: ["Clara", "Bronceada", "Oscura"][h % 3],
    hair: ["Negro", "Moreno", "Rubio", "Rojo"][(h >>> 3) % 4],
    outfit: ["Rojo", "Azul", "Verde", "Negro", "Marrón"][(h >>> 6) % 5]
  };
}

// Almas presentes por isla, con caché de 2 s para no recorrer el sim en cada fotograma.
let cacheAlmas = { t: 0, mapa: new Map() };
function almasDeIsla(simIslId, ahora) {
  if (!Number.isFinite(ahora - cacheAlmas.t) || ahora - cacheAlmas.t > 2000) cacheAlmas = { t: ahora, mapa: new Map() };
  if (cacheAlmas.mapa.has(simIslId)) return cacheAlmas.mapa.get(simIslId);
  const sim = window.JUEGO?.sim;
  const lista = !sim?.popOf ? [] : sim.popOf(simIslId)
    .filter((a) => a.state !== "muerto" && a.state !== "retirado")
    .slice(0, 6)
    .map(aparicionDe);
  cacheAlmas.mapa.set(simIslId, lista);
  return lista;
}

// Las islas del juego se construyen una vez por semilla de alma (no en cada fotograma).
let cacheJuego = { semilla: "", islas: null };
function islasJuego() {
  const semilla = lastCharacter?.id || "viajero";
  if (cacheJuego.semilla !== semilla) {
    cacheJuego = { semilla, islas: getMapIslands(lastCharacter || { id: "viajero" }) };
  }
  return cacheJuego.islas;
}

function juegoDe(mapIsl) {
  if (!mapIsl?.juegoId) return null;
  return islasJuego().find((entry) => entry.id === mapIsl.juegoId) || null;
}

function mapDe(juegoIsl) {
  const D = window.D;
  if (!juegoIsl || !D?.ISLAS) return null;
  return D.ISLAS.find((entry) => entry.juegoId === juegoIsl.id) || null;
}

function installWorldUi() {
  const mapPanel = byId("map-panel");
  const canvasContainer = byId("canvas-container");
  if (!mapPanel || !canvasContainer || byId("mil-almas-ui")) return;

  const canvas = document.createElement("canvas");
  canvas.id = "mapa";
  canvas.setAttribute("aria-label", "Mapa vivo de las islas y tripulaciones");
  canvasContainer.append(canvas);
  const chip = document.createElement("div");
  chip.className = "mil-chip";
  chip.id = "mil-chip";
  chip.textContent = "Sin zarpar";
  canvasContainer.append(chip);

  const ui = document.createElement("div");
  ui.id = "mil-almas-ui";
  ui.innerHTML = `
    <div id="mil-globo-wrap">
      <button id="mil-globo" type="button" aria-label="Abrir el mundo vivo: tu Atlas, tus almas, tu mar">
        <span class="mil-globo-ring" aria-hidden="true"></span>
        <span class="mil-globo-icon" aria-hidden="true">🌍</span>
      </button>
      
            </div>
    </div>
    
    <section id="pop-isla" class="mil-panel mil-island-pop oculto" aria-label="Detalles de isla">
      <button id="pop-cerrar" type="button" class="mil-close" aria-label="Cerrar isla">×</button>
      <h2 id="pi-titulo"></h2><p id="pi-region"></p><div id="pi-control"></div>
      <div id="pi-frente"></div><h3>Mercado del puerto</h3><div id="pi-mercado"></div><div id="pi-evento"></div>
      <h3>Almas presentes</h3><div id="pi-presentes"></div>
      <div id="pi-charlas"></div><h3>Rumores</h3><div id="pi-news"></div><p id="pi-disc"></p>
      <h3>Encuentros</h3><div id="pi-encuentros"></div>
      <button id="pi-viajar" type="button" class="oculto">⛵ Viajar aquí</button>
    </section>
    <section id="ficha" class="mil-panel mil-soul-card oculto" aria-label="Tarjeta del Alma">
      <button id="ficha-cerrar" type="button" class="mil-close" aria-label="Cerrar tarjeta">×</button>
      <p class="mil-eyebrow">Tarjeta del Alma · Mundo vivo</p>
      <h2 id="ft-nombre"></h2><p id="ft-epi"></p><p id="ft-fac"></p><p id="ft-raza"></p>
      <p id="ft-sueno"></p><p id="ft-frase"></p><p id="ft-nivel"></p>
      <div id="ft-stats"></div><p id="ft-belis"></p><p id="ft-cartel"></p>
      <p id="ft-animo"></p><p id="ft-fruta"></p><p id="ft-rasgos"></p>
      <div id="ft-cofre"></div><div id="ft-insignias"></div>
      <h3>Susurros</h3><div id="ft-susurros"></div>
    </section>
    
    
    
    <div id="toast" class="mil-toast oculto" role="status" aria-live="polite"></div>`;
  document.body.append(ui);
  // EL ORBE ES UNA PUERTA, NO UN MENÚ: un toque abre "El Mundo Vivo" del dock.
  // Cero menús intermedios, cero destinos que repitan otras puertas.
  const globo = ui.querySelector("#mil-globo");
  if (globo) {
    globo.addEventListener("click", (event) => {
      event.stopPropagation();
      document.querySelector('#bottom-nav [data-hud-panel="mundo"]')?.click();
    });
  }
  // La Bitácora del nav inferior también cuenta como lectura
  document.addEventListener("click", (event) => {
    if (event.target.closest('[data-hud-panel="news"]')) window.UI?.marcarLeidas?.();
  });
    document.addEventListener("click", (event) => {
    // NOTA: el botón "Navegación / Isla" del nav YA NO se secuestra aquí (stopPropagation
    // en captura lo mataba y, si la isla no mapeaba, el botón quedaba muerto sin panel).
    // Ahora abre el panel de navegación del HUD; el vuelo a tu isla vive dentro del panel
    // vía el evento "onepiece:hud-volar-isla" (ver abajo).
    const zoom = event.target.closest("[data-map-zoom]");
    if (zoom) {
      event.stopPropagation();
      window.MAPA?.zoom?.(zoom.dataset.mapZoom === "in" ? 1 : -1);
    }
  }, true);
  // Vuelo directo a tu isla desde el panel de navegación (modo diorama 16-bit).
  document.addEventListener("onepiece:hud-volar-isla", () => {
    if (!lastCharacter || lastCharacter.location?.atSea) return;
    const island = getMapIslands(lastCharacter).find((entry) => entry.name === lastCharacter.location?.island);
    const mapa = island ? mapDe(island) : null;
    if (!mapa) return;
    if (document.querySelector(".one-hud-backdrop.open")) document.querySelector(".one-hud-close")?.click();
    if (window.MAPA?.enfocarIsla) window.MAPA.enfocarIsla(mapa); else window.MAPA?.volar?.(mapa.x, mapa.y, 3.2, 800);
  });
  window.addEventListener("mil-almas:tick", () => {
    syncLocation(lastCharacter);
  });
  setMapView();
}

// Hay una única vista: el mapa del mundo vivo, siempre activo (el globo 3D queda pausado).
function setMapView() {
  const panel = byId("map-panel");
  if (!panel) return;
  panel.classList.add("mil-vivo");
  document.body.classList.add("mil-live-mode");
  requestAnimationFrame(() => {
    window.MAPA?.resize?.();
    if (window.JUEGO?.sim) window.MAPA?.render?.(window.JUEGO.sim, performance.now());
  });
}

const SEA_ES = { "East Blue": "Mar del Este", "West Blue": "Mar del Oeste", "North Blue": "Mar del Norte", "South Blue": "Mar del Sur" };

function updateChip(character) {
  const chip = byId("mil-chip");
  if (!chip) return;
  const user = window.JUEGO?.sim?.user;
  if (!character) {
    chip.textContent = "Sin zarpar";
    return;
  }
  if (character.location?.atSea) {
    chip.textContent = "📍 En alta mar";
    return;
  }
  const island = user?.isl ? window.D.ISLA[user.isl] : null;
  const region = character.location?.region || window.D?.REGIONS?.[island?.reg]?.name;
  const lugar = `📍 ${character.location?.island || island?.n || "Puerto desconocido"} · ${SEA_ES[region] || region || "Mar desconocido"}`;
  // el chip tiene identidad: TU nombre primero, luego dónde estás
  chip.textContent = user?.name ? `${user.name} · ${lugar}` : lugar;
}

function originCode(character) {
  return MAP_IDS[character.originSea] || "EB";
}

function traitsFor(character) {
  const traits = [...(character.soulCard?.traits?.pros || []), ...(character.soulCard?.traits?.cons || [])];
  const result = { valor: 1, mente: 0, trato: 1, astucia: 1, genio: 1, lazos: 1 };
  for (const trait of traits) {
    const pole = TRAIT_POLES[trait];
    if (pole) result[pole[0]] = pole[1];
  }
  return result;
}

function islandIdFor(character, sim) {
  const name = character.location?.island;
  const match = window.D.islaDeJuego(name);
  return match?.id || HOME_ISLANDS[originCode(character)] || sim.user?.isl;
}

function syncLocation(character) {
  const sim = window.JUEGO?.sim;
  const user = sim?.user;
  if (!character || !user || user._oneLatamId !== character.id) return;
  sim._fusionAtSea = Boolean(character.location?.atSea);
  if (!sim._fusionAtSea) {
    const destination = islandIdFor(character, sim);
    if (destination && (user.isl !== destination || user.plan)) {
      user.plan = null;
      user.state = "libre";
      sim.mover(user, destination);
    }
  }
}

function retireUser(reason = "despedida") {
  const sim = window.JUEGO?.sim;
  const user = sim?.user;
  if (!user) return;
  if (user.isl) sim.leaveIsland(user);
  user.state = "retirado";
  sim.ev("retiro", { a: sim.nm(user), isla: window.D.ISLA[user.isl]?.n || "el mar", razon: reason, esJugador: true }, { ids: [user.id] });
  sim.user = null;
  sim._fusionCrisisIsland = null;
  lastCharacter = null;
  updateChip(null);
  window.JUEGO.guardar(true);
}

function registerCharacter(character) {
  const sim = window.JUEGO?.sim;
  if (!sim || !character) return null;
  if (sim.user?._oneLatamId === character.id) {
    syncCharacter(character);
    const island = window.D.ISLA[sim.user.isl];
    if (island && !character.location?.atSea) window.MAPA?.centra(island.x, island.y);
    return sim.user;
  }
  if (sim.user) retireUser("un nuevo linaje");
  sim._fusionLastEventId = sim.evId;
  const user = sim.crearJugador({
    nombre: character.name,
    camino: FACTIONS[character.faction] || "ciu",
    mar: originCode(character),
    sueno: DREAMS[character.soulCard?.dream] || "libertad",
    oficio: PROFESSIONS[character.profession] || "navegante",
    rasgos: traitsFor(character),
    raza: character.race,
    apariencia: character.appearance || null,
    bandera: character.flag || null
  });
  user._oneLatamId = character.id;
  syncCharacter(character);
  const island = window.D.ISLA[user.isl];
  if (island && !character.location?.atSea) window.MAPA?.centra(island.x, island.y);
  window.JUEGO.guardar(true);
  requestAnimationFrame(() => window.MAPA?.resize?.());
  return user;
}

function syncCharacter(character) {
  const sim = window.JUEGO?.sim;
  const user = sim?.user;
  if (!sim || !user || !character) return false;
  lastCharacter = character;
  if (user._oneLatamId !== character.id) {
    registerCharacter(character);
    return true;
  }
  user.name = character.name;
  user.level = character.level;
  user.bounty = character.bounty;
  user.berries = character.berries;
  user.hp = character.status === "dead"
    ? 0
    : Math.round(100 * character.stats.health / Math.max(1, character.stats.maxHealth));
  user.stats.fue = character.stats.strength;
  user.stats.agi = character.stats.agility;
  user.stats.agu = Math.max(1, Math.round(character.stats.maxHealth / 10));
  user.stats.ing = character.stats.ingenuity;
  user.fac = FACTIONS[character.faction] || "ciu";
  user.sueno = DREAMS[character.soulCard?.dream] || user.sueno;
  user.oficio = PROFESSIONS[character.profession] || user.oficio;
  user.rasgos = { ...user.rasgos, ...traitsFor(character) };
  // TU CARA SIEMPRE: los mundos guardados antes de que la apariencia cruzara
  // al sim vivían con un Luffy genérico — ahora apariencia, bandera y raza se
  // refrescan en cada latido del espejo, sin importar cuándo se creó el alma.
  user._apariencia = character.appearance || user._apariencia || null;
  user._bandera = character.flag || user._bandera || null;
  if (character.race && window.D.RAZAS_SIM[character.race]) user.raza = character.race;
  user.state = character.status === "dead" ? "muerto" : "libre";

  syncLocation(character);
  sim._fusionCrisisIsland = window.D.islaDeJuego(character.world?.story?.activeCrisis?.location)?.id || null;
  cacheAlmas = { t: 0, mapa: new Map() };
  const mirroredEvents = importEvents(character);
  if (character.status === "dead") retireUser("fin del linaje");
  updateChip(character);
  return mirroredEvents;
}

function importEvents(character) {
  const sim = window.JUEGO?.sim;
  if (!sim || !character) return false;
  let changed = false;
  const lastId = Number(sim._fusionLastEventId) || 0;
  for (const event of sim.feed) {
    if (event.i <= lastId || event.imp < 6) continue;
    const message = `🌍 ${event.txt}`;
    character.log.unshift({ time: new Date().toISOString(), message });
    character.world.news.unshift({ type: "living-world", text: message, day: character.world.day, location: character.location?.island });
    changed = true;
  }
  sim._fusionLastEventId = sim.evId;
  if (changed) {
    character.log = character.log.slice(0, 80);
    character.world.news = character.world.news.slice(0, 60);
  }
  return changed;
}

function sendWhisper(text) {
  const sim = window.JUEGO?.sim;
  if (!text?.trim() || !sim?.user) return null;
  const kind = window.PUENTE?.clasificarSusurro(text) || "explorar";
  const result = sim.doWhisper(sim.user, kind);
  window.UI?.toast(result.reinterpret ? "El mundo reinterpretó tu susurro." : result.obe ? "El mundo recibió tu susurro." : "El mundo decidió por su cuenta.");
  window.JUEGO.guardar(true);
  return result;
}

installWorldUi();

window.MIL = {
  registerCharacter,
  syncCharacter,
  importEvents,
  retirarUser: retireUser,
  susurrar: sendWhisper,
  setMapView
};

export { importEvents, registerCharacter, retireUser as retirarUser, sendWhisper as susurrar, syncCharacter };
