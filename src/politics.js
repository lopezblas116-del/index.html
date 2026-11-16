import { getMapIslands } from "./map.js";

const log = (character, message) => {
  character.log.unshift({ time: new Date().toISOString(), message });
  character.log = character.log.slice(0, 80);
};

function currentIsland(character) {
  return getMapIslands(character).find((island) => island.name === character.location?.island);
}

export function lootCelestialTribute(character, world) {
  const island = currentIsland(character);
  if (character.status === "dead" || character.captured || character.location?.atSea || !island?.affiliated) {
    return { ok: false, message: "No hay un tributo celestial accesible en este puerto." };
  }
  if ((Number(character.world.day) || 0) % 7 === 0) return { ok: false, message: "La Marina ya cobró el tributo de este ciclo." };
  const berries = 300 + Math.floor(Math.random() * 201);
  character.berries += berries;
  character.world.news.unshift({ type: "politics", text: `🏴‍☠️ ${character.name} saquea el tributo celestial de ${island.name}; la Marina retira sus tropas y el puerto cae en anarquía.`, day: character.world.day, location: island.name });
  log(character, `💰 Tributo celestial saqueado en ${island.name}: +฿${berries}. La guarnición se retira.`);
  return { ok: true, type: "tribute_theft", island: island.name, berries, message: `Tributo saqueado: +฿${berries}. La Marina abandona el puerto.` };
}

export function sabotageTyrantPort(character, world) {
  const island = currentIsland(character);
  const control = world?.islands_control?.find((entry) => entry.island_id === island?.id);
  const faction = control?.faction || island?.control;
  if (character.status === "dead" || character.captured || character.location?.atSea || !island || faction !== "Tirano") {
    return { ok: false, message: "No hay un puerto tiránico accesible para sabotear." };
  }
  if (!["Libertad", "Caos"].includes(character.soulCard?.alignment)) {
    return { ok: false, message: "Tu brújula ideológica no encuentra apoyo revolucionario aquí." };
  }
  character.revolutionarySupport ??= { hideout: false, supplies: 0 };
  character.revolutionarySupport.hideout = true;
  character.revolutionarySupport.supplies += 1;
  character.inventory.items.push("Suministro revolucionario");
  character.world.news.unshift({ type: "revolutionary", text: `🕊 La resistencia clandestina abre un refugio en ${island.name}.`, day: character.world.day, location: island.name });
  log(character, `🕊 Sabotaje en ${island.name}: el Ejército Revolucionario ofrece un refugio y suministros.`);
  return { ok: true, type: "port_sabotage", island: island.name, message: "Refugio revolucionario desbloqueado; recibes suministros." };
}

export function attackWorldNoble(character, world) {
  const island = currentIsland(character);
  if (character.status === "dead" || character.captured || character.location?.atSea || !island) {
    return { ok: false, message: "La comitiva solo puede ser interceptada en un puerto." };
  }
  character.world.nobleAlert = true;
  character.bounty = Math.max(0, Number(character.bounty) || 0) + 10_000_000;
  character.world.news.unshift({ type: "world-noble", text: `🚨 ALERTA ROJA GLOBAL: ${character.name} atacó a la comitiva noble en ${island.name}. Un Almirante y una flota Buster Call han sido movilizados.`, day: character.world.day, location: island.name });
  log(character, `🚨 Ataque a la comitiva noble: alerta global, +฿10.000.000 de recompensa y respuesta inmediata de la Marina.`);
  return { ok: true, type: "noble_attack", island: island.name, message: "Alerta roja global: un Almirante y un Buster Call responden al ataque." };
}

export function maybeCaptureAtAuction(character, random = Math.random) {
  const island = currentIsland(character);
  if (character.status === "dead" || character.captured || character.race === "human" || !island?.auctionHouse || random() >= 0.35) return false;
  const ransom = 200 + Math.floor(random() * 501);
  character.captured = { island: island.name, ransom, day: character.world.day };
  log(character, `⛓️ ${character.name} es capturado en ${island.name} y vendido en una subasta clandestina. Rescate: ฿${ransom} o infiltración de la tripulación.`);
  return true;
}

export function resolveCapture(character, method, random = Math.random) {
  const capture = character.captured;
  if (!capture || character.status === "dead") return { ok: false, message: "No hay un cautivo que rescatar." };
  if (method === "ransom") {
    if (character.berries < capture.ransom) return { ok: false, message: `El rescate cuesta ฿${capture.ransom}; no tienes suficientes Berries.` };
    character.berries -= capture.ransom;
  } else if (method === "infiltrate") {
    if (!character.crew?.length) return { ok: false, message: "Necesitas al menos un nakama para organizar la infiltración." };
    const chance = Math.min(0.9, 0.4 + character.crew.length * 0.1 + (character.stats.ingenuity || 0) * 0.01);
    if (random() >= chance) {
      character.crew[0].loyalty = Math.max(0, character.crew[0].loyalty - 10);
      log(character, `🕵️ La infiltración falla; ${character.crew[0].name} queda bajo sospecha.`);
      return { ok: false, message: "La infiltración falla; la tripulación tendrá que volver a intentarlo." };
    }
  } else return { ok: false, message: "Método de rescate desconocido." };
  delete character.captured;
  character.autonomy.lastPulseAt = Date.now();
  log(character, `🛟 ${character.name} es liberado de la subasta clandestina mediante ${method === "ransom" ? "el pago del rescate" : "una infiltración"}.`);
  return { ok: true, message: "¡Rescate completado! El avatar vuelve a la aventura." };
}
