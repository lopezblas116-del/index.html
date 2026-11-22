import { RACES, cargoCapacity, isRacePursued, normalizeRace, raceStats, rollLineageRace } from "./races.js";

export { RACES, cargoCapacity, isRacePursued, normalizeRace, raceStats, rollLineageRace };

/**
 * Trato portuario por raza: la discriminación del mundo tiene capas y
 * consecuencias mecánicas, no es solo un texto.
 *  · Puertos segregados: precios +50% para no humanos, taberna cerrada
 *    para ellos y astilleros que rechazan encargos (ver combat_economy).
 *  · Sangre perseguida (Lunarian/Bucanero): cautela general y un premio
 *    mayor por su captura en subastas clandestinas.
 *  · La confianza revolucionaria (lore_engine) anula el veto de taberna:
 *    las redes del Ejército reclutan sin mirar la sangre.
 */
export function raceTreatmentAtPort(race, island) {
  const species = normalizeRace(race, { allowRare: true });
  if (island?.segregated && species !== "human") {
    return {
      status: "segregated",
      portPriceModifier: 1.5,
      tavernPolicy: "denied",
      captureRiskModifier: isRacePursued(species) ? 1.6 : 1.35,
      message: "El puerto aplica precios discriminatorios a las razas no humanas."
    };
  }
  if (species === "lunarian" || species === "buccaneer") {
    return {
      status: "feared",
      portPriceModifier: 1,
      tavernPolicy: "watched",
      captureRiskModifier: 1.6,
      message: "La sangre perseguida despierta cautela entre los habitantes."
    };
  }
  return { status: "ordinary", portPriceModifier: 1, tavernPolicy: "allowed", captureRiskModifier: 1, message: "Trato portuario habitual." };
}
