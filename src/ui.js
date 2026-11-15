const byId = (id) => document.getElementById(id);
const formatNumber = (number) => new Intl.NumberFormat("es-ES").format(number);
function formatTime(isoString) {
  return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date(isoString));
}

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

export function renderGame(character) {
  showGame();
  byId("character-name-display").textContent = character.name;
  byId("level-badge").textContent = `Nivel ${character.level}`;
  byId("faction-display").textContent = `${character.faction} · ${character.rank}`;
  byId("origin-display").textContent = character.originSea;
  byId("location-display").textContent = `${character.location.island} · ${character.location.region}`;
  byId("log-pose-display").textContent = `${character.logPose.alignment}/${character.logPose.required} alineamientos`;
  byId("dream-display").textContent = character.soulCard.dream;
  byId("traits-display").textContent = [...character.soulCard.traits.pros, ...character.soulCard.traits.cons].join(", ") || "Sin definir";
  byId("fruit-display").textContent = character.fruit ? `${character.fruit.name} (${character.fruit.type})` : "Ninguna";
  byId("bounty-display").textContent = `${formatNumber(character.bounty)} Berries`;
  byId("berries-display").textContent = `${formatNumber(character.berries)} Berries`;
  const hakiNames = [];
  if (character.haki.busoshoku) hakiNames.push("Busoshoku");
  if (character.haki.kenbunshoku) hakiNames.push("Kenbunshoku");
  if (character.haki.haoshoku) hakiNames.push("Haoshoku");
  byId("haki-display").textContent = hakiNames.length ? hakiNames.join(", ") : "Sin despertar";
  byId("health-value").textContent = `${character.stats.health}/${character.stats.maxHealth}`;
  byId("health-bar").max = character.stats.maxHealth;
  byId("health-bar").value = character.stats.health;
  byId("strength-value").textContent = character.stats.strength;
  byId("agility-value").textContent = character.stats.agility;
  byId("ingenuity-value").textContent = character.stats.ingenuity;
  byId("xp-display").textContent = `Experiencia: ${character.experience}/${character.level * 100} XP · Ciclos: ${character.autonomy.tickCount}`;

  const paused = character.autonomy.paused;
  const sync = character.whisper.affinity;
  byId("autonomy-status").textContent = paused ? "⏸ En pausa" : "● Activa";
  byId("autonomy-status").classList.toggle("badge-live", !paused);
  byId("pause-button").textContent = paused ? "Reanudar avatar" : "Pausar avatar";
  byId("pause-button").setAttribute("aria-pressed", String(paused));
  byId("sync-value").textContent = `${sync}%`;
  byId("sync-bar").value = sync;
  byId("rebellion-value").textContent = `Rebeldía: ${100 - sync}% · La compatibilidad del susurro puede modificar su probabilidad de obediencia.`;

  const log = byId("event-log");
  log.replaceChildren();
  for (const entry of character.log) {
    const item = document.createElement("li");
    const time = document.createElement("span");
    time.className = "event-time";
    time.textContent = formatTime(entry.time);
    const message = document.createElement("span");
    message.textContent = entry.message;
    item.append(time, message);
    log.append(item);
  }
}
