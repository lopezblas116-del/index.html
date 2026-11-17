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
