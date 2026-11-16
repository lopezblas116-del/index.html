import { getMapIslands } from "./map.js";

export function createLocalWorld() {
  return {
    islands_control: getMapIslands().map((island) => ({
      island_id: island.id, name: island.name, faction: island.control,
      owner_id: null, owner_name: null, taxes: 0, chaos: 0
    })),
    global_events: [], bounties_leaderboard: [], fallen_captains: [],
    bosses: [{ name: "Arlong", status: "active", island_id: "arlong" }]
  };
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
  } else if (action.type === "death") {
    if (!world.fallen_captains.some((entry) => entry.captain_id === data.captain_id)) {
      world.fallen_captains.unshift({ ...data, owner_id: actor.id, name: actor.name });
    }
    text = `☠ ${actor.name} ha caído. Su legado permanece en el Panteón.`;
  } else if (action.type === "battle") text = `⚔ ${actor.name} protagoniza un combate en ${data.island || "alta mar"}.`;
  else if (action.type === "contract") text = `📜 ${actor.name} ${data.completed ? "completa" : "acepta"} un contrato en ${data.island}.`;
  else if (action.type === "whisper") text = `🗣️ ${actor.name} escucha un susurro.`;
  if (text) world.global_events.unshift({ event_id: action.event_id, type: action.type, text, location: data.island, created_at: new Date().toISOString() });
}
