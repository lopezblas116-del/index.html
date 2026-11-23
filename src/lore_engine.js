/**
 * Motor de profundidad del mundo: cada acción deja una huella política
 * con causa y efecto visible. Temas existentes (Gobierno Mundial, Marina,
 * Ejército Revolucionario, Yonko, Tiranos, subastas, razas) — nada nuevo.
 *
 * Cadenas implementadas:
 *  · Saquear el tributo celestial → la guarnición se retira → la Marina
 *    mantiene un patrón de vigilancia 3 días en el mar (encuentros navales
 *    más probables) y los Dragones Celestiales bajan la oferta por tu captura.
 *  · Sabotear un puerto tiránico → la Revolución gana confianza → sus
 *    contactos proveen suministros más baratos y reclutan sin mirar la raza.
 *  · Atacar a un noble → alerta roja → patrón naval severo 5 días y los
 *    muelles vigilados encarecen las compras.
 *  · Impuestos abusivos en una soberanía propia → el puerto se revuelve
 *    (caos creciente día a día) → revuelta que devuelve la isla al caos.
 */

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));

export function ensurePoliticalStance(character) {
  if (!character) return null;
  character.politicalStance ??= {
    marineFavor: 50,
    revolutionarySympathy: 0,
    underworldRenown: 0,
    patrolUntilDay: 0,
    echoes: 0
  };
  const stance = character.politicalStance;
  stance.marineFavor = clamp(stance.marineFavor);
  stance.revolutionarySympathy = clamp(stance.revolutionarySympathy);
  stance.underworldRenown = clamp(stance.underworldRenown);
  stance.patrolUntilDay = Math.max(0, Number(stance.patrolUntilDay) || 0);
  stance.echoes = Math.max(0, Number(stance.echoes) || 0);
  // la bandera elegida alimenta la política: el Ejército reconoce a los suyos de entrada
  if (character.faction === "Revolucionario" && stance.revolutionarySympathy < 55) stance.revolutionarySympathy = 55;
  return stance;
}

function pushWorldNews(character, type, text, islandName) {
  character.world.news.unshift({ type, text, day: character.world.day, location: islandName });
  character.world.news = character.world.news.slice(0, 60);
}

const ECHOES = {
  tribute: {
    shifts: { marineFavor: -12, revolutionarySympathy: 8, underworldRenown: 6 },
    patrolDays: 3,
    news: (island) => ({
      type: "politics",
      text: `🏴‍☠️ Sin el tributo de ${island}, la guarnición abandona el puerto y la Marina fija un patrón de vigilancia. Los Dragones Celestiales exigieron cabeza: quien esté cerca del mar será revisado.`
    }),
    log: (island) => `⚖️ Eco político: el vacío del tributo en ${island} enciende a la Revolución (+8) y la Marina te vigila 3 días.`
  },
  sabotage: {
    shifts: { revolutionarySympathy: 12, underworldRenown: 3 },
    patrolDays: 0,
    news: (island) => ({
      type: "revolutionary",
      text: `🕊 El Ejército Revolucionario distribuye un panfleto con tu nombre tras el sabotaje en ${island}: "quien rompe cadenas encuentra puertas abiertas".`
    }),
    log: () => `🕊 Eco político: la Revolución registra tu sabotaje (+12 confianza). Sus contactos tratarán tu carga con buen precio.`
  },
  noble: {
    shifts: { marineFavor: -40, revolutionarySympathy: 4, underworldRenown: 15 },
    patrolDays: 5,
    news: (island) => ({
      type: "world-noble",
      text: `🚨 Tras el ataque a la comitiva de ${island}, el Gobierno Mundial movilizó un Buster Call preventivo. Los muelles revisan cada casco y los precios portuarios suben para los buscados.`
    }),
    log: () => `🚨 Eco político: alerta roja mundial (-40 favor de la Marina). Patrón naval severo durante 5 días.`
  }
};

export function recordPoliticalEcho(character, kind, islandName, random = Math.random) {
  const echo = ECHOES[kind];
  const stance = ensurePoliticalStance(character);
  if (!echo || !stance || character.status === "dead") return null;
  const day = Number(character.world?.day) || 0;
  for (const [key, shift] of Object.entries(echo.shifts)) stance[key] = clamp(stance[key] + shift);
  if (echo.patrolDays) stance.patrolUntilDay = Math.max(stance.patrolUntilDay, day + echo.patrolDays);
  stance.echoes += 1;
  const island = islandName || character.location?.island || "puerto desconocido";
  const news = echo.news(island);
  if (random() < 0.85) pushWorldNews(character, news.type, news.text, island);
  character.log.unshift({ time: new Date().toISOString(), message: echo.log(island) });
  character.log = character.log.slice(0, 80);
  return { ...stance, echo: kind };
}

export function marinePatrolActive(character) {
  const stance = character?.politicalStance;
  if (!stance) return false;
  return (Number(character.world?.day) || 0) < Number(stance.patrolUntilDay || 0);
}

export function revolutionaryTrust(character) {
  const sympathy = Number(character?.politicalStance?.revolutionarySympathy) || 0;
  if (sympathy >= 70) return { level: "Camarada de confianza", discount: 0.9 };
  if (sympathy >= 40) return { level: "Aliado de paso", discount: 0.95 };
  return { level: "Indiferente", discount: 1 };
}

// Ajuste de precios portuario por postura política (discriminación de facción,
// espejo de la discriminación racial de race_system.js).
export function politicalTradeAdjustment(character) {
  const stance = ensurePoliticalStance(character);
  const reasons = [];
  let buy = 1;
  let sell = 1;
  if (stance) {
    const trust = revolutionaryTrust(character);
    if (trust.discount < 1) {
      buy *= trust.discount;
      reasons.push(`la Revolución provee a sus ${trust.level.toLowerCase()}`);
    }
    if (stance.underworldRenown >= 60) {
      sell *= 1.1;
      reasons.push("los contactos del hampa pagan mejor tus mercancías");
    }
    if (marinePatrolActive(character) && ["Pirata", "Revolucionario"].includes(character.faction)) {
      buy *= 1.15;
      reasons.push("los muelles vigilados cobran de más a los buscados");
    }
  }
  return { buy, sell, reasons };
}

// Sesgo de encuentros en alta mar: con patrón naval la Marina domina el mar.
export function patrolEncounterBias(character) {
  if (!marinePatrolActive(character)) return null;
  return {
    weights: { "Barco Pirata": 0.2, "Marina": 0.6, "Monstruo Marino": 0.2 },
    note: "Un patrón naval cruza la ruta: predominio de banderas de la Marina."
  };
}

export function pickWeightedEnemy(character, random = Math.random) {
  const bias = patrolEncounterBias(character);
  if (!bias) return null;
  const roll = random();
  let cumulative = 0;
  for (const [enemy, weight] of Object.entries(bias.weights)) {
    cumulative += weight;
    if (roll <= cumulative) return enemy;
  }
  return "Marina";
}

// Lectura para la interfaz: una línea que resume la marea política.
export function describePoliticalStance(character) {
  const stance = ensurePoliticalStance(character);
  if (!stance) return "Sin registro político.";
  const patrol = marinePatrolActive(character);
  const trust = revolutionaryTrust(character);
  const parts = [
    `Marina: ${stance.marineFavor >= 60 ? "confía" : stance.marineFavor >= 30 ? "cauta" : "te caza"}`,
    `Revolución: ${trust.level}`,
    `Hampa: ${stance.underworldRenown >= 60 ? "contactos activos" : "sin renombre"}`,
    patrol ? "Patrón naval en curso" : "Sin patrón naval"
  ];
  return parts.join(" · ");
}
