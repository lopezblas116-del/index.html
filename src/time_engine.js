import { PULSE_MS } from "./config.js";

export const SIMULATION_RATE = 4;
export const MINUTES_PER_PULSE = PULSE_MS * SIMULATION_RATE / 60_000;

export function advanceClock(world, eras) {
  const total = (Number(world.minuteOfDay) || 0) + MINUTES_PER_PULSE;
  const days = Math.floor(total / 1440);
  world.minuteOfDay = total % 1440;
  world.day = (Number(world.day) || 0) + days;
  world.year = Math.floor(world.day / 365) + 1;
  world.era = eras[Math.min(Math.floor((world.year - 1) / 5), eras.length - 1)];
  return days > 0;
}
