import { newsLocation } from "./map.js";
import { ISLAND_VIEW, renderMap, returnToGlobalMap } from "./world3d.js";
import { ensureAdvancedSystems } from "./systems.js";
import { RACES } from "./races.js";
import { drawPixelAvatar, npcAppearanceFor, ISLAND_SCENE_WIDTH, ISLAND_SCENE_HEIGHT } from "./island_renderer.js";

const byId = (id) => document.getElementById(id);
const number = (value) => new Intl.NumberFormat("es-ES").format(Number(value) || 0);
const time = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--:--" : new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(date);
};
const safe = (value, fallback = "—") => value ?? fallback;
const listen = (element, type, handler, options) => {
  if (element) element.addEventListener(type, handler, options);
};
const UI_ICONS = {
  tavern: "M4 10h16v10H4z M3 7h18v3H3z M9 13h6v7H9z",
  market: "M3 9h18l-2 11H5z M2 6h20v3H2z M8 12h3v3H8z",
  blackmarket: "M3 9h18l-2 11H5z M2 6h20v3H2z M8 12h3v3H8z",
  poneglyph: "M5 3h12l3 3v15H5z M8 9h9m-9 4h9m-9 4h6",
  chest: "M4 9h16v11H4z M3 6h18v4H3z M12 10v10m-2-6h4",
  ship: "M12 3v13M12 5H6v8h6m0-7h6v7h-6M4 17q8 6 16 0M3 21h18",
  news: "M5 4h14v16H5zM8 8h8M8 12h8m-8 4h5",
  bounty: "M12 3 4 7v5c0 5 4 8 8 9 4-1 8-4 8-9V7zM9 12l2 2 4-5",
  crown: "m3 8 5 4 4-7 4 7 5-4-2 12H5z",
  gazette: "M5 4h14v16H5zM8 8h8M8 12h8m-8 4h3m3 0h2"
};
function iconNode(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("nautical-icon");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", UI_ICONS[name] || UI_ICONS.ship);
  svg.append(path);
  return svg;
}

let islandView = null;
let islandCharacter = null;
let islandViewInitialized = false;
let islandRenderKey = "";
const isAtIsland = (character, island) => Boolean(character && character.status !== "dead" && !character.captured && !character.location?.atSea && character.location?.island === island.name);

export function initIslandView() {
  if (islandViewInitialized) return;
  islandViewInitialized = true;
  listen(document, "onepiece:island-approach", (event) => {
    islandView = event.detail.island;
    islandRenderKey = "";
    const view = byId("island-view");
    view.hidden = false;
    view.classList.add("approaching");
    renderIslandView(islandCharacter);
  });
  listen(document, "onepiece:camera-state", (event) => {
    islandView = event.detail.state === ISLAND_VIEW ? event.detail.island : null;
    islandRenderKey = "";
    document.body.dataset.cameraState = event.detail.state;
    const view = byId("island-view");
    if (view) {
      view.hidden = !islandView;
      view.classList.remove("approaching");
    }
    if (islandView) {
      byId("island-message").textContent = "";
      renderIslandView(islandCharacter);
      byId("island-back")?.focus();
    }
  });
  listen(byId("island-back"), "click", () => returnToGlobalMap());
}

export function renderIslandView(character) {
  islandCharacter = character;
  if (!islandView || !character) return;
  const present = isAtIsland(character, islandView);
  const key = `${islandView.id}:${character.id}:${present}:${character.appearance?.skin || ""}:${character.ancientLanguage?.knowledge || 0}:${character.location?.localVenue?.id || ""}:${character.localSuggestion || ""}`;
  if (key === islandRenderKey) return;
  islandRenderKey = key;
  byId("island-title").textContent = islandView.landmark || islandView.name;
  byId("island-sea").textContent = `${islandView.sea} · ${islandView.biome}`;
  byId("island-presence").textContent = present
    ? `${character.name} está en el puerto.`
    : "Vista previa: el avatar no está atracado aquí. Sugiere el rumbo desde el mapa.";
  const hotspots = byId("island-hotspots");
  hotspots.replaceChildren();
  for (const poi of islandView.pois || []) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "island-hotspot";
    button.style.left = `${poi.x / ISLAND_SCENE_WIDTH * 100}%`;
    button.style.top = `${poi.y / ISLAND_SCENE_HEIGHT * 100}%`;
    button.setAttribute("aria-label", `${poi.name}; sugerencia opcional, el avatar decide si la sigue`);
    const icon = poi.type === "tavern" || poi.type === "inn" ? "tavern"
      : poi.type === "market" || poi.type === "restaurant" || poi.type === "kitchen" ? "market"
        : poi.type === "dock" || poi.type === "shipyard" ? "ship"
          : poi.type === "plaza" || poi.type === "landmark" ? "news"
            : poi.type === "base" || poi.type === "weapon_shop" ? "bounty" : "chest";
    button.append(iconNode(icon), document.createTextNode(poi.name));
    button.addEventListener("click", () => {
      const current = isAtIsland(islandCharacter, islandView);
      if (!current) {
        byId("island-message").textContent = "Este lugar solo se puede visitar cuando el avatar esté atracado en esta isla.";
      } else {
        document.dispatchEvent(new CustomEvent("onepiece:local-suggestion", { detail: { islandId: islandView.id, poiId: poi.id } }));
        byId("island-message").textContent = `Sugerencia registrada. ${islandCharacter.name} decidirá según su ánimo y necesidades.`;
      }
    });
    button.disabled = !isAtIsland(islandCharacter, islandView);
    hotspots.append(button);
  }
  document.dispatchEvent(new CustomEvent("onepiece:island-layout"));
}

export function renderPsychology(container, character, selection, onSuggest) {
  const card = document.createElement("section");
  card.className = "psychology-card";
  const heading = document.createElement("h3");
  heading.textContent = "ANALIZAR PSICOLOGÍA";
  const subject = document.createElement("p");
  subject.textContent = `Análisis: ${selection.label}`;
  const state = document.createElement("p");
  state.textContent = `Sintonía: ${character.whisper?.affinity ?? 55}% · Rebeldía: ${character.whisper?.rebellion ?? 45}% · Energía de Susurro: ${character.whisper?.energy ?? 3}/3`;
  const label = document.createElement("label");
  label.textContent = "Atributo a entrenar en el próximo puerto";
  const select = document.createElement("select");
  for (const [value, text] of [["strength", "Fuerza"], ["agility", "Agilidad"], ["ingenuity", "Ingenio"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.append(option);
  }
  select.value = selection.attribute || "strength";
  label.append(select);
  const help = document.createElement("p");
  help.textContent = "Cuesta 1 energía. Se recupera 1 al llegar a otro puerto; el avatar puede aceptar o rechazar el consejo.";
  if (character.whisper?.trainingSuggestion) {
    help.textContent += " Ya hay un consejo pendiente para el próximo puerto.";
  }
  const button = document.createElement("button");
  button.type = "button";
  button.className = "one-hud-action";
  button.textContent = "Orientar Entrenamiento";
  button.disabled = character.status === "dead" || (character.whisper?.energy ?? 3) < 1 || Boolean(character.whisper?.trainingSuggestion);
  button.addEventListener("click", () => onSuggest(select.value));
  card.append(heading, subject, state, label, help, button);
  container.append(card);
}

export function renderNewspaper(container, character, onInvestigate, onSuggest) {
  const world = character.world ?? {};
  const shared = world.shared?.world;
  const globalEvents = shared?.global_events ?? [];
  const sections = [
    { key: "news", label: "Titulares", items: [...globalEvents.filter((entry) => !["global_chat", "death", "escape", "bounty"].includes(entry.type)), ...(world.news ?? [])], empty: "No hay titulares todavía." },
    { key: "bounty", label: "Se Busca / Bounties", items: [...(shared?.bounties_leaderboard ?? []).map((entry) => ({ text: `${entry.yonkou ? "YONKOU · " : ""}SE BUSCA · ${entry.name} · ฿${number(entry.bounty)} Berries` })), ...(character.bounty > 0 ? [{ text: `SE BUSCA · ${character.name} · ฿${number(character.bounty)} Berries` }] : [])], empty: "No hay carteles activos para este avatar." },
    { key: "gazette", label: "Gaceta & Fugas", items: [
      ...globalEvents.filter((entry) => ["death", "escape"].includes(entry.type)),
      ...(shared?.fallen_captains ?? []).map((entry) => ({ text: `${entry.name} · ${entry.faction || "Viajero"} · ${entry.cause || "Legado del mar"}`, location: entry.location || entry.island })),
      ...(world.pantheon ?? []).map((entry) => ({ text: `${entry.name} · ${entry.faction || "Viajero"} · ${entry.cause || "Legado del mar"}`, location: entry.location || entry.island }))
    ], empty: "La gaceta no registra caídos ni fugas." }
  ];
  const tabs = document.createElement("div");
  tabs.className = "one-hud-tabs";
  const body = document.createElement("div");
  sections.forEach((section, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.append(iconNode(section.key === "news" ? "news" : section.key === "bounty" ? "bounty" : "gazette"), document.createTextNode(section.label));
    tab.setAttribute("aria-selected", String(index === 0));
    const panel = document.createElement("section");
    panel.className = "one-hud-tab-panel";
    panel.hidden = index !== 0;
    if (!section.items.length) {
      const empty = document.createElement("p");
      empty.textContent = section.empty;
      panel.append(empty);
    }
    for (const entry of section.items) {
      const location = newsLocation(entry, character);
      const details = document.createElement("details");
      details.className = "news-card";
      const summary = document.createElement("summary");
      const headline = typeof entry === "string" ? entry : entry.text || entry.title || "Noticia del mar";
      const isPlayer = character.name && headline.includes(character.name);
      const npcAppearance = section.key === "bounty" || isPlayer ? null : npcAppearanceFor(headline);
      if (npcAppearance || /se busca|bounty/i.test(headline)) {
        const portrait = document.createElement("canvas");
        portrait.width = 32;
        portrait.height = 32;
        portrait.className = "news-card-portrait";
        portrait.setAttribute("aria-hidden", "true");
        const portraitContext = portrait.getContext("2d");
        if (portraitContext) drawPixelAvatar(portraitContext, npcAppearance || (isPlayer ? character.appearance : {}));
        summary.append(portrait, document.createTextNode(headline));
      } else summary.textContent = headline;
      const detail = document.createElement("div");
      detail.className = "news-card-detail";
      const coordinates = document.createElement("p");
      coordinates.textContent = location
        ? `${location.name} · Coordenadas del mapa: X ${location.x}, Y ${location.y}`
        : "Coordenadas desconocidas para este evento.";
      const investigate = document.createElement("button");
      investigate.type = "button";
      investigate.className = "one-hud-action";
      investigate.textContent = "Investigar Zona";
      investigate.disabled = !location || character.status === "dead";
      if (location) investigate.addEventListener("click", () => onInvestigate(location));
      detail.append(coordinates, investigate);
      if (location) {
        const suggest = document.createElement("button");
        suggest.type = "button";
        suggest.className = "one-hud-action";
        suggest.textContent = "Sugerir Redirección de Rumbo";
        suggest.disabled = character.status === "dead";
        suggest.addEventListener("click", () => onSuggest(location));
        detail.append(suggest);
        const note = document.createElement("p");
        note.textContent = "Marca la zona en el globo; después puedes sugerir un cambio de rumbo.";
        detail.append(note);
      }
      details.append(summary, detail);
      panel.append(details);
    }
    tab.addEventListener("click", () => {
      [...tabs.children].forEach((item, i) => item.setAttribute("aria-selected", String(i === index)));
      [...body.children].forEach((item, i) => { item.hidden = i !== index; });
    });
    tabs.append(tab);
    body.append(panel);
  });
  container.append(tabs, body);
}

export function showSetup() {
  const wizard = byId("wizard-container");
  const game = byId("game-container");
  const reset = byId("reset-button");
  document.body.classList.add("wizard-active");
  if (wizard) { wizard.hidden = false; wizard.style.display = "grid"; }
  if (game) { game.hidden = true; game.style.display = "none"; }
  if (reset) reset.hidden = true;
  closeDialog("legacy-modal");
}

export function showGame() {
  const wizard = byId("wizard-container");
  const game = byId("game-container");
  const reset = byId("reset-button");
  document.body.classList.remove("wizard-active");
  if (wizard) { wizard.hidden = true; wizard.style.display = "none"; }
  if (game) { game.hidden = false; game.style.display = "block"; }
  if (reset) reset.hidden = false;
}

function closeDialog(id) {
  const dialog = byId(id);
  if (dialog?.open) dialog.close();
}
function renderList(list, entries, emptyText, toText) {
  if (!list) return;
  list.replaceChildren();
  if (!entries.length) {
    const item = document.createElement("li");
    item.textContent = emptyText;
    list.append(item);
    return;
  }
  entries.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = toText(entry);
    list.append(item);
  });
}
function categoryFor(message) {
  const text = String(message).toLocaleLowerCase("es");
  if (/victoria|derrota|combate|pelea|captur|ataque|haki/.test(text)) return { label: "[COMBATE]", className: "combat" };
  if (/recompensa|berries|renombre|cartel|reliquia|botín|botin/.test(text)) return { label: "[RECOMPENSA]", className: "reward" };
  if (/evento|noticia|facción|faccion|marina|cazarrecompensas|piratas rivales/.test(text)) return { label: "[EVENTO]", className: "event" };
  return { label: "[SISTEMA]", className: "system" };
}
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function appendHighlightedText(container, message, characterName) {
  const tokens = ["฿\\s*[\\d.,]+(?:\\s*BERRIES)?", "[\\d.,]+\\s*Berries"];
  if (characterName) tokens.push(escapeRegExp(characterName));
  const pattern = new RegExp(`(${tokens.join("|")})`, "gi");
  let cursor = 0;
  for (const match of message.matchAll(pattern)) {
    if (match.index > cursor) container.append(document.createTextNode(message.slice(cursor, match.index)));
    const strong = document.createElement("strong");
    strong.className = "log-highlight";
    strong.textContent = match[0];
    container.append(strong);
    cursor = match.index + match[0].length;
  }
  if (cursor < message.length) container.append(document.createTextNode(message.slice(cursor)));
}
function renderTerminalLog(list, entries, characterName) {
  if (!list) return;
  list.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("li");
    empty.textContent = "La bitácora aún está en blanco.";
    list.append(empty);
    return;
  }
  entries.forEach((entry) => {
    const item = document.createElement("li");
    const timestamp = document.createElement("time");
    timestamp.className = "log-time";
    timestamp.dateTime = entry.time ?? "";
    timestamp.textContent = `${time(entry.time)} `;
    const category = categoryFor(entry.message);
    const tag = document.createElement("strong");
    tag.className = `log-tag ${category.className}`;
    tag.textContent = category.label;
    item.append(timestamp, tag, document.createTextNode(" "));
    appendHighlightedText(item, String(entry.message ?? ""), characterName);
    list.append(item);
  });
}

export function renderGame(character) {
  if (!character) return;
  ensureAdvancedSystems(character);
  showGame();
  const world = character.world ?? { day: 0, year: 1, era: "Era de los Grandes Descubrimientos", news: [], pantheon: [] };
  const lineage = character.lineage ?? { family: character.name, generation: 1, legacyChest: [] };
  const soulCard = character.soulCard ?? { dream: "Libertad", traits: { pros: [], cons: [] } };
  const traits = [...(soulCard.traits?.pros ?? []), ...(soulCard.traits?.cons ?? [])];
  const dead = character.status === "dead";
  const paused = Boolean(character.autonomy?.paused) || dead;

  const textValues = {
    "character-name-display": character.name ?? "Aventurero",
    "level-badge": `Nivel ${character.level ?? 1} · Gen. ${lineage.generation ?? 1}`,
    "faction-display": `${character.faction ?? "Pirata"} · ${character.rank ?? "Novato"}`,
    "origin-display": character.originSea ?? "East Blue",
    "location-display": `${character.location?.island ?? "Puerto"} · ${character.location?.region ?? character.originSea ?? "East Blue"}`,
    "log-pose-display": `${character.logPose?.alignment ?? 0}/${character.logPose?.required ?? 3} alineamientos · Carga ${Math.round(character.travel?.logPoseCharge ?? 0)}%`,
    "dream-display": safe(soulCard.dream),
    "traits-display": traits.join(", ") || "Sin definir",
    "fruit-display": character.fruit ? `${character.fruit.name} (${character.fruit.type})` : "Ninguna",
    "bounty-display": `฿ ${number(character.bounty)} Berries`,
    "berries-display": `฿ ${number(character.berries)} Berries`,
    "health-value": `${character.stats?.health ?? 0}/${character.stats?.maxHealth ?? 100}`,
    "strength-value": character.stats?.strength ?? 0,
    "agility-value": character.stats?.agility ?? 0,
    "ingenuity-value": character.stats?.ingenuity ?? 0,
    "xp-display": `Renombre: ${number(character.reputation)} · Capturas: ${character.captures ?? 0} · XP: ${character.experience ?? 0}/${(character.level ?? 1) * 100}`
  };
  for (const [id, value] of Object.entries(textValues)) {
    const element = byId(id);
    if (element) element.textContent = String(value);
  }
  const haki = [];
  if (character.haki?.busoshoku) haki.push("Busoshoku · Armadura");
  if (character.haki?.kenbunshoku) haki.push("Kenbunshoku · Observación");
  if (character.haki?.haoshoku) haki.push("Haoshoku · Conquistador");
  if (byId("haki-display")) byId("haki-display").textContent = haki.length ? haki.join(", ") : "Sin despertar";
  const healthBar = byId("health-bar");
  if (healthBar) { healthBar.max = character.stats?.maxHealth ?? 100; healthBar.value = character.stats?.health ?? 0; }

  const minute = Number(world.minuteOfDay) || 0;
  const clock = byId("game-clock");
  if (clock) clock.textContent = `Día ${(Number(world.day) || 0) + 1} · ${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  const headerStatus = byId("header-avatar-status");
  if (headerStatus) {
    headerStatus.textContent = dead ? "● Avatar caído" : paused ? "● Avatar en pausa" : "● Avatar activo";
    headerStatus.classList.toggle("paused", paused && !dead);
    headerStatus.classList.toggle("dead", dead);
  }
  if (byId("sync-value")) byId("sync-value").textContent = `${character.whisper?.affinity ?? 55}%`;
  if (byId("sync-bar")) byId("sync-bar").value = character.whisper?.affinity ?? 55;
  if (byId("rebellion-value")) byId("rebellion-value").textContent = `Rebeldía: ${character.whisper?.rebellion ?? 45}%`;
  if (byId("whisper-input")) byId("whisper-input").disabled = dead;
  const whisperSubmit = byId("whisper-form")?.querySelector("button[type=submit]");
  if (whisperSubmit) whisperSubmit.disabled = dead;

  renderTerminalLog(byId("event-log"), character.log ?? [], character.name);
  if (byId("world-era")) byId("world-era").textContent = world.era ?? "Era de los Grandes Descubrimientos";
  if (byId("world-clock")) byId("world-clock").textContent = `Día ${world.day ?? 0} · Año ${world.year ?? 1} de 20 · ${world.era ?? "Era de los Grandes Descubrimientos"} · Linaje ${lineage.family ?? character.name}, generación ${lineage.generation ?? 1} · Cofre: ${(lineage.legacyChest ?? []).length} reliquia(s).`;
  const pantheon = world.pantheon ?? [];
  renderList(byId("pantheon-list"), pantheon.slice(0, 8), "Aún no hay leyendas en esta era.", (legend) => `${legend.name} · ${legend.family} · ${legend.faction} · Nivel ${legend.level} · ${number(legend.reputation)} renombre`);
  const sharedFallen = character.world?.shared?.world?.fallen_captains ?? [];
  renderList(byId("pantheon-modal-list"), [...sharedFallen, ...pantheon], "Aún no hay leyendas registradas.", (legend) => `${legend.name} · ${legend.cause || "Legado del mar"} · ${legend.island || legend.location || "mar abierto"}${(legend.maps || []).map((map) => ` · Tesoro X:${map.x} Y:${map.y}`).join("")}${(legend.notes || []).map((note) => ` · ${note.clue}`).join("")}`);
  renderList(byId("news-list"), world.news ?? [], "El mar aguarda sus primeras noticias.", (entry) => entry.text ?? String(entry));
  if (byId("treasure-count")) byId("treasure-count").textContent = String((lineage.legacyChest ?? []).length);
  renderList(byId("treasure-list"), lineage.legacyChest ?? [], "El cofre espera su primera reliquia.", (item) => String(item));

  const mission = character.mission ?? { title: "Explorar el mar", island: character.location?.island ?? "Mar abierto", enemy: "piratas rivales", status: "active", completed: 0 };
  if (byId("mission-title")) byId("mission-title").textContent = mission.status === "complete" ? `${mission.title} · completada` : mission.title;
  if (byId("mission-text")) byId("mission-text").textContent = mission.status === "complete"
    ? `Has asegurado ${mission.island}. Navega para continuar la ruta. Misiones completadas: ${mission.completed ?? 0}.`
    : `Isla: ${mission.island} · Objetivo: enfrentarse a ${mission.enemy}. Alinea el Log Pose con ${character.logPose?.required ?? 3} acciones de navegación para iniciar el desafío.`;
  const route = character.originSea === "East Blue"
    ? ["Isla Dawn", "Orange Town", "Villa Syrup", "Baratie", "Arlong Park", "Loguetown", "Reverse Mountain", "Paraíso", "Nuevo Mundo"]
    : [character.location?.island ?? "Isla inicial", "Loguetown", "Reverse Mountain", "Paraíso", "Nuevo Mundo"];
  const routeList = byId("expedition-route");
  if (routeList) {
    routeList.replaceChildren();
    route.forEach((island, index) => {
      const item = document.createElement("li");
      const currentIndex = Number(character.location?.routeIndex) || 0;
      item.textContent = `${index < currentIndex ? "✓" : index === currentIndex ? "●" : "○"} ${island}`;
      item.classList.toggle("current", index === currentIndex);
      item.classList.toggle("visited", index < currentIndex);
      routeList.append(item);
    });
  }
  const powers = [];
  if (character.haki?.busoshoku) powers.push("Haki de Armadura: aumenta el poder de ataque");
  if (character.haki?.kenbunshoku) powers.push("Haki de Observación: iniciativa y evasión");
  if (character.haki?.haoshoku) powers.push("Haki del Conquistador: posibilidad de dominar rivales");
  if (character.fruit) powers.push(`${character.fruit.technique || "Técnica de Akuma no Mi"}: ${character.fruit.name}`);
  if (byId("technique-text")) byId("technique-text").textContent = powers.length ? `Técnicas de combate · ${powers.join(" · ")}` : "Técnicas de combate · Entrena para despertar Haki o busca una Akuma no Mi.";
  const wanted = ["Pirata", "Revolucionario"].includes(character.faction) && Number(character.bounty) > 0;
  if (byId("wanted-poster")) byId("wanted-poster").classList.toggle("not-wanted", !wanted);
  if (byId("wanted-name")) byId("wanted-name").textContent = character.name ?? "Aventurero";
  if (byId("wanted-handle")) byId("wanted-handle").textContent = character.username ?? "Pirata desconocido";
  if (byId("wanted-bounty")) byId("wanted-bounty").textContent = wanted ? `฿ ${number(character.bounty)} BERRIES` : "SIN RECOMPENSA";
  if (byId("wanted-note")) byId("wanted-note").textContent = wanted ? `Vivo o muerto · ${character.location?.island ?? "Mar abierto"}` : character.faction === "Marine" ? "Marine en servicio · recompensa de captura" : "Las hazañas notorias generan un cartel de búsqueda.";

  const legacyPanel = byId("legacy-panel");
  if (legacyPanel) legacyPanel.hidden = !dead;
  if (dead) {
    const summary = `${character.name} cayó en ${character.location?.region ?? "el mar"}. Generación ${lineage.generation ?? 1} del linaje ${lineage.family ?? character.name}; se conservan ${(lineage.legacyChest ?? []).length} reliquias y parte del renombre.`;
    if (byId("death-summary")) byId("death-summary").textContent = summary;
    if (byId("death-summary-modal")) byId("death-summary-modal").textContent = summary;
    const modal = byId("legacy-modal");
    if (modal && !modal.open) modal.showModal();
  } else closeDialog("legacy-modal");
  const destination = character.navigationTarget;
  if (byId("map-destination")) byId("map-destination").textContent = destination ? `Zona seleccionada: ${destination.name} · ${destination.sea || "mar abierto"}.` : "Selecciona una zona para sugerir un rumbo.";
  renderMap(character);
}

const TRAITS = [
  { id: "Valiente", opposite: "Prudente" }, { id: "Astuto", opposite: "Impulsivo" },
  { id: "Impulsivo", opposite: "Prudente" }, { id: "Prudente", opposite: "Impulsivo" },
  { id: "Agresivo", opposite: "Honrado" }, { id: "Honrado", opposite: "Rebelde" },
  { id: "Rebelde", opposite: "Honrado" }, { id: "Leal", opposite: "Rebelde" }
];
let wizardInitialized = false;
let selectedTraits = [];
let currentStep = 0;
function updateWizardSummary() {
  const form = byId("character-form");
  if (!form) return;
  const values = {
    "summary-name": form.elements.namedItem("name")?.value.trim() || "Aventurero",
    "summary-handle": form.elements.namedItem("handle")?.value.trim() || "@usuario",
    "summary-faction": form.querySelector('[name="faction"]:checked')?.value || "Pirata",
    "summary-race": form.querySelector('[name="race"] option:checked')?.textContent || "Humano",
    "summary-sea": "Aleatorio",
    "summary-traits": selectedTraits.join(" / ") || "Elige dos rasgos",
    "summary-dream": form.querySelector('[name="dream"]:checked')?.value || "Libertad",
    "summary-alignment": form.querySelector('[name="alignment"]:checked')?.value || "Libertad"
  };
  for (const [id, value] of Object.entries(values)) if (byId(id)) byId(id).textContent = value;
  const avatarConfig = Object.fromEntries(["skin", "eyes", "hair", "outfit", "accessory"].map((key) => [key, form.elements.namedItem(key)?.value]));
  for (const id of ["wizard-avatar-preview", "wizard-portrait"]) {
    const canvas = byId(id), ctx = canvas?.getContext("2d");
    if (!ctx) continue;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0b1329";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / 128 * 2.3;
    drawPixelAvatar(ctx, avatarConfig, { x: canvas.width / 2 - 16 * scale, y: canvas.height * .06, scale, fullBody: true });
  }
}
function showWizardStep(index) {
  const steps = [...document.querySelectorAll(".wizard-step")];
  const nav = [...document.querySelectorAll(".progress-step")];
  if (!steps.length) return;
  currentStep = Math.max(0, Math.min(steps.length - 1, index));
  steps.forEach((step, i) => {
    step.hidden = i !== currentStep;
    step.classList.toggle("active", i === currentStep);
    step.setAttribute("aria-hidden", String(i !== currentStep));
  });
  nav.forEach((button, i) => { button.classList.toggle("active", i === currentStep); button.setAttribute("aria-current", i === currentStep ? "step" : "false"); });
  if (byId("prev-step")) byId("prev-step").hidden = currentStep === 0;
  if (byId("next-step")) byId("next-step").hidden = currentStep === steps.length - 1;
  if (byId("submit-step")) byId("submit-step").hidden = currentStep !== steps.length - 1;
  updateWizardSummary();
}
function updateTraitButtons() {
  document.querySelectorAll(".trait-card").forEach((card) => {
    const id = card.dataset.trait;
    const selected = selectedTraits.includes(id);
    const blocked = selectedTraits.some((chosen) => TRAITS.find((trait) => trait.id === chosen)?.opposite === id || TRAITS.find((trait) => trait.id === id)?.opposite === chosen);
    card.classList.toggle("selected", selected);
    card.classList.toggle("disabled", !selected && (blocked || selectedTraits.length >= 2));
    card.disabled = !selected && (blocked || selectedTraits.length >= 2);
  });
  const form = byId("character-form");
  if (form?.elements.namedItem("traitPrimary")) form.elements.namedItem("traitPrimary").value = selectedTraits[0] ?? "";
  if (form?.elements.namedItem("traitSecondary")) form.elements.namedItem("traitSecondary").value = selectedTraits[1] ?? "";
  updateWizardSummary();
}
export function initWizard() {
  if (wizardInitialized) return;
  wizardInitialized = true;
  const form = byId("character-form");
  if (!form) return;
  selectedTraits = [];
  document.querySelectorAll(".trait-card").forEach((button) => {
    if (!button) return;
    button.addEventListener("click", () => {
      const id = button.dataset.trait;
      if (selectedTraits.includes(id)) selectedTraits = selectedTraits.filter((trait) => trait !== id);
      else if (selectedTraits.length < 2) {
        const conflict = selectedTraits.some((chosen) => TRAITS.find((trait) => trait.id === chosen)?.opposite === id || TRAITS.find((trait) => trait.id === id)?.opposite === chosen);
        if (!conflict) selectedTraits.push(id);
      }
      updateTraitButtons();
    });
  });
  const nextButton = byId("next-step");
  if (nextButton) nextButton.addEventListener("click", () => {
    if (currentStep === 0) {
      const name = form.elements.namedItem("name");
      const handle = form.elements.namedItem("handle");
      if (name && !name.value.trim()) { name.reportValidity(); return; }
      if (handle && !/^@[a-zA-Z0-9_]{2,16}$/.test(handle.value.trim())) {
        handle.setCustomValidity("Usa @ seguido por 2-16 letras, números o guion bajo.");
        handle.reportValidity();
        handle.setCustomValidity("");
        return;
      }
    }
    if (currentStep === 2 && selectedTraits.length !== 2) { window.alert("Selecciona exactamente dos rasgos."); return; }
    showWizardStep(currentStep + 1);
  });
  const prevButton = byId("prev-step");
  if (prevButton) prevButton.addEventListener("click", () => showWizardStep(currentStep - 1));
  document.querySelectorAll(".progress-step").forEach((button) => {
    if (button) button.addEventListener("click", () => { const target = Number(button.dataset.stepNav) - 1; if (target <= currentStep) showWizardStep(target); });
  });
  form.addEventListener("input", updateWizardSummary);
  form.addEventListener("change", (event) => {
    if (event.target.name === "race" && byId("race-description")) byId("race-description").textContent = RACES[event.target.value]?.tagline || "";
    if (event.target.matches('input[name="faction"], input[name="dream"], input[name="alignment"]')) {
      const list = `${event.target.name}-list`;
      document.querySelectorAll(`#${list} .option-card, #${list} .dream-option`).forEach((card) => card.classList.toggle("selected", Boolean(card.querySelector("input[type=radio]")?.checked)));
    }
    updateWizardSummary();
  });
  showWizardStep(0);
  updateTraitButtons();
}
export function resetWizard() {
  selectedTraits = [];
  const form = byId("character-form");
  form?.reset();
  document.querySelectorAll(".trait-card").forEach((card) => { card.classList.remove("selected", "disabled"); card.disabled = false; });
  document.querySelectorAll("#faction-list .option-card, #dream-list .option-card, #alignment-list .option-card").forEach((card) => {
    card.classList.toggle("selected", Boolean(card.querySelector('input[type="radio"]')?.checked));
  });
  showWizardStep(0);
  updateWizardSummary();
  byId("wizard-container")?.scrollTo({ top: 0 });
  document.querySelector(".wizard-card")?.scrollTo({ top: 0 });
}
export function openPantheon() { const dialog = byId("pantheon-dialog"); if (dialog && !dialog.open) dialog.showModal(); }
export function closePantheon() { closeDialog("pantheon-dialog"); }
export function closeLegacyModal() { closeDialog("legacy-modal"); }
