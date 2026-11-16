const SAVE_KEY = "one-latam-rpg-beta-1";
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
  character.availableContracts ??= [
    { id: "escort", title: "Escolta de mercaderes", risk: "Medio", reward: 180 },
    { id: "bounty", title: "Caza de recompensas", risk: "Alto", reward: 260 },
    { id: "supply", title: "Abastecimiento de isla", risk: "Bajo", reward: 120 }
  ];
  character.world ??= { day: 0, year: 1, era: "Era de los Grandes Descubrimientos", news: [], pantheon: [] };
  character.world.news ??= [];
  character.world.pantheon ??= [];
  character.log ??= [];
  return character;
}
function addNotice(character, type, title, text) {
  ensureBlockOneData(character);
  character.world.news.unshift({ type, title, text: `${title}: ${text}`, day: character.world.day || 0, era: character.world.era || "Era de los Grandes Descubrimientos", time: new Date().toISOString() });
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
  if (decision !== "accept") response = `${character.name} rechaza «${contract.title}» y sigue su propio rumbo.`;
  else if (accepted) {
    if (!character.activeContracts.some((entry) => entry.id === contract.id && entry.status === "accepted")) character.activeContracts.unshift({ ...contract, acceptedAt: new Date().toISOString(), status: "accepted" });
    response = `${character.name} acepta «${contract.title}»; sus rasgos encajan con el contrato.`;
  } else response = `${character.name} rechaza «${contract.title}»: su perfil evita ese riesgo.`;
  character.contractNotice = response;
  log(character, `📜 ${response}`);
  addNotice(character, "contract", "Tablón del puerto", response);
  return accepted;
}
export function initBlock1({ getCharacter, onChange } = {}) {
  if (window.__oneLatamBlock1Initialized) return;
  window.__oneLatamBlock1Initialized = true;
  const update = (mutate) => {
    const character = getCharacter?.();
    if (!character || character.status === "dead") return;
    ensureBlockOneData(character);
    mutate(character);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(character)); } catch {}
    onChange?.(character);
    window.dispatchEvent(new CustomEvent("onepiece:block1-render", { detail: { character } }));
  };
  document.addEventListener("onepiece:hud-chest-item", (event) => update((character) => processChestItem(character, event.detail?.item)));
  document.addEventListener("onepiece:hud-contract-decision", (event) => update((character) => evaluateContract(character, event.detail?.contract, event.detail?.decision)));
}
