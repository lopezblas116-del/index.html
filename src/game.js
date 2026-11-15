export const SAVE_KEY = "one-latam-rpg-beta-1";

const ROUTES = {
  "East Blue": ["Villa Foosha", "Reverse Mountain", "Paraíso", "Nuevo Mundo"],
  "West Blue": ["Isla Ohara", "Reverse Mountain", "Paraíso", "Nuevo Mundo"],
  "North Blue": ["Isla Flevance", "Reverse Mountain", "Paraíso", "Nuevo Mundo"],
  "South Blue": ["Isla Torino", "Reverse Mountain", "Paraíso", "Nuevo Mundo"]
};
const FRUITS = [
  { name: "Gomu Gomu no Mi", type: "Paramecia" },
  { name: "Mera Mera no Mi", type: "Logia" },
  { name: "Hito Hito no Mi, modelo: Daibutsu", type: "Zoan mitológica" },
  { name: "Bara Bara no Mi", type: "Paramecia" },
  { name: "Tori Tori no Mi, modelo: Fénix", type: "Zoan mitológica" },
  { name: "Yami Yami no Mi", type: "Logia" }
];
const random = (max) => Math.floor(Math.random() * max);
const pick = (items) => items[random(items.length)];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function createCharacter({ name, faction, originSea, dream = "Libertad", trait = "Valiente" }) {
  const cleanName = name.trim().slice(0, 24) || "Aventurero";
  return {
    version: 1,
    id: globalThis.crypto?.randomUUID?.() ?? `captain-${Date.now()}`,
    name: cleanName, faction, originSea,
    location: { region: originSea, island: ROUTES[originSea]?.[0] ?? "Puerto inicial", routeIndex: 0 },
    logPose: { alignment: 0, required: 3 },
    fruit: null,
    haki: { busoshoku: false, kenbunshoku: false, haoshoku: false },
    bounty: 0, berries: 100,
    rank: faction === "Marina" ? "Recluta" : "Novato",
    level: 1, experience: 0,
    stats: { health: 100, maxHealth: 100, strength: 5, agility: 5, ingenuity: 5 },
    soulCard: { dream, traits: { pros: [trait], cons: [] } },
    lineage: { inheritedFrom: null, legacy: [] },
    autonomy: { mode: "active", paused: false, tickCount: 0 },
    whisper: { affinity: 55 },
    log: [{ time: new Date().toISOString(), message: `¡${cleanName} inicia su aventura en ${originSea}! Sueña con ${dream} y es ${trait.toLowerCase()}.` }]
  };
}

function normalizeCharacter(character) {
  character.autonomy ??= { mode: "active", paused: false, tickCount: 0 };
  character.autonomy.paused ??= character.autonomy.mode === "paused";
  character.autonomy.mode = character.autonomy.paused ? "paused" : "active";
  character.autonomy.tickCount ??= 0;
  character.whisper ??= { affinity: 55 };
  character.whisper.affinity = clamp(Number(character.whisper.affinity) || 55, 0, 100);
  character.soulCard ??= { dream: "Libertad", traits: { pros: [], cons: [] } };
  character.soulCard.dream ??= "Libertad";
  character.soulCard.traits ??= { pros: [], cons: [] };
  character.soulCard.traits.pros ??= [];
  character.soulCard.traits.cons ??= [];
  character.haki ??= { busoshoku: false, kenbunshoku: false, haoshoku: false };
  character.logPose ??= { alignment: 0, required: 3 };
  character.log ??= [];
  character.stats.maxHealth ??= 100;
  character.stats.health = clamp(Number(character.stats.health) || 1, 1, character.stats.maxHealth);
  character.location ??= { region: character.originSea, island: "Puerto inicial", routeIndex: 0 };
  character.location.routeIndex ??= 0;
  return character;
}

export function loadGame() {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) return null;
    const character = JSON.parse(saved);
    if (!character || character.version !== 1 || !character.stats) return null;
    return normalizeCharacter(character);
  } catch { return null; }
}

export function saveGame(character) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(character)); return true; }
  catch { return false; }
}

export function addLog(character, message) {
  character.log.unshift({ time: new Date().toISOString(), message });
  character.log = character.log.slice(0, 60);
}

function gainExperience(character, amount) {
  character.experience += amount;
  let leveledUp = false;
  while (character.experience >= character.level * 100) {
    character.experience -= character.level * 100;
    character.level += 1;
    character.stats.maxHealth += 5;
    character.stats.health = Math.min(character.stats.maxHealth, character.stats.health + 5);
    leveledUp = true;
  }
  return leveledUp;
}

function updateRank(character) {
  if (character.faction === "Marina") {
    const ranks = ["Recluta", "Marinero", "Sargento", "Teniente", "Capitán", "Comodoro"];
    character.rank = ranks[Math.min(Math.floor((character.level - 1) / 2), ranks.length - 1)];
  } else if (character.faction === "Pirata") {
    character.rank = character.level >= 8 ? "Capitán de renombre" : character.level >= 4 ? "Capitán" : "Novato";
  }
}

function addBounty(character, amount) {
  if (["Pirata", "Revolucionario"].includes(character.faction)) character.bounty += amount;
}

function navigate(character) {
  character.logPose.alignment += 1;
  let message = `El Log Pose avanza: alineamiento ${character.logPose.alignment}/${character.logPose.required}.`;
  if (character.logPose.alignment >= character.logPose.required) {
    const route = ROUTES[character.originSea] ?? ROUTES["East Blue"];
    const nextIndex = Math.min(character.location.routeIndex + 1, route.length - 1);
    character.location.routeIndex = nextIndex;
    character.location.island = route[nextIndex];
    character.location.region = nextIndex < 2 ? character.originSea : nextIndex === 2 ? "Grand Line — Paraíso" : "Grand Line — Nuevo Mundo";
    character.logPose.alignment = 0;
    message += ` ¡Rumbo fijado! Llegas a ${character.location.island}.`;
  }
  const roll = Math.random();
  if (roll < 0.17) {
    const damage = 8 + random(11), loot = 15 + random(36);
    character.stats.health = Math.max(1, character.stats.health - damage);
    character.berries += loot; addBounty(character, 100000 + random(400000));
    message += ` Encuentro con piratas rivales: recibes ${damage} de daño y encuentras ${loot} Berries.`;
  } else if (roll < 0.33) {
    const damage = 7 + random(10);
    if (character.faction === "Marina") {
      character.berries += 20; message += " Una patrulla marina te reconoce y te entrega 20 Berries.";
    } else {
      character.stats.health = Math.max(1, character.stats.health - damage);
      addBounty(character, 50000 + random(250000));
      message += ` Una patrulla de la Marina te intercepta. Pierdes ${damage} de salud.`;
    }
  } else if (roll < 0.43) {
    const damage = 12 + random(16);
    character.stats.health = Math.max(1, character.stats.health - damage);
    message += ` ¡Un Rey del Mar emerge cerca! Pierdes ${damage} de salud.`;
  } else if (roll < 0.63) {
    const loot = 20 + random(81); character.berries += loot;
    message += ` Hallas un cofre a la deriva con ${loot} Berries.`;
  } else if (roll < 0.73 && character.location.routeIndex < 2) {
    message += " Una franja de Calm Belt obliga a la tripulación a navegar con cautela.";
  } else {
    character.berries += 5; message += " La travesía es tranquila; la tripulación repone 5 Berries.";
  }
  return message;
}

function train(character) {
  if (character.stats.health < 15) return "Está demasiado herido para entrenar y necesita recuperarse.";
  character.stats.health = Math.max(1, character.stats.health - 4);
  const stat = pick(["strength", "agility", "ingenuity"]);
  character.stats[stat] += 1;
  const names = { strength: "Fuerza", agility: "Agilidad", ingenuity: "Ingenio" };
  let message = `Entrena con disciplina: ${names[stat]} aumenta a ${character.stats[stat]}.`;
  const leveledUp = gainExperience(character, 35);
  const available = Object.keys(character.haki).filter((key) => !character.haki[key] && key !== "haoshoku");
  if (available.length && Math.random() < 0.24) {
    const haki = pick(available); character.haki[haki] = true;
    message += ` ¡Despierta el Haki ${haki === "busoshoku" ? "Busoshoku (Armadura)" : "Kenbunshoku (Observación)"}!`;
  } else if (!character.haki.haoshoku && character.level >= 3 && Math.random() < 0.025) {
    character.haki.haoshoku = true; message += " ¡Despierta el Haoshoku (Conquistador)!";
  }
  if (leveledUp) message += ` ¡Sube al nivel ${character.level}!`;
  updateRank(character);
  return message;
}

function searchFruit(character) {
  if (character.fruit) {
    const found = 25 + random(51); character.berries += found;
    return `No encuentra otra fruta, pero halla ${found} Berries entre las provisiones.`;
  }
  if (Math.random() < 0.18) {
    character.fruit = pick(FRUITS);
    return `¡Hallazgo extraordinario! Encuentra la ${character.fruit.name} (${character.fruit.type}).`;
  }
  if (Math.random() < 0.35) {
    const found = 10 + random(31); character.berries += found;
    return `No aparece ninguna fruta, pero rescata ${found} Berries de una caja varada.`;
  }
  return "Busca en la costa y el puerto, pero no encuentra ninguna Akuma no Mi.";
}

function rest(character) {
  const cost = Math.min(character.berries, 10);
  character.berries -= cost;
  const previous = character.stats.health;
  character.stats.health = character.stats.maxHealth;
  return previous === character.stats.maxHealth
    ? `Descansa en el puerto${cost ? ` y paga ${cost} Berries` : ""}; ya tenía la salud al máximo.`
    : `Descansa en el puerto y recupera salud de ${previous} a ${character.stats.maxHealth}. ${cost ? `Coste: ${cost} Berries.` : ""}`;
}

export function performAction(character, action) {
  const handlers = { navigate, train, searchFruit, rest };
  const message = handlers[action] ? handlers[action](character) : "Acción desconocida.";
  addLog(character, message);
  return message;
}

function chooseAutonomousAction(character) {
  const hp = character.stats.health / character.stats.maxHealth;
  if (hp < 0.30) return "rest";
  const scores = { navigate: 1, train: 1, searchFruit: 1, rest: 0.05 };
  const dream = character.soulCard.dream.toLowerCase();
  const traits = [...character.soulCard.traits.pros, ...character.soulCard.traits.cons].map((trait) => trait.toLowerCase());
  if (dream.includes("libertad") || dream.includes("explor")) scores.navigate += 3;
  if (dream.includes("poder")) scores.train += 3;
  if (dream.includes("riqueza")) scores.searchFruit += 3;
  if (traits.includes("impulsivo") || traits.includes("valiente")) { scores.navigate += 2; scores.train += 1; }
  if (traits.includes("astuto")) scores.searchFruit += 3;
  if (traits.includes("prudente")) { scores.rest += 1; scores.navigate -= 0.4; }
  if (traits.includes("rebelde")) scores.navigate += 1;
  if (hp < 0.55) scores.rest += 2;
  if (character.stats.health < 15) scores.train = 0;
  const pool = Object.entries(scores).flatMap(([action, weight]) => Array(Math.max(0, Math.round(weight * 10))).fill(action));
  return pick(pool);
}

export function autonomousTick(character) {
  if (character.autonomy.paused) return null;
  character.autonomy.tickCount += 1;
  const action = chooseAutonomousAction(character);
  addLog(character, `Decisión autónoma: el avatar elige ${({ navigate: "explorar", train: "entrenar", searchFruit: "buscar recursos", rest: "descansar" })[action]}.`);
  const result = performAction(character, action);
  return { action, message: result };
}

function parseWhisper(text) {
  const phrase = text.toLocaleLowerCase("es");
  if (/descans|dorm|recuper|cur|puerto|huir|escap/.test(phrase)) return "rest";
  if (/entren|haki|fuerza|combate|pelea|luchar|poder/.test(phrase)) return "train";
  if (/fruta|akuma|tesoro|riqueza|berries|dinero|buscar/.test(phrase)) return "searchFruit";
  if (/explor|naveg|viaj|zarpar|aventur|libertad|rumbo/.test(phrase)) return "navigate";
  return null;
}

function whisperCompatibility(character, action, text) {
  const dream = character.soulCard.dream.toLowerCase();
  const traits = [...character.soulCard.traits.pros, ...character.soulCard.traits.cons].map((trait) => trait.toLowerCase());
  const phrase = text.toLocaleLowerCase("es");
  let score = 0;
  if ((action === "navigate" && (dream.includes("libertad") || dream.includes("explor"))) ||
      (action === "train" && dream.includes("poder")) ||
      (action === "searchFruit" && dream.includes("riqueza"))) score += 20;
  if (action === "searchFruit" && traits.includes("astuto")) score += 20;
  if ((action === "navigate" || action === "train") && (traits.includes("impulsivo") || traits.includes("valiente"))) score += 12;
  if (action === "rest" && traits.includes("prudente")) score += 18;
  if ((action === "rest" || /huir|escap/.test(phrase)) && traits.includes("valiente") && character.stats.health / character.stats.maxHealth >= 0.3) score -= 30;
  if (traits.includes("rebelde")) score -= 12;
  if (character.stats.health / character.stats.maxHealth < 0.3 && action === "rest") score += 35;
  return score;
}

export function sendWhisper(character, text) {
  const whisper = text.trim().slice(0, 160);
  const action = parseWhisper(whisper);
  if (!action) {
    addLog(character, `El susurro «${whisper}» no fue entendido; el avatar sigue su propio rumbo.`);
    return { obeyed: false, action: null };
  }
  const compatibility = whisperCompatibility(character, action, whisper);
  const chance = clamp(character.whisper.affinity + compatibility, 5, 98);
  if (Math.random() * 100 < chance) {
    character.whisper.affinity = clamp(character.whisper.affinity + (compatibility > 0 ? 2 : 1), 0, 100);
    addLog(character, `El avatar acepta el susurro «${whisper}» (probabilidad de sintonía ${chance}%).`);
    performAction(character, action);
    return { obeyed: true, action, chance };
  }
  character.whisper.affinity = clamp(character.whisper.affinity - 2, 0, 100);
  addLog(character, `Rebeldía: el avatar ignora «${whisper}» y sigue su propio criterio (sintonía ${chance}%).`);
  return { obeyed: false, action, chance };
}

export function setAutonomyPaused(character, paused) {
  character.autonomy.paused = Boolean(paused);
  character.autonomy.mode = character.autonomy.paused ? "paused" : "active";
  addLog(character, character.autonomy.paused ? "El avatar pone su mundo en pausa." : "El avatar reanuda su camino autónomo.");
}
