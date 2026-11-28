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
  if (/battle|combat|victory/i.test(String(entry?.type || "")) ||
      /\b(victoria|combate|batalla|pelea)\b/i.test(String(text))) {
    const place = entry?.location || location || "mar abierto";
    return `battle:${normalizedText(place)}:${normalizedText(entry?.captainName || entry?.actor || "")}`;
  }
  return `${entry?.type || "event"}:${normalizedText(entry?.location || location || "")}:${normalizedText(text)}`;
}

function berryReward(entry) {
  const structured = Number(entry?.berries ?? entry?.reward);
  if (Number.isFinite(structured) && structured > 0) return Math.floor(structured);
  const text = String(entry?.message ?? entry?.text ?? "");
  const amount = text.match(/฿\s*([\d.,]+)/)?.[1];
  return amount ? Number(amount.replace(/[.,]/g, "")) || 0 : 0;
}

// EL DIARIO DEL MAR: la simulación del mundo vivo narra con su propia voz
// (sim.feed) — acá se traduce al formato de la gaceta. Cada latido sabe en qué
// mar ocurrió (rec.reg) y cuánto pesa (rec.imp): la Bitácora filtra por región
// para "Mi mar" y por importancia para "Lo importante". El tiempo del sim corre
// en minutos desde las 06:00 del día 1: floor(t/1440)+1 es el día gaceta.
export function entradasDelSim(feed = [], { mar = null, minImportancia = 0, limite = 80 } = {}) {
  const dia = (t) => Math.floor((Number(t) || 0) / 1440) + 1;
  return (feed || [])
    .slice(-limite * 3) // margen para que los filtros no vacíen el diario
    .map((rec) => ({
      type: "mundo",
      text: String(rec.txt || ""),
      day: dia(rec.t),
      mar: rec.reg || null, // el id del mar donde ocurrió — la gaceta filtra por canon
      imp: Number(rec.imp) || 0,
      key: rec.key || "",
    }))
    .filter((e) => e.text && e.imp >= minImportancia)
    .filter((e) => mar == null || !e.mar || e.mar === mar)
    .slice(-limite);
}

export function aggregateSmartFeed(entries, { location = "", name = "", limit = 80 } = {}) {
  const aggregated = [];
  let previousKey;
  for (const entry of entries || []) {
    const key = feedKey(entry, location);
    const existing = key === previousKey ? aggregated.at(-1) : null;
    if (existing) {
      existing.count += 1;
      existing.totalBerries += berryReward(entry);
      continue;
    }
    const item = { ...((entry && typeof entry === "object") ? entry : { message: String(entry ?? "") }), count: 1, totalBerries: 0 };
    item.totalBerries = berryReward(item);
    if (key.startsWith("battle:")) {
      const captain = item.captainName || item.actor || name || "La tripulación";
      item.message = item.count > 1
        ? `⚔️ ÚLTIMA HORA: ${captain} dominó el puerto de ${item.location || location || "mar abierto"} tras ${item.count} batallas consecutivas${item.totalBerries ? ` y acumuló ${item.totalBerries} Berries` : ""}.`
        : `⚔️ ÚLTIMA HORA: ${captain} libra un encarnizado combate en ${item.location || location || "mar abierto"}${item.totalBerries ? ` y consigue ฿${item.totalBerries}` : ""}.`;
    }
    aggregated.push(item);
    previousKey = key;
  }
  for (const item of aggregated) {
    if (item.count > 1 && !String(item.message || "").startsWith("⚔️ ÚLTIMA HORA:")) {
      item.message = `${item.message || item.text || "Aviso del mar"} · repetido ${item.count} veces`;
    } else if (item.count > 1 && String(item.message || "").startsWith("⚔️ ÚLTIMA HORA:")) {
      const captain = item.captainName || item.actor || name || "La tripulación";
      item.message = `⚔️ ÚLTIMA HORA: ${captain} dominó el puerto de ${item.location || location || "mar abierto"} tras ${item.count} batallas consecutivas${item.totalBerries ? ` y acumuló ${item.totalBerries} Berries` : ""}.`;
    }
    if (item.count > 1 || String(item.message || "").startsWith("⚔️ ÚLTIMA HORA:")) item.text = item.message;
  }
  return aggregated.slice(0, Math.max(0, limit));
}

export function maritimeHeadline(entry, index = 0) {
  const type = String(entry?.type || "").toLowerCase();
  const category = /bounty/.test(type) ? "bounty"
    : /escape|fugitive|boss_arrival/.test(type) ? "escape"
      : /invasion|blockade|island_conquered/.test(type) ? "invasion"
        : /poneglyph|archaeolog/.test(type) ? "poneglyph"
          : /battle|combat|victory/.test(type) ? "battle"
            : /gm|buster|weather/.test(type) ? "gm" : "default";
  const templates = PRESS_TEMPLATES[category];
  const variant = templates[Math.abs(Number(index) || 0) % templates.length];
  return { icon: PRESS_ICONS[category], headline: entry?.title || variant, category };
}

export function formatMaritimeTimestamp(entry, { day = 0, minuteOfDay = 0, location = "Mar abierto" } = {}) {
  const entryDay = Number(entry?.day);
  const entryMinute = Number(entry?.minuteOfDay);
  const currentDay = Number.isFinite(entryDay) ? entryDay : Number(day) || 0;
  const currentMinute = Number.isFinite(entryMinute) ? entryMinute : Number(minuteOfDay) || 0;
  const minutes = ((Math.floor(currentMinute) % 1440) + 1440) % 1440;
  const place = String(entry?.location?.name || entry?.location || location || "Mar abierto").toLocaleUpperCase("es");
  return `• ${place} · D${Math.max(0, Math.floor(currentDay)) + 1} ${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
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
