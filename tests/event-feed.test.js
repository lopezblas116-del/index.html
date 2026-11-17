import test from "node:test";
import assert from "node:assert/strict";
import { aggregateSmartFeed, maritimeHeadline } from "../src/event_dispatcher.js";

test("smart feed condenses battles by location and sums Berry rewards", () => {
  const entries = [
    { type: "combat", message: "Victoria en el puerto · recompensa ฿1.500" },
    { type: "combat", message: "Nuevo combate en el puerto · recompensa ฿250" },
    { type: "combat", message: "Batalla en el puerto · recompensa ฿75" }
  ];
  const feed = aggregateSmartFeed(entries, { name: "Blas", location: "Loguetown" });

  assert.equal(feed.length, 1);
  assert.equal(feed[0].count, 3);
  assert.equal(feed[0].totalBerries, 1825);
  assert.match(feed[0].message, /Blas dominó el puerto de Loguetown tras 3 batallas consecutivas/);
  assert.match(feed[0].message, /acumuló 1825 Berries/);
  assert.equal(feed[0].text, feed[0].message);
  assert.equal(entries[0].message, "Victoria en el puerto · recompensa ฿1.500");
});

test("battle feed uses structured Berry rewards and keeps locations separate", () => {
  const feed = aggregateSmartFeed([
    { type: "combat", location: "Paraíso", reward: 150, text: "Blas Rodrigo protagoniza un combate en Paraíso." },
    { type: "combat", location: "Paraíso", berries: 200, text: "Blas Rodrigo protagoniza un combate en Paraíso." },
    { type: "combat", location: "Loguetown", reward: 50, text: "Blas Rodrigo protagoniza un combate en Loguetown." }
  ], { name: "Blas Rodrigo", location: "East Blue" });

  assert.equal(feed.length, 2);
  assert.equal(feed[0].count, 2);
  assert.equal(feed[0].totalBerries, 350);
  assert.match(feed[0].text, /dominó el puerto de Paraíso tras 2 batallas consecutivas y acumuló 350 Berries/);
  assert.equal(feed[1].location, "Loguetown");
  assert.equal(feed[1].totalBerries, 50);
});

test("smart feed deduplicates identical notices and honors its result limit", () => {
  const notices = [
    { type: "world-event", location: "Shells Town", text: "La Marina refuerza el muelle." },
    { type: "world-event", location: "Shells Town", text: "La Marina refuerza el muelle." },
    { type: "world-event", location: "Orange Town", text: "La Marina refuerza el muelle." }
  ];

  const feed = aggregateSmartFeed(notices, { limit: 1 });
  assert.equal(feed.length, 1);
  assert.equal(feed[0].count, 2);
  assert.match(feed[0].message, /repetido 2 veces/);
});

test("maritime headlines use themed rotating templates", () => {
  const first = maritimeHeadline({ type: "bounty" }, 0);
  const second = maritimeHeadline({ type: "bounty" }, 1);
  assert.equal(first.icon, "📜");
  assert.equal(first.category, "bounty");
  assert.notEqual(first.headline, second.headline);
  assert.equal(maritimeHeadline({ type: "poneglyph_translated" }).icon, "🪨");
});
