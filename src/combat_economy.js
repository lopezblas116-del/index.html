import { ensureBlockOneData } from "./block1.js";
import { getMapIslands } from "./map.js";
import { cargoCapacity } from "./races.js";
import { awardBerries } from "./gm_engine.js";

const GOODS = {
  wood: { label: "Madera", price: 20, kind: "items" },
  water: { label: "Agua", price: 10, kind: "water" },
  rum: { label: "Ron", price: 18, kind: "items" },
  weapon: { label: "Arma de puerto", price: 60, kind: "equipment" },
  reinforcedHull: { label: "Casco reforzado", price: 500, kind: "ship" }
};
const ENEMIES = ["Barco Pirata", "Marina", "Monstruo Marino"];
const log = (character, message) => {
  character.log.unshift({ time: new Date().toISOString(), message });
  character.log = character.log.slice(0, 80);
};
const hash = (value) => [...String(value)].reduce((result, char) => (result * 31 + char.charCodeAt(0)) >>> 0, 7);

export function marketPrices(character) {
  const port = character.location?.island || "Puerto";
  const day = Number(character.world?.day) || 0;
  const island = getMapIslands(character).find((entry) => entry.name === port);
  return Object.fromEntries(Object.entries(GOODS).map(([id, good]) => {
    const change = (hash(`${port}:${day}:${id}`) % 41 - 20) / 100;
    const specialty = island?.specialty === id ? 0.75 : 1;
    const discrimination = island?.segregated && character.race && character.race !== "human" ? 1.5 : 1;
    return [id, { ...good, buy: Math.max(1, Math.round(good.price * (1 + change) * specialty * discrimination)), sell: Math.max(1, Math.round(good.price * (1 + change) * specialty / discrimination * 0.6)) }];
  }));
}
export function trade(character, id, action) {
  ensureBlockOneData(character);
  if (character.status === "dead" || character.location?.atSea) return { ok: false, message: "El mercado solo está disponible en puerto." };
  const prices = marketPrices(character);
  if (!Object.hasOwn(prices, id) || !["buy", "sell"].includes(action)) return { ok: false, message: "Operación de mercado inválida." };
  const good = prices[id];
  const inv = character.inventory;
  const carried = inv.items.length + inv.equipment.length + inv.provisions;
  if (action === "buy" && carried >= cargoCapacity(character.race)) return { ok: false, message: "La capacidad de carga de esta raza está completa." };
  if (action === "buy" && id === "reinforcedHull" && character.race === "fishman" && getMapIslands(character).find((island) => island.name === character.location.island)?.segregated) return { ok: false, message: "El astillero rechaza atender a esta raza en este puerto." };
  if (action === "buy") {
    if (character.berries < good.buy) return { ok: false, message: "No tienes suficientes Berries." };
    character.berries -= good.buy;
    if (good.kind === "ship") character.ship.reinforced = true;
    else if (good.kind === "water") inv.water = (Number(inv.water) || 0) + 1;
    else inv[good.kind].push(good.label);
    log(character, `⚓ Compra ${good.label} por ฿${good.buy} en ${character.location.island}.`);
    return { ok: true, message: `Compraste ${good.label} por ฿${good.buy}.` };
  }
  const ref = { kind: good.kind === "equipment" ? "equipment" : "item", name: good.label };
  if (character.whisper.priorityItems.some((item) => item.kind === ref.kind && item.name === ref.name)) {
    return { ok: false, message: "Ese objeto está marcado como prioritario." };
  }
  if (good.kind === "water") {
    if (!(inv.water > 0)) return { ok: false, message: "No hay agua para vender." };
    inv.water -= 1;
  } else {
    const index = inv[good.kind].indexOf(good.label);
    if (index < 0) return { ok: false, message: `No tienes ${good.label} para vender.` };
    inv[good.kind].splice(index, 1);
  }
  const earned = awardBerries(character, good.sell);
  log(character, `⚓ Vende ${good.label} por ฿${earned} en ${character.location.island}.`);
  return { ok: true, message: `Vendiste ${good.label} por ฿${earned}.` };
}

export function seaEncounter(character, random = Math.random) {
  ensureBlockOneData(character);
  if (character.status === "dead" || random() >= 0.18) return null;
  const enemy = ENEMIES[Math.floor(random() * ENEMIES.length)];
  const traits = [...(character.soulCard?.traits?.pros ?? []), ...(character.soulCard?.traits?.cons ?? [])].map((trait) => trait.toLocaleLowerCase("es"));
  const cautious = traits.some((trait) => ["prudente", "cauteloso", "astuto"].includes(trait));
  const bold = traits.some((trait) => ["impulsivo", "agresivo"].includes(trait));
  if (cautious && character.stats.health < character.stats.maxHealth * 0.3) {
    log(character, `[COMBATE] ${character.name} huye de ${enemy}: salud crítica y prudencia.`);
    return { enemy, fled: true };
  }
  let enemyHealth = 20 + character.level * 3;
  let turn = 0;
  log(character, `[COMBATE] Encuentro en alta mar: ${enemy}. ${bold ? "Ataque total." : "Maniobras defensivas."}`);
  while (enemyHealth > 0 && character.stats.health > 0 && turn < 8) {
    if (cautious && character.stats.health < character.stats.maxHealth * 0.3) {
      log(character, `[COMBATE] ${character.name} huye de ${enemy}: salud crítica y prudencia.`);
      return { enemy, fled: true };
    }
    turn += 1;
    const hit = Math.max(1, character.stats.strength + Math.floor(random() * 6) + (bold ? 5 : 1));
    enemyHealth = Math.max(0, enemyHealth - hit);
    let damage = 0;
    if (enemyHealth > 0) {
      damage = Math.max(1, 4 + Math.floor(random() * 7) + (bold ? 3 : 0) - Math.floor(character.stats.agility / 5));
      character.stats.health = Math.max(0, character.stats.health - damage);
    }
    log(character, `[COMBATE] Turno ${turn}: ${enemy} recibe ${hit}; ${character.name} pierde ${damage} HP.`);
  }
  if (character.stats.health <= 0) {
    log(character, `[COMBATE] ${character.name} cae ante ${enemy}.`);
    return { enemy, dead: true };
  }
  if (enemyHealth > 0) {
    log(character, `[COMBATE] ${enemy} se retira tras ${turn} turnos.`);
    return { enemy, fled: true };
  }
  const booty = ["Madera", "Ron", "Arma de puerto"][Math.floor(random() * 3)];
  if (booty === "Arma de puerto") character.inventory.equipment.push(booty);
  else character.inventory.items.push(booty);
  const berries = awardBerries(character, 40);
  const before = character.bounty;
  if (character.faction === "Pirata") character.bounty = Math.max(0, before + (enemy === "Marina" ? 5000 : enemy === "Barco Pirata" ? 2000 : -500));
  log(character, `[COMBATE] Victoria sobre ${enemy}. Botín: ${booty} y ฿${berries}.`);
  if (character.bounty !== before) {
    const text = `📜 SE BUSCA · ${character.name} · Recompensa: ฿${character.bounty} Berries.`;
    character.world.news.unshift({ type: "bounty", text, day: character.world.day, location: character.location?.atSea ? undefined : character.location?.island, coordinates: character.location?.atSea ? character.mapPosition : undefined });
    character.world.news = character.world.news.slice(0, 60);
    log(character, text);
  }
  return { enemy, won: true, booty };
}
