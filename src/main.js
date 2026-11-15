import {
  SAVE_KEY,
  createCharacter,
  loadGame,
  performAction,
  saveGame
} from "./game.js";
import { renderGame, showSetup } from "./ui.js";

let character = loadGame();

if (character) {
  renderGame(character);
} else {
  showSetup();
}

document.getElementById("character-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  character = createCharacter({
    name: String(formData.get("name") ?? ""),
    faction: String(formData.get("faction") ?? "Pirata"),
    originSea: String(formData.get("originSea") ?? "East Blue")
  });

  saveGame(character);
  renderGame(character);
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!character) return;

    performAction(character, button.dataset.action);
    saveGame(character);
    renderGame(character);
  });
});

document.getElementById("reset-button").addEventListener("click", () => {
  const confirmed = window.confirm(
    "¿Empezar una nueva partida? Se borrará el progreso guardado en este navegador."
  );
  if (!confirmed) return;

  localStorage.removeItem(SAVE_KEY);
  character = null;
  document.getElementById("character-form").reset();
  showSetup();
});
