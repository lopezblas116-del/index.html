import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import "../src/mundo/util.js";
import { islaDeJuego } from "../src/mundo/datos_mundo.js";

const { D } = globalThis;
const juego = JSON.parse(readFileSync(new URL("../src/data/islands_data.json", import.meta.url), "utf8"));

test("las 28 islas del juego están en el registro único, enlazadas o agregadas", () => {
  const ids = Object.keys(juego);
  assert.equal(ids.length, 28);
  for (const id of ids) {
    const isla = D.ISLAS.find((entry) => entry.juegoId === id);
    assert.ok(isla?.juego, `falta ${id}`);
    assert.equal(isla.juegoNombre, juego[id].name);
  }
  assert.equal(D.ISLAS.filter((entry) => entry.juego).length, ids.length);
});

test("no hay nombres ni ids duplicados y las islas agregadas no se superponen", () => {
  assert.equal(new Set(D.ISLAS.map((i) => i.n)).size, D.ISLAS.length);
  assert.equal(new Set(D.ISLAS.map((i) => i.id)).size, D.ISLAS.length);
  const nuevas = D.ISLAS.filter((i) => i.id.startsWith("j_"));
  for (const a of nuevas) {
    const region = D.REGIONS[a.reg];
    assert.ok(a.x - a.r >= region.x0 && a.x + a.r <= region.x1 && a.y - a.r >= region.y0 && a.y + a.r <= region.y1, `${a.n} fuera de su región`);
    for (const b of D.ISLAS) {
      if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= Math.max(26, a.r + b.r + 2), `${a.n} pisa a ${b.n}`);
    }
  }
});

test("vincular de nuevo no crea islas adicionales", () => {
  const before = D.ISLAS.map(({ id, x, y }) => ({ id, x, y }));
  D.vincularIslasJuego();
  assert.deepEqual(D.ISLAS.map(({ id, x, y }) => ({ id, x, y })), before);
});

test("islaDeJuego resuelve islas conocidas", () => {
  for (const [nombre, id] of [["Isla Dawn", "foosha"], ["Loguetown", "logue"], ["Water 7", "water7"], ["Whiskey Peak", "whisky"], ["Isla Flevance", "flence"], ["Wano", "wano"]]) {
    assert.equal(islaDeJuego(nombre)?.id, id);
  }
  assert.equal(D.islaDeJuego("Isla Inventada"), null);
});
