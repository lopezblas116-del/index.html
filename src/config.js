export const PALETTE = Object.freeze({
  ocean: "#0b1329",
  panel: "#162238",
  gold: "#f4b41a"
});

export const STORAGE_KEYS = Object.freeze({
  save: "one-latam-rpg-beta-1",
  chat: "one-latam-global-chat-v1",
  settings: "one-latam-settings-v1"
});

export const PULSE_MS = 75_000;

export const CONTRACTS = Object.freeze([
  Object.freeze({ id: "escort", category: "commerce", title: "Escolta de mercaderes", risk: "Medio", reward: 180 }),
  Object.freeze({ id: "bounty", category: "bounty", title: "Caza de recompensas", risk: "Alto", reward: 260 }),
  Object.freeze({ id: "supply", category: "commerce", title: "Abastecimiento de isla", risk: "Bajo", reward: 120 }),
  Object.freeze({ id: "relic", category: "archaeology", title: "Rastrear una reliquia", risk: "Medio", reward: 420 })
]);
