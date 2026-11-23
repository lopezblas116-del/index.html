import { AI_CONFIG } from "./config.js";
import { dispatchTypedEvent, EVENT_TYPES } from "./event_dispatcher.js";
import { getMapIslands } from "./map.js";
import { canReadAncient } from "./archaeology_system.js";
import { hasNauticalCrew } from "./systems.js";
import { recordStarterClueVisit } from "./narrative_engine.js";
import missionData from "./data/missions_data.json" with { type: "json" };

export const MOODS = Object.freeze(["Eufórico", "Cauteloso", "Ambicioso", "Melancólico", "Vengativo"]);
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const traitsOf = (character) => [
  ...(character.soulCard?.traits?.pros ?? []),
  ...(character.soulCard?.traits?.cons ?? []),
  ...(character.soulCard?.latentTrait ? [character.soulCard.latentTrait] : [])
].map((trait) => String(trait).toLocaleLowerCase("es"));

export function ensurePsyche(character) {
  const alignment = character.soulCard?.alignment;
  const defaults = {
    honor: alignment === "Justicia" ? 68 : 50,
    greed: alignment === "Poder" ? 64 : alignment === "Caos" ? 56 : 42,
    liberty: alignment === "Libertad" ? 68 : alignment === "Caos" ? 60 : 50
  };
  if (!character.psyche || typeof character.psyche !== "object" || Array.isArray(character.psyche)) character.psyche = {};
  character.psyche.mood = MOODS.includes(character.psyche.mood)
    ? character.psyche.mood
    : alignment === "Poder" ? "Ambicioso" : alignment === "Justicia" ? "Cauteloso" : "Eufórico";
  if (!character.psyche.morality || typeof character.psyche.morality !== "object" ||
      Array.isArray(character.psyche.morality)) character.psyche.morality = { ...defaults };
  for (const axis of Object.keys(defaults)) {
    character.psyche.morality[axis] = clamp(character.psyche.morality[axis] ?? defaults[axis]);
  }
  character.psyche.dilemmasSeen = Array.isArray(character.psyche.dilemmasSeen)
    ? character.psyche.dilemmasSeen.slice(-AI_CONFIG.maxDilemmaHistory)
    : [];
  character.psyche.diary = Array.isArray(character.psyche.diary) ? character.psyche.diary.slice(0, 30) : [];
  character.psyche.lastReflectionDay = Number.isInteger(character.psyche.lastReflectionDay)
    ? character.psyche.lastReflectionDay
    : -1;
  const needs = character.psyche.needs;
  character.psyche.needs = {
    fatigue: clamp(needs?.fatigue),
    hunger: clamp(needs?.hunger)
  };
  return character.psyche;
}

function emitPsyche(character) {
  const psyche = ensurePsyche(character);
  dispatchTypedEvent(EVENT_TYPES.psycheUpdate, {
    mood: psyche.mood,
    morality: { ...psyche.morality }
  });
}

export function recordActionOutcome(character, action, result = {}) {
  const psyche = ensurePsyche(character);
  const morality = psyche.morality;
  const won = typeof result === "object" && result?.wins;
  if (action === "navigate") {
    morality.liberty = clamp(morality.liberty + 2);
    psyche.mood = character.location?.atSea ? "Cauteloso" : "Eufórico";
  } else if (action === "train") {
    morality.greed = clamp(morality.greed + 2);
    psyche.mood = "Ambicioso";
  } else if (action === "searchFruit") {
    morality.greed = clamp(morality.greed + 3);
    psyche.mood = "Ambicioso";
  } else if (action === "rest") {
    psyche.mood = "Cauteloso";
  } else if (action === "combat") {
    if (won) {
      psyche.mood = "Eufórico";
    } else {
      psyche.mood = "Vengativo";
    }
  }
  if (won) {
    morality.honor = clamp(morality.honor + 2);
    psyche.mood = "Eufórico";
  } else if (typeof result === "object" && result?.wins === false) {
    psyche.mood = "Vengativo";
  }
  if (character.stats?.health <= character.stats?.maxHealth * 0.2) psyche.mood = "Melancólico";
  emitPsyche(character);
  return psyche;
}

export function chooseAutonomousAction(character, random = Math.random) {
  const psyche = ensurePsyche(character);
  const hp = character.stats.health / Math.max(1, character.stats.maxHealth);
  const dream = String(character.soulCard?.dream || "Libertad").toLocaleLowerCase("es");
  const traits = traitsOf(character);
  const { honor, greed, liberty } = psyche.morality;
  const weights = { navigate: 3, train: 1.4, searchFruit: 1.1, rest: hp < 0.5 ? 2 : 0.3 };
  // sin barco el mar no es opción: el instinto no sueña con amarras que no tiene.
  // (0, no delete: las multiplicaciones posteriores con NaN romperían la elección)
  if (!character.ship?.acquired) weights.navigate = 0;
  if (dream.includes("poder")) weights.train += 2;
  if (dream.includes("riqueza")) weights.searchFruit += 2;
  if (dream.includes("justicia")) weights.navigate += 0.8;
  if (["libertad", "fama", "lazos"].some((value) => dream.includes(value))) weights.navigate += 2;
  if (traits.includes("astuto")) weights.searchFruit += 1;
  if (traits.includes("codicioso")) weights.searchFruit += 2;
  if (traits.some((trait) => trait.includes("rencoroso"))) weights.train += 1.4;
  if (traits.includes("desconfiado")) weights.searchFruit += 0.8;
  if (psyche.mood === "Cauteloso") weights.rest += 1.3;
  if (psyche.mood === "Ambicioso") { weights.train += 1; weights.searchFruit += 0.8; }
  if (psyche.mood === "Eufórico" || psyche.mood === "Vengativo") weights.navigate += 0.7;
  if (psyche.mood === "Melancólico") weights.rest += 1.8;
  weights.navigate += liberty / 50;
  weights.train += Math.max(0, 50 - honor) / 80;
  weights.searchFruit += greed / 35;
  // el instinto del starter no zarpa solo: sin barco jamás, sin Navegante tampoco
  // (el zarpe temprano lo sugiere el jugador; el mar cobra caro improvisar)
  if (!character.ship?.acquired) weights.navigate = 0;
  else if (character.starterChallenge && !hasNauticalCrew(character)) weights.navigate = 0;
  if (hp < 0.3) return "rest";
  const options = Object.entries(weights);
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  let choice = Math.min(0.999999, Math.max(0, Number(random()) || 0)) * total;
  for (const [action, weight] of options) {
    choice -= weight;
    if (choice < 0) return action;
  }
  return "navigate";
}

export function evaluateWhisper(character, action) {
  const psyche = ensurePsyche(character);
  const traits = traitsOf(character);
  const dream = String(character.soulCard?.dream || "").toLocaleLowerCase("es");
  const aligned = (action === "navigate" && (psyche.morality.liberty >= 65 || /libertad|fama|conocimiento|lazos/.test(dream))) ||
    (action === "train" && (psyche.mood === "Ambicioso" || dream.includes("poder"))) ||
    (action === "searchFruit" && (psyche.morality.greed >= 65 || dream.includes("riqueza"))) ||
    (action === "rest" && (psyche.mood === "Cauteloso" || traits.includes("prudente")));
  const against = (action === "rest" && ["valiente", "agresivo"].some((trait) => traits.includes(trait)) &&
      character.stats.health > character.stats.maxHealth * 0.4) ||
    (action === "train" && (psyche.mood === "Cauteloso" || traits.includes("prudente")) &&
      character.stats.health < character.stats.maxHealth * 0.45) ||
    (action === "searchFruit" && psyche.morality.honor >= 80 && psyche.morality.greed < 35) ||
    (action === "navigate" && psyche.mood === "Cauteloso" && character.stats.health < character.stats.maxHealth * 0.4) ||
    traits.includes("rebelde");
  return { aligned, against };
}

function satisfyLocalNeed(character, target) {
  const psyche = ensurePsyche(character);
  const { needs } = psyche;
  if (target.type === "tavern" || target.type === "inn") {
    const recovered = Math.min(20, needs.fatigue);
    needs.fatigue = Math.max(12, needs.fatigue - 58);
    character.stats.health = Math.min(character.stats.maxHealth, character.stats.health + 8);
    character.avatarActivity = "resting";
    return `descansa en ${target.name} y recupera ${Math.round(recovered)} puntos de energía`;
  }
  if (["market", "restaurant", "kitchen"].includes(target.type)) {
    if (Number(character.inventory?.provisions) > 0) {
      character.inventory.provisions -= 1;
      needs.hunger = Math.max(8, needs.hunger - 65);
      character.avatarActivity = "tavern";
      return `compra una comida en ${target.name} y consume una provisión`;
    }
    if (Number(character.berries) >= 20) {
      character.berries -= 20;
      needs.hunger = Math.max(12, needs.hunger - 50);
      character.avatarActivity = "tavern";
      return `compra un plato en ${target.name} por ฿20`;
    }
    character.avatarActivity = "idle";
    needs.hunger = Math.max(0, needs.hunger - 8);
    return `visita ${target.name}, pero no puede pagar alimentos`;
  }
  character.avatarActivity = "inspecting";
  psyche.mood = "Ambicioso";
  return `inspecciona ${target.name} por curiosidad y ambición`;
}

export function resolveLocalActivity(character, random = Math.random, { advanceNeeds = false, prioritizeOnly = false } = {}) {
  if (!character || character.status === "dead" || character.captured) return null;
  const psyche = ensurePsyche(character);
  if (advanceNeeds) {
    psyche.needs.fatigue = clamp(psyche.needs.fatigue + 1.5);
    psyche.needs.hunger = clamp(psyche.needs.hunger + 1);
  }
  if (character.location?.atSea) return null;
  const island = getMapIslands(character).find((entry) => entry.name === character.location?.island);
  if (!island) return null;
  if (character.location.localTarget) {
    const target = character.location.localTarget;
    target.progress = Math.min(2, (Number(target.progress) || 0) + 1);
    const start = target.from || character.location.scenePosition || target.position;
    const blend = target.progress / 2;
    character.location.scenePosition = {
      x: start.x + (target.position.x - start.x) * blend,
      y: start.y + (target.position.y - start.y) * blend
    };
    character.avatarActivity = "walking";
    if (target.progress < 2) return { action: "walking", message: `${character.name} cruza las calles rumbo a ${target.name}.` };
    character.location.scenePosition = { ...target.position };
    character.location.localVenue = { id: target.id, name: target.name, type: target.type };
    delete character.location.localTarget;
    delete character.localSuggestion;
    recordStarterClueVisit(character, island, target);
    const experience = satisfyLocalNeed(character, target);
    const corrected = `[BITÁCORA · ${psyche.mood}] ${character.name} entra en ${target.name}: ${experience}.`;
    character.log.unshift({ time: new Date().toISOString(), message: corrected });
    character.log = character.log.slice(0, 80);
    psyche.diary.unshift({ day: Number(character.world?.day) || 0, location: island.name, mood: psyche.mood, text: corrected });
    psyche.diary = psyche.diary.slice(0, 30);
    return { action: target.type, message: corrected };
  }
  const { fatigue, hunger } = psyche.needs;
  let requiredType = null;
  if (fatigue >= AI_CONFIG.fatigueThreshold) requiredType = "rest";
  else if (hunger >= AI_CONFIG.hungerThreshold) requiredType = "food";
  else if (prioritizeOnly) return null;
  const traits = traitsOf(character);
  const cautious = traits.some((trait) => ["prudente", "cauteloso", "astuto"].includes(trait)) ||
    psyche.mood === "Cauteloso";
  const bounty = Number(character.bounty) || 0;
  const candidates = island.pois.filter((poi) => {
    if (requiredType === "rest") return ["tavern", "inn"].includes(poi.type);
    if (requiredType === "food") return ["market", "restaurant", "kitchen"].includes(poi.type);
    if (character.localSuggestion && poi.id === character.localSuggestion) return !((poi.guarded || poi.type === "base") && cautious && bounty > 0);
    if ((poi.guarded || poi.type === "base") && cautious && bounty > 0) return false;
    if (poi.type === "poneglyph") {
      return canReadAncient(character) &&
        (character.race === "threeeye" || psyche.mood === "Ambicioso" ||
          character.soulCard?.dream === "Conocimiento");
    }
    if (poi.type === "base" || poi.type === "weapon_shop") return psyche.mood === "Ambicioso" || character.soulCard?.dream === "Poder";
    return false;
  });
  if (!candidates.length) return null;
  if (!requiredType && !character.localSuggestion && Number(random()) >= 0.12) return null;
  const destination = character.localSuggestion
    ? candidates.find((poi) => poi.id === character.localSuggestion) || candidates[0]
    : candidates[Math.floor(Math.min(0.999999, Math.max(0, Number(random()) || 0)) * candidates.length)];
  const from = character.location.scenePosition || { x: 320, y: 240 };
  character.location.localTarget = { ...destination, position: { x: destination.x, y: destination.y }, from, progress: 0 };
  character.location.localVenue = null;
  character.avatarActivity = "walking";
  return { action: "walking", message: `${character.name} decide caminar por ${island.name} hacia ${destination.name}.` };
}

function choiceWeight(choice, morality) {
  const utility = (Number(choice.honor) || 0) * (morality.honor - 50) +
    (Number(choice.greed) || 0) * (morality.greed - 50) +
    (Number(choice.liberty) || 0) * (morality.liberty - 50);
  return Math.exp(Math.max(-4, Math.min(4, utility / 500)));
}

export function resolvePortDilemma(character, random = Math.random) {
  if (!character || character.status === "dead" || character.location?.atSea || !character.location?.island) return null;
  if (Number(random()) >= AI_CONFIG.portDilemmaChance) return null;
  const psyche = ensurePsyche(character);
  const day = Number(character.world?.day) || 0;
  const islandDay = `:${character.location.island}:${day}`;
  if (psyche.dilemmasSeen.some((entry) => entry.endsWith(islandDay))) return null;
  const available = missionData.portDilemmas.filter((dilemma) =>
    (!dilemma.locations || dilemma.locations.includes(character.location.island)) &&
    !psyche.dilemmasSeen.includes(`${dilemma.id}:${character.location.island}:${day}`)
  );
  if (!available.length) return null;
  const dilemma = available[Math.floor(Math.min(0.999999, Math.max(0, Number(random()) || 0)) * available.length)];
  const weights = dilemma.choices.map((choice) => choiceWeight(choice, psyche.morality));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.min(0.999999, Math.max(0, Number(random()) || 0)) * total;
  let choice = dilemma.choices.at(-1);
  for (let index = 0; index < dilemma.choices.length; index += 1) {
    roll -= weights[index];
    if (roll < 0) { choice = dilemma.choices[index]; break; }
  }
  const seenId = `${dilemma.id}:${character.location.island}:${day}`;
  psyche.dilemmasSeen.push(seenId);
  psyche.dilemmasSeen = psyche.dilemmasSeen.slice(-AI_CONFIG.maxDilemmaHistory);
  for (const axis of ["honor", "greed", "liberty"]) psyche.morality[axis] = clamp(psyche.morality[axis] + (Number(choice[axis]) || 0));
  if (Number.isFinite(choice.berries)) character.berries = Math.max(0, (Number(character.berries) || 0) + choice.berries);
  if (Number.isFinite(choice.water)) {
    character.inventory ??= {};
    character.inventory.water = Math.max(0, (Number(character.inventory.water) || 0) + choice.water);
  }
  psyche.mood = MOODS.includes(choice.mood) ? choice.mood : psyche.mood;
  const event = {
    id: `dilemma-${dilemma.id}-${day}`,
    title: dilemma.title,
    text: `${dilemma.text} ${character.name} decide: ${choice.text}.`,
    location: character.location.island,
    day,
    choice: choice.id
  };
  character.log ??= [];
  character.log.unshift({ time: new Date().toISOString(), message: `[BITÁCORA · ${psyche.mood}] ${event.text}` });
  character.log = character.log.slice(0, 80);
  character.world ??= { day, news: [] };
  character.world.news ??= [];
  character.world.news.unshift({ type: "dilemma", title: dilemma.title, text: event.text, location: event.location, day });
  character.world.news = character.world.news.slice(0, 60);
  psyche.diary.unshift({ day, location: event.location, mood: psyche.mood, text: event.text });
  psyche.diary = psyche.diary.slice(0, 30);
  dispatchTypedEvent(EVENT_TYPES.worldEvent, event);
  emitPsyche(character);
  return { ...event, choice: { ...choice } };
}

export function writeDailyReflection(character) {
  if (!character || !Number.isInteger(character.world?.day)) return null;
  const psyche = ensurePsyche(character);
  if (psyche.lastReflectionDay === character.world.day) return null;
  psyche.lastReflectionDay = character.world.day;
  const entry = {
    day: character.world.day,
    location: character.location?.atSea ? "Mar abierto" : character.location?.island || "Mar abierto",
    mood: psyche.mood,
    text: `Al cerrar el día ${character.world.day}, ${character.name} se siente ${psyche.mood.toLocaleLowerCase("es")}. La brújula moral marca honor ${psyche.morality.honor}, codicia ${psyche.morality.greed} y libertad ${psyche.morality.liberty}.`
  };
  psyche.diary.unshift(entry);
  psyche.diary = psyche.diary.slice(0, 30);
  character.log ??= [];
  character.log.unshift({ time: new Date().toISOString(), message: `[BITÁCORA · Día ${entry.day}] ${entry.text}` });
  character.log = character.log.slice(0, 80);
  return entry;
}
