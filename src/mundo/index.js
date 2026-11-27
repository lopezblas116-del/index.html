// Punto de entrada del mundo vivo Mil Almas dentro de One-Latam.
// Los módulos son IIFE que publican APIs globales (window.JUEGO, window.UI,
// window.MAPA, window.GFX, window.PUENTE). Importar en ESTE orden:
import './util.js';
import './datos_mundo.js';
import './datos_textos.js';
import './simulacion.js';
import './abismo.js';
import './mapa.js';
import './ui.js';
import './main.js';
import './graficos_mejorados.js';
import './atmosfera.js';
import './sonido_mar.js';
import './puente.js';

// API pública para el resto de One-Latam:
//   window.JUEGO.sim            -> motor (Sim)
//   window.JUEGO.sim.user       -> tu personaje (agente)
//   window.JUEGO.sim.doWhisper(a,k) -> susurros con obediencia/reinterpretación
//   window.JUEGO.sim.popOf(isl) -> quién está en una isla
//   window.JUEGO.sim.feed       -> ÚLTIMA HORA; sim.archive -> hemeroteca
//   window.PUENTE.activar()     -> conecta con los paneles existentes de index.html
//   window.GFX                  -> capa de gráficos mejorados (sprites)
// El reloj arranca solo al cargar (main.js); PUENTE.activar() lo conecta a la UI.
export const JUEGO = window.JUEGO;
export const PUENTE = window.PUENTE;
export const GFX = window.GFX;
export const UI = window.UI;
