const byId = (id) => document.getElementById(id);
const number = (value) => new Intl.NumberFormat("es-ES").format(value);
const time = (value) => new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const safe = (value, fallback = "—") => value ?? fallback;

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

function ensureWorldPanel() {
  let panel = byId("world-panel");
  if (panel) return panel;
  panel = document.createElement("section");
  panel.id = "world-panel";
  panel.className = "panel world-panel";
  panel.innerHTML = `<div class="section-heading"><div><p class="eyebrow">Diario del Mar</p><h2>Reloj de Eras</h2></div><span class="badge" id="world-era">—</span></div><p id="world-clock" class="muted small-text"></p><h3 class="subheading">Panteón de Leyendas</h3><ol id="pantheon-list" class="event-log"></ol><h3 class="subheading">Noticias del Mundo</h3><ol id="news-list" class="event-log"></ol>`;
  byId("game-screen").querySelector(".main-column").append(panel);
  return panel;
}
function ensureLegacyPanel() {
  let panel = byId("legacy-panel");
  if (panel) return panel;
  panel = document.createElement("section");
  panel.id = "legacy-panel";
  panel.className = "panel legacy-panel";
  panel.innerHTML = `<p class="eyebrow">El linaje continúa</p><h2>El avatar ha caído</h2><p id="death-summary" class="muted"></p><div class="legacy-actions"><button id="create-heir-button" class="button button-primary" data-create-heir type="button">Crear heredero / discípulo</button><button id="archive-button" class="button button-quiet" type="button">Ver Panteón</button></div>`;
  byId("game-screen").prepend(panel);
  return panel;
}

export function renderGame(character) {
  showGame();
  byId("character-name-display").textContent = character.name;
  byId("level-badge").textContent = `Nivel ${character.level} · Gen. ${character.lineage.generation}`;
  byId("faction-display").textContent = `${character.faction} · ${character.rank}`;
  byId("origin-display").textContent = character.originSea;
  byId("location-display").textContent = `${character.location.island} · ${character.location.region}`;
  byId("log-pose-display").textContent = `${character.logPose.alignment}/${character.logPose.required} alineamientos`;
  byId("dream-display").textContent = safe(character.soulCard.dream);
  byId("traits-display").textContent = [...(character.soulCard.traits.pros || []), ...(character.soulCard.traits.cons || [])].join(", ") || "Sin definir";
  byId("fruit-display").textContent = character.fruit ? `${character.fruit.name} (${character.fruit.type})` : "Ninguna";
  byId("bounty-display").textContent = `${number(character.bounty)} Berries`;
  byId("berries-display").textContent = `${number(character.berries)} Berries`;
  const haki = [];
  if (character.haki.busoshoku) haki.push("Busoshoku · Armadura");
  if (character.haki.kenbunshoku) haki.push("Kenbunshoku · Observación");
  if (character.haki.haoshoku) haki.push("Haoshoku · Conquistador");
  byId("haki-display").textContent = haki.length ? haki.join(", ") : "Sin despertar";
  byId("health-value").textContent = `${character.stats.health}/${character.stats.maxHealth}`;
  byId("health-bar").max = character.stats.maxHealth;
  byId("health-bar").value = character.stats.health;
  byId("strength-value").textContent = character.stats.strength;
  byId("agility-value").textContent = character.stats.agility;
  byId("ingenuity-value").textContent = character.stats.ingenuity;
  byId("xp-display").textContent = `Renombre: ${number(character.reputation)} · Capturas: ${character.captures} · XP: ${character.experience}/${character.level * 100}`;
  byId("autonomy-status").textContent = character.status === "dead" ? "☠ En el Panteón" : character.autonomy.paused ? "⏸ En pausa" : "● Activa";
  byId("autonomy-status").classList.toggle("badge-live", character.status === "alive" && !character.autonomy.paused);
  byId("pause-button").textContent = character.autonomy.paused ? "Reanudar avatar" : "Pausar avatar";
  byId("pause-button").disabled = character.status === "dead";
  byId("sync-value").textContent = `${character.whisper.affinity}%`;
  byId("sync-bar").value = character.whisper.affinity;
  byId("rebellion-value").textContent = `Rebeldía: ${character.whisper.rebellion}%`;
  byId("whisper-input").disabled = character.status === "dead";
  byId("whisper-form").querySelector("button[type=submit]").disabled = character.status === "dead";

  const log = byId("event-log");
  log.replaceChildren();
  character.log.forEach((entry) => {
    const item = document.createElement("li");
    const stamp = document.createElement("span"); stamp.className = "event-time"; stamp.textContent = time(entry.time);
    const message = document.createElement("span"); message.textContent = entry.message;
    item.append(stamp, message); log.append(item);
  });

  ensureWorldPanel();
  byId("world-era").textContent = character.world.era;
  byId("world-clock").textContent = `Día ${character.world.day} · Año ${character.world.year} de 20 · ${character.world.era} · Linaje ${character.lineage.family}, generación ${character.lineage.generation}. Cofre: ${character.lineage.legacyChest.length} reliquia(s).`;
  const pantheon = byId("pantheon-list"); pantheon.replaceChildren();
  character.world.pantheon.slice(0, 8).forEach((legend) => {
    const item = document.createElement("li");
    item.textContent = `☠ ${legend.name} · ${legend.family} · ${legend.faction} · Nivel ${legend.level} · ${number(legend.reputation)} renombre`;
    pantheon.append(item);
  });
  if (!character.world.pantheon.length) { const item = document.createElement("li"); item.textContent = "Aún no hay leyendas en esta era."; pantheon.append(item); }
  const news = byId("news-list"); news.replaceChildren();
  character.world.news.slice(0, 8).forEach((entry) => { const item = document.createElement("li"); item.textContent = entry.text; news.append(item); });
  if (!character.world.news.length) { const item = document.createElement("li"); item.textContent = "El mar aguarda sus primeras noticias."; news.append(item); }

  const legacyPanel = ensureLegacyPanel();
  legacyPanel.hidden = character.status !== "dead";
  if (character.status === "dead") {
    byId("death-summary").textContent = `${character.name} cayó en ${character.location.region}. Generación ${character.lineage.generation} del linaje ${character.lineage.family}; sus reliquias y parte de su renombre pueden heredarse.`;
  }
}

export function showSetup() { // Keep the creation screen accessible after a reset.
  byId("setup-screen").hidden = false;
  byId("game-screen").hidden = true;
  byId("reset-button").hidden = true;
}

const TRAITS = [
  { id: "Valiente", opposite: "Prudente" }, { id: "Astuto", opposite: "Impulsivo" },
  { id: "Impulsivo", opposite: "Prudente" }, { id: "Prudente", opposite: "Impulsivo" },
  { id: "Agresivo", opposite: "Honrado" }, { id: "Honrado", opposite: "Rebelde" },
  { id: "Rebelde", opposite: "Honrado" }, { id: "Leal", opposite: "Rebelde" }
];
let wizardInitialized = false;
export function initWizard() {
  if (wizardInitialized) return;
  wizardInitialized = true;
  const form = byId("character-form");
  const steps = [...form.querySelectorAll(".wizard-step")];
  const nav = [...document.querySelectorAll(".progress-step")];
  const picked = [];
  let current = 0;
  const summary = () => {
    byId("summary-name").textContent = form.elements.name.value.trim() || "Aventurero";
    byId("summary-handle").textContent = form.elements.handle.value.trim() || "@usuario";
    byId("summary-faction").textContent = form.querySelector('[name=faction]:checked')?.value || "Pirata";
    byId("summary-sea").textContent = form.elements.originSea.value;
    byId("summary-traits").textContent = picked.join(" / ") || "Elige dos rasgos";
    byId("summary-dream").textContent = form.querySelector('[name=dream]:checked')?.value || "Libertad";
  };
  const showStep = (index) => {
    current = Math.max(0, Math.min(steps.length - 1, index));
    steps.forEach((el, i) => el.classList.toggle("active", i === current));
    nav.forEach((el, i) => el.classList.toggle("active", i === current));
    byId("prev-step").hidden = current === 0;
    byId("next-step").hidden = current === steps.length - 1;
    byId("submit-step").hidden = current !== steps.length - 1;
    summary();
  };
  document.querySelectorAll(".trait-card").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.trait;
    const def = TRAITS.find((entry) => entry.id === id);
    if (picked.includes(id)) picked.splice(picked.indexOf(id), 1);
    else if (picked.length < 2 && !picked.some((chosen) => TRAITS.find((entry) => entry.id === chosen)?.opposite === id || def?.opposite === chosen)) picked.push(id);
    else return;
    document.querySelectorAll(".trait-card").forEach((card) => {
      const selected = picked.includes(card.dataset.trait);
      const conflicts = picked.some((chosen) => TRAITS.find((entry) => entry.id === chosen)?.opposite === card.dataset.trait || TRAITS.find((entry) => entry.id === card.dataset.trait)?.opposite === chosen);
      card.classList.toggle("selected", selected);
      card.classList.toggle("disabled", !selected && conflicts);
    });
    form.elements.traitPrimary.value = picked[0] || "";
    form.elements.traitSecondary.value = picked[1] || "";
    summary();
  }));
  byId("next-step").addEventListener("click", () => {
    if (current === 0 && (!form.elements.name.value.trim() || !/^@[a-zA-Z0-9_]{2,16}$/.test(form.elements.handle.value.trim()))) {
      form.elements.handle.setCustomValidity("Usa @ seguido por 2-16 letras, números o guion bajo.");
      form.elements.handle.reportValidity(); form.elements.handle.setCustomValidity(""); return;
    }
    if (current === 2 && picked.length !== 2) { window.alert("Selecciona exactamente dos rasgos."); return; }
    showStep(current + 1);
  });
  byId("prev-step").addEventListener("click", () => showStep(current - 1));
  nav.forEach((button) => button.addEventListener("click", () => {
    const target = Number(button.dataset.stepNav) - 1;
    if (target > current) return;
    showStep(target);
  }));
  form.addEventListener("change", summary);
  form.elements.name.addEventListener("input", summary);
  form.elements.handle.addEventListener("input", summary);
  document.querySelectorAll("#faction-list input, #dream-list input").forEach((radio) => radio.addEventListener("change", () => {
    document.querySelectorAll(`#${radio.name === "faction" ? "faction-list" : "dream-list"} .option-card`).forEach((card) => card.classList.toggle("selected", card.contains(radio) && radio.checked));
  }));
  byId("archive-button")?.addEventListener("click", () => byId("world-panel")?.scrollIntoView({ behavior: "smooth" }));
  showStep(0);
}
