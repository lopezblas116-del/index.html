import { advanceAdvancedSystems, discoverAtSea, draftTestament, generateTreasureMap, updateCrewLoyalty } from "./systems.js";
import { resolvePortContracts, resolvePortSuggestions } from "./block1.js";
import { seaEncounter } from "./combat_economy.js";
import { getMapIslands } from "./map.js";
import { discoverAncient, ensureAncientLanguage } from "./ancient_language.js";
import { cargoCapacity, isRacePursued, normalizeRace, raceStats, rollLineageRace } from "./races.js";
import { fruitNear } from "./devil_fruits.js";
import { maybeCaptureAtAuction } from "./politics.js";

const ERAS = [
  "Era de los Grandes Descubrimientos",
  "Era de las Banderas Rotas",
  "Era de la Nueva Generación",
  "Era del Horizonte Final"
];
const WORLD_NEWS = [
  "la Marina interceptó una ruta pirata cerca de Loguetown.",
  "un Cazarrecompensas entregó a un capitán buscado.",
  "un avistamiento de Akuma no Mi agitó los mercados del East Blue.",
  "una flota revolucionaria fue vista cerca de la Red Line.",
  "un Rey del Mar obligó a desviar varias rutas.",
  "un nuevo capitán reunió una tripulación y puso rumbo al Paraíso.",
  "la Marina anunció ascensos tras una captura de alto perfil."
];
const ROUTES = {
  "East Blue": ["Isla Dawn", "Orange Town", "Villa Syrup", "Baratie", "Arlong Park", "Loguetown", "Reverse Mountain", "Paraíso", "Nuevo Mundo"],
  "West Blue": ["Isla Ohara", "Isla Kano", "Water 7", "Loguetown", "Reverse Mountain", "Paraíso", "Nuevo Mundo"],
  "North Blue": ["Isla Flevance", "Isla Minion", "Isla Swallow", "Loguetown", "Reverse Mountain", "Paraíso", "Nuevo Mundo"],
  "South Blue": ["Isla Torino", "Baterilla", "Isla Karate", "Loguetown", "Reverse Mountain", "Paraíso", "Nuevo Mundo"]
};
const MISSION_NAMES = [
  "Proteger la aldea", "Recuperar el mapa de navegación", "Defender el astillero", "Escoltar el barco restaurante", "Liberar la isla", "El asalto de Loguetown", "Cruzar la Reverse Mountain", "Entrar al Paraíso", "Conquistar el Nuevo Mundo"
];
const ENEMIES = ["piratas rivales", "Marines", "Cazarrecompensas", "agentes del Gobierno", "una banda local"];
const TRAITS = ["Valiente", "Astuto", "Impulsivo", "Prudente", "Agresivo", "Honrado", "Rebelde", "Leal"];
export const PULSE_MS = 75_000;
export const SAVE_KEY = "one-latam-rpg-beta-1";
const rand = (max) => Math.floor(Math.random() * max);
const pick = (items) => items[rand(items.length)];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const formatNum = (value) => new Intl.NumberFormat("es-ES").format(Number(value) || 0);
const traitsOf = (character) => [...(character.soulCard?.traits?.pros ?? []), ...(character.soulCard?.traits?.cons ?? [])].map((trait) => String(trait).toLowerCase());
export const routeFor = (sea) => ROUTES[sea] ?? ROUTES["East Blue"];
const missionFor = (character, index = character.location.routeIndex) => {
  const island = routeFor(character.originSea)[index] ?? "Mar abierto";
  const details = getMapIslands(character).find((entry) => entry.name === island);
  return { island, title: details?.mission ?? MISSION_NAMES[Math.min(index, MISSION_NAMES.length - 1)], enemy: ENEMIES[index % ENEMIES.length], reward: 25000 + index * 15000, status: "active" };
};

export function createCharacter({ name, username = "@usuario", faction = "Pirata", originSea, race = "human", allowRareRace = false, dream = "Libertad", alignment = "Libertad", story = "", traits = [], trait, appearance = {} }) {
  const displayName = String(name || "Aventurero").trim().slice(0, 24);
  const chosenTraits = traits.length ? traits.slice(0, 2) : [trait || "Valiente"];
  const randomTraits = TRAITS.filter((entry) => !chosenTraits.includes(entry));
  originSea = ROUTES[originSea] ? originSea : pick(Object.keys(ROUTES));
  const normalizedFaction = faction === "Marina" ? "Marine" : faction;
  const species = normalizeRace(race, { allowRare: allowRareRace });
  const racial = raceStats(species);
  const conquerorPotential = Math.random() < 0.003;
  const family = displayName.split(/\s+/).at(-1) || displayName;
  const route = routeFor(originSea);
  return {
    version: 3,
    id: globalThis.crypto?.randomUUID?.() ?? `captain-${Date.now()}`,
    name: displayName,
    username: String(username).startsWith("@") ? String(username).slice(0, 17) : `@${String(username).slice(0, 16)}`,
    story: String(story).trim().slice(0, 240),
    faction: normalizedFaction,
    originSea,
    appearance: { skin: appearance.skin || "Clara", hair: appearance.hair || "Negro", accessory: appearance.accessory || "Bandana" },
    location: { region: originSea, island: route[0], routeIndex: 0 },
    logPose: { alignment: 0, required: 3 },
    mission: { ...missionFor({ originSea, location: { routeIndex: 0 } }), completed: 0 },
    fruit: null,
    haki: { busoshoku: false, kenbunshoku: false, haoshoku: false, conquerorPotential, grandLineSince: null, survivalEvents: 0 },
    bounty: species === "lunarian" ? 500_000 : 0,
    reputation: species === "lunarian" ? 500_000 : 0,
    berries: 100,
    captures: 0,
    rank: normalizedFaction === "Marine" ? "Recluta" : "Novato",
    level: 1,
    experience: 0,
    stats: { health: 100 + racial.health, maxHealth: 100 + racial.health, strength: 5 + racial.strength, agility: Math.max(1, 5 + racial.agility), ingenuity: 5 },
    race: species,
    soulCard: { dream, alignment: ["Poder", "Justicia", "Libertad", "Caos"].includes(alignment) ? alignment : "Libertad", traits: { pros: chosenTraits, cons: [] }, latentTrait: pick(randomTraits), latentHaki: conquerorPotential, hiddenTalent: pick(["Cartografía", "Instinto de Tormenta", "Oído Antiguo"]) },
    lineage: { family, generation: 1, inheritedFrom: null, legacyChest: [], inheritedReputation: 0 },
    autonomy: { mode: "active", paused: false, tickCount: 0 },
    whisper: { affinity: 55, rebellion: 45 },
    world: { day: 0, minuteOfDay: 0, year: 1, era: ERAS[0], news: [], pantheon: [] },
    ship: { health: 100, maxHealth: 100, reinforced: species !== "giant" },
    raceHunt: { exposed: isRacePursued(species), alertLevel: species === "lunarian" ? "active" : "latent" },
    racialLearning: { talentBonus: species === "human" ? 0.1 : 0 },
    status: "alive",
    log: [{ time: new Date().toISOString(), message: `¡${displayName} (${username}) inicia su aventura en ${route[0]}, ${originSea}! Sueño: ${dream}.` }]
  };
}

function normalize(character) {
  if (!character || !character.stats) return null;
  character.version = 3;
  character.faction = character.faction === "Marina" ? "Marine" : character.faction;
  character.autonomy ??= { mode: "active", paused: false, tickCount: 0 };
  character.autonomy.paused ??= character.autonomy.mode === "paused";
  character.autonomy.mode = character.autonomy.paused ? "paused" : "active";
  character.autonomy.tickCount ??= 0;
  character.whisper ??= { affinity: 55, rebellion: 45 };
  character.whisper.affinity = clamp(Number(character.whisper.affinity ?? 55), 0, 100);
  character.whisper.rebellion = clamp(Number(character.whisper.rebellion ?? (100 - character.whisper.affinity)), 0, 100);
  character.soulCard ??= { dream: "Libertad", traits: { pros: [], cons: [] } };
  character.soulCard.traits ??= { pros: [], cons: [] };
  character.soulCard.traits.pros ??= [];
  character.soulCard.traits.cons ??= [];
  character.soulCard.latentHaki ??= Boolean(character.haki?.conquerorPotential);
  character.haki ??= { busoshoku: false, kenbunshoku: false, haoshoku: false };
  character.haki = { ...character.haki, busoshoku: Boolean(character.haki.busoshoku), kenbunshoku: Boolean(character.haki.kenbunshoku), haoshoku: Boolean(character.haki.haoshoku), survivalEvents: Number(character.haki.survivalEvents) || 0 };
  character.race = normalizeRace(character.race, { allowRare: true });
  character.raceHunt ??= { exposed: isRacePursued(character.race), alertLevel: character.race === "lunarian" ? "active" : "latent" };
  character.racialLearning ??= { talentBonus: character.race === "human" ? 0.1 : 0 };
  character.ship ??= { health: 100, maxHealth: 100, reinforced: character.race !== "giant" };
  character.ship.reinforced ??= character.race !== "giant";
  character.fruit ??= null;
  if (character.fruit) character.fruit.swimming = false;
  character.originSea ??= "East Blue";
  const route = routeFor(character.originSea);
  character.location ??= { region: character.originSea, island: route[0], routeIndex: 0 };
  character.location.routeIndex = clamp(Number(character.location.routeIndex) || 0, 0, route.length - 1);
  if (!character.location.detour) character.location.island = route[character.location.routeIndex] ?? character.location.island ?? route[0];
  character.logPose ??= { alignment: 0, required: 3 };
  character.logPose.required = Math.max(1, Number(character.logPose.required) || 3);
  character.logPose.alignment = clamp(Number(character.logPose.alignment) || 0, 0, character.logPose.required - 1);
  character.mission ??= { ...missionFor(character), completed: 0 };
  character.mission.completed = Number(character.mission.completed) || 0;
  character.mission.island = character.location.island;
  character.mission.status ??= "active";
  character.lineage ??= { family: character.name, generation: 1, inheritedFrom: null, legacyChest: [], inheritedReputation: 0 };
  character.lineage.legacyChest ??= [];
  character.world ??= { day: 0, year: 1, era: ERAS[0], news: [], pantheon: [] };
  character.world.news ??= [];
  character.world.pantheon ??= [];
  character.world.day ??= 0;
  character.world.minuteOfDay ??= (character.autonomy.tickCount * 5) % 1440;
  character.status ??= "alive";
  character.reputation ??= character.bounty ?? 0;
  character.bounty ??= 0;
  character.captures ??= 0;
  character.berries ??= 0;
  character.level ??= 1;
  character.experience ??= 0;
  character.stats.maxHealth ??= 100;
  character.stats.health = clamp(Number(character.stats.health) || (character.status === "dead" ? 0 : 1), 0, character.stats.maxHealth);
  character.log ??= [];
  return character;
}
export function loadGame() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? normalize(JSON.parse(raw)) : null; }
  catch { return null; }
}
export function saveGame(character) {
  try { character.autonomy.lastSavedAt = Date.now(); character.autonomy.lastPulseAt ??= character.autonomy.lastSavedAt; localStorage.setItem(SAVE_KEY, JSON.stringify(character)); return true; }
  catch { return false; }
}
export function addLog(character, message) {
  character.log.unshift({ time: new Date().toISOString(), message });
  character.log = character.log.slice(0, 80);
}
function gainExperience(character, amount) {
  character.experience += amount;
  let leveled = false;
  while (character.experience >= character.level * 100) {
    character.experience -= character.level * 100;
    character.level += 1;
    character.stats.maxHealth += 5;
    character.stats.health = Math.min(character.stats.maxHealth, character.stats.health + 5);
    leveled = true;
  }
  return leveled;
}
function updateRank(character) {
  if (character.faction === "Marine") {
    const ranks = ["Recluta", "Marinero", "Sargento", "Teniente", "Capitán", "Comodoro", "Vicealmirante", "Almirante"];
    character.rank = ranks[Math.min(Math.floor(character.captures / 2), ranks.length - 1)];
  } else if (character.faction === "Pirata") character.rank = character.level >= 8 ? "Capitán de renombre" : character.level >= 4 ? "Capitán" : "Novato";
  else character.rank = character.level >= 5 ? "Explorador de renombre" : "Viajero";
}
function addReputation(character, base, reason = "acción destacada") {
  const bold = traitsOf(character).some((t) => ["impulsivo", "agresivo"].includes(t));
  const amount = Math.round(base * (bold ? 1.25 : 1));
  character.reputation += amount;
  if (["Pirata", "Revolucionario"].includes(character.faction)) {
    const oldBounty = character.bounty;
    character.bounty += amount;
    if (character.bounty !== oldBounty) {
      character.world.news.unshift({ type: "bounty", text: `📜 SE BUSCA · ${character.name} · Recompensa: ฿${character.bounty} Berries.`, day: character.world.day, location: character.location.atSea ? undefined : character.location.island });
      character.world.news = character.world.news.slice(0, 60);
    }
    if (Math.floor(oldBounty / 100000) < Math.floor(character.bounty / 100000)) addLog(character, `📜 ¡Nuevo cartel SE BUSCA! La recompensa de ${character.name} sube a ฿${formatNum(character.bounty)} por ${reason}.`);
  }
  return amount;
}
function checkDeath(character, cause) {
  if (character.status === "dead" || character.stats.health > 0) return false;
  character.stats.health = 0;
  character.status = "dead";
  if (character.fruit) character.pendingFruitRelease = character.fruit.id;
  character.autonomy.paused = true;
  character.autonomy.mode = "paused";
  generateTreasureMap(character, "muerte");
  if ((character.systems.discoveries?.length || character.ancientLanguage?.fragments?.length) && !character.systems.testament) draftTestament(character);
  character.world.pantheon.unshift({ id: character.id, name: character.name, username: character.username, family: character.lineage.family, generation: character.lineage.generation, faction: character.faction, level: character.level, bounty: character.bounty, reputation: character.reputation, dream: character.soulCard.dream, cause, location: character.location.atSea ? undefined : character.location.island, achievements: [`Nivel ${character.level}`, character.location.island, ...(character.fruit ? [`Portador de ${character.fruit.name}`] : [])], time: new Date().toISOString() });
  character.world.pantheon = character.world.pantheon.slice(0, 30);
  addLog(character, `☠ ${character.name} ha caído (${cause}). Su nombre entra en el Panteón de Leyendas; su linaje continúa.`);
  return true;
}
function learnCombatTechnique(character) {
  const isGrandLine = Number(character.location?.routeIndex) >= routeFor(character.originSea).indexOf("Reverse Mountain") && routeFor(character.originSea).indexOf("Reverse Mountain") >= 0;
  if (!isGrandLine) return " El entrenamiento extremo no despierta Haki en los Cuatro Mares.";
  if (!character.haki.grandLineSince) character.haki.grandLineSince = Date.now();
  const matured = Date.now() - character.haki.grandLineSince >= 30 * 24 * 60 * 60 * 1000;
  const available = ["busoshoku", "kenbunshoku"].filter((key) => !character.haki[key]);
  if (!matured || character.haki.survivalEvents < 5 || !available.length || Math.random() > 0.1) return " El Haki exige meses en el Grand Line y cicatrices reales.";
  const haki = pick(available);
  character.haki[haki] = true;
  const names = { busoshoku: "Busoshoku (Armadura)", kenbunshoku: "Kenbunshoku (Observación)" };
  return ` ¡Despierta el Haki ${names[haki]}!`;
}
function resolveCombat(character, rivalType = "piratas rivales", dangerous = false, mission = false) {
  const traits = traitsOf(character);
  const cautious = traits.some((t) => ["astuto", "prudente"].includes(t));
  const hpRatio = character.stats.health / character.stats.maxHealth;
  if (cautious && hpRatio < 0.2 && !mission) {
    addLog(character, `Combate evitado: ${character.name} se repliega ante ${rivalType}.`);
    return { fled: true, wins: false };
  }
  const rivalLevel = Math.max(1, character.level + rand(dangerous ? 4 : 3) - 1 + (mission ? 1 : 0));
  const observation = character.haki.kenbunshoku;
  const armament = character.haki.busoshoku;
  const conqueror = character.haki.haoshoku && rivalLevel <= character.level + 1 && Math.random() < 0.32;
  const fruitBonus = character.fruit?.bonus ?? 0;
  const technique = character.fruit?.technique;
  const initiative = character.stats.agility * 1.2 + character.stats.ingenuity + rand(12) + (observation ? 9 : 0);
  const rivalInitiative = rivalLevel * 2 + rand(14);
  const playerFirst = initiative >= rivalInitiative || observation;
  const race = character.race || "human";
  const moonlitSulong = race === "mink" && character.world.day % 28 >= 12 && character.world.day % 28 <= 15 && character.world.minuteOfDay >= 19 * 60;
  const reachBonus = ["longlimb", "tontatta"].includes(race) ? 2 : 0;
  const attackPower = character.stats.strength + character.level * 2 + (armament ? 9 : 0) + fruitBonus + (conqueror ? 12 : 0) + reachBonus + (moonlitSulong ? 5 : 0) + rand(12);
  const rivalPower = rivalLevel * 5 + rand(14) + (dangerous ? 5 : 0);
  const wins = conqueror || attackPower + (playerFirst ? 7 : 0) >= rivalPower;
  let damage = wins ? rand(12) + (dangerous ? 4 : 1) : 12 + rand(18) + (dangerous ? 12 : 0);
  if (race === "mink" && /eléct|electr|rayo/i.test(rivalType)) damage = Math.floor(damage * 0.3);
  if (race === "tontatta" && dangerous) damage = Math.ceil(damage * 1.5);
  if (race === "buccaneer") damage = Math.ceil(damage * 0.7);
  if (race === "lunarian" && character.raceHunt?.flameActive !== false && hpRatio > 0.3) damage = Math.ceil(damage * 0.55);
  if (playerFirst) damage = Math.max(0, damage - Math.floor(character.stats.agility / 3));
  if (observation) damage = Math.max(0, damage - 5);
  if (conqueror) damage = Math.floor(damage / 2);
  character.stats.health = Math.max(0, character.stats.health - damage);
  if (character.soulCard?.latentHaki && character.haki.conquerorPotential && character.stats.health <= character.stats.maxHealth * 0.1 && /Nuevo Mundo/.test(character.location?.region || "")) {
    character.haki.haoshoku = true;
    character.soulCard.latentHaki = false;
    addLog(character, "[HAOSHOKU] Una voluntad dormida estalla ante el abismo del Nuevo Mundo.");
  }
  if (character.race === "lunarian" && character.stats.health <= character.stats.maxHealth * 0.3) character.raceHunt.flameActive = false;
  const style = [armament && "Haki de Armadura", observation && "Haki de Observación", conqueror && "Haki del Conquistador", technique && `${technique} (${character.fruit.name})`].filter(Boolean).join(" + ");
  if (wins) {
    const atGrandLine = Number(character.location?.routeIndex) >= routeFor(character.originSea).indexOf("Reverse Mountain") && routeFor(character.originSea).indexOf("Reverse Mountain") >= 0;
    if (atGrandLine) {
      character.haki.grandLineSince ??= Date.now();
      character.haki.survivalEvents += 1;
    }
    const xp = Math.round((25 + rivalLevel * 8 + (mission ? 25 : 0)) * (1 + (character.racialLearning?.talentBonus || 0)));
    const reward = addReputation(character, (mission ? 70000 : 35000) + rivalLevel * 12000, mission ? `victoria en ${character.location.island}` : `combate contra ${rivalType}`);
    gainExperience(character, xp);
    if (character.faction === "Marine") {
      character.captures += 1;
      character.berries += 30 + rivalLevel * 10 + (mission ? 100 : 0);
      updateRank(character);
    } else character.berries += 20 + rivalLevel * 15 + (mission ? 120 : 0);
    addLog(character, `⚔ Victoria contra ${rivalType} nivel ${rivalLevel}${style ? ` usando ${style}` : ""}. +${formatNum(reward)} de renombre${character.faction === "Marine" ? ` · captura ${character.captures} · rango ${character.rank}` : ""}.`);
    if (Math.random() < 0.1) character.lineage.legacyChest.push(pick(["Log Pose antiguo", "Brújula de la Grand Line", "Medalla de la Marina", "Mapa del Calm Belt"]));
  } else {
    addLog(character, `Derrota contra ${rivalType} nivel ${rivalLevel}${style ? `; intentó ${style}` : ""}. Pierde ${damage} HP${dangerous ? " en aguas peligrosas" : ""}.`);
    if (character.stats.health > 0) maybeCaptureAtAuction(character);
  }
  if (character.stats.health <= 0) checkDeath(character, `${rivalType}${dangerous ? " en aguas peligrosas" : " en batalla crítica"}`);
  return { wins, damage, rivalLevel, dead: character.status === "dead", technique: style };
}
export function confrontFugitive(character, name) {
  if (character.status === "dead" || !character.location?.atSea || name !== "Arlong") return null;
  return resolveCombat(character, name, true, false);
}
function completeMission(character) {
  const mission = character.mission;
  if (!mission || mission.status === "complete") return;
  const boss = character.world?.shared?.world?.bosses?.find((entry) => entry.name === "Arlong");
  if (mission.island === "Arlong Park" && boss && boss.status !== "active") {
    mission.status = "complete";
    mission.completed = (mission.completed || 0) + 1;
    addLog(character, "Arlong ya no controla el puerto; la expedición continúa sin enfrentarlo de nuevo.");
    return;
  }
  const rival = mission.island === "Arlong Park" ? "Arlong" : mission.enemy;
  const result = resolveCombat(character, rival, character.location.routeIndex >= 5, true);
  if (result.wins) {
    mission.status = "complete";
    mission.completed = (mission.completed || 0) + 1;
    const berries = 100 + character.location.routeIndex * 50;
    character.berries += berries;
    addLog(character, `🏴‍☠️ Misión completada en ${mission.island}: «${mission.title}». +฿${formatNum(mission.reward)} de reputación y +฿${formatNum(berries)} de provisiones.`);
    if (character.faction === "Marine") character.captures += 1;
  } else if (!result.dead) addLog(character, `La misión «${mission.title}» sigue pendiente; recupera fuerzas o vuelve a intentarlo en ${mission.island}.`);
}
function navigate(character) {
  const route = routeFor(character.originSea);
  if (character.redirectTarget) {
    const target = character.redirectTarget;
    delete character.redirectTarget;
    character.mapPosition = { x: target.x, y: target.y };
    const island = getMapIslands(character).find((place) => Math.hypot(place.x - target.x, place.y - target.y) < 2);
    if (!island) {
      character.location.atSea = true;
      return `La carabela explora mar abierto en X:${Math.round(target.x)} Y:${Math.round(target.y)}.`;
    }
    const routeIndex = route.indexOf(island.name);
    character.location.island = island.name;
    character.location.region = island.sea;
    character.location.atSea = false;
    character.location.detour = routeIndex < 0;
    if (routeIndex >= 0) {
      character.location.routeIndex = routeIndex;
      character.mission = { ...missionFor(character, routeIndex), completed: character.mission?.completed || 0 };
    }
    return `La carabela arriba a ${island.name} tras desviar su rumbo.`;
  }
  if (character.location.atSea || character.location.detour) {
    character.location.island = route[character.location.routeIndex];
    character.location.atSea = false;
    character.location.detour = false;
    const port = getMapIslands(character).find((island) => island.name === character.location.island);
    if (port) character.mapPosition = { x: port.x, y: port.y };
    return `La carabela regresa a ${character.location.island} y retoma su expedición.`;
  }
  const mission = character.mission;
  if (mission?.status === "active") {
    character.logPose.alignment += character.travel?.speedMultiplier === 0.5 ? 0.5 : 1;
    if (character.logPose.alignment < character.logPose.required) return `El Log Pose se alinea ${character.logPose.alignment}/${character.logPose.required} rumbo a ${mission.island}.`;
    character.logPose.alignment = 0;
    addLog(character, `🧭 Log Pose alineado: comienza la misión «${mission.title}» en ${mission.island}.`);
    completeMission(character);
    return `Misión en ${mission.island}: ${mission.title}.`;
  }
  if (character.location.routeIndex >= route.length - 1) return `Has llegado al final de la ruta: ${character.location.island}. El mar aguarda una nueva aventura.`;
  const next = character.location.routeIndex + 1;
  const reverseMountain = route.indexOf("Reverse Mountain");
  if (character.race === "giant" && !character.ship.reinforced && reverseMountain >= 0 && next >= reverseMountain) {
    return "La carabela no puede cruzar la Reverse Mountain sin un casco reforzado. Consíguelo en un astillero.";
  }
  character.location.routeIndex = next;
  character.location.island = route[next];
  const position = getMapIslands(character).find((island) => island.name === character.location.island);
  if (position) character.mapPosition = { x: position.x, y: position.y };
  character.location.region = next < route.indexOf("Reverse Mountain") || route.indexOf("Reverse Mountain") < 0 ? character.originSea : next <= route.indexOf("Reverse Mountain") ? "Grand Line — Reverse Mountain" : next === route.length - 1 ? "Grand Line — Nuevo Mundo" : "Grand Line — Paraíso";
  character.mission = { ...missionFor(character, next), completed: mission?.completed || 0 };
  addLog(character, `⛵ Llegada a ${character.location.island}. Nueva misión: «${character.mission.title}».`);
  if (Math.random() < 0.3) resolveCombat(character, pick(ENEMIES), next >= 5, false);
  return `Arribas a ${character.location.island}. Misión disponible: ${character.mission.title}.`;
}
function train(character) {
  if (character.stats.health < 15) return "No puede entrenar: necesita recuperarse primero.";
  character.stats.health = Math.max(1, character.stats.health - 4);
  const stat = pick(["strength", "agility", "ingenuity"]);
  character.stats[stat] += 1;
  const leveled = gainExperience(character, 35);
  let message = `Entrenamiento: ${stat} aumenta a ${character.stats[stat]}.${learnCombatTechnique(character)}`;
  if (leveled) message += ` Sube al nivel ${character.level}.`;
  updateRank(character);
  return message;
}
function searchFruit(character, availableFruitIds = []) {
  if (character.fruit) {
    const berries = 20 + rand(60);
    character.berries += berries;
    return `No encuentra otra fruta; vende provisiones por ฿${berries}.`;
  }
  if (character.location?.atSea && Math.random() < 0.0001) {
    const fruit = fruitNear(character.mapPosition, availableFruitIds);
    if (fruit) {
      character.pendingFruit = { fruitId: fruit.id, position: { x: character.mapPosition.x, y: character.mapPosition.y } };
      return "🌊 Un naufragio abisal revela una fruta extraña; su destino aún no está sellado.";
    }
  }
  const berries = 10 + rand(35);
  if (character.location?.atSea && !character.fruit) character.berries += berries;
  return `La búsqueda no descubre una Akuma no Mi; la probabilidad de naufragio es 0,01%. ${character.location?.atSea ? `Rescata ฿${berries}.` : "Las frutas solo aparecen en naufragios de alta mar."}`;
}
function rest(character) {
  const before = character.stats.health;
  const cost = Math.min(character.berries, 10);
  character.berries -= cost;
  character.stats.health = character.stats.maxHealth;
  return `Descansa en puerto y recupera ${character.stats.maxHealth - before} HP (coste: ฿${cost}).`;
}
export function performAction(character, action, { availableFruitIds } = {}) {
  if (character.status === "dead") return "El avatar está en el Panteón; crea un heredero para continuar.";
  if (character.captured) return "El avatar está cautivo; rescátalo desde el menú Más.";
  const handlers = { navigate, train, rest };
  const previousIsland = character.location?.island;
  const previousAtSea = Boolean(character.location?.atSea);
  const message = action === "searchFruit"
    ? searchFruit(character, availableFruitIds)
    : handlers[action] ? handlers[action](character) : "Acción desconocida.";
  addLog(character, message);
  if (action === "navigate") {
    const arrived = !character.location.atSea && (previousIsland !== character.location.island || previousAtSea);
    if (character.status !== "dead" && (arrived || character.location.atSea)) {
      const encounter = seaEncounter(character);
      if (encounter?.dead) checkDeath(character, encounter.enemy);
    }
    if (character.status !== "dead") {
      discoverAtSea(character);
      discoverAncient(character);
    }
    resolvePortSuggestions(character, previousIsland);
    if (arrived) resolvePortContracts(character, previousIsland);
    if (arrived) updateCrewLoyalty(character, true);
  }
  advanceAdvancedSystems(character, { action, previousIsland });
  if (character.stats.health <= 0) checkDeath(character, "ahogamiento por Akuma no Mi");
  return message;
}
function factionEvent(character) {
  const events = [
    "⚓ Evento de facción: una patrulla Marine bloquea a los piratas en la ruta; los Cazarrecompensas siguen el conflicto.",
    "☠ Evento de facción: piratas rivales atacan un puesto de la Marina; el incidente aparece en los periódicos.",
    "💰 Evento de facción: Cazarrecompensas aceptan el contrato de un capitán buscado.",
    "🗞 Evento de facción: la Marina y los piratas disputan el control del puerto; los civiles piden ayuda."
  ];
  const event = pick(events);
  character.world.news.unshift({ day: character.world.day, era: character.world.era, text: event });
  character.world.news = character.world.news.slice(0, 30);
  addLog(character, event);
  if (character.faction === "Marine" && Math.random() < 0.4) { character.captures += 1; character.berries += 25; updateRank(character); }
  else if (character.faction === "Pirata" && Math.random() < 0.35) addReputation(character, 15000, "incidente entre facciones");
}
export function resolveBranch(character, choice, source = "jugador") {
  const branch = character.autonomy?.pendingBranch;
  if (!branch || !["help", "pass"].includes(choice) || character.status === "dead") return false;
  delete character.autonomy.pendingBranch;
  if (choice === "help") {
    const cost = Math.min(1, character.inventory.water);
    character.inventory.water -= cost;
    addLog(character, `📓 ${source === "jugador" ? "Tu decisión" : "Su instinto"}: ${character.name} comparte ${cost} ración de agua con unos náufragos.`);
  } else addLog(character, `📓 ${source === "jugador" ? "Tu decisión" : "Su instinto"}: ${character.name} mantiene el rumbo y reserva sus provisiones.`);
  return true;
}
export function resolveAutonomousBranch(character) {
  const traits = traitsOf(character);
  const help = traits.some((trait) => ["leal", "honrado", "valiente"].includes(trait)) && character.inventory.water > 0;
  return resolveBranch(character, help ? "help" : "pass", "avatar");
}
export function autonomousTick(character, { interactive = false, now = Date.now(), availableFruitIds } = {}) {
  if (character.status === "dead" || character.autonomy.paused || character.captured) return null;
  character.autonomy.tickCount += 1;
  character.world.minuteOfDay = (Number(character.world.minuteOfDay) || 0) + 5;
  const newDay = character.world.minuteOfDay >= 1440;
  if (newDay) { character.world.minuteOfDay -= 1440; character.world.day = (Number(character.world.day) || 0) + 1; }
  character.world.year = Math.floor(character.world.day / 365) + 1;
  character.world.era = ERAS[Math.min(Math.floor((character.world.year - 1) / 5), ERAS.length - 1)];
  const news = (newDay && character.world.day % 7 === 0) || Math.random() < 0.06 ? `Día ${character.world.day}, ${character.world.era}: ${pick(WORLD_NEWS)}` : null;
  if (news) { character.world.news.unshift({ day: character.world.day, era: character.world.era, text: news }); character.world.news = character.world.news.slice(0, 30); addLog(character, `🗞 ${news}`); }
  if (character.autonomy.tickCount % 3 === 0 && Math.random() < 0.55) factionEvent(character);
  const action = decideAction(character);
  addLog(character, `Decisión autónoma: ${({ navigate: "navegar y cumplir misión", train: "entrenar", searchFruit: "buscar fruta/tesoro", rest: "descansar" })[action]}.`);
  const message = performAction(character, action, { availableFruitIds });
  if (character.status !== "dead" && character.crew?.length && Math.random() < 0.12) {
    const member = pick(character.crew);
    const change = character.nauticalStress?.value > 70 ? -2 : 1;
    member.loyalty = clamp((Number(member.loyalty) || 0) + change, 0, 100);
    addLog(character, `📓 ${member.name} ${change < 0 ? "se inquieta por la tensión a bordo" : "comparte una guardia tranquila"}; lealtad ${member.loyalty}%.`);
  }
  if (character.status !== "dead" && !character.autonomy.pendingBranch && Math.random() < 0.025) {
    character.autonomy.pendingBranch = { kind: "castaways", deadline: now + 60_000 };
    addLog(character, "📓 Una señal de náufragos aparece en el horizonte.");
    if (!interactive) resolveAutonomousBranch(character);
  }
  if (character.status !== "dead" && Math.random() < 0.12) addReputation(character, 1000, "rumores en el periódico");
  return { action, message };
}
export function simulateOffline(character, now = Date.now(), observer) {
  const saved = Number(character.autonomy?.lastPulseAt ?? character.autonomy?.lastSavedAt);
  if (!Number.isFinite(saved) || saved <= 0 || character.autonomy?.paused || character.status === "dead" || character.captured) return { ticks: 0, capped: false };
  const elapsed = Math.max(0, now - saved);
  if (character.autonomy.pendingBranch && (!observer?.interactive || character.autonomy.pendingBranch.deadline <= now)) resolveAutonomousBranch(character);
  const maxElapsed = 8 * 60 * 60 * 1000;
  const ticks = Math.floor(Math.min(elapsed, maxElapsed) / PULSE_MS);
  let completed = 0;
  while (completed < ticks && character.status !== "dead") {
    const before = observer?.before?.(character);
    autonomousTick(character, { interactive: Boolean(observer?.interactive && completed === ticks - 1), now, availableFruitIds: observer?.availableFruitIds });
    observer?.after?.(before, character);
    completed += 1;
  }
  character.autonomy.lastPulseAt = elapsed > maxElapsed ? now : saved + ticks * PULSE_MS;
  if (completed && !observer?.interactive) addLog(character, `⏳ Simulación fuera de línea: ${completed} ciclos${elapsed > maxElapsed ? " (límite: 8 horas)" : ""}.`);
  return { ticks: completed, capped: elapsed > maxElapsed };
}
function decideAction(character) {
  const hp = character.stats.health / character.stats.maxHealth;
  if (hp < 0.3) return "rest";
  const dream = (character.soulCard?.dream || "Libertad").toLowerCase();
  const traits = traitsOf(character);
  const weights = { navigate: 3, train: 1.4, searchFruit: 1.1, rest: hp < 0.5 ? 2 : 0.3 };
  if (dream.includes("poder")) weights.train += 2;
  if (dream.includes("riqueza")) weights.searchFruit += 2;
  if (dream.includes("libertad") || dream.includes("fama") || dream.includes("lazos")) weights.navigate += 2;
  if (traits.includes("astuto")) weights.searchFruit += 1;
  const pool = Object.entries(weights).flatMap(([key, weight]) => Array(Math.max(1, Math.round(weight * 10))).fill(key));
  return pick(pool);
}
function parseWhisper(text) {
  const phrase = text.toLocaleLowerCase("es");
  if (/descans|dorm|recuper|cur|puerto|huir|escap/.test(phrase)) return "rest";
  if (/entren|haki|fuerza|combate|pelea|luchar|poder/.test(phrase)) return "train";
  if (/fruta|akuma|tesoro|riqueza|berries|dinero|buscar/.test(phrase)) return "searchFruit";
  if (/explor|naveg|viaj|zarpar|aventur|libertad|rumbo|grand line|misión|isla/.test(phrase)) return "navigate";
  return null;
}
export function sendWhisper(character, text) {
  if (character.status === "dead") return { obeyed: false, action: null };
  const phrase = String(text).trim().slice(0, 160);
  const action = parseWhisper(phrase);
  if (!action) { addLog(character, `El susurro «${phrase}» no fue comprendido.`); return { obeyed: false, action: null }; }
  const dream = character.soulCard.dream.toLowerCase();
  const traits = traitsOf(character);
  const aligned = (action === "navigate" && ["libertad", "fama", "conocimiento", "lazos"].some((d) => dream.includes(d))) || (action === "train" && dream.includes("poder")) || (action === "searchFruit" && dream.includes("riqueza")) || (action === "rest" && traits.includes("prudente"));
  const against = (action === "rest" && (traits.includes("valiente") || traits.includes("agresivo"))) || (action === "train" && traits.includes("prudente") && character.stats.health < 40) || traits.includes("rebelde");
  if (aligned) { character.whisper.affinity = clamp(character.whisper.affinity + 5, 0, 100); character.whisper.rebellion = clamp(character.whisper.rebellion - 4, 0, 100); }
  if (against) { character.whisper.affinity = clamp(character.whisper.affinity - 5, 0, 100); character.whisper.rebellion = clamp(character.whisper.rebellion + 7, 0, 100); }
  const chance = clamp(character.whisper.affinity + (aligned ? 15 : 0) - (against ? 25 : 0), 5, 98);
  if (Math.random() * 100 < chance) {
    addLog(character, `El avatar acepta el susurro «${phrase}» (sintonía ${chance}%).`);
    performAction(character, action);
    return { obeyed: true, action, chance };
  }
  character.whisper.affinity = clamp(character.whisper.affinity - 2, 0, 100);
  character.whisper.rebellion = clamp(character.whisper.rebellion + 3, 0, 100);
  addLog(character, `Rebeldía: ignora «${phrase}» y sigue su carácter (sintonía ${chance}%).`);
  return { obeyed: false, action, chance };
}
export function setAutonomyPaused(character, paused) {
  const now = Date.now();
  const wasPaused = character.autonomy.paused;
  character.autonomy.paused = Boolean(paused);
  character.autonomy.mode = character.autonomy.paused ? "paused" : "active";
  if (!wasPaused && character.autonomy.paused) character.autonomy.pulseRemainder = clamp(now - (character.autonomy.lastPulseAt ?? now), 0, PULSE_MS - 1);
  if (wasPaused && !character.autonomy.paused) {
    character.autonomy.lastPulseAt = now - (character.autonomy.pulseRemainder || 0);
    delete character.autonomy.pulseRemainder;
  }
  addLog(character, character.autonomy.paused ? "El avatar pone el mundo en pausa." : "El avatar reanuda su camino.");
}
export function createHeir(predecessor, { name, username } = {}) {
  if (predecessor.status !== "dead") return null;
  const family = predecessor.lineage.family || predecessor.name;
  const first = pick(TRAITS);
  const second = pick(TRAITS.filter((trait) => trait !== first));
  const heirRace = rollLineageRace(predecessor.race);
  const heir = createCharacter({ name: name || `Heredero de ${family}`, username: username || `@linaje${predecessor.lineage.generation + 1}`, faction: predecessor.faction, race: heirRace, allowRareRace: true, dream: predecessor.soulCard.dream, alignment: predecessor.soulCard.alignment, traits: [first, second], appearance: predecessor.appearance });
  heir.lineage = { family, generation: predecessor.lineage.generation + 1, inheritedFrom: predecessor.id, legacyChest: [...predecessor.lineage.legacyChest], inheritedReputation: Math.floor((predecessor.reputation || predecessor.bounty || 0) * 0.3) };
  const ancestralTraits = [...predecessor.soulCard.traits.pros, ...predecessor.soulCard.traits.cons, predecessor.soulCard.latentTrait].filter((trait) => trait && !heir.soulCard.traits.pros.includes(trait));
  if (ancestralTraits.length && Math.random() < 0.15) heir.soulCard.latentTrait = pick(ancestralTraits);
  heir.world = predecessor.world;
  heir.systems = { testament: predecessor.systems?.testament ?? null, treasureMaps: [...(predecessor.systems?.treasureMaps ?? [])], discoveries: [...(predecessor.systems?.discoveries ?? [])], dangerMapCreated: false };
  heir.ancientLanguage = structuredClone(ensureAncientLanguage(predecessor));
  heir.crew = [...(predecessor.crew ?? [])];
  heir.log = [...predecessor.log.slice(0, 25)];
  addLog(heir, `El linaje ${family} continúa: ${heir.name} hereda ${heir.lineage.legacyChest.length} reliquias; los puertos recuerdan a sus antepasados.`);
  return heir;
}
