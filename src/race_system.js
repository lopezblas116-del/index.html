import { RACES, cargoCapacity, isRacePursued, normalizeRace, raceStats, rollLineageRace } from "./races.js";

export { RACES, cargoCapacity, isRacePursued, normalizeRace, raceStats, rollLineageRace };

export function raceTreatmentAtPort(race, island) {
  const species = normalizeRace(race, { allowRare: true });
  if (island?.segregated && species !== "human") {
    return {
      status: "segregated",
      portPriceModifier: 1.5,
      message: "El puerto aplica precios discriminatorios a las razas no humanas."
    };
  }
  if (species === "lunarian" || species === "buccaneer") {
    return {
      status: "feared",
      portPriceModifier: 1,
      message: "La sangre perseguida despierta cautela entre los habitantes."
    };
  }
  return { status: "ordinary", portPriceModifier: 1, message: "Trato portuario habitual." };
}
