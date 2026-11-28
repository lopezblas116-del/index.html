import test from "node:test";
import assert from "node:assert/strict";
import { islandEncountersFor } from "../src/island_encounters.js";
import { activeIslandCrisis, advanceIslandStory, beginIslandCrisis, beginStarterIslandAdventure, ensureNarrativeState, recordStarterClueVisit, resolveIslandCrisis } from "../src/narrative_engine.js";

function makeCaptain() {
  return {
    id: "captain-1",
    name: "Capitana",
    status: "alive",
    location: { island: "Puerto Bruma", atSea: false },
    world: { day: 2, minuteOfDay: 420, news: [] },
    log: [],
    soulCard: { traits: { pros: [], cons: [] } },
    psyche: { morality: { honor: 10, liberty: 10 } }
  };
}

const island = {
  id: "bruma",
  name: "Puerto Bruma",
  npcs: [{ name: "Lina" }, { name: "Tomás" }]
};

test("island crises persist a cause-linked event chain and change relationships", () => {
  const captain = makeCaptain();
  const crisis = beginIslandCrisis(captain, island, () => 0);

  assert.equal(crisis.title, "Los suministros del puerto");
  assert.equal(activeIslandCrisis(captain, island.id).id, crisis.id);
  // el registro del feed da el gancho (título-pleito); la apertura completa vive en la crisis
  assert.match(captain.world.story.events[0].text, /llegó en medio del pleito: Los suministros del puerto/);
  assert.match(crisis.opening, /Lina reúne a los vecinos/);

  const result = resolveIslandCrisis(captain, "help");
  assert.equal(result.ok, true);
  assert.equal(result.event.causeId, `${crisis.id}:started`);
  assert.equal(captain.world.story.relationships.Lina.score, 18);
  assert.equal(captain.world.story.relationships.Tomás.score, 4);
  assert.deepEqual(captain.world.story.islands.bruma, {
    trust: 64, tension: 38, lastEventId: `${crisis.id}:resolved`
  });
  assert.equal(captain.world.story.events.length, 2);
  assert.match(captain.world.news[0].text, /ayudó a la comunidad/);
  assert.equal(activeIslandCrisis(captain, island.id), null);
});

test("an unresolved crisis is settled by the avatar when the world day advances", () => {
  const captain = makeCaptain();
  const crisis = beginIslandCrisis(captain, island, () => 0);
  captain.world.day += 1;

  const result = advanceIslandStory(captain);
  assert.equal(result.ok, true);
  assert.equal(result.event.source, "avatar");
  assert.equal(result.event.choice, "ignore");
  assert.equal(result.event.causeId, `${crisis.id}:started`);
  assert.equal(captain.world.story.islands.bruma.tension, 62);
  assert.equal(advanceIslandStory(captain), null);
});

test("a failed crisis roll is not repeated on the same island and day", () => {
  const captain = makeCaptain();
  assert.equal(beginIslandCrisis(captain, island, () => 0.9), null);
  assert.equal(beginIslandCrisis(captain, island, () => 0), null);
  assert.equal(ensureNarrativeState(captain).events.length, 0);
});

test("the active island crisis exposes its three player interventions", () => {
  const captain = makeCaptain();
  beginIslandCrisis(captain, island, () => 0);

  const encounter = islandEncountersFor(island, captain).find((entry) => entry.action === "story-crisis");
  assert.deepEqual(encounter.actions.map(({ choice }) => choice), ["help", "mediate", "ignore"]);
  assert.match(encounter.description, /Lina reúne a los vecinos/);
});

test("the starter adventure requires an actual island visit before the player's decision", () => {
  const captain = makeCaptain();
  captain.starterChallenge = true;
  captain.berries = 100;
  captain.location.routeIndex = 0;
  captain.location.localVenue = null;
  const startingIsland = { ...island, pois: [{ id: "port-market", name: "Mercado" }] };

  assert.equal(beginStarterIslandAdventure(captain, startingIsland), true);
  const crisis = activeIslandCrisis(captain, startingIsland.id);
  assert.ok(crisis);
  assert.equal(islandEncountersFor(startingIsland, captain).find(({ action }) => action === "story-crisis").actions.length, 0);
  assert.equal(resolveIslandCrisis(captain, "help").ok, false);

  captain.world.day += 1;
  assert.equal(advanceIslandStory(captain), null);
  captain.location.localVenue = { id: "port-market" };
  assert.equal(recordStarterClueVisit(captain, startingIsland, startingIsland.pois[0]), true);
  assert.equal(recordStarterClueVisit(captain, startingIsland, startingIsland.pois[0]), false);

  const encounter = islandEncountersFor(startingIsland, captain).find(({ action }) => action === "story-crisis");
  assert.equal(encounter.actions.length, 3);
  assert.match(encounter.description, /La pista ya está en tu bitácora/);

  const result = resolveIslandCrisis(captain, "mediate");
  assert.equal(result.ok, true);
  assert.equal(captain.world.story.starterAdventure.status, "complete");
  assert.equal(captain.inventory.timber, 3);
  assert.equal(captain.berries, 120);
  assert.equal(captain.world.story.islands.bruma.trust, 58);
  assert.equal(captain.world.story.islands.bruma.tension, 41);
  assert.match(result.event.text, /3 tablones y ฿20/);
});
