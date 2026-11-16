import { islandDetails } from "./islands_data.js";

const FIXED_ISLANDS = [
  { id: "dawn", name: "Isla Dawn", x: 190, y: 170, sea: "East Blue" },
  { id: "shells", name: "Shells Town", x: 300, y: 250, sea: "East Blue" },
  { id: "orange", name: "Orange Town", x: 270, y: 300, sea: "East Blue" },
  { id: "syrup", name: "Villa Syrup", x: 185, y: 340, sea: "East Blue" },
  { id: "baratie", name: "Baratie", x: 350, y: 420, sea: "East Blue" },
  { id: "arlong", name: "Arlong Park", x: 260, y: 500, sea: "East Blue" },
  { id: "loguetown", name: "Loguetown", x: 495, y: 370, sea: "East Blue" },
  { id: "reverse", name: "Reverse Mountain", x: 600, y: 370, sea: "Grand Line" },
  { id: "whiskey", name: "Whiskey Peak", x: 700, y: 370, sea: "Paraíso" },
  { id: "water7", name: "Water 7", x: 815, y: 310, sea: "Paraíso" },
  { id: "ennies", name: "Enies Lobby", x: 875, y: 420, sea: "Paraíso" },
  { id: "sabaody", name: "Archipiélago Sabaody", x: 965, y: 370, sea: "Paraíso" },
  { id: "wano", name: "Wano", x: 1080, y: 290, sea: "Nuevo Mundo" },
  { id: "onyigashima", name: "Onigashima", x: 1105, y: 450, sea: "Nuevo Mundo" },
  { id: "ohara", name: "Isla Ohara", x: 200, y: 80, sea: "West Blue" },
  { id: "flevance", name: "Isla Flevance", x: 970, y: 80, sea: "North Blue" },
  { id: "torino", name: "Isla Torino", x: 970, y: 680, sea: "South Blue" },
  { id: "kano", name: "Isla Kano", x: 200, y: 680, sea: "West Blue" },
  { id: "minion", name: "Isla Minion", x: 1015, y: 120, sea: "North Blue" },
  { id: "swallow", name: "Isla Swallow", x: 1035, y: 155, sea: "North Blue" },
  { id: "baterilla", name: "Baterilla", x: 1020, y: 610, sea: "South Blue" },
  { id: "karate", name: "Isla Karate", x: 930, y: 620, sea: "South Blue" },
  { id: "paradise", name: "Paraíso", x: 720, y: 365, sea: "Paraíso" },
  { id: "new-world", name: "Nuevo Mundo", x: 1020, y: 370, sea: "Nuevo Mundo" }
];
const DYNAMIC_ISLANDS = [
  { id: "weatheria", name: "Weatheria", x: 410, y: 145, sea: "East Blue" },
  { id: "karakuri", name: "Karakuri", x: 770, y: 115, sea: "North Blue" },
  { id: "namakura", name: "Namakura", x: 430, y: 640, sea: "South Blue" },
  { id: "rusty", name: "Isla del Naufragio", x: 1035, y: 570, sea: "Nuevo Mundo" }
];
function seededIndex(seed, limit) { let value = 0; for (const char of String(seed || "voyager")) value = (value * 31 + char.charCodeAt(0)) >>> 0; return value % limit; }
function prepareIslands(character) {
  const offset = seededIndex(character?.id, DYNAMIC_ISLANDS.length);
  return [...FIXED_ISLANDS, ...DYNAMIC_ISLANDS.map((island, index) => ({ ...island, x: island.x + ((offset + index) % 3 - 1) * 22, y: island.y + ((offset * (index + 1)) % 3 - 1) * 18 }))];
}
export function getMapIslands(character) {
  return prepareIslands(character).map((island) => ({ ...island, ...islandDetails(island) }));
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
