import { decideAvatarAction, advanceSeaClock, rollNews } from "./avatar.js";

export const SAVE_KEY = "one-latam-rpg-beta-1";
const ROUTES = {
  "East Blue": ["Villa Foosha", "Reverse Mountain", "Paraíso", "Nuevo Mundo"],
  "West Blue": ["Isla Ohara", "Reverse Mountain", "Paraíso", "Nuevo Mundo"],
  "North Blue": ["Isla Flevance", "Reverse Mountain", "Paraíso", "Nuevo Mundo"],
  "South Blue": ["Isla Torino", "Reverse Mountain", "Paraíso", "Nuevo Mundo"]
};
const FRUITS = [
  { name: "Bara Bara no Mi", type: "Paramecia" },
  { name: "Mera Mera no Mi", type: "Logia" },
  { name: "Tori Tori no Mi, modelo Fénix", type: "Zoan mitológica" },
  { name: "Hito Hito no Mi, modelo Daibutsu", type: "Zoan mitológica" },
  { name: "Noro Noro no Mi", type: "Paramecia" },
  { name: "Suna Suna no Mi", type: "Logia" }
];
const rand = (max) => Math.floor(Math.random() * max);
const pick = (items) => items[rand(items.length)];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const traitsOf = (character) => [
  ...(character.soulCard?.traits?.pros ?? []),
  ...(character.soulCard?.traits?.cons ?? [])
].map((trait) => String(trait).toLowerCase());

export function createCharacter({ name, username = "@usuario", faction = "Pirata", originSea = "East Blue", dream = "Libertad", traits = [], trait, appearance = {} }) {
  const displayName = String(name || "Aventurero").trim().slice(0, 24);
  const chosenTraits = traits.length ? traits.slice(0, 2) : [trait || "Valiente"];
  const family = displayName.split(/\s+/).at(-1) || displayName;
  return {
    version: 2,
    id: globalThis.crypto?.randomUUID?.() ?? `captain-${Date.now()}`,
    name: displayName,
    username: String(username).startsWith("@") ? String(username).slice(0, 17) : `@${String(username).slice(0, 16)}`,
    faction: faction === "Marina" ? "Marine" : faction,
    originSea,
    appearance: { skin: appearance.skin || "Clara", hair: appearance.hair || "Negro", accessory: appearance.accessory || "Bandana" },
    location: { region: originSea, island: ROUTES[originSea]?.[0] ?? "Puerto inicial", routeIndex: 0 },
    logPose: { alignment: 0, required: 3 },
    fruit: null,
    haki: { busoshoku: false, kenbunshoku: false, haoshoku: false },
    bounty: 0,
    reputation: 0,
    berries: 100,
    captures: 0,
    rank: faction === "Marine" || faction === "Marina" ? "Recluta" : "Novato",
    level: 1,
    experience: 0,
    stats: { health: 100, maxHealth: 100, strength: 5, agility: 5, ingenuity: 5 },
    soulCard: { dream, traits: { pros: chosenTraits, cons: [] } },
    lineage: { family, generation: 1, inheritedFrom: null, legacyChest: [], inheritedReputation: 0 },
    autonomy: { mode: "active", paused: false, tickCount: 0 },
    whisper: { affinity: 55, rebellion: 45 },
    world: { day: 0, year: 1, era: "Era de los Grandes Descubrimientos", news: [], pantheon: [] },
    status: "alive",
    log: [{ time: new Date().toISOString(), message: `¡${displayName} (${username}) inicia su aventura en ${originSea}! Sueño: ${dream}.` }]
  };
}

function normalize(character) {
  if (!character || !character.stats) return null;
  character.version = 2;
  character.autonomy ??= { mode: "active", paused: false, tickCount: 0 };
  character.autonomy.paused ??= character.autonomy.mode === "paused";
  character.autonomy.mode = character.autonomy.paused ? "paused" : "active";
  character.autonomy.tickCount ??= 0;
  character.whisper ??= { affinity: 55, rebellion: 45 };
  character.whisper.affinity = clamp(Number(character.whisper.affinity) || 55, 0, 100);
  character.whisper.rebellion = clamp(Number(character.whisper.rebellion ?? (100 - character.whisper.affinity)), 0, 100);
  character.soulCard ??= { dream: "Libertad", traits: { pros: [], cons: [] } };
  character.soulCard.traits ??= { pros: [], cons: [] };
  character.soulCard.traits.pros ??= [];
  character.soulCard.traits.cons ??= [];
  character.haki ??= { busoshoku: false, kenbunshoku: false, haoshoku: false };
  character.location ??= { region: character.originSea || "East Blue", island: "Puerto inicial", routeIndex: 0 };
  character.logPose ??= { alignment: 0, required: 3 };
  character.lineage ??= { family: character.name, generation: 1, inheritedFrom: null, legacyChest: [], inheritedReputation: 0 };
  character.lineage.legacyChest ??= [];
  character.world ??= { day: 0, year: 1, era: "Era de los Grandes Descubrimientos", news: [], pantheon: [] };
  character.world.news ??= [];
  character.world.pantheon ??= [];
  character.world.day ??= 0;
  character.status ??= "alive";
  character.reputation ??= character.bounty ?? 0;
  character.captures ??= 0;
  character.log ??= [];
  character.stats.maxHealth ??= 100;
  character.stats.health = clamp(Number(character.stats.health) || (character.status === "dead" ? 0 : 1), 0, character.stats.maxHealth);
  return character;
}

export function loadGame() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? normalize(JSON.parse(raw)) : null; }
  catch { return null; }
}
export function saveGame(character) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(character)); return true; }
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
    const target = Math.min(Math.floor(character.captures / 2), ranks.length - 1);
    character.rank = ranks[target];
  } else if (character.faction === "Pirata") {
    character.rank = character.level >= 8 ? "Capitán de renombre" : character.level >= 4 ? "Capitán" : "Novato";
  } else if (character.faction === "Aventurero") character.rank = character.level >= 5 ? "Explorador de renombre" : "Viajero";
}
function addReputation(character, base) {
  const traits = traitsOf(character);
  const multiplier = traits.some((t) => ["impulsivo", "agresivo"].includes(t)) ? 1.45 : 1;
  const amount = Math.round(base * multiplier);
  character.reputation += amount;
  if (["Pirata", "Revolucionario"].includes(character.faction)) character.bounty += amount;
  return amount;
}
function checkDeath(character, cause) {
  if (character.status === "dead" || character.stats.health > 0) return false;
  character.stats.health = 0;
  character.status = "dead";
  character.autonomy.paused = true;
  character.autonomy.mode = "paused";
  character.world.pantheon.unshift({
    id: character.id, name: character.name, username: character.username,
    family: character.lineage.family, generation: character.lineage.generation,
    faction: character.faction, level: character.level, bounty: character.bounty,
    reputation: character.reputation, dream: character.soulCard.dream,
    cause, achievements: [`Nivel ${character.level}`, `${character.location.island}`, ...(character.fruit ? [`Portador de ${character.fruit.name}`] : [])],
    time: new Date().toISOString()
  });
  character.world.pantheon = character.world.pantheon.slice(0, 30);
  addLog(character, `☠ ${character.name} ha caído (${cause}). Su nombre entra en el Panteón de Leyendas; su linaje continúa.`);
  return true;
}

function resolveCombat(character, rivalType = "pirata rival", dangerous = false) {
  const traits = traitsOf(character);
  const bold = traits.some((t) => ["impulsivo", "agresivo", "valiente"].includes(t));
  const cautious = traits.some((t) => ["astuto", "prudente"].includes(t));
  const hpRatio = character.stats.health / character.stats.maxHealth;
  if (cautious && hpRatio < 0.25) {
    addLog(character, `Combate evitado: ${character.name} se repliega con prudencia ante ${rivalType}.`);
    return { fled: true };
  }
  const rivalLevel = Math.max(1, character.level + rand(dangerous ? 4 : 3) - 1);
  const initiative = character.stats.agility * 1.2 + character.stats.ingenuity + rand(12);
  const rivalInitiative = rivalLevel * 2 + rand(14);
  const playerFirst = initiative >= rivalInitiative;
  const attackPower = character.stats.strength + character.level * 2 + (character.haki.busoshoku ? 8 : 0) + rand(12);
  const rivalPower = rivalLevel * 5 + rand(14);
  const wins = attackPower + (playerFirst ? 7 : 0) >= rivalPower;
  let damage = wins ? rand(12) + (dangerous ? 4 : 1) : 12 + rand(18) + (dangerous ? 12 : 0);
  if (playerFirst) damage = Math.max(1, damage - Math.floor(character.stats.agility / 3));
  if (bold) damage = Math.round(damage * 1.35);
  character.stats.health = Math.max(0, character.stats.health - damage);

  if (wins) {
    character.experience += 25 + rivalLevel * 8;
    const reward = addReputation(character, 50000 + rivalLevel * 15000);
    if (character.faction === "Marine") {
      character.captures += 1;
      character.berries += 30 + rivalLevel * 10;
      updateRank(character);
      addLog(character, `Victoria: capturas a ${rivalType} nivel ${rivalLevel}. +${formatNum(reward)} de renombre; asciendes según tus capturas (${character.rank}).`);
    } else {
      character.berries += 20 + rivalLevel * 15;
      addLog(character, `Victoria sobre ${rivalType} nivel ${rivalLevel}; ${playerFirst ? "tu agilidad te dio la iniciativa" : "superaste su primer golpe"}. Recompensa/renombre +${formatNum(reward)} Berries.`);
    }
    if (Math.random() < 0.12) {
      const relic = pick(["Log Pose antiguo", "Brújula de la Grand Line", "Medalla de la Marina", "Mapa del Calm Belt"]);
      character.lineage.legacyChest.push(relic);
      addLog(character, `Reliquia guardada en el cofre del linaje: ${relic}.`);
    }
    gainExperience(character, 25);
  } else {
    addLog(character, `Derrota en combate contra ${rivalType} nivel ${rivalLevel}; pierde ${damage} HP${dangerous ? " en aguas peligrosas" : ""}.`);
  }
  if (character.stats.health <= 0) checkDeath(character, `${rivalType}${dangerous ? " en aguas peligrosas" : " en batalla crítica"}`);
  return { wins, damage, rivalLevel, dead: character.status === "dead" };
}
function navigate(character) {
  const route = ROUTES[character.originSea] ?? ROUTES["East Blue"];
  character.logPose.alignment += 1;
  let message = `El Log Pose se alinea ${character.logPose.alignment}/${character.logPose.required}.`;
  if (character.logPose.alignment >= character.logPose.required) {
    const next = Math.min(character.location.routeIndex + 1, route.length - 1);
    character.location.routeIndex = next;
    character.location.island = route[next];
    character.location.region = next < 2 ? character.originSea : next === 2 ? "Grand Line — Paraíso" : "Grand Line — Nuevo Mundo";
    character.logPose.alignment = 0;
    message += ` Ruta trazada: ${character.location.island} (${character.location.region}).`;
  }
  const dangerous = character.location.routeIndex >= 2 || Math.random() < 0.12;
  if (dangerous && Math.random() < 0.4) {
    const belt = Math.random() < 0.5;
    const rival = belt ? "Rey del Mar en el Calm Belt" : "piratas de la Grand Line";
    const result = resolveCombat(character, rival, true);
    message += result.fled ? ` ${character.name} evita el choque con ${rival}.` : ` Encuentro peligroso: ${rival}.`;
  } else if (Math.random() < 0.23) {
    const fruit = pick(FRUITS);
    if (!character.fruit) {
      character.fruit = fruit;
      message += ` Hallazgo legendario: Akuma no Mi ${fruit.name} (${fruit.type}).`;
    } else {
      const berries = 25 + rand(100); character.berries += berries;
      message += ` Encuentras un cofre con ${berries} Berries.`;
    }
  } else {
    const berries = 5 + rand(30); character.berries += berries;
    message += ` La tripulación recoge ${berries} Berries en provisiones.`;
  }
  return message;
}
function train(character) {
  if (character.stats.health < 15) return "No puede entrenar: necesita recuperarse primero.";
  character.stats.health = Math.max(1, character.stats.health - 4);
  const stat = pick(["strength", "agility", "ingenuity"]); character.stats[stat] += 1;
  const leveled = gainExperience(character, 35);
  let message = `Entrenamiento: ${stat} aumenta a ${character.stats[stat]}.`;
  const missing = Object.keys(character.haki).filter((key) => !character.haki[key]);
  if (missing.length && Math.random() < 0.2) {
    const haki = pick(missing); character.haki[haki] = true;
    const names = { busoshoku: "Busoshoku (Armadura)", kenbunshoku: "Kenbunshoku (Observación)", haoshoku: "Haoshoku (Conquistador)" };
    message += ` ¡Despierta el Haki ${names[haki]}!`;
  }
  if (leveled) message += ` Sube al nivel ${character.level}.`;
  updateRank(character);
  return message;
}
function searchFruit(character) {
  if (character.fruit) { character.berries += 20 + rand(60); return "No encuentra otra fruta, pero recupera provisiones y Berries."; }
  if (Math.random() < 0.24) {
    character.fruit = pick(FRUITS);
    return `¡Encuentra una Akuma no Mi ${character.fruit.name} (${character.fruit.type})!`;
  }
  character.berries += 10 + rand(35);
  return "La búsqueda no descubre fruta; rescata algunas Berries y pistas para otra ruta.";
}
function rest(character) {
  const before = character.stats.health;
  character.berries -= Math.min(character.berries, 10);
  character.stats.health = character.stats.maxHealth;
  return `Descansa en puerto y recupera ${character.stats.maxHealth - before} HP.`;
}
export function performAction(character, action) {
  if (character.status === "dead") return "El avatar está en el Panteón; crea un heredero para continuar.";
  const handlers = { navigate, train, searchFruit, rest };
  const message = handlers[action] ? handlers[action](character) : "Acción desconocida.";
  addLog(character, message);
  return message;
}
export function autonomousTick(character) {
  if (character.status === "dead" || character.autonomy.paused) return null;
  character.autonomy.tickCount += 1;
  advanceSeaClock(character.world);
  const news = rollNews(character.world);
  if (news) addLog(character, `🗞 Noticia del Mundo: ${news}`);
  const action = decideAvatarAction(character);
  addLog(character, `Decisión autónoma: ${({ navigate: "navegar", train: "entrenar Haki", searchFruit: "buscar fruta/tesoro", rest: "descansar" })[action]}.`);
  const message = performAction(character, action);
  character.reputation += Math.random() < 0.22 ? 1000 : 0;
  return { action, message };
}
function parseWhisper(text) {
  const phrase = text.toLocaleLowerCase("es");
  if (/descans|dorm|recuper|cur|puerto|huir|escap/.test(phrase)) return "rest";
  if (/entren|haki|fuerza|combate|pelea|luchar|poder/.test(phrase)) return "train";
  if (/fruta|akuma|tesoro|riqueza|berries|dinero|buscar/.test(phrase)) return "searchFruit";
  if (/explor|naveg|viaj|zarpar|aventur|libertad|rumbo|grand line/.test(phrase)) return "navigate";
  return null;
}
export function sendWhisper(character, text) {
  if (character.status === "dead") return { obeyed: false, action: null };
  const phrase = String(text).trim().slice(0, 160);
  const action = parseWhisper(phrase);
  if (!action) { addLog(character, `El susurro «${phrase}» no fue comprendido.`); return { obeyed: false, action: null }; }
  const dream = character.soulCard.dream.toLowerCase();
  const traits = traitsOf(character);
  const aligned = (action === "navigate" && ["libertad", "fama", "conocimiento", "lazos"].some((d) => dream.includes(d))) ||
    (action === "train" && dream.includes("poder")) || (action === "searchFruit" && dream.includes("riqueza")) ||
    (action === "rest" && traits.includes("prudente"));
  const against = (action === "rest" && traits.includes("valiente")) || (action === "rest" && traits.includes("agresivo")) ||
    (action === "train" && traits.includes("prudente") && character.stats.health < 40) || traits.includes("rebelde");
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
  if (["Pirata", "Revolucionario"].includes(character.faction) && (traits.includes("impulsivo") || traits.includes("agresivo"))) addReputation(character, 10000);
  addLog(character, `Rebeldía: ignora «${phrase}» y sigue su carácter (sintonía ${chance}%).`);
  return { obeyed: false, action, chance };
}
export function setAutonomyPaused(character, paused) {
  character.autonomy.paused = Boolean(paused);
  character.autonomy.mode = character.autonomy.paused ? "paused" : "active";
  addLog(character, character.autonomy.paused ? "El avatar pone el mundo en pausa." : "El avatar reanuda su camino.");
}
export function createHeir(predecessor, { name, username } = {}) {
  if (predecessor.status !== "dead") return null;
  const family = predecessor.lineage.family || predecessor.name;
  const heir = createCharacter({
    name: name || `Heredero de ${family}`,
    username: username || `@linaje${predecessor.lineage.generation + 1}`,
    faction: predecessor.faction,
    originSea: predecessor.originSea,
    dream: predecessor.soulCard.dream,
    traits: predecessor.soulCard.traits.pros.slice(0, 2),
    appearance: predecessor.appearance
  });
  heir.lineage = {
    family,
    generation: predecessor.lineage.generation + 1,
    inheritedFrom: predecessor.id,
    legacyChest: [...predecessor.lineage.legacyChest],
    inheritedReputation: Math.floor((predecessor.reputation || predecessor.bounty || 0) * 0.3)
  };
  heir.reputation = heir.lineage.inheritedReputation;
  if (heir.faction === "Pirata") heir.bounty = heir.lineage.inheritedReputation;
  heir.world = predecessor.world;
  heir.world.day += 1;
  heir.log = [...predecessor.log.slice(0, 25)];
  addLog(heir, `El linaje ${family} continúa: ${heir.name} hereda ${heir.lineage.legacyChest.length} reliquias y el 30% del renombre.`);
  return heir;
}
function formatNum(value) { return new Intl.NumberFormat("es-ES").format(value); }
