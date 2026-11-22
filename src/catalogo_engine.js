import catalogoData from "./data/catalogo.json" with { type: "json" };
import { registerExtension } from "./data_loader.js";

registerExtension("catalogo", catalogoData);

export const CATALOGO = Object.freeze(catalogoData);
export const CATALOGO_ENTRADAS = Object.freeze(CATALOGO.entradas);

const normalize = (value) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function categoriasCatalogo() {
  const counts = new Map();
  for (const entry of CATALOGO_ENTRADAS) {
    counts.set(entry.categoria, (counts.get(entry.categoria) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total || a.categoria.localeCompare(b.categoria, "es"));
}

export function buscarCatalogo({ texto = "", categoria = "" } = {}) {
  const needle = normalize(texto);
  return CATALOGO_ENTRADAS.filter((entry) =>
    (!categoria || entry.categoria === categoria) &&
    (!needle ||
      normalize(entry.nombre).includes(needle) ||
      normalize(entry.region).includes(needle) ||
      (entry.claves ?? []).some((key) => normalize(key).includes(needle)) ||
      normalize(entry.resumen).includes(needle))
  );
}

export function textoCatalogo(entry) {
  return entry?.texto || "Relato pendiente de completar en el lorebook de origen.";
}

const LIMITE_LISTA = 60;

export function renderCatalogo(container) {
  const controls = document.createElement("div");
  controls.className = "one-hud-item-filters";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Buscar en el catálogo…";
  search.setAttribute("aria-label", "Buscar en el catálogo del mundo");
  const category = document.createElement("select");
  category.setAttribute("aria-label", "Filtrar por categoría del catálogo");
  for (const option of ["Todas las categorías", ...categoriasCatalogo().map((item) => item.categoria)]) {
    const element = document.createElement("option");
    element.value = option === "Todas las categorías" ? "" : option;
    element.textContent = option;
    category.append(element);
  }

  const grid = document.createElement("div");
  grid.className = "one-hud-contracts";
  const empty = document.createElement("p");
  empty.className = "one-hud-muted";
  const note = document.createElement("p");
  note.className = "one-hud-muted";

  const draw = () => {
    const results = buscarCatalogo({ texto: search.value, categoria: category.value });
    grid.replaceChildren();
    for (const entry of results.slice(0, LIMITE_LISTA)) {
      const card = document.createElement("article");
      card.className = "one-hud-contract";
      const heading = document.createElement("h3");
      heading.textContent = entry.nombre;
      const detail = document.createElement("p");
      detail.textContent = [entry.categoria, entry.region].filter(Boolean).join(" · ");
      const summary = document.createElement("p");
      summary.textContent = entry.resumen || textoCatalogo(entry);
      card.append(heading, detail, summary);
      if (entry.texto) {
        const details = document.createElement("details");
        const label = document.createElement("summary");
        label.textContent = "Ver entrada completa";
        const body = document.createElement("p");
        body.style.whiteSpace = "pre-wrap";
        body.textContent = entry.texto;
        details.append(label, body);
        card.append(details);
      } else {
        const pending = document.createElement("p");
        pending.className = "one-hud-muted";
        pending.textContent = textoCatalogo(entry);
        card.append(pending);
      }
      grid.append(card);
    }
    empty.hidden = results.length > 0;
    empty.textContent = "Sin resultados en el catálogo para tu búsqueda.";
    note.textContent = results.length > LIMITE_LISTA
      ? `Mostrando ${LIMITE_LISTA} de ${results.length} entradas: refina la búsqueda o elige una categoría.`
      : `${results.length} entrada${results.length === 1 ? "" : "s"} registrada${results.length === 1 ? "" : "s"} del mundo.`;
  };
  search.addEventListener("input", draw);
  category.addEventListener("change", draw);

  controls.append(search, category);
  container.append(controls, grid, empty, note);
  draw();
}
