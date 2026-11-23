import { advanceAdvancedSystems, discoverAtSea, draftTestament, generateTreasureMap, hasNauticalCrew, updateCrewLoyalty } from "./systems.js";
import { governmentPulse } from "./world_government.js";
import { resolvePortContracts, resolvePortSuggestions } from "./block1.js";
import { seaEncounter } from "./combat_economy.js";
import { createScenePosition, getMapIslands } from "./map.js";
import { discoverAncient, ensureAncientLanguage } from "./ancient_language.js";
import { inferLatentTrait } from "./character_creation.js";
import { ensureArchaeologyData, exploreLocalArchaeology } from "./archaeology_system.js";
import { cargoCapacity, isRacePursued, normalizeRace, raceStats, rollLineageRace } from "./race_system.js";
import { createHakiProfile, ensureHakiProfile, fruitNear } from "./power_systems.js";
import { maybeCaptureAtAuction } from "./politics.js";
import missionData from "./data/missions_data.json" with { type: "json" };
import { PULSE_MS, STORAGE_KEYS } from "./config.js";
import { ensurePoliticalStance } from "./lore_engine.js";
import { readStorage, writeJSON } from "./storage_adapter.js";
import { advanceClock, MINUTES_PER_PULSE } from "./time_engine.js";
import { advanceIslandStory, beginIslandCrisis } from "./narrative_engine.js";
import { advanceGM, awardBerries } from "./gm_engine.js";
import {
  chooseAutonomousAction, ensurePsyche, evaluateWhisper, recordActionOutcome,
  resolveLocalActivity, resolvePortDilemma, writeDailyReflection
} from "./ai_engine.js";

const ERAS = [
  "Era de los Grandes Descubrimientos",
  "Era de las Banderas Rotas",
  "Era de la Nueva Generación",
  "Era del Horizonte Final"
];
const { worldNews: WORLD_NEWS, routes: ROUTES, missionNames: MISSION_NAMES, enemies: ENEMIES } = missionData;
const TRAITS = ["Valiente", "Astuto", "Impulsivo", "Prudente", "Agresivo", "Honrado", "Rebelde", "Leal", "Curioso", "Sereno", "Feroz", "Noble"];
// Oficios canon: el avatar zarpa como Grumete y el mar revela su oficio por lo que HACE
const OFICIOS = ["Grumete", "Navegante", "Cocinero", "Médico", "Arqueólogo", "Arqueóloga", "Carpintero", "Artillero", "Timonel", "Vigía", "Cartógrafo", "Herrero", "Músico", "Cazarecompensas", "Espadachín"];
// señales de oficio: venue/acción → oficio que se moldea
const SENALES_OFICIO = {
  kitchen: "Cocinero", restaurant: "Cocinero", shipyard: "Carpintero", hospital: "Médico", clinic: "Médico",
  poneglyph: "Arqueólogo", library: "Arqueólogo", dojo: "Espadachín", weapon_shop: "Herrero", forge: "Herrero",
  dock: "Timonel", tower: "Vigía", lookout: "Vigía", music: "Músico", instrument: "Músico",
  navigate: "Navegante", chart: "Cartógrafo", hunt: "Cazarecompensas"
};
const UMBALES_OFICIO = 10; // señales acumuladas para que el mar revele el oficio
function registrarSenalOficio(character, key) {
  if (!character || character.status === "dead" || character.profession !== "Grumete") return;
  const oficio = SENALES_OFICIO[key];
  if (!oficio) return;
  character.profSignals ??= {};
  character.profSignals[oficio] = (character.profSignals[oficio] || 0) + 1;
  if (character.profSignals[oficio] >= UMBALES_OFICIO) {
    character.profession = oficio;
    addLog(character, `✨ El mar ha encontrado tu oficio: ${oficio.toUpperCase()}. Lo descubrió en vos, no en un papel.`);
  }
}
export { PULSE_MS };
export const SAVE_KEY = STORAGE_KEYS.save;
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

export function createCharacter({ name, username = "@usuario", faction = "Pirata", originSea, race = "human", profession = "Grumete", allowRareRace = false, starterChallenge = false, dream = "Libertad", alignment = "Libertad", story = "", traits = [], trait, appearance = {} }) {
  const displayName = String(name || "Aventurero").trim().slice(0, 24);
  const backstory = String(story).trim().slice(0, 280);
  const chosenTraits = traits.length ? traits.slice(0, 2) : [trait || "Valiente"];
  const randomTraits = TRAITS.filter((entry) => !chosenTraits.includes(entry));
  originSea = ROUTES[originSea] ? originSea : pick(Object.keys(ROUTES));
  const normalizedFaction = faction === "Marina" ? "Marine" : faction;
  const species = normalizeRace(race, { allowRare: allowRareRace });
  const racial = raceStats(species);
  const family = displayName.split(/\s+/).at(-1) || displayName;
  const route = routeFor(originSea);
  const spawn = getMapIslands({}).find((island) => island.name === route[0]);
  const avatarConfig = {
    skin: appearance.skin || "Clara", hair: appearance.hair || "Negro",
    accessory: appearance.accessory || "Ninguno", eyes: appearance.eyes || "Marrón",
    outfit: appearance.outfit || "chaleco-sol", outfitColor: appearance.outfitColor || "", detail: appearance.detail || "Ninguno",
    coat: appearance.coat || "Ninguno"
  };
  const character = {
    version: 3,
    id: globalThis.crypto?.randomUUID?.() ?? `captain-${Date.now()}`,
    name: displayName,
    username: String(username).startsWith("@") ? String(username).slice(0, 17) : `@${String(username).slice(0, 16)}`,
    story: backstory,
    faction: normalizedFaction,
    starterChallenge: Boolean(starterChallenge),
    originSea,
    appearance: { ...avatarConfig },
    avatarConfig,
    avatarActivity: "idle",
    location: { region: originSea, island: route[0], routeIndex: 0, scenePosition: createScenePosition(spawn?.id || route[0], displayName) },
    mapPosition: spawn ? { x: spawn.x, y: spawn.y } : undefined,
    logPose: { alignment: 0, required: 3 },
    mission: { ...missionFor({ originSea, location: { routeIndex: 0 } }), completed: 0 },
    fruit: null,
    haki: createHakiProfile(false),
    bounty: species === "lunarian" ? 500_000 : 0,
    reputation: species === "lunarian" ? 500_000 : 0,
    berries: 100,
    captures: 0,
    rank: normalizedFaction === "Marine" ? "Recluta" : "Novato",
    level: 1,
    experience: 0,
    stats: { health: 100 + racial.health, maxHealth: 100 + racial.health, strength: 5 + racial.strength, agility: Math.max(1, 5 + racial.agility), ingenuity: 5 },
    race: species,
    profession: OFICIOS.includes(profession) ? profession : "Grumete", // el oficio se REVELA viviendo, no eligiendo
    soulCard: { dream, alignment: ["Poder", "Justicia", "Libertad", "Caos"].includes(alignment) ? alignment : "Libertad", traits: { pros: chosenTraits, cons: [] }, latentTrait: inferLatentTrait(backstory) || pick(randomTraits), latentHaki: false, hiddenTalent: pick(["Cartografía", "Instinto de Tormenta", "Oído Antiguo"]) },
    lineage: { family, generation: 1, inheritedFrom: null, legacyChest: [], inheritedReputation: 0 },
    autonomy: { mode: "active", paused: false, tickCount: 0 },
    whisper: { affinity: 55, rebellion: 45 },
    world: { day: 0, minuteOfDay: 0, year: 1, era: ERAS[0], news: [], pantheon: [] },
    ship: { health: 100, maxHealth: 100, reinforced: species !== "giant", acquired: !starterChallenge },
    raceHunt: { exposed: isRacePursued(species), alertLevel: species === "lunarian" ? "active" : "latent" },
    racialLearning: { talentBonus: species === "human" ? 0.1 : 0 },
    status: "alive",
    log: [{ time: new Date().toISOString(), message: `¡${displayName} (${username}) inicia su aventura en ${route[0]}, ${originSea}! Sueño: ${dream}.` }]
  };
  ensurePsyche(character);
  ensureArchaeologyData(character);
  return character;
}

function normalize(character) {
  if (!character || !character.stats) return null;
  character.version = 3;
  const avatar = { ...(character.appearance || {}), ...(character.avatarConfig || {}) };
  character.avatarConfig = {
    skin: avatar.skin || "Clara", hair: avatar.hair || "Negro",
    accessory: avatar.accessory || "Ninguno", eyes: avatar.eyes || "Marrón",
    outfit: avatar.outfit || "chaleco-sol", outfitColor: avatar.outfitColor || "", detail: avatar.detail || "Ninguno",
    coat: avatar.coat || "Ninguno"
  };
  character.appearance = { ...character.avatarConfig };
  character.avatarActivity ??= "idle";
  character.starterChallenge ??= false;
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
  character.haki = ensureHakiProfile(character.haki);
  character.race = normalizeRace(character.race, { allowRare: true });
  if (!OFICIOS.includes(character.profession)) character.profession = "Grumete";
  character.raceHunt ??= { exposed: isRacePursued(character.race), alertLevel: character.race === "lunarian" ? "active" : "latent" };
  character.racialLearning ??= { talentBonus: character.race === "human" ? 0.1 : 0 };
  character.ship ??= { health: 100, maxHealth: 100, reinforced: character.race !== "giant" };
  character.ship.reinforced ??= character.race !== "giant";
  character.ship.acquired ??= true;
  character.fruit ??= null;
  if (character.fruit) {
    character.fruit.swimming = false;
    character.fruit.masteryLevel = clamp(Number(character.fruit.masteryLevel) || 1, 1, 5);
    character.fruit.masteryPoints = character.fruit.masteryLevel >= 5
      ? 0
      : clamp(Number(character.fruit.masteryPoints) || 0, 0, 2);
  }
  character.originSea ??= "East Blue";
  const route = routeFor(character.originSea);
  character.location ??= { region: character.originSea, island: route[0], routeIndex: 0 };
  character.location.routeIndex = clamp(Number(character.location.routeIndex) || 0, 0, route.length - 1);
  if (!character.location.detour) character.location.island = route[character.location.routeIndex] ?? character.location.island ?? route[0];
  if (!character.location.atSea) {
    const island = getMapIslands(character).find((entry) => entry.name === character.location.island);
    character.location.scenePosition ??= createScenePosition(island?.id || character.location.island, character.id);
  }
  character.logPose ??= { alignment: 0, required: 3 };
  character.logPose.required = Math.max(1, Number(character.logPose.required) || 3);
  character.logPose.alignment = clamp(Number(character.logPose.alignment) || 0, 0, character.logPose.required - 1);
  character.mission ??= { ...missionFor(character), completed: 0 };
  character.mission.completed = Number(character.mission.completed) || 0;
  ensureArchaeologyData(character);
  character.mission.island = character.location.island;
  character.mission.status ??= "active";
  character.lineage ??= { family: character.name, generation: 1, inheritedFrom: null, legacyChest: [], inheritedReputation: 0 };
  character.lineage.legacyChest ??= [];
  character.world ??= { day: 0, year: 1, era: ERAS[0], news: [], pantheon: [] };
  character.world.news ??= [];
  character.world.pantheon ??= [];
  character.world.day ??= 0;
  character.world.minuteOfDay ??= (character.autonomy.tickCount * MINUTES_PER_PULSE) % 1440;
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
  ensurePsyche(character);
  return character;
}
export function loadGame() {
  try { const raw = readStorage(SAVE_KEY); return raw ? normalize(JSON.parse(raw)) : null; }
  catch (error) { console.warn("[storage] Guardado ilegible, se empieza de cero:", error?.name || error); return null; }
}
export function saveGame(character) {
  try { character.autonomy.lastSavedAt = Date.now(); character.autonomy.lastPulseAt ??= character.autonomy.lastSavedAt; return writeJSON(SAVE_KEY, character); }
  catch (error) { console.warn("[storage] No se pudo guardar la partida:", error?.name || error); return false; }
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
    if (Math.floor(oldBounty / 100000) < Math.floor(character.bounty / 100000)) {
      addLog(character, `📜 ¡Nuevo cartel SE BUSCA! La recompensa de ${character.name} sube a ฿${formatNum(character.bounty)} por ${reason}.`);
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("onepiece:hud-wanted", { detail: { bounty: character.bounty } }));
    }
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
  const resonance = Number(character.haki.resonance) || 0;
  // Causa y efecto del poder: cada batalla al límite afila la voluntad
  // (resonancia) y baja el umbral de cicatrices que exige el Haki.
  const requiredScars = Math.max(3, 5 - Math.floor(resonance / 2));
  const available = ["busoshoku", "kenbunshoku"].filter((key) => !character.haki[key]);
  const chance = 0.1 * (resonance >= 3 ? 2 : 1);
  if (!matured || character.haki.survivalEvents < requiredScars || !available.length || Math.random() > chance) {
    return ` El Haki exige meses en el Grand Line y cicatrices reales (resonancia ${resonance}).`;
  }
  const haki = pick(available);
  character.haki[haki] = true;
  const names = { busoshoku: "Busoshoku (Armadura)", kenbunshoku: "Kenbunshoku (Observación)" };
  return ` ¡Despierta el Haki ${names[haki]}! ${resonance >= 3 ? "Las batallas vividas reverberan en su voluntad." : ""}`.trimEnd();
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
  const route = routeFor(character.originSea);
  const reverseMountain = route.indexOf("Reverse Mountain");
  const atGrandLine = reverseMountain >= 0 && Number(character.location?.routeIndex) >= reverseMountain;
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
  if (character.fruit && character.stats.health > 0 && hpRatio <= 0.2) {
    const fruit = character.fruit;
    fruit.masteryLevel = Math.max(1, Number(fruit.masteryLevel) || 1);
    fruit.masteryPoints = Math.max(0, Number(fruit.masteryPoints) || 0) + 1;
    if (fruit.masteryPoints >= 2 && fruit.masteryLevel < 5) {
      fruit.masteryPoints -= 2;
      fruit.masteryLevel += 1;
      fruit.bonus = (Number(fruit.bonus) || 0) + 2;
      addLog(character, `🍈 ${fruit.name} alcanza maestría ${fruit.masteryLevel}; su poder de combate aumenta.`);
    } else if (fruit.masteryLevel >= 5) {
      fruit.masteryPoints = 0;
      addLog(character, `🍈 ${fruit.name} ya domina su potencial; la batalla al límite no puede elevar más su maestría.`);
    } else {
      addLog(character, `🍈 Sobrevivir al límite fortalece el vínculo con ${fruit.name} (+1 punto de maestría).`);
    }
  }
  if (dangerous && atGrandLine && character.stats.health > 0 &&
      character.stats.health <= character.stats.maxHealth * 0.1 && !character.haki.haoshoku) {
    character.haki.haoshoku = true;
    character.soulCard.latentHaki = false;
    addLog(character, "[HAOSHOKU] Tras sobrevivir al límite en la Grand Line, su voluntad despierta el Haki del Conquistador.");
  }
  if (character.race === "lunarian" && character.stats.health <= character.stats.maxHealth * 0.3) character.raceHunt.flameActive = false;
  const style = [armament && "Haki de Armadura", observation && "Haki de Observación", conqueror && "Haki del Conquistador", technique && `${technique} (${character.fruit.name})`].filter(Boolean).join(" + ");
  if (wins) {
    if (atGrandLine) {
      character.haki.grandLineSince ??= Date.now();
      character.haki.survivalEvents += 1;
      // La resonancia de la voluntad: vencer batallas peligrosas en la Grand
      // Line afila el Haki futuro (efecto visible en el entrenamiento).
      character.haki.resonance = (Number(character.haki.resonance) || 0) + (dangerous ? 2 : 1);
    }
    const xp = Math.round((25 + rivalLevel * 8 + (mission ? 25 : 0)) * (1 + (character.racialLearning?.talentBonus || 0)));
    const reward = addReputation(character, (mission ? 70000 : 35000) + rivalLevel * 12000, mission ? `victoria en ${character.location.island}` : `combate contra ${rivalType}`);
    gainExperience(character, xp);
    if (character.faction === "Marine") {
      character.captures += 1;
      awardBerries(character, 30 + rivalLevel * 10 + (mission ? 100 : 0));
      updateRank(character);
    } else awardBerries(character, 20 + rivalLevel * 15 + (mission ? 120 : 0));
    addLog(character, `⚔ Victoria contra ${rivalType} nivel ${rivalLevel}${style ? ` usando ${style}` : ""}. +${formatNum(reward)} de renombre${character.faction === "Marine" ? ` · captura ${character.captures} · rango ${character.rank}` : ""}.`);
    if (Math.random() < 0.1) character.lineage.legacyChest.push(pick(["Log Pose antiguo", "Brújula de la Grand Line", "Medalla de la Marina", "Mapa del Calm Belt"]));
  } else {
    addLog(character, `Derrota contra ${rivalType} nivel ${rivalLevel}${style ? `; intentó ${style}` : ""}. Pierde ${damage} HP${dangerous ? " en aguas peligrosas" : ""}.`);
    if (character.stats.health > 0) maybeCaptureAtAuction(character);
  }
  if (character.stats.health <= 0) checkDeath(character, `${rivalType}${dangerous ? " en aguas peligrosas" : " en batalla crítica"}`);
  recordActionOutcome(character, "combat", { wins });
  return { wins, damage, rivalLevel, dead: character.status === "dead", technique: style };
}
export function confrontFugitive(character, name) {
  const boss = character.world?.shared?.world?.bosses?.find((entry) => entry.name === name && entry.status === "fugitive");
  if (character.status === "dead" || !character.location?.atSea || !boss) return null;
  const result = resolveCombat(character, name, true, false);
  if (result.wins) {
    const reward = Math.max(0, Number(boss.reward) || 0);
    const earned = awardBerries(character, reward);
    character.captures = (Number(character.captures) || 0) + 1;
    addLog(character, `⚓ ${name} vuelve a presidio. Recompensa de recaptura: ฿${formatNum(earned)}.`);
  }
  return result;
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
    const earned = awardBerries(character, berries);
    addLog(character, `🏴‍☠️ Misión completada en ${mission.island}: «${mission.title}». +฿${formatNum(mission.reward)} de reputación y +฿${formatNum(earned)} de provisiones.`);
    if (character.faction === "Marine") character.captures += 1;
  } else if (!result.dead) addLog(character, `La misión «${mission.title}» sigue pendiente; recupera fuerzas o vuelve a intentarlo en ${mission.island}.`);
}
// el mar no exige papeles: zarpar sin navegante está permitido, pero el mar
// cobra caro la improvisación (deriva, casco, hambre). Esto se aplica a CUALQUIER
// zarpe: el del botón "Sugerir zarpar" y el autónomo por igual.
function applySailRisks(character, random = Math.random) {
  const conNavegante = hasNauticalCrew(character);
  const provisions = Number(character.inventory?.provisions) || 0;
  if (!conNavegante && random() < 0.3) {
    character.nauticalStress ??= { value: 15 };
    character.nauticalStress.value = clamp(character.nauticalStress.value + 12, 0, 100);
    addLog(character, `🌊 Deriva: sin Navegante ni Carpintero a bordo, la corriente arrastra la ${character.ship?.model || "carabela"} y el rumbo se pierde un día entero.`);
    return { drifted: true };
  }
  if (Number(character.ship?.health) < 40 && random() < 0.35) {
    const damage = 8 + rand(9);
    character.ship.health = Math.max(1, character.ship.health - damage);
    addLog(character, `🪵 El casco castigado (${character.ship.health}% antes) cede en alta mar: -$${damage} de integridad. Reparar en un astillero cuesta menos que hundirse.`);
  }
  if (provisions < 1) {
    const hambre = 8 + rand(5);
    character.stats.health = Math.max(1, character.stats.health - hambre);
    addLog(character, `🍖 Sin provisiones a bordo: ${character.name} zarpa con el estómago vacío (-${hambre} HP). Comprar comida en el puerto era más barato que la hambre.`);
  }
  return { drifted: false };
}
// la Red Line no se negocia: los Cuatro Blues perdonan la improvisación, la
// Grand Line no. Requisitos de verdad, no un número de nivel:
//  1) un navegante a bordo (nadie lee la montaña inversa a ojo)
//  2) un barco preparado: casco reforzado o integridad sana — la montaña
//     inversa parte cascos rendidos, por mucho nivel que lleves
function redLineGate(character) {
  const route = routeFor(character.originSea);
  const next = (Number(character.location?.routeIndex) || 0) + 1;
  const reverseMountain = route.indexOf("Reverse Mountain");
  if (reverseMountain < 0 || next < reverseMountain) return null; // los Blues: el mar perdona
  // ir HACIA la Reverse Mountain ya es la travesía: los requisitos aplican antes
  const navegante = (character.crew || []).some((member) => member.role === "Navegante");
  if (!navegante) {
    return "Para cruzar la Reverse Mountain hace falta un navegante: es la preparación mínima de la Grand Line. Recluta al menos uno antes de zarpar.";
  }
  const casco = Number(character.ship?.health) || 0;
  if (character.race === "giant" && !character.ship?.reinforced) {
    return "Un gigante parte el casco viejo contra la montaña inversa: refuérzalo en un astillero. Esa preparación no se salta.";
  }
  if (casco < 60 && !character.ship?.reinforced) {
    return `El casco no aguanta la Reverse Mountain (${casco}% de integridad): repara o refuerza en un astillero. La preparación del barco vale más que cualquier nivel.`;
  }
  return null;
}
function navigate(character, random = Math.random) {
  if (!character.ship?.acquired) return "No puedes zarpar sin conseguir primero un barco en el astillero.";
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
    character.location.scenePosition = createScenePosition(island.id, character.id);
    return `La carabela arriba a ${island.name} tras desviar su rumbo.`;
  }
  if (character.location.atSea || character.location.detour) {
    character.location.island = route[character.location.routeIndex];
    character.location.atSea = false;
    character.location.detour = false;
    const port = getMapIslands(character).find((island) => island.name === character.location.island);
    if (port) {
      character.mapPosition = { x: port.x, y: port.y };
      character.location.scenePosition = createScenePosition(port.id, character.id);
    }
    return `La carabela regresa a ${character.location.island} y retoma su expedición.`;
  }
  // la preparación náutica se exigió antes de soltar amarras (redLineGate):
  // aquí solo queda alinear el Log Pose y avanzar la ruta
  if (character.location.routeIndex >= route.length - 1) return `Has llegado al final de la ruta: ${character.location.island}. El mar aguarda una nueva aventura.`;
  const next = character.location.routeIndex + 1;
  const mission = character.mission;
  if (mission?.status === "active") {
    character.logPose.alignment += character.travel?.speedMultiplier === 0.5 ? 0.5 : 1;
    if (character.logPose.alignment < character.logPose.required) return `El Log Pose se alinea ${character.logPose.alignment}/${character.logPose.required} rumbo a ${mission.island}.`;
    character.logPose.alignment = 0;
    addLog(character, `🧭 Log Pose alineado: comienza la misión «${mission.title}» en ${mission.island}.`);
    completeMission(character);
    return `Misión en ${mission.island}: ${mission.title}.`;
  }
  character.location.routeIndex = next;
  character.location.island = route[next];
  const position = getMapIslands(character).find((island) => island.name === character.location.island);
  if (position) {
    character.mapPosition = { x: position.x, y: position.y };
    character.location.scenePosition = createScenePosition(position.id, character.id);
  }
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
    const earned = awardBerries(character, berries);
    return `No encuentra otra fruta; vende provisiones por ฿${earned}.`;
  }
  if (character.location?.atSea && Math.random() < 0.0001) {
    const fruit = fruitNear(character.mapPosition, availableFruitIds);
    if (fruit) {
      character.pendingFruit = { fruitId: fruit.id, position: { x: character.mapPosition.x, y: character.mapPosition.y } };
      return "🌊 Un naufragio abisal revela una fruta extraña; su destino aún no está sellado.";
    }
  }
  const berries = 10 + rand(35);
  const earned = character.location?.atSea && !character.fruit ? awardBerries(character, berries) : 0;
  return `La búsqueda no descubre una Akuma no Mi; la probabilidad de naufragio es 0,01%. ${character.location?.atSea ? `Rescata ฿${earned}.` : "Las frutas solo aparecen en naufragios de alta mar."}`;
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
  recordActionOutcome(character, action);
  // zarpar desde puerto: el mar evalúa la preparación ANTES de soltar amarras.
  if (action === "navigate" && !previousAtSea && character.ship?.acquired) {
    // gates que anteceden a la deriva: la Red Line no negocia, y el starter sin
    // tripulación náutica tampoco suelta el muelle (deterministas, no de azar)
    const gate = redLineGate(character)
      || (character.starterChallenge && !hasNauticalCrew(character) ? "El mar no perdona la improvisación: antes de zarpar hay que reclutar al menos un navegante o carpintero." : null);
    if (gate) return gate;
    const risks = applySailRisks(character);
    if (risks.drifted) {
      character.location.atSea = true;
      // la orden de zarpe PERMANECE: el mar ordenó zarpar y no desiste por una corriente;
      // el redirectTarget conservado le da el rumbo para reintentarlo en el próximo latido
      character.avatarActivity = "navigating";
      advanceAdvancedSystems(character, { action, previousIsland });
      const message = "Día de deriva en mar abierto: la corriente manda.";
      addLog(character, message);
      return message;
    }
    delete character.sailOrder; // el zarpe se ejecutó: la orden queda saldada
  }
  const message = action === "searchFruit"
    ? searchFruit(character, availableFruitIds)
    : handlers[action] ? handlers[action](character) : "Acción desconocida.";
  addLog(character, message);
  character.avatarActivity = action === "rest" ? "resting" : action === "navigate" ? "navigating" : "idle";
  if (action === "navigate") {
    const arrived = !character.location.atSea && (previousIsland !== character.location.island || previousAtSea);
    if (arrived) {
      delete character.location.localTarget;
      delete character.location.localVenue;
      delete character.localSuggestion;
      character.location.scenePosition = createScenePosition(
        getMapIslands(character).find((island) => island.name === character.location.island)?.id || character.location.island,
        character.id
      );
    }
    if (character.status !== "dead" && (arrived || character.location.atSea)) {
      const encounter = seaEncounter(character);
      if (encounter) character.avatarActivity = "combat";
      if (encounter?.won || encounter?.dead) recordActionOutcome(character, "combat", { wins: Boolean(encounter.won) });
      if (encounter?.dead) checkDeath(character, encounter.enemy);
    }
    if (character.status !== "dead") {
      discoverAtSea(character);
      discoverAncient(character);
    }
    resolvePortSuggestions(character, previousIsland);
    if (arrived) resolvePortContracts(character, previousIsland);
    if (arrived) updateCrewLoyalty(character, true);
    if (arrived) {
      resolvePortDilemma(character);
      beginIslandCrisis(character, getMapIslands(character).find((island) => island.name === character.location.island));
    }
  }
  advanceAdvancedSystems(character, { action, previousIsland });
  if (character.stats.health <= 0) checkDeath(character, "ahogamiento por Akuma no Mi");
  return message;
}
// ── Sugerir zarpar a una isla concreta: el avatar lo evalúa con su carácter ──
// Las condiciones son suaves (solo barco y estar vivo y libre); si la preparación
// es mala, el mar cobra: deriva sin navegante, casco castigado, hambre sin provisiones.
export function suggestSail(character, target, random = Math.random) {
  if (character.status === "dead") return { ok: false, message: "El avatar está en el Panteón; su linaje decide ahora." };
  if (character.captured) return { ok: false, message: "El avatar está cautivo; el rescate va primero." };
  if (!character.ship?.acquired) return { ok: false, message: "Sin barco no hay zarpe: el astillero de este puerto espera." };
  if (character.location?.atSea) return { ok: false, message: "Ya están en mar abierto; la carabela obedece a la corriente." };
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return { ok: false, message: "No hay un destino válido para zarpar." };
  const traits = traitsOf(character);
  const affinity = character.whisper?.affinity ?? 55;
  const hp = character.stats.health / Math.max(1, character.stats.maxHealth);
  const chance = clamp(64 + affinity * 0.22
    + (traits.some((t) => ["valiente", "curioso", "impulsivo"].includes(t)) ? 8 : 0)
    - (traits.includes("rebelde") ? 12 : 0)
    - (hp < 0.4 ? 22 : 0), 18, 96);
  if (random() * 100 > chance) {
    const rechazo = pick([
      `${character.name} mira el mar y prefiere quedarse un rato más en el puerto.`,
      `${character.name} niega con la cabeza: "este puerto aún me debe una historia".`,
      `${character.name} no está de ánimo para zarpar ahora mismo.`
    ]);
    addLog(character, `🗣️ Sugerencia de zarpe a ${target.name || "mar abierto"}: rechazada. ${rechazo}`);
    return { ok: true, accepted: false, message: rechazo };
  }
  character.redirectTarget = { ...target };
  character.sailOrder = { island: target.name || "mar abierto" };
  const conNavegante = hasNauticalCrew(character);
  const provisions = Number(character.inventory?.provisions) || 0;
  const preparacion = [
    conNavegante ? "✔ navegante a bordo" : "⚠ sin navegante: riesgo de deriva",
    provisions > 0 ? "✔ provisiones suficientes" : "⚠ sin provisiones: hambre en alta mar",
    character.ship.health < 50 ? `⚠ casco al ${character.ship.health}%` : null
  ].filter(Boolean).join(" · ");
  addLog(character, `⚽ ${character.name} acepta el zarpe: «${target.name || "mar abierto"} nos espera». Suelta amarras en el próximo latido del mar. Preparación: ${preparacion}.`);
  return { ok: true, accepted: true, message: `${character.name} suelta amarras rumbo a ${target.name || "mar abierto"}. ${conNavegante ? "Buena preparación." : "Sin navegante el mar cobrará caro."}` };
}
// ── Coliseo: el propio avatar baja a la arena. Los rasgos deciden el temple. ──
export function coliseoFight(character, random = Math.random) {
  if (character.status === "dead" || character.captured) return { ok: false, message: "El avatar no puede pelear ahora mismo." };
  if (character.location?.atSea) return { ok: false, message: "El coliseo está en tierra: hay que atracar primero." };
  const hoy = Number(character.world?.day) || 0;
  if (character.coliseo?.fightDay === hoy) return { ok: false, message: `${character.name} ya pelea hoy en la arena; los brazos piden descanso hasta mañana.` };
  if (character.stats.health < character.stats.maxHealth * 0.25) return { ok: false, message: `${character.name} no está para la arena: primero la posada y unas costuras.` };
  if (Number(character.berries) < 15) return { ok: false, message: "La inscripción de la arena cuesta ฿15; sin berries no hay combate." };
  character.berries -= 15;
  const traits = traitsOf(character);
  const favor = traits.filter((t) => ["agresivo", "valiente", "ferozo", "impulsivo"].includes(t)).length;
  const contra = traits.filter((t) => ["prudente", "sereno"].includes(t)).length;
  const prob = clamp(0.4 + favor * 0.09 - contra * 0.08 + (character.stats.strength || 5) * 0.012 + (character.level || 1) * 0.02, 0.15, 0.88);
  const won = random() < prob;
  character.coliseo = { ...(character.coliseo || {}), fightDay: hoy };
  if (won) {
    const premio = 70 + (character.level || 1) * 15 + rand(40);
    awardBerries(character, premio);
    addReputation(character, 1500 + rand(1200), "victoria en el coliseo");
    gainExperience(character, 30);
    for (const member of character.crew || []) member.loyalty = clamp((Number(member.loyalty) || 50) + 5, 0, 100);
    character.avatarActivity = "victory";
    addLog(character, `🥊 ¡${character.name} gana en la arena de ${character.location?.island || "el puerto"}! Premio: ฿${formatNum(premio)}. La taberna cantará esto toda la semana.`);
    return { ok: true, won: true, message: `¡Victoria en el coliseo! +฿${formatNum(premio)} y renombre en el puerto.` };
  }
  const daño = Math.max(1, 10 + rand(14));
  character.stats.health = Math.max(1, character.stats.health - daño);
  character.avatarActivity = "combat";
  addLog(character, `🥊 El gladiador rival noquea a ${character.name} en el segundo round (-${daño} HP). La entrada salió ฿15; la lección salió gratis.`);
  return { ok: true, won: false, message: `Derrota en la arena: -${daño} HP. El coliseo también enseña.` };
}
function factionEvent(character) {
  const events = [
    "⚓ Evento de facción: una patrulla Marine bloquea a los piratas en la ruta; los Cazarrecompensas siguen el conflicto.",
    "☠ Evento de facción: piratas rivales atacan un puesto de la Marina; el incidente aparece en los periódicos.",
    "💰 Evento de facción: Cazarrecompensas aceptan el contrato de un capitán buscado.",
    "🗞 Evento de facción: la Marina y los piratas disputan el control del puerto; los civiles piden ayuda.",
    "✊ Evento de facción: una célula revolucionaria derrama el tributo del Gobierno; los puertos murmuran quién fue."
  ];
  const event = pick(events);
  character.world.news.unshift({ day: character.world.day, era: character.world.era, text: event });
  character.world.news = character.world.news.slice(0, 30);
  addLog(character, event);
  if (character.faction === "Marine" && Math.random() < 0.4) { character.captures += 1; awardBerries(character, 25); updateRank(character); }
  else if (character.faction === "Pirata" && Math.random() < 0.35) addReputation(character, 15000, "incidente entre facciones");
  else if (character.faction === "Revolucionario" && Math.random() < 0.4) {
    const stance = ensurePoliticalStance(character);
    stance.revolutionarySympathy = clamp(stance.revolutionarySympathy + 6);
    addLog(character, "✊ La red del Ejército toma nota de tu presencia: tu confianza revolucionaria crece.");
  }
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
// la bandera "El avatar elige": cinco días de actos deciden, no el clic inicial.
// Si el jugador eligió UNA bandera explícita (Pirata/Marina/Revolucionario), se respeta.
function resolverBandera(character) {
  if (character.faction !== "Autonomo") return;
  character.autonomoActs ??= { day0: Number(character.world?.day) || 0 };
  const dia = Number(character.world?.day) || 0;
  if (dia < character.autonomoActs.day0 + 5) return;
  const dream = character.soulCard?.dream;
  const bounty = Number(character.bounty) || 0;
  let bandera = "Aventurero";
  if (bounty > 30000 || dream === "Poder" || dream === "Destrucción") bandera = "Pirata";
  else if (dream === "Justicia" || (character.crew?.length && dream === "Lazos" && bounty <= 30000 && Math.random() < 0.4)) bandera = "Marina";
  character.faction = bandera;
  addLog(character, `🏴 La bandera por fin ondea sola: ${bandera.toUpperCase()}. La pintaron tus actos; nadie la eligió por vos.`);
}
export function autonomousTick(character, { interactive = false, now = Date.now(), availableFruitIds } = {}) {
  if (character.status === "dead" || character.autonomy.paused || character.captured) return null;
  character.autonomy.tickCount += 1;
  const newDay = advanceClock(character.world, ERAS);
  advanceIslandStory(character);
  if (newDay) writeDailyReflection(character);
  advanceGM(character);
  governmentPulse(character, Math.random); // el Gobierno Mundial decide una vez por día: decretos, desfiles, CP9 y planos
  const news = (newDay && character.world.day % 7 === 0) || Math.random() < 0.06 ? `Día ${character.world.day}, ${character.world.era}: ${pick(WORLD_NEWS)}` : null;
  if (news) { character.world.news.unshift({ day: character.world.day, era: character.world.era, text: news }); character.world.news = character.world.news.slice(0, 30); addLog(character, `🗞 ${news}`); }
  if (character.autonomy.tickCount % 3 === 0 && Math.random() < 0.55) factionEvent(character);
  const localActivity = character.sailOrder ? null : resolveLocalActivity(character, Math.random, { advanceNeeds: true });
  const action = character.sailOrder ? "navigate" : localActivity ? "local" : chooseAutonomousAction(character);
  if (character.sailOrder) addLog(character, `⛵ Orden de zarpe pendiente: ${character.name} deja los encantos del puerto para el próximo latido del mar.`);
  else if (localActivity) addLog(character, `Decisión autónoma local: ${localActivity.message}`);
  else addLog(character, `Decisión autónoma: ${({ navigate: "navegar y cumplir misión", train: "entrenar", searchFruit: "buscar fruta/tesoro", rest: "descansar" })[action]}.`);
  const message = localActivity?.message ?? performAction(character, action, { availableFruitIds });
  if (localActivity?.action === "poneglyph") {
    const island = getMapIslands(character).find((entry) => entry.name === character.location?.island);
    const rubbing = exploreLocalArchaeology(character, island);
    if (rubbing?.inaccessible) addLog(character, "Encuentra un monolito cubierto de glifos antiguos e indescifrables.");
    else if (rubbing) addLog(character, rubbing.translated
      ? `Descifra el monolito: ${rubbing.title}.`
      : `Obtiene un calco del monolito ${rubbing.title}.`);
  }
  if (character.status !== "dead" && character.crew?.length && Math.random() < 0.12) {
    const member = pick(character.crew);
    const change = character.nauticalStress?.value > 70 ? -2 : 1;
    member.loyalty = clamp((Number(member.loyalty) || 0) + change, 0, 100);
    addLog(character, `📓 ${member.name} ${change < 0 ? "se inquieta por la tensión a bordo" : "comparte una guardia tranquila"}; lealtad ${member.loyalty}%.`);
  }
  // ── voluntad propia de la tripulación NPC ──
  // zarpar sin navegante: permitido, pero el mar cobra caro y los NPC tienen criterio
  const conNavegante = character.crew?.some((m) => /navegante|carpintero/i.test(m.profession || ""));
  if (character.status !== "dead" && !character.autonomy.paused) {
    if (character.location?.atSea && !conNavegante) {
      character.nauticalStress ??= { value: 15 };
      character.nauticalStress.value = clamp(character.nauticalStress.value + 4, 0, 100);
      if (character.crew?.length && Math.random() < 0.18) {
        const npc = pick(character.crew);
        if ((Number(npc.loyalty) || 0) < 40) addLog(character, `⚓ ${npc.name} no entiende el rumbo que llevás: sin navegante, cada día a la deriva le pesa (lealtad ${npc.loyalty}%).`);
        else addLog(character, `⚓ ${npc.name} tomó el timón esta guardia: "yo sé hacia dónde, capitán".`);
      }
    }
    if (!character.location?.atSea && character.crew?.length) {
      for (const npc of [...character.crew]) {
        if ((Number(npc.loyalty) || 0) < 22 && Math.random() < 0.3) {
          character.crew = character.crew.filter((m) => m !== npc);
          addLog(character, `🌊 ${npc.name} eligió su propio rumbo y desembarcó en ${character.location?.island || "un puerto lejano"}: nadie lo ató a esta bandera.`);
        } else if ((Number(npc.loyalty) || 0) < 35 && Math.random() < 0.1) {
          addLog(character, `🌊 ${npc.name} habla de irse en el próximo puerto si las cosas no cambian.`);
        }
      }
    }
  }
  // ── el oficio se moldea: cada decisión real deja una señal que el mar registra ──
  if (character.status !== "dead") {
    registrarSenalOficio(character, localActivity?.action);
    if (!localActivity) registrarSenalOficio(character, action === "navigate" ? (Math.random() < 0.5 ? "navigate" : "chart") : action === "searchFruit" ? "hunt" : action === "train" ? "dojo" : null);
  }
  // ── bandera "El avatar elige": los actos la revelan ──
  if (character.status !== "dead" && character.faction === "Autonomo") resolverBandera(character);
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
function parseWhisper(text) {
  const phrase = text.toLocaleLowerCase("es");
  if (/descans|dorm|recuper|cur|puerto|huir|escap/.test(phrase)) return "rest";
  if (/entren|haki|fuerza|combate|pelea|luchar|poder/.test(phrase)) return "train";
  if (/fruta|akuma|tesoro|riqueza|berries|dinero|buscar/.test(phrase)) return "searchFruit";
  if (/explor|naveg|viaj|zarpar|aventur|libertad|rumbo|grand line|misión|isla/.test(phrase)) return "navigate";
  return null;
}
export function sendWhisper(character, text, random = Math.random) {
  if (character.status === "dead") return { obeyed: false, action: null };
  const phrase = String(text).trim().slice(0, 160);
  const localPriority = resolveLocalActivity(character, random, { prioritizeOnly: true });
  if (localPriority) {
    addLog(character, `El susurro «${phrase}» queda pendiente: ${character.name} prioriza una necesidad inmediata y decide por sí mismo.`);
    return { obeyed: false, deferred: true, action: localPriority.action };
  }
  const action = parseWhisper(phrase);
  if (!action) { addLog(character, `El susurro «${phrase}» no fue comprendido.`); return { obeyed: false, action: null }; }
  const { aligned, against } = evaluateWhisper(character, action);
  if (aligned) { character.whisper.affinity = clamp(character.whisper.affinity + 5, 0, 100); character.whisper.rebellion = clamp(character.whisper.rebellion - 4, 0, 100); }
  if (against) { character.whisper.affinity = clamp(character.whisper.affinity - 5, 0, 100); character.whisper.rebellion = clamp(character.whisper.rebellion + 7, 0, 100); }
  const chance = clamp(character.whisper.affinity + (aligned ? 15 : 0) - (against ? 25 : 0), 5, 98);
  if (random() * 100 < chance) {
    addLog(character, `El avatar acepta el susurro «${phrase}» (sintonía ${chance}%).`);
    performAction(character, action);
    return { obeyed: true, action, chance };
  }
  if (against && random() < 0.35) {
    const reinterpretedAction = chooseAutonomousAction(character, random);
    if (reinterpretedAction !== action) {
      addLog(character, `El avatar vacila ante «${phrase}» y lo reinterpreta como una decisión propia: ${reinterpretedAction}.`);
      performAction(character, reinterpretedAction);
      return { obeyed: false, action, reinterpretedAction, chance };
    }
  }
  character.whisper.affinity = clamp(character.whisper.affinity - 2, 0, 100);
  character.whisper.rebellion = clamp(character.whisper.rebellion + 3, 0, 100);
  addLog(character, `El avatar reflexiona sobre «${phrase}» y decide no seguirlo (sintonía ${chance}%).`);
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
  const heir = createCharacter({ name: name || `Heredero de ${family}`, username: username || `@linaje${predecessor.lineage.generation + 1}`, faction: predecessor.faction, race: heirRace, profession: predecessor.profession, allowRareRace: true, starterChallenge: Boolean(predecessor.starterChallenge), dream: predecessor.soulCard.dream, alignment: predecessor.soulCard.alignment, traits: [first, second], appearance: predecessor.appearance });
  heir.lineage = { family, generation: predecessor.lineage.generation + 1, inheritedFrom: predecessor.id, legacyChest: [...predecessor.lineage.legacyChest], inheritedReputation: Math.floor((predecessor.reputation || predecessor.bounty || 0) * 0.3) };
  const ancestralTraits = [...predecessor.soulCard.traits.pros, ...predecessor.soulCard.traits.cons, predecessor.soulCard.latentTrait].filter((trait) => trait && !heir.soulCard.traits.pros.includes(trait));
  if (ancestralTraits.length && Math.random() < 0.15) heir.soulCard.latentTrait = pick(ancestralTraits);
  if (Math.random() < 0.15) {
    const ancestorPsyche = ensurePsyche(predecessor);
    const heirPsyche = ensurePsyche(heir);
    for (const axis of ["honor", "greed", "liberty"]) {
      heirPsyche.morality[axis] = clamp(Math.round(heirPsyche.morality[axis] * 0.75 + ancestorPsyche.morality[axis] * 0.25), 0, 100);
    }
    heirPsyche.inheritedMemory = `Recuerdos diluidos de ${predecessor.name}: reputación ${Math.floor((predecessor.reputation || predecessor.bounty || 0) * 0.3)}.`;
  }
  heir.world = predecessor.world;
  heir.systems = { testament: predecessor.systems?.testament ?? null, treasureMaps: [...(predecessor.systems?.treasureMaps ?? [])], discoveries: [...(predecessor.systems?.discoveries ?? [])], dangerMapCreated: false };
  heir.ancientLanguage = structuredClone(ensureAncientLanguage(predecessor));
  heir.ship = { ...heir.ship, ...(predecessor.ship || {}) };
  heir.crew = [...(predecessor.crew ?? [])];
  heir.log = [...predecessor.log.slice(0, 25)];
  if (heir.psyche.inheritedMemory) addLog(heir, heir.psyche.inheritedMemory);
  addLog(heir, `El linaje ${family} continúa: ${heir.name} hereda ${heir.lineage.legacyChest.length} reliquias; los puertos recuerdan a sus antepasados.`);
  return heir;
}
