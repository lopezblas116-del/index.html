const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));
const hash = (value) => [...String(value)].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 7);
const traitsOf = (character) => [...(character?.soulCard?.traits?.pros ?? []), ...(character?.soulCard?.traits?.cons ?? [])];

const PORT_ROSTER = [
  { name: "Nara Vientoazul", role: "Navegante", trait: "Observadora" },
  { name: "Tomo Brasas", role: "Cocinero", trait: "Leal" },
  { name: "Mika Dos Tiros", role: "Tirador", trait: "Impulsiva" },
  { name: "Riku Marea", role: "Navegante", trait: "Prudente" },
  { name: "Sena Azúcar", role: "Cocinera", trait: "Astuta" },
  { name: "Goro Halcón", role: "Tirador", trait: "Valiente" }
];

export function ensureAdvancedSystems(character) {
  if (!character) return character;
  character.inventory ??= { provisions: 3, equipment: [], items: [] };
  character.inventory.water = Math.max(0, Number(character.inventory.water ?? 3) || 0);
  character.crew ??= [];
  character.tavern ??= { port: "", visitors: [] };
  character.tavern.visitors ??= [];
  character.ship ??= { health: 100, maxHealth: 100 };
  character.ship.maxHealth = Math.max(1, Number(character.ship.maxHealth) || 100);
  character.ship.health = clamp(character.ship.health ?? character.ship.maxHealth, 0, character.ship.maxHealth);
  character.travel ??= { docked: true, logPoseCharge: 0, climate: "normal", weather: "clear", speedMultiplier: 1 };
  character.travel.logPoseCharge = clamp(character.travel.logPoseCharge);
  character.nauticalStress ??= { value: 0, moralCompass: character.faction === "Marine" ? 65 : 50, calmBeltDays: 0 };
  character.nauticalStress.value = clamp(character.nauticalStress.value);
  character.nauticalStress.moralCompass = clamp(character.nauticalStress.moralCompass ?? 50);
  character.nauticalStress.calmBeltDays = Math.max(0, Number(character.nauticalStress.calmBeltDays) || 0);
  character.systems ??= { testament: null, treasureMaps: [], dangerMapCreated: false };
  character.systems.treasureMaps ??= [];
  return character;
}

export function climateFor(character) {
  if (["normal", "calm-belt", "grand-line"].includes(character?.climateZone)) return character.climateZone;
  const place = `${character?.climateZone ?? ""} ${character?.navigationTarget?.zone ?? ""} ${character?.location?.region ?? ""} ${character?.navigationTarget?.sea ?? ""}`.toLocaleLowerCase("es");
  if (/calm belt|franja de calma|calm.?belt/.test(place)) return "calm-belt";
  if (/grand line|para[ií]so|nuevo mundo/.test(place) || Number(character?.location?.routeIndex) >= 6) return "grand-line";
  return "normal";
}

export function climateLabel(climate) {
  return ({ normal: "Mar normal", "calm-belt": "Franja de Calma", "grand-line": "Grand Line" })[climate] ?? "Mar normal";
}

export function setClimateZone(character, zone) {
  ensureAdvancedSystems(character);
  if (!["normal", "calm-belt", "grand-line"].includes(zone)) return false;
  character.climateZone = zone;
  character.travel.climate = zone;
  character.travel.speedMultiplier = zone === "calm-belt" ? 0.5 : 1;
  character.log.unshift({ time: new Date().toISOString(), message: `🧭 Ruta fijada: ${climateLabel(zone)}.` });
  return true;
}

export function getTavernCandidates(character) {
  ensureAdvancedSystems(character);
  const port = String(character.location?.island ?? "Puerto actual");
  if (character.tavern.port !== port || !character.tavern.visitors.length) {
    const seed = hash(port);
    character.tavern.port = port;
    character.tavern.visitors = PORT_ROSTER.map((visitor, index) => {
      const selected = PORT_ROSTER[(index + (seed % PORT_ROSTER.length)) % PORT_ROSTER.length];
      return {
        ...selected,
        id: `${port.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
        loyalty: 42 + (hash(`${port}:${selected.name}`) % 49)
      };
    });
  }
  const recruited = new Set(character.crew.map((member) => member.visitorId));
  return character.tavern.visitors.filter((visitor) => !recruited.has(visitor.id));
}

export function tavernAction(character, visitorId, action) {
  ensureAdvancedSystems(character);
  const visitor = getTavernCandidates(character).find((candidate) => candidate.id === visitorId);
  if (!visitor) return { ok: false, message: "Ese nakama ya no está disponible en este puerto." };
  if (action === "round") {
    const cost = 25;
    if (character.berries < cost) return { ok: false, message: `Necesitas ฿${cost} para invitar una ronda.` };
    character.berries -= cost;
    visitor.loyalty = clamp(visitor.loyalty + 20);
    character.log.unshift({ time: new Date().toISOString(), message: `🍻 Invitas una ronda a ${visitor.name}; su lealtad sube a ${visitor.loyalty}%.` });
    return { ok: true, message: `${visitor.name} agradece la ronda. Lealtad: ${visitor.loyalty}%.` };
  }
  if (action === "recruit") {
    const cost = 75;
    if (visitor.loyalty < 60) return { ok: false, message: `${visitor.name} necesita al menos 60% de lealtad antes de unirse.` };
    if (character.berries < cost) return { ok: false, message: `Necesitas ฿${cost} para formalizar el reclutamiento.` };
    character.berries -= cost;
    character.crew.push({ visitorId: visitor.id, name: visitor.name, role: visitor.role, trait: visitor.trait, loyalty: visitor.loyalty, port: character.tavern.port });
    character.log.unshift({ time: new Date().toISOString(), message: `⚓ ${visitor.name} se une a la tripulación como ${visitor.role}.` });
    return { ok: true, message: `¡${visitor.name} se unió a la tripulación!` };
  }
  return { ok: false, message: "Acción de taberna desconocida." };
}

export function advanceAdvancedSystems(character, { action = "", previousIsland = character.location?.island } = {}) {
  ensureAdvancedSystems(character);
  if (character.status === "dead") return;
  const travel = character.travel;
  const moved = previousIsland !== character.location?.island;
  const climate = climateFor(character);
  travel.climate = climate;
  travel.weather = climate === "grand-line" && Math.random() < 0.28 ? "storm" : "clear";
  travel.speedMultiplier = climate === "calm-belt" ? 0.5 : 1;
  travel.docked = !moved;
  if (moved) travel.logPoseCharge = 0;
  else if (travel.docked) travel.logPoseCharge = clamp(travel.logPoseCharge + 10);

  if (action === "navigate") {
    const multiplier = climate === "calm-belt" ? 2 : 1;
    const provisions = character.inventory ?? (character.inventory = { provisions: 0, water: 0 });
    const foodUsed = Math.min(Number(provisions.provisions) || 0, multiplier);
    const waterUsed = Math.min(Number(provisions.water) || 0, multiplier);
    provisions.provisions = Math.max(0, (Number(provisions.provisions) || 0) - foodUsed);
    provisions.water = Math.max(0, (Number(provisions.water) || 0) - waterUsed);
    travel.lastSuppliesUsed = { food: foodUsed, water: waterUsed };
    if (climate === "grand-line") {
      character.ship.health = Math.max(0, character.ship.health - 1);
      if (travel.weather === "storm" && character.ship.health <= character.ship.maxHealth * 0.7) {
        const damage = 4 + Math.floor(Math.random() * 8);
        character.ship.health = Math.max(0, character.ship.health - damage);
        character.log.unshift({ time: new Date().toISOString(), message: `🌩 La tormenta daña la carabela (-${damage} integridad; ${character.ship.health}% restante).` });
      }
    }
  }

  const stress = character.nauticalStress;
  const nearDeath = character.stats.health / Math.max(1, character.stats.maxHealth) <= 0.2;
  const calmBeltDay = climate === "calm-belt";
  if (calmBeltDay) stress.calmBeltDays += 1;
  const stressChange = (nearDeath ? 8 : 0) + (calmBeltDay ? 5 : 0) - (!nearDeath && !calmBeltDay && character.stats.health > character.stats.maxHealth * 0.7 ? 1 : 0);
  if (stressChange) stress.value = clamp(stress.value + stressChange);
  const traits = traitsOf(character);
  if (character.faction === "Marine" && action === "rest") stress.moralCompass = clamp(stress.moralCompass + 1);
  else if (traits.some((trait) => /honrado|leal/i.test(trait))) stress.moralCompass = clamp(stress.moralCompass + 1);
  else if (traits.some((trait) => /agresivo|rebelde/i.test(trait)) && action === "searchFruit") stress.moralCompass = clamp(stress.moralCompass - 1);
  transformTraitsUnderStress(character);
  if (character.stats.health / Math.max(1, character.stats.maxHealth) <= 0.15 && !character.systems.dangerMapCreated) generateTreasureMap(character, "peligro");
}

function transformTraitsUnderStress(character) {
  const stress = character.nauticalStress;
  const pros = character.soulCard?.traits?.pros;
  if (stress.value < 85 || !pros || pros.length < 2 || stress.transformationRecorded) return;
  if (/impulsivo/i.test(pros[1])) {
    pros[1] = "Prudente";
    stress.transformationRecorded = true;
    const message = `🧭 El estrés náutico transforma el rasgo secundario de ${character.name}: Impulsivo → Prudente.`;
    character.log.unshift({ time: new Date().toISOString(), message });
    character.world.news.unshift({ type: "personality", text: message, day: character.world.day || 0 });
  }
}

export function draftTestament(character) {
  ensureAdvancedSystems(character);
  const crew = character.crew.length ? character.crew.map((member) => member.name).join(", ") : "su linaje";
  const writtenAt = new Date().toISOString();
  const text = `Yo, ${character.name}, dejo mi cofre y sus mapas a ${crew}. Que mi linaje continúe el viaje desde ${character.location?.island ?? "el último puerto"}.`;
  character.systems.testament = { text, writtenAt, beneficiary: crew };
  character.log.unshift({ time: writtenAt, message: `📜 ${character.name} redacta su testamento.` });
  return character.systems.testament;
}

export function generateTreasureMap(character, reason = "herencia") {
  ensureAdvancedSystems(character);
  if (character.systems.dangerMapCreated) return character.systems.treasureMaps.at(-1) ?? null;
  const seed = hash(`${character.id}:${character.location?.island}:${character.lineage?.generation}`);
  const map = {
    id: `map-${character.id}-${Date.now()}`,
    island: character.location?.island ?? "Mar abierto",
    x: 100 + (seed % 900),
    y: 80 + ((seed >>> 7) % 600),
    reason,
    createdAt: new Date().toISOString(),
    clue: `Carta de Tesoro Oculto: ${character.location?.island ?? "Mar abierto"} · X:${100 + (seed % 900)} Y:${80 + ((seed >>> 7) % 600)}`
  };
  character.systems.dangerMapCreated = true;
  character.systems.treasureMaps.unshift(map);
  character.world.news.unshift({ type: "treasure-map", text: `🗺 ${map.clue}`, coordinates: { x: map.x, y: map.y }, location: map.island, day: character.world.day || 0 });
  character.world.news = character.world.news.slice(0, 30);
  character.log.unshift({ time: map.createdAt, message: `🗺 ${map.clue} (${reason}).` });
  return map;
}
