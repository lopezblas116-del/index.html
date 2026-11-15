const byId = (id) => document.getElementById(id);
let expansionCreated = false;

function makePanel(className, title, eyebrow) {
  const section = document.createElement("section");
  section.className = `panel expansion-panel ${className}`;
  const label = document.createElement("p");
  label.className = "eyebrow";
  label.textContent = eyebrow;
  const heading = document.createElement("h2");
  heading.textContent = title;
  section.append(label, heading);
  return section;
}
function ensureExpansion() {
  if (expansionCreated) return;
  const column = document.querySelector("#game-screen .main-column");
  if (!column) return;
  const mission = makePanel("mission-panel", "Bitácora de misiones", "East Blue · Ruta de aventura");
  const route = document.createElement("ol");
  route.id = "expedition-route";
  route.className = "expedition-route";
  const missionTitle = document.createElement("h3");
  missionTitle.id = "mission-title";
  missionTitle.className = "mission-title";
  const missionText = document.createElement("p");
  missionText.id = "mission-text";
  missionText.className = "muted";
  const technique = document.createElement("p");
  technique.id = "technique-text";
  technique.className = "technique-text";
  mission.append(missionTitle, missionText, route, technique);

  const wanted = makePanel("wanted-panel", "SE BUSCA", "Oficina de Prensa · Cartel de recompensa");
  wanted.id = "wanted-poster";
  const wantedName = document.createElement("p");
  wantedName.id = "wanted-name";
  wantedName.className = "wanted-name";
  const wantedHandle = document.createElement("p");
  wantedHandle.id = "wanted-handle";
  wantedHandle.className = "wanted-handle";
  const bounty = document.createElement("p");
  bounty.id = "wanted-bounty";
  bounty.className = "wanted-bounty";
  const wantedNote = document.createElement("p");
  wantedNote.id = "wanted-note";
  wantedNote.className = "wanted-note";
  wanted.append(wantedName, wantedHandle, bounty, wantedNote);

  column.prepend(wanted);
  column.prepend(mission);
  expansionCreated = true;
}
export function renderExpansion(character) {
  ensureExpansion();
  if (!expansionCreated) return;
  const route = character.originSea === "East Blue"
    ? ["Isla Dawn", "Orange Town", "Villa Syrup", "Baratie", "Arlong Park", "Loguetown", "Reverse Mountain", "Paraíso", "Nuevo Mundo"]
    : [character.location.island, "Loguetown", "Reverse Mountain", "Paraíso", "Nuevo Mundo"];
  const current = Math.max(0, Number(character.location?.routeIndex) || 0);
  const routeList = byId("expedition-route");
  routeList.replaceChildren();
  route.forEach((island, index) => {
    const item = document.createElement("li");
    item.textContent = `${index < current ? "✓" : index === current ? "⚓" : "○"} ${island}`;
    item.classList.toggle("current", index === current);
    item.classList.toggle("visited", index < current);
    routeList.append(item);
  });
  const mission = character.mission ?? { title: "Explorar el mar", island: character.location?.island, enemy: "piratas rivales", status: "active", completed: 0 };
  byId("mission-title").textContent = mission.status === "complete" ? `✅ ${mission.title} · completada` : `🎯 ${mission.title}`;
  byId("mission-text").textContent = mission.status === "complete"
    ? `Has asegurado ${mission.island}. Navega para continuar la ruta. Misiones completadas: ${mission.completed || 0}.`
    : `Isla: ${mission.island} · Objetivo: enfrentarse a ${mission.enemy}. Alinea el Log Pose con 3 acciones de navegación para iniciar el desafío.`;
  const powers = [];
  if (character.haki?.busoshoku) powers.push("Haki de Armadura: aumenta el poder de ataque");
  if (character.haki?.kenbunshoku) powers.push("Haki de Observación: iniciativa y evasión");
  if (character.haki?.haoshoku) powers.push("Haki del Conquistador: posibilidad de dominar rivales");
  if (character.fruit) powers.push(`${character.fruit.technique || "Técnica de Akuma no Mi"}: ${character.fruit.name}`);
  byId("technique-text").textContent = powers.length ? `Técnicas de combate · ${powers.join(" · ")}` : "Técnicas de combate · Entrena para despertar Haki o busca una Akuma no Mi.";

  const poster = byId("wanted-poster");
  const isWanted = ["Pirata", "Revolucionario"].includes(character.faction) && Number(character.bounty) > 0;
  poster.classList.toggle("not-wanted", !isWanted);
  byId("wanted-name").textContent = character.name;
  byId("wanted-handle").textContent = character.username || "Pirata desconocido";
  byId("wanted-bounty").textContent = isWanted ? `฿ ${new Intl.NumberFormat("es-ES").format(character.bounty)} BERRIES` : "SIN RECOMPENSA";
  byId("wanted-note").textContent = isWanted ? `Vivo o muerto · ${character.location?.island || "Mar abierto"}` : character.faction === "Marine" ? "Marine en servicio · recompensa de captura" : "Las hazañas notorias generan un cartel de búsqueda.";
}
