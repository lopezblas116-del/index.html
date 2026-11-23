import { listChestItems } from "../block1.js";
import { climateLabel, getTavernCandidates, hasNauticalCrew, enGrandLine, tablonDelPuerto } from "../systems.js";
import { resumenGobierno, filosofoDeIsla, planosDeArquitecto, pagarTributo, desoibirTributo } from "../world_government.js";
import { marketPrices } from "../combat_economy.js";
import { renderNewspaper, renderPsychology, drawFlag } from "./ui.js";
import { getMapIslands } from "../map.js";
import { RACES } from "../race_system.js";
import { getGlobalChat, getWhisperHistory, postGlobalChat } from "../chat_engine.js";
import { readJSON, writeJSON } from "../storage_adapter.js";
import { sincronizarEstado } from "../../js/state.js";
import { PALETTE, STORAGE_KEYS } from "../config.js";
import { avatarAction, avatarEmotion, drawPixelAvatar, npcAppearanceFor } from "../island_renderer.js";
import { renderCodex } from "../codex_engine.js";
import { animateCount } from "../vfx_engine.js";
import { hasLocalGMPin, isLocalGMAvailable, setLocalGMPin, verifyLocalGMPin } from "../gm_engine.js";
import { canReadAncient } from "../archaeology_system.js";
import { describePoliticalStance } from "../lore_engine.js";
const STYLE = `
#game-container .character-panel,#game-container .main-column > :not(#map-panel){display:none!important}
#game-container .main-column{position:absolute;inset:0;display:block!important;pointer-events:none}
#game-container #map-panel{pointer-events:auto}
#one-hud{position:fixed;inset:0;z-index:150;pointer-events:none;color:#f0f4fa;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
/* z-index 150 > 110 (#mil-almas-ui): los modales del HUD TAPAN la barra "Mundo vivo".
   Antes (90) la barra flotaba por encima del modal y tapaba la ✕ para cerrar. */
#one-hud button{font:inherit;cursor:pointer}
#one-hud button{min-width:48px;min-height:48px}
.one-hud-brand{position:absolute;top:calc(max(10px,env(safe-area-inset-top)) + 58px);left:50%;transform:translateX(-50%);display:flex;align-items:center;width:min(920px,calc(100% - 24px));padding:8px 14px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(18,29,54,.92);box-shadow:0 8px 24px #0007;backdrop-filter:blur(8px);pointer-events:auto}
.one-hud-brand-copy{display:flex;align-items:center;justify-content:space-between;gap:clamp(8px,2vw,18px);min-width:0;width:100%}
.one-hud-brand span{display:inline-block;overflow-wrap:anywhere;font-size:12px;white-space:nowrap}.one-hud-clock{color:#c9d2e3;font-weight:600;font-family:'Manrope',system-ui,sans-serif}.one-hud-count{color:var(--color-gold);font-weight:800}.one-hud-captain{color:#f4b41a;font-weight:700;padding:2px 11px;border:1px solid rgba(244,180,26,.35);border-radius:999px;background:rgba(244,180,26,.08)}
.one-hud-settings{position:absolute;top:calc(max(10px,env(safe-area-inset-top)) + 104px);right:max(16px,env(safe-area-inset-right));width:46px;height:46px;min-width:46px!important;min-height:46px!important;border:1px solid rgba(255,255,255,.1);border-radius:12px;color:var(--color-gold);background:rgba(18,29,54,.92);font-size:19px;box-shadow:0 4px 14px #0006;pointer-events:auto}
.one-hud-round{display:grid;place-items:center;min-width:48px;min-height:48px;width:48px;height:48px;padding:0;border:1px solid var(--color-gold);border-radius:12px;color:var(--color-gold);background:var(--color-panel);font-size:23px;box-shadow:0 8px 22px #0006}
.one-hud-nav{position:absolute;bottom:max(12px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:min(540px,calc(100% - 24px));display:flex;justify-content:space-around;align-items:stretch;min-height:60px;padding:6px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:rgba(18,29,54,.94);backdrop-filter:blur(10px);box-shadow:0 14px 36px rgba(0,0,0,.6);pointer-events:auto;font-size:12px}
.one-hud-nav button{position:relative;display:grid;place-items:center;align-content:center;flex:1 1 0;min-width:48px;min-height:44px;gap:2px;padding:3px 6px;border:0;border-radius:10px;color:#c3cddc;background:transparent;font-size:12px;font-weight:600;letter-spacing:.02em;line-height:1.05;white-space:normal;transition:background .15s,color .15s}.one-hud-nav button span{max-width:100%;overflow-wrap:anywhere}.one-hud-nav button span:first-child{color:#d9b560;font-size:17px}
.one-hud-nav button:hover{background:rgba(255,255,255,.06);color:#fff}
.one-hud-nav button[aria-expanded="true"]{background:#f4b41a;color:#0b1329}.one-hud-nav button[aria-expanded="true"] span:first-child{color:#0b1329}
.one-hud-controls{position:absolute;right:max(16px,env(safe-area-inset-right));bottom:calc(84px + env(safe-area-inset-bottom));display:grid;gap:8px;pointer-events:auto}
.one-hud-zoom{display:grid;place-items:center;width:48px;height:48px;min-width:48px;min-height:48px;padding:0;border:0;border-radius:12px;background:#f4b41a;color:#0b1329;font-size:26px;font-weight:800;box-shadow:0 4px 16px rgba(244,180,26,.38),0 10px 24px #0007;transition:transform .15s,filter .15s}
.one-hud-zoom:hover{filter:brightness(1.08);transform:scale(1.05)}
.one-hud-backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:16px;background:#030814ee;backdrop-filter:blur(7px) saturate(1.05);-webkit-backdrop-filter:blur(7px) saturate(1.05);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .18s,visibility .18s}
.one-hud-backdrop.open{opacity:1;visibility:visible;pointer-events:auto}
.one-hud-dialog{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(720px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:18px;color:#f0f4fa;border:1px solid rgba(244,180,26,.45);border-radius:14px;background:#0f1c36;box-shadow:0 20px 55px rgba(0,0,0,.4);z-index:2000}
.one-hud-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;color:#f4b41a;font:700 18px/1.3 system-ui,sans-serif}.one-hud-close{width:38px;height:38px;flex:0 0 auto;border:1px solid #f4b41a;border-radius:50%;color:#f4b41a;background:#0b1329;font:20px system-ui,sans-serif}
.one-hud-list{display:grid;gap:8px;margin:10px 0;padding-left:22px}.one-hud-list li{padding:9px;border-left:2px solid #f4b41a;background:#ffffff09;line-height:1.2}.one-hud-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.one-hud-stats div{padding:9px;border:1px solid #ffffff20;border-radius:7px}.one-hud-stats strong{display:block;color:#f4b41a}.one-hud-form{display:grid;gap:8px;margin-top:12px}.one-hud-form textarea{min-height:74px;padding:9px;color:#fff;border:1px solid #f4b41a;border-radius:7px;background:#0b1329;font:15px/1.5 'Manrope',system-ui,sans-serif}.one-hud-form button,.one-hud-action{padding:8px 12px;border:1px solid #f4b41a;border-radius:7px;color:#111;background:#f4b41a;font-weight:700}.one-hud-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.one-hud-slot{min-height:78px;padding:9px;border:1px solid #f4b41a66;border-radius:8px;background:#0b1329;text-align:center}.one-hud-slot strong{display:block;color:#f4b41a}.one-hud-contracts{display:grid;gap:10px}.one-hud-contract{padding:12px;border:1px solid #f4b41a55;border-radius:9px;background:#0b1329}.one-hud-contract h3{margin:0 0 6px;color:#f4b41a;font:700 .95rem/1.4 'Anton',system-ui,sans-serif;letter-spacing:.05em;text-transform:uppercase}.one-hud-contract-actions{display:flex;gap:8px;margin-top:9px}.one-hud-tabs{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}.one-hud-tabs button{flex:1 1 125px;min-height:48px;padding:7px 9px;border:1px solid #f4b41a66;border-radius:7px;color:#fff;background:#0b1329}.one-hud-tabs button[aria-selected="true"]{color:#111;background:#f4b41a}.one-hud-tab-panel[hidden]{display:none}
.one-hud-glyphs{overflow-wrap:anywhere;color:#f4d58c;letter-spacing:.14em;font:18px/1.5 monospace}
@media(max-width:600px){.one-hud-brand{top:calc(max(8px,env(safe-area-inset-top)) + 112px);width:calc(100% - 16px);padding:7px 10px}.one-hud-brand-copy{gap:6px}.one-hud-brand span{font-size:11px}.one-hud-settings{top:calc(max(8px,env(safe-area-inset-top)) + 158px);right:10px;width:42px;height:42px}#one-hud .one-hud-vitals{top:calc(max(8px,env(safe-area-inset-top)) + 158px)}.one-hud-controls{right:10px;bottom:calc(96px + env(safe-area-inset-bottom))}.one-hud-nav{width:calc(100% - 16px);bottom:max(8px,env(safe-area-inset-bottom));min-height:56px}.one-hud-nav button{font-size:11.5px}.one-hud-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
#one-hud .one-hud-vitals{top:calc(max(10px,env(safe-area-inset-top)) + 104px);left:50%;width:min(180px,42vw)}#one-hud .one-hud-vitals progress{height:5px;border:1px solid rgba(244,180,26,.48);background:#07101f}#one-hud .one-hud-vitals [data-vital="health"]::-webkit-progress-value{background:linear-gradient(90deg,#c74442,#ff7771);background-size:100% 100%,220% 100%;animation:bar-shimmer 3.2s linear infinite}#one-hud .one-hud-vitals [data-vital="experience"]::-webkit-progress-value{background:linear-gradient(90deg,#2679b8,#58c7ff);background-size:100% 100%,220% 100%;animation:bar-shimmer 3.2s linear infinite}#one-hud .one-hud-vitals [data-vital="health"]::-moz-progress-bar{background:linear-gradient(90deg,#c74442,#ff7771);animation:bar-shimmer 3.2s linear infinite}#one-hud .one-hud-vitals [data-vital="experience"]::-moz-progress-bar{background:linear-gradient(90deg,#2679b8,#58c7ff);animation:bar-shimmer 3.2s linear infinite}@media(prefers-reduced-motion:reduce){#one-hud .one-hud-vitals progress{animation:none!important}}
`;
const ICON_PATHS={
  captain:'<circle cx="12" cy="7" r="3.2"/><path d="M5 20v-1.6a7 7 0 0 1 14 0V20z"/>',
  radio:'<rect x="4" y="7" width="16" height="12" rx="2"/><path d="m7 7 10-4M7 11h6m-6 4h3m8-3v4"/><circle cx="17.5" cy="15" r=".7"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M5.5 6.5h13m-13 11h13"/>',
  news:'<path d="M5 4h14v16H5zM8 8h8M8 12h8m-8 4h5"/>',
  chat:'<path d="M4 5h16v12h-9l-5 3v-3H4z"/><path d="M8 10h8m-8 3h5"/>',
  boards:'<path d="M4 4h16v16H4zM4 10h16M10 4v16"/>',
  chest:'<path d="M4 9h16v11H4zM3 6h18v4H3zM12 10v10m-2-6h4"/>',
  more:'<path d="M12 3 4 7v5c0 5 4 8 8 9 4-1 8-4 8-9V7z"/><path d="M12 8v5m0 3h.01"/>',
  equipment:'<path d="m14 4 6 6-3 3-6-6m-2 2-6 8a2 2 0 0 0 3 3l8-6M5 5l2-2 4 4-2 2z"/>',
  bounty:'<path d="M12 3 4 7v5c0 5 4 8 8 9 4-1 8-4 8-9V7z"/><path d="m9 12 2 2 4-5"/>',
  archaeology:'<path d="M4 4h16v16H4zM8 8h8m-8 4h8m-8 4h5"/>',
  codex:'<path d="M4 5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 1-2-2zM8 3v16m12-8H8"/>'
};
const svgIcon=(name)=>`<svg class="nautical-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON_PATHS[name]||ICON_PATHS.more}</svg>`;
const ACTIONS={profile:["captain","Tarjeta del Alma"],whispers:["radio","Nexo de Conciencia"],world:["globe","Vista Mundial"],news:["news","Bitácora del Mar"],chat:["chat","Chat Global y Nexo"],boards:["boards","Tablón de Puerto"],chest:["chest","Barco"],more:["more","Ajustes del Sistema"],quick:["radio","Chat Global y Nexo"],navigation:["globe","Navegación / Isla"],tavern:["chat","Taberna de Puerto"],ship:["chest","Barco"],codex:["codex","Enciclopedia del Mar"]};
const PANEL_ID={news:"modal-noticias",chest:"modal-cofre",profile:"modal-perfil",codex:"modal-codex",tavern:"modal-taberna",market:"modal-mercado",chat:"modal-chat",quick:"modal-chat",more:"modal-ajustes",lineage:"modal-linaje",networkStatus:"modal-red",settings:"modal-ajustes",adminGM:"modal-admin-gm",navigation:"modal-navegacion"};
let root;let activeCharacter=null;let currentPanel=null;let selectedItem=null;let selectedPsych=null;let confirmingReset=false;let selectedBoardTab="commerce";let selectedChestTab="supplies";let selectedChatTab="global";let toastTimer=null;let modalHistoryId=null;let gmAuthorized=false;let gmGatePending=false;let panelSig="";const fmt=n=>new Intl.NumberFormat("es-ES").format(Number(n)||0);const esc=s=>String(s??"");
function emit(name,detail={}){document.dispatchEvent(new CustomEvent(`onepiece:hud-${name}`,{detail}))}
function closePanel(fromHistory=false){if(!currentPanel)return;const id=modalHistoryId;modalHistoryId=null;currentPanel=null;selectedItem=null;selectedPsych=null;confirmingReset=false;gmAuthorized=false;panelSig="";const overlay=root?.querySelector(".one-hud-backdrop");if(!overlay)return;overlay.classList.remove("open");overlay.setAttribute("aria-hidden","true");overlay.removeAttribute("id");root.querySelectorAll("[data-hud-panel]").forEach(button=>button.setAttribute("aria-expanded","false"));document.dispatchEvent(new CustomEvent("onepiece:modal-visibility",{detail:{open:false}}));if(!fromHistory&&id&&history.state?.onepieceModal===id)history.back()}
function stats(content,rows){const grid=document.createElement("div");grid.className="one-hud-stats";for(const [label,value] of rows){const box=document.createElement("div"),strong=document.createElement("strong");strong.textContent=label;box.append(strong,document.createTextNode(esc(value)));grid.append(box)}content.append(grid)}
function meter(content,label,value){const row=document.createElement("div");row.className="one-hud-meter";const title=document.createElement("strong");title.textContent=`${label}: ${value}%`;const bar=document.createElement("progress");bar.max=100;bar.value=value;row.append(title,bar);content.append(row)}
function list(content,items,empty){const ul=document.createElement("ul");ul.className="one-hud-list";if(!items.length){const li=document.createElement("li");li.textContent=empty;ul.append(li)}else items.forEach(item=>{const li=document.createElement("li");li.textContent=esc(item);ul.append(li)});content.append(ul)}
function renderTabs(container,sections,selected,onSelect){const tabs=document.createElement("div");tabs.className="one-hud-tabs";tabs.setAttribute("role","tablist");const body=document.createElement("div");body.className="one-hud-tab-body";sections.forEach((section,index)=>{const active=section.key===selected;const tab=document.createElement("button");tab.type="button";tab.id=`${container.id || currentPanel}-${section.key}-tab`;tab.setAttribute("role","tab");tab.setAttribute("aria-selected",String(active));tab.setAttribute("aria-controls",`${tab.id}-panel`);const icon=section.key==="bounty"?"bounty":section.key==="archaeology"?"archaeology":section.key==="commerce"?"boards":section.key==="global"?"chat":section.key==="consciousness"?"radio":section.key==="coliseo"?"bounty":section.key==="equipment"?"equipment":section.key==="supplies"?"chest":section.key==="relics"?"archaeology":section.key==="inheritance"?"chest":null;if(icon)tab.insertAdjacentHTML("afterbegin",svgIcon(icon));tab.append(document.createTextNode(section.label));const panel=document.createElement("section");panel.id=`${tab.id}-panel`;panel.className="one-hud-tab-panel";panel.setAttribute("role","tabpanel");panel.setAttribute("aria-labelledby",tab.id);panel.hidden=!active;section.render(panel);if(currentPanel==="boards"&&section.key==="archaeology"&&activeCharacter)renderArchaeologyBoard(panel,activeCharacter);tab.addEventListener("click",()=>{for(const [i,item]of [...tabs.children].entries()){item.setAttribute("aria-selected",String(i===index));body.children[i].hidden=i!==index}onSelect(section.key)});tabs.append(tab);body.append(panel)});container.append(tabs,body)}
function renderArchaeologyBoard(container,character){const state=character.archaeology||{rubbings:[],translations:[]};const heading=document.createElement("h3");heading.textContent="Calcos y traducciones";container.append(heading);if(!state.rubbings.length){const empty=document.createElement("p");empty.className="one-hud-muted";empty.textContent="Explora ruinas y monolitos para obtener calcos.";container.append(empty);return}for(const rubbing of state.rubbings){const card=document.createElement("article");card.className="one-hud-contract";const title=document.createElement("h3");title.textContent=rubbing.title;const location=document.createElement("p");location.textContent=`${rubbing.category||"Historia"} · ${rubbing.islandName} · ${rubbing.sold?"Vendido":rubbing.translated?"Descifrado":"Sin descifrar"}`;const glyphs=document.createElement("p");glyphs.className="one-hud-glyphs";glyphs.dataset.type=rubbing.type||"blue";glyphs.textContent=rubbing.glyphs;card.append(title,location,glyphs);const translation=state.translations.find(entry=>entry.siteId===rubbing.siteId);if(translation){const text=document.createElement("p");text.textContent=translation.text;card.append(text);if(translation.coordinates){const route=document.createElement("p");route.textContent=`Fragmento de ruta: ${translation.coordinates.name} · X:${translation.coordinates.x} Y:${translation.coordinates.y}`;card.append(route)}if(translation.relic){const relic=document.createElement("p");relic.textContent=`Reliquia: ${translation.relic.name} · ${translation.relic.clue}`;card.append(relic)}}const actions=document.createElement("div");actions.className="one-hud-contract-actions";if(!rubbing.translated&&!rubbing.sold){const translate=document.createElement("button");translate.type="button";translate.className="one-hud-action";translate.textContent="Descifrar";translate.disabled=!canReadAncient(character);translate.addEventListener("click",()=>emit("translate-rubbing",{rubbingId:rubbing.id}));actions.append(translate)}if(!rubbing.sold){const sell=document.createElement("button");sell.type="button";sell.className="one-hud-action";sell.textContent=`Vender calco · ฿300`;sell.disabled=character.status==="dead"||Boolean(character.location?.atSea);sell.addEventListener("click",()=>emit("sell-rubbing",{rubbingId:rubbing.id}));actions.append(sell)}if(actions.childElementCount)card.append(actions);container.append(card)}}
function itemRarity(item){if(item.rarity)return item.rarity;const name=String(item.name||"");return /poneglyph|arma ancestral|akuma|fruta|legendario/i.test(name)?"Legendario":/mapa|log pose|medalla|katana|brújula|reliquia/i.test(name)?"Raro":"Común"}
function renderFilteredItems(container,items,addSlot){const controls=document.createElement("div");controls.className="one-hud-item-filters";const search=document.createElement("input");search.type="search";search.placeholder="Buscar en el cofre…";search.setAttribute("aria-label","Buscar objetos del cofre");const rarity=document.createElement("select");rarity.setAttribute("aria-label","Filtrar por rareza");for(const value of ["Todas las rarezas","Común","Raro","Legendario"]){const option=document.createElement("option");option.value=value;option.textContent=value;rarity.append(option)}const grid=document.createElement("div");grid.className="one-hud-grid";const empty=document.createElement("p");empty.className="one-hud-muted";const draw=()=>{grid.replaceChildren();const filtered=items.filter(item=>(!search.value||item.name.toLocaleLowerCase("es").includes(search.value.toLocaleLowerCase("es")))&&(rarity.value==="Todas las rarezas"||itemRarity(item)===rarity.value));for(const item of filtered)addSlot(grid,item.name,item.qty>1?`x${item.qty}`:item.type,item);empty.hidden=filtered.length>0;empty.textContent=items.length?"No hay objetos que coincidan con los filtros.":"No hay objetos en esta categoría."};search.addEventListener("input",draw);rarity.addEventListener("change",draw);controls.append(search,rarity);container.append(controls,grid,empty);draw()}
function renderSoulCard(container,character,lineage){const registration=document.createElement("p");registration.className="one-hud-soul-registration";registration.textContent=`TARJETA DEL ALMA · ${(character.id||"SIN REGISTRO").slice(0,8).toUpperCase()}`;container.append(registration);const portrait=document.createElement("div");portrait.className="soul-portrait";portrait.setAttribute("role","img");portrait.setAttribute("aria-label",`Retrato de ${character.name||"aventurero"}`);portrait.append(portraitCanvas("soul-pixels",character));
  // tu bandera ondea junto a tu alma: mismo diseño del wizard
  if(character.flag){const flagBox=document.createElement("div");flagBox.className="soul-flag";const flagCv=document.createElement("canvas");flagCv.width=126;flagCv.height=78;flagCv.setAttribute("aria-label","Bandera de tu tripulación");const fctx=flagCv.getContext("2d");if(fctx)drawFlag(fctx,character.flag,flagCv.width,flagCv.height,performance.now());flagBox.append(flagCv);if(character.flag.tripulacion){const crew=document.createElement("small");crew.textContent=`⚓ ${character.flag.tripulacion}`;flagBox.append(crew)}container.append(flagBox)}container.append(portrait);const title=document.createElement("h3");title.textContent=character.name||"Aventurero";container.append(title);const motto=document.createElement("p");motto.className="soul-motto";motto.textContent=`«${character.story||character.soulCard?.dream||"El mar guarda mi historia"}»`;container.append(motto);const objective=document.createElement("p");objective.className="one-hud-objective";objective.textContent=`BUSCA: ${String(character.soulCard?.dream||"Libertad").toLocaleUpperCase("es")}`;container.append(objective);const traits=[...(character.soulCard?.traits?.pros||[]),...(character.soulCard?.traits?.cons||[])].join(" · ")||"Sin rasgos";stats(container,[["Facción",character.faction||"Pirata"],["Raza",RACES[character.race]?.name||"Humano"],["Mar de origen",character.originSea||"—"],["Rasgos",traits],["Profesión",character.profession||"Navegante"],["Generación",lineage.generation||1],["Berries",`฿${fmt(character.berries)}`],["Recompensa",`฿${fmt(character.bounty)}`]]);
}
function contractCategory(contract){if(contract.category)return contract.category;if(/arch|relic|poneglyph|reliquia/i.test(`${contract.id} ${contract.title}`))return"archaeology";return contract.id==="bounty"?"bounty":"commerce"}
function renderFugitiveContracts(container,character){const bosses=(character.world?.shared?.world?.bosses||[]).filter(boss=>boss.status==="fugitive"&&boss.secret_location);for(const boss of bosses){const card=document.createElement("article");card.className="one-hud-contract one-hud-fugitive-contract";const title=document.createElement("h3");title.textContent=`Recaptura: ${boss.name}`;const detail=document.createElement("p");detail.textContent=`Escapó y reúne ${boss.troops||2} combatientes en ${boss.hideout||"una guarida desconocida"}. Recompensa: ฿${fmt(boss.reward||500000)}.`;const button=document.createElement("button");button.type="button";button.className="one-hud-action";button.textContent="Perseguir la fuga";button.disabled=character.status==="dead";button.addEventListener("click",()=>emit("redirect",{location:{...boss.secret_location,name:boss.hideout||boss.name}}));card.append(title,detail,button);container.append(card)}}
function portraitCanvas(className,character){const canvas=document.createElement("canvas");canvas.className=`${className} one-hud-animated-avatar`;canvas.width=64;canvas.height=64;canvas.avatarCharacter=character;canvas.setAttribute("aria-hidden","true");const ctx=canvas.getContext("2d");if(ctx)drawPixelAvatar(ctx,character?.appearance||character||{},{size:64,equipment:character?.equipped,time:performance.now(),action:avatarAction(character),emotion:avatarEmotion(character)});return canvas}
// ── Coliseo de la isla: apuestas de berries por el gladiador del día (LO IMPENSABLE). ──
function renderContratos(container,c,traits){
  const contracts=c.availableContracts||[];
  const categories=[{key:"commerce",label:"Comercio"},{key:"bounty",label:"Caza de Recompensas"},{key:"archaeology",label:"Arqueología"}];
  renderTabs(container,categories.map(category=>({...category,render:panelContent=>{
    const items=contracts.filter(contract=>contractCategory(contract)===category.key);
    if(!items.length){const empty=document.createElement("p");empty.className="one-hud-muted";empty.textContent="No hay contratos disponibles en esta categoría.";panelContent.append(empty)}
    for(const contract of items){
      const card=document.createElement("article");card.className="one-hud-contract";
      const h=document.createElement("h3");h.textContent=contract.title;
      const detail=document.createElement("p");detail.textContent=`Riesgo: ${contract.risk} · Pago: ฿${fmt(contract.reward)} Berries`;
      const actions=document.createElement("div");actions.className="one-hud-contract-actions";
      const active=(c.activeContracts||[]).some(x=>x.id===contract.id&&x.status==="accepted");
      if(active){const badge=document.createElement("strong");badge.className="one-hud-badge";badge.textContent="EN CURSO";actions.append(badge)}
      else for(const decision of ["accept","reject"]){const button=document.createElement("button");button.className="one-hud-action";button.type="button";button.textContent=decision==="accept"?"Aceptar Contrato":"Rechazar";button.addEventListener("click",()=>emit("contract-decision",{contract,decision,traits}));actions.append(button)}
      card.append(h,detail,actions);panelContent.append(card)
    }
    if(category.key==="bounty")renderFugitiveContracts(panelContent,c)
  }})),selectedBoardTab,key=>{selectedBoardTab=key});
  if(c.contractNotice){const p=document.createElement("p");p.className="one-hud-muted";p.textContent=c.contractNotice;container.append(p)}
}
function renderColiseo(container,character){
  const dia=character.world?.day||1;
  const isla=character.location?.island||"el puerto libre";
  let h=dia*2654435761>>>0;for(const ch of isla)h=(h*31+ch.charCodeAt(0))>>>0;
  const rnd=n=>{let s=(h^(n*2654435761))>>>0;s=(s*1664525+1013904223)>>>0;return (s>>>8)%1000/1000};
  const DN=window.D?.NOMBRES||["Gladiador"],DE=window.D?.EPITETOS||["Sin apodo"];
  const mk=n=>({n:DN[Math.floor(rnd(n)*DN.length)%DN.length],e:DE[Math.floor(rnd(n+3)*DE.length)%DE.length],v:Math.floor(rnd(n+7)*11)+2});
  const f1=mk(1),f2=mk(2);
  stats(container,[["Arena",isla],["Jornada",`Día ${dia}`],["Pago si aciertas","×2.6 la apuesta"]]);
  const intro=document.createElement("p");intro.className="one-hud-muted";intro.textContent="Dos gladiadores suben hoy al coliseo. El favorito no siempre gana: la arena es traicionera.";container.append(intro);
  if(character.coliseo?.resolving){const p=document.createElement("p");p.className="one-hud-warning";p.textContent=`En la arena: apostaste ฿${character.coliseo.resolving.amount} por ${character.coliseo.resolving.fighter}. El resultado llega con la campana…`;container.append(p)}
  if(character.coliseo?.last){const p=document.createElement("p");p.className="one-hud-muted";p.textContent=character.coliseo.last;container.append(p)}
  const peleoHoy=character.coliseo?.fightDay===dia;
  const traits=[...(character.soulCard?.traits?.pros||[]),...(character.soulCard?.traits?.cons||[])].map(t=>String(t).toLowerCase());
  const temple=traits.some(t=>["agresivo","valiente","ferozo","impulsivo"].includes(t))?"Tu temple (rasgos agresivos) juega a tu favor."
    :traits.some(t=>["prudente","sereno"].includes(t))?"Tu temple prudente resta, pero evita golpes feos.":"Un temple neutro: la arena es moneda al aire.";
  const cardFight=document.createElement("article");cardFight.className="one-hud-contract one-hud-coliseo-fight";
  const hFight=document.createElement("h3");hFight.textContent=`Que pelee ${character.name||"tu avatar"}`;
  const pFight=document.createElement("p");pFight.className="one-hud-muted";pFight.textContent=`Inscripción ฿15 · Premio ฿70-150 y renombre. ${temple}${peleoHoy?" Ya peleó hoy: la arena espera al próximo día.":""}`;
  const btnFight=document.createElement("button");btnFight.type="button";btnFight.className="one-hud-action";
  btnFight.textContent=peleoHoy?"Ya peleó hoy":"Bajar a la arena";
  btnFight.disabled=peleoHoy||character.status==="dead"||character.location?.atSea||Number(character.berries)<15;
  btnFight.addEventListener("click",()=>emit("coliseo-fight"));
  cardFight.append(hFight,pFight,btnFight);container.append(cardFight);
  const betting=character.coliseo?.resolving||character.coliseo?.fightDay===dia;
  for(const [f,rival] of [[f1,f2.n],[f2,f1.n]]){
    const card=document.createElement("div");card.className="one-hud-contract";
    const h3=document.createElement("h3");h3.textContent=f.n;card.append(h3);
    const p=document.createElement("p");p.className="one-hud-muted";p.textContent=`${f.e} · ${f.v} victorias este mes`;card.append(p);
    const row=document.createElement("div");row.className="one-hud-contract-actions";
    const input=document.createElement("input");input.type="number";input.min="10";input.max=String(Math.max(10,Math.min(500,Number(character.berries)||10)));input.value="20";input.setAttribute("aria-label",`Apuesta por ${f.n}`);row.append(input);
    const bet=document.createElement("button");bet.type="button";bet.className="one-hud-action";bet.textContent=`Apostar por ${f.n}`;
    bet.disabled=character.status==="dead"||character.location?.atSea||Number(character.berries)<10;
    bet.addEventListener("click",()=>{emit("coliseo-bet",{fighter:f.n,rival,amount:input.value})});
    row.append(bet);card.append(row);container.append(card);
  }
}
function renderGlobalChat(container,character,sharedEvents){
  const feed=document.createElement("div");feed.className="one-hud-chat-feed";
  const messages=getGlobalChat(sharedEvents);
  if(!messages.length){const empty=document.createElement("p");empty.className="one-hud-muted";empty.textContent="Aún no hay mensajes. Sé el primero en saludar a las tripulaciones.";feed.append(empty)}
  for(const message of messages){
    const row=document.createElement("article");row.className="one-hud-chat-message";
    const appearance=message.author===character.name?character.appearance:{};
    const body=document.createElement("div");body.className="one-hud-chat-body";
    const author=document.createElement("strong");author.textContent=message.author;
    const text=document.createElement("p");text.textContent=message.text;
    const time=document.createElement("time");time.textContent=message.time?new Date(message.time).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"}):"Ahora";
    body.append(author,text);row.append(portraitCanvas("one-hud-chat-avatar",appearance),body,time);feed.append(row)
  }
  const notices=(sharedEvents||[]).filter(event=>event.type!=="global_chat").slice(0,8);
  const noticeSection=document.createElement("section");noticeSection.className="one-hud-chat-notices";
  const heading=document.createElement("h3");heading.textContent="Avisos del mundo";noticeSection.append(heading);
  if(!notices.length)list(noticeSection,[],"Sin avisos recientes.");
  for(const notice of notices){const row=document.createElement("article");row.className="one-hud-notice";const appearance=character.name&&String(notice.text).includes(character.name)?null:npcAppearanceFor(notice.text);if(appearance)row.append(portraitCanvas("one-hud-chat-avatar",appearance));const text=document.createElement("p");text.textContent=notice.text;row.append(text);noticeSection.append(row)}
  const form=document.createElement("form");form.className="one-hud-form";const input=document.createElement("textarea");input.maxLength=280;input.placeholder="Mensaje para las tripulaciones…";input.setAttribute("aria-label","Mensaje de chat global");const send=document.createElement("button");send.type="submit";send.className="one-hud-action";send.textContent="Enviar al Chat Global";send.disabled=character.status==="dead";form.append(input,send);form.addEventListener("submit",event=>{event.preventDefault();const result=postGlobalChat(character,input.value);if(!result.ok){showToast(result.message);return}openPanel("chat")});container.append(feed,noticeSection,form)
}
function renderConsciousnessChat(container,character){stats(container,[["Sintonía",`${character.whisper?.affinity??55}%`],["Rebeldía",`${character.whisper?.rebellion??45}%`],["Estado",character.autonomy?.paused?"En pausa":"Reflexionando"]]);const history=document.createElement("div");history.className="one-hud-chat-feed";const entries=getWhisperHistory(character);if(!entries.length){const empty=document.createElement("p");empty.textContent="La bitácora aún no registra susurros.";history.append(empty)}for(const entry of entries){const card=document.createElement("article");card.className="one-hud-chat-message";const body=document.createElement("div");const badge=document.createElement("strong");badge.textContent=entry.status||"Registrado";const message=document.createElement("p");message.textContent=entry.message;body.append(badge,message);if(entry.response){const response=document.createElement("p");response.textContent=entry.response;body.append(response)}card.append(body);history.append(card)}container.append(history);const form=document.createElement("form");form.className="one-hud-form";const input=document.createElement("textarea");input.maxLength=160;input.placeholder="Escribe un consejo para tu avatar…";input.setAttribute("aria-label","Susurro al avatar");const send=document.createElement("button");send.type="submit";send.className="one-hud-action";send.textContent="Enviar Susurro";send.disabled=character.status==="dead";form.append(input,send);form.addEventListener("submit",event=>{event.preventDefault();const text=input.value.trim();if(!text)return;emit("whisper",{text});input.value="";openPanel("chat")});container.append(form)}
function renderTerritoryControls(content,character){if(currentPanel!=="world")return;const shared=character.world?.shared;if(shared?.status!=="local"||character.status==="dead"||character.captured)return;const world=shared.world||{},section=document.createElement("section");section.className="one-hud-contract";const heading=document.createElement("h3");heading.textContent="Soberanía local";section.append(heading);if(!character.location?.atSea){const island=getMapIslands(character).find(entry=>entry.name===character.location?.island);if(!island)return;const control=world.islands_control?.find(entry=>entry.island_id===island.id);const status=document.createElement("p");status.textContent=control?.owner_name?`Controlada por ${control.owner_name} · Impuesto ${control.tax_rate||0}% · Tesorería ฿${fmt(control.treasury)}`:"Isla sin soberanía de jugador.";section.append(status);const form=document.createElement("form");form.className="one-hud-form";const rate=document.createElement("select");rate.setAttribute("aria-label","Impuesto portuario");for(const value of [0,5,10,15,20]){const option=document.createElement("option");option.value=String(value);option.textContent=`Impuesto ${value}%`;option.selected=Number(control?.tax_rate||0)===value;rate.append(option)}const claim=document.createElement("button");claim.type="submit";claim.className="one-hud-action";claim.textContent=control?.owner_id===character.id?"Actualizar impuesto":"Reclamar isla";claim.disabled=Boolean(control?.owner_id&&control.owner_id!==character.id);form.append(rate,claim);form.addEventListener("submit",event=>{event.preventDefault();emit("territory-claim",{islandId:island.id,taxRate:rate.value})});section.append(form)}else{const nearby=getMapIslands(character).filter(island=>Number.isFinite(character.mapPosition?.x)&&Math.hypot(island.x-character.mapPosition.x,island.y-character.mapPosition.y)<=100);if(!nearby.length){const note=document.createElement("p");note.textContent="Acércate a una isla para iniciar un bloqueo naval.";section.append(note)}for(const island of nearby){if(world.islands_control?.find(entry=>entry.island_id===island.id)?.owner_id===character.id)continue;const form=document.createElement("form");form.className="one-hud-form";const duration=document.createElement("select");duration.setAttribute("aria-label",`Duración del bloqueo de ${island.name}`);for(const value of [1,3,7]){const option=document.createElement("option");option.value=String(value);option.textContent=`${value} día${value===1?"":"s"} · ฿${100*value}`;duration.append(option)}const blockade=document.createElement("button");blockade.type="submit";blockade.className="one-hud-action";blockade.textContent=`Bloquear ${island.name}`;form.append(duration,blockade);form.addEventListener("submit",event=>{event.preventDefault();emit("territory-blockade",{islandId:island.id,durationDays:duration.value})});section.append(form)}}content.append(section)}
async function openPanel(panel){const overlay=root?.querySelector(".one-hud-backdrop"),title=root?.querySelector(".one-hud-heading-title"),content=root?.querySelector(".one-hud-content");if(!overlay||!title||!content)return;const c=activeCharacter||{};if(panel==="adminGM"&&!isLocalGMAvailable(c)){showToast("El panel GM solo está disponible en una partida local desconectada.");return}if(panel==="adminGM"&&!gmAuthorized){if(gmGatePending)return;gmGatePending=true;try{const creating=!hasLocalGMPin();const pin=window.prompt(creating?"Crea un PIN local de 4 a 12 dígitos para el panel GM:":"Introduce el PIN local del panel GM:");if(pin===null)return;if(creating){const confirmation=window.prompt("Confirma el PIN local del panel GM:");if(confirmation===null)return;if(pin!==confirmation){showToast("Los PIN no coinciden.");return}const result=await setLocalGMPin(pin);if(!result.ok){showToast(result.message);return}}else if(!await verifyLocalGMPin(pin)){showToast("PIN incorrecto.");return}gmAuthorized=true}catch(error){showToast(error instanceof Error?error.message:"No se pudo verificar el PIN local.");return}finally{gmGatePending=false}}if(!currentPanel){modalHistoryId=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;history.pushState({...history.state,onepieceModal:modalHistoryId},"");document.dispatchEvent(new CustomEvent("onepiece:modal-visibility",{detail:{open:true}}))}const world=c.world||{},lineage=c.lineage||{},inventory=c.inventory||{provisions:0,equipment:[],items:[]},traits=[...(c.soulCard?.traits?.pros||[]),...(c.soulCard?.traits?.cons||[])].map(x=>String(x).toLowerCase());const headers={profile:"Tarjeta del Alma",codex:"Enciclopedia del Mar",whispers:"Nexo de Conciencia",world:"Vista Mundial",news:"Bitácora del Mar",chat:"Chat Global y Nexo",boards:"Tablón de Puerto",chest:"Barco",tavern:"Taberna de Puerto",market:"Mercado del puerto",more:"Ajustes del Sistema",lineage:"Panteón y Árbol de Linaje",settings:"Ajustes del Sistema",quick:"Chat Global y Nexo",adminGM:"Game Master · Mundo local",navigation:"Navegación · Rumbo del Avatar"};title.textContent=headers[panel]||"Bitácora del Mar";content.replaceChildren();overlay.id=PANEL_ID[panel]||`modal-${panel}`;currentPanel=panel;
  if(panel==="navigation"){
    // RECONEXIÓN: el botón central del nav quedó sin case al unificar la UI — sin esto el click no mostraba nada.
    title.textContent="Navegación · Rumbo del Avatar";
    const travel=c.travel||{docked:true,logPoseCharge:0};
    stats(content,[
      ["Ubicación actual",c.location?.atSea?"Mar abierto":c.location?.island||"Desconocida"],
      ["Estado",travel.docked?"Amarrado en puerto":"Navegando"],
      ["Log Pose",`${Math.round(travel.logPoseCharge||0)}% cargado`],
      ["Barco",c.ship?.acquired?`${c.ship.model||"Carabela"} · Integridad ${c.ship.health??100}%`:"Sin barco aún"]
    ]);
    const intro=document.createElement("p");intro.className="one-hud-muted";
    intro.textContent="El avatar elige su rumbo con tu consejo: sugerile zarpar a una isla y la evaluará con su carácter. El Log Pose se alinea navegando: 3 tramos por isla. Las coordenadas del mapa no se escriben: se apuntan solas al fijar rumbo.";
    content.append(intro);
    // el Log Pose del destino: la brújula viva que giró el Grand Line entero
    const carga=Math.round(travel.logPoseCharge||0);
    const lp=c.logPose||{alignment:0,required:3};
    const lpCard=document.createElement("div");lpCard.className="logpose-card";lpCard.style.setProperty("--lp-progress",carga);
    const ring=document.createElement("div");ring.className="logpose-ring";
    const spin=document.createElement("div");spin.className="ring-spin";ring.append(spin);
    const lpVal=document.createElement("span");lpVal.textContent=`${carga}%`;ring.append(lpVal);
    const lpText=document.createElement("div");
    const lpFrase=carga>=100?"El registro está completo: el rumbo apunta a la próxima isla. Zarpar es seguro."
      :carga>=50?`El magnetismo se acumula: tramo ${Math.floor(carga/34)+1} de ${lp.required||3} fijándose. Navegar con carga parcial rinde la mitad.`
      :"El Log Pose apenas susurra: cada tramo de mar graba el magnetismo de la isla en su núcleo.";
    lpText.innerHTML=`<h4>Log Pose del destino</h4><p>${lpFrase}</p><small>Isla registrada: ${c.location?.atSea?"mar abierto":c.location?.island||"—"} · Alineamientos completados: ${Math.floor(lp.alignment||0)}/${lp.required||3}</small>`;
    lpCard.append(ring,lpText);
    content.append(lpCard);
    // preparación del zarpe visible: lo que el mar va a cobrar si se improvisa
    if(!c.location?.atSea&&c.status!=="dead"){
      const conNavegante=hasNauticalCrew(c);
      const provisos=Number(c.inventory?.provisions)||0;
      const chips=document.createElement("div");chips.className="one-hud-preparacion";
      const chip=(texto,ok)=>{const s=document.createElement("span");s.className=ok?"prep-ok":"prep-riesgo";s.textContent=texto;chips.append(s)};
      chip(conNavegante?"✔ Navegante a bordo":"⚠ Sin navegante: riesgo de deriva",conNavegante);
      chip(provisos>0?"✔ Provisiones suficientes":"⚠ Sin provisiones: hambre en alta mar",provisos>0);
      if(Number(c.ship?.health)<50)chip(`⚠ Casco al ${c.ship.health}%`,false);
      content.append(chips);
    }
    // ── Tablón de Puerto: encargos por riesgo; el jugador sugiere, el avatar decide ──
    if(!c.location?.atSea&&c.status!=="dead"){
      const tablon=document.createElement("section");tablon.className="one-hud-tablon";
      const tabH=document.createElement("h3");tabH.textContent="📋 Tablón de Puerto · encargos del día";tablon.append(tabH);
      const tabIntro=document.createElement("p");tabIntro.className="one-hud-muted";tabIntro.textContent=`Los encargos se renuevan cada día en ${c.location?.island||"el puerto"}. Sugerí uno: ${c.name||"tu avatar"} caminará al tablón y lo resolverá según su carácter — sugerir no es controlar.`;
      tablon.append(tabIntro);
      const ENCARGOS=tablonDelPuerto(c);
      const nivelRiesgo={1:["Bajo","riesgo-bajo"],2:["Medio","riesgo-medio"],3:["Alto","riesgo-alto"]};
      for(const encargo of ENCARGOS){
        const fila=document.createElement("div");fila.className="one-hud-encargo";
        const info=document.createElement("div");info.className="one-hud-encargo-info";
        const head=document.createElement("div");head.className="one-hud-encargo-head";
        const badge=document.createElement("span");badge.className=`one-hud-riesgo ${nivelRiesgo[encargo.riesgo]?.[1]||"riesgo-bajo"}`;badge.textContent=nivelRiesgo[encargo.riesgo]?.[0]||"—";
        const nombre=document.createElement("strong");nombre.textContent=encargo.nombre;
        head.append(badge,nombre);
        const texto=document.createElement("small");texto.textContent=`${encargo.texto} · Pago ฿${encargo.pago}`;
        info.append(head,texto);
        const btn=document.createElement("button");btn.type="button";btn.className="one-hud-action";btn.textContent=`Sugerir a ${c.name||"el avatar"}`;
        btn.addEventListener("click",()=>emit("tablon-suggest",{encargoId:encargo.id}));
        fila.append(info,btn);
        tablon.append(fila);
      }
      if(c.encargoSugerido){const pendiente=document.createElement("p");pendiente.className="one-hud-muted";pendiente.textContent=`📋 Encargo en curso: «${c.encargoSugerido.nombre}» — ${c.name||"el avatar"} va camino del tablón.`;tablon.append(pendiente)}
      content.append(tablon);
    }
    // ── El Gobierno Mundial: decretos de los Cinco Ancianos, nobles, CP9 y la conspiración del Arquitecto ──
    if(!c.location?.atSea&&c.status!=="dead"){
      const gobierno=document.createElement("section");gobierno.className="one-hud-gobierno";
      const govH=document.createElement("h3");govH.textContent="🏛 El Gobierno Mundial";gobierno.append(govH);
      const decreto=document.createElement("p");decreto.className="one-hud-muted";decreto.textContent=resumenGobierno(c);gobierno.append(decreto);
      // el desfile celestial: pagar el tributo o desafiar al noble
      if(c.desfilePendiente){
        const noble=document.createElement("div");noble.className="one-hud-noble";
        const nobleInfo=document.createElement("span");nobleInfo.textContent=`👑 ${c.desfilePendiente.noble} exige ฿${c.desfilePendiente.tributo}`;
        const nobleBtns=document.createElement("div");nobleBtns.className="one-hud-noble-btns";
        const pagar=document.createElement("button");pagar.type="button";pagar.className="one-hud-action";pagar.textContent="Pagar tributo";
        pagar.disabled=(Number(c.berries)||0)<c.desfilePendiente.tributo;
        pagar.addEventListener("click",()=>emit("tributo-action",{action:"pagar"}));
        const desoir=document.createElement("button");desoir.type="button";desoir.className="one-hud-action";desoir.textContent="Desoír · +recompensa";
        desoir.addEventListener("click",()=>emit("tributo-action",{action:"desoir"}));
        nobleBtns.append(pagar,desoir);noble.append(nobleInfo,nobleBtns);gobierno.append(noble);
      }
      if(c.cp9?.vigilando){const cp9=document.createElement("p");cp9.className="one-hud-warning";cp9.textContent=`👁 CP9 te vigila desde ${c.cp9.isla}: ${c.cp9.agente}, "${c.cp9.apodo}". Zarpar puede costarte una emboscada.`;gobierno.append(cp9)}
      // el filósofo del puerto: teoría del Vacío y, a veces, un plano del Arquitecto
      const filosofo=filosofoDeIsla(c);
      const filaFilosofo=document.createElement("div");filaFilosofo.className="one-hud-encargo";
      const infoFilosofo=document.createElement("div");infoFilosofo.className="one-hud-encargo-info";
      const headFilosofo=document.createElement("div");headFilosofo.className="one-hud-encargo-head";
      const badgeFilosofo=document.createElement("span");badgeFilosofo.className="one-hud-riesgo riesgo-bajo";badgeFilosofo.textContent="Filósofo";
      const nombreFilosofo=document.createElement("strong");nombreFilosofo.textContent=filosofo.nombre;
      headFilosofo.append(badgeFilosofo,nombreFilosofo);
      const textoFilosofo=document.createElement("small");textoFilosofo.textContent=`«${filosofo.teoria}» · consulta ฿${filosofo.precio}`;
      infoFilosofo.append(headFilosofo,textoFilosofo);
      const btnFilosofo=document.createElement("button");btnFilosofo.type="button";btnFilosofo.className="one-hud-action";btnFilosofo.textContent="Consultar";
      btnFilosofo.disabled=(Number(c.berries)||0)<filosofo.precio;
      btnFilosofo.addEventListener("click",()=>emit("filosofo-consult"));
      filaFilosofo.append(infoFilosofo,btnFilosofo);gobierno.append(filaFilosofo);
      // los planos del Arquitecto: la conspiración que se dibuja
      const planos=planosDeArquitecto(c);
      if(planos.some((p)=>p.tenido)){
        const planosBox=document.createElement("div");planosBox.className="one-hud-planos";
        const planosH=document.createElement("strong");planosH.textContent=`📐 Los planos del Arquitecto · ${planos.filter((p)=>p.tenido).length}/${planos.length}`;
        planosBox.append(planosH);
        for(const plano of planos.filter((p)=>p.tenido)){const linea=document.createElement("small");linea.textContent=`${plano.nombre}: ${plano.texto}`;planosBox.append(linea)}
        gobierno.append(planosBox);
      }
      content.append(gobierno);
    }
    const verMapa=document.createElement("button");verMapa.type="button";verMapa.className="one-hud-action";
    verMapa.textContent="Ver mi isla en el mapa vivo";
    verMapa.disabled=Boolean(c.location?.atSea)||c.status==="dead";
    verMapa.addEventListener("click",()=>{closePanel();emit("volar-isla")});
    content.append(verMapa);
    const list=document.createElement("div");list.className="one-hud-contracts";
    const islas=getMapIslands(c);const actual=c.location?.island;
    const visibles=islas.slice(0,14);
    for(const isla of visibles){
      const row=document.createElement("div");row.className="one-hud-contract";
      const h=document.createElement("h3");h.textContent=isla.name;row.append(h);
      const p=document.createElement("p");p.className="one-hud-muted";
      p.textContent=`${isla.biome||"Bioma por descubrir"}${isla.sea?` · ${isla.sea}`:""}`;
      row.append(p);
      const btn=document.createElement("button");btn.type="button";btn.className="one-hud-action";
      const esActual=!c.location?.atSea&&isla.name===actual;
      const hayBarco=Boolean(c.ship?.acquired);
      btn.textContent=esActual?"Puerto actual":hayBarco?"Sugerir zarpar aquí":"Sugerir rumbo aquí";
      btn.disabled=esActual||c.location?.atSea||c.status==="dead";
      btn.addEventListener("click",()=>{
        closePanel();
        if(hayBarco){emit("sail-suggest",{location:{x:isla.x,y:isla.y,name:isla.name}});}
        else{emit("redirect",{location:{x:isla.x,y:isla.y,name:isla.name}});showToast(`Rumbo sugerido: ${isla.name}`);}
      });
      row.append(btn);list.append(row);
    }
    content.append(list);
    if(islas.length>visibles.length){const mas=document.createElement("p");mas.className="one-hud-muted";mas.textContent=`… y ${islas.length-visibles.length} islas más en el mapa del mundo.`;content.append(mas)}
  }
  else if(panel==="chest"){
    title.textContent="Barco";
    const slots=document.createElement("div");slots.className="one-hud-grid";
    const addSlot=(target,label,value,entry)=>{const cell=document.createElement(entry?"button":"div");cell.className="one-hud-slot";if(entry){cell.type="button";cell.dataset.selected=String(selectedItem?.kind===entry.kind&&selectedItem?.name===entry.name);cell.addEventListener("click",()=>{selectedItem={kind:entry.kind,name:entry.name};openPanel("chest")})}const name=document.createElement("strong");name.textContent=label;cell.append(name,document.createTextNode(String(value)));target.append(cell)};
    addSlot(slots,"Berries",`฿ ${fmt(c.berries)}`);
    const equipped=c.equipped||{};addSlot(slots,"Arma activa",equipped.weapon||"—");addSlot(slots,"Armadura activa",equipped.armor||"—");
    content.append(slots);
    const shipyard=document.createElement("section");shipyard.className="one-hud-crew";const shipHeading=document.createElement("h3");shipHeading.textContent="Primer barco y zarpe";shipyard.append(shipHeading);
    const shipStatus=document.createElement("p");shipStatus.className="one-hud-muted";shipStatus.textContent=c.ship?.acquired?`${c.ship.model||"Carabela"} · Integridad ${c.ship.health??100}% · ${hasNauticalCrew(c)?"Tripulación lista":"Podés zarpar solo; el mar cobra caro"}`:`Sin barco · ${c.inventory?.timber||0}/3 tablones · ฿${fmt(c.berries)}`;shipyard.append(shipStatus);
    // el muelle SIEMPRE paga: sin barco financia el casco, con barco es jornada de marinero
    const workLabel=c.ship?.acquired?"Jornada portuaria · +฿45":"Trabajar en el muelle · +฿90";
    const workButton=document.createElement("button");workButton.type="button";workButton.className="one-hud-action";workButton.textContent=workLabel;
    workButton.disabled=c.status==="dead"||Boolean(c.location?.atSea)||Boolean(c.captured);
    workButton.addEventListener("click",()=>emit("shipyard-action",{action:"work"}));shipyard.append(workButton);
    if(!c.ship?.acquired){for(const [action,label,enabled]of [["gather","Recuperar madera",true],["purchase","Comprar carabela · ฿300",Number(c.berries)>=300],["craft","Construir chalupa · 3 tablones + ฿120",Number(c.inventory?.timber)>=3&&Number(c.berries)>=120],["steal","Intentar robar un barco · Riesgo alto",true]]){const button=document.createElement("button");button.type="button";button.className="one-hud-action";button.textContent=label;button.disabled=!enabled;button.addEventListener("click",()=>emit("shipyard-action",{action}));shipyard.append(button)}}
    if(!hasNauticalCrew(c)){const crewNotice=document.createElement("p");crewNotice.className="one-hud-warning";crewNotice.textContent="Sin Navegante o Carpintero el mar cobra caro: deriva y tormentas. Y para cruzar a la Grand Line un navegante es obligatorio — la preparación del barco vale más que el nivel.";}
    content.append(shipyard);
    // ── la tripulación: cada rostro con su lealtad; en la Grand Line nadie baja gratis ──
    const crewSection=document.createElement("section");crewSection.className="one-hud-crew";const crewH=document.createElement("h3");crewH.textContent="Tripulación del barco";crewSection.append(crewH);
    const enGL=enGrandLine(c);
    const supplies=document.createElement("p");supplies.className="one-hud-muted";supplies.textContent=`Provisiones: ${c.inventory?.provisions??0} · Agua: ${c.inventory?.water??0} · Zona: ${enGL?"Grand Line":"Cuatro Blues"}${c.ship?.reinforced?" · Casco reforzado":""}`;crewSection.append(supplies);
    if(Number(c.ship?.health) < 60 && !c.ship?.reinforced){const hull=document.createElement("p");hull.className="one-hud-warning";hull.textContent=`Casco al ${c.ship?.health}%: la Reverse Mountain no perdona cascos rendidos. Repara o refuerza en un astillero antes de pensar en la Grand Line.`;crewSection.append(hull)}
    if(!(c.crew||[]).length){const vacia=document.createElement("p");vacia.className="one-hud-muted";vacia.textContent="Sin tripulación: recluta en la taberna de cada puerto.";crewSection.append(vacia)}
    for(const member of (c.crew||[])){const row=document.createElement("div");row.className="one-hud-crew-member";const info=document.createElement("span");info.textContent=`${member.name} · ${member.role} · lealtad ${member.loyalty??50}%`;const dismiss=document.createElement("button");dismiss.type="button";dismiss.className="one-hud-action";dismiss.textContent=enGL?"Dejar atrás · costo real":"Despedir";dismiss.title=enGL?"En la Grand Line dejar a alguien de la tripulación puede costar la vida: depende de la severidad del capitán":"Se despide en el puerto sin drama";dismiss.addEventListener("click",()=>emit("tavern-action",{visitorId:member.visitorId||member.id||member.name,action:"dismiss"}));row.append(info,dismiss);crewSection.append(row)}
    if(c.usurpedBy){const mutiny=document.createElement("p");mutiny.className="one-hud-warning";mutiny.textContent=`🏴‍☠️ ${c.usurpedBy} usurpó el mando del barco: la desconfianza corre por la cubierta.`;const challenge=document.createElement("button");challenge.type="button";challenge.className="one-hud-action";challenge.textContent="Desafiar al usurpador en la taberna";challenge.addEventListener("click",()=>emit("tavern-action",{visitorId:null,action:"challenge"}));crewSection.append(mutiny,challenge)}
    else if(c.distrust){const distrust=document.createElement("p");distrust.className="one-hud-muted";distrust.textContent="La desconfianza sigue viva en el barco: los reclutas llegarán mirando de reojo y la lealtad sana lento.";crewSection.append(distrust)}
    content.append(crewSection);
    if(c.captured){const rescue=document.createElement("section");rescue.className="one-hud-contract one-hud-rescue-card";const heading=document.createElement("h3");heading.textContent="Rescate en curso";const notice=document.createElement("p");notice.textContent=`Cautivo en ${c.captured.island} · Rescate: ฿${fmt(c.captured.ransom)}.`;rescue.append(heading,notice);const actions=document.createElement("div");actions.className="one-hud-contract-actions";for(const [action,label]of [["ransom","Pagar rescate"],["infiltrate","Infiltrar la subasta"]]){const button=document.createElement("button");button.type="button";button.className="one-hud-action";button.textContent=label;button.disabled=action==="infiltrate"&&!c.crew?.length;button.addEventListener("click",()=>emit("politics",{action}));actions.append(button)}rescue.append(actions);content.append(rescue)}
    const entries=listChestItems(c);
    const documents=[
      ...(c.archaeology?.rubbings||[]).map(rubbing=>({name:`Calco: ${rubbing.title}`,type:rubbing.translated?"Descifrado":"Glifos indescifrables",rarity:"Legendario"})),
      ...(c.systems?.treasureMaps||[]).map(map=>({name:map.name||"Mapa de reliquia",type:map.clue||"Mapa sin descifrar: los glifos guardan su pista",rarity:"Raro"})),
      ...(c.ancientLanguage?.fragments||[]).map(fragment=>({name:`Fragmento: ${fragment.id}`,type:fragment.clue||"Fragmento antiguo",rarity:"Raro"}))
    ];
    const soulCard=document.createElement("section");soulCard.className="one-hud-soul";renderSoulCard(soulCard,c,lineage);content.append(soulCard);
    const groups=[
      {key:"supplies",label:"Consumibles",items:entries.filter(entry=>entry.consumable||entry.kind==="provision")},
      {key:"documents",label:"Calcos & Mapas",items:documents},
      {key:"equipment",label:"Equipamiento",items:entries.filter(entry=>entry.kind==="equipment")},
      {key:"inheritance",label:"Cofre de Herencia Persistente",items:lineage.legacyChest||[]}
    ];
    renderTabs(content,groups.map(group=>({key:group.key,label:group.label,render:panel=>{
      if(group.key==="inheritance"){const inherited=group.items.map(item=>typeof item==="string"?{name:item,type:"Reliquia",rarity:"Raro"}:{...item,name:item.name||"Reliquia heredada",type:item.type||"Reliquia"});renderFilteredItems(panel,inherited,(grid,name,value)=>{const card=document.createElement("article");card.className="one-hud-slot";const heading=document.createElement("strong");heading.textContent=name;const detail=document.createElement("p");detail.textContent=value;card.append(heading,detail);grid.append(card)});return}
      if(group.key==="documents"){renderFilteredItems(panel,group.items,(grid,name,value)=>{const card=document.createElement("article");card.className="one-hud-slot";const heading=document.createElement("strong");heading.textContent=name;const detail=document.createElement("p");detail.textContent=value;card.append(heading,detail);grid.append(card)});return}
      renderFilteredItems(panel,group.items,(grid,name,value,entry)=>addSlot(grid,name,value,entry));
    }})),selectedChestTab,key=>{selectedChestTab=key});
    const entry=entries.find(item=>item.kind===selectedItem?.kind&&item.name===selectedItem?.name);
    if(entry){const card=document.createElement("article");card.className="one-hud-inspect";const h=document.createElement("h3");h.textContent=entry.name;const info=document.createElement("p");info.textContent=`Tipo: ${entry.type} · Stats: ${entry.stats}`;const desc=document.createElement("p");desc.textContent=entry.description;const actions=document.createElement("div");actions.className="one-hud-contract-actions";
      const act=(label,action,enabled)=>{const button=document.createElement("button");button.type="button";button.className="one-hud-action";button.textContent=label;button.disabled=!enabled;button.addEventListener("click",()=>emit("chest-use",{ref:{kind:entry.kind,name:entry.name},action}));actions.append(button)};
      act("Consumir","consume",Boolean(entry.consumable));act("Equipar","equip",Boolean(entry.equippable));act("Susurrar a Avatar","whisper",true);
      const priority=(c.whisper?.priorityItems||[]).some(item=>item.kind===entry.kind&&item.name===entry.name);
      const pending=(c.whisper?.itemSuggestions||[]).some(item=>item.kind===entry.kind&&item.name===entry.name);
      for(const [action,label] of [["sell","Sugerir Venta en Puerto"],["priority","Marcar Objeto Prioritario"]]){const button=document.createElement("button");button.type="button";button.className="one-hud-action";button.textContent=label;button.disabled=c.status==="dead"||(action==="sell"&&(priority||pending))||(action==="priority"&&priority);button.addEventListener("click",()=>emit("item-suggestion",{ref:{kind:entry.kind,name:entry.name},action}));actions.append(button)}
      const status=document.createElement("p");status.textContent=priority?"Prioritario: conservar este tipo de objeto.":pending?"Venta sugerida para el próximo puerto.":"Las sugerencias de venta pueden ser rechazadas por el avatar.";card.append(h,info,desc,status,actions);content.append(card)}
    const security=c.shipSecurity||{humidity:10,raidRisk:10};stats(content,[["Humedad",`${security.humidity}%`],["Riesgo de asalto",`${security.raidRisk}%`],["Seguridad del cofre",security.raidRisk<30?"Estable":"En riesgo"]]);const note=document.createElement("p");note.className="one-hud-muted";note.textContent=c.lastChestDecision||"El cofre está listo para recibir provisiones.";content.append(note);const add=document.createElement("button");add.className="one-hud-action";add.type="button";add.textContent="Guardar provisión en el cofre";add.addEventListener("click",()=>emit("chest-item",{item:{type:"provision",name:"Provisión de viaje",quantity:1}}));content.append(add);const will=document.createElement("button");will.className="one-hud-action";will.type="button";will.textContent="Redactar Testamento";will.addEventListener("click",()=>emit("draft-will"));content.append(will);if(c.systems?.testament){const testament=document.createElement("p");testament.className="one-hud-testament";testament.textContent=c.systems.testament.text;content.append(testament)}for(const map of c.systems?.treasureMaps||[]){const clue=document.createElement("p");clue.className="one-hud-treasure-map";clue.textContent=map.clue;content.append(clue)}
  }else if(panel==="tavern"){
    // UNA sola taberna con TODO el puerto adentro: reclutar, coliseo, contratos y radio.
    // Antes había botones duplicados por todos lados (taberna en nav, taberna en vista
    // mundial, coliseo enterrado en el chat, tablón inaccesible) — eso era asqueroso.
    const port=document.createElement("p");port.className="one-hud-muted";port.textContent=`Puerto actual: ${c.location?.island||"Puerto desconocido"} · Berries: ฿${fmt(c.berries)}`;content.append(port);
    if(lineage.generation>1&&lineage.inheritedReputation>0){const memory=document.createElement("p");memory.className="one-hud-muted";memory.textContent=`Los bardos recuerdan al linaje ${lineage.family}: renombre ancestral ฿${fmt(lineage.inheritedReputation)}.`;content.append(memory)}
    const renderReclutar=(panelContent)=>{
      const visitors=getTavernCandidates(c);const roster=document.createElement("div");roster.className="one-hud-tavern-roster";
      visitors.forEach(visitor=>{const card=document.createElement("article");card.className="one-hud-contract one-hud-tavern-card";const heading=document.createElement("h3");heading.textContent=visitor.name;const detail=document.createElement("p");detail.textContent=`${visitor.role} · Rasgo: ${visitor.trait} · Fuerza ${visitor.attributes.strength} · Agilidad ${visitor.attributes.agility} · Ingenio ${visitor.attributes.ingenuity}`;const loyalty=document.createElement("div");loyalty.className="one-hud-loyalty";const loyaltyLabel=document.createElement("span");loyaltyLabel.textContent=`Lealtad ${visitor.loyalty}%`;const bar=document.createElement("progress");bar.max=100;bar.value=visitor.loyalty;loyalty.append(loyaltyLabel,bar);const actions=document.createElement("div");actions.className="one-hud-contract-actions";for(const [action,label] of [["round","Invitar una Ronda · ฿25"],["recruit","Reclutar · ฿75"]]){const button=document.createElement("button");button.type="button";button.className="one-hud-action";button.textContent=label;button.disabled=action==="recruit"&&visitor.loyalty<60;button.addEventListener("click",()=>emit("tavern-action",{visitorId:visitor.id,action}));actions.append(button)}card.append(heading,detail,loyalty,actions);roster.append(card)});
      if(!visitors.length){const empty=document.createElement("p");empty.className="one-hud-muted";empty.textContent="No quedan mercenarios disponibles en este puerto.";roster.append(empty)}panelContent.append(roster);
      if(c.crew?.length){const crew=document.createElement("section");crew.className="one-hud-crew";const heading=document.createElement("h3");heading.textContent="Tripulación";crew.append(heading);list(crew,c.crew.map(member=>`${member.name} · ${member.role} · ${member.trait} · Lealtad ${member.loyalty}%`),"");panelContent.append(crew)}
      const mercado=document.createElement("button");mercado.type="button";mercado.className="one-hud-action";mercado.textContent="Mercado del puerto";mercado.addEventListener("click",()=>openPanel("market"));panelContent.append(mercado);
    };
    renderTabs(content,[
      {key:"reclutar",label:"Reclutar",render:renderReclutar},
      {key:"coliseo",label:"Coliseo",render:panelContent=>renderColiseo(panelContent,c)},
      {key:"contratos",label:"Contratos del puerto",render:panelContent=>renderContratos(panelContent,c,traits)},
      {key:"radio",label:"Radio del Mar",render:panelContent=>{
        const chatSections=[{key:"global",label:"Chat Global",render:p=>renderGlobalChat(p,c,world.shared?.world?.global_events||[])},{key:"consciousness",label:"Nexo de Conciencia",render:p=>renderConsciousnessChat(p,c)}];
        renderTabs(panelContent,chatSections,selectedChatTab==="coliseo"?"global":selectedChatTab,key=>{selectedChatTab=key})
      }}
    ],"reclutar",key=>{});
  }else if(panel==="market"){
    const intro=document.createElement("p");intro.textContent=`${c.location?.island||"Puerto"} · ฿${fmt(c.berries)} · Agua: ${inventory.water||0}`;content.append(intro);
    for(const [id,good] of Object.entries(marketPrices(c))){const card=document.createElement("article");card.className="one-hud-contract";const heading=document.createElement("h3");heading.textContent=good.label;const info=document.createElement("p");info.textContent=`Compra: ฿${good.buy} · Venta: ฿${good.sell}`;const actions=document.createElement("div");actions.className="one-hud-contract-actions";for(const [action,label] of [["buy","Comprar"],["sell","Vender"]]){const button=document.createElement("button");button.type="button";button.className="one-hud-action";button.textContent=label;button.disabled=Boolean(c.location?.atSea)||c.status==="dead";button.addEventListener("click",()=>emit("trade",{id,action}));actions.append(button)}card.append(heading,info,actions);content.append(card)}
  }else if(panel==="news"){
    // LA BITÁCORA DEL MAR COMPLETA: gaceta viva + Enciclopedia + Atlas en una sola puerta.
    // El globo 🌎 del mundo vivo abre este mismo panel — una puerta, todo adentro.
    renderTabs(content,[
      {key:"gaceta",label:"Bitácora del Mar",render:panelContent=>{
        const hemeroteca=document.createElement("button");hemeroteca.type="button";hemeroteca.className="one-hud-action";hemeroteca.textContent="📰 Hemeroteca del mar";hemeroteca.title="El archivo completo: todo lo que el mundo vivió hasta hoy";hemeroteca.addEventListener("click",()=>window.UI?.abrirPeriodico?.());panelContent.append(hemeroteca);
        renderNewspaper(panelContent,c,(location)=>{closePanel();emit("investigate-news",{location})},(location)=>{closePanel();emit("redirect",{location})});
      }},
      {key:"codex",label:"Enciclopedia del Mar",render:panelContent=>renderCodex(panelContent,c)},
      {key:"atlas",label:"Atlas del Alma",render:panelContent=>{
        const intro=document.createElement("p");intro.className="one-hud-muted";intro.textContent="Tus islas pisadas, tus momentos y los Cubos Rojos y Azules del mundo.";panelContent.append(intro);
        const abrir=document.createElement("button");abrir.type="button";abrir.className="one-hud-action";abrir.textContent="Abrir el Atlas del Alma";abrir.addEventListener("click",()=>{closePanel();window.UI?.abrirAtlas?.()});panelContent.append(abrir);
      }}
    ],"gaceta",key=>{});
  }else if(panel==="profile"){
    const portrait=document.createElement("div");portrait.className="soul-portrait";portrait.setAttribute("role","img");portrait.setAttribute("aria-label",`Retrato de ${c.name||"aventurero"}`);portrait.append(portraitCanvas("soul-pixels",c));content.append(portrait);
    const alignment=document.createElement("p");alignment.className="soul-alignment";alignment.textContent=`Brújula · ${c.soulCard?.alignment||"Libertad"}`;content.append(alignment);
    stats(content,[["Ánimo",c.psyche?.mood||"Eufórico"],["Honor",c.psyche?.morality?.honor??50],["Codicia",c.psyche?.morality?.greed??50],["Libertad",c.psyche?.morality?.liberty??50]]);
    const motto=document.createElement("p");motto.className="soul-motto";motto.textContent=`«${c.story||c.soulCard?.dream||"El mar guarda mi historia"}»`;content.append(motto);
    const haki=[c.haki?.busoshoku&&"Armadura",c.haki?.kenbunshoku&&"Observación",c.haki?.haoshoku&&"Conquistador"].filter(Boolean);
    stats(content,[["Nombre",c.name||"Aventurero"],["Raza",RACES[c.race]?.name||"Humano"],["Nivel / generación",`${c.level||1} / ${lineage.generation||1}`],["Salud",`${c.stats?.health??0}/${c.stats?.maxHealth||100}`],["Facción",c.faction||"Pirata"],["Brújula ideológica",c.soulCard?.alignment||"Libertad"],["Haki",haki.join(", ")||"Sin despertar"],["Akuma no Mi",c.fruit?.name||"Ninguna"]]);const profileActions=document.createElement("div");profileActions.className="one-hud-profile-actions";for(const [label,panel]of [["Árbol de linaje","lineage"]]){const button=document.createElement("button");button.type="button";button.className="one-hud-action";button.textContent=label;button.addEventListener("click",()=>openPanel(panel));profileActions.append(button)}content.append(profileActions);
    
    const choices=document.createElement("div");choices.className="psychology-choices";
    for(const [attribute,label] of [["strength","Fuerza"],["agility","Agilidad"],["ingenuity","Ingenio"]]){const button=document.createElement("button");button.type="button";button.className="psychology-choice";button.textContent=`${label}: ${c.stats?.[attribute]??0}`;button.setAttribute("aria-pressed",String(selectedPsych?.attribute===attribute));button.addEventListener("click",()=>{selectedPsych={label,attribute};openPanel("profile")});choices.append(button)}
    for(const trait of traits){const button=document.createElement("button");button.type="button";button.className="psychology-choice";button.textContent=`Rasgo: ${trait}`;button.setAttribute("aria-pressed",String(selectedPsych?.label===trait));button.addEventListener("click",()=>{selectedPsych={label:trait};openPanel("profile")});choices.append(button)}content.append(choices);
    if(selectedPsych)renderPsychology(content,c,selectedPsych,(attribute)=>{selectedPsych={...selectedPsych,attribute};emit("training-suggestion",{attribute})});
    meter(content,"Estrés Náutico",c.nauticalStress?.value||0);meter(content,"Brújula Moral",c.nauticalStress?.moralCompass??50);meter(content,"Conocimiento de la Lengua Antigua",c.ancientLanguage?.knowledge||0);if(c.ancientLanguage?.finalCoordinates){const clue=document.createElement("p");const p=c.ancientLanguage.finalCoordinates;clue.textContent=`La última ruta: ${p.name} · X:${p.x} Y:${p.y}`;content.append(clue)}}
  else if(panel==="codex"){renderCodex(content,c)}
  else if(panel==="more"){
    title.textContent="Ajustes del Sistema";
    const wrap=document.createElement("div");wrap.className="one-hud-settings-groups";
    if(confirmingReset){const q=document.createElement("p");q.className="one-hud-warning";q.textContent="¿Estás seguro de reiniciar tu viaje? Se borrará el personaje actual.";const row=document.createElement("div");row.className="one-hud-contract-actions";for(const [label,action]of [["Sí, reiniciar",()=>{closePanel();emit("new-game")}],["Cancelar",()=>{confirmingReset=false;openPanel("more")}]] ){const button=document.createElement("button");button.type="button";button.className="one-hud-action";button.textContent=label;button.addEventListener("click",action);row.append(button)}wrap.append(q,row)}
    else{
      // ajustes con propósito: el estado del mundo en una línea, pantalla, GM y reiniciar.
      // Lo que no le sirve al jugador, no está (adiós Vista mundial duplicada y sub-panels de diagnóstico).
      const statusGroup=document.createElement("section");statusGroup.className="one-hud-settings-group";const statusHeading=document.createElement("h3");statusHeading.textContent="El mundo";statusGroup.append(statusHeading);
      const shared=world.shared||{};
      const estadoRed=document.createElement("p");estadoRed.className="one-hud-muted";
      estadoRed.textContent=shared.status==="online"?"🔴 Conectado al mundo compartido: tus actos se publican y otros capitanes existen.":shared.status==="connecting"?"🟡 Conectando al mundo compartido…":"⚪ Simulación local: tu mundo vive en este navegador.";
      statusGroup.append(estadoRed);
      const pendientes=Number(shared.pending)||0;
      if(pendientes>0){const pend=document.createElement("p");pend.className="one-hud-muted";pend.textContent=`${pendientes} eventos esperando sincronización.`;statusGroup.append(pend)}
      const pantalla=document.createElement("button");pantalla.type="button";pantalla.className="one-hud-setting-link";pantalla.textContent="Ajustes de pantalla";pantalla.addEventListener("click",()=>openPanel("settings"));statusGroup.append(pantalla);
      // una puerta por destino: la Enciclopedia vive en el dock; aquí van los controles del mundo
      const estadoMundo=document.createElement("button");estadoMundo.type="button";estadoMundo.className="one-hud-setting-link";estadoMundo.textContent="Estado del mundo";estadoMundo.addEventListener("click",()=>openPanel("world"));statusGroup.append(estadoMundo);       const sonido=document.createElement("button");sonido.type="button";sonido.className="one-hud-setting-link";sonido.textContent="Sonido · activar o silenciar";sonido.addEventListener("click",()=>{const s=window.SFX?.toggle();showToast(s?"Sonido silenciado.":"Sonido activado.")});statusGroup.append(sonido);       const datosMundo=document.createElement("button");datosMundo.type="button";datosMundo.className="one-hud-setting-link";datosMundo.textContent="Datos del mundo vivo (guardar · exportar · importar)";datosMundo.addEventListener("click",()=>window.UI?.abrirAjustes?.());statusGroup.append(datosMundo);              
      wrap.append(statusGroup);
      if(isLocalGMAvailable(c)){const gmGroup=document.createElement("section");gmGroup.className="one-hud-settings-group";const gmHeading=document.createElement("h3");gmHeading.textContent="Herramientas de dirección";const gm=document.createElement("button");gm.type="button";gm.className="one-hud-setting-link";gm.textContent="Panel Admin GM";gm.addEventListener("click",()=>openPanel("adminGM"));gmGroup.append(gmHeading,gm);wrap.append(gmGroup)}
      const resetGroup=document.createElement("section");resetGroup.className="one-hud-settings-group";const resetHeading=document.createElement("h3");resetHeading.textContent="Partida";const reset=document.createElement("button");reset.type="button";reset.className="one-hud-setting-link one-hud-reset-link";reset.textContent="Reiniciar Avatar";reset.addEventListener("click",()=>{confirmingReset=true;openPanel("more")});resetGroup.append(resetHeading,reset);wrap.append(resetGroup);
    }content.append(wrap)
  }else if(panel==="adminGM"){
    const warning=document.createElement("p");warning.className="one-hud-warning";warning.textContent="Controles de desarrollo para esta partida local. El PIN se guarda como hash en este navegador; no es autenticación segura y el propietario del dispositivo puede eludirlo.";content.append(warning);
    const broadcast=document.createElement("form");broadcast.className="one-hud-form";const message=document.createElement("textarea");message.maxLength=280;message.placeholder="Comunicado local para el Chat Global…";message.setAttribute("aria-label","Comunicado Game Master local");const send=document.createElement("button");send.type="submit";send.className="one-hud-action";send.textContent="Transmitir en Chat local";broadcast.append(message,send);broadcast.addEventListener("submit",event=>{event.preventDefault();emit("gm-broadcast",{text:message.value})});content.append(broadcast);
    const events=document.createElement("section");events.className="one-hud-contracts";const eventHeading=document.createElement("h3");eventHeading.textContent="Detonador de eventos";events.append(eventHeading);
    for(const [type,label]of [["buster_call","Buster Call"],["rogue_wave","Marejada / tormenta"],["berry_boon","Bonificador · ฿500"],["berry_multiplier","Multiplicador · 2× / 8 h"],["legendary_sighting","Avistamiento legendario"]]){
      const row=document.createElement("div");row.className="one-hud-contract-actions";
      const activate=document.createElement("button");activate.type="button";activate.className="one-hud-action";activate.textContent=label;activate.addEventListener("click",()=>emit("gm-event",{type}));
      const schedule=document.createElement("button");schedule.type="button";schedule.className="one-hud-action";schedule.textContent="Programar en 1 h";schedule.setAttribute("aria-label",`Programar ${label} en una hora`);schedule.addEventListener("click",()=>emit("gm-schedule",{type,delayMinutes:60}));
      row.append(activate,schedule);events.append(row)
    }
    const gmState=world.gm||{};const pending=(gmState.scheduled||[]).length;const activeMultiplier=Number(gmState.berryMultiplier?.expiresAt)>(Number(world.day)||0)*1440+(Number(world.minuteOfDay)||0)?`${gmState.berryMultiplier.value}× activo`:"Sin multiplicador activo";
    const scheduleStatus=document.createElement("p");scheduleStatus.className="one-hud-muted";scheduleStatus.textContent=`Agenda local: ${pending} eventos · ${activeMultiplier}`;events.append(scheduleStatus);content.append(events);
    const bountyForm=document.createElement("form");bountyForm.className="one-hud-form";const current=document.createElement("p");current.textContent=`Avatar activo local: ${c.name||"—"} · Recompensa actual: ฿${fmt(c.bounty)}`;const bounty=document.createElement("input");bounty.type="number";bounty.min="0";bounty.max="1000000000";bounty.step="1";bounty.value=String(Number(c.bounty)||0);bounty.setAttribute("aria-label","Nueva recompensa del avatar local");const adjust=document.createElement("button");adjust.type="submit";adjust.className="one-hud-action";adjust.textContent="Actualizar recompensa local";bountyForm.append(current,bounty,adjust);bountyForm.addEventListener("submit",event=>{event.preventDefault();emit("gm-bounty",{value:bounty.value})});content.append(bountyForm);
    const pantheon=[...(world.pantheon||[])].map(entry=>`${entry.name} · Gen. ${entry.generation||"—"} · ${entry.cause||"Legado del mar"}`);const heading=document.createElement("h3");heading.textContent="Panteón local";content.append(heading);list(content,pantheon,"El panteón local aún está vacío.");
  }else if(panel==="lineage"){
    const back=document.createElement("button");back.type="button";back.className="one-hud-action";back.textContent="← Volver al Alma";back.addEventListener("click",()=>openPanel("profile"));content.append(back);stats(content,[["Linaje",lineage.family||c.name],["Generación",lineage.generation||1],["Reliquias heredadas",(lineage.legacyChest||[]).length],["Renombre recordado",`฿${fmt(lineage.inheritedReputation)}`]]);const ancestors=[...(world.shared?.world?.fallen_captains||[]),...(world.pantheon||[])].map(entry=>`${entry.name} · Gen. ${entry.generation||"—"} · ${entry.cause||"Legado del mar"}`);list(content,ancestors,"El árbol familiar aún no registra antepasados caídos.");const button=document.createElement("button");button.type="button";button.className="one-hud-action";button.textContent="Abrir Panteón completo";button.addEventListener("click",()=>{closePanel();emit("open-pantheon")});content.append(button)
  }else if(panel==="settings"){
    const back=document.createElement("button");back.type="button";back.className="one-hud-action";back.textContent="← Volver a Ajustes";back.addEventListener("click",()=>openPanel("more"));content.append(back);const settings=readJSON(STORAGE_KEYS.settings,{});const label=document.createElement("label");label.className="one-hud-setting";const toggle=document.createElement("input");toggle.type="checkbox";toggle.checked=Boolean(settings.reducedMotion);toggle.addEventListener("change",()=>{settings.reducedMotion=toggle.checked;if(!writeJSON(STORAGE_KEYS.settings,settings)){showToast("No se pudieron guardar los ajustes.");return}document.body.classList.toggle("reduced-motion",toggle.checked)});label.append(toggle,document.createTextNode(" Reducir movimiento y animaciones"));content.append(label)
  }
  else if(panel==="whispers")stats(content,[["Sintonía",`${c.whisper?.affinity??55}%`],["Rebeldía",`${c.whisper?.rebellion??45}%`],["Estado",c.autonomy?.paused?"En pausa":"Activo"]]);
  else if(panel==="world"){const volver=document.createElement("button");volver.type="button";volver.className="one-hud-action";volver.textContent="← Volver a Ajustes";volver.addEventListener("click",()=>openPanel("more"));content.append(volver);const travel=c.travel||{docked:true,logPoseCharge:0,climate:"normal",weather:"clear"};const shared=world.shared||{};const island=getMapIslands(c).find(item=>item.name===c.location?.island);const control=shared.world?.islands_control?.find(item=>item.island_id===island?.id);const connection=shared.status==="online"?"Mundo compartido conectado":shared.status==="connecting"?"Conectando al mundo compartido":shared.status==="offline"?"Sin conexión; simulación local":"Simulación local (servidor no configurado)";stats(content,[["Día",world.day||0],["Año",world.year||1],["Era",world.era||"Era de los Grandes Descubrimientos"],["Ubicación",c.location?.atSea?"Mar abierto":c.location?.island||"Mar abierto"],["Bioma",c.location?.atSea?"Mar abierto":island?.biome||"Desconocido"],["Control",c.location?.atSea?"—":`${control?.faction||island?.control||"Desconocido"}${control?.owner_name?` · ${control.owner_name}`:""}`],["Marea política",describePoliticalStance(c)],["Red",connection],["Clima",climateLabel(travel.climate)],["Tiempo",travel.weather==="storm"?"Tormenta":"Despejado"],["Carabela",`${c.ship?.health??100}%`]]);if(shared.error||shared.pending){const p=document.createElement("p");p.textContent=`${shared.error||""}${shared.pending?` · ${shared.pending} eventos pendientes en esta sesión`:""}`;content.append(p)}if(travel.docked)meter(content,"Carga de Log Pose",travel.logPoseCharge||0);const zones=document.createElement("div");zones.className="one-hud-climate-zones";for(const [zone,label] of [["normal","Mar Normal"],["calm-belt","Franja de Calma"],["grand-line","Grand Line"]]){const button=document.createElement("button");button.type="button";button.className="one-hud-action";button.textContent=label;button.setAttribute("aria-pressed",String((c.climateZone||"normal")===zone));button.addEventListener("click",()=>emit("set-climate",{zone}));zones.append(button)}content.append(zones)}
  // la Taberna y el Mercado se abren desde el nav (Taberna) — nada de botones duplicados aquí
  else if(panel==="chat"||panel==="quick"){const sections=[{key:"global",label:"Chat Global",render:panelContent=>renderGlobalChat(panelContent,c,world.shared?.world?.global_events||[])},{key:"consciousness",label:"Nexo de Conciencia",render:panelContent=>renderConsciousnessChat(panelContent,c)}];const initial=panel==="quick"?"consciousness":selectedChatTab;renderTabs(content,sections,initial==="coliseo"?"global":initial,key=>{selectedChatTab=key})}
  renderTerritoryControls(content,c);
  if(panel==="world"&&Number.isFinite(c.navigationTarget?.x)&&Number.isFinite(c.navigationTarget?.y)&&c.status!=="dead"){const button=document.createElement("button");button.type="button";button.className="one-hud-action";button.textContent=`Sugerir rumbo: ${c.navigationTarget.name||"zona seleccionada"}`;button.addEventListener("click",()=>emit("redirect",{location:c.navigationTarget}));content.append(button)}
  overlay.classList.add("open");overlay.setAttribute("aria-hidden","false");root.querySelectorAll("[data-hud-panel]").forEach(button=>button.setAttribute("aria-expanded",String(({tavern:"chat",ship:"chest"}[button.dataset.hudPanel]||button.dataset.hudPanel)===panel)));animateHudPortraits()
}
function showToast(text){const toast=root?.querySelector("[data-hud-toast]");if(!toast)return;toast.textContent=text;
  // ventana del sistema con idioma: cada mensaje se viste según lo que anuncia
  const variant=String(text).startsWith("🐌")||String(text).startsWith("📡")||String(text).startsWith("🗣️")?"denden"
    :String(text).startsWith("📜")?"wanted"
    :String(text).startsWith("🔔")?"bell":null;
  toast.className="one-hud-toast"+(variant?" is-"+variant:"");
  toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.hidden=true},3500)}
function renderBranch(character){
  let panel=root.querySelector("[data-hud-branch]");
  if(!panel){panel=document.createElement("section");panel.dataset.hudBranch="";panel.className="one-hud-branch";panel.setAttribute("role","status");const text=document.createElement("p");text.textContent="Una señal de náufragos: ¿compartir agua o seguir el rumbo?";panel.append(text);for(const [choice,label] of [["help","Compartir agua"],["pass","Seguir rumbo"]]){const button=document.createElement("button");button.type="button";button.className="one-hud-action";button.textContent=label;button.addEventListener("click",()=>emit("branch-choice",{choice}));panel.append(button)}root.append(panel)}
  panel.hidden=!character?.autonomy?.pendingBranch||character.status==="dead"||character.autonomy.paused;
}
let portraitFrame=null;
function animateHudPortraits(){
  if(portraitFrame!==null||!root||root.hidden||document.body.classList.contains("reduced-motion")||!root.querySelector(".one-hud-animated-avatar"))return;
  const draw=()=>{
    portraitFrame=null;
    if(!root||root.hidden||document.body.classList.contains("reduced-motion"))return;
    const canvases=root.querySelectorAll(".one-hud-animated-avatar");
    if(!canvases.length)return;
    const now=performance.now();
    for(const canvas of canvases){
      if(canvas.closest("[hidden]"))continue;
      const ctx=canvas.getContext("2d");
      if(!ctx)continue;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      const character=canvas.avatarCharacter;
      drawPixelAvatar(ctx,character?.appearance||character||{},{size:64,equipment:character?.equipped,time:now,action:avatarAction(character),emotion:avatarEmotion(character)});
    }
    const bandera=root.querySelector(".one-hud-flag");
    if(bandera&&activeCharacter?.flag){const bctx=bandera.getContext("2d");if(bctx)drawFlag(bctx,activeCharacter.flag,bandera.width,bandera.height,now)}
    portraitFrame=requestAnimationFrame(draw);
  };
  portraitFrame=requestAnimationFrame(draw);
}
export function setHudVisible(visible){if(root){root.hidden=!visible;const nav=root.querySelector("#bottom-nav");if(nav)nav.hidden=!visible}if(!visible){closePanel();if(portraitFrame!==null){cancelAnimationFrame(portraitFrame);portraitFrame=null}}else animateHudPortraits()}
export function initHud(){
  if(root)return;
  const style=document.createElement("style");style.textContent=STYLE;document.head.append(style);
  root=document.createElement("div");root.id="one-hud";
  root.style.setProperty("--color-ocean",PALETTE.ocean);root.style.setProperty("--color-panel",PALETTE.panel);root.style.setProperty("--color-gold",PALETTE.gold);
  root.innerHTML=`<header id="hud-header" class="one-hud-brand"><div class="one-hud-brand-copy"><span class="one-hud-count" data-hud-berries>฿ 0</span><span class="one-hud-captain" data-hud-faction aria-label="Tu capitán"><canvas class="one-hud-flag" width="34" height="21" aria-hidden="true"></canvas><span class="one-hud-captain-name">—</span><span class="one-hud-captain-fac">Pirata</span></span></div></header><div class="one-hud-vitals" aria-label="Estado del avatar"><span class="one-hud-vital-tag">HP</span><progress data-vital="health" max="100" value="100" aria-label="Salud"></progress><span class="one-hud-vital-tag">XP</span><progress data-vital="experience" max="100" value="0" aria-label="Experiencia para el siguiente nivel"></progress></div><button class="one-hud-settings" type="button" data-hud-panel="more" aria-label="Ajustes del Sistema y Panel GM" title="Ajustes del Sistema">⚙️</button><div class="one-hud-toast" data-hud-toast role="status" hidden></div><nav id="bottom-nav" class="one-hud-nav" aria-label="Navegación del juego">${[["news","Bitácora"],["navigation","Navegar"],["tavern","Taberna"],["ship","Barco"],["profile","Alma"]].map(([key,label])=>`<button type="button" data-hud-panel="${key}" aria-expanded="false" title="${ACTIONS[key][1]}"><span class="one-hud-nav-icon">${svgIcon(ACTIONS[key][0])}</span><span>${label}</span></button>`).join("")}</nav><div class="one-hud-backdrop" aria-hidden="true"><section class="one-hud-dialog" role="dialog" aria-modal="true" aria-labelledby="hud-dialog-title"><div class="one-hud-heading"><span id="hud-dialog-title" class="one-hud-heading-title"></span><button class="one-hud-close" type="button" aria-label="Cerrar">✕</button></div><div class="one-hud-content"></div></section></div>`;
  document.body.append(root);
  // Navegación/zoom los maneja el puente del mundo vivo (fusion) en captura:
  // aquí solo abrimos paneles — sin emitir CustomEvents que nadie escucha.
  root.querySelectorAll("[data-hud-panel]").forEach(button=>button.addEventListener("click",()=>{const key=button.dataset.hudPanel;openPanel(key==="ship"?"chest":key)}));
  root.hidden=true;
  window.addEventListener("onepiece:block1-render",event=>{if(event.detail?.toast)showToast(event.detail.toast)});
  // el cartel WANTED se estampa solo cuando la recompensa da un salto que el mundo tiene que ver
  window.addEventListener("onepiece:hud-wanted",event=>{const bounty=Number(event.detail?.bounty)||0;if(bounty>0)showToast(`📜 WANTED · DEAD OR ALIVE — ฿${fmt(bounty)}`)});
  document.addEventListener("onepiece:systems-toast",event=>showToast(event.detail?.message));
  root.querySelector(".one-hud-close").addEventListener("click",()=>closePanel());
  root.querySelector(".one-hud-backdrop").addEventListener("click",event=>{if(event.target===event.currentTarget)closePanel()});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!document.querySelector("dialog[open]"))closePanel();if(event.altKey&&event.shiftKey&&event.code==="KeyG"){event.preventDefault();openPanel("adminGM")}});
  window.addEventListener("popstate",event=>{if(currentPanel&&event.state?.onepieceModal!==modalHistoryId)closePanel(true)});
}
export function renderHud(character){
  if(!root)initHud();
  activeCharacter=character;
  // la bandera del capitán ondea en el chip: el mismo diseño del wizard, la misma función
  const flagCanvas=root.querySelector(".one-hud-flag");
  if(flagCanvas&&character?.flag){const fctx=flagCanvas.getContext("2d");if(fctx)drawFlag(fctx,character.flag,flagCanvas.width,flagCanvas.height,performance.now())}
  if(currentPanel==="adminGM"&&!isLocalGMAvailable(character))closePanel();
  document.body.classList.toggle("reduced-motion",Boolean(readJSON(STORAGE_KEYS.settings,{}).reducedMotion));
  const minute=Number(character?.world?.minuteOfDay)||0;
  // binding estado→pantalla: js/state.js copia el core y js/ui.js repinta los contenedores por data-atributo
  sincronizarEstado(character);
  const wantedReward=root.querySelector(".one-hud-wanted-reward");
  if(wantedReward){if(Number(character?.bounty)>0)animateCount(wantedReward,character.bounty,(value)=>`฿ ${fmt(value)} BERRIES`);else{wantedReward.dataset.countTarget="0";wantedReward.textContent="SIN RECOMPENSA"}}
  root.hidden=!character;
  root.querySelector("#bottom-nav").hidden=!character;
  if(character){
    animateHudPortraits();
  }
  const hour=Math.floor(minute/60);root.dataset.atmosphere=character?.travel?.climate==="calm-belt"?"mist":hour>=19||hour<6?"night":"day";
  // la luz del body la gobierna el mundo vivo (mundo/ui.js); el HUD solo aporta el mist de la Franja de Calma
  if(character?.travel?.climate==="calm-belt")document.body.dataset.atmosphere="mist";
  renderBranch(character);
  // re-render del panel abierto SOLO cuando su contenido cambió de verdad:
  // antes se reconstruía todo el modal en cada paint (perdía scroll, detalles abiertos y foco)
  const sig=JSON.stringify([currentPanel,character?.berries,character?.level,character?.status,(character?.log||[]).length,(character?.availableContracts||[]).length,(character?.crew||[]).length,character?.world?.day,character?.experience,character?.bounty]);
  const writingChat=["chat","quick"].includes(currentPanel)&&[...root.querySelectorAll(".one-hud-content textarea")].some(input=>input.value.trim());
  // Los paneles del nav deben sobrevivir a cada re-render del HUD: si el panel abierto
  // no está en esta lista, el overlay se reconstruye y el usuario lo ve "cerrarse solo".
  if(!writingChat&&currentPanel&&sig!==panelSig&&["chat","quick","chest","boards","tavern","market","profile","codex","world","more","lineage","networkStatus","settings","adminGM","news","navigation"].includes(currentPanel))openPanel(currentPanel);
  panelSig=sig;
}
export function openIslandPanel(panel){
  if(!["chest","tavern","market","blackmarket"].includes(panel)||!activeCharacter)return;
  if(panel!=="chest"&&(activeCharacter.status==="dead"||activeCharacter.captured||activeCharacter.location?.atSea))return;
  if(panel==="blackmarket"&&!getMapIslands(activeCharacter).some(island=>island.name===activeCharacter.location?.island&&island.auctionHouse))return;
  openPanel(panel);
}
