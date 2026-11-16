import {
  SAVE_KEY, PULSE_MS, confrontFugitive, createCharacter, createHeir,
  loadGame, resolveAutonomousBranch, resolveBranch, saveGame, sendWhisper, setAutonomyPaused, simulateOffline
} from "./game.js";
import {
  closeLegacyModal, closePantheon, initWizard, openPantheon,
  renderGame, resetWizard, showSetup
} from "./ui.js";
import { focusMap, initWorldMap, renderMap, resizeMap } from "./world3d.js";
import { initHud, renderHud, setHudVisible } from "./hud.js";
import { ensureBlockOneData, initBlock1 } from "./block1.js";
import {
  draftTestament, ensureAdvancedSystems,
  setClimateZone, suggestNavigation, tavernAction
} from "./systems.js";
import { trade } from "./combat_economy.js";
import { createNetwork } from "./network.js";
import { attackWorldNoble, lootCelestialTribute, resolveCapture, sabotageTyrantPort } from "./politics.js";

let character = loadGame();
const network = createNetwork();
let sharedState = network.snapshot();
let timerId = null;
let branchTimer = null;
let scouting = false;
const byId = (id) => document.getElementById(id);
const listen = (element, type, handler, options) => { if (element) element.addEventListener(type, handler, options); };
function paint() {
  if (!character) return;
  ensureBlockOneData(character);
  ensureAdvancedSystems(character);
  Object.defineProperty(character.world, "shared", { value: sharedState, writable: true, configurable: true, enumerable: false });
  renderGame(character);
  initWorldMap();
  resizeMap();
  renderMap(character);
  renderHud(character);
  clearTimeout(branchTimer);
  const pending = character.autonomy?.pendingBranch;
  if (pending && !character.autonomy.paused) {
    branchTimer = setTimeout(() => {
      if (character?.autonomy?.pendingBranch === pending && resolveAutonomousBranch(character)) persistRender();
    }, Math.max(0, pending.deadline - Date.now()));
  }
}
function publicSnapshot(c) {
  return { day: c.world?.day || 0, completed: c.mission?.completed || 0, contracts: (c.activeContracts || []).filter((item) => item.status === "completed").length, bounty: c.bounty || 0, status: c.status, firstLog: c.log?.[0] };
}
function availableFruitIds() {
  return (sharedState.world?.devil_fruits || []).filter((fruit) => fruit.state === "wild").map((fruit) => fruit.id);
}
function claimPendingFruit(actor) {
  const pending = actor?.pendingFruit;
  if (!pending || actor.status === "dead") return;
  delete actor.pendingFruit;
  network.claimFruit(pending.fruitId, actor.id, pending.position).then((fruit) => {
    if (character !== actor) return;
    if (!fruit) {
      actor.log.unshift({ time: new Date().toISOString(), message: "[BITÁCORA] La fruta ya no estaba disponible; su hallazgo no pudo sellarse." });
    } else if (actor.status === "dead") {
      network.releaseFruit(fruit.id, actor.id);
    } else {
      actor.fruit = { ...fruit, swimming: false };
      actor.log.unshift({ time: new Date().toISOString(), message: `🍈 ${fruit.name} queda vinculada a ${actor.name}. Ya no puede nadar.` });
    }
    saveGame(actor);
    paint();
  });
}
async function scoutFugitive(actor) {
    if (scouting || !actor?.location?.atSea || !actor.mapPosition || actor.status === "dead") return;
    const { x, y } = actor.mapPosition;
    scouting = true;
    try {
      const name = await network.scout(x, y);
      if (!name || character !== actor || actor.status === "dead" || !actor.location?.atSea || actor.mapPosition?.x !== x || actor.mapPosition?.y !== y) return;
      const before = publicSnapshot(actor);
      const result = confrontFugitive(actor, name);
      publishChanges(before, actor);
      if (result?.wins) network.publish("boss_defeated", { boss: name, x, y }, actor);
      persistRender(true);
    } finally { scouting = false; }
}
function publishChanges(before, c, whispered = false) {
  if (!c || !before) return;
  if ((c.world?.day || 0) > before.day) network.advanceCycle(c.world.day);
  const island = c.location?.atSea ? "alta mar" : c.location?.island;
  if ((c.mission?.completed || 0) > before.completed) {
    network.publish("mission", { island, faction: c.faction }, c);
  }
  if ((c.activeContracts || []).filter((item) => item.status === "completed").length > before.contracts) {
    network.publish("contract", { island, completed: true }, c);
  }
  const newLogs = [];
  for (const entry of c.log || []) { if (entry === before.firstLog) break; newLogs.push(entry); }
  if (newLogs.some((entry) => /^\[COMBATE\] Encuentro|^⚔ Victoria|^Derrota contra/.test(entry.message))) {
    network.publish("battle", { island }, c);
  }
  if (c.bounty !== before.bounty || (c.mission?.completed || 0) > before.completed) {
    network.publish("bounty", { captain_id: c.id, bounty: c.bounty }, c);
  }
  if (before.status !== "dead" && c.status === "dead") {
    network.publish("death", { captain_id: c.id, island, maps: c.systems?.treasureMaps || [], notes: c.ancientLanguage?.fragments || [], fruit_id: c.fruit?.id, cause: c.world.pantheon?.[0]?.cause || "desconocida" }, c);
  }
  if (whispered) network.publish("whisper", { island }, c);
}
function scheduleTick() {
  clearTimeout(timerId);
  if (!character || character.status === "dead" || character.autonomy?.paused || character.captured) return;
  timerId = setTimeout(() => {
    if (!character || character.status === "dead" || character.autonomy?.paused || character.captured) return;
    network.batch(() => simulateOffline(character, Date.now(), { before: publicSnapshot, after: publishChanges, interactive: !document.hidden && navigator.onLine, availableFruitIds: availableFruitIds() }));
    claimPendingFruit(character);
    if (character.location?.atSea) scoutFugitive(character);
    saveGame(character);
    paint();
    scheduleTick();
  }, Math.max(0, (character.autonomy.lastPulseAt ?? Date.now()) + PULSE_MS - Date.now()));
}
function persistRender(reschedule = false) {
  if (!character) return;
  ensureBlockOneData(character);
  ensureAdvancedSystems(character);
  saveGame(character);
  paint();
  if (reschedule) scheduleTick();
}

initWizard();
initHud();
initBlock1({ getCharacter: () => character, onChange: () => persistRender(), onPublicAction: (type, data, actor) => network.publish(type, data, actor) });
network.subscribe((state) => { sharedState = state; if (character) paint(); });
network.sync();
function resumeOffline() {
  if (!character) return;
  const pending = character.autonomy.pendingBranch;
  const result = network.batch(() => simulateOffline(character, Date.now(), { before: publicSnapshot, after: publishChanges, availableFruitIds: availableFruitIds() }));
  claimPendingFruit(character);
  if (result.ticks || pending !== character.autonomy.pendingBranch) { persistRender(true); if (character.location?.atSea) scoutFugitive(character); }
}
window.addEventListener("online", () => { resumeOffline(); network.sync(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) resumeOffline(); });
setInterval(() => network.sync(), 30000);
if (character) {
  ensureBlockOneData(character);
  const pending = character.autonomy.pendingBranch;
  const offline = network.batch(() => simulateOffline(character, Date.now(), { before: publicSnapshot, after: publishChanges, availableFruitIds: availableFruitIds() }));
  claimPendingFruit(character);
  if (offline.ticks || pending !== character.autonomy.pendingBranch) saveGame(character);
  paint();
  if (character.status !== "dead" && !character.captured) scheduleTick();
} else showSetup();

listen(window, "resize", () => { if (!character) return; resizeMap(); renderMap(character); });
listen(document, "onepiece:map-destination", (event) => {
  if (!character || character.status === "dead") return;
  character.navigationTarget = { id: event.detail.id, name: event.detail.name, sea: event.detail.sea, x: event.detail.x, y: event.detail.y };
  persistRender();
  if (!character.location?.atSea && event.detail.name === character.location?.island) document.dispatchEvent(new CustomEvent("onepiece:open-tavern"));
});
listen(document, "onepiece:hud-whisper", (event) => {
  if (!character || character.status === "dead") return;
  const before = publicSnapshot(character);
  sendWhisper(character, event.detail?.text || "");
  publishChanges(before, character, true);
  if (character.location?.atSea) scoutFugitive(character);
  persistRender();
});
listen(byId("character-form"), "submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const traits = [String(data.get("traitPrimary") || ""), String(data.get("traitSecondary") || "")].filter(Boolean);
  if (traits.length !== 2) { window.alert("Selecciona dos rasgos para la Tarjeta del Alma."); return; }
  character = createCharacter({ name: String(data.get("name") || "Aventurero"), username: String(data.get("handle") || "@usuario"), faction: String(data.get("faction") || "Pirata"), race: String(data.get("race") || "human"), dream: String(data.get("dream") || "Libertad"), alignment: String(data.get("alignment") || "Libertad"), story: String(data.get("story") || ""), traits, appearance: { skin: String(data.get("skin") || "Clara"), hair: String(data.get("hair") || "Negro"), accessory: String(data.get("accessory") || "Bandana") } });
  if (sharedState.status === "local") {
    character.world.day = sharedState.world?.last_cycle_day || 0;
    character.world.year = Math.floor(character.world.day / 365) + 1;
  }
  ensureBlockOneData(character);
  persistRender(true);
});
listen(byId("whisper-form"), "submit", (event) => { event.preventDefault(); if (!character || character.status === "dead") return; const input = byId("whisper-input"); if (!input) return; const before = publicSnapshot(character); sendWhisper(character, input.value); publishChanges(before, character, true); if (character.location?.atSea) scoutFugitive(character); input.value = ""; persistRender(); input.focus(); });
listen(byId("pause-button"), "click", () => { if (!character || character.status === "dead") return; setAutonomyPaused(character, !character.autonomy.paused); persistRender(true); });
listen(byId("heir-form"), "submit", (event) => { event.preventDefault(); if (!character || character.status !== "dead") return; const heir = createHeir(character, { name: byId("heir-name")?.value.trim() || undefined, username: byId("heir-username")?.value.trim() || undefined }); if (!heir) return; character = heir; ensureBlockOneData(character); event.currentTarget.reset(); closeLegacyModal(); persistRender(true); });
listen(byId("archive-button"), "click", openPantheon);
listen(document.querySelector("[data-close-pantheon]"), "click", closePantheon);
listen(document.querySelector("[data-close-legacy]"), "click", closeLegacyModal);
listen(document.querySelector("[data-open-heir]"), "click", () => { const modal = byId("legacy-modal"); if (modal && !modal.open) modal.showModal(); });
function startNewGame() {
  clearTimeout(timerId);
  clearTimeout(branchTimer);
  localStorage.removeItem(SAVE_KEY);
  character = null;
  byId("character-form")?.reset();
  closeLegacyModal();
  closePantheon();
  setHudVisible(false);
  resetWizard();
  showSetup();
}
listen(byId("reset-button"), "click", () => { if (window.confirm("¿Empezar una nueva partida? Se borrará el avatar actual; el mundo local se conservará.")) startNewGame(); });
listen(document, "onepiece:hud-new-game", startNewGame);
listen(document, "onepiece:hud-branch-choice", (event) => {
  if (!character || character.autonomy?.paused || !character.autonomy?.pendingBranch) return;
  const resolved = character.autonomy.pendingBranch.deadline <= Date.now()
    ? resolveAutonomousBranch(character)
    : resolveBranch(character, event.detail?.choice);
  if (!resolved) return;
  persistRender();
});
listen(document, "onepiece:hud-toggle-pause", () => {
  if (!character || character.status === "dead") return;
  setAutonomyPaused(character, !character.autonomy.paused);
  persistRender(true);
});
listen(document, "onepiece:hud-tavern-action", (event) => {
  if (!character || character.status === "dead" || character.location?.atSea) return;
  const result = tavernAction(character, event.detail?.visitorId, event.detail?.action);
  persistRender();
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result.message } }));
});
listen(document, "onepiece:hud-draft-will", () => {
  if (!character || character.status === "dead") return;
  draftTestament(character);
  persistRender();
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: "Testamento redactado y guardado en la bitácora." } }));
});
listen(document, "onepiece:hud-set-climate", (event) => {
  if (!character || character.status === "dead" || !setClimateZone(character, event.detail?.zone)) return;
  persistRender();
});
listen(document, "onepiece:hud-investigate-news", (event) => {
  const location = event.detail?.location;
  if (!character || character.status === "dead" || !Number.isFinite(location?.x) || !Number.isFinite(location?.y)) return;
  character.navigationTarget = { ...location, type: "news" };
  persistRender();
  focusMap(location);
});
listen(document, "onepiece:hud-redirect", (event) => {
  const location = event.detail?.location;
  if (!character || character.status === "dead") return;
  const result = suggestNavigation(character, location);
  if (result.accepted) character.navigationTarget = { ...location, type: "news" };
  persistRender();
  if (result.accepted) focusMap(location);
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result.message } }));
});
listen(document, "onepiece:hud-trade", (event) => {
  if (!character || character.status === "dead") return;
  const result = trade(character, event.detail?.id, event.detail?.action);
  persistRender();
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result.message } }));
});
listen(document, "onepiece:hud-open-pantheon", openPantheon);
listen(document, "onepiece:hud-politics", (event) => {
  if (!character || character.status === "dead") return;
  const action = event.detail?.action;
  const result = action === "tribute" ? lootCelestialTribute(character, sharedState.world)
    : action === "sabotage" ? sabotageTyrantPort(character, sharedState.world)
      : action === "noble" ? attackWorldNoble(character, sharedState.world)
        : resolveCapture(character, action);
  if (result.ok && result.type) {
    network.publish(result.type, { island: result.island, alignment: character.soulCard?.alignment }, character);
    if (action === "noble") network.publish("bounty", { captain_id: character.id, bounty: character.bounty }, character);
  }
  persistRender(true);
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result.message } }));
});
