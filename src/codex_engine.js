import catalogData from "./data/codex_data.json" with { type: "json" };
import islandData from "./data/islands_data.json" with { type: "json" };
import loreData from "./data/lore_data.json" with { type: "json" };
import { renderCatalogo } from "./catalogo_engine.js";
import { DEVIL_FRUITS } from "./devil_fruits.js";
import { RACES } from "./races.js";

const categories = [
  ["islands", "Islas"],
  ["fruits", "Akuma no Mi"],
  ["races", "Razas"],
  ["poneglyphs", "Poneglyphs"],
  ["ships", "Modelos de barcos"],
  ["gobierno", "El Gobierno Mundial"]
];
const silhouettes = Object.freeze({ islands: "◼", fruits: "●", races: "♟", poneglyphs: "▮", ships: "◆", gobierno: "🏛" });

// los rostros del poder: lo que el Gobierno no pone en ningún libro
const GOBIERNO_CATALOGO = [
  { id: "gorosei", name: "Los Cinco Ancianos", texto: "Los máximos líderes del Gobierno Mundial. Decretan la cacería, el tributo y el silencio; nadie ha visto firmar nada: los decretos aparecen, y el mundo obedece." },
  { id: "tenryuubito", name: "Tenryuubito · Nobles Mundiales", texto: "Descendientes de los fundadores. Pasean bajo burbujas para no respirar el mismo aire que la gente, cobran tributo y toman esclavos. Desoírlos sube tu recompensa y tu leyenda." },
  { id: "cp9", name: "Cipher Pol 9", texto: "La agencia que no existe: espionaje y ejecución silenciosa. Sus agentes dominan el Rokushiki; si tu recompensa crece, uno de ellos ya lee tus cartas." },
  { id: "filosofos", name: "Los Filósofos del Vacío", texto: "Leen lo que el Gobierno quemó. Conversan en linterna baja y cobran poco por lo mucho que saben: cada teoría es un recuerdo del siglo que no existe." },
  { id: "arquitecto", name: "El Arquitecto", texto: "Seis planos que reescriben el mundo: la ciudad-puente, el camino de las estrellas, el sello del silencio. Reúnelos todos y la conspiración se dibuja sola: el Gobierno no teme piratas — teme mapas nuevos." }
];

export const CODEX_CATALOG = Object.freeze({
  islands: Object.entries(islandData).map(([id, island]) => ({ id, name: island.name })),
  fruits: catalogData.fruits.map((fruit) => ({
    ...fruit,
    name: DEVIL_FRUITS.find((entry) => entry.id === fruit.id)?.name || fruit.name
  })),
  races: Object.entries(RACES).map(([id, race]) => ({ id, name: race.name })),
  poneglyphs: loreData.poneglyphTopics.map((topic) => ({ id: topic.id, name: topic.title, type: topic.type })),
  ships: catalogData.ships,
  gobierno: GOBIERNO_CATALOGO
});

export function codexProgress(character) {
  const discoveries = new Set(character?.codex?.discoveries || []);
  const entries = categories.flatMap(([key, label]) => CODEX_CATALOG[key].map((entry) => ({
    ...entry,
    key,
    category: label,
    unlocked: discoveries.has(`${key}:${entry.id}`)
  })));
  const total = entries.length;
  const unlocked = entries.filter((entry) => entry.unlocked).length;
  return { entries, total, unlocked, percent: total ? Math.round(unlocked / total * 100) : 0 };
}

export function syncCodex(character) {
  if (!character) return false;
  if (!character.codex || typeof character.codex !== "object" || Array.isArray(character.codex)) {
    character.codex = { discoveries: [] };
  }
  if (!Array.isArray(character.codex.discoveries)) character.codex.discoveries = [];
  const discoveries = new Set(character.codex.discoveries);
  const unlock = (key, id) => {
    if (!id || !CODEX_CATALOG[key]?.some((entry) => entry.id === id)) return;
    discoveries.add(`${key}:${id}`);
  };

  if (!character.location?.atSea) {
    const island = Object.entries(islandData).find(([, entry]) => entry.name === character.location?.island);
    if (island) unlock("islands", island[0]);
  }
  unlock("races", character.race);
  if (character.fruit?.id) unlock("fruits", character.fruit.id);
  if (character.ship?.model) {
    const model = String(character.ship.model).toLocaleLowerCase("es");
    const ship = CODEX_CATALOG.ships.find((entry) => entry.id === model || entry.name.toLocaleLowerCase("es") === model);
    if (ship) unlock("ships", ship.id);
  } else {
    unlock("ships", "caravel");
  }
  for (const translation of Array.isArray(character.archaeology?.translations) ? character.archaeology.translations : []) {
    const topicId = Object.values(loreData.sites).find((site) => site.poi.id === translation.siteId)?.poi.lore;
    if (topicId) unlock("poneglyphs", topicId);
  }

  const next = [...discoveries];
  const changed = next.length !== character.codex.discoveries.length;
  character.codex.discoveries = next;
  return changed;
}

export function renderCodex(container, character) {
  const progress = codexProgress(character);
  const summary = document.createElement("section");
  summary.className = "one-hud-codex-progress";
  const heading = document.createElement("h3");
  heading.textContent = `ENCICLOPEDIA DEL MAR · ${progress.percent}%`;
  const count = document.createElement("p");
  count.textContent = `${progress.unlocked} de ${progress.total} descubrimientos registrados.`;
  const bar = document.createElement("progress");
  bar.max = 100;
  bar.value = progress.percent;
  bar.setAttribute("aria-label", `Progreso del códice: ${progress.percent}%`);
  summary.append(heading, count, bar);

  const body = document.createElement("div");
  const buildEnciclopedia = () => {
    const grid = document.createElement("div");
    grid.className = "one-hud-codex-grid";
    for (const [key, label] of categories) {
      const section = document.createElement("section");
      section.className = "one-hud-codex-category";
      const title = document.createElement("h3");
      title.textContent = label;
      const list = document.createElement("div");
      list.className = "one-hud-codex-items";
      for (const entry of progress.entries.filter((item) => item.key === key)) {
        const item = document.createElement("article");
        item.className = `one-hud-codex-item ${entry.unlocked ? "discovered" : "locked"}`;
        const silhouette = document.createElement("span");
        silhouette.className = "one-hud-codex-silhouette";
        silhouette.setAttribute("aria-hidden", "true");
        silhouette.textContent = silhouettes[key];
        const name = document.createElement("span");
        name.textContent = entry.unlocked ? entry.name : "Sin descubrir";
        if (!entry.unlocked) item.setAttribute("aria-label", `${label}: elemento aún no descubierto`);
        else item.setAttribute("aria-label", `${label}: ${entry.name}, descubierto`);
        const lock = document.createElement("span");
        lock.className = "one-hud-codex-lock";
        lock.setAttribute("aria-hidden", "true");
        lock.textContent = entry.unlocked ? "✦" : "🔒";
        item.append(silhouette, name, lock);
        // el lore que el Gobierno no pone en libros: se lee al descubrir
        if (entry.unlocked && entry.texto) {
          const lore = document.createElement("small");
          lore.className = "one-hud-codex-lore";
          lore.textContent = entry.texto;
          item.append(lore);
        }
        list.append(item);
      }
      section.append(title, list);
      grid.append(section);
    }
    body.replaceChildren(grid);
  };
  const buildCatalogo = () => {
    body.replaceChildren();
    renderCatalogo(body);
  };
  const tabs = document.createElement("div");
  tabs.className = "one-hud-tabs";
  tabs.setAttribute("role", "tablist");
  [
    ["Enciclopedia", buildEnciclopedia],
    ["Catálogo del mundo", buildCatalogo]
  ].forEach(([label, build], index) => {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.textContent = label;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(index === 0));
    tab.addEventListener("click", () => {
      [...tabs.children].forEach((node, nodeIndex) => node.setAttribute("aria-selected", String(nodeIndex === index)));
      build();
    });
    tabs.append(tab);
  });
  container.replaceChildren(summary, tabs, body);
  buildEnciclopedia();
}
