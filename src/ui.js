import { initMap, renderMap, resizeMap } from "./map.js";

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

export function showSetup() {
  const wizard = byId("wizard-container");
  const game = byId("game-container");
  const reset = byId("reset-button");
  if (wizard) { wizard.hidden = false; wizard.style.display = "block"; }
  if (game) { game.hidden = true; game.style.display = "none"; }
  if (reset) reset.hidden = true;
  closeDialog("legacy-modal");
}

export function showGame() {
  const wizard = byId("wizard-container");
  const game = byId("game-container");
  const reset = byId("reset-button");
  if (wizard) { wizard.hidden = true; wizard.style.display = "none"; }
  if (game) { game.hidden = false; game.style.display = "block"; }
  if (reset) reset.hidden = false;
  // The canvas may have measured 0×0 while its parent was hidden.
  requestAnimationFrame(() => resizeMap());
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
    "log-pose-display": `${character.logPose?.alignment ?? 0}/${character.logPose?.required ?? 3} alineamientos`,
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

  const tick = Number(character.autonomy?.tickCount) || 0;
  const clock = byId("game-clock");
  if (clock) clock.textContent = `Día ${(Number(world.day) || 0) + 1} · ${String(Math.floor(tick % 24)).padStart(2, "0")}:${String(Math.floor((tick * 5) % 60)).padStart(2, "0")}`;
  const headerStatus = byId("header-avatar-status");
  if (headerStatus) {
    headerStatus.textContent = dead ? "● Avatar caído" : paused ? "● Avatar en pausa" : "● Avatar activo";
    headerStatus.classList.toggle("paused", paused && !dead);
    headerStatus.classList.toggle("dead", dead);
  }
  const autonomyStatus = byId("autonomy-status");
  if (autonomyStatus) { autonomyStatus.textContent = dead ? "☠ En el Panteón" : paused ? "⏸ En pausa" : "● Activa"; autonomyStatus.classList.toggle("badge-live", !paused); }
  const pauseButton = byId("pause-button");
  if (pauseButton) { pauseButton.textContent = paused ? "Reanudar avatar" : "Pausar avatar"; pauseButton.disabled = dead; }
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
  renderList(byId("pantheon-list"), pantheon.slice(0, 8), "Aún no hay leyendas en esta era.", (legend) => `☠ ${legend.name} · ${legend.family} · ${legend.faction} · Nivel ${legend.level} · ${number(legend.reputation)} renombre`);
  renderList(byId("pantheon-modal-list"), pantheon, "Aún no hay leyendas registradas.", (legend) => `☠ ${legend.name} · ${legend.family} · Gen. ${legend.generation} · ${legend.faction} · ${legend.cause} · ${number(legend.reputation)} renombre`);
  renderList(byId("news-list"), world.news ?? [], "El mar aguarda sus primeras noticias.", (entry) => entry.text ?? String(entry));
  if (byId("treasure-count")) byId("treasure-count").textContent = String((lineage.legacyChest ?? []).length);
  renderList(byId("treasure-list"), lineage.legacyChest ?? [], "El cofre espera su primera reliquia.", (item) => `✦ ${item}`);

  const mission = character.mission ?? { title: "Explorar el mar", island: character.location?.island ?? "Mar abierto", enemy: "piratas rivales", status: "active", completed: 0 };
  if (byId("mission-title")) byId("mission-title").textContent = mission.status === "complete" ? `✅ ${mission.title} · completada` : `🎯 ${mission.title}`;
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
      item.textContent = `${index < currentIndex ? "✓" : index === currentIndex ? "⚓" : "○"} ${island}`;
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
  if (byId("map-destination")) byId("map-destination").textContent = destination ? `Rumbo fijado: ${destination.name} · ${destination.sea}.` : "Selecciona una isla para fijar el rumbo del Log Pose.";
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
    "summary-sea": form.elements.namedItem("originSea")?.value || "East Blue",
    "summary-traits": selectedTraits.join(" / ") || "Elige dos rasgos",
    "summary-dream": form.querySelector('[name="dream"]:checked')?.value || "Libertad"
  };
  for (const [id, value] of Object.entries(values)) if (byId(id)) byId(id).textContent = value;
}
function showWizardStep(index) {
  const steps = [...document.querySelectorAll(".wizard-step")];
  const nav = [...document.querySelectorAll(".progress-step")];
  if (!steps.length) return;
  currentStep = Math.max(0, Math.min(steps.length - 1, index));
  steps.forEach((step, i) => step.classList.toggle("active", i === currentStep));
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
    if (event.target.matches('input[name="faction"], input[name="dream"]')) {
      const list = event.target.name === "faction" ? "faction-list" : "dream-list";
      document.querySelectorAll(`#${list} .option-card, #${list} .dream-option`).forEach((card) => card.classList.toggle("selected", Boolean(card.querySelector("input[type=radio]")?.checked)));
    }
    updateWizardSummary();
  });
  if (byId("quick-action")) byId("quick-action").addEventListener("click", () => {
    if (byId("game-container")?.hidden) return;
    byId("chat-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
    byId("whisper-input")?.focus({ preventScroll: true });
  });
  showWizardStep(0);
  updateTraitButtons();
}
export function resetWizard() {
  selectedTraits = [];
  const form = byId("character-form");
  if (form?.elements.namedItem("traitPrimary")) form.elements.namedItem("traitPrimary").value = "";
  if (form?.elements.namedItem("traitSecondary")) form.elements.namedItem("traitSecondary").value = "";
  document.querySelectorAll(".trait-card").forEach((card) => { card.classList.remove("selected", "disabled"); card.disabled = false; });
  showWizardStep(0);
  updateWizardSummary();
}
export function openPantheon() { const dialog = byId("pantheon-dialog"); if (dialog && !dialog.open) dialog.showModal(); }
export function closePantheon() { closeDialog("pantheon-dialog"); }
export function closeLegacyModal() { closeDialog("legacy-modal"); }
