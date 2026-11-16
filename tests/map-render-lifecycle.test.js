import test from "node:test";
import assert from "node:assert/strict";
import { createCharacter } from "../src/game.js";
import { renderMap } from "../src/world3d.js";

test("the globe stops drawing at port and while a modal is open", () => {
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame
  };
  let draws = 0;
  const gradient = { addColorStop() {} };
  const context = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === "clearRect") return () => { draws++; };
      if (key === "createRadialGradient" || key === "createLinearGradient") return () => gradient;
      return () => {};
    }
  });
  const canvas = new EventTarget();
  canvas.getContext = () => context;
  const document = new EventTarget();
  document.hidden = false;
  let nativeDialogOpen = false;
  document.querySelector = (selector) => selector === "dialog[open]" && nativeDialogOpen ? {} : null;
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
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
