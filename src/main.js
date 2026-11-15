import {
  SAVE_KEY,
  autonomousTick,
  createCharacter,
  loadGame,
  saveGame,
  sendWhisper,
  setAutonomyPaused
} from "./game.js";
import { renderGame, showSetup } from "./ui.js";

let character = loadGame();
let timerId = null;
const MIN_TICK_MS = 5000;
const MAX_TICK_MS = 10000;

function scheduleNextTick() {
  window.clearTimeout(timerId);
  if (!character || character.autonomy.paused) return;
  const delay = MIN_TICK_MS + Math.random() * (MAX_TICK_MS - MIN_TICK_MS);
  timerId = window.setTimeout(() => {
    if (!character || character.autonomy.paused) return;
    autonomousTick(character);
    saveGame(character);
    renderGame(character);
    scheduleNextTick();
  }, delay);
}

function persistAndRender({ reschedule = false } = {}) {
  if (!character) return;
  saveGame(character);
  renderGame(character);
  if (reschedule) scheduleNextTick();
}

if (character) {
  renderGame(character);
  scheduleNextTick();
} else {
  showSetup();
}

document.getElementById("character-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  character = createCharacter({
    name: String(formData.get("name") ?? ""),
    faction: String(formData.get("faction") ?? "Pirata"),
    originSea: String(formData.get("originSea") ?? "East Blue"),
    dream: String(formData.get("dream") ?? "Libertad"),
    trait: String(formData.get("trait") ?? "Valiente")
  });
  persistAndRender({ reschedule: true });
});

document.getElementById("whisper-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!character) return;
  const input = document.getElementById("whisper-input");
  sendWhisper(character, input.value);
  input.value = "";
  persistAndRender();
  input.focus();
});

document.getElementById("pause-button").addEventListener("click", () => {
  if (!character) return;
  setAutonomyPaused(character, !character.autonomy.paused);
  persistAndRender({ reschedule: true });
});

document.getElementById("reset-button").addEventListener("click", () => {
  if (!window.confirm("¿Empezar una nueva partida? Se borrará el progreso guardado en este navegador.")) return;
  window.clearTimeout(timerId);
  localStorage.removeItem(SAVE_KEY);
  character = null;
  document.getElementById("character-form").reset();
  showSetup();
});
