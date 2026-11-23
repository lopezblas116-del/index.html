// js/state.js — estado central de la partida (fuente única de verdad para la UI)
// La spec de Un Millón de Piratas: los datos viven aquí, la pantalla solo refleja.
// El core del juego (game.js/main.js) llama a sincronizarEstado() en cada tick;
// los suscriptores (js/ui.js) repintan los contenedores por ID.

export const gameState = {
  // jugador
  nombre: "—",
  usuario: "—",
  monedas: 0,
  clase: "Pirata",
  rasgos: [],
  nivel: 1,
  salud: 100,
  saludMax: 100,
  experiencia: 0,
  recompensa: 0,
  // mundo
  dia: 1,
  minutoDelDia: 0,
  reloj: "Día 1 · 00:00 · 1:4",
  esNoche: false,
  isla: "—",
  enMar: false,
  almas: 0,
  // estados vitales del avatar
  muerto: false,
  enPausa: false,
  sincronia: 55,
  rebeldia: 45,
};

const suscriptores = new Set();

/** Registra un pintador; devuelve la función para darse de baja. */
export function suscribirse(fn) {
  suscriptores.add(fn);
  return () => suscriptores.delete(fn);
}

function notificar() {
  for (const fn of suscriptores) {
    try { fn(gameState); } catch (error) { console.error("ui: suscriptor falló", error); }
  }
}

const dos = (n) => String(n).padStart(2, "0");

/** Copia el estado del core al gameState público y avisa a la UI. */
export function sincronizarEstado(character, extra = {}) {
  if (!character) return gameState;
  const world = character.world || {};
  const minute = Number(world.minuteOfDay) || 0;
  gameState.nombre = character.name || "—";
  gameState.usuario = character.handle || "@usuario";
  gameState.monedas = Number(character.berries) || 0;
  gameState.clase = (character.faction || "Pirata") === "Autonomo" ? "Autónomo" : (character.faction || "Pirata");
  gameState.rasgos = [...(character.soulCard?.traits?.pros || []), ...(character.soulCard?.traits?.cons || [])];
  gameState.nivel = Number(character.level) || 1;
  gameState.salud = Number(character.stats?.health) || 0;
  gameState.saludMax = Number(character.stats?.maxHealth) || 100;
  gameState.experiencia = Number(character.experience) || 0;
  gameState.recompensa = Number(character.bounty) || 0;
  gameState.dia = (Number(world.day) || 0) + 1;
  gameState.minutoDelDia = minute;
  gameState.reloj = `Día ${gameState.dia} · ${dos(Math.floor(minute / 60))}:${dos(minute % 60)} · 1:4`;
  gameState.esNoche = minute < 6 * 60 || minute >= 19 * 60;
  gameState.enMar = Boolean(character.location?.atSea);
  gameState.isla = gameState.enMar ? "Mar abierto" : (character.location?.island || "—");
  gameState.muerto = character.status === "dead";
  gameState.enPausa = Boolean(character.autonomy?.paused) && !gameState.muerto;
  gameState.sincronia = Number(character.whisper?.affinity ?? 55);
  gameState.rebeldia = Number(character.whisper?.rebellion ?? 45);
  if (Number.isFinite(extra.almas)) gameState.almas = extra.almas;
  notificar();
  return gameState;
}
