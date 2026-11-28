import { getMapIslands } from "./map.js";
import { ensureAncientLanguage } from "./ancient_language.js";
import { proceduralLore } from "./world_lore.js";
import { raceTreatmentAtPort } from "./race_system.js";
import { revolutionaryTrust } from "./lore_engine.js";

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
  character.ship.acquired ??= true;
  character.ship.maxHealth = Math.max(1, Number(character.ship.maxHealth) || 100);
  character.ship.health = clamp(character.ship.health ?? character.ship.maxHealth, 0, character.ship.maxHealth);
  character.inventory.timber = Math.max(0, Number(character.inventory.timber) || 0);
  character.travel ??= { docked: true, logPoseCharge: 0, climate: "normal", weather: "clear", speedMultiplier: 1 };
  character.travel.logPoseCharge = clamp(character.travel.logPoseCharge);
  character.nauticalStress ??= { value: 0, moralCompass: character.faction === "Marine" ? 65 : 50, calmBeltDays: 0 };
  character.nauticalStress.value = clamp(character.nauticalStress.value);
  character.nauticalStress.moralCompass = clamp(character.nauticalStress.moralCompass ?? 50);
  character.nauticalStress.calmBeltDays = Math.max(0, Number(character.nauticalStress.calmBeltDays) || 0);
  character.systems ??= { testament: null, treasureMaps: [], dangerMapCreated: false };
  character.systems.treasureMaps ??= [];
  character.systems.discoveries ??= [];
  character.soulCard ??= { dream: "Libertad", traits: { pros: [], cons: [] } };
  character.soulCard.alignment ??= "Libertad";
  character.soulCard.hiddenTalent ??= ["Cartografía", "Instinto de Tormenta", "Oído Antiguo"][hash(character.id ?? character.name) % 3];
  const avatar = { ...(character.appearance || {}), ...(character.avatarConfig || {}) };
  character.avatarConfig = {
    skin: avatar.skin || "Clara", hair: avatar.hair || "Negro",
    accessory: avatar.accessory || "Ninguno", eyes: avatar.eyes || "Marrón",
    outfit: avatar.outfit || "chaleco-sol", outfitColor: avatar.outfitColor || "", detail: avatar.detail || "Ninguno",
    coat: avatar.coat || "Ninguno",
    race: avatar.race || character.race || "human" // la raza viaja CON la cara (antes se borraba cada tick)
  };
  character.appearance = { ...character.avatarConfig };
  character.avatarActivity ??= "idle";
  ensureAncientLanguage(character);
  return character;
}

export function hasNauticalCrew(character) {
  return (character?.crew || []).some((member) => /^(navegante|carpintero)$/i.test(String(member.role || "").trim()));
}

export function performDockyardAction(character, action, random = Math.random) {
  ensureAdvancedSystems(character);
  if (character.status === "dead" || character.captured || character.location?.atSea) {
    return { ok: false, message: "Solo puedes trabajar en un astillero mientras estés libre y atracado." };
  }
  // el muelle siempre paga: con barco la jornada es de marinero experimentado (฿45),
  // sin barco es la faena que financia el primer casco (฿90)
  if (action === "work") {
    if (character.ship.acquired) {
      const earned = 45;
      character.berries += earned;
      character.log.unshift({ time: new Date().toISOString(), message: `🛠️ Jornada portuaria con tu propio barco amarrado al lado: +฿${earned}. El capataz ya sabe que sos fiable.` });
      return { ok: true, message: `Jornada portuaria: +฿${earned}.` };
    }
    const earned = 90;
    character.berries += earned;
    character.log.unshift({ time: new Date().toISOString(), message: `🛠️ Trabajas en el muelle y ganas ฿${earned} para tu primer barco.` });
    return { ok: true, message: `Trabajo completado: +฿${earned}.` };
  }
  if (character.ship.acquired && action !== "gather") return { ok: false, message: "Ya tienes un barco; el astillero solo ofrece trabajo y reparaciones." };
  if (action === "gather") {
    const timber = 1 + (random() < 0.35 ? 1 : 0);
    character.inventory.timber += timber;
    character.log.unshift({ time: new Date().toISOString(), message: `🪵 Reúnes ${timber} tablón(es) recuperable(s) para construir un barco.` });
    return { ok: true, message: `Materiales reunidos: +${timber} tablón(es).` };
  }
  if (action === "purchase") {
    const cost = 300;
    if (character.berries < cost) return { ok: false, message: `La carabela cuesta ฿${cost}; trabaja en el muelle para reunir Berries.` };
    character.berries -= cost;
  } else if (action === "craft") {
    const cost = 120;
    if (character.inventory.timber < 3 || character.berries < cost) {
      return { ok: false, message: "Construir una chalupa requiere 3 tablones y ฿120 para herrajes y provisiones." };
    }
    character.inventory.timber -= 3;
    character.berries -= cost;
    character.ship.model = "chalupa";
  } else if (action === "steal") {
    if (random() < 0.45) {
      character.ship.model = "carabela robada";
    } else {
      const damage = Math.min(12, Math.max(0, character.stats.health - 1));
      character.stats.health -= damage;
      character.bounty = (Number(character.bounty) || 0) + 5000;
      character.log.unshift({ time: new Date().toISOString(), message: `🚨 Falla el robo del barco: recibes ${damage} de daño y la Marina suma ฿5.000 a tu recompensa.` });
      return { ok: false, message: "El robo fracasa; recibiste daño y la Marina te busca." };
    }
  } else {
    return { ok: false, message: "Método de adquisición de barco desconocido." };
  }

  character.ship.acquired = true;
  character.ship.model ||= "carabela";
  character.ship.health = character.ship.maxHealth;
  character.log.unshift({ time: new Date().toISOString(), message: `⛵ Consigues el barco «${character.ship.model}». Puedes zarpar solo desde Navegación… pero sin navegante, el mar cobra caro.` });
  return { ok: true, message: `¡Ya tienes un barco: ${character.ship.model}! Zarpá desde Navegación; sin navegante el mar cobra caro.` };
}

export function suggestNavigation(character, target, random = Math.random) {
  ensureAdvancedSystems(character);
  if (character.status === "dead" || !Number.isFinite(target?.x) || !Number.isFinite(target?.y) || target.x < 0 || target.x > 1200 || target.y < 0 || target.y > 760) {
    return { ok: false, message: "No hay un destino válido para sugerir." };
  }
  const traits = traitsOf(character).map((trait) => trait.toLocaleLowerCase("es"));
  const affinity = character.whisper?.affinity ?? 55;
  const rebellion = character.whisper?.rebellion ?? 45;
  const chance = clamp(affinity - Math.max(0, rebellion - 50) + (traits.includes("astuto") ? 10 : 0) - (traits.includes("rebelde") ? 15 : 0), 5, 95);
  const accepted = random() * 100 < chance;
  const message = accepted
    ? `🗣️ ${character.name} acepta desviar el rumbo hacia ${target.name || "mar abierto"}.`
    : `🗣️ ${character.name} rechaza el cambio de rumbo y sigue su viaje.`;
  if (accepted) character.redirectTarget = { ...target };
  character.log.unshift({ time: new Date().toISOString(), message });
  return { ok: true, accepted, message };
}

export function discoverAtSea(character, random = Math.random) {
  ensureAdvancedSystems(character);
  if (character.status === "dead" || !character.location?.atSea || !character.mapPosition) return null;
  const discoveries = character.systems.discoveries;
  const chance = Math.min(0.08, (0.003 + (character.stats.ingenuity || 0) * 0.001 + (character.soulCard.hiddenTalent === "Cartografía" ? 0.01 : 0)) * (1 + (character.racialLearning?.talentBonus || 0)));
  if (random() >= chance) return null;
  const alignment = character.soulCard.alignment;
  const id = `sea-${alignment.toLocaleLowerCase("es")}`;
  if (discoveries.some((entry) => entry.id === id)) return null;
  const item = alignment === "Justicia" ? "Diario de una guardia olvidada" : alignment === "Caos" ? "Fragmento de piedra antigua" : "Mapa de la Era Anterior";
  const clue = `Las mareas recuerdan ${alignment.toLocaleLowerCase("es")} donde nadie mira. X:${Math.round(character.mapPosition.x)} Y:${Math.round(character.mapPosition.y)}.`;
  const discovery = { id, item, clue, coordinates: { ...character.mapPosition } };
  if (!character.soulCard.talentRevealed) {
    character.soulCard.talentRevealed = true;
    character.log.unshift({ time: new Date().toISOString(), message: `[BITÁCORA] En la búsqueda aflora su talento nato: ${character.soulCard.hiddenTalent}.` });
  }
  discoveries.push(discovery);
  character.inventory.items.push(item);
  character.log.unshift({ time: new Date().toISOString(), message: `[MISTERIO] ${clue}` });
  character.world.news.unshift({ type: "mystery", text: `[MISTERIO] ${clue}`, coordinates: discovery.coordinates, day: character.world.day });
  character.world.news = character.world.news.slice(0, 60);
  if (character.systems.testament) {
    character.systems.testament.discoveries = [...discoveries];
    character.systems.testament.text += ` Pista heredada: ${clue}`;
  }
  return discovery;
}

export function updateCrewLoyalty(character, arrived, random = Math.random) {
  ensureAdvancedSystems(character);
  if (character.status === "dead") return;
  for (const member of character.crew) {
    member.loyalty = clamp(member.loyalty ?? 50);
    // la desconfianza sembrada por un motín pesa: la lealtad sana más lento
    member.loyalty = clamp(member.loyalty - (character.distrust ? 2 : 0));
    if (random() < 0.12) member.loyalty = clamp(member.loyalty - 5);
  }
  if (!arrived) return;
  character.crew = character.crew.filter((member) => {
    if (member.loyalty >= 30 || random() >= 0.5) return true;
    character.log.unshift({ time: new Date().toISOString(), message: `⚠️ ${member.name} abandona la tripulación en ${character.location.island} por falta de lealtad.` });
    return false;
  });
  attemptMutiny(character, random);
}

// ── en la Grand Line la lealtad se mide en osadía ──
// si la lealtad media del barco se hunde, el más osado puede usurpar el cargo
// del capitán: toma el mando de facto, pero la desconfianza queda sembrada —
// los reclutas futuros llegan mirando de reojo y la lealtad sana más lento.
export function attemptMutiny(character, random = Math.random) {
  if (character.status === "dead" || !(character.crew || []).length || character.usurpedBy) return;
  const media = character.crew.reduce((suma, member) => suma + (member.loyalty || 0), 0) / character.crew.length;
  const umbral = enGrandLine(character) ? 24 : 15; // en la Grand Line la tenacidad manda más
  if (media >= umbral || random() > 0.35) return;
  const rebelde = [...character.crew].sort((a, b) => (b.level || 1) - (a.level || 1))[0];
  if (!rebelde) return;
  character.usurpedBy = rebelde.name;
  character.distrust = true;
  for (const member of character.crew) member.loyalty = clamp((member.loyalty || 0) - 12);
  character.log.unshift({ time: new Date().toISOString(), message: `🏴‍☠️ MOTÍN: ${rebelde.name} usurpó el mando del barco. Capitanea de facto; la desconfianza queda sembrada. Desafialo en la taberna para recuperar tu puesto.` });
  character.whisper ??= {};
  character.whisper.mutiny = { leader: rebelde.name, time: Date.now() };
}

export function enGrandLine(character) {
  return /paraíso|grand line/i.test(String(character?.location?.region || "")) || climateFor(character) === "grand-line";
}

// ── El Tablón de Puerto: encargos con riesgo, de menor a mayor ──
// el papel se renueva cada día en cada isla (determinista: la misma isla y el
// mismo día ofrecen lo mismo — el mar no cambia los encargos por capricho)
export function tablonDelPuerto(character) {
  const isla = character?.location?.island || "—";
  const dia = Number(character?.world?.day) || 1;
  const semilla = hash(`${isla}:${dia}`);
  const ENCARGOS = [
    { id: "muelle", nombre: "Descargar carga en el muelle", riesgo: 1, pago: 45, texto: "Braza y cajas: el trabajo que nadie quiere. Sin gloria y sin heridas." },
    { id: "vigia", nombre: "Turno de vigía nocturno", riesgo: 1, pago: 55, texto: "Mirar el horizonte por otros: los ojos del puerto pagan por hacerlo." },
    { id: "pesca", nombre: "Faena de pesca de altura", riesgo: 1, pago: 60, texto: "Un día en el bote del gremio: escamas, sal y cuentos de Reyes del Mar." },
    { id: "cartas", nombre: "Repartir la correspondencia del puerto", riesgo: 1, pago: 50, texto: "Cartas que no deben abrirse. El porteador que abre, no repite." },
    { id: "filo", nombre: "Afilar el arsenal del gremio", riesgo: 1, pago: 58, texto: "La piedra de amolar gira toda la tarde; los cortadores pagan por el filo." },
    { id: "escolta", nombre: "Escoltar la carreta mercante", riesgo: 2, pago: 110, texto: "Ladrones barateros rondan el camino viejo: puede terminar a golpes." },
    { id: "deuda", nombre: "Cobrar una deuda impaga", riesgo: 2, pago: 95, texto: "El deudor no quiere pagar. Los puños convencen; los huesos recuerdan." },
    { id: "rescate", nombre: "Bajar por un pescador atrapado", riesgo: 2, pago: 120, texto: "La marea subió y la red se enredó: quien baja tiene una cuerda y minutos." },
    { id: "contrabando", nombre: "Interceptar un lote de contrabando", riesgo: 2, pago: 135, texto: "La Marina avisó tarde: el lote pasa al alba por la playa este." },
    { id: "veterinario", nombre: "Curar los caballos de la caravana", riesgo: 2, pago: 105, texto: "Un caballo mordido por algo del mar. Nadie pregunta qué fue." },
    { id: "caceria", nombre: "Cazar al ladrón del mercado", riesgo: 3, pago: 220, texto: "Un cuchillo y laberintos de callejones: puede acabar mal, y paga por eso." },
    { id: "guarida", nombre: "Entrar a la guarida del contrabandista", riesgo: 3, pago: 340, texto: "Dado, ron y mosquetes: la peor combinación de cualquier puerto." },
    { id: "rey", nombre: "Aullido en el arrecife: cazar la bestia", riesgo: 3, pago: 380, texto: "Los pescadores juran ver un Rey del Mar joven. Nadie quiere comprobarlo solo." },
    { id: "tesoro", nombre: "Sondear el naufragio del banco de arena", riesgo: 3, pago: 300, texto: "Un galeón viejo con caja fuerte sin abrir. La marea da dos horas." }
  ];
  const offset = semilla % ENCARGOS.length;
  return [0, 1, 2, 3].map((i) => ENCARGOS[(offset + i) % ENCARGOS.length]);
}

// ── sugerir, no controlar: el jugador señala el encargo, el avatar decide ir ──
export function sugerirEncargo(character, encargo) {
  if (!character || character.status === "dead") return { ok: false, message: "El capitán no puede sugerir nada desde ese estado." };
  if (character.location?.atSea) return { ok: false, message: "El avatar está en mar abierto: primero hay que llegar a puerto." };
  character.localSuggestion = "puerto-tablon";
  character.encargoSugerido = { ...encargo, isla: character.location?.island };
  character.location.localVenue = null;
  character.location.localTarget = null;
  character.autonomy.paused = false; // la sugerencia vuelve a ponerlo en modo autónomo
  character.log.unshift({ time: new Date().toISOString(), message: `📋 Le sugerís a ${character.name}: «${encargo.nombre}» (riesgo ${encargo.riesgo}). Camina hacia el Tablón de Puerto cuando el mar lo deje.` });
  return { ok: true, message: `Sugerencia enviada: ${character.name} irá al tablón por «${encargo.nombre}».` };
}

// la ejecución del encargo: el avatar ya está en el tablón, el mundo responde
export function resolverEncargo(character, random = Math.random) {
  const encargo = character.encargoSugerido;
  if (!encargo) return { message: "El tablón no guarda ningún encargo sugerido." };
  delete character.encargoSugerido;
  const atributo = encargo.riesgo === 3 ? (Number(character.stats?.strength) || 0) : (Number(character.stats?.agility) || 0);
  const exito = random() < ({ 1: 0.92, 2: 0.78, 3: 0.58 }[encargo.riesgo] || 0.8) + Math.min(0.2, atributo / 400);
  if (!exito) {
    const danio = { 1: 5, 2: 12, 3: 22 }[encargo.riesgo] || 8;
    character.stats.health = Math.max(1, character.stats.health - danio);
    character.log.unshift({ time: new Date().toISOString(), message: `🩹 «${encargo.nombre}» terminó mal: ${danio} HP menos. El encargo volvió al tablón con sal salada.` });
    return { message: `«${encargo.nombre}» salió mal (-${danio} HP).` };
  }
  character.berries = (Number(character.berries) || 0) + encargo.pago;
  const experiencia = { 1: 8, 2: 18, 3: 32 }[encargo.riesgo] || 10;
  character.experience = (Number(character.experience) || 0) + experiencia;
  character.avatarActivity = "victory";
  character.log.unshift({ time: new Date().toISOString(), message: `📜 Encargo cumplido: «${encargo.nombre}» (+฿${encargo.pago}, +${experiencia} XP). El tablón anota tu nombre.` });
  return { message: `Encargo cumplido: +฿${encargo.pago}.` };
}
// en los Cuatro Blues cualquiera baja del barco. En la Grand Line la gente que
// entró contigo espera llegar contigo: despedir o desertar despierta furia, y
// la respuesta depende de la severidad del capitán — puede ser la muerte.
export function severidadCapitan(character) {
  const faccion = String(character.faction || "Pirata");
  const base = { Marina: 0.22, Pirata: 0.3, Revolucionario: 0.16, Autonomo: 0.14 }[faccion] ?? 0.3;
  const nivel = (Number(character.level) || 1) / 50; // un capitán curtido no perdona
  return clamp(base + nivel * 0.1, 0.1, 0.5);
}

export function desertarEnGrandLine(character, random = Math.random) {
  if (character.status === "dead" || !enGrandLine(character)) return { riesgo: 0 };
  const severidad = severidadCapitan(character);
  const sobrevive = random() >= severidad;
  const danio = Math.round(10 + severidad * 40);
  const mensaje = sobrevive
    ? `🩸 Dejaste la tripulación en la Grand Line: la furia del barco cayó sobre vos y sobreviviste de milagro (-${danio} HP). Nunca más se te olvida.`
    : `☠ Dejaste la tripulación en la Grand Line y el capitán respondió como responden los severos: la espada cayó. ${character.name} no vuelve a contarla.`;
  return { riesgo: severidad, sobrevive, mensaje, danio };
}

export function climateFor(character) {
  if (["normal", "calm-belt", "grand-line"].includes(character?.climateZone)) return character.climateZone;
  if (character?.location?.atSea && Number.isFinite(character.mapPosition?.y)) {
    const latitude = Math.abs((0.5 - character.mapPosition.y / 760) * Math.PI);
    if (latitude >= 0.175 && latitude <= 0.305) return "calm-belt";
    if (latitude < 0.08) return "grand-line";
    return "normal";
  }
  const place = String(character?.location?.region ?? "").toLocaleLowerCase("es");
  if (/calm belt|franja de calma|calm.?belt/.test(place)) return "calm-belt";
  if (/grand line|para[ií]so|nuevo mundo/.test(place) || Number(character?.location?.routeIndex) >= 6) return "grand-line";
  if (/^(east|west|north|south) blue$/.test(place)) return "normal";
  return proceduralLore(character?.location?.island || place).climate;
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
  for (const visitor of character.tavern.visitors) {
    visitor.attributes ??= {
      strength: 3 + hash(`${visitor.name}:strength`) % 8,
      agility: 3 + hash(`${visitor.name}:agility`) % 8,
      ingenuity: 3 + hash(`${visitor.name}:ingenuity`) % 8
    };
  }
  const recruited = new Set(character.crew.map((member) => member.visitorId));
  return character.tavern.visitors.filter((visitor) => !recruited.has(visitor.id));
}

export function tavernAction(character, visitorId, action, random = Math.random) {
  ensureAdvancedSystems(character);
  if (action === "challenge") {
    // desafío de mando: la única vía limpia para recuperar el puesto usurpado
    if (!character.usurpedBy) return { ok: false, message: "Tu mando está intacto: nadie usurpó nada." };
    const rebelde = character.crew.find((member) => member.name === character.usurpedBy);
    const miNivel = Number(character.level) || 1;
    const suNivel = Number(rebelde?.level) || miNivel + 1;
    const prob = clamp(0.4 + (miNivel - suNivel) * 0.12 + 0.15, 0.15, 0.85);
    if (random() < prob) {
      character.usurpedBy = null;
      character.distrust = false;
      for (const member of character.crew) member.loyalty = clamp((member.loyalty || 0) + 18);
      character.log.unshift({ time: new Date().toISOString(), message: `⚔ Derrotaste a ${rebelde?.name || "el usurpador"} ante la tripulación: el mando vuelve a tu mano y la lealtad se rinde.` });
      character.avatarActivity = "victory";
      return { ok: true, message: "El mando vuelve a tu mano. La desconfianza se disuelve en ron." };
    }
    character.stats.health = Math.max(1, character.stats.health - 15);
    character.log.unshift({ time: new Date().toISOString(), message: `⚔ El desafío falló: ${rebelde?.name || "el usurpador"} te dominó ante la tripulación. La desconfianza crece.` });
    return { ok: false, message: "El desafío falló. El usurpador sigue al timón y tu orgullo sangra." };
  }
  const visitor = getTavernCandidates(character).find((candidate) => candidate.id === visitorId);
  if (!visitor && action !== "dismiss") return { ok: false, message: "Ese nakama ya no está disponible en este puerto." };
  const island = getMapIslands(character).find((entry) => entry.name === character.location?.island);
  const treatment = raceTreatmentAtPort(character.race, island);
  if (action === "dismiss") {
    const idx = character.crew.findIndex((member) => member.visitorId === visitorId || member.id === visitorId || member.name === visitorId);
    if (idx < 0) return { ok: false, message: "Ese nakama no navega contigo." };
    // en la Grand Line la gente que entró contigo espera llegar contigo:
    // despedir es desertar un pedazo del barco, y la severidad del capitán manda
    const desercion = desertarEnGrandLine(character);
    if (desercion.riesgo > 0) {
      character.log.unshift({ time: new Date().toISOString(), message: desercion.mensaje });
      if (!desercion.sobrevive) {
        character.status = "dead";
        character.deathCause = "Deserción en la Grand Line: la severidad del capitán cobró su precio";
        return { ok: false, message: "La deserción en la Grand Line fue tu fin. El linaje continúa la historia." };
      }
      character.stats.health = Math.max(1, character.stats.health - desercion.danio);
      character.distrust = true;
    }
    const [saliente] = character.crew.splice(idx, 1);
    character.log.unshift({ time: new Date().toISOString(), message: `✋ ${saliente.name} (${saliente.role}) queda en ${character.location?.island || "el puerto"}. El barco sigue su rumbo.` });
    return { ok: true, message: `${saliente.name} se queda en el puerto.` };
  }
  if (action === "round") {
    const cost = 25;
    if (character.berries < cost) return { ok: false, message: `Necesitas ฿${cost} para invitar una ronda.` };
    character.berries -= cost;
    visitor.loyalty = clamp(visitor.loyalty + 20);
    character.avatarActivity = "tavern";
    character.log.unshift({ time: new Date().toISOString(), message: `🍻 Invitas una ronda a ${visitor.name}; su lealtad sube a ${visitor.loyalty}%.` });
    return { ok: true, message: `${visitor.name} agradece la ronda. Lealtad: ${visitor.loyalty}%.` };
  }
  if (action === "recruit") {
    // La segregación cierra la taberna para razas no humanas... salvo que la
    // Revolución confíe en ti: sus redes reclutan sin mirar la sangre.
    if (treatment.tavernPolicy === "denied" && revolutionaryTrust(character).discount >= 1) {
      character.log.unshift({ time: new Date().toISOString(), message: `⛓️ La taberna de ${character.location?.island} rechaza tu raza. Quien rompe cadenas para la Revolución encuentra puertas abiertas.` });
      return { ok: false, message: `La taberna de ${character.location?.island} no sirve a tu raza. Gana la confianza de la Revolución (sabotea puertos tiránicos) y sus redes te ayudarán a reclutar.` };
    }
    const cost = 75;
    if (visitor.loyalty < 60) return { ok: false, message: `${visitor.name} necesita al menos 60% de lealtad antes de unirse.` };
    if (character.berries < cost) return { ok: false, message: `Necesitas ฿${cost} para formalizar el reclutamiento.` };
    character.berries -= cost;
    character.crew.push({ visitorId: visitor.id, name: visitor.name, role: visitor.role, trait: visitor.trait, loyalty: visitor.loyalty, attributes: visitor.attributes, port: character.tavern.port });
    character.avatarActivity = "tavern";
    character.log.unshift({ time: new Date().toISOString(), message: `⚓ ${visitor.name} se une a la tripulación como ${visitor.role}.` });
    if (treatment.tavernPolicy === "watched") {
      character.log.unshift({ time: new Date().toISOString(), message: `👁 El reclutamiento quedó registrado: la sangre perseguida atrae ojos del Gobierno en este puerto.` });
    }
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
  const now = (Number(character.world?.day) || 0) * 1440 + (Number(character.world?.minuteOfDay) || 0);
  const gmStorm = now < (Number(character.world?.gm?.stormUntil) || 0);
  travel.weather = gmStorm || (climate === "grand-line" && Math.random() < 0.28) ? "storm" : "clear";
  travel.speedMultiplier = climate === "calm-belt" ? 0.5 : 1;
  travel.docked = !character.location?.atSea;
  if (moved) travel.logPoseCharge = 0;
  else if (travel.docked) travel.logPoseCharge = clamp(travel.logPoseCharge + 10);

  if (action === "navigate") {
    const multiplier = (climate === "calm-belt" && character.race !== "fishman" ? 2 : 1) * (character.race === "giant" ? 2 : 1);
    const provisions = character.inventory ?? (character.inventory = { provisions: 0, water: 0 });
    const foodUsed = Math.min(Number(provisions.provisions) || 0, 1);
    const waterUsed = Math.min(Number(provisions.water) || 0, multiplier);
    provisions.provisions = Math.max(0, (Number(provisions.provisions) || 0) - foodUsed);
    provisions.water = Math.max(0, (Number(provisions.water) || 0) - waterUsed);
    travel.lastSuppliesUsed = { food: foodUsed, water: waterUsed };
    if (climate === "grand-line") {
      character.ship.health = Math.max(0, character.ship.health - 1);
      if (travel.weather === "storm" && character.ship.health <= character.ship.maxHealth * 0.7) {
        const damage = (4 + Math.floor(Math.random() * 8)) * (character.race === "giant" && !character.ship.reinforced ? 2 : 1);
        character.ship.health = Math.max(0, character.ship.health - damage);
        character.log.unshift({ time: new Date().toISOString(), message: `🌩 La tormenta daña la carabela (-${damage} integridad; ${character.ship.health}% restante).` });
      }
    }

    if (character.race === "mink" && (/Whiskey Peak|desierto|árido/i.test(character.location?.island || "") || character.climateZone === "dry")) {
      character.stats.health = Math.max(0, character.stats.health - 3);
      character.log.unshift({ time: new Date().toISOString(), message: "🏜 El clima seco agota a la Mink (-3 HP)." });
    }
    if (character.race === "sky" && character.originSea !== "Grand Line" && Math.random() < 0.08) {
      character.stats.health = Math.max(0, character.stats.health - 2);
      character.log.unshift({ time: new Date().toISOString(), message: "🌊 La densidad del Mar Azul causa malestar al habitante del Cielo (-2 HP)." });
    }
    if (character.location?.atSea && character.fruit) {
      const rescued = character.crew.length > 0 && Math.random() < 0.7;
      if (rescued) {
        character.log.unshift({ time: new Date().toISOString(), message: `🛟 La tripulación rescata a ${character.name}; una Akuma no Mi le impide nadar.` });
      } else {
        character.stats.health = 0;
        character.log.unshift({ time: new Date().toISOString(), message: `🌊 ${character.name} cae al mar y no logra nadar por el poder de su Akuma no Mi.` });
      }
    }
  }

  const stress = character.nauticalStress;
  const nearDeath = character.stats.health / Math.max(1, character.stats.maxHealth) <= 0.2;
  const calmBeltDay = climate === "calm-belt";
  if ((nearDeath || (calmBeltDay && stress.calmBeltDays >= 2)) && character.soulCard.latentTrait) {
    const trait = character.soulCard.latentTrait;
    character.soulCard.traits.cons.push(trait);
    character.soulCard.latentTrait = null;
    character.log.unshift({ time: new Date().toISOString(), message: `[BITÁCORA] Bajo presión aflora un rasgo latente: ${trait}.` });
  }
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
  const discoveries = [...character.systems.discoveries];
  const text = `Yo, ${character.name}, dejo mi cofre y sus mapas a ${crew}. Que mi linaje continúe el viaje desde ${character.location?.island ?? "el último puerto"}.${discoveries.map((entry) => ` Pista heredada: ${entry.clue}`).join("")}`;
  character.systems.testament = { text, writtenAt, beneficiary: crew, discoveries, ancientLanguage: structuredClone(ensureAncientLanguage(character)) };
  character.log.unshift({ time: writtenAt, message: `📜 ${character.name} redacta su testamento.` });
  return character.systems.testament;
}

export function generateTreasureMap(character, reason = "herencia") {
  ensureAdvancedSystems(character);
  if (reason === "muerte" && character.systems.deathMapCreated) return character.systems.treasureMaps.find((entry) => entry.reason === "muerte") ?? null;
  if (reason !== "muerte" && character.systems.dangerMapCreated) return character.systems.treasureMaps.find((entry) => entry.reason !== "muerte") ?? null;
  const seed = hash(`${character.id}:${character.location?.island}:${character.lineage?.generation}`);
  const position = character.mapPosition ?? getMapIslands(character).find((island) => island.name === character.location?.island);
  const x = Number.isFinite(position?.x) ? Math.round(position.x) : 100 + (seed % 900);
  const y = Number.isFinite(position?.y) ? Math.round(position.y) : 80 + ((seed >>> 7) % 600);
  const place = character.location?.atSea ? "Mar abierto" : character.location?.island ?? "Mar abierto";
  const map = {
    id: `map-${character.id}-${Date.now()}`,
    island: place,
    x,
    y,
    reason,
    createdAt: new Date().toISOString(),
    clue: `Carta de Tesoro Oculto: ${place} · X:${x} Y:${y}`
  };
  character.systems.dangerMapCreated = true;
  if (reason === "muerte") character.systems.deathMapCreated = true;
  character.systems.treasureMaps.unshift(map);
  character.world.news.unshift({ type: "treasure-map", text: `🗺 ${map.clue}`, coordinates: { x: map.x, y: map.y }, location: map.island, day: character.world.day || 0 });
  character.world.news = character.world.news.slice(0, 30);
  character.log.unshift({ time: map.createdAt, message: `🗺 ${map.clue} (${reason}).` });
  return map;
}
