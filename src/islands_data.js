import islandData from "./data/islands_data.json" with { type: "json" };
import missionData from "./data/missions_data.json" with { type: "json" };
import loreData from "./data/lore_data.json" with { type: "json" };
import { registerExtension } from "./data_loader.js";

export const ISLAND_DATA = islandData;
registerExtension("islands", islandData);
registerExtension("missions", missionData);
registerExtension("lore", loreData);

export function islandDetails(island) {
  const details = { biome: "Isla desconocida", specialty: null, control: "Marina", ...ISLAND_DATA[island?.id] };
  const defaultPois = missionData.defaultPois.map((poi) => ({
    ...poi,
    id: `${island?.id || "unknown"}-${poi.id}`
  }));
  const loreSite = loreData.sites[island?.id]?.poi;
  const pois = [...(details.pois || defaultPois), ...(loreSite ? [{ ...loreSite }] : [])];
  const districts = details.districts || missionData.defaultDistricts;
  const seed = [...String(island?.id || "")].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const biome = details.biome.toLowerCase();
  const theme = /cielo|nubes/.test(biome) ? "sky" : /nevad|invernal/.test(biome) ? "snow" : /desierto/.test(biome) ? "desert" : /volcán|tempestuoso/.test(biome) ? "volcanic" : /ciudad|fortaleza|fortificado/.test(biome) ? "stone" : "green";
  const options = ["tavern"];
  if (details.auctionHouse) options.push("blackmarket");
  if (loreSite) options.push("poneglyph");
  return { ...details, pois, districts, localScene: { theme, seed, architecture: details.architecture || theme, options } };
}
