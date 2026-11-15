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

function scheduleTick() {
  clearTimeout(timerId);
  if (!character || character.status === "dead" || character.autonomy.paused) return;
  timerId = setTimeout(() => {
    if (!character || character.status === "dead" || character.autonomy.paused) return;
    autonomousTick(character);
    saveGame(character);
    renderGame(character);
    scheduleTick();
  }, nextDelay());
}
function persistRender(reschedule = false) {
  if (!character) return;
  saveGame(character);
  renderGame(character);
  if (reschedule) scheduleTick();
}

initWizard();
if (character) {
  renderGame(character);
  if (character.status !== "dead") scheduleTick();
} else showSetup();

byId("character-form").addEventListener("submit", (event) => {
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

byId("whisper-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!character || character.status === "dead") return;
  const input = byId("whisper-input");
  sendWhisper(character, input.value);
  input.value = "";
  persistRender();
  input.focus();
});

byId("pause-button").addEventListener("click", () => {
  if (!character || character.status === "dead") return;
  setAutonomyPaused(character, !character.autonomy.paused);
  persistRender(true);
});

byId("heir-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!character || character.status !== "dead") return;
  const heir = createHeir(character, {
    name: byId("heir-name").value.trim() || undefined,
    username: byId("heir-username").value.trim() || undefined
  });
  if (!heir) return;
  character = heir;
  byId("heir-form").reset();
  closeLegacyModal();
  persistRender(true);
});

byId("archive-button").addEventListener("click", openPantheon);
document.querySelector("[data-close-pantheon]").addEventListener("click", closePantheon);
document.querySelector("[data-close-legacy]").addEventListener("click", closeLegacyModal);
document.querySelector("[data-open-heir]").addEventListener("click", () => {
  const modal = byId("legacy-modal");
  if (!modal.open) modal.showModal();
});

byId("reset-button").addEventListener("click", () => {
  if (!window.confirm("¿Empezar una nueva partida? Se borrará la partida y el Panteón guardados en este navegador.")) return;
  clearTimeout(timerId);
  localStorage.removeItem(SAVE_KEY);
  character = null;
  byId("character-form").reset();
  closeLegacyModal();
  closePantheon();
  resetWizard();
  showSetup();
});
