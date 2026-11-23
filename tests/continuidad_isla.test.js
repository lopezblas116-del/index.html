// Tests de continuidad del arte de islas: UN layout canónico compartido por
// la vista general y el detalle (el zoom no cambia de artista).
import test from "node:test";
import assert from "node:assert/strict";

import "../src/mundo/util.js";
import "../src/mundo/datos_mundo.js";
import "../src/mundo/mapa.js";

const { MAPA, D } = globalThis;

test("edificiosIsla = las casas del layout compartido, una por una (la noche enciende lo que se ve)", () => {
  for (const isl of D.ISLAS.filter(x => !x.oculta).slice(0, 14)) {
    const ed = MAPA.edificiosIsla(isl);
    const lay = MAPA.layoutIsla(isl);
    assert.equal(ed.length, lay.casas.length, isl.id);
    ed.forEach((e, k) => {
      assert.equal(e.x, lay.casas[k].x, isl.id + ' casa ' + k);
      assert.equal(e.y, lay.casas[k].y, isl.id + ' casa ' + k);
    });
  }
});

test("el layout es determinista: el mismo arte en cada frame y tras recalcular", () => {
  const isl = D.ISLAS.find(x => x.id === 'arabasta') || D.ISLAS[0];
  delete isl._lay;
  const a = JSON.stringify(MAPA.layoutIsla(isl));
  assert.equal(JSON.stringify(MAPA.layoutIsla(isl)), a); // desde la caché
  delete isl._lay;
  assert.equal(JSON.stringify(MAPA.layoutIsla(isl)), a); // recalculado
});

test("todas las islas tienen vegetación y las grandes tienen aldea", () => {
  for (const isl of D.ISLAS.filter(x => !x.oculta)) {
    const lay = MAPA.layoutIsla(isl);
    assert.ok(lay.arboles.length >= 5, isl.id + ' sin vegetación');
    assert.ok(lay.adornos.length >= 6, isl.id + ' sin adornos de interior');
    if (isl.r >= 24 && isl.tema !== 'prision') assert.ok(lay.casas.length >= 3, isl.id + ' grande sin aldea');
    for (const c of lay.casas) {
      assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.wy), isl.id);
      assert.ok(Math.hypot(c.x, c.y / 0.7) < isl.r, isl.id + ': casa fuera de la isla');
    }
  }
});

test("el layout respeta el número temático de casas (aldea densa donde toca)", () => {
  const port = D.ISLAS.find(x => (x.tema === 'puerto' || x.tema === 'ciudad') && !x.oculta);
  if (port) assert.ok(MAPA.layoutIsla(port).casas.length >= 4, port.id + ' puerto poco poblado');
  const prision = D.ISLAS.find(x => x.tema === 'prision' && !x.oculta);
  if (prision) assert.equal(MAPA.layoutIsla(prision).casas.length, 0); // la cárcel no tiene aldea
});
