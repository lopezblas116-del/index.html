import {
  SAVE_KEY, autonomousTick, createCharacter, createHeir,
  loadGame, saveGame, sendWhisper, setAutonomyPaused
} from "./game.js";
import {
  closeLegacyModal, closePantheon, initWizard, openPantheon,
  renderGame, resetWizard, showSetup
} from "./ui.js";
import { initWorldMap, renderMap, resizeMap } from "./map.js";
import { initHud, renderHud, setHudVisible } from "./hud.js";
import { ensureBlockOneData, initBlock1 } from "./block1.js";
import {
  advanceAdvancedSystems, draftTestament, ensureAdvancedSystems,
  setClimateZone, tavernAction
} from "./systems.js";

let character = loadGame();
let timerId = null;
const nextDelay = () => 5000 + Math.random() * 5000;
const byId = (id) => document.getElementById(id);
const listen = (element, type, handler, options) => { if (element) element.addEventListener(type, handler, options); };
function paint() {
  if (!character) return;
  ensureBlockOneData(character);
  ensureAdvancedSystems(character);
  renderGame(character);
  initWorldMap();
  resizeMap();
  renderMap(character);
  renderHud(character);
}
function scheduleTick() {
  clearTimeout(timerId);
  if (!character || character.status === "dead" || character.autonomy?.paused) return;
  timerId = setTimeout(() => {
    if (!character || character.status === "dead" || character.autonomy?.paused) return;
    const previousIsland = character.location?.island;
    const tick = autonomousTick(character);
    advanceAdvancedSystems(character, { action: tick?.action, previousIsland });
    saveGame(character);
    paint();
    scheduleTick();
  }, nextDelay());
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
initBlock1({ getCharacter: () => character, onChange: () => persistRender() });
if (character) {
  ensureBlockOneData(character);
  paint();
  if (character.status !== "dead") scheduleTick();
} else showSetup();

listen(window, "resize", () => { if (!character) return; resizeMap(); renderMap(character); });
listen(document, "onepiece:map-destination", (event) => {
  if (!character || character.status === "dead") return;
  character.navigationTarget = { id: event.detail.id, name: event.detail.name, sea: event.detail.sea, x: event.detail.x, y: event.detail.y };
  persistRender();
  if (event.detail.name === character.location?.island) document.dispatchEvent(new CustomEvent("onepiece:open-tavern"));
});
listen(document, "onepiece:hud-whisper", (event) => {
  if (!character || character.status === "dead") return;
  sendWhisper(character, event.detail?.text || "");
  persistRender();
});
listen(byId("character-form"), "submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const traits = [String(data.get("traitPrimary") || ""), String(data.get("traitSecondary") || "")].filter(Boolean);
  if (traits.length !== 2) { window.alert("Selecciona dos rasgos para la Tarjeta del Alma."); return; }
  character = createCharacter({ name: String(data.get("name") || "Aventurero"), username: String(data.get("handle") || "@usuario"), faction: String(data.get("faction") || "Pirata"), originSea: String(data.get("originSea") || "East Blue"), dream: String(data.get("dream") || "Libertad"), story: String(data.get("story") || ""), traits, appearance: { skin: String(data.get("skin") || "Clara"), hair: String(data.get("hair") || "Negro"), accessory: String(data.get("accessory") || "Bandana") } });
  ensureBlockOneData(character);
  persistRender(true);
});
listen(byId("whisper-form"), "submit", (event) => { event.preventDefault(); if (!character || character.status === "dead") return; const input = byId("whisper-input"); if (!input) return; sendWhisper(character, input.value); input.value = ""; persistRender(); input.focus(); });
listen(byId("pause-button"), "click", () => { if (!character || character.status === "dead") return; setAutonomyPaused(character, !character.autonomy.paused); persistRender(true); });
listen(byId("heir-form"), "submit", (event) => { event.preventDefault(); if (!character || character.status !== "dead") return; const heir = createHeir(character, { name: byId("heir-name")?.value.trim() || undefined, username: byId("heir-username")?.value.trim() || undefined }); if (!heir) return; character = heir; ensureBlockOneData(character); event.currentTarget.reset(); closeLegacyModal(); persistRender(true); });
listen(byId("archive-button"), "click", openPantheon);
listen(document.querySelector("[data-close-pantheon]"), "click", closePantheon);
listen(document.querySelector("[data-close-legacy]"), "click", closeLegacyModal);
listen(document.querySelector("[data-open-heir]"), "click", () => { const modal = byId("legacy-modal"); if (modal && !modal.open) modal.showModal(); });
function startNewGame() {
  clearTimeout(timerId);
  localStorage.removeItem(SAVE_KEY);
  character = null;
  byId("character-form")?.reset();
  closeLegacyModal();
  closePantheon();
  setHudVisible(false);
  resetWizard();
  showSetup();
}
listen(byId("reset-button"), "click", () => { if (window.confirm("¿Empezar una nueva partida? Se borrará la partida y el Panteón guardados en este navegador.")) startNewGame(); });
listen(document, "onepiece:hud-new-game", startNewGame);
listen(document, "onepiece:hud-toggle-pause", () => {
  if (!character || character.status === "dead") return;
  setAutonomyPaused(character, !character.autonomy.paused);
  persistRender(true);
});
listen(document, "onepiece:hud-tavern-action", (event) => {
  if (!character || character.status === "dead") return;
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
