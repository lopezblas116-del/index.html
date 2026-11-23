// Tests de la ATMOSFERA del mapa: las funciones puras (testables sin DOM).
// La capa visual se verifica a mano en el navegador (noche, lluvia, minimapa...).
import test from "node:test";
import assert from "node:assert/strict";

import "../src/mundo/atmosfera.js";
const { ATM } = globalThis;

test("factorNoche: noche cerrada de 22:00 a 05:59", () => {
  assert.equal(ATM.factorNoche(0), 1);
  assert.equal(ATM.factorNoche(5 * 60 + 59), 1);
  assert.equal(ATM.factorNoche(23 * 60), 1);
  assert.equal(ATM.factorNoche(3 * 60 + 17), 1);
});

test("factorNoche: día pleno de 07:20 a 19:39", () => {
  assert.equal(ATM.factorNoche(7 * 60 + 20), 0);
  assert.equal(ATM.factorNoche(12 * 60), 0);
  assert.equal(ATM.factorNoche(19 * 60 + 30), 0);
});

test("factorNoche: transiciones suaves de amanecer y anochecer", () => {
  assert.equal(ATM.factorNoche(6 * 60), 1); // 06:00 la noche empieza a ceder
  const media = ATM.factorNoche(6 * 60 + 40);
  assert.ok(media > 0.3 && media < 0.7, `mitad del amanecer = ${media}`);
  assert.equal(ATM.factorNoche(7 * 60 + 20), 0); // 07:20 día del todo
  assert.equal(ATM.factorNoche(19 * 60 + 40), 0); // 19:40 empieza el anochecer
  const tarde = ATM.factorNoche(20 * 60 + 20);
  assert.ok(tarde > 0.3 && tarde < 0.7, `mitad del anochecer = ${tarde}`);
  assert.equal(ATM.factorNoche(21 * 60), 1); // 21:00 noche cerrada
});

test("factorNoche: envuelve el día (t modular 1440)", () => {
  assert.equal(ATM.factorNoche(1440 + 720), ATM.factorNoche(720));
  assert.equal(ATM.factorNoche(-60), ATM.factorNoche(1380));
});

test("etiquetaDuracion: la velocidad real de la sim es 5.2 unidades por minuto de juego", () => {
  assert.equal(ATM.etiquetaDuracion(5.2), 'menos de 1h'); // 1 minuto de juego
  assert.equal(ATM.etiquetaDuracion(5.2 * 60), '1h'); // una hora de juego
  assert.equal(ATM.etiquetaDuracion(5.2 * 1440), '1d 0h'); // un día entero de juego
  assert.equal(ATM.etiquetaDuracion(5.2 * 2160), '1d 12h');
  assert.equal(ATM.etiquetaDuracion(0), 'menos de 1h');
});

test("dxEnvuelto: la ruta más corta cruza la Muralla por el costurero", () => {
  assert.equal(ATM.dxEnvuelto(100, 2600), 100);
  assert.equal(ATM.dxEnvuelto(2500, 2600), -100); // 2500 hacia el este = 100 hacia el oeste
  assert.equal(ATM.dxEnvuelto(-2500, 2600), 100);
  assert.equal(ATM.dxEnvuelto(-100, 2600), -100);
});
