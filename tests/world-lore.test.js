import test from "node:test";
import assert from "node:assert/strict";
import { getLoreByKey, proceduralLore } from "../src/world_lore.js";

test("world lore loads only the requested fragment and reuses it on later lookups", async () => {
  const requests = [];
  const fetcher = async (url) => {
    const path = new URL(url).pathname;
    requests.push(path);
    const data = path.endsWith("/world_lore.json")
      ? { entries: [{ key: "grand-line", aliases: ["Grand Line", "Paraíso"], file: "lore/grand-line.json" }] }
      : { key: "grand-line", title: "Grand Line", description: "Corrientes cambiantes.", climate: "grand-line", hazards: ["tormentas"], newsSeeds: ["la aguja vibra"] };
    return { ok: true, json: async () => data };
  };

  const lore = await getLoreByKey("Paraíso", { fetcher });
  assert.equal(lore.title, "Grand Line");
  assert.equal(lore.procedural, false);
  assert.equal(requests.length, 2);
  assert.equal((await getLoreByKey("Grand Line", { fetcher })).key, "grand-line");
  assert.equal(requests.length, 2);
});

test("unknown locations receive deterministic procedural setting without blocking discovery", () => {
  const first = proceduralLore("Isla Bruma");
  const second = proceduralLore("Isla Bruma");
  assert.equal(first.procedural, true);
  assert.equal(first.climate, second.climate);
  assert.ok(first.hazards.length > 0);
  assert.ok(first.newsSeeds.length > 0);
});
