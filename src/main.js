import {
  SAVE_KEY, autonomousTick, createCharacter, createHeir,
  loadGame, saveGame, sendWhisper, setAutonomyPaused
} from "./game.js";
import {
  closeLegacyModal, closePantheon, initWizard, openPantheon,
  renderGame, resetWizard, showSetup
} from "./ui.js";

let character = loadGame();
let timerId = null;
const nextDelay = () => 5000 + Math.random() * 5000;
const byId = (id) => document.getElementById(id);
const listen = (element, type, handler, options) => {
  if (element) element.addEventListener(type, handler, options);
};
function paint() { if (character) renderGame(character); }
function scheduleTick() {
  clearTimeout(timerId);
  if (!character || character.status === "dead" || character.autonomy?.paused) return;
  timerId = setTimeout(() => {
    if (!character || character.status === "dead" || character.autonomy?.paused) return;
    autonomousTick(character);
    saveGame(character);
    paint();
    scheduleTick();
  }, nextDelay());
}
function persistRender(reschedule = false) {
  if (!character) return;
  saveGame(character);
  paint();
  if (reschedule) scheduleTick();
}

initWizard();
if (character) {
  paint();
  if (character.status !== "dead") scheduleTick();
} else showSetup();

listen(document, "onepiece:map-destination", (event) => {
  if (!character || character.status === "dead") return;
  character.navigationTarget = {
    id: event.detail.id,
    name: event.detail.name,
    sea: event.detail.sea,
    x: event.detail.x,
    y: event.detail.y
  };
  persistRender();
});

listen(byId("character-form"), "submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const traits = [String(data.get("traitPrimary") || ""), String(data.get("traitSecondary") || "")].filter(Boolean);
  if (traits.length !== 2) { window.alert("Selecciona dos rasgos para la Tarjeta del Alma."); return; }
  character = createCharacter({
    name: String(data.get("name") || "Aventurero"),
    username: String(data.get("handle") || "@usuario"),
    faction: String(data.get("faction") || "Pirata"),
    originSea: String(data.get("originSea") || "East Blue"),
    dream: String(data.get("dream") || "Libertad"),
    traits,
    appearance: {
      skin: String(data.get("skin") || "Clara"),
      hair: String(data.get("hair") || "Negro"),
      accessory: String(data.get("accessory") || "Bandana")
    }
  });
  persistRender(true);
});
listen(byId("whisper-form"), "submit", (event) => {
  event.preventDefault();
  if (!character || character.status === "dead") return;
  const input = byId("whisper-input");
  if (!input) return;
  sendWhisper(character, input.value);
  input.value = "";
  persistRender();
  input.focus();
});
listen(byId("pause-button"), "click", () => {
  if (!character || character.status === "dead") return;
  setAutonomyPaused(character, !character.autonomy.paused);
  persistRender(true);
});
listen(byId("heir-form"), "submit", (event) => {
  event.preventDefault();
  if (!character || character.status !== "dead") return;
  const heirName = byId("heir-name");
  const heirUsername = byId("heir-username");
  const heir = createHeir(character, {
    name: heirName?.value.trim() || undefined,
    username: heirUsername?.value.trim() || undefined
  });
  if (!heir) return;
  character = heir;
  event.currentTarget.reset();
  closeLegacyModal();
  persistRender(true);
});
listen(byId("archive-button"), "click", openPantheon);
const closePantheonButton = document.querySelector("[data-close-pantheon]");
listen(closePantheonButton, "click", closePantheon);
const closeLegacyButton = document.querySelector("[data-close-legacy]");
listen(closeLegacyButton, "click", closeLegacyModal);
const openHeirButton = document.querySelector("[data-open-heir]");
listen(openHeirButton, "click", () => {
  const modal = byId("legacy-modal");
  if (modal && !modal.open) modal.showModal();
});
listen(byId("reset-button"), "click", () => {
  if (!window.confirm("¿Empezar una nueva partida? Se borrará la partida y el Panteón guardados en este navegador.")) return;
  clearTimeout(timerId);
  localStorage.removeItem(SAVE_KEY);
  character = null;
  byId("character-form")?.reset();
  closeLegacyModal();
  closePantheon();
  resetWizard();
  showSetup();
});
