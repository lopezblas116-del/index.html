const byId = (id) => document.getElementById(id);
const formatNumber = (value) => new Intl.NumberFormat("es-ES").format(value);
const formatTime = (isoString) => new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date(isoString));

const TRAITS = [
  { id: "Valiente", opposite: "Prudente", desc: "Actúa sin dudar" },
  { id: "Astuto", opposite: "Impulsivo", desc: "Lee el tablero" },
  { id: "Impulsivo", opposite: "Prudente", desc: "Actúa por instinto" },
  { id: "Prudente", opposite: "Impulsivo", desc: "Cuida cada movimiento" },
  { id: "Agresivo", opposite: "Honrado", desc: "Busca el choque" },
  { id: "Honrado", opposite: "Rebelde", desc: "Mantiene principios" },
  { id: "Rebelde", opposite: "Honrado", desc: "No acepta órdenes" },
  { id: "Leal", opposite: "Rebelde", desc: "Protege a su gente" }
];

export function showSetup() {
  byId("setup-screen").hidden = false;
  byId("game-screen").hidden = true;
  byId("reset-button").hidden = true;
}

export function showGame() {
  byId("setup-screen").hidden = true;
  byId("game-screen").hidden = false;
  byId("reset-button").hidden = false;
}

export function renderGame(character) {
  showGame();
  byId("character-name-display").textContent = character.name;
  byId("level-badge").textContent = `Nivel ${character.level}`;
  byId("faction-display").textContent = `${character.faction} · ${character.rank}`;
  byId("origin-display").textContent = character.originSea;
  byId("location-display").textContent = `${character.location.island} · ${character.location.region}`;
  byId("log-pose-display").textContent = `${character.logPose.alignment}/${character.logPose.required} alineamientos`;
  byId("dream-display").textContent = character.soulCard.dream;
  byId("traits-display").textContent = [...character.soulCard.traits.pros, ...character.soulCard.traits.cons].join(", ") || "Sin definir";
  byId("fruit-display").textContent = character.fruit ? `${character.fruit.name} (${character.fruit.type})` : "Ninguna";
  byId("bounty-display").textContent = `${formatNumber(character.bounty)} Berries`;
  byId("berries-display").textContent = `${formatNumber(character.berries)} Berries`;

  const hakiNames = [];
  if (character.haki.busoshoku) hakiNames.push("Busoshoku");
  if (character.haki.kenbunshoku) hakiNames.push("Kenbunshoku");
  if (character.haki.haoshoku) hakiNames.push("Haoshoku");
  byId("haki-display").textContent = hakiNames.length ? hakiNames.join(", ") : "Sin despertar";

  byId("health-value").textContent = `${character.stats.health}/${character.stats.maxHealth}`;
  byId("health-bar").max = character.stats.maxHealth;
  byId("health-bar").value = character.stats.health;

  byId("strength-value").textContent = character.stats.strength;
  byId("agility-value").textContent = character.stats.agility;
  byId("ingenuity-value").textContent = character.stats.ingenuity;

  const nextLevelXp = character.level * 100;
  byId("xp-display").textContent = `Experiencia: ${character.experience}/${nextLevelXp} XP · Ciclos: ${character.autonomy.tickCount}`;

  byId("autonomy-status").textContent = character.autonomy.paused ? "⏸ En pausa" : "● Activa";
  byId("autonomy-status").classList.toggle("badge-live", !character.autonomy.paused);
  byId("pause-button").textContent = character.autonomy.paused ? "Reanudar avatar" : "Pausar avatar";
  byId("sync-value").textContent = `${character.whisper.affinity}%`;
  byId("sync-bar").value = character.whisper.affinity;
  byId("rebellion-value").textContent = `Rebeldía: ${100 - character.whisper.affinity}%`;

  const log = byId("event-log");
  log.replaceChildren();
  for (const entry of character.log) {
    const item = document.createElement("li");
    const time = document.createElement("span");
    time.className = "event-time";
    time.textContent = formatTime(entry.time);
    const message = document.createElement("span");
    message.textContent = entry.message;
    item.append(time, message);
    log.append(item);
  }
}

export function initWizard() {
  const form = byId("character-form");
  const steps = Array.from(form.querySelectorAll(".wizard-step"));
  const navButtons = Array.from(document.querySelectorAll(".progress-step"));
  const prevStepButton = byId("prev-step");
  const nextStepButton = byId("next-step");
  const submitButton = byId("submit-step");
  const summaryName = byId("summary-name");
  const summaryHandle = byId("summary-handle");
  const summaryFaction = byId("summary-faction");
  const summarySea = byId("summary-sea");
  const summaryTraits = byId("summary-traits");
  const summaryDream = byId("summary-dream");

  let stepIndex = 0;
  const selectedTraits = [];

  function traitIsBlocked(traitId) {
    const trait = TRAITS.find((t) => t.id === traitId);
    if (!trait) return false;
    const selectedIds = selectedTraits.map((t) => t.id);
    return selectedIds.some((selectedId) => {
      const selectedTrait = TRAITS.find((t) => t.id === selectedId);
      return selectedTrait && selectedTrait.opposite === traitId;
    });
  }

  function updateSummary() {
    const name = form.elements.name.value.trim() || "Anónimo";
    const handle = form.elements.handle.value.trim() || "@usuario";
    summaryName.textContent = name;
    summaryHandle.textContent = handle;
    summaryFaction.textContent = form.querySelector('input[name="faction"]:checked')?.value || "Pirata";
    summarySea.textContent = form.elements.originSea.value || "East Blue";
    summaryTraits.textContent = selectedTraits.length ? selectedTraits.map((t) => t.id).join(" / ") : "Sin definir";
    summaryDream.textContent = form.querySelector('input[name="dream"]:checked')?.value || "Libertad";
  }

  function updateTraitButtons() {
    const buttons = Array.from(document.querySelectorAll(".trait-card"));
    buttons.forEach((button) => {
      const traitId = button.dataset.trait;
      const isSelected = selectedTraits.some((t) => t.id === traitId);
      const isBlocked = traitIsBlocked(traitId) && !isSelected;
      button.classList.toggle("selected", isSelected);
      button.classList.toggle("disabled", isBlocked && selectedTraits.length >= 2);
      button.disabled = Boolean(isBlocked && selectedTraits.length >= 2);
    });

    const hiddenPrimary = form.elements.traitPrimary;
    const hiddenSecondary = form.elements.traitSecondary;
    hiddenPrimary.value = selectedTraits[0]?.id || "Valiente";
    hiddenSecondary.value = selectedTraits[1]?.id || "Astuto";
    updateSummary();
  }

  document.querySelectorAll(".trait-card").forEach((button) => {
    button.addEventListener("click", () => {
      const traitId = button.dataset.trait;
      const existingIndex = selectedTraits.findIndex((trait) => trait.id === traitId);
      if (existingIndex >= 0) {
        selectedTraits.splice(existingIndex, 1);
        updateTraitButtons();
        return;
      }
      if (selectedTraits.length >= 2) {
        const conflict = selectedTraits.some((selected) => selected.opposite === traitId);
        if (conflict) {
          return;
        }
        selectedTraits.shift();
      }
      const trait = TRAITS.find((t) => t.id === traitId);
      if (!trait) return;
      const blocked = selectedTraits.some((selected) => selected.opposite === traitId || trait.opposite === selected.id);
      if (blocked) return;
      selectedTraits.push(trait);
      updateTraitButtons();
    });
  });

  function setStep(index) {
    stepIndex = index;
    steps.forEach((step, i) => step.classList.toggle("active", i === index));
    navButtons.forEach((button, i) => button.classList.toggle("active", i === index));
    prevStepButton.hidden = index === 0;
    nextStepButton.hidden = index === steps.length - 1;
    submitButton.hidden = index !== steps.length - 1;
    if (index === 4) updateSummary();
  }

  prevStepButton.addEventListener("click", () => setStep(Math.max(0, stepIndex - 1)));
  nextStepButton.addEventListener("click", () => setStep(Math.min(steps.length - 1, stepIndex + 1)));
  navButtons.forEach((button) => {
    button.addEventListener("click", () => setStep(Number(button.dataset.stepNav) - 1));
  });

  form.querySelectorAll('input[name="faction"]').forEach((input) => {
    input.addEventListener("change", () => {
      document.querySelectorAll(".option-card").forEach((card) => {
        const radio = card.querySelector('input[name="faction"]');
        card.classList.toggle("selected", radio.checked);
      });
      updateSummary();
    });
  });

  form.querySelectorAll('input[name="dream"]').forEach((input) => {
    input.addEventListener("change", () => {
      document.querySelectorAll('#dream-list .option-card').forEach((card) => {
        const radio = card.querySelector('input[name="dream"]');
        card.classList.toggle("selected", radio.checked);
      });
      updateSummary();
    });
  });

  form.elements.name.addEventListener("input", updateSummary);
  form.elements.handle.addEventListener("input", updateSummary);
  form.elements.originSea.addEventListener("change", updateSummary);

  setStep(0);
  updateTraitButtons();
  updateSummary();
}
