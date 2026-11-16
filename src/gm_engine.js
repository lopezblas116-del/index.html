import { STORAGE_KEYS } from "./config.js";
import { readJSON, writeJSON } from "./storage_adapter.js";

const MAX_NEWS = 60;
const MAX_LOG = 80;
const MAX_CHAT = 100;
const GM_EVENTS = Object.freeze({
  buster_call: "Alerta mundial: un Buster Call ha sido avistado en alta mar.",
  rogue_wave: "Una marejada repentina sacude las rutas del Calm Belt.",
  berry_boon: "El Game Master anuncia un hallazgo extraordinario de Berries.",
  legendary_sighting: "Varios vigías reportan un barco legendario en el horizonte."
});

function gameMinute(character) {
  return (Number(character.world.day) || 0) * 1440 + (Number(character.world.minuteOfDay) || 0);
}

function recordEvent(character, type, text, source) {
  const event = { id: `gm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, text, source, minute: gameMinute(character) };
  character.world.news.unshift({ type: "gm", text, day: character.world.day, location: character.location?.island, gmEvent: type });
  character.world.news = character.world.news.slice(0, MAX_NEWS);
  character.log.unshift({ time: new Date().toISOString(), message: `[GM] ${text}` });
  character.log = character.log.slice(0, MAX_LOG);
  character.world.gm.events.unshift(event);
  character.world.gm.events = character.world.gm.events.slice(0, 30);
  return event;
}

export function applyGMEvent(character, type, source = "manual") {
  if (!character || character.status === "dead" || !Object.hasOwn(GM_EVENTS, type)) return null;
  character.world ??= { day: 0, minuteOfDay: 0, news: [], pantheon: [] };
  character.world.news ??= [];
  character.log ??= [];
  character.world.gm ??= { lastCheckedHour: -1, lastEventMinute: 0, events: [] };
  const text = GM_EVENTS[type];
  if (type === "rogue_wave") {
    const now = gameMinute(character);
    character.world.gm.stormUntil = now + 240;
    character.travel ??= {};
    character.travel.weather = "storm";
  } else if (type === "berry_boon") {
    character.berries = Math.max(0, Number(character.berries) || 0) + 500;
  }
  return recordEvent(character, type, text, source);
}

export function advanceGM(character, random = Math.random) {
  if (!character || character.status === "dead" || character.autonomy?.paused || character.captured) return null;
  character.world ??= { day: 0, minuteOfDay: 0, news: [], pantheon: [] };
  character.world.gm ??= { lastCheckedHour: -1, lastEventMinute: 0, events: [] };
  const state = character.world.gm;
  const minute = gameMinute(character);
  const hour = Math.floor(minute / 60);
  if (hour <= state.lastCheckedHour) return null;
  state.lastCheckedHour = hour;
  if (minute - state.lastEventMinute < 360 || random() >= 0.18) return null;
  const choices = character.location?.atSea && character.travel?.climate === "calm-belt"
    ? ["rogue_wave", "legendary_sighting", "buster_call"]
    : ["legendary_sighting", "buster_call", "berry_boon"];
  const event = applyGMEvent(character, choices[Math.floor(random() * choices.length)], "autonomous");
  if (event) state.lastEventMinute = minute;
  return event;
}

export function transmitLocalGMMessage(text, storage) {
  const messageText = String(text ?? "").trim().slice(0, 280);
  if (!messageText) return { ok: false, message: "Escribe un comunicado antes de transmitirlo." };
  const messages = readJSON(STORAGE_KEYS.chat, [], storage);
  const safeMessages = Array.isArray(messages) ? messages.filter((message) =>
    message && typeof message.id === "string" && typeof message.author === "string" && typeof message.text === "string"
  ) : [];
  safeMessages.push({
    id: globalThis.crypto?.randomUUID?.() ?? `gm-chat-${Date.now()}`,
    author: "Game Master · Local",
    text: messageText,
    time: new Date().toISOString()
  });
  if (!writeJSON(STORAGE_KEYS.chat, safeMessages.slice(-MAX_CHAT), storage)) {
    return { ok: false, message: "No se pudo guardar el comunicado local." };
  }
  return { ok: true };
}

export function adjustLocalBounty(character, value) {
  const bounty = Number(value);
  if (!character || character.status === "dead" || !Number.isSafeInteger(bounty) || bounty < 0 || bounty > 1_000_000_000) {
    return { ok: false, message: "La recompensa debe ser un entero entre 0 y 1.000.000.000." };
  }
  character.bounty = bounty;
  character.reputation = Math.max(Number(character.reputation) || 0, bounty);
  const text = bounty
    ? `[GM] La recompensa de ${character.name} se fija en ฿${new Intl.NumberFormat("es-ES").format(bounty)} Berries.`
    : `[GM] Se retira el cartel de ${character.name}.`;
  character.log.unshift({ time: new Date().toISOString(), message: text });
  character.world.news.unshift({ type: "bounty", text, day: character.world.day, location: character.location?.island });
  character.world.news = character.world.news.slice(0, MAX_NEWS);
  character.log = character.log.slice(0, MAX_LOG);
  return { ok: true };
}

export function isLocalGMAvailable(character) {
  return Boolean(character && character.status !== "dead" && character.world?.shared?.status === "local");
}
