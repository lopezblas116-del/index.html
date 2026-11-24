import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter } from "../src/game.js";
import { desertarEnGrandLine, severidadCapitan, attemptMutiny, enGrandLine } from "../src/systems.js";

test("la severidad del capitán varía por facción y nivel", () => {
  const marino = createCharacter({ name: "Duro", originSea: "East Blue", faction: "Marina" });
  const autonomo = createCharacter({ name: "Libre", originSea: "East Blue", faction: "Autonomo" });
  const sMarino = severidadCapitan(marino);
  const sAutonomo = severidadCapitan(autonomo);
  assert.ok(sMarino > sAutonomo, "la Marina es más severa que un capitán autónomo");
  marino.level = 50;
  assert.ok(severidadCapitan(marino) > sMarino, "un capitán curtido es aún más severo");
  assert.ok(severidadCapitan(marino) <= 0.5, "la severidad tiene techo: nadie es pura sentencia");
});

test("dejar la tripulación en la Grand Line puede costar la vida", () => {
  const cap = createCharacter({ name: "Fugitiva", originSea: "East Blue", faction: "Pirata" });
  cap.location.region = "Paraíso";
  cap.location.island = "Paraíso";
  assert.equal(enGrandLine(cap), true, "la región Paraíso cuenta como Grand Line");
  // la severidad de un capitán pirata de nivel 1 da margen: sobrevive con suerte alta
  const sobrevive = desertarEnGrandLine(cap, () => 0.99);
  assert.equal(sobrevive.sobrevive, true);
  assert.ok(sobrevive.danio > 0, "aun sobreviviendo, la furia cobra su precio");
  cap.stats.health = 100;
  // con suerte mínima y severidad pirata: la espada cae
  const muere = desertarEnGrandLine(cap, () => 0);
  assert.equal(muere.sobrevive, false);
  assert.match(muere.mensaje, /no vuelve a contarla|la espada/i);
  // en los Cuatro Blues nadie pone pegas: deserción sin riesgo
  cap.location.region = "South Blue";
  const libre = desertarEnGrandLine(cap, () => 0);
  assert.equal(libre.riesgo, 0, "en los Blues se baja del barco sin drama");
});

test("el motín usurpa el mando y siembra desconfianza", () => {
  const cap = createCharacter({ name: "Despistado", originSea: "East Blue", faction: "Pirata" });
  cap.crew = [
    { name: "Nara", role: "Navegante", loyalty: 8, level: 3 },
    { name: "Tomo", role: "Cocinero", loyalty: 6, level: 1 }
  ];
  attemptMutiny(cap, () => 0); // lealtad media 7 < umbral y el azar acompaña
  assert.equal(typeof cap.usurpedBy === "string", true, "el más osado toma el mando");
  assert.equal(cap.usurpedBy, "Nara", "usurpa el de mayor nivel de la tripulación");
  assert.equal(cap.distrust, true, "la desconfianza queda sembrada");
  assert.match((cap.log[0]?.message || ""), /MOTÍN|usurp/i);
  // ya con usurpación: el motín no se repite hasta resolver el desafío
  attemptMutiny(cap, () => 0);
  assert.equal(cap.usurpedBy, "Nara", "un motín activo no se pisa a sí mismo");
});
