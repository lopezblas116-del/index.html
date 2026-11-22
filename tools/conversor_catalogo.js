#!/usr/bin/env node
/**
 * Conversor Lorebook → Catálogo del Mundo (One-Latam RPG · Bitácora del Mar).
 *
 * Convierte el lorebook en formato SillyTavern (367 entradas) en el catálogo
 * del juego (src/data/catalogo.json), con ids únicos garantizados.
 *
 * Corrección aplicada: la colisión de nombres se resuelve con slugs
 * deterministas — si dos entradas producen el mismo id (ej.: "World Noble"
 * aparece como organización y como raza), la segunda recibe sufijo -2, la
 * tercera -3, y así. El reporte en consola lista cada colisión resuelta.
 *
 * Uso: node tools/conversor_catalogo.js <lorebook.json> <salida.json>
 */

import { readFileSync, writeFileSync } from "node:fs";

/* ── Clasificación ──────────────────────────────────────────────────────── */

const CATEGORY_BY_MARKER = [
  ["🏴", "Organizaciones"],
  ["🪖", "Organizaciones"],
  ["💀", "Organizaciones"],
  ["🏛", "Organizaciones"],
  ["🌐", "Organizaciones"],
  ["🤝", "Organizaciones"],
  ["⚓", "Marina y Rangos"],
  ["🏝", "Islas y Lugares"],
  ["📍", "Islas y Lugares"],
  ["☁", "Islas y Lugares"],
  ["🪸", "Islas y Lugares"],
  ["🌊", "Mares y Océanos"],
  ["⭕", "Lugares Legendarios"],
  ["❗", "Lugares Legendarios"],
  ["𝐓", "Términos y Conceptos"],
  ["🗺", "Geografía y Cartografía"],
  ["🫂", "Sociedad y Cultura"],
  ["📱", "Tecnología e Inventos"],
  ["⛵", "Barcos y Vehículos"],
  ["💼", "Oficios y Roles"],
  ["📕", "Libros y Documentos"],
  ["⚔", "Armas y Sustancias"],
  ["🗡", "Armas y Sustancias"],
  ["🔫", "Armas y Sustancias"],
  ["🧪", "Armas y Sustancias"],
  ["🦦", "Criaturas del Mar"],
  ["🐲", "Criaturas del Mar"],
  ["🐉", "Criaturas del Mar"],
  ["🌳", "Flora y Plantas"],
  ["🌿", "Flora y Plantas"],
  ["🌱", "Flora y Plantas"],
  ["🦠", "Enfermedades"],
  ["𝐑", "Razas"],
  ["🧬", "Razas"],
  ["🥊", "Estilos de Combate"],
  ["⚡", "Habilidades Especiales"],
  ["🍈", "Frutas del Diablo"]
];

const SECTION_CATEGORY = {
  world: "Mares y Océanos",
  terms: "Términos y Conceptos",
  "society & culture": "Sociedad y Cultura",
  biology: "Criaturas del Mar",
  races: "Razas",
  abilities: "Estilos de Combate",
  "devil fruit": "Frutas del Diablo"
};

// Correcciones puntuales para entradas sin marcador propio.
const CATEGORY_OVERRIDES = {
  "Enlisting": "Marina y Rangos",
  "World Military Draft": "Marina y Rangos",
  "G-1": "Marina y Rangos",
  "G-5": "Marina y Rangos",
  "CP5": "Organizaciones",
  "CP6": "Organizaciones",
  "CP7": "Organizaciones",
  "CP9": "Organizaciones",
  "CP0": "Organizaciones"
};

// Banderas de región en el título: su presencia convierte un marcador de mar
// (🌊) en un lugar concreto — los mares del mundo nunca llevan bandera.
const FLAG_PATTERNS = ["🇬🇱-🇳", "🇬🇱-🇵", "🇨🇧", "🇸🇫", "🇬🇱", "🇪", "🇳", "🇸", "🇼"];

const tieneBandera = (title) => FLAG_PATTERNS.some((flag) => String(title).includes(flag));

const REGION_PATTERNS = [
  ["🇬🇱-🇳", "Nuevo Mundo"],
  ["🇬🇱-🇵", "Paraíso (Grand Line)"],
  ["🇨🇧", "Franja de Calma"],
  ["🇸🇫", "Fondo del Mar"],
  ["🇬🇱", "Grand Line"],
  ["☁", "Cielo"],
  ["🇪", "East Blue"],
  ["🇳", "North Blue"],
  ["🇸", "South Blue"],
  ["🇼", "West Blue"]
];

/* ── Utilidades ─────────────────────────────────────────────────────────── */

const normalizeLabel = (value) => String(value ?? "").trim().toLocaleLowerCase("es");

function limpiarTitulo(raw) {
  return String(raw ?? "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[\p{Extended_Pictographic}\u200d\uFE0F\u20E3\u{1F1E6}-\u{1F1FF}\u{1D400}-\u{1D7FF}]/gu, " ")
    .replace(/[^\p{L}\p{N}'’.\-/&+ ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

function limpiarTexto(raw) {
  return String(raw ?? "")
    .replace(/^<\/?[a-z0-9_-]+>\s*$/gim, "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const RESUMEN_STOP = /^(definition|location|geography|society|culture|law|history|overview|summary|origin|early figures|purpose|nature|perception|role|structure|values|types?|mechanics?|core traits)$/i;

function extraerResumen(texto) {
  const lines = String(texto ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
  const definitionIdx = lines.findIndex((line) => /^definition$/i.test(line));
  const start = definitionIdx >= 0 ? definitionIdx + 1 : 0;
  const parts = [];
  for (let index = start; index < lines.length && parts.join(" ").length < 220; index += 1) {
    const line = lines[index];
    if (/^- /.test(line) && parts.length) break;
    if (RESUMEN_STOP.test(line)) {
      if (parts.length) break;
      continue; // encabezado inicial (ej. "Origin"), no forma parte del resumen
    }
    parts.push(line.replace(/^- /, ""));
  }
  const joined = parts.join(" ").trim() || (lines[0] ?? "").trim();
  if (joined.length <= 260) return joined;
  return `${joined.slice(0, 257).replace(/\s+\S*$/, "")}…`;
}

function detectarRegion(title, name) {
  for (const [needle, region] of REGION_PATTERNS) {
    if (String(title).includes(needle)) return region;
  }
  if (/calm belt/i.test(name)) return "Franja de Calma";
  if (/grand line/i.test(name)) return "Grand Line";
  return "";
}

function extraerSeccion(title) {
  const brackets = String(title ?? "").match(/\[([^\]]+)\]/g) || [];
  for (const group of brackets) {
    const label = normalizeLabel(group.slice(1, -1));
    if (label in SECTION_CATEGORY) return label;
  }
  return null;
}

/* ── Conversión ─────────────────────────────────────────────────────────── */

export function convertirLorebook(lorebook, { generado = new Date().toISOString().slice(0, 10) } = {}) {
  const rawEntries = Object.values(lorebook?.entries ?? {});
  const entradas = [];
  const omitidas = [];
  const colisiones = [];
  const usados = new Set();
  let seccionActual = null;

  for (const entry of rawEntries) {
    const rawTitle = String(entry.comment ?? "").trim();
    const content = limpiarTexto(entry.content);
    const keys = (entry.key ?? entry.keys ?? []).map((key) => String(key).trim()).filter(Boolean);

    // 1) Metainstrucciones y separadores estructurales: fuera del catálogo.
    if (/READ THIS|World Setting|Writing Style/i.test(rawTitle) || rawTitle.includes("═")) {
      const section = extraerSeccion(rawTitle);
      if (section) seccionActual = section;
      omitidas.push({ uid: entry.uid, titulo: rawTitle, motivo: "estructura/meta del lorebook" });
      continue;
    }
    // 2) Encabezados de carpeta y placeholders sin contenido ni claves: fuera.
    if ((!content && !keys.length) || (!keys.length && /^placeholder$/i.test(content))) {
      omitidas.push({ uid: entry.uid, titulo: rawTitle, motivo: "encabezado/placeholder sin contenido" });
      continue;
    }

    // 3) Nombre y clasificación.
    const nombre = limpiarTitulo(rawTitle) || `Entrada ${entry.uid}`;
    let categoria = CATEGORY_OVERRIDES[nombre] ?? null;
    if (!categoria) {
      categoria = CATEGORY_BY_MARKER.find(([marker]) => rawTitle.includes(marker))?.[1] ?? null;
      // Un marcador de mar con bandera de región es en realidad un lugar de esa región
      // (ej.: "Amazon Lily" es [🌊🇨🇧] pero es una isla de la Franja de Calma).
      if (categoria === "Mares y Océanos" && tieneBandera(rawTitle)) categoria = "Islas y Lugares";
    }
    if (!categoria && seccionActual) categoria = SECTION_CATEGORY[seccionActual] ?? null;
    if (!categoria) categoria = "Términos y Conceptos";

    // 4) Id único: la corrección de la colisión de nombres.
    const base = slugify(nombre);
    let id = base;
    let suffix = 1;
    while (usados.has(id)) {
      suffix += 1;
      id = `${base}-${suffix}`;
    }
    if (suffix > 1) colisiones.push({ nombre, base, resuelto: id });
    usados.add(id);

    entradas.push({
      id,
      nombre,
      categoria,
      region: detectarRegion(rawTitle, nombre),
      claves: keys.slice(0, 8),
      resumen: extraerResumen(content),
      texto: content,
      uid: entry.uid
    });
  }

  return {
    catalogo: {
      schema: 1,
      titulo: "Catálogo del Mundo · One-Latam RPG",
      fuente: "lorebook_one_piece.json (formato SillyTavern)",
      generado,
      total: entradas.length,
      entradas
    },
    reporte: { totalOriginal: rawEntries.length, omitidas, colisiones }
  };
}

/* ── CLI ────────────────────────────────────────────────────────────────── */

function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    console.error("Uso: node tools/conversor_catalogo.js <lorebook.json> <salida.json>");
    process.exitCode = 1;
    return;
  }
  const lorebook = JSON.parse(readFileSync(inputPath, "utf8"));
  const { catalogo, reporte } = convertirLorebook(lorebook);
  writeFileSync(outputPath, `${JSON.stringify(catalogo, null, 2)}\n`, "utf8");

  const porCategoria = new Map();
  for (const entry of catalogo.entradas) {
    porCategoria.set(entry.categoria, (porCategoria.get(entry.categoria) ?? 0) + 1);
  }
  console.log(`Entradas originales: ${reporte.totalOriginal}`);
  console.log(`Incorporadas al catálogo: ${catalogo.total}`);
  console.log(`Omitidas (estructura/meta): ${reporte.omitidas.length}`);
  for (const omitted of reporte.omitidas) console.log(`  · [${omitted.uid}] ${omitted.titulo} — ${omitted.motivo}`);
  console.log(`Colisiones de nombre resueltas: ${reporte.colisiones.length}`);
  for (const collision of reporte.colisiones) console.log(`  · "${collision.nombre}" → ${collision.base} ya existía, quedó como ${collision.resuelto}`);
  console.log("Por categoría:");
  for (const [categoria, total] of [...porCategoria.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${categoria}: ${total}`);
  }
  console.log(`Escrito: ${outputPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
