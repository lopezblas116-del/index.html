import { newsLocation } from "../map.js";
import { ensureAdvancedSystems } from "../systems.js";
import { avatarEmotion, drawPixelAvatar, npcAppearanceFor } from "../island_renderer.js";
import { aggregateSmartFeed, formatMaritimeTimestamp, maritimeHeadline } from "../event_dispatcher.js";
import { animateCount } from "../vfx_engine.js";
import { isBiographyValid } from "../character_creation.js";
import { getLoreByKey } from "../world_lore.js";

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
      // Sin coordenadas crudas: el jugador no las escribe nunca. La zona se fija por nombre
      // y el mapa del mundo vivo vuela hasta ella con "Investigar Zona".
      coordinates.textContent = location
        ? `${location.name} · Zona marcada en el mapa del mundo`
        : "Zona aún sin descubrir.";
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
}

const TRAITS = [
  { id: "Valiente", opposite: "Prudente" }, { id: "Astuto", opposite: "Impulsivo" },
  { id: "Impulsivo", opposite: "Prudente" }, { id: "Prudente", opposite: "Impulsivo" },
  { id: "Agresivo", opposite: "Honrado" }, { id: "Honrado", opposite: "Rebelde" },
  { id: "Rebelde", opposite: "Honrado" }, { id: "Leal", opposite: "Rebelde" },
  { id: "Curioso", opposite: "Sereno" }, { id: "Sereno", opposite: "Curioso" },
  { id: "Feroz", opposite: "Noble" }, { id: "Noble", opposite: "Feroz" }
];
// ── El Gacha del Destino: raza y mar salen del azar; tres monedas para intentar ──
const RAZAS_GACHA = [
  ["human", "Humano", "Voluntad y aprendizaje rápido. El mar no les regaló nada: por eso llegan más lejos."],
  ["fishman", "Gyojin / Tritón", "Nació bajo el agua y la respiración del abismo. Puertos segregados lo mirarán raro."],
  ["mink", "Mink", "Pelo y trueno. Agilidad felina y una descarga eléctrica guardada en la sangre."],
  ["threeeye", "Tres Ojos", "Un tercer ojo que lee lo que otros no ven: glifos antiguos, mentiras, rumores."],
  ["giant", "Gigante", "El puño es la carta de presentación. Come doble y su casco va reforzado."],
  ["sky", "Habitante del Cielo", "Cayó del Mar Blanco. Las alturas lo llaman; el Mar Azul le pesa."],
  ["longlimb", "Extremidades Largas", "Brazos y piernas que alcanzan donde otros no llegan. Alcance marcial puro."],
  ["tontatta", "Tontatta", "Pequeño como una sombra, fuerte como un andamio. Sigilo nato."]
];
const MARES_GACHA = [
  ["East Blue", "Mar del Este", "El mar de los débiles… dicen. Ahí nacieron los que rompieron el mundo."],
  ["North Blue", "Mar del Norte", "Frío, ambicioso, cuentos de macetas y gigantes legales."],
  ["South Blue", "Mar del Sur", "Aguas suaves, puertos tranquilos: el mejor lugar para esconder un sueño."],
  ["West Blue", "Mar del Oeste", "Mafias del puerto y familias viejas. El que sale de ahí, sale duro."]
];
// ── constelaciones del carácter: dos rasgos fijan un rumbo con nombre propio ──
const CONSTELACIONES = {
  "Valiente|Impulsivo": ["Corazón de Tormenta", "No piensa el salto: lo salta. Los mares le temen al entusiasmo."],
  "Valiente|Prudente": ["Ojo del Huracán", "Ve la tormenta entera y entra igual, pero por la puerta buena."],
  "Astuto|Rebelde": ["Zorro del Archipiélago", "Nadie le dice por dónde; roba rutas como quien roba sonrisas."],
  "Astuto|Impulsivo": ["Chispa y Navaja", "Primero la idea, después el tajo. O al revés. Da igual: duele."],
  "Astuto|Prudente": ["Cartógrafo de Sombras", "Mide dos veces, corta ninguna. El peligro lo esquiva con mapa propio."],
  "Agresivo|Honrado": ["Lanza Justa", "Golpea primero, pide perdón nunca; su código es la única ley que reconoce."],
  "Agresivo|Rebelde": ["Bandido de Sal", "Contra toda bandera, contra toda corona. La revolución tiene su cara."],
  "Honrado|Leal": ["Juramento de Sal", "Su palabra pesa más que el ancla. Los que caen a su lado vuelven a casa."],
  "Honrado|Noble": ["Escudo del Puerto", "Protege antes de preguntar. Los débiles durmieron gracias a él."],
  "Leal|Noble": ["Farol del Linaje", "Una promesa no se rompe ni en calma belt. Ese es su destino y su arresto."],
  "Curioso|Astuto": ["Ojo del Siglo Perdido", "Cada ruina es una carta y cada rumor, un mapa. Poneglyphs le susurran."],
  "Curioso|Valiente": ["Brisa Exploradora", "Donde el mapa dice 'aquí hay dragones', él anota: 'descubrí uno'."],
  "Sereno|Noble": ["Calma del Faro", "Nada lo enciende ni lo apaga: sostiene. Su tripulación respira cuando él está."],
  "Sereno|Prudente": ["Vela Paciente", "Los vientos malos no lo frustran: los espera. Llega tarde, pero llega."],
  "Feroz|Impulsivo": ["Colmillo del Wano", "Ataca como si el arma fuera parte de la mano. Quizá lo sea."],
  "Feroz|Agresivo": ["Torbellino Rojo", "El combate es su idioma materno. La paz le hace ruido."],
  "Valiente|Leal": ["Espada de la Compañía", "Se lanza al agua si alguien cayó. No lo piensa: no es un pensamiento."],
  "Curioso|Sereno": ["Marea Contemplativa", "Observa el mar hasta que el mar explica. Sabe leer entre olas."],
  "Feroz|Rebelde": ["Colmillo Sin Amo", "No sirve a nadie, no teme a nada. Los emperadores lo conocen por nombre."],
  "Astuto|Noble": ["Moneda del Puerto", "Trata limpio, mide justo: hasta los piratas le firman contratos."]
};
const ATRIBUCION_RASGO = { Valiente: "Afronta peligros", Astuto: "Busca oportunidades", Impulsivo: "Ataca con decisión", Prudente: "Se retira a tiempo", Agresivo: "Presiona en combate", Honrado: "Sigue su código", Rebelde: "Defiende su autonomía", Leal: "Protege a los suyos", Curioso: "Investiga todo", Sereno: "Resiste la presión", Feroz: "Duplica su arrojo", Noble: "Inspirará lealtad" };
// ── trasfondo con dado: el mar te dio un pasado ──
export const HISTORIAS_DADO = [
  "Crecí en un astillero podrido de sal; sé de madera antes que de letras.",
  "Mi pueblo quemó una noche entera. Desde entonces no creo en casas: creo en barcos.",
  "Un viejo cocinero me enseñó a pelear con una cuchara. Nunca perdí el hambre.",
  "Fui marino de la Marina. Vi la justicia de cerca y preferí la libertad.",
  "Robé un mapa a un mercader sin saber qué era. El mapa me eligió.",
  "Mi familia pescaba calamares. Yo pesqué un rumor sobre una isla que no existe.",
  "Sobreviví a un naufragio con una tabla y una promesa. Ambas floran todavía.",
  "El tío que crió a mi padre era arpónero. La mar es un pariente entrometido.",
  "Robé fruta de una cuba sin saber qué era. El estómago me delató primero.",
  "Un sensei del dojo me echó por pelear sin honor. Volví cada día hasta que me abrió.",
  "Crecí escuchando historias al fuego sobre la Grand Line. Nunca creí: hasta que zarpé.",
  "Un mercader me compró siendo niño. Me escapé con su mejor traje y sin arrepentirme."
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
const COLORES_SWATCH = { Clara: "#e4b991", Bronceada: "#b77a4b", Oscura: "#754b35", Marrón: "#483126", Azul: "#2585a5", Verde: "#4b8c55", Gris: "#aab7bf", Negro: "#1c1b22", Moreno: "#543320", Rubio: "#d6a53c", Rojo: "#a43d2e", Blanco: "#e8e6e0" };
const NOMBRES_VESTIMENTA = { Rojo: "Chaleco carmesí", Azul: "Uniforme azul", Verde: "Chaqueta verde", Negro: "Abrigo oscuro", Marrón: "Cuero de puerto", Kimono: "Kimono de Wano", Manto: "Manto pirata", Gabardina: "Gabardina del norte" };
const NOMBRES_DETALLE = { Bandana: "Bandana roja", "Sombrero de paja": "Sombrero de paja", Tricornio: "Tricornio", "Gorra marina": "Gorra marina", Capucha: "Capucha", Aretes: "Aretes dorados", Collar: "Collar", Cicatriz: "Cicatriz", Ninguno: "Sin detalle" };
function filaSwatches(form, key, titulo, valores) {
  const fila = document.createElement("div"); fila.className = "swatch-fila";
  const label = document.createElement("span"); label.className = "swatch-titulo"; label.textContent = titulo;
  const grupo = document.createElement("div"); grupo.className = "swatch-grupo"; grupo.dataset.swatch = key;
  const select = form.elements.namedItem(key);
  for (const valor of valores) {
    const boton = document.createElement("button"); boton.type = "button"; boton.className = "swatch"; boton.dataset.valor = valor;
    boton.title = NOMBRES_VESTIMENTA[valor] || NOMBRES_DETALLE[valor] || valor;
    if (COLORES_SWATCH[valor]) { const chip = document.createElement("span"); chip.className = "swatch-chip"; chip.style.background = COLORES_SWATCH[valor]; boton.append(chip); }
    const texto = document.createElement("small"); texto.textContent = NOMBRES_VESTIMENTA[valor] || NOMBRES_DETALLE[valor] || valor;
    boton.append(texto);
    if (select && select.value === valor) boton.classList.add("selected");
    boton.addEventListener("click", () => {
      if (select) { select.value = valor; select.dispatchEvent(new Event("change", { bubbles: true })); }
      grupo.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("selected", s === boton));
    });
    grupo.append(boton);
  }
  fila.append(label, grupo);
  return fila;
}
function configureWizardLayout(form) {
  const original = [...form.querySelectorAll(".wizard-step")];
  if (original.length !== 5) return;
  const getField = (name) => form.elements.namedItem(name)?.closest("label");
  const visual = original[0], bandera = original[1], rasgosStep = original[2], destino = original[3], summary = original[4];
  // capturo TODOS los campos ANTES de reemplazar el DOM: replaceChildren los saca del form
  const identity = ["name", "handle"].map(getField).filter(Boolean);
  const ocultos = ["skin", "eyes", "hair", "outfit", "accessory"].map(getField).filter(Boolean);
  const campoProfesion = getField("profession"); // el oficio lo revela el mar, no un formulario
  const raceDesc = visual.querySelector("#race-description");
  const preview = visual.querySelector(".avatar-editor-preview");
  const storyField = getField("story");
  const viejaGrid = rasgosStep.querySelector(".trait-grid"); // el anillo reemplaza la grilla
  const hiddenTraits = [...rasgosStep.querySelectorAll('input[type="hidden"]')]; // traitPrimary/traitSecondary sobreviven al replace
  const factionList = bandera.querySelector("#faction-list");
  const dreamList = destino.querySelector("#dream-list");
  const aligFieldset = destino.querySelector(".alignment-field");

  // ── FASE 1 · Tu cara ante el mar ──
  visual.replaceChildren(stepHeader(1, "Tu cara ante el mar"));
  const cara = document.createElement("div"); cara.className = "fase-cara";
  const caraIzq = document.createElement("div"); caraIzq.className = "cara-preview";
  if (preview) caraIzq.append(preview);
  const dado = document.createElement("button"); dado.type = "button"; dado.className = "button button-secondary dado-historia"; dado.textContent = "🎲 El mar te dio un pasado";
  dado.addEventListener("click", () => {
    const ta = storyField?.querySelector("textarea");
    if (ta) { ta.value = HISTORIAS_DADO[Math.floor(Math.random() * HISTORIAS_DADO.length)]; ta.dispatchEvent(new Event("input", { bubbles: true })); }
  });
  caraIzq.append(dado);
  const caraDer = document.createElement("div"); caraDer.className = "cara-swatches";
  for (const [key, titulo, valores] of [
    ["skin", "Piel", ["Clara", "Bronceada", "Oscura"]],
    ["eyes", "Mirada", ["Marrón", "Azul", "Verde", "Gris"]],
    ["hair", "Cabello", ["Negro", "Moreno", "Rubio", "Rojo", "Blanco"]],
    ["outfit", "Vestimenta", ["Rojo", "Azul", "Verde", "Negro", "Marrón", "Kimono", "Manto", "Gabardina"]],
    ["accessory", "Detalle", ["Bandana", "Sombrero de paja", "Tricornio", "Gorra marina", "Capucha", "Aretes", "Collar", "Cicatriz", "Ninguno"]]
  ]) caraDer.append(filaSwatches(form, key, titulo, valores));
  cara.append(caraIzq, caraDer);
  if (storyField) {
    const ta = storyField.querySelector("textarea");
    if (ta) ta.required = false; // el dado puede contarlo; no es un formulario obligatorio
    const bloque = document.createElement("div"); bloque.className = "fase-historia";
    const p = document.createElement("p"); p.className = "muted"; p.textContent = "Tu pasado moldea conductas ocultas. Escribilo o dejá que el dado lo cuente.";
    const contador = document.createElement("p"); contador.id = "story-character-count"; contador.className = "muted small-text"; contador.textContent = "0 / 280";
    bloque.append(p, storyField, contador);
    cara.append(bloque);
  }
  // los selects ocultos vuelven al paso 1: son la fuente de verdad que leen los swatches
  for (const campo of ocultos) if (campo) { campo.hidden = true; visual.append(campo); }
  if (campoProfesion) { campoProfesion.hidden = true; visual.append(campoProfesion); }
  if (raceDesc) { raceDesc.hidden = true; visual.append(raceDesc); }
  identity.forEach((campo) => visual.append(campo));
  visual.append(cara);

  // ── FASE 2 · El Anillo del Carácter ──
  rasgosStep.replaceChildren(stepHeader(2, "El Anillo del Carácter"));
  rasgosStep.append(...hiddenTraits);
  const anillo = document.createElement("div"); anillo.className = "anillo-fase";
  const brujula = document.createElement("div"); brujula.className = "anillo-brujula"; brujula.id = "anillo-brujula"; brujula.setAttribute("aria-label", "Brújula del carácter");
  const aguja = document.createElement("span"); aguja.className = "anillo-aguja"; aguja.setAttribute("aria-hidden", "true");
  const centro = document.createElement("span"); centro.className = "anillo-centro"; centro.textContent = "✦";
  brujula.append(aguja, centro);
  const anilloRasgos = document.createElement("div"); anilloRasgos.className = "anillo-rasgos"; anilloRasgos.id = "anillo-rasgos";
  TRAITS.forEach((trait, i) => {
    const orbita = document.createElement("button"); orbita.type = "button"; orbita.className = "rasgo-orbita"; orbita.dataset.trait = trait.id;
    orbita.style.setProperty("--ang", `${i * (360 / TRAITS.length)}deg`);
    orbita.innerHTML = `<strong>${trait.id}</strong><small>${ATRIBUCION_RASGO[trait.id]}</small>`;
    anilloRasgos.append(orbita);
  });
  const constelacion = document.createElement("div"); constelacion.className = "constelacion-card"; constelacion.id = "constelacion-card"; constelacion.hidden = true;
  const pista = document.createElement("p"); pista.className = "muted"; pista.textContent = "Tocá dos rasgos: la brújula fijará tu rumbo y el mar le pondrá nombre.";
  anillo.append(brujula, anilloRasgos);
  rasgosStep.append(anillo, pista, constelacion);

  // ── FASE 3 · El Destino (gacha de tres monedas) ──
  destino.replaceChildren(stepHeader(3, "El Destino"));
  const gacha = document.createElement("div"); gacha.className = "fase-gacha";
  const monedas = document.createElement("div"); monedas.className = "monedas-destino"; monedas.id = "monedas-destino";
  for (let i = 0; i < 3; i++) { const m = document.createElement("span"); m.className = "moneda"; m.setAttribute("aria-hidden", "true"); monedas.append(m); }
  const rueda = document.createElement("div"); rueda.className = "rueda-destino"; rueda.id = "rueda-destino";
  const ruedaTexto = document.createElement("span"); ruedaTexto.className = "rueda-texto"; ruedaTexto.textContent = "El destino está por girar…";
  rueda.append(ruedaTexto);
  const invocar = document.createElement("button"); invocar.type = "button"; invocar.id = "invocar-destino"; invocar.className = "button button-primary"; invocar.textContent = "Invocar el destino";
  const resultado = document.createElement("div"); resultado.className = "resultado-destino"; resultado.id = "resultado-destino"; resultado.hidden = true;
  const notaGacha = document.createElement("p"); notaGacha.className = "muted"; notaGacha.textContent = "Ni tu raza ni tu mar se eligen: se sortean. Tenés tres monedas del destino para observar tu suerte.";
  gacha.append(notaGacha, monedas, rueda, invocar, resultado);
  destino.append(gacha);

  // ── FASE 4 · La Bandera del Alma (bando + sueños + tarjeta) ──
  bandera.replaceChildren(stepHeader(4, "La Bandera del Alma"));
  const fase4 = document.createElement("div"); fase4.className = "fase-bandera";
  if (factionList && !factionList.querySelector('[value="Autonomo"]')) {
    const opcion = document.createElement("label"); opcion.className = "option-card selected bandera-autonoma";
    const radio = document.createElement("input"); radio.type = "radio"; radio.name = "faction"; radio.value = "Autonomo"; radio.checked = true;
    opcion.append(radio, Object.assign(document.createElement("span"), { textContent: "🌫 El avatar elige" }), Object.assign(document.createElement("small"), { textContent: "Sus actos eligen la bandera. Nadie la pone por vos." }));
    factionList.prepend(opcion);
  }
  const motivationDescription = document.createElement("p"); motivationDescription.id = "dream-description"; motivationDescription.className = "muted";
  const secBandera = document.createElement("section"); secBandera.className = "wizard-choice-section";
  const hBandera = document.createElement("h4"); hBandera.textContent = "¿Bajo qué bandera zarpás?";
  secBandera.append(hBandera, ...(factionList ? [factionList] : []));
  const secSueno = document.createElement("section"); secSueno.className = "wizard-choice-section";
  const hSueno = document.createElement("h4"); hSueno.textContent = "El sueño que tira del hilo";
  secSueno.append(hSueno, ...(dreamList ? [dreamList] : []), motivationDescription);
  const secGuia = document.createElement("section"); secGuia.className = "wizard-choice-section";
  const hGuia = document.createElement("h4"); hGuia.textContent = "La estrella que guía";
  if (aligFieldset) secGuia.append(aligFieldset);
  const secTarjeta = document.createElement("section"); secTarjeta.className = "wizard-choice-section";
  const hTarjeta = document.createElement("h4"); hTarjeta.textContent = "Tu Tarjeta del Alma";
  secTarjeta.append(hTarjeta, ...[...summary.children]);
  fase4.append(secBandera, secSueno, secGuia, secTarjeta);
  bandera.append(fase4);
  summary.remove();
  destino.hidden = false; rasgosStep.hidden = false; bandera.hidden = false;

  // orden físico de las fases en el DOM: cara → carácter → destino → bandera
  const acciones = form.querySelector(".wizard-actions");
  if (acciones) { form.insertBefore(rasgosStep, acciones); form.insertBefore(destino, acciones); form.insertBefore(bandera, acciones); }

  // navegación de fases: barra fina, sin círculos ni numeración que tickea
  const nav = form.closest("#wizard-container")?.querySelector(".wizard-progress");
  nav?.replaceChildren();
  for (const [index, label] of ["Tu cara", "El carácter", "El destino", "La bandera"].entries()) {
    const paso = document.createElement("span"); paso.className = "fase-paso"; paso.dataset.stepNav = String(index + 1);
    paso.textContent = label;
    if (index === 0) paso.classList.add("active");
    nav?.append(paso);
  }
}
function updateWizardSummary() {
  const form = byId("character-form");
  if (!form) return;
  const factionElegida = form.querySelector('[name="faction"]:checked')?.value || "Autonomo";
  const resultado = byId("resultado-destino");
  let traitsResumen = selectedTraits.join(" + ") || "Elige dos rasgos";
  if (selectedTraits.length === 2) {
    const buscar = (a, b) => CONSTELACIONES[`${a}|${b}`] || CONSTELACIONES[`${b}|${a}`];
    const hit = buscar(selectedTraits[0], selectedTraits[1]);
    if (hit) traitsResumen = `${hit[0]} (${selectedTraits.join(" + ")})`;
  }
  const values = {
    "summary-name": form.elements.namedItem("name")?.value.trim() || "Aventurero",
    "summary-handle": form.elements.namedItem("handle")?.value.trim() || "@usuario",
    "summary-faction": factionElegida === "Autonomo" ? "La revelan sus actos" : factionElegida,
    "summary-race": resultado?.dataset.raceNombre || "Azar al zarpar",
    "summary-profession": "Lo revelará el mar",
    "summary-sea": resultado?.dataset.seaNombre || "Azar al zarpar",
    "summary-traits": traitsResumen,
    "summary-dream": form.querySelector('[name="dream"]:checked')?.value || "Libertad",
    "summary-alignment": form.querySelector('[name="alignment"]:checked')?.value || "Libertad"
  };
  for (const [id, value] of Object.entries(values)) if (byId(id)) byId(id).textContent = value;
  const avatarConfig = Object.fromEntries(["skin", "eyes", "hair", "outfit", "accessory"].map((key) => [key, form.elements.namedItem(key)?.value]));
  avatarConfig.race = form.elements.namedItem("race")?.value || "human";
  for (const id of ["wizard-avatar-preview", "wizard-portrait"]) {
    const canvas = byId(id), ctx = canvas?.getContext("2d");
    if (!ctx) continue;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0b1329";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / 128 * 1.15;
    drawPixelAvatar(ctx, avatarConfig, { x: canvas.width / 2 - 32 * scale, y: canvas.height * .06, scale, fullBody: true, size: 64, time: Date.now(), race: avatarConfig.race });
  }
  const story = form.elements.namedItem("story")?.value || "";
  if (byId("story-character-count")) byId("story-character-count").textContent = `${story.length} / 280`;
  const dream = form.querySelector('[name="dream"]:checked')?.value || "Libertad";
  const motivationText = {
    Libertad: "Abrir rutas nuevas y proteger la autonomía de la tripulación.",
    Poder: "Entrenar, superar rivales y buscar una posición de mando.",
    Riqueza: "Buscar oportunidades, tesoros y mercados rentables.",
    Fama: "Convertir cada hazaña en una historia que recorra los mares.",
    Lazos: "Zarpar con gente que vuelva a casa contigo: la tripulación es familia.",
    Conocimiento: "Descifrar el mundo: ruinas, calcos y la verdad del siglo perdido.",
    Destrucción: "Hundir lo que te encadenó; que el mar recuerde tu nombre por el estruendo.",
    Justicia: "Defender a quienes no pueden protegerse."
  };
  if (byId("dream-description")) byId("dream-description").textContent = motivationText[dream] || "Tu sueño influirá en las decisiones autónomas.";
}
function updateTraitButtons() {
  const orbitas = [...document.querySelectorAll(".rasgo-orbita")];
  orbitas.forEach((card) => {
    const id = card.dataset.trait;
    const selected = selectedTraits.includes(id);
    const blocked = !selected && (selectedTraits.some((chosen) => TRAITS.find((t) => t.id === chosen)?.opposite === id || TRAITS.find((t) => t.id === id)?.opposite === chosen) || selectedTraits.length >= 2);
    card.classList.toggle("selected", selected);
    card.classList.toggle("disabled", blocked);
    card.disabled = blocked;
  });
  const form = byId("character-form");
  if (form?.elements.namedItem("traitPrimary")) form.elements.namedItem("traitPrimary").value = selectedTraits[0] ?? "";
  if (form?.elements.namedItem("traitSecondary")) form.elements.namedItem("traitSecondary").value = selectedTraits[1] ?? "";
  // la aguja del anillo: un rasgo fija el rumbo, dos rasgos apuntan al punto medio
  const brujula = byId("anillo-brujula");
  if (brujula) {
    const ANGULOS = {};
    TRAITS.forEach((t, i) => { ANGULOS[t.id] = i * (360 / TRAITS.length); });
    let ang = 0;
    if (selectedTraits.length === 2) {
      const a = ANGULOS[selectedTraits[0]], b = ANGULOS[selectedTraits[1]];
      const delta = Math.abs(a - b);
      ang = Math.min(a, b) + (delta > 180 ? (360 - delta) / 2 : delta / 2);
    } else if (selectedTraits.length === 1) ang = ANGULOS[selectedTraits[0]];
    brujula.style.setProperty("--compass-angle", `${ang}deg`);
  }
  const card = byId("constelacion-card");
  if (card) {
    if (selectedTraits.length === 2) {
      const buscar = (a, b) => CONSTELACIONES[`${a}|${b}`] || CONSTELACIONES[`${b}|${a}`];
      const hit = buscar(selectedTraits[0], selectedTraits[1]);
      const nombre = hit ? hit[0] : `Rumbo sin mapa · ${selectedTraits[0]} y ${selectedTraits[1]}`;
      const texto = hit ? hit[1] : "Nadie más lleva exactamente este rumbo: el mar lo anotará en tu bitácora.";
      card.innerHTML = `<strong>✦ ${nombre}</strong><p>${texto}</p><small>${ATRIBUCION_RASGO[selectedTraits[0]]} · ${ATRIBUCION_RASGO[selectedTraits[1]]}</small>`;
      card.hidden = false; card.classList.add("revelada");
    } else { card.hidden = true; card.classList.remove("revelada"); }
  }
  updateWizardSummary();
}
let monedasRestantes = 3;
function actualizarMonedas() {
  const invocarBtn = byId("invocar-destino");
  const monedas = [...(byId("monedas-destino")?.children || [])];
  monedas.forEach((m, i) => m.classList.toggle("gastada", i >= monedasRestantes));
  if (invocarBtn) {
    invocarBtn.textContent = monedasRestantes > 1 ? `Invocar el destino · ${monedasRestantes} monedas` : monedasRestantes === 1 ? "Última moneda del destino" : "El destino no cambia tres veces";
    invocarBtn.disabled = monedasRestantes <= 0;
  }
}
function girarDestino() {
  const rueda = byId("rueda-destino");
  if (!rueda || monedasRestantes <= 0) return;
  monedasRestantes -= 1;
  actualizarMonedas();
  rueda.classList.add("girando");
  const pasos = 12 + Math.floor(Math.random() * 6);
  let paso = 0;
  const slot = () => {
    if (paso++ < pasos) {
      const r = RAZAS_GACHA[Math.floor(Math.random() * RAZAS_GACHA.length)];
      const m = MARES_GACHA[Math.floor(Math.random() * MARES_GACHA.length)];
      const texto = rueda.querySelector(".rueda-texto");
      if (texto) texto.textContent = `${r[1]} · ${m[1]}`;
      setTimeout(slot, 65 + paso * 10);
      return;
    }
    rueda.classList.remove("girando");
    const [raceId, raceNombre, raceTexto] = RAZAS_GACHA[Math.floor(Math.random() * RAZAS_GACHA.length)];
    const [seaId, seaNombre, seaTexto] = MARES_GACHA[Math.floor(Math.random() * MARES_GACHA.length)];
    const textoFinal = rueda.querySelector(".rueda-texto");
    if (textoFinal) textoFinal.textContent = `${raceNombre} · ${seaNombre}`;
    const form = byId("character-form");
    if (form.elements.namedItem("race")) form.elements.namedItem("race").value = raceId;
    if (form.elements.namedItem("originSea")) form.elements.namedItem("originSea").value = seaId;
    const resultado = byId("resultado-destino");
    if (resultado) {
      resultado.dataset.raceNombre = raceNombre;
      resultado.dataset.seaNombre = seaNombre;
      resultado.hidden = false;
      resultado.innerHTML = `<strong>${raceNombre}</strong><p>${raceTexto}</p><small>Mar de origen: <b>${seaNombre}</b> — ${seaTexto}</small>${monedasRestantes === 0 ? `<em class="destino-final">El destino no cambia tres veces: zarpá con lo que te dio.</em>` : ""}`;
    }
    updateWizardSummary();
  };
  setTimeout(slot, 80);
}
function showWizardStep(index) {
  const steps = [...document.querySelectorAll(".wizard-step")];
  const nav = [...document.querySelectorAll(".fase-paso")];
  if (!steps.length) return;
  currentStep = Math.max(0, Math.min(steps.length - 1, index));
  steps.forEach((step, i) => {
    step.hidden = i !== currentStep;
    step.classList.toggle("active", i === currentStep);
    step.setAttribute("aria-hidden", String(i !== currentStep));
  });
  nav.forEach((paso, i) => paso.classList.toggle("active", i === currentStep));
  if (byId("prev-step")) byId("prev-step").hidden = currentStep === 0;
  if (byId("next-step")) byId("next-step").hidden = currentStep === steps.length - 1;
  if (byId("submit-step")) byId("submit-step").hidden = currentStep !== steps.length - 1;
  updateWizardSummary();
}
export function initWizard() {
  if (wizardInitialized) return;
  wizardInitialized = true;
  const form = byId("character-form");
  if (!form) return;
  configureWizardLayout(form);
  selectedTraits = [];
  // el Anillo del Carácter: cada orbe es un rasgo
  document.querySelectorAll(".rasgo-orbita").forEach((button) => {
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
  byId("invocar-destino")?.addEventListener("click", girarDestino);
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
    if (currentStep === 1 && selectedTraits.length !== 2) {
      const card = byId("constelacion-card");
      if (card) { card.hidden = false; card.classList.add("revelada"); card.innerHTML = `<strong>El anillo espera dos rasgos</strong><p>Tocá dos orbes del anillo: la brújula gira con cada uno.</p>`; }
      return;
    }
    if (currentStep === 2 && !form.elements.namedItem("race")?.value) {
      girarDestino(); // si no invocaste el destino, el destino te invoca: una tirada gratis
      if (monedasRestantes <= 0) { showWizardStep(currentStep + 1); return; }
      return;
    }
    showWizardStep(currentStep + 1);
  });
  const prevButton = byId("prev-step");
  if (prevButton) prevButton.addEventListener("click", () => showWizardStep(currentStep - 1));
  form.addEventListener("input", (event) => updateWizardSummary());
  form.addEventListener("change", (event) => {
    if (event.target.matches('input[name="faction"], input[name="dream"], input[name="alignment"]')) {
      const list = `${event.target.name}-list`;
      document.querySelectorAll(`#${list} .option-card, #${list} .dream-option`).forEach((card) => card.classList.toggle("selected", Boolean(card.querySelector("input[type=radio]")?.checked)));
    }
    updateWizardSummary();
  });
  showWizardStep(0);
  updateTraitButtons();
  actualizarMonedas();
}
export function resetWizard() {
  selectedTraits = [];
  monedasRestantes = 3;
  const form = byId("character-form");
  form?.reset();
  form?.elements.namedItem("story")?.setCustomValidity("");
  if (form?.elements.namedItem("race")) form.elements.namedItem("race").value = "";
  if (form?.elements.namedItem("originSea")) form.elements.namedItem("originSea").value = "";
  document.querySelectorAll(".rasgo-orbita").forEach((card) => { card.classList.remove("selected", "disabled"); card.disabled = false; });
  document.querySelectorAll("#faction-list .option-card, #dream-list .option-card, #alignment-list .option-card").forEach((card) => {
    card.classList.toggle("selected", Boolean(card.querySelector('input[type="radio"]')?.checked));
  });
  const resultado = byId("resultado-destino");
  if (resultado) { resultado.hidden = true; delete resultado.dataset.raceNombre; delete resultado.dataset.seaNombre; resultado.innerHTML = ""; }
  const rueda = byId("rueda-destino");
  if (rueda) { rueda.classList.remove("girando"); const texto = rueda.querySelector(".rueda-texto"); if (texto) texto.textContent = "El destino está por girar…"; }
  const brujula = byId("anillo-brujula");
  if (brujula) brujula.style.setProperty("--compass-angle", "0deg");
  const card = byId("constelacion-card");
  if (card) { card.hidden = true; card.classList.remove("revelada"); }
  showWizardStep(0);
  updateWizardSummary();
  actualizarMonedas();
  byId("wizard-container")?.scrollTo({ top: 0 });
  document.querySelector(".wizard-card")?.scrollTo({ top: 0 });
}
export function openPantheon() { const dialog = byId("pantheon-dialog"); if (dialog && !dialog.open) dialog.showModal(); }
export function closePantheon() { closeDialog("pantheon-dialog"); }
export function closeLegacyModal() { closeDialog("legacy-modal"); }
