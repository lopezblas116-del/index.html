import { getExtension } from "./data_loader.js";
import { decodeGlyphs, encodeGlyphs } from "./language_engine.js";
import { ensureAncientLanguage } from "./ancient_language.js";
import { assessPortTax, isPortBlockaded } from "./geopolitics.js";
import { awardBerries } from "./gm_engine.js";
import { dispatchTypedEvent, EVENT_TYPES } from "./event_dispatcher.js";

export const RUBBING_PRICE = 300;
const normalizeText = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function archaeologyState(character) {
  character.archaeology ??= {};
  character.archaeology.rubbings = Array.isArray(character.archaeology.rubbings)
    ? character.archaeology.rubbings
    : [];
  character.archaeology.translations = Array.isArray(character.archaeology.translations)
    ? character.archaeology.translations
    : [];
  return character.archaeology;
}

export function ensureArchaeologyData(character) {
  if (!character) return character;
  archaeologyState(character);
  ensureAncientLanguage(character);
  return character;
}

export function canReadAncient(character) {
  if (!character) return false;
  if (character.race === "threeeye" || /(archaeolog|arqueolog)/i.test(normalizeText(character.profession))) return true;
  return (character.inventory?.items || []).some((item) =>
    /ancient (?:cipher )?(?:tome|primer)|tomo antiguo|manual de glifos/i.test(String(item))
  );
}

function log(character, message) {
  character.log ??= [];
  character.log.unshift({ time: new Date().toISOString(), message });
  character.log = character.log.slice(0, 80);
}

export function examinePoneglyph(character, island, poi) {
  if (!character || character.status === "dead" || character.captured ||
      character.location?.atSea || character.location?.island !== island?.name ||
      character.location?.localVenue?.id !== poi?.id || poi?.type !== "poneglyph") return null;
  const state = archaeologyState(character);
  if (state.rubbings.some((rubbing) => rubbing.siteId === poi.id)) return null;
  const lore = getExtension("lore");
  const topic = lore?.poneglyphTopics?.find((entry) => entry.id === poi.lore);
  if (!topic) return null;
  const rubbing = {
    id: `rubbing-${poi.id}`,
    siteId: poi.id,
    islandId: island.id,
    islandName: island.name,
    title: topic.title,
    glyphs: encodeGlyphs(`${topic.title}: ${topic.summary}`, poi.id),
    createdDay: Number(character.world?.day) || 0,
    sold: false
  };
  state.rubbings.push(rubbing);
  character.inventory ??= { items: [], equipment: [], provisions: 0 };
  character.inventory.items ??= [];
  character.inventory.items.push(`Calco Poneglyph: ${topic.title}`);
  const text = `[ARQUEOLOGÍA] ${character.name} obtiene un calco en ${island.name}.`;
  log(character, text);
  if (canReadAncient(character)) translateRubbing(character, rubbing.id);
  return rubbing;
}

export function translateRubbing(character, rubbingId) {
  if (!character || character.status === "dead" || !canReadAncient(character)) {
    return { ok: false, message: "Se necesita la Tribu de los Tres Ojos, profesión arqueóloga o un tomo de glifos." };
  }
  const state = archaeologyState(character);
  const rubbing = state.rubbings.find((entry) => entry.id === rubbingId && !entry.sold);
  if (!rubbing) return { ok: false, message: "Ese calco no está disponible para su estudio." };
  if (state.translations.some((entry) => entry.siteId === rubbing.siteId)) {
    return { ok: false, message: "Este monolito ya fue descifrado." };
  }
  const decoded = decodeGlyphs(rubbing.glyphs, rubbing.siteId);
  const [, ...parts] = decoded.split(":");
  const summary = parts.join(":").trim();
  const translation = {
    siteId: rubbing.siteId,
    title: rubbing.title,
    islandId: rubbing.islandId,
    islandName: rubbing.islandName,
    text: summary,
    translatedAt: new Date().toISOString()
  };
  state.translations.push(translation);
  rubbing.translated = true;
  const ancient = ensureAncientLanguage(character);
  if (!ancient.fragments.some((fragment) => fragment.id === `rubbing:${rubbing.siteId}`)) {
    ancient.fragments.push({ id: `rubbing:${rubbing.siteId}`, clue: rubbing.title, translatedAt: translation.translatedAt });
    ancient.knowledge = Math.min(100, ancient.fragments.length * 25);
  }
  if (state.translations.length >= 4 && !ancient.finalCoordinates) {
    ancient.finalCoordinates = getExtension("lore")?.finalCoordinates || null;
  }
  if (character.systems?.testament) character.systems.testament.ancientLanguage = structuredClone(ancient);
  const message = `[PONEGLYPH / DESCIFRADO] ${rubbing.title}: ${summary}`;
  log(character, message);
  dispatchTypedEvent(EVENT_TYPES.poneglyphTranslated, {
    siteId: rubbing.siteId,
    title: rubbing.title,
    captainId: character.id
  });
  return { ok: true, translation, message };
}

export function exploreLocalArchaeology(character, island) {
  const venue = character?.location?.localVenue;
  const poi = island?.pois?.find((entry) => entry.id === venue?.id && entry.type === "poneglyph");
  return poi ? examinePoneglyph(character, island, poi) : null;
}

export function sellPoneglyphRubbing(character, rubbingId, localWorld = character?.world?.shared?.status === "local" ? character.world.shared.world : null) {
  if (!character || character.status === "dead" || character.captured || character.location?.atSea) {
    return { ok: false, message: "Los calcos solo se venden en un puerto." };
  }
  const state = archaeologyState(character);
  const rubbing = state.rubbings.find((entry) => entry.id === rubbingId && !entry.sold);
  if (!rubbing) return { ok: false, message: "Ese calco ya no está disponible." };
  const island = localWorld?.islands_control?.find((entry) => entry.name === character.location.island);
  if (localWorld && isPortBlockaded(localWorld, island?.island_id, character.world?.day, character.id)) {
    return { ok: false, message: "El bloqueo naval impide comerciar en este puerto." };
  }
  const tax = localWorld
    ? assessPortTax(localWorld, island?.island_id, RUBBING_PRICE, character.id)
    : { net: RUBBING_PRICE, tax: 0 };
  rubbing.sold = true;
  const inventoryIndex = character.inventory?.items?.indexOf(`Calco Poneglyph: ${rubbing.title}`) ?? -1;
  if (inventoryIndex >= 0) character.inventory.items.splice(inventoryIndex, 1);
  const earned = awardBerries(character, tax.net);
  const message = `Vendiste el calco «${rubbing.title}» por ฿${earned}${tax.tax ? ` (impuesto: ฿${tax.tax})` : ""}.`;
  log(character, message);
  return { ok: true, earned, tax: tax.tax, message };
}
