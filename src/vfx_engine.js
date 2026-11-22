const RARITY = Object.freeze({
  common: { label: "Común", className: "common" },
  rare: { label: "Raro", className: "rare" },
  epic: { label: "Épico", className: "epic" },
  legendary: { label: "Legendario", className: "legendary" }
});

export function rarityFor(item = {}) {
  const source = `${item?.rarity || ""} ${item?.name || item?.type || ""}`.toLocaleLowerCase("es");
  if (/legendari|ancestral|akuma|fruta|poneglyph/.test(source)) return RARITY.legendary;
  if (/épico|epic|reliquia|plano/.test(source)) return RARITY.epic;
  if (/raro|rare|log pose|medalla|katana|brújula|brujula/.test(source)) return RARITY.rare;
  return RARITY.common;
}

const activeAnimations = new WeakMap();
export function animateCount(element, value, formatter = (number) => String(number)) {
  if (!element) return;
  const target = Math.max(0, Number(value) || 0);
  const previous = Number(element.dataset.countTarget);
  element.dataset.countTarget = String(target);
  if (!Number.isFinite(previous) || typeof requestAnimationFrame !== "function"
      || globalThis.document?.body?.classList?.contains("reduced-motion")
      || globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
    activeAnimations.delete(element);
    element.textContent = formatter(target);
    return;
  }
  if (previous === target) {
    if (!activeAnimations.has(element)) element.textContent = formatter(target);
    return;
  }
  const token = {};
  activeAnimations.set(element, token);
  const started = performance.now();
  const tick = (now) => {
    if (activeAnimations.get(element) !== token) return;
    const progress = Math.min(1, (now - started) / 900);
    const eased = 1 - (1 - progress) ** 3;
    element.textContent = formatter(Math.round(previous + (target - previous) * eased));
    if (progress < 1) requestAnimationFrame(tick);
  };
  element.classList.remove("wanted-number-roll");
  void element.offsetWidth;
  element.classList.add("wanted-number-roll");
  requestAnimationFrame(tick);
}

let layer;
let sequence = 0;
const timers = new Set();
let activeLootBackdrop = null;
const lootQueue = [];
function ensureLayer() {
  if (layer?.isConnected) return layer;
  layer = document.getElementById("vfx-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "vfx-layer";
    document.body.append(layer);
  }
  return layer;
}
function removeLater(element, delay) {
  const timer = setTimeout(() => {
    timers.delete(timer);
    element.remove();
  }, delay);
  timers.add(timer);
}
function showPopup(text, type = "reward") {
  const popup = document.createElement("div");
  popup.className = `vfx-popup vfx-popup-${type}`;
  popup.textContent = text;
  popup.setAttribute("role", "status");
  popup.dataset.vfxId = String(++sequence);
  ensureLayer().append(popup);
  removeLater(popup, 1900);
}
function showLoot(item) {
  if (activeLootBackdrop) {
    lootQueue.push(item);
    return;
  }
  const rarity = rarityFor(item);
  const backdrop = document.createElement("div");
  activeLootBackdrop = backdrop;
  backdrop.className = `vfx-loot-backdrop rarity-${rarity.className}`;
  backdrop.setAttribute("role", "presentation");
  const dialog = document.createElement("section");
  dialog.className = "vfx-loot-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "vfx-loot-title");
  const light = document.createElement("div");
  light.className = "vfx-chest-light";
  light.setAttribute("aria-hidden", "true");
  const chest = document.createElement("div");
  chest.className = "vfx-chest";
  chest.setAttribute("aria-hidden", "true");
  chest.textContent = "▣";
  const label = document.createElement("p");
  label.className = "vfx-loot-rarity";
  label.textContent = rarity.label;
  const title = document.createElement("h2");
  title.id = "vfx-loot-title";
  title.textContent = String(item.name || "Botín desconocido");
  const detail = document.createElement("p");
  detail.textContent = "El hallazgo queda registrado en el cofre del linaje.";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "vfx-loot-close";
  close.textContent = "Continuar";
  const dismiss = () => {
    if (activeLootBackdrop !== backdrop) return;
    backdrop.remove();
    activeLootBackdrop = null;
    document.removeEventListener("keydown", onKeyDown);
    document.dispatchEvent(new CustomEvent("onepiece:modal-visibility", { detail: { open: false } }));
    if (lootQueue.length) showLoot(lootQueue.shift());
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") dismiss();
  };
  close.addEventListener("click", dismiss, { once: true });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) dismiss();
  });
  document.addEventListener("keydown", onKeyDown);
  dialog.append(light, chest, label, title, detail, close);
  backdrop.append(dialog);
  ensureLayer().append(backdrop);
  document.dispatchEvent(new CustomEvent("onepiece:modal-visibility", { detail: { open: true } }));
  close.focus();
}

export function initVfx() {
  ensureLayer();
}

export function emitVfx(type, detail = {}) {
  if (typeof document === "undefined" || document.body?.classList?.contains("reduced-motion")
      || globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  if (type === "loot") showLoot(detail.item || {});
  else if (type === "berries") showPopup(`+${detail.amount} ฿`, "berries");
  else if (type === "experience") showPopup(`+${detail.amount} XP`, "experience");
  else if (type === "critical") showPopup("¡CRÍTICO!", "critical");
  else if (type === "damage") showPopup(`−${detail.amount} HP`, "damage");
  else if (type === "victory") showPopup("¡VICTORIA!", "victory");
}

export function trackVisualChanges(character) {
  if (!character) return;
  const toLootEntry = (item) => {
    if (typeof item === "string") return { key: item, name: item };
    const name = item?.name || "Botín desconocido";
    return { key: item?.id || name, name, rarity: item?.rarity, type: item?.type };
  };
  const items = [
    ...(character.inventory?.items || []).map(toLootEntry),
    ...(character.lineage?.legacyChest || []).map(toLootEntry),
    ...(character.fruit?.id ? [{ key: character.fruit.id, name: character.fruit.name || character.fruit.id, rarity: "Legendario" }] : [])
  ];
  const next = {
    id: character.id,
    berries: Number(character.berries) || 0,
    experience: Number(character.experience) || 0,
    bounty: Number(character.bounty) || 0,
    health: Number(character.stats?.health) || 0,
    maxHealth: Number(character.stats?.maxHealth) || 100,
    items
  };
  const previous = trackVisualChanges.previous;
  trackVisualChanges.previous = next;
  if (!previous || previous.id !== next.id) return;
  if (next.berries > previous.berries) emitVfx("berries", { amount: next.berries - previous.berries });
  if (next.experience > previous.experience) emitVfx("experience", { amount: next.experience - previous.experience });
  if (next.health < previous.health) {
    const critical = next.health <= next.maxHealth * 0.2 || previous.health - next.health >= next.maxHealth * 0.25;
    emitVfx(critical ? "critical" : "damage", { amount: previous.health - next.health });
  }
  const knownItems = new Map();
  for (const item of previous.items) knownItems.set(item.key, (knownItems.get(item.key) || 0) + 1);
  for (const item of next.items) {
    const count = knownItems.get(item.key) || 0;
    if (count) knownItems.set(item.key, count - 1);
    else emitVfx("loot", { item });
  }
}
