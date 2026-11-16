export const EVENT_TYPES = Object.freeze({
  globalChatMessage: "global-chat-message",
  journalEntry: "journal-entry",
  newsArticle: "news-article"
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
  return Boolean(detail.article && typeof detail.article === "object" && !Array.isArray(detail.article));
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
