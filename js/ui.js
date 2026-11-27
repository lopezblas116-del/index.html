// js/ui.js — binding estado → pantalla: lee gameState y repinta los contenedores por ID.
// Nada aquí decide lógica de juego: solo refleja js/state.js en el DOM.

import { gameState, suscribirse } from "./state.js";

const fmt = (n) => Number(n || 0).toLocaleString("es");
const set = (selector, value) => {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
  return node;
};

/** Pinta el HUD chrome (barra de marca, vitales, estado del avatar) desde gameState. */
export function renderGameStateUI(estado = gameState) {
  set("[data-hud-day]", estado.reloj);
  set("[data-hud-berries]", `฿ ${fmt(estado.monedas)}`);
  // el capitán en persona: su nombre manda, la bandera lo acompaña
  set(".one-hud-captain-name", estado.nombre);
  set(".one-hud-captain-fac", estado.clase);

  // barra de salud / experiencia del HUD
  const vitals = { health: [estado.salud, estado.saludMax], experience: [estado.experiencia, Math.max(100, estado.nivel * 100)] };
  for (const [clave, [valor, max]] of Object.entries(vitals)) {
    const bar = document.querySelector(`[data-vital="${clave}"]`);
    if (bar) { bar.max = max; bar.value = valor; }
  }

  // estado del avatar en el masthead (pantalla de inicio / wizard)
  const estadoAvatar = estado.muerto ? "● Avatar caído" : estado.enPausa ? "● Avatar en pausa" : "● Avatar activo";
  const headerStatus = set("#header-avatar-status", estadoAvatar);
  if (headerStatus) {
    headerStatus.classList.toggle("dead", estado.muerto);
    headerStatus.classList.toggle("paused", estado.enPausa && !estado.muerto);
  }
}

/** Conecta el binding: cada sincronización del estado repinta la pantalla. */
export function initUIBinding() {
  suscribirse(renderGameStateUI);
  renderGameStateUI();
}

/* ---------- Banner de llegada a una isla (flujo del juego) ---------- */

const ETIQUETA_TEMA = {
  verde: "Isla verde", bosque: "Bosque", tropical: "Tropical", ciudad: "Ciudad",
  desierto: "Desierto", nieve: "Invierno", jungla: "Jungla", industrial: "Industrial",
  futurista: "Futurista", mar: "Isla marina", fortaleza: "Fortaleza", oscuro: "Isla oscura",
  rocosa: "Rocosa", puerto: "Puerto", blanco: "Isla blanca", japon: "Estilo Wano",
  dulce: "Isla dulce", prision: "Prisión", gobierno: "Gobierno Mundial",
  burbujas: "Archipiélago burbuja", nubes: "Isla del cielo",
};

let temporizadorBanner = null;

/** Cartel elegante "Has llegado a X" al pisar una isla nueva; se retira solo. */
export function anunciarLlegada(isla) {
  if (!isla?.name) return;
  const contenedor = document.getElementById("game-container");
  if (!contenedor) return;
  let banner = document.getElementById("arrival-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "arrival-banner";
    banner.setAttribute("role", "status");
    banner.innerHTML = `<p class="arrival-eyebrow">Has llegado a</p><strong class="arrival-name"></strong><span class="arrival-chip"></span>`;
    contenedor.append(banner);
  }
  banner.querySelector(".arrival-name").textContent = isla.name;
  const chip = banner.querySelector(".arrival-chip");
  chip.textContent = ETIQUETA_TEMA[isla.tema] || isla.region || "";
  chip.hidden = !chip.textContent; // sin dato real no hay chip: jamás un "Isla" que duplica el nombre
  banner.hidden = false;
  requestAnimationFrame(() => banner.classList.add("visible"));
  clearTimeout(temporizadorBanner);
  temporizadorBanner = setTimeout(() => {
    banner.classList.remove("visible");
    temporizadorBanner = setTimeout(() => { banner.hidden = true; }, 400);
  }, 4600);
}
