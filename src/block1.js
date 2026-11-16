const SAVE_KEY = "one-latam-rpg-beta-1";
const byId = (id) => document.getElementById(id);
const listen = (element, type, handler) => { if (element) element.addEventListener(type, handler); };
const fmt = (n) => new Intl.NumberFormat("es-ES").format(Number(n) || 0);
const traitList = (character) => [...(character.soulCard?.traits?.pros || []), ...(character.soulCard?.traits?.cons || [])].map((trait) => String(trait).toLowerCase());
const addNotice = (character, type, title, text) => {
  character.world ||= { day: 0, year: 1, era: "Era de los Grandes Descubrimientos", news: [], pantheon: [] };
  character.world.news ||= [];
  character.world.news.unshift({ type, title, text: `${title}: ${text}`, day: character.world.day || 0, era: character.world.era || "Era de los Grandes Descubrimientos", time: new Date().toISOString() });
  character.world.news = character.world.news.slice(0, 60);
};
function ensureBlockOneData(character) {
  if (!character) return;
  character.inventory ||= { provisions: 3, equipment: ["Sable de navegante"], items: [] };
  character.inventory.provisions = Math.max(0, Number(character.inventory.provisions) || 0);
  character.inventory.equipment ||= [];
  character.inventory.items ||= [];
  character.shipSecurity ||= { humidity: 12, raidRisk: 14 };
  character.activeContracts ||= [];
  character.availableContracts ||= [
    { id: "escort", title: "Escolta de mercaderes", risk: "Medio", reward: 180 },
    { id: "bounty", title: "Caza de recompensas", risk: "Alto", reward: 260 },
    { id: "supply", title: "Abastecimiento de isla", risk: "Bajo", reward: 120 }
  ];
  character.world ||= { day: 0, year: 1, era: "Era de los Grandes Descubrimientos", news: [], pantheon: [] };
  character.world.news ||= [];
  character.world.pantheon ||= [];
}
function itemPsychology(character, item) {
  ensureBlockOneData(character);
  const traits = traitList(character);
  const security = character.shipSecurity;
  let response;
  if (traits.includes("astuto")) {
    if (item.type === "provision") character.inventory.provisions += item.quantity || 1;
    else character.inventory.items.push(item.name || "Botín sin identificar");
    security.raidRisk = Math.max(0, security.raidRisk - 3);
    response = `${character.name} esconde el botín con astucia y asegura el cofre.`;
  } else if (traits.includes("impulsivo")) {
    if (item.type === "provision") { character.inventory.provisions += Math.max(0, (item.quantity || 1) - 1); response = `${character.name} consume una provisión al instante; el resto queda guardado.`; }
    else { character.inventory.items.push(item.name || "Botín sin identificar"); response = `${character.name} guarda el objeto, pero el movimiento precipitado aumenta el riesgo.`; security.raidRisk = Math.min(100, security.raidRisk + 6); }
  } else if (traits.includes("prudente")) {
    if (item.type === "provision") character.inventory.provisions += item.quantity || 1;
    else character.inventory.items.push(item.name || "Botín sin identificar");
    security.raidRisk = Math.max(0, security.raidRisk - 7);
    security.humidity = Math.max(0, security.humidity - 2);
    response = `${character.name} revisa el cargamento y lo almacena con prudencia.`;
  } else {
    if (item.type === "provision") character.inventory.provisions += item.quantity || 1;
    else character.inventory.items.push(item.name || "Botín sin identificar");
    response = `${character.name} almacena el objeto en el cofre.`;
  }
  character.lastChestDecision = response;
  character.log.unshift({ time: new Date().toISOString(), message: `📦 ${response}` });
  addNotice(character, "chest", "Movimiento en el cofre", response);
}
function evaluateContract(character, contract, decision) {
  ensureBlockOneData(character);
  const traits = traitList(character);
  const bold = traits.some((trait) => ["valiente", "impulsivo", "agresivo"].includes(trait));
  const cautious = traits.some((trait) => ["prudente", "astuto"].includes(trait));
  const matches = contract.id === "bounty" ? bold || traits.includes("astuto") : contract.id === "supply" ? cautious || traits.includes("leal") : bold || cautious;
  const accepted = decision === "accept" && matches;
  let note;
  if (decision === "reject") note = `${character.name} rechaza «${contract.title}» y sigue su propio rumbo.`;
  else if (accepted) {
    character.activeContracts.unshift({ ...contract, acceptedAt: new Date().toISOString(), status: "accepted" });
    note = `${character.name} acepta «${contract.title}»; el perfil ${traits.join(" / ") || "sin rasgos definidos"} es compatible.`;
  } else note = `${character.name} rechaza «${contract.title}»: su carácter ${cautious ? "prudente" : "reservado"} evita este riesgo.`;
  character.contractNotice = note;
  character.log.unshift({ time: new Date().toISOString(), message: `📜 ${note}` });
  addNotice(character, "contract", "Tablón del puerto", note);
}
let character = null;
let timerId = null;
const byIdListener = (element, type, fn) => { if (element) element.addEventListener(type, fn); };
function saveAndPaint() {
  if (!character) return;
  ensureBlockOneData(character);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(character)); } catch {}
  window.dispatchEvent(new CustomEvent("onepiece:block1-render", { detail: { character } }));
}
function tick() {
  if (!character || character.status === "dead" || character.autonomy?.paused) return;
  const before = { level: character.level, bounty: character.bounty, status: character.status, logLength: character.log?.length || 0 };
  character.autonomy ||= { paused: false, tickCount: 0 };
  character.autonomy.tickCount = (Number(character.autonomy.tickCount) || 0) + 1;
  character.world.day = (Number(character.world.day) || 0) + 1;
  character.world.year = Math.floor(character.world.day / 365) + 1;
  const action = ["navigate", "train", "searchFruit", "rest"][Math.floor(Math.random() * 4)];
  const desc = { navigate: "sale a explorar el East Blue", train: "entrena para mejorar sus atributos", searchFruit: "busca provisiones y tesoros", rest: "descansa y protege su salud" }[action];
  character.log.unshift({ time: new Date().toISOString(), message: `Decisión autónoma: ${desc}.` });
  if (action === "rest") character.stats.health = Math.min(character.stats.maxHealth, character.stats.health + 12);
  if (action === "train") { character.stats.strength += 1; character.experience += 35; }
  if (action === "searchFruit") { character.inventory.provisions += 1; character.berries += 10 + Math.floor(Math.random() * 25); }
  if (action === "navigate" && Math.random() < 0.3) character.shipSecurity.raidRisk = Math.min(100, character.shipSecurity.raidRisk + 2);
  if (character.experience >= character.level * 100) { character.experience -= character.level * 100; character.level += 1; character.stats.maxHealth += 5; character.stats.health = Math.min(character.stats.maxHealth, character.stats.health + 5); }
  character.world.era = character.world.era || "Era de los Grandes Descubrimientos";
  if (character.world.day % 7 === 0) addNotice(character, "era", "Crónica de la Era", `Día ${character.world.day}: ${desc}.`);
  if (character.level > before.level) addNotice(character, "level", "Ascenso de nivel", `${character.name} alcanzó el nivel ${character.level}.`);
  if (character.bounty > before.bounty) addNotice(character, "bounty", "Nuevo cartel SE BUSCA", `${character.name}: ฿${fmt(character.bounty)} Berries.`);
  if (character.status === "dead" && before.status !== "dead") addNotice(character, "obituary", "Necrológica", `${character.name} cayó; su linaje continúa.`);
  saveAndPaint();
  scheduleTick();
}
function scheduleTick() { clearTimeout(timerId); if (character && character.status !== "dead" && !character.autonomy?.paused) timerId = setTimeout(tick, 7000); }
function load() {
  try { character = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); } catch { character = null; }
  if (character) { ensureBlockOneData(character); saveAndPaint(); scheduleTick(); }
}
load();
byIdListener(window, "onepiece:hud-chest-item", (event) => { if (!character || character.status === "dead") return; itemPsychology(character, event.detail?.item || { type: "provision", quantity: 1 }); saveAndPaint(); });
byIdListener(window, "onepiece:hud-contract-decision", (event) => { if (!character || character.status === "dead") return; evaluateContract(character, event.detail.contract, event.detail.decision); saveAndPaint(); });
byIdListener(window, "onepiece:block1-render", (event) => { const state=event.detail.character; const slots=document.getElementById("block1-state"); if(slots) slots.dataset.ready=String(Boolean(state)); });
byIdListener(window, "storage", (event) => { if (event.key === SAVE_KEY) load(); });
