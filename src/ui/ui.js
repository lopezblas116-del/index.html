import { newsLocation } from "../map.js";
import { ISLAND_VIEW, renderMap, returnToGlobalMap } from "../world3d.js";
import { ensureAdvancedSystems } from "../systems.js";
import { avatarEmotion, drawPixelAvatar, npcAppearanceFor } from "../island_renderer.js";
import { canReadAncient } from "../archaeology_system.js";
import { aggregateSmartFeed, formatMaritimeTimestamp, maritimeHeadline } from "../event_dispatcher.js";
import { animateCount } from "../vfx_engine.js";
import { isBiographyValid } from "../character_creation.js";
import { getLoreByKey } from "../world_lore.js";
import { islandEncountersFor } from "../island_encounters.js";

const byId = (id) => document.getElementById(id);
const number = (value) => new Intl.NumberFormat("es-ES").format(Number(value) || 0);
const time = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--:--" : new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(date);
};
const safe = (value, fallback = "—") => value ?? fallback;
function isPersonalNews(entry, character) {
  const name = String(character?.name || "");
  const actor = String(entry?.captainName || entry?.actor || entry?.actorName || "");
  const ownerId = String(entry?.captainId || entry?.actorId || entry?.ownerId || "");
  const text = String(entry?.text || entry?.message || entry?.title || "");
  return Boolean(name && (actor === name || text.includes(name))) || Boolean(character?.id && ownerId === String(character.id));
}
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

function renderIslandEncounters(island, character, present) {
  const section = byId("island-encounters");
  if (!section) return;
  section.replaceChildren();
  const encounters = present ? islandEncountersFor(island, character) : [];
  if (!encounters.length) {
    section.hidden = true;
    return;
  }
  const heading = document.createElement("h3");
  heading.textContent = "Encuentros del puerto";
  section.append(heading);
  for (const encounter of encounters) {
    const card = document.createElement("article");
    card.className = "island-encounter-card";
    const title = document.createElement("h4");
    title.textContent = encounter.title;
    const description = document.createElement("p");
    description.textContent = encounter.description;
    card.append(title, description);
    if (encounter.warning) {
      const warning = document.createElement("p");
      warning.className = "island-encounter-warning";
      warning.textContent = encounter.warning;
      card.append(warning);
    }
    const decide = document.createElement("button");
    decide.type = "button";
    decide.textContent = encounter.buttonLabel;
    decide.addEventListener("click", () => document.dispatchEvent(new CustomEvent("onepiece:hud-politics", { detail: { action: encounter.action } })));
    card.append(decide);
    section.append(card);
  }
  section.hidden = false;
}

export function renderIslandView(character) {
  islandCharacter = character;
  if (!islandView || !character) return;
  const present = isAtIsland(character, islandView);
  const localWorld = character.world?.shared?.world;
  const islandControl = localWorld?.islands_control?.find((entry) => entry.island_id === islandView.id);
  const key = `${islandView.id}:${character.id}:${present}:${character.appearance?.skin || ""}:${character.ancientLanguage?.knowledge || 0}:${character.location?.localVenue?.id || ""}:${character.localSuggestion || ""}:${character.world?.day || 0}:${character.world?.lastTributeDay ?? ""}:${character.soulCard?.alignment || ""}:${islandControl?.faction || ""}:${character.revolutionarySupport?.sabotagedIslands?.includes(islandView.id) || false}:${character.world?.nobleAlert || false}`;
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
    if (poi.type === "poneglyph" && !canReadAncient(character)) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "island-hotspot";
    button.setAttribute("aria-label", `${poi.name}; sugerencia opcional, el avatar decide si la sigue`);
    button.title = poi.name;
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
  renderIslandEncounters(islandView, character, present);
  const loreNote = byId("island-lore");
  if (loreNote) {
    const requestedIsland = islandView.id;
    loreNote.textContent = "La bitácora consulta las cartas locales…";
    getLoreByKey(islandView.name).then((lore) => {
      if (islandView?.id !== requestedIsland || !loreNote.isConnected) return;
      loreNote.textContent = `${lore.description} Riesgos: ${lore.hazards.join(" · ")}.`;
      loreNote.dataset.loreSource = lore.procedural ? "procedural" : "indexed";
    }).catch((error) => {
      if (islandView?.id !== requestedIsland || !loreNote.isConnected) return;
      loreNote.textContent = `La carta local no está disponible: ${error.message}`;
    });
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
    { key: "important", label: "Lo importante", items: aggregateSmartFeed([
      ...globalEvents.filter((entry) => entry.type !== "global_chat"),
      ...(world.news ?? []),
      ...(shared?.bounties_leaderboard ?? []).map((entry) => ({ type: "bounty", text: `${entry.yonkou ? "YONKOU · " : ""}SE BUSCA · ${entry.name} · ฿${number(entry.bounty)} Berries` })),
      ...(shared?.bosses ?? []).filter((boss) => boss.status === "fugitive" && boss.secret_location).map((boss) => ({
        type: "fugitive-contract",
        title: `Orden de recaptura: ${boss.name}`,
        text: `${boss.name} escapó de prisión y está reuniendo fuerzas cerca de una guarida desconocida.`,
        reward: boss.reward || 500000,
        coordinates: boss.secret_location,
        location: boss.hideout || boss.name
      })),
      ...(shared?.fallen_captains ?? []).map((entry) => ({ text: `${entry.name} · ${entry.faction || "Viajero"} · ${entry.cause || "Legado del mar"}`, location: entry.location || entry.island })),
      ...(world.pantheon ?? []).map((entry) => ({ text: `${entry.name} · ${entry.faction || "Viajero"} · ${entry.cause || "Legado del mar"}`, location: entry.location || entry.island }))
    ].filter((entry) => !isPersonalNews(entry, character)), { location: character.location?.island || "", name: character.name }), empty: "No hay noticias importantes todavía." },
    { key: "personal", label: "Lo mío", items: aggregateSmartFeed([
      ...globalEvents.filter((entry) => entry.type !== "global_chat"),
      ...(world.news ?? [])
    ].filter((entry) => isPersonalNews(entry, character)).concat(
      Number(character.bounty) > 0 ? [{ type: "bounty", location: character.location?.island, text: `SE BUSCA · ${character.name} · ฿${number(character.bounty)} Berries` }] : []
    ), { location: character.location?.island || "", name: character.name }), empty: "Tu bitácora aún no registra titulares propios." }
  ];
  const tabs = document.createElement("div");
  tabs.className = "one-hud-tabs";
  const body = document.createElement("div");
  sections.forEach((section, index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.append(iconNode(section.key === "important" ? "news" : "ship"), document.createTextNode(section.label));
    tab.setAttribute("aria-selected", String(index === 0));
    const panel = document.createElement("section");
    panel.className = "one-hud-tab-panel";
    panel.hidden = index !== 0;
    if (section.key === "personal" && Number(character.bounty) > 0) {
      const poster = document.createElement("article");
      poster.className = "one-hud-wanted-poster";
      const portrait = document.createElement("canvas");
      portrait.width = 64;
      portrait.height = 64;
      portrait.className = "one-hud-wanted-portrait";
      portrait.setAttribute("aria-label", `Retrato pixelado de ${character.name}`);
      const portraitContext = portrait.getContext("2d");
      if (portraitContext) drawPixelAvatar(portraitContext, character.appearance, { size: 64, equipment: character.equipped, emotion: avatarEmotion(character) });
      const details = document.createElement("div");
      const stamp = document.createElement("strong");
      stamp.textContent = "SE BUSCA";
      const wantedName = document.createElement("h3");
      wantedName.textContent = character.name || "Aventurero";
      const reward = document.createElement("p");
      reward.className = "one-hud-wanted-reward";
      reward.dataset.countTarget = String(Number(character.bounty) || 0);
      reward.textContent = Number(character.bounty) > 0 ? `฿ ${number(character.bounty)} BERRIES` : "SIN RECOMPENSA";
      details.append(stamp, wantedName, reward);
      poster.append(portrait, details);
      panel.append(poster);
    }
    if (!section.items.length) {
      const empty = document.createElement("p");
      empty.textContent = section.empty;
      panel.append(empty);
    }
    for (const [entryIndex, entry] of section.items.entries()) {
      const location = newsLocation(entry, character);
      const details = document.createElement("details");
      details.className = "news-card";
      const summary = document.createElement("summary");
      const press = maritimeHeadline(entry, entryIndex);
      const headline = typeof entry === "string" ? entry : entry.text || entry.message || entry.title || press.headline;
      const isPlayer = character.name && headline.includes(character.name);
      const npcAppearance = isPlayer ? null : npcAppearanceFor(headline);
      const icon = document.createElement("span");
      icon.className = `news-card-icon news-card-icon-${press.category}`;
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = press.icon;
      const timestamp = document.createElement("time");
      timestamp.className = "news-card-time";
      timestamp.textContent = formatMaritimeTimestamp(entry, {
        day: world.day,
        minuteOfDay: world.minuteOfDay,
        location: location?.name || character.location?.island || character.location?.region || "Mar abierto"
      });
      const displayedHeadline = press.category === "battle"
        ? entry?.message || entry?.text || press.headline
        : press.headline;
      if (npcAppearance || /se busca|bounty/i.test(headline)) {
        const portrait = document.createElement("canvas");
        portrait.width = 64;
        portrait.height = 64;
        portrait.className = "news-card-portrait";
        portrait.setAttribute("aria-hidden", "true");
        const portraitContext = portrait.getContext("2d");
        if (portraitContext) drawPixelAvatar(portraitContext, npcAppearance || (isPlayer ? character.appearance : {}), { size: 64, equipment: isPlayer ? character.equipped : {}, emotion: isPlayer ? avatarEmotion(character) : "neutral" });
        summary.append(timestamp, icon, portrait, document.createTextNode(displayedHeadline));
      } else summary.append(timestamp, icon, document.createTextNode(displayedHeadline));
      const detail = document.createElement("div");
      detail.className = "news-card-detail";
      const story = entry?.text || entry?.message;
      if (story && story !== displayedHeadline) {
        const paragraph = document.createElement("p");
        paragraph.textContent = story;
        detail.append(paragraph);
      }
      if (entry?.type === "fugitive-contract") {
        const reward = document.createElement("p");
        reward.textContent = `Contrato de recaptura · Recompensa: ฿${number(entry.reward)} Berries`;
        detail.append(reward);
        const pursue = document.createElement("button");
        pursue.type = "button";
        pursue.className = "one-hud-action";
        pursue.textContent = "Buscar la guarida";
        pursue.disabled = character.status === "dead";
        pursue.addEventListener("click", () => onSuggest(location));
        detail.append(pursue);
      }
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
  const loreHint = document.createElement("aside");
  loreHint.className = "news-lore-note";
  loreHint.textContent = "La Gaceta consulta las cartas de la región…";
  container.append(loreHint);
  const loreQuery = character.location?.island || character.location?.region;
  getLoreByKey(loreQuery).then((lore) => {
    if (!loreHint.isConnected) return;
    const seed = lore.newsSeeds[(Number(character.world?.day) || 0) % lore.newsSeeds.length];
    loreHint.textContent = `Rumores de ${lore.title}: ${seed}. Riesgo de la ruta: ${lore.hazards[0]}.`;
  }).catch((error) => {
    if (loreHint.isConnected) loreHint.textContent = `Las cartas de prensa no están disponibles: ${error.message}`;
  });
}

export function showSetup() {
  const wizard = byId("wizard-container");
  const game = byId("game-container");
  const reset = byId("reset-button");
  document.body.classList.add("wizard-active");
  document.body.classList.remove("game-active");
  if (wizard) { wizard.hidden = false; wizard.style.display = "grid"; }
  if (game) { game.hidden = true; game.style.display = "none"; }
  if (reset) reset.hidden = true;
  closeDialog("legacy-modal");
  animateWizardPreview();
}

export function showGame() {
  const wizard = byId("wizard-container");
  const game = byId("game-container");
  const reset = byId("reset-button");
  document.body.classList.remove("wizard-active");
  document.body.classList.add("game-active");
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
function renderTerminalLog(list, entries, characterName, location = "") {
  if (!list) return;
  list.replaceChildren();
  const feed = aggregateSmartFeed(entries, { name: characterName, location });
  if (!feed.length) {
    const empty = document.createElement("li");
    empty.textContent = "La bitácora aún está en blanco.";
    list.append(empty);
    return;
  }
  feed.forEach((entry) => {
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
  const experienceBar = byId("xp-bar");
  if (experienceBar) { experienceBar.max = Math.max(100, (character.level ?? 1) * 100); experienceBar.value = character.experience ?? 0; }

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

  renderTerminalLog(byId("event-log"), character.log ?? [], character.name, character.location?.island || "");
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
  if (byId("wanted-bounty")) {
    const bounty = byId("wanted-bounty");
    if (wanted) animateCount(bounty, character.bounty, (value) => `฿ ${number(value)} BERRIES`);
    else { bounty.dataset.countTarget = "0"; bounty.textContent = "SIN RECOMPENSA"; }
  }
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
let previewFrame = 0;
function animateWizardPreview() {
  if (previewFrame || typeof globalThis.requestAnimationFrame !== "function") return;
  let lastDraw = 0;
  const draw = (timestamp) => {
    previewFrame = 0;
    if (byId("wizard-container")?.hidden || document.hidden) return;
    if (timestamp - lastDraw >= 250) {
      lastDraw = timestamp;
      updateWizardSummary();
    }
    previewFrame = globalThis.requestAnimationFrame(draw);
  };
  previewFrame = globalThis.requestAnimationFrame(draw);
}
function stepHeader(number, title) {
  const header = document.createElement("div");
  header.className = "step-header";
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = `Fase ${number} / 4`;
  const heading = document.createElement("h3");
  heading.textContent = title;
  header.append(eyebrow, heading);
  return header;
}
function moveStepContent(step) {
  const content = [...step.children].filter((child) => !child.classList.contains("step-header"));
  content.forEach((child) => child.remove());
  return content;
}
function configureWizardLayout(form) {
  const original = [...form.querySelectorAll(".wizard-step")];
  if (original.length !== 5) return;
  const appearanceGrid = original[0].querySelector(".appearance-grid");
  const getField = (name) => form.elements.namedItem(name)?.closest("label");
  const visual = original[0], race = original[1], story = original[2], direction = original[3];
  const summary = original[4];
  const choiceSections = [
    { source: original[1], title: "Bando", content: moveStepContent(original[1]) },
    { source: original[2], title: "Rasgos de conducta", content: moveStepContent(original[2]) },
    { source: direction, title: "Motivación y alineación", content: moveStepContent(direction) },
    { source: summary, title: "Retrato del alma", content: moveStepContent(summary) }
  ];
  const visualFields = ["name", "handle", "skin", "eyes", "hair", "outfit", "accessory"].map(getField).filter(Boolean);
  const raceFields = ["profession"].map(getField).filter(Boolean);
  const storyField = getField("story");
  const raceDescription = appearanceGrid?.querySelector("#race-description");
  const preview = appearanceGrid?.querySelector(".avatar-editor-preview");

  const visualGrid = document.createElement("div");
  visualGrid.className = "appearance-grid";
  visualFields.forEach((field) => visualGrid.append(field));
  if (preview) visualGrid.append(preview);
  visual.replaceChildren(stepHeader(1, "Aspecto visual"));
  visual.append(visualGrid);

  const raceContent = document.createElement("div");
  raceContent.className = "appearance-grid";
  if (raceDescription) raceDescription.textContent = "La raza y el mar se asignan al azar al pulsar ¡Zarpar!.";
  raceContent.append(...raceFields, ...(raceDescription ? [raceDescription] : []));
  race.replaceChildren(stepHeader(2, "Raza y origen al azar"), raceContent);

  const storyContent = document.createElement("div");
  storyContent.className = "story-phase";
  const storyHeading = document.createElement("p");
  storyHeading.className = "muted";
  storyHeading.textContent = "Resume tu origen en hasta 280 caracteres. Algunas palabras pueden moldear un rasgo oculto de conducta.";
  const storyCount = document.createElement("p");
  storyCount.id = "story-character-count";
  storyCount.className = "muted small-text";
  storyCount.textContent = "0 / 280";
  if (storyField) {
    const textarea = storyField.querySelector("textarea");
    if (textarea) {
      textarea.maxLength = 280;
      textarea.required = true;
    }
    storyContent.append(storyField, storyCount);
  }
  story.replaceChildren(stepHeader(3, "Trasfondo escrito"), storyHeading, storyContent);

  const directionContent = document.createElement("div");
  directionContent.className = "direction-phase";
  for (const { title, content } of choiceSections) {
    const section = document.createElement("section");
    section.className = "wizard-choice-section";
    const heading = document.createElement("h4");
    heading.textContent = title;
    section.append(heading, ...content);
    directionContent.append(section);
  }
  direction.replaceChildren(stepHeader(4, "Bando y brújula"), directionContent);
  original[4].remove();

  const nav = form.closest("#wizard-container")?.querySelector(".wizard-progress");
  nav?.replaceChildren();
  for (const [index, label] of ["Aspecto", "Raza y origen", "Trasfondo", "Brújula"].entries()) {
    const button = document.createElement("button");
    button.className = "progress-step";
    button.type = "button";
    button.dataset.stepNav = String(index + 1);
    if (index === 0) button.classList.add("active");
    const number = document.createElement("span");
    number.className = "step-number";
    number.textContent = String(index + 1);
    const text = document.createElement("span");
    text.className = "step-label";
    text.textContent = label;
    button.append(number, text);
    nav?.append(button);
  }

  const compass = document.createElement("div");
  compass.className = "ideology-compass";
  compass.id = "ideology-compass";
  compass.setAttribute("aria-label", "Brújula ideológica animada");
  const needle = document.createElement("span");
  needle.className = "ideology-compass-needle";
  needle.setAttribute("aria-hidden", "true");
  compass.append(needle);
  directionContent.prepend(compass);
  const motivationDescription = document.createElement("p");
  motivationDescription.id = "dream-description";
  motivationDescription.className = "muted";
  const dreamList = directionContent.querySelector("#dream-list");
  const factionList = directionContent.querySelector("#faction-list");
  if (factionList && !factionList.querySelector('[value="Revolucionario"]')) {
    const option = document.createElement("label");
    option.className = "option-card";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "faction";
    radio.value = "Revolucionario";
    const label = document.createElement("span");
    label.textContent = "🕊 Revolucionario";
    option.append(radio, label);
    factionList.append(option);
  }
  if (dreamList && !dreamList.querySelector('[value="Justicia"]')) {
    const justice = document.createElement("label");
    justice.className = "option-card";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "dream";
    radio.value = "Justicia";
    const label = document.createElement("span");
    label.textContent = "⚖ Justicia";
    justice.append(radio, label);
    dreamList.append(justice);
  }
  dreamList?.after(motivationDescription);
}
function updateWizardSummary() {
  const form = byId("character-form");
  if (!form) return;
  const values = {
    "summary-name": form.elements.namedItem("name")?.value.trim() || "Aventurero",
    "summary-handle": form.elements.namedItem("handle")?.value.trim() || "@usuario",
    "summary-faction": form.querySelector('[name="faction"]:checked')?.value || "Pirata",
    "summary-race": "Azar al zarpar",
    "summary-profession": form.querySelector('[name="profession"] option:checked')?.textContent || "Navegante",
    "summary-sea": "Azar al zarpar",
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
    const scale = canvas.width / 128 * 1.15;
    drawPixelAvatar(ctx, avatarConfig, { x: canvas.width / 2 - 32 * scale, y: canvas.height * .06, scale, fullBody: true, size: 64, time: Date.now() });
  }
  const story = form.elements.namedItem("story")?.value || "";
  if (byId("story-character-count")) byId("story-character-count").textContent = `${story.length} / 280`;
  updateMotivationCompass(form);
}
function updateMotivationCompass(form) {
  const motivation = form.querySelector('[name="dream"]:checked')?.value || "Libertad";
  const motivationText = {
    Libertad: "Abrir rutas nuevas y proteger la autonomía de la tripulación.",
    Poder: "Entrenar, superar rivales y buscar una posición de mando.",
    Riqueza: "Buscar oportunidades, tesoros y mercados rentables.",
    Fama: "Convertir cada hazaña en una historia que recorra los mares.",
    Justicia: "Defender a quienes no pueden protegerse."
  };
  if (byId("dream-description")) byId("dream-description").textContent = motivationText[motivation] || "Tu sueño influirá en las decisiones autónomas.";
  const angle = { Libertad: 0, Justicia: 90, Poder: 180, Caos: 270 }[form.querySelector('[name="alignment"]:checked')?.value || "Libertad"] || 0;
  byId("ideology-compass")?.style.setProperty("--compass-angle", `${angle}deg`);
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
  configureWizardLayout(form);
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
    if (currentStep === 2) {
      const story = form.elements.namedItem("story");
      if (story && !isBiographyValid(story.value)) {
        story.setCustomValidity("Escribe tu historia de origen en un máximo de 280 caracteres.");
        story.reportValidity();
        return;
      }
    }
    if (currentStep === 3 && selectedTraits.length !== 2) { window.alert("Selecciona exactamente dos rasgos."); return; }
    showWizardStep(currentStep + 1);
  });
  const prevButton = byId("prev-step");
  if (prevButton) prevButton.addEventListener("click", () => showWizardStep(currentStep - 1));
  document.querySelectorAll(".progress-step").forEach((button) => {
    if (button) button.addEventListener("click", () => { const target = Number(button.dataset.stepNav) - 1; if (target <= currentStep) showWizardStep(target); });
  });
  form.addEventListener("input", (event) => {
    if (event.target.name === "story") event.target.setCustomValidity("");
    updateWizardSummary();
  });
  form.addEventListener("change", (event) => {
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
  form?.elements.namedItem("story")?.setCustomValidity("");
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
