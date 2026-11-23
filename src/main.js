import {
  SAVE_KEY, PULSE_MS, coliseoFight, confrontFugitive, createCharacter, createHeir,
  loadGame, resolveAutonomousBranch, resolveBranch, saveGame, setAutonomyPaused, simulateOffline, suggestSail
} from "./game.js";
import {
  closeLegacyModal, closePantheon, HISTORIAS_DADO, initWizard, openPantheon,
  renderGame, resetWizard, showSetup
} from "./ui/ui.js";
import { initHud, renderHud, setHudVisible } from "./ui/hud.js";
import { renderGameStateUI } from "../js/ui.js";
import { sincronizarEstado } from "../js/state.js";
import { generateRandomOrigin, isBiographyValid } from "./character_creation.js";
import { ensureBlockOneData, initBlock1 } from "./block1.js";
import {
  draftTestament, ensureAdvancedSystems, performDockyardAction,
  setClimateZone, suggestNavigation, tavernAction, tablonDelPuerto, sugerirEncargo
} from "./systems.js";
import { pagarTributo, desoibirTributo, consultarFilosofo } from "./world_government.js";
import { trade } from "./combat_economy.js";
import { createNetwork } from "./network.js";
import { SUPABASE_CONFIG } from "./network-config.js";
import { attackWorldNoble, lootCelestialTribute, resolveCapture, sabotageTyrantPort } from "./politics.js";
import { removeStorage } from "./storage_adapter.js";
import { ensurePoliticalStance } from "./lore_engine.js";
import { EVENT_TYPES, onTypedEvent } from "./event_dispatcher.js";
import { sendConsciousnessWhisper } from "./chat_engine.js";
import { adjustLocalBounty, applyGMEvent, isLocalGMAvailable, scheduleGMEvent, transmitLocalGMMessage } from "./gm_engine.js";
import { getMapIslands } from "./map.js";
import { claimLocalSovereignty, startNavalBlockade } from "./geopolitics.js";
import { beginStarterIslandAdventure, resolveIslandCrisis } from "./narrative_engine.js";
import { anunciarLlegada, initUIBinding } from "../js/ui.js";
import { sellPoneglyphRubbing, translateRubbing } from "./archaeology_system.js";
import { syncCodex } from "./codex_engine.js";
import { emitVfx, initVfx, trackVisualChanges } from "./vfx_engine.js";
import { celebrateAvatar } from "./island_renderer.js";
import { registerCharacter, retirarUser, susurrar, syncCharacter } from "./mundo/fusion.js";
import "./mundo/index.js";

let character = loadGame();
initVfx();
initUIBinding(); // conecta gameState → pantalla (js/state.js + js/ui.js)
const network = createNetwork();
let sharedState = network.snapshot();
if (character?.world) Object.defineProperty(character.world, "shared", { value: sharedState, writable: true, configurable: true, enumerable: false });
let timerId = null;
let syncTimer = null;
let branchTimer = null;
let scouting = false;
const byId = (id) => document.getElementById(id);
const listen = (element, type, handler, options) => { if (element) element.addEventListener(type, handler, options); };
function paint() {
  if (!character) return;
  ensureBlockOneData(character);
  ensureAdvancedSystems(character);
  ensurePoliticalStance(character); // la marea política existe desde el primer latido (y se persiste)
  const startingIsland = getMapIslands(character).find((island) => island.name === character.location?.island);
  const starterAdventureStarted = beginStarterIslandAdventure(character, startingIsland);
  if (syncCodex(character)) saveGame(character);
  Object.defineProperty(character.world, "shared", { value: sharedState, writable: true, configurable: true, enumerable: false });
  renderGame(character);
  renderHud(character);
  // banner de llegada: anuncia cada isla nueva que pisa el avatar (con su bioma)
  const islaActual = character.location?.atSea ? null : (character.location?.island || null);
  if (islaActual && islaActual !== (window.__islaAnunciada || null)) {
    window.__islaAnunciada = islaActual;
    const datos = getMapIslands(character).find((island) => island.name === islaActual);
    anunciarLlegada(datos || { name: islaActual });
  }
  trackVisualChanges(character);
  if (syncCharacter(character) || starterAdventureStarted) saveGame(character);
  clearTimeout(branchTimer);
  const pending = character.autonomy?.pendingBranch;
  if (pending && !character.autonomy.paused) {
    branchTimer = setTimeout(() => {
      if (character?.autonomy?.pendingBranch === pending && resolveAutonomousBranch(character)) persistRender();
    }, Math.max(0, pending.deadline - Date.now()));
  }
}
function publicSnapshot(c) {
  return { day: c.world?.day || 0, completed: c.mission?.completed || 0, contracts: (c.activeContracts || []).filter((item) => item.status === "completed").length, bounty: c.bounty || 0, berries: c.berries || 0, status: c.status, firstLog: c.log?.[0] };
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
    network.publish("battle", { island, reward: Math.max(0, (Number(c.berries) || 0) - before.berries) }, c);
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
  sincronizarEstado(character); // el chip del capitán y el chrome reflejan el alma viva
  renderGameStateUI();
  saveGame(character);
  paint();
  if (reschedule) scheduleTick();
}

initWizard();
initHud();
initBlock1({ getCharacter: () => character, onChange: () => persistRender(), onPublicAction: (type, data, actor) => network.publish(type, data, actor) });
network.subscribe((state) => { sharedState = state; if (character) paint(); });
network.sync();
window.addEventListener("mil-almas:ready", () => {
  if (!character) return;
  registerCharacter(character);
  paint();
});
// el espejo de eventos del mundo vivo corre dentro de syncCharacter (paint):
// un segundo listener por tick duplicaba el recorrido del feed
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
  if (document.hidden) { clearTimeout(timerId); clearTimeout(syncTimer); }
  else { resumeOffline(); scheduleTick(); scheduleNetworkSync(); }
});
function scheduleNetworkSync() {
  clearTimeout(syncTimer);
  if (document.hidden || (!SUPABASE_CONFIG.url && !SUPABASE_CONFIG.publishableKey)) return;
  syncTimer = setTimeout(async () => {
    await network.sync();
    scheduleNetworkSync();
  }, 30000);
}
scheduleNetworkSync();
listen(document, "onepiece:hud-whisper", (event) => {
  if (!character || character.status === "dead") return;
  const before = publicSnapshot(character);
  const text = event.detail?.text || "";
  sendConsciousnessWhisper(character, text);
  susurrar(text);
  publishChanges(before, character, true);
  if (character.location?.atSea) scoutFugitive(character);
  persistRender();
});
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

listen(byId("character-form"), "submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  // la historia es opcional: si quedó vacía, el dado del mar cuenta una por vos
  let historia = String(data.get("story") || "").trim();
  if (!historia) historia = HISTORIAS_DADO[Math.floor(Math.random() * HISTORIAS_DADO.length)];
  const traits = [String(data.get("traitPrimary") || ""), String(data.get("traitSecondary") || "")].filter(Boolean);
  if (traits.length !== 2) { window.alert("Selecciona dos rasgos para la Tarjeta del Alma."); return; }
  const avatarConfig = {
    skin: String(data.get("skin") || "Clara"), eyes: String(data.get("eyes") || "Marrón"),
    hair: String(data.get("hair") || "Negro"), outfit: String(data.get("outfit") || "chaleco-sol"),
    outfitColor: String(data.get("outfitColor") || ""), accessory: String(data.get("accessory") || "Ninguno"),
    detail: String(data.get("detail") || "Ninguno"), coat: String(data.get("coat") || "Ninguno")
  };
  const randomOrigin = generateRandomOrigin();
  // raza y mar pueden venir del Gacha del Destino (3 monedas); si no, azar puro al zarpar
  const raceGacha = String(data.get("race") || "");
  const seaGacha = String(data.get("originSea") || "");
  const faction = String(data.get("faction") || "Pirata");
  character = createCharacter({ name: String(data.get("name") || "Aventurero"), username: String(data.get("handle") || "@usuario"), faction: faction === "Autonomo" ? "Autonomo" : faction, originSea: seaGacha || randomOrigin.originSea, race: raceGacha || randomOrigin.race, starterChallenge: true, profession: "Grumete", dream: String(data.get("dream") || "Libertad"), alignment: String(data.get("alignment") || "Libertad"), story: historia, traits, appearance: avatarConfig });
  registerCharacter(character);
  if (sharedState.status === "local") {
    character.world.day = sharedState.world?.last_cycle_day || 0;
    character.world.year = Math.floor(character.world.day / 365) + 1;
  }
  ensureBlockOneData(character);
  persistRender(true);
});
listen(byId("whisper-form"), "submit", (event) => { event.preventDefault(); if (!character || character.status === "dead") return; const input = byId("whisper-input"); if (!input) return; const text = input.value; const before = publicSnapshot(character); sendConsciousnessWhisper(character, text); susurrar(text); publishChanges(before, character, true); if (character.location?.atSea) scoutFugitive(character); input.value = ""; persistRender(); input.focus(); });
listen(byId("heir-form"), "submit", (event) => { event.preventDefault(); if (!character || character.status !== "dead") return; const heir = createHeir(character, { name: byId("heir-name")?.value.trim() || undefined, username: byId("heir-username")?.value.trim() || undefined }); if (!heir) return; character = heir; registerCharacter(character); ensureBlockOneData(character); event.currentTarget.reset(); closeLegacyModal(); persistRender(true); });
listen(document.querySelector("[data-close-pantheon]"), "click", closePantheon);
listen(document.querySelector("[data-close-legacy]"), "click", closeLegacyModal);
listen(document.querySelector("[data-open-heir]"), "click", () => { const modal = byId("legacy-modal"); if (modal && !modal.open) modal.showModal(); });
function startNewGame() {
  clearTimeout(timerId);
  clearTimeout(branchTimer);
  window.MAPA?.volar?.((window.D?.W || 1600) / 2, (window.D?.H || 800) / 2, 1, 600);
  retirarUser("nueva partida");
  removeStorage(SAVE_KEY);
  character = null;
  byId("character-form")?.reset();
  closeLegacyModal();
  closePantheon();
  setHudVisible(false);
  document.body.classList.remove("mil-cine"); // sin esto, la nueva partida arrancaba sin HUD (inmersión heredada)
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
listen(document, "onepiece:hud-sail-suggest", (event) => {
  if (!character || character.status === "dead") return;
  const target = event.detail?.location;
  if (character.location?.atSea) return;
  const result = suggestSail(character, target);
  if (result.accepted) {
    character.navigationTarget = { ...target, type: "sail" };
    persistRender(true); // el zarpe corre en el próximo latido del mar
    window.MAPA?.volar?.(target.x, target.y, 1.5, 700);
  }
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result.message } }));
});
listen(document, "onepiece:hud-tablon-suggest", (event) => {
  // sugerir, no controlar: el encargo viaja al avatar, el mar decide el resto
  if (!character || character.status === "dead") return;
  const encargo = tablonDelPuerto(character).find((item) => item.id === event.detail?.encargoId);
  if (!encargo) return;
  const result = sugerirEncargo(character, encargo);
  persistRender();
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result.message } }));
});
listen(document, "onepiece:hud-tributo-action", (event) => {
  // el desfile celestial: la cortesía o la leyenda, con las consecuencias incluidas
  if (!character || character.status === "dead") return;
  const desfile = character.desfilePendiente;
  if (!desfile) return;
  const result = event.detail?.action === "desoir" ? desoibirTributo(character, desfile) : pagarTributo(character, desfile);
  if (result.ok) delete character.desfilePendiente;
  persistRender();
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result.message } }));
});
listen(document, "onepiece:hud-filosofo-consult", () => {
  // los Filósofos del Vacío: teoría del siglo perdido y, a veces, un plano
  if (!character || character.status === "dead") return;
  const result = consultarFilosofo(character);
  persistRender();
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result.message } }));
});
listen(document, "onepiece:hud-coliseo-fight", () => {
  if (!character || character.status === "dead") return;
  const result = coliseoFight(character);
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
  window.MAPA?.volar?.(location.x, location.y, 1.8, 700);
});
listen(document, "onepiece:hud-redirect", (event) => {
  const location = event.detail?.location;
  if (!character || character.status === "dead") return;
  const result = suggestNavigation(character, location);
  if (result.accepted) character.navigationTarget = { ...location, type: "news" };
  persistRender();
  if (result.accepted) window.MAPA?.volar?.(location.x, location.y, 1.8, 700);
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
listen(document, "onepiece:hud-coliseo-bet", (event) => {
  if (!character || character.status === "dead" || character.location?.atSea) return;
  const fighter = String(event.detail?.fighter || "");
  const rival = String(event.detail?.rival || "el favorito");
  const amount = Math.floor(Number(event.detail?.amount));
  if (!fighter || !Number.isFinite(amount) || amount < 10 || amount > 500 || amount > Number(character.berries)) return;
  character.berries = Number(character.berries) - amount;
  character.coliseo = { last: character.coliseo?.last, resolving: { fighter, rival, amount, deadline: Date.now() + 9000 + Math.floor(Math.random() * 6000) } };
  character.log.unshift({ time: new Date().toISOString(), message: `🥊 Coliseo de ${character.location?.island || "puerto"}: apostaste ฿${amount} por ${fighter}. La arena se llena de gritos…` });
  persistRender();
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: `Apuesta aceptada: ฿${amount} por ${fighter}` } }));
});
// La campana del coliseo: resuelve apuestas vencidas — también las que quedaron
// colgadas si el jugador cerró la página antes del resultado.
setInterval(() => {
  const resolving = character?.coliseo?.resolving;
  if (!resolving || Date.now() < resolving.deadline) return;
  const { fighter, rival, amount } = resolving;
  if (Math.random() < 0.42) {
    const premio = Math.round(amount * 2.6);
    character.berries = Number(character.berries) + premio;
    character.coliseo.last = `🥊 ${fighter} ganó la jornada: cobraste ฿${premio}.`;
    character.log.unshift({ time: new Date().toISOString(), message: `🥊 Coliseo: ¡${fighter} levanta la copa! Cobras ฿${premio}.` });
    document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: `¡Ganaste el Coliseo! +฿${premio}` } }));
  } else {
    character.coliseo.last = `🥊 ${rival} noqueó a ${fighter}: perdiste ฿${amount}.`;
    character.log.unshift({ time: new Date().toISOString(), message: `🥊 Coliseo: ${rival} noqueó a ${fighter}. Perdiste ฿${amount}.` });
    document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: `El Coliseo no perdona: -฿${amount}` } }));
  }
  delete character.coliseo.resolving;
  persistRender();
}, 4000);
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
listen(document, "onepiece:story-crisis-choice", (event) => {
  if (!character || character.status === "dead" || character.location?.atSea) return;
  const result = resolveIslandCrisis(character, event.detail?.choice);
  if (!result.ok) {
    document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result.message } }));
    return;
  }
  persistRender();
  document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result.message } }));
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

// Puente con el mundo vivo: el popup de isla dispara 'mil-encuentro' y aquí
// se ejecuta con las reglas reales de politics.js y narrative_engine.js.
window.ONE_LATAM = { getCharacter: () => character, getWorld: () => character?.world?.shared?.world || character?.world || null, getIslands: () => getMapIslands(character) };
listen(document, "mil-encuentro", (event) => {
  if (!character || character.status === "dead") return;
  const { action, choice } = event.detail || {};
  if (action === "story-crisis") {
    document.dispatchEvent(new CustomEvent("onepiece:story-crisis-choice", { detail: { choice } }));
    return;
  }
  const world = character.world?.shared?.world || character.world;
  let result = null;
  if (action === "tribute") result = lootCelestialTribute(character, world);
  else if (action === "sabotage") result = sabotageTyrantPort(character, world);
  else if (action === "noble") result = attackWorldNoble(character, world);
  if (result) {
    persistRender();
    document.dispatchEvent(new CustomEvent("onepiece:systems-toast", { detail: { message: result.message } }));
  }
});
