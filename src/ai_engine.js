import { AI_CONFIG } from "./config.js";
import { dispatchTypedEvent, EVENT_TYPES } from "./event_dispatcher.js";
import missionData from "./data/missions_data.json" with { type: "json" };

export const MOODS = Object.freeze(["Eufórico", "Cauteloso", "Ambicioso", "Melancólico", "Vengativo"]);
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const traitsOf = (character) => [
  ...(character.soulCard?.traits?.pros ?? []),
  ...(character.soulCard?.traits?.cons ?? [])
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
  if (dream.includes("poder")) weights.train += 2;
  if (dream.includes("riqueza")) weights.searchFruit += 2;
  if (["libertad", "fama", "lazos"].some((value) => dream.includes(value))) weights.navigate += 2;
  if (traits.includes("astuto")) weights.searchFruit += 1;
  if (psyche.mood === "Cauteloso") weights.rest += 1.3;
  if (psyche.mood === "Ambicioso") { weights.train += 1; weights.searchFruit += 0.8; }
  if (psyche.mood === "Eufórico" || psyche.mood === "Vengativo") weights.navigate += 0.7;
  if (psyche.mood === "Melancólico") weights.rest += 1.8;
  weights.navigate += liberty / 50;
  weights.train += Math.max(0, 50 - honor) / 80;
  weights.searchFruit += greed / 35;
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
