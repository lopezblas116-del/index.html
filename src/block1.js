import { CONTRACTS, STORAGE_KEYS } from "./config.js";
import { writeJSON } from "./storage_adapter.js";
import { awardBerries } from "./gm_engine.js";

const SAVE_KEY = STORAGE_KEYS.save;
const TRAIT_LABELS = { valiente: "Valiente", prudente: "Prudente", astuto: "Astuto", impulsivo: "Impulsivo", leal: "Leal", agresivo: "Agresivo" };
const traitsOf = (character) => [...(character?.soulCard?.traits?.pros ?? []), ...(character?.soulCard?.traits?.cons ?? [])].map((trait) => String(trait).toLocaleLowerCase("es"));
const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0));

export function ensureBlockOneData(character) {
  if (!character) return character;
  character.inventory ??= { provisions: 3, equipment: ["Sable de navegante"], items: [] };
  character.inventory.provisions = Math.max(0, Number(character.inventory.provisions) || 0);
  character.inventory.equipment ??= [];
  character.inventory.items ??= [];
  character.shipSecurity ??= { humidity: 12, raidRisk: 14 };
  character.shipSecurity.humidity = clamp(character.shipSecurity.humidity, 0, 100);
  character.shipSecurity.raidRisk = clamp(character.shipSecurity.raidRisk, 0, 100);
  character.activeContracts ??= [];
  character.availableContracts ??= CONTRACTS.map((contract) => ({ ...contract }));
  for (const contract of character.availableContracts) {
    const configured = CONTRACTS.find((entry) => entry.id === contract.id);
    if (configured) contract.category ??= configured.category;
  }
  for (const contract of CONTRACTS) {
    if (contract.category === "archaeology" && !character.availableContracts.some((entry) => entry.id === contract.id)) {
      character.availableContracts.push({ ...contract });
    }
  }
  character.world ??= { day: 0, year: 1, era: "Era de los Grandes Descubrimientos", news: [], pantheon: [] };
  character.world.news ??= [];
  character.world.pantheon ??= [];
  character.log ??= [];
  character.whisper ??= { affinity: 55, rebellion: 45 };
  character.whisper.energy = clamp(character.whisper.energy ?? 3, 0, 3);
  character.whisper.itemSuggestions ??= [];
  character.whisper.priorityItems ??= [];
  return character;
}
function addNotice(character, type, title, text) {
  ensureBlockOneData(character);
  character.world.news.unshift({ type, title, text: `${title}: ${text}`, location: character.location?.island, day: character.world.day || 0, era: character.world.era || "Era de los Grandes Descubrimientos", time: new Date().toISOString() });
  character.world.news = character.world.news.slice(0, 60);
}
function log(character, message) {
  character.log.unshift({ time: new Date().toISOString(), message });
  character.log = character.log.slice(0, 80);
}
export function processChestItem(character, item = {}) {
  ensureBlockOneData(character);
  const traits = traitsOf(character);
  const quantity = Math.max(1, Number(item.quantity) || 1);
  const security = character.shipSecurity;
  let response;
  if (traits.includes("impulsivo") && item.type === "provision") {
    const stored = Math.max(0, quantity - 1);
    character.inventory.provisions += stored;
    response = stored ? `${character.name} consume una provisión y guarda ${stored}.` : `${character.name} consume la provisión antes de guardarla.`;
  } else {
    if (item.type === "provision") character.inventory.provisions += quantity;
    else if (item.type === "equipment") character.inventory.equipment.push(String(item.name || "Equipo sin identificar"));
    else character.inventory.items.push(String(item.name || "Botín sin identificar"));
    if (traits.includes("astuto")) { security.raidRisk = Math.max(0, security.raidRisk - 3); response = `${character.name} oculta el objeto con astucia y asegura el cofre.`; }
    else if (traits.includes("prudente")) { security.raidRisk = Math.max(0, security.raidRisk - 7); security.humidity = Math.max(0, security.humidity - 2); response = `${character.name} revisa el cargamento y lo almacena con prudencia.`; }
    else response = `${character.name} guarda ${item.name || "el objeto"} en el cofre.`;
  }
  if (traits.includes("impulsivo") && item.type !== "provision") security.raidRisk = Math.min(100, security.raidRisk + 6);
  character.lastChestDecision = response;
  log(character, `📦 ${response}`);
  addNotice(character, "chest", "Movimiento en el cofre", response);
  return response;
}
export function evaluateContract(character, contract, decision) {
  ensureBlockOneData(character);
  if (!contract) return false;
  const traits = traitsOf(character);
  const bold = traits.some((trait) => ["valiente", "impulsivo", "agresivo"].includes(trait));
  const cautious = traits.some((trait) => ["prudente", "astuto"].includes(trait));
  const compatible = contract.id === "bounty" ? bold || traits.includes("astuto") : contract.id === "supply" ? cautious || traits.includes("leal") : bold || cautious;
  const accepted = decision === "accept" && compatible;
  let response;
  const objective = OBJECTIVES[contract.id] ?? contract.title;
  if (decision !== "accept") response = `${character.name} rechaza «${contract.title}» y sigue su propio rumbo.`;
  else if (accepted) {
    if (!character.activeContracts.some((entry) => entry.id === contract.id && entry.status === "accepted")) character.activeContracts.unshift({ ...contract, acceptedAt: new Date().toISOString(), fromIsland: character.location?.island, status: "accepted" });
    character.objective = `Objetivo activo: ${objective}`;
    log(character, `📌 ${character.objective}`);
    response = `${character.name} acepta «${contract.title}»; sus rasgos encajan con el contrato.`;
  } else response = `${character.name} rechaza «${contract.title}»: su perfil evita ese riesgo.`;
  character.contractNotice = response;
  log(character, `📜 ${response}`);
  addNotice(character, "contract", "Tablón del puerto", response);
  return accepted;
}
const OBJECTIVES = { escort: "Escortar mercader", bounty: "Cazar recompensa", supply: "Abastecer isla" };
export function resolvePortContracts(character, previousIsland) {
  ensureBlockOneData(character);
  if (character.status === "dead" || character.location?.atSea || !previousIsland || previousIsland === character.location?.island) return;
  for (const contract of character.activeContracts) {
    if (contract.status !== "accepted" || contract.fromIsland === character.location.island) continue;
    contract.status = "completed";
    contract.completedAt = new Date().toISOString();
    awardBerries(character, Math.max(0, Number(contract.reward) || 0));
    const text = `${character.name} completa «${contract.title}» en ${character.location.island}.`;
    log(character, `📜 ${text}`);
    addNotice(character, "contract", "Contrato completado", text);
  }
  if (!character.activeContracts.some((contract) => contract.status === "accepted")) delete character.objective;
}
const CONSUMABLES = [
  { re: /manzana/i, name: "Manzana", heal: 10, desc: "Fruta fresca del puerto. Reconforta el cuerpo." },
  { re: /agua/i, name: "Agua", heal: 6, desc: "Agua potable. Imprescindible en alta mar." },
  { re: /ron/i, name: "Ron", heal: 8, desc: "Ron de contrabandista. Levanta el ánimo, pero nubla la cabeza." },
  { re: /provisi/i, name: "Provisión de viaje", heal: 12, desc: "Ración seca para la travesía." }
];
const consumableInfo = (name) => CONSUMABLES.find((entry) => entry.re.test(name));
const ARMOR_RE = /armadura|chaleco|escudo|coraza|casco/i;
export const equipSlotFor = (name) => (ARMOR_RE.test(name) ? "armor" : "weapon");

export function listChestItems(character) {
  ensureBlockOneData(character);
  const inv = character.inventory;
  const entries = [];
  if (inv.provisions > 0) entries.push({ kind: "provision", index: 0, name: "Provisión de viaje", qty: inv.provisions, type: "Consumible" });
  inv.equipment.forEach((name, index) => entries.push({ kind: "equipment", index, name, qty: 1, type: "Equipamiento" }));
  inv.items.forEach((name, index) => entries.push({ kind: "item", index, name, qty: 1, type: consumableInfo(name) ? "Consumible" : "Botín" }));
  return entries.map((entry) => {
    const info = consumableInfo(entry.name);
    const slot = equipSlotFor(entry.name);
    if (entry.type === "Consumible") return { ...entry, consumable: true, stats: `Salud +${info?.heal ?? 5}`, description: info?.desc ?? "Objeto consumible." };
    if (entry.type === "Equipamiento") return { ...entry, equippable: true, stats: slot === "armor" ? "Defensa +3" : "Ataque +3", description: slot === "armor" ? "Protección para las travesías peligrosas." : "Arma de mano para abrirse paso en el mar." };
    return { ...entry, stats: "—", description: "Botín sin identificar. Quizá valga algo en el próximo puerto." };
  });
}
export function whisperAdviceFor(character, entry) {
  const traits = traitsOf(character);
  const name = entry.name;
  if (entry.consumable) {
    const hp = (character.stats?.health ?? 100) / (character.stats?.maxHealth ?? 100);
    if (traits.includes("prudente")) return `Guarda ${name} para una emergencia; no lo malgastes ahora.`;
    if (traits.includes("impulsivo")) return `Usa ${name} cuando lo necesites, ¡sin pensarlo tanto!`;
    return hp < 0.6 ? `Consume ${name} y recupera fuerzas antes de zarpar.` : `Conserva ${name} para cuando baje tu salud.`;
  }
  if (entry.equippable) {
    if (traits.some((t) => ["valiente", "agresivo"].includes(t))) return `Equípate ${name} y busca pelea sin miedo.`;
    return `Equípate ${name} por si el viaje se complica.`;
  }
  if (traits.includes("astuto")) return `Vende ${name} al mejor postor, o escóndelo en el cofre.`;
  return `Guarda ${name} en el cofre hasta saber su valor.`;
}
const sameItem = (a, b) => a.kind === b.kind && a.name === b.name;
const ATTRIBUTE_LABELS = { strength: "Fuerza", agility: "Agilidad", ingenuity: "Ingenio" };
const distrustWarning = "El avatar desconfía de tu sugerencia sobre este objeto";

export function suggestTraining(character, attribute) {
  ensureBlockOneData(character);
  if (!Object.hasOwn(ATTRIBUTE_LABELS, attribute)) return { ok: false, message: "Elige un atributo válido." };
  if (character.whisper.trainingSuggestion) return { ok: false, message: "Ya hay una sugerencia de entrenamiento pendiente para el próximo puerto." };
  if (character.whisper.energy < 1) return { ok: false, message: "No queda Energía de Susurro. Recuperarás una al llegar al próximo puerto." };
  character.whisper.energy -= 1;
  character.whisper.trainingSuggestion = { attribute, fromIsland: character.location?.island };
  const message = `🗣️ Sugieres entrenar ${ATTRIBUTE_LABELS[attribute]} en el próximo puerto.`;
  log(character, message);
  return { ok: true, message };
}

export function suggestChestItem(character, ref, action) {
  ensureBlockOneData(character);
  const entry = listChestItems(character).find((item) => sameItem(item, ref ?? {}));
  if (!entry) return { ok: false, message: "Ese objeto ya no está en el cofre." };
  const item = { kind: entry.kind, name: entry.name };
  const suggestions = character.whisper.itemSuggestions;
  const priorities = character.whisper.priorityItems;
  if (action === "sell") {
    if (priorities.some((priority) => sameItem(priority, item))) {
      return { ok: false, message: "El objeto está marcado como prioritario y no se sugerirá su venta." };
    }
    if (suggestions.some((suggestion) => sameItem(suggestion, item))) {
      return { ok: false, message: "Ya existe una sugerencia de venta pendiente para este objeto." };
    }
    suggestions.push({ ...item, fromIsland: character.location?.island });
  } else if (action === "priority") {
    if (!priorities.some((priority) => sameItem(priority, item))) priorities.push(item);
    character.whisper.itemSuggestions = suggestions.filter((suggestion) => !sameItem(suggestion, item));
  } else {
    return { ok: false, message: "Acción no disponible para este objeto." };
  }
  const message = action === "sell"
    ? `🗣️ Sugieres vender ${entry.name} en el próximo puerto.`
    : `⭐ Sugieres conservar ${entry.name} como objeto prioritario.`;
  log(character, message);
  if (character.whisper.rebellion > 60) {
    log(character, `⚠️ ${distrustWarning}.`);
    return { ok: true, message: distrustWarning };
  }
  return { ok: true, message };
}

export function resolvePortSuggestions(character, previousIsland, random = Math.random) {
  ensureBlockOneData(character);
  if (!previousIsland || !character.location?.island || previousIsland === character.location.island || character.status === "dead") return;
  character.whisper.energy = Math.min(3, character.whisper.energy + 1);
  const obeys = () => random() * 100 < clamp(Number(character.whisper.affinity ?? 55) - Math.max(0, Number(character.whisper.rebellion ?? 45) - 60), 5, 95);
  const training = character.whisper.trainingSuggestion;
  if (training && training.fromIsland !== character.location.island) {
    if (Object.hasOwn(ATTRIBUTE_LABELS, training.attribute) && obeys()) {
      character.stats[training.attribute] += 1;
      log(character, `🏋️ ${character.name} sigue el consejo y entrena ${ATTRIBUTE_LABELS[training.attribute]} en ${character.location.island}.`);
    } else log(character, `🗣️ ${character.name} decide no seguir la sugerencia de entrenamiento.`);
    delete character.whisper.trainingSuggestion;
  }
  const pending = character.whisper.itemSuggestions;
  character.whisper.itemSuggestions = [];
  for (const suggestion of pending) {
    if (suggestion.fromIsland === character.location.island) {
      character.whisper.itemSuggestions.push(suggestion);
      continue;
    }
    const entry = listChestItems(character).find((item) => sameItem(item, suggestion));
    if (!entry || character.whisper.priorityItems.some((item) => sameItem(item, suggestion))) {
      log(character, `📦 ${suggestion.name} no se vende: ya no está disponible o es prioritario.`);
      continue;
    }
    if (!obeys()) {
      log(character, `🗣️ ${character.name} decide conservar ${entry.name} en lugar de venderlo.`);
      continue;
    }
    if (entry.kind === "provision") character.inventory.provisions -= 1;
    else {
      const items = entry.kind === "equipment" ? character.inventory.equipment : character.inventory.items;
      items.splice(items.indexOf(entry.name), 1);
    }
    awardBerries(character, 25);
    log(character, `🏷️ ${character.name} vende ${entry.name} en ${character.location.island} por ฿25.`);
  }
}
export function useChestItem(character, ref, action) {
  ensureBlockOneData(character);
  const entry = listChestItems(character).find((item) => item.kind === ref?.kind && item.name === ref?.name);
  if (!entry) return { ok: false, message: "Ese objeto ya no está en el cofre." };
  const inv = character.inventory;
  const stats = (character.stats ??= { health: 100, maxHealth: 100 });
  let message;
  if (action === "consume" && entry.consumable) {
    const heal = consumableInfo(entry.name)?.heal ?? 5;
    const before = stats.health;
    stats.health = Math.min(stats.maxHealth, stats.health + heal);
    if (entry.kind === "provision") inv.provisions -= 1;
    else inv.items.splice(inv.items.indexOf(entry.name), 1);
    message = `${character.name} consume ${entry.name} y recupera ${stats.health - before} de salud.`;
  } else if (action === "equip" && entry.equippable) {
    const slot = equipSlotFor(entry.name);
    character.equipped ??= { weapon: null, armor: null };
    const previous = character.equipped[slot];
    inv.equipment.splice(inv.equipment.indexOf(entry.name), 1);
    if (previous) inv.equipment.push(previous);
    character.equipped[slot] = entry.name;
    message = `${character.name} se equipa ${entry.name}.`;
  } else if (action === "whisper") {
    const advice = whisperAdviceFor(character, entry);
    character.whisper ??= { affinity: 55, rebellion: 45 };
    character.whisper.affinity = clamp(character.whisper.affinity + 1, 0, 100);
    message = `🗣️ Susurro sobre ${entry.name}: «${advice}»`;
  } else return { ok: false, message: "Acción no disponible para este objeto." };
  log(character, message);
  addNotice(character, "chest", "Cofre", message);
  return { ok: true, message };
}
export function initBlock1({ getCharacter, onChange, onPublicAction } = {}) {
  if (window.__oneLatamBlock1Initialized) return;
  window.__oneLatamBlock1Initialized = true;
  const update = (mutate) => {
    const character = getCharacter?.();
    if (!character || character.status === "dead") return;
    ensureBlockOneData(character);
    const result = mutate(character);
    writeJSON(SAVE_KEY, character);
    onChange?.(character);
    window.dispatchEvent(new CustomEvent("onepiece:block1-render", { detail: { character, toast: result?.toast } }));
  };
  document.addEventListener("onepiece:hud-chest-item", (event) => update((character) => { processChestItem(character, event.detail?.item); }));
  document.addEventListener("onepiece:hud-chest-use", (event) => update((character) => {
    const result = useChestItem(character, event.detail?.ref, event.detail?.action);
    return { toast: result.message };
  }));
  document.addEventListener("onepiece:hud-training-suggestion", (event) => update((character) => {
    const result = suggestTraining(character, event.detail?.attribute);
    return { toast: result.message };
  }));
  document.addEventListener("onepiece:hud-item-suggestion", (event) => update((character) => {
    const result = suggestChestItem(character, event.detail?.ref, event.detail?.action);
    return { toast: result.message };
  }));
  document.addEventListener("onepiece:hud-contract-decision", (event) => update((character) => {
    const accepted = evaluateContract(character, event.detail?.contract, event.detail?.decision);
    if (accepted) onPublicAction?.("contract", { island: character.location?.island }, character);
    return { toast: accepted ? "¡Contrato aceptado! Consulta tu bitácora" : character.contractNotice };
  }));
}
