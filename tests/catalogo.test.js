import test from "node:test";
import assert from "node:assert/strict";
import catalogoData from "../src/data/catalogo.json" with { type: "json" };
import { CATALOGO, CATALOGO_ENTRADAS, buscarCatalogo, categoriasCatalogo, textoCatalogo } from "../src/catalogo_engine.js";
import { getExtension, listExtensions } from "../src/data_loader.js";

test("el catálogo del mundo carga completo, con ids únicos y sin colisiones", () => {
  assert.equal(CATALOGO.schema, 1);
  assert.ok(CATALOGO_ENTRADAS.length >= 300, `esperadas ≥300 entradas, hay ${CATALOGO_ENTRADAS.length}`);
  const ids = CATALOGO_ENTRADAS.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, "los ids del catálogo no pueden repetirse");
  for (const entry of CATALOGO_ENTRADAS) {
    assert.ok(entry.nombre.length >= 2, `nombre requerido en ${entry.id}`);
    assert.ok(entry.categoria, `categoría requerida en ${entry.id}`);
    assert.match(entry.id, /^[a-z0-9][a-z0-9-]*$/, `id inválido: ${entry.id}`);
    assert.ok(typeof entry.texto === "string", `texto debe ser cadena en ${entry.id}`);
    assert.ok(Array.isArray(entry.claves), `claves deben ser lista en ${entry.id}`);
  }
});

test("la colisión de nombres conocida queda resuelta con sufijo determinista", () => {
  const nobles = CATALOGO_ENTRADAS.filter((entry) => entry.nombre === "World Noble");
  assert.equal(nobles.length, 2, "World Noble existe como organización y como raza");
  const ids = nobles.map((entry) => entry.id).sort();
  assert.deepEqual(ids, ["world-noble", "world-noble-2"]);
});

test("las categorías del catálogo cubren el mundo con contenido", () => {
  const categories = categoriasCatalogo();
  assert.ok(categories.length >= 15, `categorías registradas: ${categories.length}`);
  for (const { categoria, total } of categories) assert.ok(total > 0, `categoría vacía: ${categoria}`);
  assert.ok(buscarCatalogo({ categoria: "Islas y Lugares" }).length >= 20);
  assert.ok(buscarCatalogo({ categoria: "Frutas del Diablo" }).length >= 10);
  assert.ok(buscarCatalogo({ categoria: "Razas" }).length >= 15);
});

test("la búsqueda del catálogo encuentra por nombre, alias y región", () => {
  assert.ok(buscarCatalogo({ texto: "wano" }).some((entry) => entry.nombre === "Wano Country"));
  assert.ok(buscarCatalogo({ texto: "log pose" }).some((entry) => entry.nombre === "Log Pose"));
  assert.ok(buscarCatalogo({ texto: "Kuja Island" }).some((entry) => entry.nombre === "Amazon Lily"));
  assert.ok(buscarCatalogo({ texto: "Elbaph Scripture" }).some((entry) => entry.nombre === "Harley"));
  assert.ok(buscarCatalogo({ texto: "Franja de Calma" }).length >= 3, "la región se puede buscar por texto");
  assert.equal(buscarCatalogo({ texto: "zzz-inexistente" }).length, 0);
});

test("el catálogo queda registrado como extensión de datos sin colisión", () => {
  assert.ok(listExtensions().includes("catalogo"));
  assert.equal(getExtension("catalogo")?.schema, 1);
  assert.equal(getExtension("catalogo")?.total, CATALOGO.entradas.length);
});

test("las entradas pendientes del lorebook muestran un texto de cortesía", () => {
  const pending = CATALOGO_ENTRADAS.find((entry) => !entry.texto);
  assert.ok(pending, "deben existir entradas pendientes del lorebook");
  assert.match(textoCatalogo(pending), /pendiente/);
  const completa = CATALOGO_ENTRADAS.find((entry) => entry.texto.length > 100);
  assert.equal(textoCatalogo(completa), completa.texto);
});
