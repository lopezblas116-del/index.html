import { STORAGE_KEYS } from "./config.js";
import { dispatchTypedEvent, EVENT_TYPES } from "./event_dispatcher.js";
import { readJSON, writeJSON } from "./storage_adapter.js";
import { sendWhisper } from "./game.js";

const MAX_MESSAGES = 100;
const MAX_LENGTH = 280;

function storedMessages(storage) {
  const messages = readJSON(STORAGE_KEYS.chat, [], storage);
  return Array.isArray(messages) ? messages.filter((message) =>
    message && typeof message.id === "string" &&
    typeof message.author === "string" &&
    typeof message.text === "string"
  ).slice(-MAX_MESSAGES) : [];
}

export function getGlobalChat(sharedEvents = [], storage) {
  const local = storedMessages(storage);
  const remote = (Array.isArray(sharedEvents) ? sharedEvents : [])
    .filter((entry) => entry?.type === "global_chat" && typeof entry.event_id === "string" && typeof entry.text === "string")
    .map((entry) => {
      const separator = entry.text.indexOf(": ");
      return {
        id: entry.event_id,
        author: entry.author || (separator > 0 ? entry.text.slice(0, separator) : "Tripulación"),
        text: entry.message || (separator > 0 ? entry.text.slice(separator + 2) : entry.text),
        time: entry.created_at || ""
      };
    });
  const merged = new Map(remote.map((message) => [message.id, message]));
  for (const message of local) {
    if (!merged.has(message.id)) merged.set(message.id, message);
  }
  return [...merged.values()].sort((a, b) => String(a.time).localeCompare(String(b.time))).slice(-MAX_MESSAGES);
}

export function postGlobalChat(character, text, storage) {
  const messageText = String(text ?? "").trim().slice(0, MAX_LENGTH);
  if (!character || character.status === "dead" || !messageText) {
    return { ok: false, message: "Escribe un mensaje antes de enviarlo." };
  }
  const message = {
    id: globalThis.crypto?.randomUUID?.() ?? `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    author: String(character.name || "Tripulación").slice(0, 24),
    text: messageText,
    time: new Date().toISOString()
  };
  const messages = [...storedMessages(storage), message].slice(-MAX_MESSAGES);
  if (!writeJSON(STORAGE_KEYS.chat, messages, storage)) {
    return { ok: false, message: "No se pudo guardar el mensaje en este dispositivo." };
  }
  dispatchTypedEvent(EVENT_TYPES.globalChatMessage, { message });
  return { ok: true, message };
}

export function getWhisperHistory(character) {
  if (Array.isArray(character?.whisper?.history)) return character.whisper.history.slice(0, 30);
  return (character?.log ?? [])
    .filter((entry) => /susurr|susurro|reflexi[oó]n|consejo/i.test(entry.message || ""))
    .map((entry) => ({ ...entry, status: "Registrado" }))
    .slice(0, 30);
}

export function sendConsciousnessWhisper(character, text) {
  const phrase = String(text ?? "").trim().slice(0, 160);
  if (!character || character.status === "dead" || !phrase) return null;
  const history = getWhisperHistory(character);
  const result = sendWhisper(character, phrase);
  character.whisper.history ??= history;
  character.whisper.history.unshift({
    time: new Date().toISOString(),
    message: phrase,
    status: result.obeyed ? "Aceptado" : "Ignorado",
    response: character.log.find((entry) => entry.message.includes(`«${phrase}»`))?.message || ""
  });
  character.whisper.history = character.whisper.history.slice(0, 30);
  return result;
}
