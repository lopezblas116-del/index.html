import {
  SAVE_KEY, PULSE_MS, confrontFugitive, createCharacter, createHeir,
  loadGame, resolveAutonomousBranch, resolveBranch, saveGame, setAutonomyPaused, simulateOffline
} from "./game.js";
import {
  closeLegacyModal, closePantheon, initIslandView, initWizard, openPantheon,
  renderGame, renderIslandView, resetWizard, showSetup
} from "./ui.js";
import { focusMap, returnToGlobalMap } from "./world3d.js";
import { initHud, openIslandPanel, renderHud, setHudVisible } from "./hud.js";
import { ensureBlockOneData, initBlock1 } from "./block1.js";
import {
  draftTestament, ensureAdvancedSystems, performDockyardAction,
  setClimateZone, suggestNavigation, tavernAction
} from "./systems.js";
import { trade } from "./combat_economy.js";
import { createNetwork } from "./network.js";
import { SUPABASE_CONFIG } from "./network-config.js";
import { attackWorldNoble, lootCelestialTribute, resolveCapture, sabotageTyrantPort } from "./politics.js";
import { removeStorage } from "./storage_adapter.js";
import { EVENT_TYPES, onTypedEvent } from "./event_dispatcher.js";
import { sendConsciousnessWhisper } from "./chat_engine.js";
import { adjustLocalBounty, applyGMEvent, isLocalGMAvailable, scheduleGMEvent, transmitLocalGMMessage } from "./gm_engine.js";
import { getMapIslands } from "./map.js";
import { claimLocalSovereignty, startNavalBlockade } from "./geopolitics.js";
import { sellPoneglyphRubbing, translateRubbing } from "./archaeology_system.js";
import { syncCodex } from "./codex_engine.js";
import { emitVfx, initVfx, trackVisualChanges } from "./vfx_engine.js";
import { celebrateAvatar } from "./island_renderer.js";

let character = loadGame();
initVfx();
const network = createNetwork();
let sharedState = network.snapshot();
if (character?.world) Object.defineProperty(character.world, "shared", { value: sharedState, writable: true, configurable: true, enumerable: false });
let timerId = null;
let branchTimer = null;
let scouting = false;
const byId = (id) => document.getElementById(id);
const listen = (element, type, handler, options) => { if (element) element.addEventListener(type, handler, options); };
function paint() {
  if (!character) return;
  ensureBlockOneData(character);
  ensureAdvancedSystems(character);
  if (syncCodex(character)) saveGame(character);
  Object.defineProperty(character.world, "shared", { value: sharedState, writable: true, configurable: true, enumerable: false });
  renderGame(character);
  renderIslandView(character);
  renderHud(character);
  trackVisualChanges(character);
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
onTypedEvent(EVENT_TYPES.globalChatMessage, (event) => {
  if (!character || character.status === "dead") return;
  const { message } = event.detail;
  network.publish("global_chat", { text: message.text }, character, message.id);
  persistRender();
});
onTypedEvent(EVENT_TYPES.journalEntry, (event) => {
  if (!character || character.status === "dead") return;
  character.log.unshift({ time: new Date().toISOString(), message: event.detail.message });
  character.log = character.log.slice(0, 80);
  persistRender();
});
onTypedEvent(EVENT_TYPES.newsArticle, (event) => {
  if (!character || character.status === "dead") return;
  character.world.news.unshift(event.detail.article);
  character.world.news = character.world.news.slice(0, 60);
  persistRender();
});
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
    network.publish("mission", { island, faction: c.faction, level: c.level, crewSize: c.crew?.length || 0 }, c);
  }
  if ((c.activeContracts || []).filter((item) => item.status === "completed").length > before.contracts) {
    network.publish("contract", { island, completed: true }, c);
  }
  const newLogs = [];
  for (const entry of c.log || []) { if (entry === before.firstLog) break; newLogs.push(entry); }
  if (newLogs.some((entry) => /^⚔ Victoria/.test(entry.message))) {
    celebrateAvatar(c);
    emitVfx("victory");
  }
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
  if (document.hidden || !character || character.status === "dead" || character.autonomy?.paused || character.captured) return;
  timerId = setTimeout(() => {
    if (!character || character.status === "dead" || character.autonomy?.paused || character.captured) return;
    network.batch(() => simulateOffline(character, Date.now(), { before: publicSnapshot, after: publishChanges, interactive: !document.hidden && navigator.onLine, availableFruitIds: availableFruitIds() }));
    if (sharedState.status === "local") network.persistLocalWorld();
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
initIslandView();
listen(document, "onepiece:open-island-panel", (event) => openIslandPanel(event.detail?.panel));
listen(document, "onepiece:local-suggestion", (event) => {
  if (!character || character.status === "dead" || character.location?.atSea) return;
  const { islandId, poiId } = event.detail || {};
  const island = getMapIslands(character).find((entry) => entry.id === islandId && entry.name === character.location?.island);
  if (!island?.pois.some((poi) => poi.id === poiId)) return;
  character.localSuggestion = poiId;
  persistRender();
});
initBlock1({ getCharacter: () => character, onChange: () => persistRender(), onPublicAction: (type, data, actor) => network.publish(type, data, actor) });
network.subscribe((state) => { sharedState = state; if (character) paint(); });
network.sync();
function resumeOffline() {
  if (!character) return;
  const pending = character.autonomy.pendingBranch;
  const result = network.batch(() => simulateOffline(character, Date.now(), { before: publicSnapshot, after: publishChanges, availableFruitIds: availableFruitIds() }));
  if (sharedState.status === "local") network.persistLocalWorld();
  claimPendingFruit(character);
  if (result.ticks || pending !== character.autonomy.pendingBranch) { persistRender(true); if (character.location?.atSea) scoutFugitive(character); }
}
window.addEventListener("online", () => { resumeOffline(); network.sync(); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearTimeout(timerId);
  else { resumeOffline(); scheduleTick(); }
});
let syncTimer;
function scheduleNetworkSync() {
  clearTimeout(syncTimer);
  if (document.hidden || (!SUPABASE_CONFIG.url && !SUPABASE_CONFIG.publishableKey)) return;
  syncTimer = setTimeout(async () => {
    await network.sync();
    scheduleNetworkSync();
  }, 30000);
}
document.addEventListener("visibilitychange", scheduleNetworkSync);
scheduleNetworkSync();
if (character) {
  if (character.status !== "dead" && character.autonomy?.paused) {
    setAutonomyPaused(character, false);
    saveGame(character);
  }
  ensureBlockOneData(character);
  const pending = character.autonomy.pendingBranch;
  const offline = network.batch(() => simulateOffline(character, Date.now(), { before: publicSnapshot, after: publishChanges, availableFruitIds: availableFruitIds() }));
  if (sharedState.status === "local") network.persistLocalWorld();
  claimPendingFruit(character);
  if (offline.ticks || pending !== character.autonomy.pendingBranch) saveGame(character);
  paint();
  if (character.status !== "dead" && !character.captured) scheduleTick();
} else showSetup();

listen(document, "onepiece:map-destination", (event) => {
  if (!character || character.status === "dead") return;
  character.navigationTarget = { id: event.detail.id, name: event.detail.name, sea: event.detail.sea, x: event.detail.x, y: event.detail.y };
  persistRender();
});
listen(document, "onepiece:hud-whisper", (event) => {
  if (!character || character.status === "dead") return;
  const before = publicSnapshot(character);
  sendConsciousnessWhisper(character, event.detail?.text || "");
  publishChanges(before, character, true);
  if (character.location?.atSea) scoutFugitive(character);
  persistRender();
});
listen(byId("character-form"), "submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const traits = [String(data.get("traitPrimary") || ""), String(data.get("traitSecondary") || "")].filter(Boolean);
  if (traits.length !== 2) { window.alert("Selecciona dos rasgos para la Tarjeta del Alma."); return; }
  const avatarConfig = { skin: String(data.get("skin") || "Clara"), eyes: String(data.get("eyes") || "Marrón"), hair: String(data.get("hair") || "Negro"), outfit: String(data.get("outfit") || "Rojo"), accessory: String(data.get("accessory") || "Bandana") };
  character = createCharacter({ name: String(data.get("name") || "Aventurero"), username: String(data.get("handle") || "@usuario"), faction: String(data.get("faction") || "Pirata"), race: String(data.get("race") || "human"), allowRareRace: data.get("allowRareRace") === "true", starterChallenge: true, originSea: String(data.get("originSea") || "East Blue"), profession: String(data.get("profession") || "Navegante"), dream: String(data.get("dream") || "Libertad"), alignment: String(data.get("alignment") || "Libertad"), story: String(data.get("story") || ""), traits, appearance: avatarConfig });
  if (sharedState.status === "local") {
    character.world.day = sharedState.world?.last_cycle_day || 0;
    character.world.year = Math.floor(character.world.day / 365) + 1;
  }
  ensureBlockOneData(character);
  persistRender(true);
});
listen(byId("whisper-form"), "submit", (event) => { event.preventDefault(); if (!character || character.status === "dead") return; const input = byId("whisper-input"); if (!input) return; const before = publicSnapshot(character); sendConsciousnessWhisper(character, input.value); publishChanges(before, character, true); if (character.location?.atSea) scoutFugitive(character); input.value = ""; persistRender(); input.focus(); });
listen(byId("heir-form"), "submit", (event) => { event.preventDefault(); if (!character || character.status !== "dead") return; const heir = createHeir(character, { name: byId("heir-name")?.value.trim() || undefined, username: byId("heir-username")?.value.trim() || undefined }); if (!heir) return; character = heir; ensureBlockOneData(character); event.currentTarget.reset(); closeLegacyModal(); persistRender(true); });
listen(document.querySelector("[data-close-pantheon]"), "click", closePantheon);
listen(document.querySelector("[data-close-legacy]"), "click", closeLegacyModal);
listen(document.querySelector("[data-open-heir]"), "click", () => { const modal = byId("legacy-modal"); if (modal && !modal.open) modal.showModal(); });
function startNewGame() {
  clearTimeout(timerId);
  clearTimeout(branchTimer);
  returnToGlobalMap(true);
  removeStorage(SAVE_KEY);
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
listen(document, "onepiece:hud-tavern-action", (event) => {
  if (!character || character.status === "dead" || character.location?.atSea) return;
  const result = tavernAction(character, event.detail?.visitorId, event.detail?.action);
  persistRender();
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result.message } }));
});
listen(document, "onepiece:hud-shipyard-action", (event) => {
  if (!character) return;
  const result = performDockyardAction(character, event.detail?.action);
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
  const localWorld = sharedState.status === "local" ? sharedState.world : null;
  const result = trade(character, event.detail?.id, event.detail?.action, localWorld);
  const persisted = result.ok && localWorld ? network.persistLocalWorld() : true;
  persistRender();
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: persisted ? result.message : `${result.message} No se pudo guardar el mundo local.` } }));
});
listen(document, "onepiece:hud-territory-claim", (event) => {
  if (!character || sharedState.status !== "local") return;
  const result = network.mutateLocalWorld((world) => claimLocalSovereignty(world, character, event.detail?.islandId, Number(event.detail?.taxRate)));
  if (result?.ok) persistRender(true);
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result?.message || "No se pudo guardar el mundo local." } }));
});
listen(document, "onepiece:hud-territory-blockade", (event) => {
  if (!character || sharedState.status !== "local") return;
  const berries = character.berries;
  const result = network.mutateLocalWorld((world) => startNavalBlockade(world, character, event.detail?.islandId, {
    durationDays: Number(event.detail?.durationDays),
    day: Number(world.last_cycle_day ?? character.world.day) || 0
  }));
  if (result?.ok) persistRender(true);
  else if (character.berries !== berries) character.berries = berries;
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result?.message || "No se pudo guardar el mundo local." } }));
});
listen(document, "onepiece:hud-translate-rubbing", (event) => {
  if (!character) return;
  const result = translateRubbing(character, event.detail?.rubbingId);
  if (result.ok) persistRender();
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result.message } }));
});
listen(document, "onepiece:hud-sell-rubbing", (event) => {
  if (!character) return;
  const localWorld = sharedState.status === "local" ? sharedState.world : null;
  const berries = character.berries;
  const log = [...(character.log || [])];
  const inventoryItems = [...(character.inventory?.items || [])];
  const rubbing = character.archaeology?.rubbings?.find((entry) => entry.id === event.detail?.rubbingId);
  const wasSold = rubbing?.sold;
  const result = localWorld
    ? network.mutateLocalWorld((world) => sellPoneglyphRubbing(character, event.detail?.rubbingId, world))
    : sellPoneglyphRubbing(character, event.detail?.rubbingId, null);
  if (result?.ok) persistRender();
  else {
    character.berries = berries;
    character.log = log;
    if (character.inventory) character.inventory.items = inventoryItems;
    if (rubbing) rubbing.sold = wasSold;
  }
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result?.message || "No se pudo vender el calco." } }));
});
listen(document, "onepiece:hud-open-pantheon", openPantheon);
listen(document, "onepiece:hud-network-refresh", () => { network.sync(); });
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
listen(document, "onepiece:hud-gm-broadcast", (event) => {
  if (!isLocalGMAvailable(character)) return;
  const result = transmitLocalGMMessage(event.detail?.text);
  if (result.ok) {
    character.log.unshift({ time: new Date().toISOString(), message: "[GM] Comunicado guardado en el Chat local; no se envió al servidor." });
    persistRender();
  }
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result.ok ? "Comunicado publicado solo en el Chat local." : result.message } }));
});
listen(document, "onepiece:hud-gm-event", (event) => {
  if (!isLocalGMAvailable(character)) return;
  const result = applyGMEvent(character, event.detail?.type, "manual");
  if (!result) return;
  persistRender();
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: "Evento GM aplicado a esta partida local." } }));
});
listen(document, "onepiece:hud-gm-schedule", (event) => {
  if (!isLocalGMAvailable(character)) return;
  const result = scheduleGMEvent(character, event.detail?.type, event.detail?.delayMinutes);
  if (result.ok) persistRender();
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result.ok ? "Evento añadido a la agenda local." : result.message } }));
});
listen(document, "onepiece:hud-gm-bounty", (event) => {
  if (!isLocalGMAvailable(character)) return;
  const result = adjustLocalBounty(character, event.detail?.value);
  if (result.ok) persistRender();
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result.ok ? "Recompensa local actualizada." : result.message } }));
});
