export {
  DEVIL_FRUITS,
  advanceFruitCycle,
  claimLocalFruit,
  createLocalFruitLedger,
  fruitNear,
  releaseLocalFruit
} from "./devil_fruits.js";

export const HAKI_TYPES = Object.freeze({
  busoshoku: "Armadura",
  kenbunshoku: "Observación",
  haoshoku: "Conquistador"
});

export function createHakiProfile(conquerorPotential = false) {
  return {
    busoshoku: false,
    kenbunshoku: false,
    haoshoku: false,
    conquerorPotential: Boolean(conquerorPotential),
    grandLineSince: null,
    survivalEvents: 0
  };
}

export function ensureHakiProfile(haki = {}) {
  return {
    ...createHakiProfile(haki.conquerorPotential),
    ...haki,
    busoshoku: Boolean(haki.busoshoku),
    kenbunshoku: Boolean(haki.kenbunshoku),
    haoshoku: Boolean(haki.haoshoku),
    survivalEvents: Math.max(0, Number(haki.survivalEvents) || 0)
  };
}
