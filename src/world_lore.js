const INDEX_URL = new URL("./data/world_lore.json", import.meta.url);
const normalize = (value) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const hash = (value) => [...normalize(value)].reduce((result, char) => (result * 31 + char.charCodeAt(0)) >>> 0, 7);
const indexCache = new WeakMap();
const fragmentCache = new WeakMap();

async function loadJson(url, fetcher) {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`No se pudo cargar el lore (${response.status}): ${url}`);
  const data = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new TypeError(`El fragmento de lore no es un objeto válido: ${url}`);
  }
  return data;
}

function cached(cache, key, fetcher) {
  const cacheKey = String(key);
  if (!cache.has(fetcher)) cache.set(fetcher, new Map());
  const entries = cache.get(fetcher);
  if (!entries.has(cacheKey)) entries.set(cacheKey, loadJson(cacheKey, fetcher));
  return entries.get(cacheKey);
}

export function proceduralLore(key) {
  const place = String(key ?? "").trim() || "aguas sin cartografiar";
  const variants = [
    { climate: "normal", hazards: ["niebla costera", "corrientes cruzadas"], seed: "faros lejanos" },
    { climate: "grand-line", hazards: ["cambios bruscos de viento", "lecturas magnéticas erráticas"], seed: "el Log Pose pierde estabilidad" },
    { climate: "calm-belt", hazards: ["deriva lenta", "sombras bajo el casco"], seed: "la tripulación escucha algo bajo el agua" }
  ];
  const variant = variants[hash(place) % variants.length];
  return {
    key: normalize(place),
    title: place,
    description: `${place} no figura en las cartas conocidas. Las condiciones se forman a partir de sus corrientes y del clima local.`,
    climate: variant.climate,
    hazards: variant.hazards,
    newsSeeds: [variant.seed, "una ruta sin nombre aparece en la bitácora", "los vigías avistan señales en la costa"],
    procedural: true
  };
}

export async function getLoreByKey(query, { fetcher = globalThis.fetch } = {}) {
  if (typeof fetcher !== "function") throw new TypeError("Se necesita fetch para consultar el índice de lore.");
  const needle = normalize(query);
  const index = await cached(indexCache, INDEX_URL, fetcher);
  if (!Array.isArray(index.entries)) throw new TypeError("El índice de lore no contiene entradas válidas.");
  const entry = index.entries.find((item) => [item.key, ...(item.aliases || [])].some((alias) => normalize(alias) === needle))
    || index.entries.find((item) => [item.key, ...(item.aliases || [])].some((alias) => {
      const aliasKey = normalize(alias);
      return aliasKey.length >= 5 && (needle.includes(aliasKey) || aliasKey.includes(needle));
    }));
  if (!entry || typeof entry.file !== "string") return proceduralLore(query);
  const fragmentUrl = new URL(entry.file, INDEX_URL);
  const fragment = await cached(fragmentCache, fragmentUrl, fetcher);
  if (!Array.isArray(fragment.hazards) || !Array.isArray(fragment.newsSeeds)) {
    throw new TypeError(`El fragmento de lore está incompleto: ${entry.key}`);
  }
  return { ...fragment, procedural: false };
}
