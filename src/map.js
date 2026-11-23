import { ISLAND_DATA, islandDetails } from "./islands_data.js";

export const PLANETARY_GEOGRAPHY = Object.freeze({
  redLineMeridians: Object.freeze([0, Math.PI]),
  grandLineLatitude: 0,
  calmBelts: Object.freeze([-0.24, 0.24]),
  reverseMountain: Object.freeze({ x: 600, y: 380, name: "Reverse Mountain" }),
  blues: Object.freeze([
    Object.freeze({ name: "EAST BLUE", x: 120, y: 190 }),
    Object.freeze({ name: "WEST BLUE", x: 120, y: 610 }),
    Object.freeze({ name: "NORTH BLUE", x: 950, y: 100 }),
    Object.freeze({ name: "SOUTH BLUE", x: 950, y: 650 })
  ])
});

const ISLANDS = Object.entries(ISLAND_DATA).map(([id, data]) => ({
  id, name: data.name, x: data.coordinates.x, y: data.coordinates.y, sea: data.coordinates.sea
}));
const DYNAMIC_ISLANDS = new Set(["weatheria", "karakuri", "namakura", "rusty"]);
function seededIndex(seed, limit) { let value = 0; for (const char of String(seed || "voyager")) value = (value * 31 + char.charCodeAt(0)) >>> 0; return value % limit; }
function prepareIslands(character) {
  const offset = seededIndex(character?.id, DYNAMIC_ISLANDS.size);
  return ISLANDS.map((island, index) => {
    if (!DYNAMIC_ISLANDS.has(island.id)) return { ...island };
    const dynamicIndex = [...DYNAMIC_ISLANDS].indexOf(island.id);
    return {
      ...island,
      x: island.x + ((offset + dynamicIndex) % 3 - 1) * 22,
      y: island.y + ((offset * (dynamicIndex + 1)) % 3 - 1) * 18
    };
  });
}
export function getMapIslands(character) {
  return prepareIslands(character).map((island) => {
    const detalles = islandDetails(island);
    // el id y lo propio de la isla sobreviven: islandDetails no lo trae
    const merged = { ...island, ...detalles, pois: detalles.pois || island.pois };
    // el tablón del puerto existe en toda isla: ahí cuelgan los encargos del día
    if (!(merged.pois || []).some((poi) => poi.id === "puerto-tablon")) {
      const ancla = (merged.pois || []).find((poi) => poi.type === "dock") || merged.pois?.[0];
      merged.pois = [...(merged.pois || []), { id: "puerto-tablon", name: "Tablón de Puerto", type: "tablon", x: (ancla?.x || 320) + 34, y: (ancla?.y || 240) + 18 }];
    }
    return merged;
  });
}
export function createScenePosition(islandId, avatarId) {
  let seed = 0;
  for (const char of `${islandId}:${avatarId}`) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  return { x: 212 + seed % 212, y: 224 + (seed >>> 8) % 35 };
}
export function avatarScenePosition(islandId, avatarId, activity = "idle", savedPosition) {
  if (Number.isFinite(savedPosition?.x) && Number.isFinite(savedPosition?.y)) return { x: savedPosition.x, y: savedPosition.y };
  if (activity === "tavern") return { x: 109, y: 130 };
  if (activity === "resting") return { x: 487, y: 325 };
  if (activity === "combat") return { x: 320, y: 228 };
  return createScenePosition(islandId, avatarId);
}
export function localWaypointPosition(island, npcIndex, time) {
  const places = (island?.pois || []).filter((poi) => Number.isFinite(poi.x) && Number.isFinite(poi.y));
  const route = places.length > 1
    ? places.map(({ x, y }) => ({ x: Number(x), y: Number(y) }))
    : [{ x: 112, y: 129 }, { x: 320, y: 285 }, { x: 515, y: 129 }, { x: 320, y: 205 }];
  const phase = ((Number(time) || 0) / 2600 + Math.max(0, Number(npcIndex) || 0)) % route.length;
  const index = Math.floor(phase);
  const progress = phase - index;
  const from = route[index];
  const to = route[(index + 1) % route.length];
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress
  };
}
export function newsLocation(entry, character) {
  if (!entry || typeof entry !== "object") entry = { text: String(entry ?? "") };
  const point = entry.coordinates;
  if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) {
    return { x: point.x, y: point.y, name: entry.location || "Zona del evento" };
  }
  const matchingTreasure = character?.systems?.treasureMaps?.find((map) => entry.type === "treasure-map" && entry.text?.includes(map.clue));
  if (Number.isFinite(matchingTreasure?.x) && Number.isFinite(matchingTreasure?.y)) {
    return { x: matchingTreasure.x, y: matchingTreasure.y, name: matchingTreasure.island || "Tesoro oculto" };
  }
  const places = prepareIslands(character).sort((a, b) => b.name.length - a.name.length);
  const island = entry.location
    ? places.find((place) => place.name.toLocaleLowerCase("es") === String(entry.location).toLocaleLowerCase("es"))
    : places.find((place) => String(entry.text ?? "").toLocaleLowerCase("es").includes(place.name.toLocaleLowerCase("es")));
  return island ? { ...island } : null;
}
