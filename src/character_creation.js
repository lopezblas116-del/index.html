import { RACES } from "./races.js";

const EXOTIC_RACES = Object.keys(RACES).filter((race) => race !== "human");
export const ORIGIN_SEAS = Object.freeze(["East Blue", "West Blue", "South Blue", "North Blue"]);

export function isBiographyValid(story) {
  return typeof story === "string" && story.trim().length > 0 && story.length <= 280;
}

export function rollCreationRace(random = Math.random) {
  if (random() < 0.94) return "human";
  return EXOTIC_RACES[Math.floor(random() * EXOTIC_RACES.length)];
}

export function generateRandomOrigin(random = Math.random) {
  const race = rollCreationRace(random);
  const originSea = ORIGIN_SEAS[Math.floor(random() * ORIGIN_SEAS.length)];
  return { race, originSea, allowRareRace: Boolean(RACES[race]?.rare) };
}

export function inferLatentTrait(story = "") {
  const text = String(story).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  if (/\bvenganza\b/.test(text) && /\bmarina\b/.test(text)) return "Rencoroso_Marina";
  if (/\bvenganza\b/.test(text)) return "Rencoroso";
  if (/\bhu[eé]rfan[oa]s?\b/.test(text)) return "Desconfiado";
  if (/\boro\b|\brico\b|\briqueza\b|\bberries\b/.test(text)) return "Codicioso";
  return null;
}
