import { getMapIslands } from "./map.js";
import { createLocalFruitLedger } from "./devil_fruits.js";

export function createLocalWorld() {
  return {
    islands_control: getMapIslands().map((island) => ({
      island_id: island.id, name: island.name, faction: island.control,
      owner_id: null, owner_name: null, taxes: 0, chaos: 0
    })),
    global_events: [], bounties_leaderboard: [], fallen_captains: [],
    bosses: [{ name: "Arlong", status: "active", island_id: "arlong" }],
    devil_fruits: createLocalFruitLedger()
  };
}

export function advanceLocalWorld(world, day, random = Math.random) {
  if (!Number.isInteger(day) || day <= (world.last_cycle_day ?? 0)) return false;
  for (let cycle = (world.last_cycle_day ?? 0) + 1; cycle <= day; cycle++) {
    for (const boss of world.bosses) {
      if (boss.status !== "imprisoned" || random() >= 0.05) continue;
      boss.status = "fugitive";
      boss.island_id = null;
      boss.secret_location = { x: Math.floor(random() * 1200), y: Math.floor(random() * 760) };
      world.global_events.unshift({ event_id: `escape-${boss.name}-${cycle}`, type: "escape", text: `🚨 Edición especial: ${boss.name} escapó de prisión y opera en paradero desconocido.`, created_at: new Date().toISOString() });
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
      island.chaos = data.faction === "Marine" ? 0 : Math.min(100, island.chaos + 35);
      if (island.chaos >= 70) {
        island.faction = "Marina"; island.owner_id = null; island.owner_name = null; island.chaos = 0;
        text = `⚓ Buster Call: la Marina recupera ${island.name}.`;
      }
    }
    if (island?.island_id === "arlong") {
      const boss = world.bosses.find((entry) => entry.name === "Arlong");
      if (boss?.status === "active") { boss.status = "imprisoned"; text = "⚓ Arlong ha sido encarcelado."; }
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
    }
  } else if (action.type === "boss_defeated") {
    const boss = world.bosses.find((entry) => entry.name === data.boss && entry.status === "fugitive");
    if (boss?.secret_location && Math.hypot(data.x - boss.secret_location.x, data.y - boss.secret_location.y) <= 80) {
      boss.status = "imprisoned";
      delete boss.secret_location;
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
