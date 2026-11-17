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
  const topic = loreData.poneglyphTopics.find((entry) => entry.id === loreSite?.lore);
  const bossName = typeof details.boss === "string" ? details.boss : details.boss?.name || `Guardián de ${details.name || island?.name || "la isla"}`;
  const basePois = details.pois || defaultPois;
  const bossPoi = basePois.find((poi) => poi.guarded || poi.boss || poi.type === "base") || {
    id: `${island?.id || "unknown"}-boss-lair`, name: `Guarida de ${bossName}`,
    type: "boss_lair", guarded: true, boss: bossName, x: 320, y: 82
  };
  const pois = [...basePois.map((poi) => poi === bossPoi ? { ...poi, boss: bossName, guarded: true } : poi),
    ...(basePois.includes(bossPoi) ? [] : [bossPoi]),
    ...(loreSite ? [{ ...loreSite, glyphType: topic?.type || "blue" }] : [])];
  const districts = details.districts || missionData.defaultDistricts;
  const seed = [...String(island?.id || "")].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const biome = details.biome.toLowerCase();
  const theme = /cielo|nubes/.test(biome) ? "sky" : /nevad|invernal/.test(biome) ? "snow" : /desierto/.test(biome) ? "desert" : /volcán|tempestuoso/.test(biome) ? "volcanic" : /ciudad|fortaleza|fortificado/.test(biome) ? "stone" : "green";
  const options = ["tavern"];
  if (details.auctionHouse) options.push("blackmarket");
  if (loreSite) options.push("poneglyph");
  return { ...details, boss: bossName, pois, districts, localScene: { theme, seed, architecture: details.architecture || theme, options } };
}
