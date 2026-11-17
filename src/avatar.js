const ERAS = [
  "Era de los Grandes Descubrimientos",
  "Era de las Banderas Rotas",
  "Era de la Nueva Generación",
  "Era del Horizonte Final"
];
const WORLD_NEWS = [
  "se informa de un choque entre piratas y la Marina en la Grand Line.",
  "un Cazarrecompensas célebre entregó a un capitán buscado.",
  "un avistamiento de Akuma no Mi agita los mercados del West Blue.",
  "una flota revolucionaria fue vista cerca de la Red Line.",
  "un Rey del Mar emergió en el Calm Belt y obligó a desviar varias rutas.",
  "un nuevo capitán reunió una tripulación y puso rumbo al Paraíso.",
  "la Marina anunció ascensos tras una captura de alto perfil."
];
const traits = (character) => [
  ...(character.soulCard?.traits?.pros ?? []),
  ...(character.soulCard?.traits?.cons ?? []),
  ...(character.soulCard?.latentTrait ? [character.soulCard.latentTrait] : [])
].map((trait) => String(trait).toLowerCase());
const pick = (items) => items[Math.floor(Math.random() * items.length)];

export function advanceSeaClock(world) {
  world.day = (Number(world.day) || 0) + 1;
  world.year = Math.floor(world.day / 365) + 1;
  const eraIndex = Math.min(Math.floor((world.year - 1) / 5), ERAS.length - 1);
  world.era = ERAS[eraIndex];
}

export function rollNews(world) {
  if (world.day % 7 !== 0 && Math.random() > 0.06) return null;
  const news = `Día ${world.day}, ${world.era}: ${pick(WORLD_NEWS)}`;
  world.news.unshift({ day: world.day, era: world.era, text: news });
  world.news = world.news.slice(0, 30);
  return news;
}

export function decideAvatarAction(character) {
  const hp = character.stats.health / character.stats.maxHealth;
  const personality = traits(character);
  const cautious = personality.includes("astuto") || personality.includes("prudente");
  if (hp < 0.25 && cautious) return "rest";
  if (hp < 0.30) return "rest";
  const canNavigate = !character.starterChallenge ||
    (Boolean(character.ship?.acquired) &&
      (character.crew || []).some((member) => /^(navegante|carpintero)$/i.test(String(member.role || "").trim())));
  const weights = { navigate: canNavigate ? 1.2 : 0, train: 1, searchFruit: 1, rest: 0.1 };
  const dream = (character.soulCard?.dream || "Libertad").toLowerCase();
  if (dream.includes("libertad") || dream.includes("fama") || dream.includes("lazos")) weights.navigate += 2.4;
  if (dream.includes("poder")) weights.train += 2.8;
  if (dream.includes("riqueza")) weights.searchFruit += 2.8;
  if (dream.includes("conocimiento")) { weights.navigate += 1; weights.searchFruit += 1.5; }
  if (personality.includes("impulsivo") || personality.includes("agresivo")) { weights.navigate += 1.8; weights.train += 1.4; }
  if (personality.includes("valiente")) weights.navigate += 1.5;
  if (personality.includes("astuto")) weights.searchFruit += 2;
  if (personality.includes("codicioso")) weights.searchFruit += 2;
  if (personality.includes("rencoroso")) weights.train += 1.4;
  if (personality.includes("desconfiado")) weights.searchFruit += 0.8;
  if (personality.includes("prudente")) { weights.rest += hp < 0.5 ? 2.5 : 0.6; weights.navigate -= 0.3; }
  if (hp < 0.45) weights.rest += 1.4;
  const pool = Object.entries(weights).flatMap(([action, weight]) => Array(Math.max(0, Math.round(weight * 10))).fill(action));
  return pick(pool);
}
