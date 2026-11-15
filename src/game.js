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

export function createCharacter({ name, faction, originSea }) {
  const cleanName = name.trim().slice(0, 24) || "Aventurero";

  return {
    version: 1,
    id: globalThis.crypto?.randomUUID?.() ?? `captain-${Date.now()}`,
    name: cleanName,
    faction,
    originSea,
    location: {
      region: originSea,
      island: ROUTES[originSea][0],
      routeIndex: 0
    },
    logPose: { alignment: 0, required: 3 },
    fruit: null,
    haki: {
      busoshoku: false,
      kenbunshoku: false,
      haoshoku: false
    },
    bounty: 0,
    berries: 100,
    rank: faction === "Marina" ? "Recluta" : "Novato",
    level: 1,
    experience: 0,
    stats: {
      health: 100,
      maxHealth: 100,
      strength: 5,
      agility: 5,
      ingenuity: 5
    },
    soulCard: {
      dream: "Por elegir",
      traits: { pros: [], cons: [] }
    },
    lineage: { inheritedFrom: null, legacy: [] },
    autonomy: { mode: "manual" },
    log: [{
      time: new Date().toISOString(),
      message: `¡${cleanName} inicia su aventura en ${originSea}!`
    }]
  };
}

export function loadGame() {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) return null;

    const character = JSON.parse(saved);
    if (!character || character.version !== 1 || !character.stats) return null;
    return character;
  } catch {
    return null;
  }
}

export function saveGame(character) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(character));
    return true;
  } catch {
    return false;
  }
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
    character.stats.health = Math.min(
      character.stats.maxHealth,
      character.stats.health + 5
    );
    leveledUp = true;
  }

  return leveledUp;
}

function updateRank(character) {
  if (character.faction === "Marina") {
    const ranks = ["Recluta", "Marinero", "Sargento", "Teniente", "Capitán", "Comodoro"];
    character.rank = ranks[Math.min(Math.floor((character.level - 1) / 2), ranks.length - 1)];
  } else if (character.faction === "Pirata") {
    character.rank = character.level >= 8 ? "Capitán de renombre" :
      character.level >= 4 ? "Capitán" : "Novato";
  }
}

function addBounty(character, amount) {
  if (character.faction === "Pirata" || character.faction === "Revolucionario") {
    character.bounty += amount;
  }
}

function navigate(character) {
  character.logPose.alignment += 1;
  let message = `El Log Pose avanza: alineamiento ${character.logPose.alignment}/${character.logPose.required}.`;

  if (character.logPose.alignment >= character.logPose.required) {
    const route = ROUTES[character.originSea];
    const nextIndex = Math.min(character.location.routeIndex + 1, route.length - 1);

    character.location.routeIndex = nextIndex;
    character.location.island = route[nextIndex];
    character.location.region = nextIndex < 2
      ? character.originSea
      : nextIndex === 2 ? "Grand Line — Paraíso" : "Grand Line — Nuevo Mundo";
    character.logPose.alignment = 0;
    message += ` ¡Rumbo fijado! Llegas a ${character.location.island}.`;
  }

  const roll = Math.random();

  if (roll < 0.17) {
    const damage = 8 + random(11);
    character.stats.health = Math.max(1, character.stats.health - damage);
    const loot = 15 + random(36);
    character.berries += loot;
    addBounty(character, 100000 + random(400000));
    message += ` Encuentro con piratas rivales: recibes ${damage} de daño y encuentras ${loot} Berries.`;
  } else if (roll < 0.33) {
    const damage = 7 + random(10);
    character.stats.health = Math.max(1, character.stats.health - damage);

    if (character.faction === "Marina") {
      character.berries += 20;
      message += ` Una patrulla marina te reconoce; recibes apoyo y 20 Berries.`;
    } else {
      addBounty(character, 50000 + random(250000));
      message += ` Una patrulla de la Marina te intercepta. Pierdes ${damage} de salud en la escaramuza.`;
    }
  } else if (roll < 0.43) {
    const damage = 12 + random(16);
    character.stats.health = Math.max(1, character.stats.health - damage);
    message += ` ¡Un Rey del Mar emerge cerca de la embarcación! Pierdes ${damage} de salud.`;
  } else if (roll < 0.63) {
    const loot = 20 + random(81);
    character.berries += loot;
    message += ` Hallas un cofre a la deriva con ${loot} Berries.`;
  } else if (roll < 0.73 && character.location.routeIndex < 2) {
    message += " Una franja de Calm Belt obliga a la tripulación a navegar con cautela.";
  } else {
    message += " La travesía es tranquila; la tripulación repone provisiones.";
    character.berries += 5;
  }

  return message;
}

function train(character) {
  if (character.stats.health < 15) {
    return "Estás demasiado herido para entrenar. Descansa en un puerto primero.";
  }

  character.stats.health = Math.max(1, character.stats.health - 4);
  const stat = pick(["strength", "agility", "ingenuity"]);
  character.stats[stat] += 1;

  const names = {
    strength: "Fuerza",
    agility: "Agilidad",
    ingenuity: "Ingenio"
  };

  let message = `Entrenas con disciplina: ${names[stat]} aumenta a ${character.stats[stat]}.`;
  const leveledUp = gainExperience(character, 35);

  const hakiKeys = Object.keys(character.haki).filter((key) => !character.haki[key]);
  const hakiChance = Math.random();
  let unlocked = null;

  if (hakiKeys.length && hakiChance < 0.24) {
    const available = hakiKeys.filter((key) => key !== "haoshoku");
    if (available.length) unlocked = pick(available);
  }

  if (!character.haki.haoshoku && character.level >= 3 && Math.random() < 0.025) {
    unlocked = "haoshoku";
  }

  if (unlocked) {
    character.haki[unlocked] = true;
    const hakiNames = {
      busoshoku: "Busoshoku (Armadura)",
      kenbunshoku: "Kenbunshoku (Observación)",
      haoshoku: "Haoshoku (Conquistador)"
    };
    message += ` ¡Despiertas el Haki ${hakiNames[unlocked]}!`;
  }

  if (leveledUp) message += ` ¡Subes al nivel ${character.level}!`;
  updateRank(character);
  return message;
}

function searchFruit(character) {
  if (character.fruit) {
    const found = 25 + random(51);
    character.berries += found;
    return `No encuentras otra fruta, pero hallas ${found} Berries entre las provisiones abandonadas.`;
  }

  if (Math.random() < 0.18) {
    character.fruit = pick(FRUITS);
    return `¡Hallazgo extraordinario! Encuentras la ${character.fruit.name} (${character.fruit.type}).`;
  }

  const smallFind = Math.random() < 0.35;
  if (smallFind) {
    const found = 10 + random(31);
    character.berries += found;
    return `No aparece ninguna fruta, pero rescatas ${found} Berries de una caja varada.`;
  }

  return "Buscas por la costa y en los puestos del puerto, pero no encuentras ninguna Akuma no Mi.";
}

function rest(character) {
  const cost = Math.min(character.berries, 10);
  character.berries -= cost;
  const previous = character.stats.health;
  character.stats.health = character.stats.maxHealth;

  if (previous === character.stats.maxHealth) {
    return cost
      ? `Descansas en el puerto y pagas ${cost} Berries. Ya tenías la salud al máximo.`
      : "Descansas un rato en el puerto; ya tenías la salud al máximo.";
  }

  return `Una noche tranquila en el puerto restaura tu salud de ${previous} a ${character.stats.maxHealth}. ${cost ? `Coste: ${cost} Berries.` : "El descanso fue por cuenta de la casa."}`;
}

export function performAction(character, action) {
  let message;

  switch (action) {
    case "navigate":
      message = navigate(character);
      break;
    case "train":
      message = train(character);
      break;
    case "searchFruit":
      message = searchFruit(character);
      break;
    case "rest":
      message = rest(character);
      break;
    default:
      message = "Acción desconocida.";
  }

  addLog(character, message);
  return message;
}
