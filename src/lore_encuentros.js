// Puente canon → encuentros: da fundamento canónico a la cadena causa→efecto.
// Cada tipo de encuentro y cada isla con entrada en el catálogo recibe un
// extracto breve del lore real (341/341 entradas con texto desde el lorebook).
import { CATALOGO_ENTRADAS } from "./catalogo_engine.js";

const normalize = (value) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Entradas canónicas por tipo de encuentro (primera coincidencia, determinista).
const CANON_TIPO = Object.freeze({
  noble: ["world-noble", "mary-geoise"],
  tribute: ["marines", "marine-base"],
  sabotaje: ["revolutionary-army"],
  crisis: []
});

const indiceCanon = (() => {
  const mapa = new Map();
  for (const entry of CATALOGO_ENTRADAS) {
    if (!(entry.texto || "").trim()) continue;
    const claves = [entry.nombre, ...(entry.claves ?? [])].map(normalize).filter((k) => k.length >= 4);
    for (const clave of claves) {
      if (!mapa.has(clave)) mapa.set(clave, entry);
    }
  }
  return mapa;
})();

export function extractoCanon(entry, maxChars = 220) {
  if (!entry?.texto) return "";
  const frase = String(entry.texto).replace(/\s+/g, " ").trim();
  if (frase.length <= maxChars) return frase;
  const corte = frase.slice(0, maxChars);
  const punto = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf("; "));
  return punto > 60 ? corte.slice(0, punto + 1) : corte.trimEnd() + "…";
}

export function canonParaNombre(nombre) {
  const needle = normalize(nombre);
  if (!needle || needle.length < 4) return null;
  return indiceCanon.get(needle) ?? null;
}

export function canonParaTipo(tipo) {
  for (const id of CANON_TIPO[tipo] ?? []) {
    const entry = CATALOGO_ENTRADAS.find((item) => item.id === id && (item.texto || "").trim());
    if (entry) return entry;
  }
  return null;
}

// Línea de fundamento canónico para una descripción de encuentro.
export function lineaCanon({ tipo = "", islaNombre = "", maxChars = 220 } = {}) {
  const entry = canonParaNombre(islaNombre) || canonParaTipo(tipo);
  if (!entry) return "";
  return `Según los registros del mundo: ${extractoCanon(entry, maxChars)}`;
}
