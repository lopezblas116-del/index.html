import { getMapIslands } from "./map.js";
import { createLocalFruitLedger } from "./devil_fruits.js";
import { dispatchTypedEvent, EVENT_TYPES } from "./event_dispatcher.js";

export function createLocalWorld() {
  const islands = getMapIslands();
  const arlong = islands.find((island) => island.id === "arlong");
  return {
    islands_control: islands.map((island) => ({
      island_id: island.id, name: island.name, faction: island.control,
      owner_id: null, owner_name: null, tax_rate: 0, taxes: 0, treasury: 0,
      chaos: 0, blockade_until_day: 0, besieged_by: null, defense_level: 0
    })),
    global_events: [], bounties_leaderboard: [], fallen_captains: [],
    bosses: [arlong, ...islands.filter((island) => island.id !== "arlong")].map((island) => ({
      name: island.boss,
      status: "active",
      island_id: island.id,
      hideout: island.name,
      reward: Math.max(100000, (island.coordinates?.x > 700 ? 750000 : 100000) + (island.coordinates?.x || 0) * 100),
      troops: 0
    })),
    devil_fruits: createLocalFruitLedger()
  };
}

function controlledIsland(world, islandId) {
  return world?.islands_control?.find((island) => island.island_id === islandId) || null;
}

function recordWorldEvent(world, event) {
  world.global_events.unshift(event);
  world.global_events = world.global_events.slice(0, 100);
  if (event.type === "invasion" || event.type === "boss_reconquest" || event.type === "boss_arrival") {
    dispatchTypedEvent(EVENT_TYPES.worldEvent, {
      id: event.event_id,
      title: event.type === "invasion" ? "Invasión naval" : event.type === "boss_arrival" ? "Fugitivo a la vista" : "Reconquista de guarida",
      text: event.text,
      location: event.location || "Mar abierto"
    });
  }
}

function startBossVoyage(boss, day) {
  const island = getMapIslands().find((entry) => entry.id === boss.island_id);
  if (!island || !boss.secret_location) return null;
  const from = { x: Number(boss.secret_location.x), y: Number(boss.secret_location.y) };
  const target = { x: island.x, y: island.y };
  const durationDays = Math.max(1, Math.ceil(Math.hypot(target.x - from.x, target.y - from.y) / 350));
  boss.travel = { from, position: { ...from }, target, departedDay: day, durationDays, progress: 0, arrived: false };
  return boss.travel;
}

export function assessPortTax(world, islandId, amount, payerId = null) {
  const island = controlledIsland(world, islandId);
  const gross = Math.max(0, Math.floor(Number(amount) || 0));
  const taxRate = island?.owner_id && island.owner_id === payerId
    ? 0
    : Math.max(0, Math.min(20, Number(island?.tax_rate) || 0));
  const tax = Math.min(gross, Math.floor(gross * taxRate / 100));
  if (island) {
    island.taxes = (Number(island.taxes) || 0) + tax;
    island.treasury = (Number(island.treasury) || 0) + tax;
  }
  return { gross, tax, net: gross - tax, taxRate, ownerId: island?.owner_id || null };
}

export function claimLocalSovereignty(world, captain, islandId, taxRate = 5) {
  const island = controlledIsland(world, islandId);
  const rate = Number(taxRate);
  if (!island || !captain || captain.status === "dead" || captain.captured ||
      captain.location?.atSea || captain.location?.island !== island.name) {
    return { ok: false, message: "La soberanía solo puede reclamarse desde el puerto visitado." };
  }
  if (!Number.isInteger(rate) || rate < 0 || rate > 20) {
    return { ok: false, message: "El impuesto debe ser un entero entre 0% y 20%." };
  }
  if (island.owner_id && island.owner_id !== captain.id) {
    return { ok: false, message: `${island.name} ya pertenece a otra flota.` };
  }
  island.owner_id = captain.id;
  island.owner_name = captain.name;
  island.faction = "Tripulación";
  island.tax_rate = rate;
  island.chaos = 0;
  island.defense_level = Math.min(90, 20 + (Number(captain.level) || 1) * 4 + (captain.crew?.length || 0) * 8);
  island.blockade_until_day = 0;
  island.besieged_by = null;
  const text = `${captain.name} establece soberanía sobre ${island.name} y fija un impuesto portuario del ${rate}%.`;
  recordWorldEvent(world, { event_id: `sovereignty-${island.island_id}-${captain.id}-${Date.now()}`, type: "island_conquered", text, location: island.name, created_at: new Date().toISOString() });
  dispatchTypedEvent(EVENT_TYPES.islandConquered, { islandId: island.island_id, ownerId: captain.id });
  return { ok: true, island, message: text };
}

export function startNavalBlockade(world, captain, islandId, { durationDays = 1, day = 0 } = {}) {
  const island = controlledIsland(world, islandId);
  const mapIsland = getMapIslands(captain).find((entry) => entry.id === islandId);
  const duration = Number(durationDays);
  const distance = mapIsland && captain?.mapPosition
    ? Math.hypot(mapIsland.x - captain.mapPosition.x, mapIsland.y - captain.mapPosition.y)
    : Infinity;
  if (!island || !mapIsland || !captain || captain.status === "dead" || !captain.location?.atSea ||
      distance > 100 || !Number.isInteger(duration) || duration < 1 || duration > 7) {
    return { ok: false, message: "El bloqueo requiere navegar junto a una isla y durar entre 1 y 7 días." };
  }
  if (island.owner_id === captain.id) return { ok: false, message: "No puedes bloquear un puerto bajo tu propia soberanía." };
  const cost = 100 * duration;
  if (Number(captain.berries) < cost) return { ok: false, message: `El bloqueo cuesta ฿${cost} Berries.` };
  captain.berries -= cost;
  island.blockade_until_day = Math.max(Number(island.blockade_until_day) || 0, day + duration);
  island.besieged_by = { id: captain.id, name: captain.name };
  const text = `${captain.name} establece un bloqueo naval frente a ${island.name} durante ${duration} día(s).`;
  recordWorldEvent(world, { event_id: `blockade-${island.island_id}-${captain.id}-${Date.now()}`, type: "blockade", text, location: island.name, created_at: new Date().toISOString() });
  return { ok: true, island, cost, message: text };
}

export function isPortBlockaded(world, islandId, day = 0, captainId = null) {
  const island = controlledIsland(world, islandId);
  return Boolean(island && island.owner_id !== captainId && island.besieged_by?.id !== captainId &&
    Number(island.blockade_until_day) > day);
}

export function advanceLocalWorld(world, day, random = Math.random) {
  if (!Number.isInteger(day) || day <= (world.last_cycle_day ?? 0)) return false;
  for (let cycle = (world.last_cycle_day ?? 0) + 1; cycle <= day; cycle++) {
    for (const island of world.islands_control || []) {
      if (Number(island.blockade_until_day) > 0 && island.blockade_until_day <= cycle) {
        island.blockade_until_day = 0;
        island.besieged_by = null;
        recordWorldEvent(world, { event_id: `blockade-lifted-${island.island_id}-${cycle}`, type: "blockade", text: `El bloqueo naval de ${island.name} ha terminado.`, location: island.name, created_at: new Date().toISOString() });
      }
    }
    for (const boss of world.bosses) {
      if (boss.status !== "imprisoned" || random() >= 0.05) continue;
      boss.status = "fugitive";
      boss.troops = Math.max(2, (Number(boss.troops) || 0) + 2);
      boss.secret_location = { x: Math.floor(random() * 1200), y: Math.floor(random() * 760) };
      startBossVoyage(boss, cycle);
      recordWorldEvent(world, { event_id: `escape-${boss.name}-${cycle}`, type: "escape", text: `Edición especial: ${boss.name} escapó de prisión, reunió ${boss.troops} combatientes y busca recuperar ${boss.hideout || "su guarida"}.`, location: boss.hideout, reward: boss.reward, created_at: new Date().toISOString() });
      dispatchTypedEvent(EVENT_TYPES.worldEvent, { id: `escape-${boss.name}-${cycle}`, title: `Fuga de ${boss.name}`, text: `${boss.name} reúne tropas para recuperar su guarida.`, location: boss.hideout || "Mar abierto" });
    }
    for (const boss of world.bosses) {
      if (boss.status !== "fugitive") continue;
      const voyage = boss.travel || startBossVoyage(boss, cycle);
      if (!voyage || voyage.arrived) continue;
      const progress = Math.max(0, Math.min(1, (cycle - voyage.departedDay) / voyage.durationDays));
      voyage.progress = progress;
      voyage.position = {
        x: voyage.from.x + (voyage.target.x - voyage.from.x) * progress,
        y: voyage.from.y + (voyage.target.y - voyage.from.y) * progress
      };
      boss.secret_location = { ...voyage.position };
      if (progress === 1) {
        voyage.arrived = true;
        voyage.arrivedDay = cycle;
        recordWorldEvent(world, { event_id: `boss-arrival-${boss.island_id}-${cycle}`, type: "boss_arrival", text: `🚨 ${boss.name} llegó a ${boss.hideout} con ${boss.troops} combatientes; el puerto está bajo amenaza de asedio.`, location: boss.hideout, created_at: new Date().toISOString() });
      }
    }
    for (const island of world.islands_control || []) {
      if (!island.owner_id || random() >= 0.06) continue;
      const invader = random() < 0.5 ? "Gobierno Mundial" : "Flota de un Yonko rival";
      const resisted = random() * 100 < Math.max(10, Math.min(90, Number(island.defense_level) || 20));
      const eventId = `invasion-${island.island_id}-${cycle}`;
      if (resisted) {
        recordWorldEvent(world, { event_id: eventId, type: "invasion", text: `${invader} intentó tomar ${island.name}; la guarnición de ${island.owner_name || "la flota"} defendió el puerto.`, location: island.name, created_at: new Date().toISOString() });
      } else {
        const formerOwner = island.owner_name || "la flota";
        island.owner_id = null;
        island.owner_name = null;
        island.faction = "Marina";
        island.tax_rate = 0;
        island.defense_level = 0;
        island.treasury = Math.floor((Number(island.treasury) || 0) * 0.8);
        recordWorldEvent(world, { event_id: eventId, type: "invasion", text: `${invader} arrebató ${island.name} a ${formerOwner} y confiscó parte de su tesorería.`, location: island.name, created_at: new Date().toISOString() });
      }
    }
    for (const boss of world.bosses) {
      if (boss.status !== "fugitive" || !boss.travel?.arrived || cycle <= boss.travel.arrivedDay || random() >= 0.025) continue;
      const island = controlledIsland(world, boss.island_id);
      if (!island?.owner_id) continue;
      const formerOwner = island.owner_name || "la flota";
      island.owner_id = null;
      island.owner_name = null;
      island.faction = "Tirano";
      island.tax_rate = 0;
      island.defense_level = 0;
      boss.status = "active";
      delete boss.secret_location;
      delete boss.travel;
      recordWorldEvent(world, { event_id: `boss-reconquest-${boss.island_id}-${cycle}`, type: "boss_reconquest", text: `${boss.name} volvió a reclutar tropas y recuperó ${island.name} de ${formerOwner}.`, location: island.name, created_at: new Date().toISOString() });
    }
  }
  world.last_cycle_day = day;
  return true;
}

export function applyLocalAction(world, action, actor) {
  if (world.global_events.some((entry) => entry.event_id === action.event_id)) return;
  const data = action.data;
  let text = "";
  if (action.type === "mission") {
    const island = world.islands_control.find((entry) => entry.name === data.island);
    if (island) {
      island.faction = data.faction === "Marine" ? "Marina" : "Tripulación";
      island.owner_id = data.faction === "Marine" ? null : actor.id;
      island.owner_name = data.faction === "Marine" ? null : actor.name;
      island.tax_rate = data.faction === "Marine" ? 0 : 5;
      island.defense_level = data.faction === "Marine" ? 0 :
        Math.min(90, 20 + (Number(data.level) || 1) * 4 + (Number(data.crewSize) || 0) * 8);
      island.chaos = data.faction === "Marine" ? 0 : Math.min(100, island.chaos + 35);
      if (island.chaos >= 70) {
        island.faction = "Marina"; island.owner_id = null; island.owner_name = null; island.tax_rate = 0; island.defense_level = 0; island.chaos = 0;
        text = `⚓ Buster Call: la Marina recupera ${island.name}.`;
        dispatchTypedEvent(EVENT_TYPES.busterCallStarted, { islandId: island.island_id, islandName: island.name });
      }
    }
    if (island) {
      const boss = world.bosses.find((entry) => entry.island_id === island.island_id && entry.status === "active");
      if (boss) { boss.status = "imprisoned"; boss.troops = 0; delete boss.secret_location; text = `⚓ ${boss.name} fue capturado y ${island.name} quedó bajo control de ${actor.name}.`; }
      if (island.owner_id === actor.id) dispatchTypedEvent(EVENT_TYPES.islandConquered, { islandId: island.island_id, ownerId: actor.id });
    }
    text ||= `⚓ ${actor.name} completa una misión en ${data.island}.`;
  } else if (action.type === "bounty") {
    let entry = world.bounties_leaderboard.find((item) => item.captain_id === data.captain_id);
    if (!entry) { entry = { captain_id: data.captain_id, owner_id: actor.id }; world.bounties_leaderboard.push(entry); }
    entry.name = actor.name; entry.bounty = data.bounty;
    const islands = world.islands_control.filter((item) => item.owner_id === actor.id).length;
    if (!entry.yonkou && data.bounty > 1_000_000_000 && islands >= 2) {
      entry.yonkou = true;
      text = `👑 ${actor.name} es declarado YONKOU por el Gobierno.`;
      dispatchTypedEvent(EVENT_TYPES.yonkouDeclared, { captainId: actor.id, captainName: actor.name });
    }
  } else if (action.type === "boss_defeated") {
    const boss = world.bosses.find((entry) => entry.name === data.boss && entry.status === "fugitive");
    const position = boss?.travel?.position || boss?.secret_location;
    if (position && Math.hypot(data.x - position.x, data.y - position.y) <= 80) {
      boss.status = "imprisoned";
      boss.troops = 0;
      delete boss.secret_location;
      delete boss.travel;
      text = `⚓ ${boss.name} vuelve a presidio tras enfrentarse a ${actor.name}.`;
    }
  } else if (action.type === "death") {
    if (!world.fallen_captains.some((entry) => entry.captain_id === data.captain_id)) {
      world.fallen_captains.unshift({ ...data, owner_id: actor.id, name: actor.name });
    }
    if (data.fruit_id) {
      const fruit = world.devil_fruits?.find((entry) => entry.id === data.fruit_id && entry.state === "owned" && (!entry.owner_id || entry.owner_id === data.captain_id));
      if (fruit) { fruit.state = "reincarnating"; fruit.owner_id = null; fruit.rebirth_cycle = (world.last_cycle_day || 0) + 1; }
    }
    text = `☠ ${actor.name} ha caído. Su legado permanece en el Panteón.`;
  } else if (action.type === "tribute_theft") {
    const island = world.islands_control.find((entry) => entry.name === data.island);
    if (island) { island.faction = "Tripulación"; island.owner_id = actor.id; island.owner_name = actor.name; island.chaos = 100; }
    text = `🏴‍☠️ ${actor.name} saquea el tributo en ${data.island}; la Marina retira sus tropas y el puerto cae en anarquía.`;
  } else if (action.type === "port_sabotage") {
    const island = world.islands_control.find((entry) => entry.name === data.island);
    if (island) island.chaos = Math.min(100, island.chaos + 70);
    text = `🕊 La resistencia clandestina abre un refugio en ${data.island}.`;
  } else if (action.type === "noble_attack") {
    const island = world.islands_control.find((entry) => entry.name === data.island);
    if (island) { island.faction = "Marina"; island.owner_id = null; island.owner_name = null; island.chaos = 0; }
    text = `🚨 ALERTA ROJA GLOBAL: ${actor.name} atacó a la comitiva noble; un Almirante y un Buster Call fueron movilizados.`;
  } else if (action.type === "battle") text = `⚔ ${actor.name} protagoniza un combate en ${data.island || "alta mar"}.`;
  else if (action.type === "contract") text = `📜 ${actor.name} ${data.completed ? "completa" : "acepta"} un contrato en ${data.island}.`;
  else if (action.type === "whisper") text = `🗣️ ${actor.name} escucha un susurro.`;
  else if (action.type === "global_chat") text = `${actor.name}: ${String(data.text || "").slice(0, 280)}`;
  if (text) world.global_events.unshift({ event_id: action.event_id, type: action.type, text, location: data.island, created_at: new Date().toISOString() });
}
