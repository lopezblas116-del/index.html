const MAX_CHRONICLE_EVENTS = 120;
const MAX_WORLD_NEWS = 60;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const CRISIS_TEMPLATES = [
  {
    id: "missing-supplies",
    title: "Los suministros del puerto",
    opening: (first, second) => `${first} reúne a los vecinos para repartir las provisiones que quedan; ${second} quiere reservarlas para quienes puedan pagar.`
  },
  {
    id: "dockside-dispute",
    title: "Disputa en el muelle",
    opening: (first, second) => `${first} acusa a ${second} de cerrar el muelle a los pescadores locales. La discusión empieza a dividir al puerto.`
  },
  {
    id: "missing-cargo",
    title: "Un cargamento desaparecido",
    opening: (first, second) => `${first} busca un cargamento perdido y señala a ${second}, que insiste en que alguien más lo tomó.`
  }
];
const CHOICES = Object.freeze({
  help: { trust: 14, tension: -12, first: 18, second: 4, title: "ayudó a la comunidad" },
  mediate: { trust: 8, tension: -9, first: 8, second: 8, title: "negoció una tregua" },
  ignore: { trust: -8, tension: 12, first: -5, second: -12, title: "dejó que el conflicto siguiera" }
});

export function ensureNarrativeState(character) {
  if (!character?.world) return null;
  character.world.story ??= {};
  const story = character.world.story;
  story.version = 1;
  story.events ??= [];
  story.relationships ??= {};
  story.islands ??= {};
  story.attemptedCrisisDays ??= {};
  story.activeCrisis ??= null;
  return story;
}

function recordStoryEvent(character, event) {
  const story = ensureNarrativeState(character);
  if (!story || story.events.some((existing) => existing.id === event.id)) return false;
  story.events.push(event);
  story.events = story.events.slice(-MAX_CHRONICLE_EVENTS);
  character.world.news ??= [];
  character.world.news.unshift({
    type: "narrative",
    title: event.title,
    text: event.text,
    location: event.location,
    day: event.day,
    minuteOfDay: event.minuteOfDay,
    actor: event.actor,
    causeId: event.causeId
  });
  character.world.news = character.world.news.slice(0, MAX_WORLD_NEWS);
  character.log ??= [];
  character.log.unshift({ time: new Date().toISOString(), message: `[BITÁCORA] ${event.text}` });
  character.log = character.log.slice(0, 80);
  return true;
}

function pick(items, random) {
  return items[Math.floor(clamp(Number(random()) || 0, 0, 0.999999) * items.length)];
}

export function beginIslandCrisis(character, island, random = Math.random) {
  if (!character || character.status === "dead" || character.location?.atSea ||
      character.location?.island !== island?.name || !island?.id) return null;
  const story = ensureNarrativeState(character);
  if (!story || story.activeCrisis) return null;
  const day = Math.max(0, Number(character.world.day) || 0);
  if (story.attemptedCrisisDays[island.id] === day) return null;
  story.attemptedCrisisDays[island.id] = day;
  const islandState = story.islands[island.id] || { trust: 50, tension: 50 };
  const crisisChance = clamp(0.45 + (islandState.tension - 50) * 0.004 - (islandState.trust - 50) * 0.002, 0.1, 0.8);
  if (Number(random()) >= crisisChance) return null;

  const template = pick(CRISIS_TEMPLATES, random);
  const residents = island.npcs?.map((npc) => npc.name).filter(Boolean) || [];
  const first = residents[0] || `Vecinos de ${island.name}`;
  const second = residents.find((name) => name !== first) || `Gremio del puerto`;
  const id = `crisis:${island.id}:${day}`;
  const crisis = {
    id,
    islandId: island.id,
    location: island.name,
    template: template.id,
    title: template.title,
    participants: [first, second],
    opening: template.opening(first, second),
    startedDay: day,
    status: "active"
  };
  story.activeCrisis = crisis;
  // CEREBRO-TIKTOK: el feed da el título-pleito, no la apertura entera —
  // la apertura completa se lee cuando tocás la crisis y decidís.
  recordStoryEvent(character, {
    id: `${id}:started`,
    type: "crisis-started",
    title: crisis.title,
    text: `${character.name} llegó en medio del pleito: ${crisis.title}`,
    actor: first,
    participants: [...crisis.participants],
    location: island.name,
    day,
    minuteOfDay: Number(character.world.minuteOfDay) || 0,
    causeId: null
  });
  return crisis;
}

export function beginStarterIslandAdventure(character, island) {
  if (!character?.starterChallenge || character.status === "dead" || character.location?.atSea ||
      character.location?.routeIndex !== 0 || character.location?.island !== island?.name || !island?.id) return false;
  const story = ensureNarrativeState(character);
  if (!story || story.starterAdventure) return false;
  const crisis = beginIslandCrisis(character, island, () => 0);
  if (!crisis) return false;
  crisis.starterAdventure = true;
  story.starterAdventure = {
    crisisId: crisis.id,
    islandId: island.id,
    status: "investigating",
    visitedPoiIds: []
  };
  return true;
}

export function recordStarterClueVisit(character, island, poi) {
  const story = ensureNarrativeState(character);
  const adventure = story?.starterAdventure;
  const crisis = story?.activeCrisis;
  if (adventure?.status !== "investigating" || adventure.crisisId !== crisis?.id ||
      adventure.islandId !== island?.id || !poi?.id || character.location?.localVenue?.id !== poi.id ||
      adventure.visitedPoiIds.includes(poi.id)) return false;

  adventure.visitedPoiIds.push(poi.id);
  adventure.status = "decision-ready";
  recordStoryEvent(character, {
    id: `${crisis.id}:clue:${poi.id}`,
    type: "crisis-clue",
    title: "Rastro en la isla",
    text: `${character.name} revisó ${poi.name} y encontró un rastro del cargamento desaparecido.`,
    actor: character.name,
    location: island.name,
    day: Math.max(0, Number(character.world.day) || 0),
    minuteOfDay: Number(character.world.minuteOfDay) || 0,
    causeId: `${crisis.id}:started`
  });
  return true;
}

export function activeIslandCrisis(character, islandId) {
  const crisis = ensureNarrativeState(character)?.activeCrisis;
  return crisis?.status === "active" && crisis.islandId === islandId ? crisis : null;
}

export function resolveIslandCrisis(character, choice, { source = "jugador" } = {}) {
  const story = ensureNarrativeState(character);
  const crisis = story?.activeCrisis;
  const outcome = CHOICES[choice];
  if (!crisis || crisis.status !== "active" || !outcome || character.status === "dead") {
    return { ok: false, message: "Ese conflicto ya no está disponible." };
  }
  const adventure = story.starterAdventure;
  const isStarterAdventure = adventure?.crisisId === crisis.id;
  if (isStarterAdventure && adventure.status !== "decision-ready") {
    return { ok: false, message: "Primero visita un lugar de la isla para encontrar una pista." };
  }

  const [first, second] = crisis.participants;
  const relationships = story.relationships;
  for (const [name, change] of [[first, outcome.first], [second, outcome.second]]) {
    const current = relationships[name] || { score: 0, allies: 0, rivalries: 0 };
    current.score = clamp((Number(current.score) || 0) + change, -100, 100);
    if (current.score >= 20) current.allies = Math.max(1, Number(current.allies) || 0);
    if (current.score <= -20) current.rivalries = Math.max(1, Number(current.rivalries) || 0);
    relationships[name] = current;
  }

  const islandState = story.islands[crisis.islandId] || { trust: 50, tension: 50 };
  islandState.trust = clamp((Number(islandState.trust) || 0) + outcome.trust, 0, 100);
  islandState.tension = clamp((Number(islandState.tension) || 0) + outcome.tension, 0, 100);
  islandState.lastEventId = `${crisis.id}:resolved`;
  story.islands[crisis.islandId] = islandState;
  crisis.status = "resolved";
  crisis.choice = choice;
  crisis.resolvedDay = Math.max(0, Number(character.world.day) || 0);
  let rewardText = "";
  if (isStarterAdventure) {
    adventure.status = "complete";
    adventure.choice = choice;
    character.inventory ??= { provisions: 0, equipment: [], items: [] };
    character.inventory.timber = Math.max(0, Number(character.inventory.timber) || 0) + 3;
    character.berries = Math.max(0, Number(character.berries) || 0) + 20;
    rewardText = " El puerto aporta 3 tablones y ฿20; ya tienes materiales y fondos para construir una chalupa en el astillero.";
  }

  const event = {
    id: `${crisis.id}:resolved`,
    type: "crisis-resolved",
    title: crisis.title,
    text: `${character.name} ${outcome.title} en ${crisis.location}. Vínculo con ${first}: ${relationships[first].score}/100; con ${second}: ${relationships[second].score}/100. La confianza del puerto queda en ${islandState.trust}/100 y la tensión en ${islandState.tension}/100.${rewardText}`,
    actor: character.name,
    participants: [...crisis.participants],
    location: crisis.location,
    day: crisis.resolvedDay,
    minuteOfDay: Number(character.world.minuteOfDay) || 0,
    choice,
    causeId: `${crisis.id}:started`,
    source
  };
  recordStoryEvent(character, event);
  story.activeCrisis = null;
  return { ok: true, event, message: event.text };
}

export function advanceIslandStory(character) {
  const story = ensureNarrativeState(character);
  const crisis = story?.activeCrisis;
  if (!crisis || crisis.status !== "active" || Number(character.world?.day) <= crisis.startedDay) return null;
  if (story.starterAdventure?.crisisId === crisis.id) return null;
  const traits = [
    ...(character.soulCard?.traits?.pros || []),
    ...(character.soulCard?.traits?.cons || [])
  ].map((trait) => String(trait).toLocaleLowerCase("es"));
  const morality = character.psyche?.morality || {};
  const choice = traits.some((trait) => ["honrado", "leal", "valiente"].includes(trait)) || Number(morality.honor) >= 65
    ? "help"
    : Number(morality.liberty) >= 65 || Number(morality.honor) >= 45
      ? "mediate"
      : "ignore";
  return resolveIslandCrisis(character, choice, { source: "avatar" });
}
