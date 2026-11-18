import { setMapRenderPaused } from "../world3d.js";

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

function installWorldUi() {
  const mapPanel = byId("map-panel");
  const canvasContainer = byId("canvas-container");
  if (!mapPanel || !canvasContainer || byId("mil-almas-ui")) return;

  const canvas = document.createElement("canvas");
  canvas.id = "mapa";
  canvas.setAttribute("aria-label", "Mapa vivo de las islas y tripulaciones");
  canvasContainer.append(canvas);

  const ui = document.createElement("div");
  ui.id = "mil-almas-ui";
  ui.innerHTML = `
    <nav class="mil-map-tabs" aria-label="Vistas del mapa">
      <button type="button" class="mil-tab active" data-map-view="globo" aria-pressed="true">🗺 Globo</button>
      <button type="button" class="mil-tab" data-map-view="vivo" aria-pressed="false">🌊 Mundo vivo</button>
      <button type="button" class="mil-feed-toggle" aria-expanded="false" aria-controls="mil-feed-drawer">Bitácora viva</button>
    </nav>
    <header class="mil-world-bar">
      <div><strong>MUNDO VIVO</strong><span><b id="cab-almas">—</b> almas · <span id="cab-reloj">—</span></span></div>
      <div class="mil-world-actions">
        <button id="btn-nuevo" type="button">Mi alma</button>
        <button id="btn-peri" type="button">Hemeroteca</button>
        <button id="btn-ajustes" type="button" aria-label="Ajustes del mundo">⚙</button>
        <button id="btn-sonido" type="button" aria-label="Activar o silenciar sonidos">♫</button>
      </div>
    </header>
    <section id="mil-feed-drawer" class="mil-feed-drawer oculto" aria-label="Bitácora del mundo">
      <div class="mil-feed-heading"><h2>Última hora</h2><button type="button" data-close-feed aria-label="Cerrar bitácora">×</button></div>
      <div id="feed" aria-live="polite"></div>
    </section>
    <section id="pop-isla" class="mil-panel mil-island-pop oculto" aria-label="Detalles de isla">
      <button id="pop-cerrar" type="button" class="mil-close" aria-label="Cerrar isla">×</button>
      <h2 id="pi-titulo"></h2><p id="pi-region"></p>
      <h3>Almas presentes</h3><div id="pi-presentes"></div>
      <div id="pi-charlas"></div><h3>Rumores</h3><div id="pi-news"></div><p id="pi-disc"></p>
    </section>
    <section id="ficha" class="mil-panel mil-soul-card oculto" aria-label="Tarjeta del Alma">
      <button id="ficha-cerrar" type="button" class="mil-close" aria-label="Cerrar tarjeta">×</button>
      <p class="mil-eyebrow">Tarjeta del Alma · Mundo vivo</p>
      <h2 id="ft-nombre"></h2><p id="ft-epi"></p><p id="ft-fac"></p>
      <p id="ft-sueno"></p><p id="ft-frase"></p><p id="ft-nivel"></p>
      <div id="ft-stats"></div><p id="ft-belis"></p><p id="ft-cartel"></p>
      <p id="ft-animo"></p><p id="ft-fruta"></p><p id="ft-rasgos"></p>
      <div id="ft-cofre"></div><div id="ft-insignias"></div>
      <h3>Susurros</h3><div id="ft-susurros"></div>
    </section>
    <section id="periodico" class="mil-panel mil-newspaper oculto" aria-label="Hemeroteca">
      <button id="per-cerrar" type="button" class="mil-close" aria-label="Cerrar hemeroteca">×</button>
      <h2>Hemeroteca del mar</h2><div id="per-cuerpo"></div>
    </section>
    <section id="ajustes" class="mil-panel mil-settings oculto" aria-label="Ajustes del mundo">
      <button id="aj-cerrar" type="button" class="mil-close" aria-label="Cerrar ajustes">×</button>
      <h2>Ajustes del mundo vivo</h2>
      <div class="mil-settings-actions">
        <button id="aj-guardar" type="button">Guardar</button>
        <button id="aj-exportar" type="button">Exportar</button>
        <button id="aj-importar" type="button">Importar</button>
        <input id="aj-fichero" type="file" accept="application/json" hidden>
        <button id="aj-borrar" type="button">Nuevo mundo</button>
      </div>
      <div><button class="filtro sel" data-f="todo" type="button">Todo</button><button class="filtro" data-f="importante" type="button">Importante</button><button class="filtro" data-f="mio" type="button">Mi alma</button></div>
      <div><button class="ritmo sel" data-r="1" type="button">×1</button><button class="ritmo" data-r="4" type="button">×4</button><button class="ritmo" data-r="12" type="button">×12</button></div>
    </section>
    <div id="toast" class="mil-toast oculto" role="status" aria-live="polite"></div>
    <div id="ov-wizard" class="oculto" aria-hidden="true"></div>
    <section id="wizard" class="mil-panel oculto" aria-label="Creación de alma">
      <button id="wz-cerrar" type="button">Cerrar</button><h2 id="wz-titulo"></h2>
      <div id="wz-naveg"></div><div id="wz-cuerpo"></div><input id="wz-nombre">
      <button id="wz-atras" type="button">Atrás</button><button id="wz-siguiente" type="button">Siguiente</button>
    </section>`;
  document.body.append(ui);
  ui.querySelectorAll("[data-map-view]").forEach((button) => {
    button.addEventListener("click", () => setMapView(button.dataset.mapView));
  });
  ui.querySelector(".mil-feed-toggle").addEventListener("click", (event) => {
    const drawer = byId("mil-feed-drawer");
    const opened = drawer.classList.toggle("oculto") === false;
    event.currentTarget.setAttribute("aria-expanded", String(opened));
  });
  ui.querySelector("[data-close-feed]").addEventListener("click", () => {
    byId("mil-feed-drawer").classList.add("oculto");
    ui.querySelector(".mil-feed-toggle").setAttribute("aria-expanded", "false");
  });
  setMapView("globo");
}

function setMapView(view) {
  const panel = byId("map-panel");
  if (!panel) return;
  const live = view === "vivo";
  panel.classList.toggle("mil-vivo", live);
  document.body.classList.toggle("mil-live-mode", live);
  setMapRenderPaused(live);
  document.querySelectorAll("#mil-almas-ui [data-map-view]").forEach((button) => {
    const selected = button.dataset.mapView === view;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  if (live) requestAnimationFrame(() => {
    window.MAPA?.resize?.();
    if (window.JUEGO?.sim) window.MAPA?.render?.(window.JUEGO.sim, performance.now());
  });
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
  const match = Object.values(window.D.ISLA).find((island) => island.n === name);
  return match?.id || HOME_ISLANDS[originCode(character)] || sim.user?.isl;
}

function retireUser(reason = "despedida") {
  const sim = window.JUEGO?.sim;
  const user = sim?.user;
  if (!user) return;
  if (user.isl) sim.leaveIsland(user);
  user.state = "retirado";
  sim.ev("retiro", { a: sim.nm(user), isla: window.D.ISLA[user.isl]?.n || "el mar", razon: reason, esJugador: true }, { ids: [user.id] });
  sim.user = null;
  window.JUEGO.guardar(true);
}

function registerCharacter(character) {
  const sim = window.JUEGO?.sim;
  if (!sim || !character) return null;
  if (sim.user?._oneLatamId === character.id) {
    syncCharacter(character);
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
    rasgos: traitsFor(character)
  });
  user._oneLatamId = character.id;
  syncCharacter(character);
  window.JUEGO.guardar(true);
  requestAnimationFrame(() => window.MAPA?.resize?.());
  return user;
}

function syncCharacter(character) {
  const sim = window.JUEGO?.sim;
  const user = sim?.user;
  if (!sim || !user || !character) return false;
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
  user.state = character.status === "dead" ? "muerto" : "libre";

  if (!character.location?.atSea) {
    const destination = islandIdFor(character, sim);
    if (destination && user.isl !== destination) sim.mover(user, destination);
  }
  const mirroredEvents = importEvents(character);
  if (character.status === "dead") retireUser("fin del linaje");
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
