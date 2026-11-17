export const EVENT_TYPES = Object.freeze({
  globalChatMessage: "global-chat-message",
  journalEntry: "journal-entry",
  newsArticle: "news-article",
  psycheUpdate: "psyche-update",
  worldEvent: "world-event",
  gmEvent: "gm-event",
  yonkouDeclared: "YONKOU_DECLARED",
  busterCallStarted: "BUSTER_CALL_STARTED",
  islandConquered: "ISLAND_CONQUERED",
  poneglyphTranslated: "PONEGLYPH_TRANSLATED"
});

const TYPES = new Set(Object.values(EVENT_TYPES));
const PRESS_TEMPLATES = Object.freeze({
  bounty: ["Se busca: el mar vuelve a pronunciar este nombre", "Nuevo cartel en los puertos", "La Marina actualiza una recompensa"],
  escape: ["Alerta en las prisiones: hay un fugitivo en el mar", "Fuga confirmada; se solicita colaboración", "Un antiguo rival vuelve a navegar"],
  invasion: ["Flotas enemigas amenazan la soberanía", "La tensión crece en los puertos", "Se reporta un movimiento naval"],
  poneglyph: ["Un nuevo fragmento del pasado sale a la luz", "Los arqueólogos descifran una inscripción", "La historia perdida deja otra pista"],
  battle: ["Última hora: combates sacuden la costa", "Enfrentamiento reportado en el puerto", "La tensión estalla entre las tripulaciones"],
  gm: ["Edición extraordinaria de la Gaceta del Mar", "Comunicado especial para los navegantes", "El mar cambia tras un anuncio inesperado"],
  default: ["Crónica de los mares", "Noticias desde la Grand Line", "La Gaceta del Mar informa"]
});
const PRESS_ICONS = Object.freeze({ bounty: "📜", escape: "🚨", invasion: "⚓", poneglyph: "🪨", battle: "⚔️", gm: "🗞️", default: "🌊" });

function validDetail(type, detail) {
  if (!detail || typeof detail !== "object") return false;
  if (type === "global-chat-message") {
    const message = detail.message;
    return typeof message?.id === "string" && typeof message?.author === "string" &&
      typeof message?.text === "string" && message.text.length <= 280;
  }
  if (type === "journal-entry") return typeof detail.message === "string";
  if (type === "news-article") return Boolean(detail.article && typeof detail.article === "object" && !Array.isArray(detail.article));
  if (type === "psyche-update") {
    return typeof detail.mood === "string" &&
      ["Eufórico", "Cauteloso", "Ambicioso", "Melancólico", "Vengativo"].includes(detail.mood) &&
      Number.isFinite(detail.morality?.honor) && Number.isFinite(detail.morality?.greed) &&
      Number.isFinite(detail.morality?.liberty);
  }
  if (type === "world-event") {
    return typeof detail.id === "string" && typeof detail.title === "string" &&
      typeof detail.text === "string" && typeof detail.location === "string";
  }
  if (type === "ISLAND_CONQUERED") return typeof detail.islandId === "string" && typeof detail.ownerId === "string";
  if (type === "YONKOU_DECLARED") return typeof detail.captainId === "string" && typeof detail.captainName === "string";
  if (type === "BUSTER_CALL_STARTED") return typeof detail.islandId === "string" && typeof detail.islandName === "string";
  if (type === "PONEGLYPH_TRANSLATED") return typeof detail.siteId === "string" &&
    typeof detail.title === "string" && typeof detail.captainId === "string";
  return typeof detail.type === "string" && typeof detail.text === "string";
}

function normalizedText(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function feedKey(entry, location) {
  const text = entry?.message ?? entry?.text ?? entry?.title ?? entry;
  if (/\b(victoria|combate|batalla|pelea)\b/i.test(String(text))) {
    return `battle:${normalizedText(entry?.location || location || "mar abierto")}`;
  }
  return `${entry?.type || "event"}:${normalizedText(entry?.location || location || "")}:${normalizedText(text)}`;
}

export function aggregateSmartFeed(entries, { location = "", name = "", limit = 80 } = {}) {
  const aggregated = [];
  const groups = new Map();
  for (const entry of entries || []) {
    const key = feedKey(entry, location);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalBerries += Number(String(entry?.message ?? entry?.text ?? "").match(/฿\s*([\d.,]+)/)?.[1]?.replace(/[.,]/g, "")) || 0;
      continue;
    }
    const item = { ...((entry && typeof entry === "object") ? entry : { message: String(entry ?? "") }), count: 1, totalBerries: 0 };
    const berries = String(item.message ?? item.text ?? "").match(/฿\s*([\d.,]+)/)?.[1];
    item.totalBerries = berries ? Number(berries.replace(/[.,]/g, "")) || 0 : 0;
    if (/^(battle|victory|combat)/i.test(key)) {
      item.message = `ÚLTIMA HORA: ${name ? `${name} libra ` : "Se libran "}${item.count > 1 ? `${item.count} encarnizadas batallas` : "un encarnizado combate"} en ${location || item.location || "el puerto"}${item.totalBerries ? ` y consigue ฿${item.totalBerries}` : ""}.`;
    }
    groups.set(key, item);
    aggregated.push(item);
  }
  for (const item of aggregated) {
    if (item.count > 1 && !/^ÚLTIMA HORA:/.test(item.message || "")) {
      item.message = `${item.message || item.text || "Aviso del mar"} · repetido ${item.count} veces`;
    } else if (item.count > 1 && /^ÚLTIMA HORA:/.test(item.message || "")) {
      item.message = `ÚLTIMA HORA: ${name ? `${name} libra ` : "Se libran "}${item.count} encarnizadas batallas en ${location || item.location || "el puerto"}${item.totalBerries ? ` y consigue ฿${item.totalBerries}` : ""}.`;
    }
  }
  return aggregated.slice(0, Math.max(0, limit));
}

export function maritimeHeadline(entry, index = 0) {
  const type = String(entry?.type || "").toLowerCase();
  const category = /bounty/.test(type) ? "bounty"
    : /escape|fugitive/.test(type) ? "escape"
      : /invasion|blockade|island_conquered/.test(type) ? "invasion"
        : /poneglyph|archaeolog/.test(type) ? "poneglyph"
          : /battle|combat|victory/.test(type) ? "battle"
            : /gm|buster|weather/.test(type) ? "gm" : "default";
  const templates = PRESS_TEMPLATES[category];
  const variant = templates[Math.abs(Number(index) || 0) % templates.length];
  return { icon: PRESS_ICONS[category], headline: entry?.title || variant, category };
}

export function dispatchTypedEvent(type, detail, target = globalThis.document) {
  if (!TYPES.has(type)) throw new TypeError(`Tipo de evento desconocido: ${type}`);
  if (!validDetail(type, detail)) throw new TypeError(`Contenido inválido para el evento: ${type}`);
  if (!target?.dispatchEvent) return false;
  return target.dispatchEvent(new CustomEvent(`onepiece:${type}`, { detail }));
}

export function onTypedEvent(type, listener, target = globalThis.document) {
  if (!TYPES.has(type)) throw new TypeError(`Tipo de evento desconocido: ${type}`);
  if (!target?.addEventListener) return () => {};
  const eventName = `onepiece:${type}`;
  target.addEventListener(eventName, listener);
  return () => target.removeEventListener(eventName, listener);
}
