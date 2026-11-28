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

function marDeTexto(texto, mapa) {
  const t = String(texto || "");
  for (const [nombre, reg] of Object.entries(mapa)) if (nombre && t.includes(nombre)) return reg;
  return null;
}
// la región del mundo vivo en la que está el personaje (canon de mares)
function regionDelPersonaje(character) {
  const D = globalThis.D;
  if (!D?.MAR_POR_ISLA) return null;
  const isla = String(character?.location?.island || "");
  if (!isla) return null;
  for (const [nombre, reg] of Object.entries(D.MAR_POR_ISLA)) if (nombre && (isla.includes(nombre) || nombre.includes(isla))) return reg;
  return null;
}
export function renderNewspaper(container, character, onInvestigate, onSuggest) {
  const world = character.world ?? {};
  const shared = world.shared?.world;
  const globalEvents = shared?.global_events ?? [];
  // EL HUESO DEL CANON: "Mi mar" narra solo lo que ocurre en TU mar.
  // Lo que pasa en otro Blue queda en "Lo importante", no inunda tu bitácora.
  const marDelJugador = regionDelPersonaje(character);
  const mapaMares = globalThis.D?.MAR_POR_ISLA ?? {};
  const nombreMar = (globalThis.D?.NOMBRE_MAR || {})[marDelJugador] || "";
  const fuentesMundo = [
    ...globalEvents.filter((entry) => entry.type !== "global_chat"),
    ...(world.news ?? [])
  ];
  const eventosMiMar = marDelJugador ? fuentesMundo.filter((entry) => {
    const reg = marDeTexto(entry.text, mapaMares);
    return !reg || reg === marDelJugador || isPersonalNews(entry, character);
  }) : fuentesMundo;
  const sections = [
    { key: "mimar", label: nombreMar ? `Mi mar · ${nombreMar}` : "Mi mar", items: aggregateSmartFeed(eventosMiMar, { location: character.location?.island || "", name: character.name }), empty: "En tu mar reina la calma… por ahora. Navegá para que el mundo te cuente cosas." },
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
    const iconoPestaña = { mimar: "bounty", important: "news", personal: "ship" }[section.key] || "news";
    tab.append(iconNode(iconoPestaña), document.createTextNode(section.label));
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
  loreHint.textContent = "Bitácora del Mar consulta las cartas de la región…";
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
  // EL MUNDO YA VIVE MIENTRAS CREAS TU PERSONAJE: tormentas, barcos, día y noche
  // corren de fondo — la portada flota sobre un mar vivo, no sobre un vacío negro.
  if (game) {
    game.hidden = false; game.style.display = "";
    // el mapa nació oculto: al revelarlo, que recalcule su tamaño y empiece a pintar
    if (window.MAPA?.resize) requestAnimationFrame(() => window.MAPA.resize());
    // y la cámara mira el MAR VIVO (no el espacio del globo: la esfera caería
    // justo detrás de la tarjeta). Barcos, tormentas e islas venden el juego solos.
    if (window.MAPA?.volar && window.D) {
      requestAnimationFrame(() => window.MAPA.volar(window.D.W * 0.62, window.D.H * 0.55, 0.85, 1800));
    }
    // a prueba de cache: ocultar por inline lo que no debe verse durante la creación
    ["mil-chip", "mil-almas-ui", "mar-sonido-btn"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.setProperty("display", "none");
    });
  }
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
  // zarpar despierta el mundo: lo que la creación ocultó por inline (orbe,
  // chip del mar, sonido) vuelve a la vista — un solo juego, siempre vivo.
  ["mil-chip", "mil-almas-ui", "mar-sonido-btn"].forEach((id) => {
    document.getElementById(id)?.style.removeProperty("display");
  });
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
  const recienZarpado = document.body.classList.contains("wizard-active"); // solo el PRIMER zarpe, no reanudar
  ensureAdvancedSystems(character);
  showGame();
  // EL ZARPE TIENE LLEGADA: recién al crear (no al reanudar), la cámara entrega a TU
  // isla de origen. La fuente de verdad es el MOTOR (sim.user.isl → D.ISLA): el nombre
  // del mapa raíz no siempre coincide con la isla fusion. Con reintentos cortos por si
  // el motor despierta después del render.
  if (recienZarpado && window.MAPA?.enfocarIsla) {
    let intentos = 0;
    const llegada = () => {
      const u = window.JUEGO?.sim?.user;
      const isla = (u && window.D?.ISLA?.[u.isl]) || (window.D?.ISLAS && window.D.ISLAS.find((x) => x.n === character.location?.island));
      if (isla) window.MAPA.enfocarIsla(isla);
      else if (++intentos < 10) setTimeout(llegada, 400);
    };
    setTimeout(llegada, 500);
  }
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

  const pantheon = world.pantheon ?? [];
  const sharedFallen = character.world?.shared?.world?.fallen_captains ?? [];
  renderList(byId("pantheon-modal-list"), [...sharedFallen, ...pantheon], "Aún no hay leyendas registradas.", (legend) => `${legend.name} · ${legend.cause || "Legado del mar"} · ${legend.island || legend.location || "mar abierto"}${(legend.maps || []).map((map) => ` · Tesoro X:${map.x} Y:${map.y}`).join("")}${(legend.notes || []).map((note) => ` · ${note.clue}`).join("")}`);

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
// las razas pesan según el lore: el humano es la base del mundo (87%);
// el 13% restante se reparte entre las linajes raras que el mar guarda
const RAZAS_GACHA = [
  ["human", "Humano", "Voluntad y aprendizaje rápido. El mar no les regaló nada: por eso llegan más lejos.", 87],
  ["fishman", "Gyojin / Tritón", "Nació bajo el agua y la respiración del abismo. Puertos segregados lo mirarán raro.", 3.2],
  ["mink", "Mink", "Pelo y trueno. Agilidad felina y una descarga eléctrica guardada en la sangre.", 2.6],
  ["threeeye", "Tres Ojos", "Un tercer ojo que lee lo que otros no ven: glifos antiguos, mentiras, rumores.", 1.8],
  ["giant", "Gigante", "El puño es la carta de presentación. Come doble y su casco va reforzado.", 0.9],
  ["sky", "Habitante del Cielo", "Cayó del Mar Blanco. Las alturas lo llaman; el Mar Azul le pesa.", 1.2],
  ["longlimb", "Extremidades Largas", "Brazos y piernas que alcanzan donde otros no llegan. Alcance marcial puro.", 1.6],
  ["tontatta", "Tontatta", "Pequeño como una sombra, fuerte como un andamio. Sigilo nato.", 0.7]
];
const MARES_GACHA = [
  ["East Blue", "Mar del Este", "El mar de los débiles… dicen. Ahí nacieron los que rompieron el mundo.", 40],
  ["North Blue", "Mar del Norte", "Frío, ambicioso, cuentos de macetas y gigantes legales.", 20],
  ["South Blue", "Mar del Sur", "Aguas suaves, puertos tranquilos: el mejor lugar para esconder un sueño.", 20],
  ["West Blue", "Mar del Oeste", "Mafias del puerto y familias viejas. El que sale de ahí, sale duro.", 20]
];
// sorteo ponderado: el azar respeta el peso del mundo, no una tómbola plana
function sortearConPeso(tabla) {
  const total = tabla.reduce((suma, fila) => suma + (fila[3] || 1), 0);
  let dado = Math.random() * total;
  for (const fila of tabla) {
    dado -= fila[3] || 1;
    if (dado <= 0) return fila;
  }
  return tabla[tabla.length - 1];
}
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
// el precio de cada rasgo: lo que gana y lo que le cuesta viviendo con él
const PRECIO_RASGO = {
  Valiente: { pros: "Entra primero donde otros dudan; el mar premia al que no titubea.", cons: "Puede ignorar el descanso cuando no debería." },
  Astuto: { pros: "Encuentra la grieta en todo plan enemigo y en todo contrato.", cons: "Calcula tanto que a veces deja pasar el momento." },
  Impulsivo: { pros: "Golpea cuando el rival aún está pensando la frase.", cons: "Se expone a daño: el cuerpo paga las prisas." },
  Prudente: { pros: "Se retira a tiempo y vive para la próxima isla.", cons: "Evita algunos riesgos… y algunas glorias." },
  Agresivo: { pros: "Presiona en combate hasta que la línea rival se rompe.", cons: "El ímpetu cuesta sangre cuando la pelea es pareja." },
  Honrado: { pros: "Su palabra pesa: los puertos le abren puertas por eso.", cons: "Rechaza conductas desleales aunque paguen bien." },
  Rebelde: { pros: "Nadie decide por él; su rumbo es solo suyo.", cons: "Desconfía de los consejos… incluso de los tuyos." },
  Leal: { pros: "Protege a los suyos hasta el último palmo de cubierta.", cons: "Se ata a sus compromisos aunque duelan." },
  Curioso: { pros: "Investiga todo: ruinas, rumores, bodegas prohibidas.", cons: "La curiosidad abre puertas que conviene no abrir." },
  Sereno: { pros: "Resiste la presión: en la tormenta, es el único que respira lento.", cons: "La calma puede leerse como frialdad entre nakamas." },
  Feroz: { pros: "Duplica su arrojo cuando la batalla se pone fea.", cons: "El freno existe… pero casi nunca lo usa." },
  Noble: { pros: "Inspirará lealtad: la gente lo sigue sin que lo pida.", cons: "Carga con los problemas ajenos como si fueran suyos." }
};
const GANCHOS_RASGO = {
  Valiente: "Los mares respetan a los que llegan primero.",
  Astuto: "Cada contrato tiene una grieta; tú la ves.",
  Impulsivo: "El mundo es de los que no esperan el turno.",
  Prudente: "Los que se retiran a tiempo, llegan lejos.",
  Agresivo: "La arena del coliseo susurra tu nombre.",
  Honrado: "Tu nombre valdrá más que tu recompensa.",
  Rebelde: "Ninguna bandera te va a conformar… salvo la que pintes vos.",
  Leal: "Los nakamas que hoy caen, mañana vuelven por vos.",
  Curioso: "Los mapas viejos te van a llamar por tu nombre.",
  Sereno: "En la tormenta, todos mirarán hacia vos.",
  Feroz: "Hay hambres que solo el combate calman.",
  Noble: "Tu tripulación será una familia, no una nómina."
};
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
// la bandera: ¿ya la tocó el jugador? (mientras no, se borda sola con lo elegido)
let banderaTocada = false;
// gancho interno: configureWizardLayout lo llena para que updateTraitButtons
// pueda rebordar el emblema cuando la constelación cambia
let rebordarBandera = null;
let pintaBandera = null; // configurado por configureWizardLayout: repinta los lienzos de bandera

// ── LA BANDERA DEL ALMA: el momento firma de la creación ──
// Cuatro capas de decisión (campo, patrón, emblema, firma) + nombre de tripulación.
// El diseño se guarda como datos compactos y la MISMA función lo pinta a cualquier
// escala: lienzo del wizard, chip del capitán, tarjeta del alma y escena de izada.
const BANDERA_CAMPOS = [
  ["negro", "Negro jolly", "#181820"], ["rojo", "Rojo tormenta", "#a12f2a"],
  ["azul", "Azul marino", "#1d3a6e"], ["verde", "Verde esmeralda", "#1e5e42"],
  ["morado", "Morado profundo", "#4a2a6e"], ["oro", "Oro viejo", "#a97b1e"],
  ["gris", "Gris tormenta", "#3d4451"], ["blanco", "Blanco hueso", "#e8e2d2"]
];
const BANDERA_PATRONES = [
  ["liso", "Liso"], ["franja-h", "Franjas horizontales"], ["franja-v", "Franjas verticales"],
  ["cruz", "Cruz completa"], ["rombos", "Rombos"], ["media-luna", "Media luna"], ["rayo", "Rayo central"]
];
const BANDERA_EMBLEMAS = [
  ["calavera", "Calavera clásica"], ["paja", "Calavera de paja"], ["cicatriz", "Calavera con cicatriz"],
  ["ancla", "Ancla"], ["espadas", "Espadas cruzadas"], ["estrella", "Estrella del norte"],
  ["ala", "Ala de dragón"], ["mano", "Mano alzada"], ["guitarra", "Guitarra"],
  ["boticario", "Cruz de boticario"], ["luna", "Luna y estrella"]
];
const BANDERA_FIRMAS = [
  ["oro", "Oro", "#f4b41a"], ["rojo", "Rojo", "#d64541"], ["celeste", "Celeste", "#5fd0e8"],
  ["blanco", "Blanco", "#f2f0e6"], ["negro", "Negro", "#111118"], ["verde", "Verde", "#67c98a"],
  ["rosa", "Rosa", "#e08fb8"], ["violeta", "Violeta", "#9b7ce0"], ["cobre", "Cobre", "#c97a3d"], ["turquesa", "Turquesa", "#3fa896"]
];
const BANDERA_TRIPULACIONES = [
  "Los Piratas del Alba", "La Bandada del Sur", "Los Corsarios de Sal", "La Niebla Errante",
  "Los Hijos del Muelle", "La Marea Roja", "Los del Norte Lejano", "La Compañía del Coco",
  "Los Vientos Libres", "La Flota del Amanecer"
];
// emblema que pide cada constelación: la bandera se borda con lo ya elegido
const BANDERA_POR_CONSTELACION = {
  "Corazón de Tormenta": "rayo", "Ojo del Huracán": "estrella", "Zorro del Archipiélago": "luna",
  "Chispa y Navaja": "espadas", "Cartógrafo de Sombras": "estrella", "Lanza Justa": "espadas",
  "Bandido de Sal": "calavera", "Juramento de Sal": "ancla", "Escudo del Puerto": "ancla",
  "Farol del Linaje": "estrella", "Ojo del Siglo Perdido": "boticario", "Brisa Exploradora": "estrella",
  "Calma del Faro": "estrella", "Vela Paciente": "ancla", "Colmillo del Wano": "espadas",
  "Torbellino Rojo": "espadas", "Espada de la Compañía": "espadas", "Marea Contemplativa": "luna",
  "Colmillo Sin Amo": "calavera", "Moneda del Puerto": "ancla"
};
const BANDERA_POR_FACCION = { Pirata: "calavera", Marine: "ancla", Revolucionario: "ala", Aventurero: "estrella", Autonomo: "estrella" };

function disenoBanderaDe(form) {
  const get = (name, fallback) => form.elements.namedItem(name)?.value || fallback;
  return {
    campo: get("flagCampo", "negro"), patron: get("flagPatron", "liso"),
    emblema: get("flagEmblema", "calavera"), acentoA: get("flagAcentoA", "oro"),
    acentoB: get("flagAcentoB", "rojo"), tripulacion: get("flagTripulacion", "")
  };
}
function colorBandera(tabla, clave, fallback = "#181820") {
  return tabla.find(([id]) => id === clave)?.[2] || fallback;
}
// El renderizador único de la bandera: tela, patrón, emblema y firma.
// `t` anima la onda; el mismo dibujo sirve a 420px o a 30px de chip.
export function drawFlag(ctx, diseno, w, h, t = 0) {
  const campo = colorBandera(BANDERA_CAMPOS, diseno.campo);
  const firmaA = colorBandera(BANDERA_FIRMAS, diseno.acentoA, "#f4b41a");
  const firmaB = colorBandera(BANDERA_FIRMAS, diseno.acentoB, "#d64541");
  const oscuro = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${(n >> 16) * 0.55 | 0},${((n >> 8) & 255) * 0.55 | 0},${(n & 255) * 0.55 | 0})`;
  };
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = campo;
  ctx.fillRect(0, 0, w, h);
  // patrón de fondo
  ctx.fillStyle = oscuro(campo);
  const osc = oscuro(campo);
  if (diseno.patron === "franja-h") {
    const franjas = 3, alto = h / (franjas * 2);
    for (let i = 0; i < franjas; i++) ctx.fillRect(0, (i * 2 + 1) * alto, w, alto);
  } else if (diseno.patron === "franja-v") {
    const franjas = 3, ancho = w / (franjas * 2);
    for (let i = 0; i < franjas; i++) ctx.fillRect((i * 2 + 1) * ancho, 0, ancho, h);
  } else if (diseno.patron === "cruz") {
    const grosor = h * 0.16;
    ctx.fillRect(0, h / 2 - grosor / 2, w, grosor);
    ctx.fillRect(w * 0.36, 0, grosor, h);
  } else if (diseno.patron === "rombos") {
    const paso = h / 4;
    for (let fila = 0; fila < 4; fila++) for (let col = 0; col < Math.ceil(w / paso); col++) {
      const cx = col * paso + (fila % 2 ? paso / 2 : 0), cy = fila * paso + paso / 2, r = paso * 0.18;
      ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.fill();
    }
  } else if (diseno.patron === "media-luna") {
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.52, h * 0.42, Math.PI * 0.15, Math.PI * 0.95); ctx.lineWidth = Math.max(2, h * 0.1); ctx.strokeStyle = osc; ctx.stroke();
  } else if (diseno.patron === "rayo") {
    ctx.beginPath();
    ctx.moveTo(w * 0.52, h * 0.1); ctx.lineTo(w * 0.36, h * 0.55); ctx.lineTo(w * 0.5, h * 0.55);
    ctx.lineTo(w * 0.44, h * 0.92); ctx.lineTo(w * 0.62, h * 0.42); ctx.lineTo(w * 0.49, h * 0.42);
    ctx.closePath(); ctx.fill();
  }
  // emblema central
  ctx.fillStyle = firmaA;
  ctx.strokeStyle = firmaA;
  const cx = w / 2, cy = h / 2, s = h * 0.26;
  const calavera = (radio, conPaja, cicatriz) => {
    ctx.beginPath(); ctx.arc(cx, cy - radio * 0.25, radio, 0, 7); ctx.fill();
    ctx.fillRect(cx - radio * 0.62, cy + radio * 0.32, radio * 1.24, radio * 0.52);
    // ojos y nariz en el color del campo para que se lean
    ctx.save(); ctx.fillStyle = campo;
    ctx.beginPath(); ctx.arc(cx - radio * 0.42, cy - radio * 0.32, radio * 0.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + radio * 0.42, cy - radio * 0.32, radio * 0.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy - radio * 0.02); ctx.lineTo(cx - radio * 0.14, cy + radio * 0.26); ctx.lineTo(cx + radio * 0.14, cy + radio * 0.26); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (conPaja) {
      ctx.save(); ctx.fillStyle = firmaB;
      ctx.beginPath(); ctx.ellipse(cx, cy - radio * 1.05, radio * 1.3, radio * 0.42, 0, Math.PI, 0); ctx.fill();
      ctx.fillRect(cx - radio * 1.3, cy - radio * 1.12, radio * 2.6, radio * 0.14);
      ctx.restore();
    }
    if (cicatriz) {
      ctx.save(); ctx.strokeStyle = firmaB; ctx.lineWidth = Math.max(1.5, radio * 0.16);
      ctx.beginPath(); ctx.moveTo(cx - radio * 0.95, cy - radio * 0.9); ctx.lineTo(cx - radio * 0.5, cy + radio * 0.3); ctx.stroke();
      ctx.restore();
    }
  };
  switch (diseno.emblema) {
    case "paja": calavera(s, true, false); break;
    case "cicatriz": calavera(s, false, true); break;
    case "ancla": {
      ctx.lineWidth = Math.max(2, s * 0.16); ctx.beginPath();
      ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s * 0.7);
      ctx.moveTo(cx - s * 0.55, cy - s * 0.35); ctx.lineTo(cx + s * 0.55, cy - s * 0.35);
      ctx.moveTo(cx - s * 0.75, cy + s * 0.25); ctx.quadraticCurveTo(cx, cy + s * 1.15, cx + s * 0.75, cy + s * 0.25);
      ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy - s * 1.05, s * 0.18, 0, 7); ctx.fill();
      break;
    }
    case "espadas": {
      ctx.lineWidth = Math.max(2, s * 0.16);
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + dir * s, cy - s);
        ctx.lineTo(cx - dir * s * 0.8, cy + s * 0.85);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - dir * s * 0.95, cy + s * 0.55); ctx.lineTo(cx - dir * s * 0.65, cy + s * 0.95); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(cx, cy + s * 0.35, s * 0.14, 0, 7); ctx.fill();
      break;
    }
    case "estrella": {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * (Math.PI * 4 / 5);
        const px = cx + Math.cos(a) * s, py = cy + Math.sin(a) * s;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
    case "ala": {
      ctx.beginPath();
      ctx.moveTo(cx - s * 1.1, cy + s * 0.6);
      ctx.quadraticCurveTo(cx - s * 0.4, cy - s * 1.1, cx + s * 0.9, cy - s * 0.75);
      ctx.quadraticCurveTo(cx + s * 0.2, cy - s * 0.3, cx + s * 0.35, cy + s * 0.6);
      ctx.closePath(); ctx.fill();
      break;
    }
    case "mano": {
      ctx.lineWidth = Math.max(2, s * 0.22);
      ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.9); ctx.lineTo(cx, cy - s * 0.15); ctx.stroke();
      for (const dx of [-0.5, -0.17, 0.17, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * s * 0.5, cy - s * 0.15);
        ctx.lineTo(cx + dx * s * 0.72, cy - s * (dx === 0.17 ? 1.05 : 0.7));
        ctx.stroke();
      }
      break;
    }
    case "guitarra": {
      ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.45, s * 0.42, s * 0.5, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy - s * 0.25, s * 0.26, s * 0.3, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.fillStyle = campo; ctx.beginPath(); ctx.arc(cx, cy + s * 0.45, s * 0.14, 0, 7); ctx.fill(); ctx.restore();
      ctx.fillRect(cx - s * 0.06, cy - s * 1.05, s * 0.12, s * 0.85);
      break;
    }
    case "boticario": {
      const g = s * 0.62;
      ctx.fillRect(cx - g / 6, cy - g, g / 3, g * 2);
      ctx.fillRect(cx - g, cy - g / 6, g * 2, g / 3);
      break;
    }
    case "luna": {
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.8, Math.PI * 0.28, Math.PI * 1.72); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + s * 0.85, cy - s * 0.55, s * 0.16, 0, 7); ctx.fill();
      break;
    }
    default: calavera(s, false, false);
  }
  // firma: ribete inferior con los dos acentos de la ropa
  ctx.fillStyle = firmaB;
  ctx.fillRect(0, h - Math.max(2, h * 0.07), w, Math.max(2, h * 0.07));
  ctx.fillStyle = firmaA;
  ctx.fillRect(0, h - Math.max(2, h * 0.07) - Math.max(1.5, h * 0.035), w, Math.max(1.5, h * 0.035));
  // onda: el lienzo ya sale ondeado si el caller usa la versión por tiras
}
// dibuja la bandera ondeando: corta el lienzo plano en tiras verticales con desfase sinusoidal
function drawFlagOndeando(ctx, diseno, w, h, t = 0) {
  const plano = drawFlag.plano || (drawFlag.plano = document.createElement("canvas"));
  if (plano.width !== w || plano.height !== h) { plano.width = w; plano.height = h; }
  const pctx = plano.getContext("2d");
  drawFlag(pctx, diseno, w, h);
  ctx.clearRect(0, 0, w, h);
  const tiras = 14, ancho = w / tiras;
  for (let i = 0; i < tiras; i++) {
    const fase = (i / tiras) * Math.PI * 2.4 - t / 380;
    const desplaz = Math.sin(fase) * h * 0.045 * (0.35 + (i / tiras) * 0.65);
    ctx.drawImage(plano, i * ancho, 0, ancho, h, i * ancho, desplaz, ancho, h);
  }
}
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
const COLORES_SWATCH = { Clara: "#e4b991", Bronceada: "#b77a4b", Oscura: "#754b35", Marrón: "#483126", Azul: "#2585a5", Verde: "#4b8c55", Gris: "#aab7bf", Negro: "#1c1b22", Moreno: "#543320", Rubio: "#d6a53c", Rojo: "#a43d2e", Escarlata: "#c23b2e", Turquesa: "#3fa896", Vino: "#7a2f4a", Cobre: "#b06a3c", Blanco: "#e8e6e0", Amarillo: "#d6a53c", Violeta: "#6b4a7a", Celeste: "#5b8fa8", Rosa: "#c26b8a", "": "#8d99b0" };
const NOMBRES_VESTIMENTA = {
  "chaleco-sol": "Chaleco del Sombrero", "uniforme-justicia": "Uniforme de la Justicia", "chaqueta-viento": "Chaqueta del Viento Este", "abrigo-travesia": "Abrigo de Travesía", "cuero-loguetown": "Cuero de Loguetown", "kimono-wano": "Kimono de Wano", "manto-voluntad": "Manto de la Voluntad", "gabardina-colmillo": "Gabardina del Colmillo",
  // legado de los primeros mares: los atuendos por color siguen viéndose bien
  Rojo: "Chaleco del Sombrero", Azul: "Uniforme de la Justicia", Verde: "Chaqueta del Viento Este", Negro: "Abrigo de Travesía", Marrón: "Cuero de Loguetown", Kimono: "Kimono de Wano", Manto: "Manto de la Voluntad", Gabardina: "Gabardina del Colmillo"
};
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
  const ocultos = ["skin", "eyes", "hair", "outfit", "outfitColor", "coat", "accessory", "detail"].map(getField).filter(Boolean);
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
  // los selects ocultos vuelven al paso 1 PRIMERO: replaceChildren los sacó del DOM,
  // y form.elements no los ve hasta reinsertarlos (sin esto los swatches no setean nada)
  for (const campo of ocultos) if (campo) { campo.hidden = true; visual.append(campo); }
  const dado = document.createElement("button"); dado.type = "button"; dado.className = "button button-secondary dado-historia"; dado.textContent = "🎲 El mar te dio un pasado";
  dado.addEventListener("click", () => {
    const ta = storyField?.querySelector("textarea");
    if (ta) { ta.value = HISTORIAS_DADO[Math.floor(Math.random() * HISTORIAS_DADO.length)]; ta.dispatchEvent(new Event("input", { bubbles: true })); }
  });
  caraIzq.append(dado);
  // el azar también arregla la cara: un dado para la apariencia completa
  const dadoCara = document.createElement("button");
  dadoCara.type = "button";
  dadoCara.className = "button button-secondary dado-historia";
  dadoCara.textContent = "🎲 El mar también te dio una cara";
  dadoCara.addEventListener("click", () => {
    const azarDe = (key) => {
      const campo = form.elements.namedItem(key);
      const grupo = document.querySelector(`[data-swatch="${key}"]`);
      if (!campo) return;
      const valores = [...grupo.querySelectorAll(".swatch")].map((s) => s.dataset.valor);
      if (!valores.length) return;
      campo.value = valores[Math.floor(Math.random() * valores.length)];
      campo.dispatchEvent(new Event("change", { bubbles: true }));
      grupo.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("selected", s.dataset.valor === campo.value));
    };
    for (const key of ["skin", "eyes", "hair", "outfit", "outfitColor", "accessory", "detail", "coat"]) azarDe(key);
    updateWizardSummary();
  });
  caraIzq.append(dadoCara);
  const caraDer = document.createElement("div"); caraDer.className = "cara-swatches";
  for (const [key, titulo, valores] of [
    ["skin", "Piel", ["Clara", "Bronceada", "Oscura"]],
    ["eyes", "Mirada", ["Marrón", "Azul", "Verde", "Gris"]],
    ["hair", "Cabello", ["Negro", "Moreno", "Rubio", "Rojo", "Blanco"]],
    ["outfit", "Vestimenta", ["chaleco-sol", "uniforme-justicia", "chaqueta-viento", "abrigo-travesia", "cuero-loguetown", "kimono-wano", "manto-voluntad", "gabardina-colmillo"]],
    ["outfitColor", "Color de la ropa", ["", "Escarlata", "Rojo", "Azul", "Celeste", "Turquesa", "Verde", "Amarillo", "Cobre", "Marrón", "Vino", "Rosa", "Violeta", "Negro", "Blanco"]],
    ["coat", "Abrigo · color propio", ["Ninguno", "Rojo", "Azul", "Verde", "Negro", "Blanco", "Amarillo", "Violeta", "Marrón", "Celeste", "Rosa"]],
    ["accessory", "Cabeza", ["Ninguno", "Bandana", "Sombrero de paja", "Tricornio", "Gorra marina", "Capucha"]],
    ["detail", "Detalle extra", ["Ninguno", "Aretes", "Cicatriz", "Collar", "Aro de metal"]]
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
  if (campoProfesion) { campoProfesion.hidden = true; visual.append(campoProfesion); }
  if (raceDesc) { raceDesc.hidden = true; visual.append(raceDesc); }
  identity.forEach((campo) => visual.append(campo));
  visual.append(cara);

  // ── FASE 2 · El Anillo del Carácter ──
  rasgosStep.replaceChildren(stepHeader(2, "El Anillo del Carácter"));
  rasgosStep.append(...hiddenTraits);
  const anillo = document.createElement("div"); anillo.className = "anillo-fase";
  const brujula = document.createElement("div"); brujula.className = "anillo-brujula"; brujula.id = "anillo-brujula"; brujula.setAttribute("aria-label", "Brújula del carácter");
  // rosa de los vientos de precisión: cristal con gradiente, graduación fina de
  // 60 marcas, cardinales completos, aguja con brillo y lectura de grados viva
  brujula.innerHTML = `<svg viewBox="0 0 120 120" class="anillo-svg" aria-hidden="true">
    <defs>
      <radialGradient id="brujula-cristal" cx="50%" cy="35%" r="75%">
        <stop offset="0%" stop-color="rgba(126,200,255,.16)"/>
        <stop offset="55%" stop-color="rgba(20,30,55,.10)"/>
        <stop offset="100%" stop-color="rgba(10,16,32,.28)"/>
      </radialGradient>
      <linearGradient id="brujula-oro" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f4b41a"/><stop offset="100%" stop-color="#c98a10"/>
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="56" class="brujula-anillo"/>
    <circle cx="60" cy="60" r="47" fill="url(#brujula-cristal)" stroke="rgba(255,255,255,.28)"/>
    ${Array.from({ length: 60 }, (_, i) => { const a = (i * 6) * Math.PI / 180; const mayor = i % 5 === 0; const largo = i % 3 === 0 && mayor ? 9 : mayor ? 6 : 3; const r1 = 52 - largo, x1 = 60 + Math.sin(a) * r1, y1 = 60 - Math.cos(a) * r1, x2 = 60 + Math.sin(a) * 52, y2 = 60 - Math.cos(a) * 52; return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="brujula-marca${mayor ? " mayor" : ""}"/>`; }).join("")}
    ${[["N", 0], ["E", 90], ["S", 180], ["O", 270]].map(([letra, deg]) => { const a = deg * Math.PI / 180; const x = 60 + Math.sin(a) * 42.5, y = 60 - Math.cos(a) * 42.5; return `<text x="${x.toFixed(1)}" y="${(y + 3.2).toFixed(1)}" class="brujula-cardenal${letra === "N" ? " norte" : ""}" text-anchor="middle">${letra}</text>`; }).join("")}
    <g class="anillo-aguja"><polygon points="60,18 55,64 60,58 65,64" class="aguja-norte"/><polygon points="60,102 55,56 60,62 65,56" class="aguja-sur"/><circle cx="60" cy="60" r="4.5" class="aguja-pivote"/></g>
    <circle cx="60" cy="60" r="18" class="brujula-dial"/>
    <text id="anillo-grados" x="60" y="63.5" class="brujula-grados" text-anchor="middle">0°</text>
  </svg>`;
  const centro = document.createElement("span"); centro.className = "anillo-centro"; centro.setAttribute("aria-hidden", "true"); centro.textContent = "";
  brujula.append(centro);
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
  // las cartas están sobre la mesa: qué puede tocar el destino y qué cuesta cada carta
  const FICHAS_RAZA = {
    human: { prob: "87%", fuerte: "+10% XP por aprender rápido; ningún puerto te cierra la puerta", debil: "Ninguna ventaja física: tu cuerpo es el de cualquiera" },
    fishman: { prob: "3,2%", fuerte: "+5 vida, +1 fuerza; nada mejor que nadie y cruza la Franja de Calma sin castigo", debil: "Puertos segregados te cobran +50% y pueden cerrarte la taberna" },
    mink: { prob: "2,6%", fuerte: "+2 agilidad; los rayos casi no te hieren (30% de daño eléctrico)", debil: "El clima seco te agota (-3 HP) y tu luna Sulong depende del calendario" },
    threeeye: { prob: "1,8%", fuerte: "+1 agilidad; tu tercer ojo abre calcos antiguos y poneglyphs", debil: "Leer glifos exige talento nato: sin él, la ruina se queda muda" },
    giant: { prob: "0,9%", fuerte: "+40 vida, +4 fuerza; la arena del coliseo te teme", debil: "Come el doble de provisiones y sin casco reforzado no cruzas la Reverse Mountain" },
    sky: { prob: "1,2%", fuerte: "+1 agilidad; los cielos y las alturas son tu casa", debil: "El Mar Azul te pesa: malestar ocasional (-2 HP)" },
    longlimb: { prob: "1,6%", fuerte: "+1 fuerza, +1 agilidad y +2 de alcance marcial en combate", debil: "Los espacios estrechos te delatan: infiltrarte es peor" },
    tontatta: { prob: "0,7%", fuerte: "+2 fuerza, +2 agilidad; sigilo nato para pasar desapercibido", debil: "-10 vida, carga limitada y las lluvias de área te destrozan" }
  };
  const fichaRow = (raceId, nombre, texto) => {
    const ficha = FICHAS_RAZA[raceId] || { prob: "—", fuerte: texto, debil: "El mar te pondrá a prueba" };
    return `<tr><td><b>${nombre}</b></td><td>${ficha.prob}</td><td class="pos-fuerte">${ficha.fuerte}</td><td class="pos-debil">${ficha.debil}</td></tr>`;
  };
  const posibilidades = document.createElement("details"); posibilidades.className = "gacha-posibilidades";
  posibilidades.innerHTML = `<summary>🎲 Ver las posibilidades del destino</summary><p class="muted small-text">Ocho linajes, cuatro mares: el humano es el 87% del mundo porque es el que más lejos llega; lo demás se reparte según lo que cada sangre guarda. Lo que el destino elija, se sentirá en el juego: fuertes y débiles de verdad.</p><table class="posibilidades-tabla"><thead><tr><th>Raza</th><th>Probabilidad</th><th>Fortaleza</th><th>Precio</th></tr></thead><tbody>${RAZAS_GACHA.map(([id, nombre, texto]) => fichaRow(id, nombre, texto)).join("")}</tbody></table>`;
  const notaGacha = document.createElement("p"); notaGacha.className = "muted"; notaGacha.textContent = "Ni tu raza ni tu mar se eligen: se sortean. Tenés tres monedas del destino para observar tu suerte.";
  gacha.append(notaGacha, monedas, rueda, invocar, resultado, posibilidades);
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
  // la cuarta bandera que faltaba: la del Ejército Revolucionario
  if (factionList && !factionList.querySelector('[value="Revolucionario"]')) {
    const opcion = document.createElement("label"); opcion.className = "option-card";
    const radio = document.createElement("input"); radio.type = "radio"; radio.name = "faction"; radio.value = "Revolucionario";
    opcion.append(radio, Object.assign(document.createElement("span"), { textContent: "✊ Revolucionario" }), Object.assign(document.createElement("small"), { textContent: "Derriba tiranos; el mundo teme tu bandera." }));
    factionList.append(opcion);
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
  // ── LA BANDERA SE BORDA: diseñador por capas — la tela que te nombra ──
  const secTela = document.createElement("section"); secTela.className = "wizard-choice-section bandera-seccion";
  const hTela = document.createElement("h4"); hTela.textContent = "Bordá tu bandera";
  const notaTela = document.createElement("p"); notaTela.className = "muted";
  notaTela.textContent = "Cuatro capas y un nombre: esta tela ondeará en tu barco, en tu chip y en tu historia. El mar ya te la bordó con lo que elegiste — tocá lo que quieras cambiarla.";
  const lienzoBandera = document.createElement("canvas");
  lienzoBandera.id = "bandera-lienzo"; lienzoBandera.width = 336; lienzoBandera.height = 210;
  lienzoBandera.setAttribute("aria-label", "Vista previa de tu bandera ondeando");
  const filaCrew = document.createElement("div"); filaCrew.className = "bandera-crew";
  const inputCrew = document.createElement("input");
  inputCrew.id = "flag-tripulacion"; inputCrew.maxLength = 28;
  inputCrew.placeholder = "Nombre de tu tripulación…";
  inputCrew.setAttribute("aria-label", "Nombre de la tripulación");
  const dadoBordar = document.createElement("button"); dadoBordar.type = "button"; dadoBordar.className = "button button-secondary";
  dadoBordar.textContent = "🎲 El mar te bordó una";
  filaCrew.append(inputCrew, dadoBordar);
  secTela.append(hTela, notaTela, lienzoBandera, filaCrew);
  // filas de capas: campo, patrón, emblema y las dos firmas — píldoras con muestra de color
  const capaFila = (nombre, capa, opciones, conChip) => {
    const fila = document.createElement("div"); fila.className = "bandera-capa";
    const titulo = document.createElement("span"); titulo.className = "bandera-capa-titulo"; titulo.textContent = nombre;
    const grupo = document.createElement("div"); grupo.className = "bandera-opciones"; grupo.dataset.capa = capa;
    for (const [id, texto, chip] of opciones) {
      const boton = document.createElement("button");
      boton.type = "button"; boton.className = "bandera-opcion"; boton.dataset.valor = id; boton.title = texto;
      if (conChip && chip) { const c = document.createElement("span"); c.className = "bandera-chip"; c.style.background = chip; boton.append(c); }
      const etiqueta = document.createElement("small"); etiqueta.textContent = texto; boton.append(etiqueta);
      boton.addEventListener("click", () => {
        banderaTocada = true;
        const name = capa === "acentoA" ? "flagAcentoA" : capa === "acentoB" ? "flagAcentoB" : `flag${capa.charAt(0).toUpperCase()}${capa.slice(1)}`;
        const campo = form.elements.namedItem(name);
        if (campo) campo.value = id;
        pintaBanderaWizard();
      });
      grupo.append(boton);
    }
    fila.append(titulo, grupo);
    return fila;
  };
  secTela.append(
    capaFila("Campo", "campo", BANDERA_CAMPOS, true),
    capaFila("Patrón", "patron", BANDERA_PATRONES, false),
    capaFila("Emblema", "emblema", BANDERA_EMBLEMAS, false),
    capaFila("Firma superior", "acentoA", BANDERA_FIRMAS, true),
    capaFila("Firma inferior", "acentoB", BANDERA_FIRMAS, true)
  );
  // los datos viajan como inputs ocultos del form: el submit los lee como el resto
  for (const [name, valor] of [["flagCampo", "negro"], ["flagPatron", "liso"], ["flagEmblema", "calavera"], ["flagAcentoA", "oro"], ["flagAcentoB", "rojo"], ["flagTripulacion", ""]]) {
    const oculto = document.createElement("input");
    oculto.type = "hidden"; oculto.name = name; oculto.value = valor;
    secTela.append(oculto);
  }
  // la tarjeta cierra con la bandera izada y el nombre de la tripulación
  const flagCard = document.createElement("div"); flagCard.className = "bandera-tarjeta-card";
  const miniFlag = document.createElement("canvas"); miniFlag.id = "bandera-tarjeta"; miniFlag.width = 168; miniFlag.height = 105;
  miniFlag.setAttribute("aria-label", "Tu bandera en la Tarjeta del Alma");
  const crewLine = document.createElement("p"); crewLine.className = "bandera-crew-linea muted";
  flagCard.append(miniFlag, crewLine);
  secTarjeta.append(flagCard);
  // ── el motor local del diseñador ──
  const marcarCapas = () => {
    const d = disenoBanderaDe(form);
    document.querySelectorAll(".bandera-opciones").forEach((grupo) => {
      const capa = grupo.dataset.capa;
      const valor = capa === "acentoA" ? d.acentoA : capa === "acentoB" ? d.acentoB : d[capa];
      grupo.querySelectorAll(".bandera-opcion").forEach((o) => o.classList.toggle("selected", o.dataset.valor === valor));
    });
    if (inputCrew) inputCrew.value = d.tripulacion;
  };
  const pintaBanderaWizard = () => {
    const d = disenoBanderaDe(form);
    const ctx = lienzoBandera.getContext("2d");
    if (ctx) drawFlagOndeando(ctx, d, lienzoBandera.width, lienzoBandera.height, performance.now());
    const mctx = miniFlag.getContext("2d");
    if (mctx) drawFlagOndeando(mctx, d, miniFlag.width, miniFlag.height, performance.now());
    if (crewLine) crewLine.textContent = d.tripulacion ? `⚓ ${d.tripulacion}` : "⚓ Sin tripulación aún: ponéle nombre a tu bandera.";
    marcarCapas();
  };
  const aplicarBanderaWizard = (diseno) => {
    for (const [clave, valor] of Object.entries(diseno)) {
      const name = clave === "tripulacion" ? "flagTripulacion" : `flag${clave.charAt(0).toUpperCase()}${clave.slice(1)}`;
      const campo = form.elements.namedItem(name);
      if (campo) campo.value = valor;
    }
    pintaBanderaWizard();
  };
  // la bandera nace bordada con lo ya elegido: constelación → emblema, ropa → firma,
  // facción → emblema si no hay constelación todavía. Solo mientras no la toques.
  const bordarConLoElegido = () => {
    if (banderaTocada) return;
    const d = disenoBanderaDe(form);
    if (selectedTraits.length === 2) {
      const buscar = (a, b) => CONSTELACIONES[`${a}|${b}`] || CONSTELACIONES[`${b}|${a}`];
      const hit = buscar(selectedTraits[0], selectedTraits[1]);
      const emblema = hit && BANDERA_POR_CONSTELACION[hit[0]];
      if (emblema) d.emblema = emblema;
    } else {
      const faccion = form.querySelector('[name="faction"]:checked')?.value;
      const emblemaFaccion = faccion && BANDERA_POR_FACCION[faccion];
      if (emblemaFaccion) d.emblema = emblemaFaccion;
    }
    const colorRopa = form.elements.namedItem("outfitColor")?.value || "";
    const firma = BANDERA_FIRMAS.find(([id]) => id === colorRopa.toLocaleLowerCase("es"));
    if (firma) d.acentoA = firma[0];
    aplicarBanderaWizard(d);
  };
  rebordarBandera = bordarConLoElegido;
  dadoBordar.addEventListener("click", () => {
    const pick = (tabla) => tabla[Math.floor(Math.random() * tabla.length)][0];
    banderaTocada = true;
    aplicarBanderaWizard({
      campo: pick(BANDERA_CAMPOS), patron: pick(BANDERA_PATRONES), emblema: pick(BANDERA_EMBLEMAS),
      acentoA: pick(BANDERA_FIRMAS), acentoB: pick(BANDERA_FIRMAS),
      tripulacion: BANDERA_TRIPULACIONES[Math.floor(Math.random() * BANDERA_TRIPULACIONES.length)]
    });
  });
  inputCrew?.addEventListener("input", () => {
    banderaTocada = true;
    const campo = form.elements.namedItem("flagTripulacion");
    if (campo) campo.value = inputCrew.value;
    if (crewLine) crewLine.textContent = inputCrew.value ? `⚓ ${inputCrew.value}` : "⚓ Sin tripulación aún: ponéle nombre a tu bandera.";
  });
  pintaBanderaWizard();
  fase4.append(secTela, secBandera, secSueno, secGuia, secTarjeta);
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
  // LA PROFECÍA DEL CAPITÁN: el gancho del zarpe, armado SOLO con lo que elegiste
  // (constelación de tus dos rasgos + tu sueño + tu mar). Nada inventado.
  const pasoResumen = byId("summary-traits")?.closest(".wizard-step");
  let profecia = byId("mil-profecia");
  if (!profecia && pasoResumen) {
    profecia = document.createElement("p");
    profecia.id = "mil-profecia";
    profecia.className = "mil-profecia";
    pasoResumen.append(profecia);
  }
  if (profecia) {
    if (selectedTraits.length === 2) {
      const buscar2 = (a, b) => CONSTELACIONES[`${a}|${b}`] || CONSTELACIONES[`${b}|${a}`];
      const hit2 = buscar2(selectedTraits[0], selectedTraits[1]);
      const mar2 = resultado?.dataset.seaNombre;
      const sueno2 = form.querySelector('[name="dream"]:checked')?.value || "Libertad";
      profecia.textContent = hit2 && hit2[0]
        ? `«${hit2[0]}»: ${selectedTraits[0]} por barba y ${selectedTraits[1]} por hueso — el mar${mar2 ? ` de ${mar2}` : ""} ya prepara tu ${sueno2.toLowerCase()}.`
        : `Dos formas de caminar (${selectedTraits.join(" y ")}): el mar lo notará desde tu primer puerto.`;
      profecia.hidden = false;
    } else {
      profecia.hidden = true;
      profecia.textContent = "";
    }
  }
  const avatarConfig = Object.fromEntries(["skin", "eyes", "hair", "outfit", "outfitColor", "coat", "accessory", "detail"].map((key) => [key, form.elements.namedItem(key)?.value]));
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
  pintaBandera?.(); // la tela no se queda quieta: ondea con el ciclo de la vista previa
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
    // la lectura viva del rumbo: el número que la aguja señala
    const grados = byId("anillo-grados");
    if (grados) grados.textContent = `${Math.round(ang) % 360}°`;
  }
  rebordarBandera?.(); // la constelación nueva pide su emblema (mientras la bandera no se tocó a mano)
  const card = byId("constelacion-card");
  if (card) {
    if (selectedTraits.length === 2) {
      const buscar = (a, b) => CONSTELACIONES[`${a}|${b}`] || CONSTELACIONES[`${b}|${a}`];
      const hit = buscar(selectedTraits[0], selectedTraits[1]);
      const nombre = hit ? hit[0] : `Rumbo sin mapa · ${selectedTraits[0]} y ${selectedTraits[1]}`;
      const texto = hit ? hit[1] : "Nadie más lleva exactamente este rumbo: el mar lo anotará en tu bitácora.";
      card.innerHTML = `<strong>✦ ${nombre}</strong><p>${texto}</p><small>${ATRIBUCION_RASGO[selectedTraits[0]]} · ${ATRIBUCION_RASGO[selectedTraits[1]]}</small>`;
      card.hidden = false; card.classList.add("revelada"); card.classList.remove("parcial");
    } else if (selectedTraits.length === 1) {
      // tarjeta intermedia: el precio del rasgo elegido, para que el jugador decida sabiendo
      const id = selectedTraits[0];
      const precio = PRECIO_RASGO[id] || {};
      card.innerHTML = `<strong>${id}</strong><p class="rasgo-pros">✔ ${precio.pros || ATRIBUCION_RASGO[id]}</p><p class="rasgo-cons">✘ ${precio.cons || "Toda fortaleza tiene un precio."}</p><small class="rasgo-gancho">${GANCHOS_RASGO[id] || ""} Tocá otro rasgo y la brújula fijará tu constelación.</small>`;
      card.hidden = false; card.classList.add("revelada", "parcial");
    } else { card.hidden = true; card.classList.remove("revelada", "parcial"); }
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
      const r = sortearConPeso(RAZAS_GACHA);
      const m = sortearConPeso(MARES_GACHA);
      const texto = rueda.querySelector(".rueda-texto");
      if (texto) texto.textContent = `${r[1]} · ${m[1]}`;
      setTimeout(slot, 65 + paso * 10);
      return;
    }
    rueda.classList.remove("girando");
    const [raceId, raceNombre, raceTexto] = sortearConPeso(RAZAS_GACHA);
    const [seaId, seaNombre, seaTexto] = sortearConPeso(MARES_GACHA);
    const textoFinal = rueda.querySelector(".rueda-texto");
    if (textoFinal) textoFinal.textContent = `${raceNombre} · ${seaNombre}`;
    const form = byId("character-form");
    if (form.elements.namedItem("race")) form.elements.namedItem("race").value = raceId;
    if (form.elements.namedItem("originSea")) form.elements.namedItem("originSea").value = seaId;
    const resultado = byId("resultado-destino");
    if (resultado) {
      resultado.dataset.raceNombre = raceNombre;
      resultado.dataset.seaNombre = seaNombre;
      // combinaciones que el mar reserva para algo especial (se revelarán navegando)
      const dream = form.querySelector('[name="dream"]:checked')?.value || "Libertad";
      const especial = (raceId === "human" && seaId === "East Blue")
        || (raceId === "threeeye" && dream === "Conocimiento")
        || (raceId === "fishman" && dream === "Libertad")
        || (raceId === "giant" && dream === "Poder");
      resultado.hidden = false;
      resultado.innerHTML = `<strong>${raceNombre}</strong><p>${raceTexto}</p><small>Mar de origen: <b>${seaNombre}</b> — ${seaTexto}</small>${especial ? `<em class="destino-especial">🌟 El destino guarda algo especial para esta combinación… los mares lo revelarán a su tiempo.</em>` : ""}${monedasRestantes === 0 ? `<em class="destino-final">El destino no cambia tres veces: zarpá con lo que te dio.</em>` : ""}`;
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
  // ── validación con voz del juego: nada de burbujas nativas en inglés ──
  const mostrarError = (campo, mensaje) => {
    const label = campo?.closest("label");
    if (!label) return;
    let aviso = label.querySelector(".wz-error");
    if (!aviso) {
      aviso = document.createElement("p");
      aviso.className = "wz-error";
      aviso.setAttribute("role", "alert");
      label.append(aviso);
    }
    aviso.textContent = mensaje;
    aviso.hidden = false;
    campo.classList.add("wz-campo-error");
    campo.addEventListener("input", () => { aviso.hidden = true; campo.classList.remove("wz-campo-error"); }, { once: true });
  };
  function validarFaseUno() {
    const name = form.elements.namedItem("name");
    const handle = form.elements.namedItem("handle");
    let ok = true;
    if (name && name.value.trim().length < 2) {
      mostrarError(name, "El mar necesita un nombre: al menos 2 letras.");
      ok = false;
    }
    if (handle) {
      let valor = handle.value.trim();
      // el jugador escribe su nombre de usuario; el @ lo pone el barco si falta
      if (valor && !valor.startsWith("@")) { valor = `@${valor}`; handle.value = valor.slice(0, 17); }
      if (!/^@[a-zA-Z0-9_]{2,16}$/.test(valor)) {
        mostrarError(handle, "Tu usuario: de 2 a 16 letras, números o guion bajo.");
        ok = false;
      }
    }
    return ok;
  }
  // ── el salto de fase se valida igual desde el botón y desde el stepper ──
  function puedeAvanzarDe(i) {
    if (i === 0) return validarFaseUno();
    if (i === 1 && selectedTraits.length !== 2) {
      const card = byId("constelacion-card");
      if (card) { card.hidden = false; card.classList.add("revelada"); card.innerHTML = `<strong>El anillo espera dos rasgos</strong><p>Tocá dos orbes del anillo: la brújula gira con cada uno.</p>`; }
      return false;
    }
    if (i === 2 && !form.elements.namedItem("race")?.value) {
      if (monedasRestantes <= 0) {
        // el destino no cambia tres veces: sin monedas, sortea él mismo y deja zarpar
        const [raceId, raceNombre] = sortearConPeso(RAZAS_GACHA);
        const [seaId, seaNombre] = sortearConPeso(MARES_GACHA);
        if (form.elements.namedItem("race")) form.elements.namedItem("race").value = raceId;
        if (form.elements.namedItem("originSea")) form.elements.namedItem("originSea").value = seaId;
        const resultado = byId("resultado-destino");
        if (resultado) {
          resultado.dataset.raceNombre = raceNombre;
          resultado.dataset.seaNombre = seaNombre;
          resultado.hidden = false;
          resultado.innerHTML = `<strong>El destino decidió por vos</strong><p>Sin monedas restantes, el mar sorteó tu raza y tu mar de origen: zarpá con lo que te dio.</p>`;
        }
        updateWizardSummary();
        return true;
      }
      girarDestino(); // si no invocaste el destino, el destino te invoca: una tirada gratis
      return false;
    }
    return true;
  }
  // el Anillo del Carácter: cada orbe es un rasgo.
  // Delegación en document: el anillo se reconstruye al re-renderizar y los
  // listeners pegados a cada orbe morían con él — así el click sobrevive.
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".rasgo-orbita");
    if (!button || button.disabled) return;
    const id = button.dataset.trait;
    if (!id) return;
    if (selectedTraits.includes(id)) selectedTraits = selectedTraits.filter((trait) => trait !== id);
    else if (selectedTraits.length < 2) {
      const conflict = selectedTraits.some((chosen) => TRAITS.find((trait) => trait.id === chosen)?.opposite === id || TRAITS.find((trait) => trait.id === id)?.opposite === chosen);
      if (!conflict) selectedTraits.push(id);
    }
    updateTraitButtons();
  });
  byId("invocar-destino")?.addEventListener("click", girarDestino);
  const nextButton = byId("next-step");
  if (nextButton) nextButton.addEventListener("click", () => {
    if (!puedeAvanzarDe(currentStep)) return;
    showWizardStep(currentStep + 1);
  });
  const prevButton = byId("prev-step");
  if (prevButton) prevButton.addEventListener("click", () => showWizardStep(currentStep - 1));
  // el stepper deja de ser decorativo: cada fase navega, validando el salto
  document.addEventListener("click", (event) => {
    const paso = event.target.closest(".fase-paso");
    if (!paso?.dataset.stepNav) return;
    const destino = Number(paso.dataset.stepNav) - 1;
    if (Number.isNaN(destino) || destino === currentStep) return;
    if (destino > currentStep) {
      for (let i = currentStep; i < destino; i++) {
        if (!puedeAvanzarDe(i)) { if (i !== currentStep) showWizardStep(i); return; }
      }
    }
    showWizardStep(destino);
  });
  // salto directo pedido por fuera (ej.: el submit sin rasgos te devuelve al anillo)
  document.addEventListener("onepiece:wizard-goto", (event) => {
    const step = Number(event.detail?.step);
    if (Number.isFinite(step)) showWizardStep(step);
  });
  form.addEventListener("input", (event) => updateWizardSummary());
  form.addEventListener("change", (event) => {
    if (event.target.matches('input[name="faction"], input[name="dream"], input[name="alignment"]')) {
      const list = `${event.target.name}-list`;
      document.querySelectorAll(`#${list} .option-card, #${list} .dream-option`).forEach((card) => card.classList.toggle("selected", Boolean(card.querySelector("input[type=radio]")?.checked)));
    }
    if (event.target.name === "dream") {
      // el sueño se anuncia con una ola: la descripción entra animada
      const desc = byId("dream-description");
      if (desc) { desc.classList.remove("dream-flash"); void desc.offsetWidth; desc.classList.add("dream-flash"); }
      const icon = form.querySelector('#dream-list .option-card.selected .option-icon, #dream-list .option-card.selected span');
      if (icon) { icon.classList.remove("dream-pulse"); void icon.offsetWidth; icon.classList.add("dream-pulse"); }
    }
    if (event.target.matches('input[name="faction"], input[name="dream"], input[name="alignment"]')) rebordarBandera?.();
    updateWizardSummary();
  });
  showWizardStep(0);
  updateTraitButtons();
  actualizarMonedas();
  animateWizardPreview(); // la vista previa vive mientras el wizard esté abierto
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
  // la bandera vuelve a sus valores de nacimiento y se reborda con el azar limpio
  banderaTocada = false;
  for (const [name, valor] of [["flagCampo", "negro"], ["flagPatron", "liso"], ["flagEmblema", "calavera"], ["flagAcentoA", "oro"], ["flagAcentoB", "rojo"], ["flagTripulacion", ""]]) {
    const campo = form?.elements.namedItem(name);
    if (campo) campo.value = valor;
  }
  rebordarBandera?.();
  showWizardStep(0);
  updateWizardSummary();
  actualizarMonedas();
  byId("wizard-container")?.scrollTo({ top: 0 });
  document.querySelector(".wizard-card")?.scrollTo({ top: 0 });
}
// ── LA IZADA: la escena que faltaba al zarpar — la bandera sube por el mástil ──
export function escenaIzada(character) {
  const flag = character?.flag;
  if (!flag) return;
  const limpiar = (texto) => String(texto ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const escena = document.createElement("div");
  escena.id = "izada-escena";
  escena.setAttribute("role", "status");
  escena.innerHTML = `<div class="izada-mar"><div class="izada-barco"><div class="izada-mastil"><canvas class="izada-tela" width="252" height="150" aria-label="Tu bandera izándose"></canvas></div><div class="izada-casco">⛵</div></div><p class="izada-frase"><strong>${limpiar(flag.tripulacion || "Tu tripulación")} izan por primera vez su bandera</strong><small>El mar ya sabe tu nombre. Buena suerte, ${limpiar(character.name || "capitán")}.</small></p></div>`;
  document.body.append(escena);
  requestAnimationFrame(() => escena.classList.add("activa"));
  const tela = escena.querySelector(".izada-tela");
  let izadaFrame = null;
  const ondular = (t) => {
    if (!escena.isConnected) return;
    const ctx = tela?.getContext("2d");
    if (ctx) drawFlagOndeando(ctx, flag, tela.width, tela.height, t);
    izadaFrame = requestAnimationFrame(ondular);
  };
  izadaFrame = requestAnimationFrame(ondular);
  setTimeout(() => {
    escena.classList.add("saliendo");
    setTimeout(() => { cancelAnimationFrame(izadaFrame); escena.remove(); }, 900);
  }, 2600);
}
export function openPantheon() { const dialog = byId("pantheon-dialog"); if (dialog && !dialog.open) dialog.showModal(); }
export function closePantheon() { closeDialog("pantheon-dialog"); }
export function closeLegacyModal() { closeDialog("legacy-modal"); }
