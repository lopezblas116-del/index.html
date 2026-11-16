import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter } from "../src/game.js";
import { renderMap, focusMap, getCameraState, zoomMap, GLOBAL_MAP, ISLAND_VIEW } from "../src/world3d.js";
import { getMapIslands } from "../src/map.js";

test("the globe stops drawing at port and while a modal is open", () => {
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame
  };
  let draws = 0;
  let sceneScales = 0;
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === "clearRect") return () => { draws++; };
      if (key === "scale") return () => { sceneScales++; };
      if (key === "createRadialGradient" || key === "createLinearGradient") return () => gradient;
      return () => {};
    }
  });
  const canvas = new EventTarget();
  canvas.getContext = () => context;
  canvas.setAttribute = () => {};
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0 });
  const document = new EventTarget();
  document.hidden = false;
  let nativeDialogOpen = false;
  document.querySelector = (selector) => selector === "dialog[open]" && nativeDialogOpen ? {} : selector === ".island-scene" ? { getBoundingClientRect: () => ({ left: 20, top: 240, width: 350, height: 219 }) } : null;
  document.getElementById = (id) => id === "world-map" ? canvas : null;
  const window = new EventTarget();
  window.innerWidth = 390;
  window.innerHeight = 844;
  const frames = new Map();
  let nextFrame = 0;
  globalThis.document = document;
  globalThis.window = window;
  globalThis.requestAnimationFrame = (callback) => { frames.set(++nextFrame, callback); return nextFrame; };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  try {
    const character = createCharacter({ name: "Prueba", originSea: "East Blue" });
    character.travel = { climate: "normal" };
    character.location.atSea = false;
    renderMap(character);
    assert.equal(frames.size, 0, "a docked avatar should not drive an animation loop");

    character.location.atSea = true;
    renderMap(character);
    assert.equal(frames.size, 1, "a sailing avatar should animate its route");
    document.dispatchEvent(new CustomEvent("onepiece:modal-visibility", { detail: { open: true } }));
    assert.equal(frames.size, 0);
    const before = draws;
    renderMap(character);
    assert.equal(draws, before, "updates behind a modal must not redraw the globe");
    document.dispatchEvent(new CustomEvent("onepiece:modal-visibility", { detail: { open: false } }));
    assert.ok(draws > before);
    assert.equal(frames.size, 1, "sailing animation resumes on close");
    nativeDialogOpen = true;
    const [frameId, callback] = frames.entries().next().value;
    frames.delete(frameId);
    const beforeDialog = draws;
    callback(performance.now());
    assert.equal(draws, beforeDialog, "native dialogs also suspend animation");
    assert.equal(frames.size, 0);
    nativeDialogOpen = false;
    document.dispatchEvent(new CustomEvent("onepiece:modal-visibility", { detail: { open: false } }));
    assert.equal(frames.size, 1);
    document.hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    assert.equal(frames.size, 0);

    document.hidden = false;
    character.location.atSea = false;
    renderMap(character);
    const island = getMapIslands(character).find((item) => item.id === "shells");
    focusMap(island);
    zoomMap(2.3);
    assert.equal(getCameraState(), GLOBAL_MAP);
    assert.equal(frames.size, 1, "zooming over an island starts a canvas animation without a click");
    const runFrame = (time) => {
      const [id, callback] = frames.entries().next().value;
      frames.delete(id);
      callback(time);
    };
    const start = performance.now();
    runFrame(start + 800);
    assert.equal(getCameraState(), GLOBAL_MAP, "local view must not replace the globe halfway through");
    assert.ok(sceneScales > 0, "the city is blended into the globe on the same canvas");
    runFrame(start + 1600);
    assert.equal(getCameraState(), ISLAND_VIEW);
    assert.equal(frames.size, 1, "inhabitants animate while the city is visible");
    document.dispatchEvent(new CustomEvent("onepiece:modal-visibility", { detail: { open: true } }));
    assert.equal(frames.size, 0, "the city pauses behind a modal");
    document.dispatchEvent(new CustomEvent("onepiece:modal-visibility", { detail: { open: false } }));
    assert.equal(frames.size, 1);
    zoomMap(1);
    assert.equal(getCameraState(), GLOBAL_MAP);
    const reverse = performance.now();
    const beforeReverse = sceneScales;
    runFrame(reverse + 400);
    assert.ok(sceneScales > beforeReverse, "zooming out blends the city back onto the globe");
    runFrame(reverse + 1600);
    assert.equal(frames.size, 0, "the docked globe becomes idle after zooming out");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
