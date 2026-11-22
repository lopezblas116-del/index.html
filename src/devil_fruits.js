export const DEVIL_FRUITS = [
  { id: "bara-bara", name: "Bara Bara no Mi", type: "Paramecia", technique: "Bara Bara Festival", bonus: 9, x: 410, y: 145 },
  { id: "mera-mera", name: "Mera Mera no Mi", type: "Logia", technique: "Hiken", bonus: 12, x: 440, y: 90 },
  { id: "tori-tori-phoenix", name: "Tori Tori no Mi, modelo Fénix", type: "Zoan mitológica", technique: "Regeneración del Fénix", bonus: 10, x: 1060, y: 190 },
  { id: "hito-hito-daibutsu", name: "Hito Hito no Mi, modelo Daibutsu", type: "Zoan mitológica", technique: "Impacto Daibutsu", bonus: 13, x: 840, y: 650 },
  { id: "noro-noro", name: "Noro Noro no Mi", type: "Paramecia", technique: "Rayo Noroma", bonus: 8, x: 70, y: 210 },
  { id: "suna-suna", name: "Suna Suna no Mi", type: "Logia", technique: "Desierto Spada", bonus: 11, x: 1035, y: 570 }
];

export function fruitNear(point, availableIds = [], radius = 80) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return null;
  return DEVIL_FRUITS.find((fruit) => availableIds.includes(fruit.id) && Math.hypot(fruit.x - point.x, fruit.y - point.y) <= radius) ?? null;
}

export function createLocalFruitLedger() {
  return DEVIL_FRUITS.map(({ id, name, type, technique, bonus, x, y }) => ({
    id, name, type, technique, bonus, x, y, state: "wild", owner_id: null, rebirth_cycle: null
  }));
}

export function claimLocalFruit(ledger, id, captainId, point) {
  const fruit = ledger.find((entry) => entry.id === id && entry.state === "wild");
  if (!fruit || Math.hypot(fruit.x - point.x, fruit.y - point.y) > 80) return null;
  fruit.state = "owned";
  fruit.owner_id = captainId;
  return { id: fruit.id, name: fruit.name, type: fruit.type, technique: fruit.technique, bonus: fruit.bonus };
}

export function releaseLocalFruit(ledger, id, captainId, cycle) {
  const fruit = ledger.find((entry) => entry.id === id && entry.state === "owned" && entry.owner_id === captainId);
  if (!fruit) return false;
  fruit.state = "reincarnating";
  fruit.owner_id = null;
  fruit.rebirth_cycle = cycle + 1;
  return true;
}

export function advanceFruitCycle(ledger, cycle, random = Math.random) {
  let count = 0;
  for (const fruit of ledger) {
    if (fruit.state !== "reincarnating" || fruit.rebirth_cycle > cycle) continue;
    fruit.state = "wild";
    fruit.rebirth_cycle = null;
    fruit.x = Math.floor(random() * 1200);
    fruit.y = Math.floor(random() * 760);
    count += 1;
  }
  return count;
}
