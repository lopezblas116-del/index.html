import loreData from "./data/lore_data.json" with { type: "json" };

const FRAGMENTS = loreData.seaFragments;
const FINAL = loreData.finalCoordinates;

export function ensureAncientLanguage(character) {
  character.ancientLanguage ??= { fragments: [], knowledge: 0 };
  character.ancientLanguage.fragments ??= [];
  character.ancientLanguage.knowledge = Math.min(100, character.ancientLanguage.fragments.length * 25);
  return character.ancientLanguage;
}

export function discoverAncient(character, random = Math.random) {
  const ancient = ensureAncientLanguage(character);
  if (character.status === "dead" || !character.location?.atSea || !character.mapPosition) return null;
  const fragment = FRAGMENTS.find((item) =>
    !ancient.fragments.some((found) => found.id === item.id) &&
    Math.hypot(character.mapPosition.x - item.point.x, character.mapPosition.y - item.point.y) <= 80
  );
  if (!fragment) return null;
  const alignmentBonus = character.soulCard?.alignment === "Justicia" || character.soulCard?.alignment === "Libertad" ? 0.0003 : 0;
  const chance = Math.min(0.005, 0.0005 + (Number(character.stats?.ingenuity) || 0) * 0.00005 + alignmentBonus);
  if (random() >= chance) return null;
  const found = { id: fragment.id, clue: fragment.clue, coordinates: { ...fragment.point } };
  ancient.fragments.push(found);
  ancient.knowledge = ancient.fragments.length * 25;
  character.inventory.items.push("Fragmento de inscripción antigua");
  character.log.unshift({ time: new Date().toISOString(), message: `[PONEGLYPH / LEYENDA] ${fragment.clue}` });
  if (ancient.knowledge >= 100) {
    ancient.finalCoordinates = { ...FINAL };
    character.log.unshift({ time: new Date().toISOString(), message: `[PONEGLYPH / LEYENDA] Cuatro voces señalan un horizonte velado: X:${FINAL.x} Y:${FINAL.y}.` });
  }
  if (character.systems?.testament) character.systems.testament.ancientLanguage = structuredClone(ancient);
  return found;
}
