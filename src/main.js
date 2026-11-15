import {
  SAVE_KEY, autonomousTick, createCharacter, createHeir,
  loadGame, saveGame, sendWhisper, setAutonomyPaused
} from "./game.js";
import { initWizard, renderGame, showSetup } from "./ui.js";

let character = loadGame();
let timerId = null;
const nextDelay = () => 5000 + Math.random() * 5000;
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
if (character) {
  renderGame(character);
  if (character.status !== "dead") scheduleTick();
} else { showSetup(); initWizard(); }

document.getElementById("character-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const traits = [String(data.get("traitPrimary") || ""), String(data.get("traitSecondary") || "")].filter(Boolean);
  if (traits.length !== 2) { window.alert("Selecciona dos rasgos para la Tarjeta del Alma."); return; }
  character = createCharacter({
    name: String(data.get("name") || "Aventurero"), username: String(data.get("handle") || "@usuario"),
    faction: String(data.get("faction") || "Pirata"), originSea: String(data.get("originSea") || "East Blue"),
    dream: String(data.get("dream") || "Libertad"), traits,
    appearance: { skin: String(data.get("skin") || "Clara"), hair: String(data.get("hair") || "Negro"), accessory: String(data.get("accessory") || "Bandana") }
  });
  persistRender(true);
});
document.getElementById("whisper-form").addEventListener("submit", (event) => {
  event.preventDefault(); if (!character) return;
  const input = document.getElementById("whisper-input"); sendWhisper(character, input.value); input.value = ""; persistRender(); input.focus();
});
document.getElementById("pause-button").addEventListener("click", () => {
  if (!character || character.status === "dead") return;
  setAutonomyPaused(character, !character.autonomy.paused); persistRender(true);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-create-heir]")) return;
  if (!character || character.status !== "dead") return;
  const successor = createHeir(character);
  if (!successor) return;
  character = successor;
  saveGame(character);
  renderGame(character);
  scheduleTick();
});
document.getElementById("reset-button").addEventListener("click", () => {
  if (!window.confirm("¿Empezar una nueva partida? Se borrará la partida y el Panteón guardados en este navegador.")) return;
  clearTimeout(timerId); localStorage.removeItem(SAVE_KEY); character = null;
  document.getElementById("character-form").reset(); showSetup(); initWizard();
});
