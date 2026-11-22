export const RACES = {
  human: { name: "Humano", tagline: "Aprendizaje y voluntad", base: true },
  fishman: { name: "Gyojin / Tritón", tagline: "Respira y domina rutas submarinas; sufre discriminación en puertos segregados.", base: true },
  mink: { name: "Mink", tagline: "Agilidad y resistencia eléctrica; el clima seco agota su cuerpo.", base: true },
  threeeye: { name: "Tribu de los Tres Ojos", tagline: "Sentidos agudos y afinidad por los textos antiguos.", base: true },
  giant: { name: "Gigante / Semi-gigante", tagline: "Gran fuerza y salud; consume el doble y requiere un casco reforzado.", base: true },
  sky: { name: "Habitante del Cielo", tagline: "Adaptación a la altura; el Mar Azul puede causarle malestar.", base: true },
  longlimb: { name: "Tribu de Extremidades Largas", tagline: "Alcance marcial; dificultades para infiltrarse en espacios estrechos.", base: true },
  tontatta: { name: "Tontatta", tagline: "Sigilo y fuerza; capacidad de carga limitada y vulnerable a ataques de área.", base: true },
  buccaneer: { name: "Bucanero", tagline: "Sangre extraordinaria y perseguida. Solo aparece por RNG de linaje.", base: false, rare: true },
  lunarian: { name: "Lunarian", tagline: "Llama protectora y cacería del Gobierno. Solo aparece por RNG de linaje.", base: false, rare: true }
};

export function normalizeRace(race, { allowRare = false } = {}) {
  const entry = RACES[race];
  return entry && (allowRare || !entry.rare) ? race : "human";
}

export function rollLineageRace(parentRace, random = Math.random) {
  if (parentRace === "lunarian" && random() < 0.002) return "lunarian";
  if (parentRace === "buccaneer" && random() < 0.002) return "buccaneer";
  if (parentRace && RACES[parentRace]?.base && random() < 0.65) return parentRace;
  const roll = random();
  if (roll < 0.002) return "lunarian";
  if (roll < 0.004) return "buccaneer";
  const common = Object.keys(RACES).filter((race) => RACES[race].base);
  return common[Math.floor(random() * common.length)];
}

export function raceStats(race) {
  return ({
    human: { health: 0, strength: 0, agility: 0 },
    fishman: { health: 5, strength: 1, agility: 0 },
    mink: { health: 0, strength: 0, agility: 2 },
    threeeye: { health: 0, strength: 0, agility: 1 },
    giant: { health: 40, strength: 4, agility: -1 },
    sky: { health: 0, strength: 0, agility: 1 },
    longlimb: { health: 0, strength: 1, agility: 1 },
    tontatta: { health: -10, strength: 2, agility: 2 },
    buccaneer: { health: 25, strength: 2, agility: 0 },
    lunarian: { health: 20, strength: 1, agility: 0 }
  })[race] ?? { health: 0, strength: 0, agility: 0 };
}

export function cargoCapacity(race) {
  return race === "tontatta" ? 6 : race === "giant" || race === "buccaneer" ? 30 : 20;
}

export function isRacePursued(race) {
  return race === "buccaneer" || race === "lunarian";
}
