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

function closeDialog(id) {
  const dialog = byId(id);
  if (dialog?.open) dialog.close();
}

function renderList(list, entries, emptyText, toText) {
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

export function renderGame(character) {
  showGame();
  const world = character.world ?? { day: 0, year: 1, era: "Era de los Grandes Descubrimientos", news: [], pantheon: [] };
  const lineage = character.lineage ?? { family: character.name, generation: 1, legacyChest: [] };
  const soulCard = character.soulCard ?? { dream: "Libertad", traits: { pros: [], cons: [] } };
  const traits = [...(soulCard.traits?.pros ?? []), ...(soulCard.traits?.cons ?? [])];

  byId("character-name-display").textContent = character.name;
  byId("level-badge").textContent = `Nivel ${character.level} · Gen. ${lineage.generation ?? 1}`;
  byId("faction-display").textContent = `${character.faction} · ${character.rank}`;
  byId("origin-display").textContent = character.originSea;
  byId("location-display").textContent = `${character.location?.island ?? "Puerto"} · ${character.location?.region ?? character.originSea}`;
  byId("log-pose-display").textContent = `${character.logPose?.alignment ?? 0}/${character.logPose?.required ?? 3} alineamientos`;
  byId("dream-display").textContent = safe(soulCard.dream);
  byId("traits-display").textContent = traits.join(", ") || "Sin definir";
  byId("fruit-display").textContent = character.fruit ? `${character.fruit.name} (${character.fruit.type})` : "Ninguna";
  byId("bounty-display").textContent = `${number(character.bounty)} Berries`;
  byId("berries-display").textContent = `${number(character.berries)} Berries`;

  const haki = [];
  if (character.haki?.busoshoku) haki.push("Busoshoku · Armadura");
  if (character.haki?.kenbunshoku) haki.push("Kenbunshoku �� Observación");
  if (character.haki?.haoshoku) haki.push("Haoshoku · Conquistador");
  byId("haki-display").textContent = haki.length ? haki.join(", ") : "Sin despertar";
  const stats = character.stats;
  byId("health-value").textContent = `${stats.health}/${stats.maxHealth}`;
  byId("health-bar").max = stats.maxHealth;
  byId("health-bar").value = stats.health;
  byId("strength-value").textContent = stats.strength;
  byId("agility-value").textContent = stats.agility;
  byId("ingenuity-value").textContent = stats.ingenuity;
  byId("xp-display").textContent = `Renombre: ${number(character.reputation)} · Capturas: ${character.captures ?? 0} · XP: ${character.experience}/${character.level * 100}`;

  const dead = character.status === "dead";
  const paused = character.autonomy?.paused || dead;
  byId("autonomy-status").textContent = dead ? "☠ En el Panteón" : paused ? "⏸ En pausa" : "● Activa";
  byId("autonomy-status").classList.toggle("badge-live", !paused);
  byId("pause-button").textContent = paused ? "Reanudar avatar" : "Pausar avatar";
  byId("pause-button").disabled = dead;
  byId("sync-value").textContent = `${character.whisper?.affinity ?? 55}%`;
  byId("sync-bar").value = character.whisper?.affinity ?? 55;
  byId("rebellion-value").textContent = `Rebeldía: ${character.whisper?.rebellion ?? 45}%`;
  byId("whisper-input").disabled = dead;
  byId("whisper-form").querySelector("button[type=submit]").disabled = dead;

  renderList(byId("event-log"), character.log ?? [], "La bitácora aún está en blanco.", (entry) => `${time(entry.time)} — ${entry.message}`);
  byId("world-era").textContent = world.era ?? "Era de los Grandes Descubrimientos";
  byId("world-clock").textContent = `Día ${world.day ?? 0} · Año ${world.year ?? 1} de 20 · ${world.era ?? "Era de los Grandes Descubrimientos"} · Linaje ${lineage.family ?? character.name}, generación ${lineage.generation ?? 1} · Cofre: ${(lineage.legacyChest ?? []).length} reliquia(s).`;
  const pantheon = world.pantheon ?? [];
  renderList(byId("pantheon-list"), pantheon.slice(0, 8), "Aún no hay leyendas en esta era.", (legend) => `☠ ${legend.name} · ${legend.family} · ${legend.faction} · Nivel ${legend.level} · ${number(legend.reputation)} renombre`);
  renderList(byId("pantheon-modal-list"), pantheon, "Aún no hay leyendas registradas.", (legend) => `☠ ${legend.name} · ${legend.family} · Gen. ${legend.generation} · ${legend.faction} · ${legend.cause} · ${number(legend.reputation)} renombre`);
  renderList(byId("news-list"), world.news ?? [], "El mar aguarda sus primeras noticias.", (entry) => entry.text ?? String(entry));

  byId("legacy-panel").hidden = !dead;
  if (dead) {
    const summary = `${character.name} cayó en ${character.location?.region ?? "el mar"}. Generación ${lineage.generation ?? 1} del linaje ${lineage.family ?? character.name}; se conservan ${(lineage.legacyChest ?? []).length} reliquias y parte del renombre.`;
    byId("death-summary").textContent = summary;
    byId("death-summary-modal").textContent = summary;
    const modal = byId("legacy-modal");
    if (!modal.open) modal.showModal();
  } else {
    closeDialog("legacy-modal");
  }
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
    const blocked = selectedTraits.some((chosen) => {
      const chosenTrait = TRAITS.find((trait) => trait.id === chosen);
      const candidate = TRAITS.find((trait) => trait.id === id);
      return chosenTrait?.opposite === id || candidate?.opposite === chosen;
    });
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
  const form = byId("character-form");
  selectedTraits = [];

  document.querySelectorAll(".trait-card").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.trait;
    if (selectedTraits.includes(id)) selectedTraits = selectedTraits.filter((trait) => trait !== id);
    else if (selectedTraits.length < 2) {
      const candidate = TRAITS.find((trait) => trait.id === id);
      const conflict = selectedTraits.some((chosen) => {
        const chosenTrait = TRAITS.find((trait) => trait.id === chosen);
        return chosenTrait?.opposite === id || candidate?.opposite === chosen;
      });
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
      document.querySelectorAll(`#${list} .option-card`).forEach((card) => {
        const radio = card.querySelector("input[type=radio]");
        card.classList.toggle("selected", Boolean(radio?.checked));
      });
    }
    updateWizardSummary();
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

export function openPantheon() {
  const dialog = byId("pantheon-dialog");
  if (!dialog.open) dialog.showModal();
}
export function closePantheon() { closeDialog("pantheon-dialog"); }
export function closeLegacyModal() { closeDialog("legacy-modal"); }
