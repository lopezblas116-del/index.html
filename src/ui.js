import { initMap, renderMap } from "./map.js";

const byId = (id) => document.getElementById(id);
const number = (value) => new Intl.NumberFormat("es-ES").format(Number(value) || 0);
const time = (value) => new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const safe = (value, fallback = "—") => value ?? fallback;

export function showSetup() {
  byId("setup-screen").hidden = false;
  byId("game-screen").hidden = true;
  byId("reset-button").hidden = true;
  closeDialog("legacy-modal");
}
export function showGame() {
  byId("setup-screen").hidden = true;
  byId("game-screen").hidden = false;
  byId("reset-button").hidden = false;
}
function closeDialog(id) { const dialog = byId(id); if (dialog?.open) dialog.close(); }
function renderList(list, entries, emptyText, toText) {
  if (!list) return;
  list.replaceChildren();
  if (!entries.length) { const item = document.createElement("li"); item.textContent = emptyText; list.append(item); return; }
  entries.forEach((entry) => { const item = document.createElement("li"); item.textContent = toText(entry); list.append(item); });
}
function categoryFor(message) {
  const text = String(message).toLocaleLowerCase("es");
  if (/victoria|derrota|combate|pelea|captur|ataque|haki/.test(text)) return { label: "[COMBATE]", className: "combat" };
  if (/recompensa|berries|berries|renombre|cartel|reliquia|botín|botin/.test(text)) return { label: "[RECOMPENSA]", className: "reward" };
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
  byId("character-name-display").textContent = character.name ?? "Aventurero";
  byId("level-badge").textContent = `Nivel ${character.level ?? 1} · Gen. ${lineage.generation ?? 1}`;
  byId("faction-display").textContent = `${character.faction ?? "Pirata"} · ${character.rank ?? "Novato"}`;
  byId("origin-display").textContent = character.originSea ?? "East Blue";
  byId("location-display").textContent = `${character.location?.island ?? "Puerto"} · ${character.location?.region ?? character.originSea ?? "East Blue"}`;
  byId("log-pose-display").textContent = `${character.logPose?.alignment ?? 0}/${character.logPose?.required ?? 3} alineamientos`;
  byId("dream-display").textContent = safe(soulCard.dream);
  byId("traits-display").textContent = traits.join(", ") || "Sin definir";
  byId("fruit-display").textContent = character.fruit ? `${character.fruit.name} (${character.fruit.type})` : "Ninguna";
  byId("bounty-display").textContent = `฿ ${number(character.bounty)} Berries`;
  byId("berries-display").textContent = `฿ ${number(character.berries)} Berries`;
  const haki = [];
  if (character.haki?.busoshoku) haki.push("Busoshoku · Armadura");
  if (character.haki?.kenbunshoku) haki.push("Kenbunshoku · Observación");
  if (character.haki?.haoshoku) haki.push("Haoshoku · Conquistador");
  byId("haki-display").textContent = haki.length ? haki.join(", ") : "Sin despertar";
  const stats = character.stats ?? {};
  byId("health-value").textContent = `${stats.health ?? 0}/${stats.maxHealth ?? 100}`;
  byId("health-bar").max = stats.maxHealth ?? 100;
  byId("health-bar").value = stats.health ?? 0;
  byId("strength-value").textContent = stats.strength ?? 0;
  byId("agility-value").textContent = stats.agility ?? 0;
  byId("ingenuity-value").textContent = stats.ingenuity ?? 0;
  byId("xp-display").textContent = `Renombre: ${number(character.reputation)} · Capturas: ${character.captures ?? 0} · XP: ${character.experience ?? 0}/${(character.level ?? 1) * 100}`;

  const day = Number(world.day) || 0;
  const tick = Number(character.autonomy?.tickCount) || 0;
  const hour = String(Math.floor(tick % 24)).padStart(2, "0");
  const minute = String(Math.floor((tick * 5) % 60)).padStart(2, "0");
  byId("game-clock").textContent = `Día ${day + 1} · ${hour}:${minute}`;
  const headerStatus = byId("header-avatar-status");
  headerStatus.textContent = dead ? "● Avatar caído" : paused ? "● Avatar en pausa" : "● Avatar activo";
  headerStatus.classList.toggle("paused", paused && !dead);
  headerStatus.classList.toggle("dead", dead);
  byId("autonomy-status").textContent = dead ? "☠ En el Panteón" : paused ? "⏸ En pausa" : "● Activa";
  byId("autonomy-status").classList.toggle("badge-live", !paused);
  byId("pause-button").textContent = paused ? "Reanudar avatar" : "Pausar avatar";
  byId("pause-button").disabled = dead;
  byId("sync-value").textContent = `${character.whisper?.affinity ?? 55}%`;
  byId("sync-bar").value = character.whisper?.affinity ?? 55;
  byId("rebellion-value").textContent = `Rebeldía: ${character.whisper?.rebellion ?? 45}%`;
  byId("whisper-input").disabled = dead;
  byId("whisper-form").querySelector("button[type=submit]").disabled = dead;

  renderTerminalLog(byId("event-log"), character.log ?? [], character.name);
  byId("world-era").textContent = world.era ?? "Era de los Grandes Descubrimientos";
  byId("world-clock").textContent = `Día ${world.day ?? 0} · Año ${world.year ?? 1} de 20 · ${world.era ?? "Era de los Grandes Descubrimientos"} · Linaje ${lineage.family ?? character.name}, generación ${lineage.generation ?? 1} · Cofre: ${(lineage.legacyChest ?? []).length} reliquia(s).`;
  const pantheon = world.pantheon ?? [];
  renderList(byId("pantheon-list"), pantheon.slice(0, 8), "Aún no hay leyendas en esta era.", (legend) => `☠ ${legend.name} · ${legend.family} · ${legend.faction} · Nivel ${legend.level} · ${number(legend.reputation)} renombre`);
  renderList(byId("pantheon-modal-list"), pantheon, "Aún no hay leyendas registradas.", (legend) => `☠ ${legend.name} · ${legend.family} · Gen. ${legend.generation} · ${legend.faction} · ${legend.cause} · ${number(legend.reputation)} renombre`);
  renderList(byId("news-list"), world.news ?? [], "El mar aguarda sus primeras noticias.", (entry) => entry.text ?? String(entry));
  const treasures = lineage.legacyChest ?? [];
  byId("treasure-count").textContent = String(treasures.length);
  renderList(byId("treasure-list"), treasures, "El cofre espera su primera reliquia.", (item) => `✦ ${item}`);

  const mission = character.mission ?? { title: "Explorar el mar", island: character.location?.island ?? "Mar abierto", enemy: "piratas rivales", status: "active", completed: 0 };
  byId("mission-title").textContent = mission.status === "complete" ? `✅ ${mission.title} · completada` : `🎯 ${mission.title}`;
  byId("mission-text").textContent = mission.status === "complete"
    ? `Has asegurado ${mission.island}. Navega para continuar la ruta. Misiones completadas: ${mission.completed ?? 0}.`
    : `Isla: ${mission.island} · Objetivo: enfrentarse a ${mission.enemy}. Alinea el Log Pose con ${character.logPose?.required ?? 3} acciones de navegación para iniciar el desafío.`;
  const route = character.originSea === "East Blue"
    ? ["Isla Dawn", "Orange Town", "Villa Syrup", "Baratie", "Arlong Park", "Loguetown", "Reverse Mountain", "Paraíso", "Nuevo Mundo"]
    : [character.location?.island ?? "Isla inicial", "Loguetown", "Reverse Mountain", "Paraíso", "Nuevo Mundo"];
  const routeList = byId("expedition-route");
  routeList.replaceChildren();
  route.forEach((island, index) => {
    const item = document.createElement("li");
    const currentIndex = Number(character.location?.routeIndex) || 0;
    item.textContent = `${index < currentIndex ? "✓" : index === currentIndex ? "⚓" : "○"} ${island}`;
    item.classList.toggle("current", index === currentIndex);
    item.classList.toggle("visited", index < currentIndex);
    routeList.append(item);
  });
  const powers = [];
  if (character.haki?.busoshoku) powers.push("Haki de Armadura: aumenta el poder de ataque");
  if (character.haki?.kenbunshoku) powers.push("Haki de Observación: iniciativa y evasión");
  if (character.haki?.haoshoku) powers.push("Haki del Conquistador: posibilidad de dominar rivales");
  if (character.fruit) powers.push(`${character.fruit.technique || "Técnica de Akuma no Mi"}: ${character.fruit.name}`);
  byId("technique-text").textContent = powers.length ? `Técnicas de combate · ${powers.join(" · ")}` : "Técnicas de combate · Entrena para despertar Haki o busca una Akuma no Mi.";
  const wanted = ["Pirata", "Revolucionario"].includes(character.faction) && Number(character.bounty) > 0;
  byId("wanted-poster").classList.toggle("not-wanted", !wanted);
  byId("wanted-name").textContent = character.name ?? "Aventurero";
  byId("wanted-handle").textContent = character.username ?? "Pirata desconocido";
  byId("wanted-bounty").textContent = wanted ? `฿ ${number(character.bounty)} BERRIES` : "SIN RECOMPENSA";
  byId("wanted-note").textContent = wanted ? `Vivo o muerto · ${character.location?.island ?? "Mar abierto"}` : character.faction === "Marine" ? "Marine en servicio · recompensa de captura" : "Las hazañas notorias generan un cartel de búsqueda.";

  byId("legacy-panel").hidden = !dead;
  if (dead) {
    const summary = `${character.name} cayó en ${character.location?.region ?? "el mar"}. Generación ${lineage.generation ?? 1} del linaje ${lineage.family ?? character.name}; se conservan ${(lineage.legacyChest ?? []).length} reliquias y parte del renombre.`;
    byId("death-summary").textContent = summary;
    byId("death-summary-modal").textContent = summary;
    const modal = byId("legacy-modal");
    if (!modal.open) modal.showModal();
  } else closeDialog("legacy-modal");
  const destination = character.navigationTarget;
  byId("map-destination").textContent = destination ? `Rumbo fijado: ${destination.name} · ${destination.sea}.` : "Selecciona una isla para fijar el rumbo del Log Pose.";
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
  byId("summary-name").textContent = form.elements.namedItem("name").value.trim() || "Aventurero";
  byId("summary-handle").textContent = form.elements.namedItem("handle").value.trim() || "@usuario";
  byId("summary-faction").textContent = form.querySelector('[name="faction"]:checked')?.value || "Pirata";
  byId("summary-sea").textContent = form.elements.namedItem("originSea").value;
  byId("summary-traits").textContent = selectedTraits.join(" / ") || "Elige dos rasgos";
  byId("summary-dream").textContent = form.querySelector('[name="dream"]:checked')?.value || "Libertad";
}
function showWizardStep(index) {
  const steps = [...document.querySelectorAll(".wizard-step")];
  const nav = [...document.querySelectorAll(".progress-step")];
  currentStep = Math.max(0, Math.min(steps.length - 1, index));
  steps.forEach((step, i) => step.classList.toggle("active", i === currentStep));
  nav.forEach((button, i) => {
    button.classList.toggle("active", i === currentStep);
    button.setAttribute("aria-current", i === currentStep ? "step" : "false");
  });
  byId("prev-step").hidden = currentStep === 0;
  byId("next-step").hidden = currentStep === steps.length - 1;
  byId("submit-step").hidden = currentStep !== steps.length - 1;
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
  form.elements.namedItem("traitPrimary").value = selectedTraits[0] ?? "";
  form.elements.namedItem("traitSecondary").value = selectedTraits[1] ?? "";
  updateWizardSummary();
}
export function initWizard() {
  if (wizardInitialized) return;
  wizardInitialized = true;
  initMap();
  const form = byId("character-form");
  document.querySelectorAll(".trait-card").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.trait;
    if (selectedTraits.includes(id)) selectedTraits = selectedTraits.filter((trait) => trait !== id);
    else if (selectedTraits.length < 2) {
      const conflict = selectedTraits.some((chosen) => TRAITS.find((trait) => trait.id === chosen)?.opposite === id || TRAITS.find((trait) => trait.id === id)?.opposite === chosen);
      if (!conflict) selectedTraits.push(id);
    }
    updateTraitButtons();
  }));
  byId("next-step").addEventListener("click", () => {
    if (currentStep === 0) {
      const name = form.elements.namedItem("name");
      const handle = form.elements.namedItem("handle");
      if (!name.value.trim()) { name.reportValidity(); return; }
      if (!/^@[a-zA-Z0-9_]{2,16}$/.test(handle.value.trim())) {
        handle.setCustomValidity("Usa @ seguido por 2-16 letras, números o guion bajo.");
        handle.reportValidity();
        handle.setCustomValidity("");
        return;
      }
    }
    if (currentStep === 2 && selectedTraits.length !== 2) { window.alert("Selecciona exactamente dos rasgos."); return; }
    showWizardStep(currentStep + 1);
  });
  byId("prev-step").addEventListener("click", () => showWizardStep(currentStep - 1));
  document.querySelectorAll(".progress-step").forEach((button) => button.addEventListener("click", () => {
    const target = Number(button.dataset.stepNav) - 1;
    if (target <= currentStep) showWizardStep(target);
  }));
  form.addEventListener("input", updateWizardSummary);
  form.addEventListener("change", (event) => {
    if (event.target.matches('input[name="faction"], input[name="dream"]')) {
      const list = event.target.name === "faction" ? "faction-list" : "dream-list";
      document.querySelectorAll(`#${list} .option-card, #${list} .dream-option`).forEach((card) => card.classList.toggle("selected", Boolean(card.querySelector("input[type=radio]")?.checked)));
    }
    updateWizardSummary();
  });
  byId("quick-action")?.addEventListener("click", () => {
    if (byId("game-screen").hidden) return;
    byId("chat-panel").scrollIntoView({ behavior: "smooth", block: "center" });
    byId("whisper-input").focus({ preventScroll: true });
  });
  showWizardStep(0);
  updateTraitButtons();
}
export function resetWizard() {
  selectedTraits = [];
  const form = byId("character-form");
  form.elements.namedItem("traitPrimary").value = "";
  form.elements.namedItem("traitSecondary").value = "";
  document.querySelectorAll(".trait-card").forEach((card) => { card.classList.remove("selected", "disabled"); card.disabled = false; });
  showWizardStep(0);
  updateWizardSummary();
}
export function openPantheon() { const dialog = byId("pantheon-dialog"); if (!dialog.open) dialog.showModal(); }
export function closePantheon() { closeDialog("pantheon-dialog"); }
export function closeLegacyModal() { closeDialog("legacy-modal"); }
