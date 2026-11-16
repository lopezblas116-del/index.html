// The IDs correspond to the existing map, so saved locations remain compatible.
export const ISLAND_DATA = {
  dawn: { biome: "Colinas verdes y costa", specialty: "wood", mission: "Proteger la aldea", control: "Marina", landmark: "Villa Foosha", architecture: "foosha" },
  shells: { biome: "Puerto fortificado", specialty: "weapon", mission: "Liberar la base", control: "Marina", affiliated: true, architecture: "fortress" },
  orange: { biome: "Archipiélago templado", specialty: "water", mission: "Recuperar el mapa de navegación", control: "Tirano" },
  syrup: { biome: "Bosque y costa", specialty: "wood", mission: "Defender la aldea", control: "Marina" },
  baratie: { biome: "Restaurante flotante", specialty: "rum", mission: "Escoltar el barco restaurante", control: "Marina", architecture: "baratie" },
  arlong: { biome: "Arrecife tropical", specialty: "water", mission: "Liberar la isla", control: "Tirano", boss: "Arlong", architecture: "arlong" },
  loguetown: { biome: "Ciudad portuaria", specialty: "weapon", mission: "El asalto de Loguetown", control: "Marina", affiliated: true, architecture: "loguetown" },
  ohara: { biome: "Bosque de eruditos", specialty: "wood", mission: "Proteger el legado de Ohara", control: "Marina" },
  kano: { biome: "Montañas y jardines", specialty: "weapon", mission: "Escoltar una caravana", control: "Tirano" },
  flevance: { biome: "Ciudad nevada", specialty: "water", mission: "Ayudar a los supervivientes", control: "Marina" },
  minion: { biome: "Isla invernal", specialty: "weapon", mission: "Investigar el puerto helado", control: "Tirano" },
  swallow: { biome: "Costa rocosa", specialty: "wood", mission: "Recuperar suministros", control: "Marina" },
  torino: { biome: "Bosque medicinal", specialty: "water", mission: "Buscar plantas medicinales", control: "Marina" },
  baterilla: { biome: "Isla tropical", specialty: "rum", mission: "Proteger a los habitantes", control: "Marina" },
  karate: { biome: "Montañas de entrenamiento", specialty: "weapon", mission: "Superar el desafío del puerto", control: "Tirano" },
  reverse: { biome: "Montaña oceánica", specialty: "water", mission: "Cruzar la Reverse Mountain", control: "Marina" },
  whiskey: { biome: "Desierto", specialty: "rum", mission: "Descubrir la trampa de Whiskey Peak", control: "Tirano" },
  water7: { biome: "Ciudad de canales", specialty: "wood", mission: "Defender el astillero", control: "Marina" },
  ennies: { biome: "Fortaleza judicial", specialty: "weapon", mission: "Investigar la fortaleza", control: "Marina" },
  sabaody: { biome: "Manglares y bajos fondos", specialty: "water", mission: "Explorar el archipiélago", control: "Marina", affiliated: true, segregated: true, auctionHouse: true },
  wano: { biome: "País montañoso", specialty: "weapon", mission: "Liberar Wano", control: "Tirano" },
  onyigashima: { biome: "Isla volcánica", specialty: "weapon", mission: "Enfrentar a los invasores", control: "Tirano" },
  paradise: { biome: "Mar de islas cambiantes", specialty: "water", mission: "Entrar al Paraíso", control: "Marina" },
  "new-world": { biome: "Mar tempestuoso", specialty: "rum", mission: "Conquistar el Nuevo Mundo", control: "Tirano" },
  weatheria: { biome: "Isla del cielo y nubes", specialty: "water", mission: "Observar las corrientes del cielo", control: "Marina", architecture: "sky" },
  karakuri: { biome: "Isla invernal mecánica", specialty: "weapon", mission: "Investigar los mecanismos", control: "Marina" },
  namakura: { biome: "Bosque de ruinas", specialty: "wood", mission: "Explorar las ruinas", control: "Tirano" },
  rusty: { biome: "Costa de naufragios", specialty: "wood", mission: "Explorar los restos", control: "Tirano" }
};

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
