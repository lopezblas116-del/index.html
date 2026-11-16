import islandData from "./data/islands_data.json" with { type: "json" };

export const ISLAND_DATA = islandData;

export function islandDetails(island) {
  const details = { biome: "Isla desconocida", specialty: null, control: "Marina", ...ISLAND_DATA[island?.id] };
  const seed = [...String(island?.id || "")].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const biome = details.biome.toLowerCase();
  const theme = /cielo|nubes/.test(biome) ? "sky" : /nevad|invernal/.test(biome) ? "snow" : /desierto/.test(biome) ? "desert" : /volcán|tempestuoso/.test(biome) ? "volcanic" : /ciudad|fortaleza|fortificado/.test(biome) ? "stone" : "green";
  const options = ["tavern"];
  if (details.auctionHouse) options.push("blackmarket");
  if (["ohara", "namakura", "wano", "paradise"].includes(island?.id)) options.push("poneglyph");
  return { ...details, localScene: { theme, seed, architecture: details.architecture || theme, options } };
}
