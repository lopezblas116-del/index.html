# ROADMAP · Un Millón de Piratas

> Objetivo del proyecto, en palabras de su autor: usar esta base (One-Latam) y **superarla**,
> convirtiéndola en un mundo vivo masivo — que se vea y se mueva como *un millón de piratas* —
> **con lore propio**, alimentado por el Catálogo del Mundo.

## Estado al 2026-11-21

- **Catálogo del Mundo integrado** en la Enciclopedia del Mar: 55 entradas con búsqueda,
  filtros por categoría y progreso de descubrimiento (`src/catalogo_engine.js`,
  `src/data/catalogo.json`).
- **Mundo vivo más poblado**: ~274 almas y 36 barcos navegando (antes 171 / 22),
  sin costo de rendimiento medible.
- **Un solo reloj**: el HUD superior y la barra "Mundo Vivo" comparten el tiempo de la
  simulación (`src/mundo/ui.js`).
- **Nubes del mapa más sutiles**: ya no tapan los nombres de las islas (`src/mundo/mapa.js`).
- **Calidad**: 126 tests en verde, build OK, CI de GitHub Actions en verde.

## Principios de trabajo

1. **Un solo mapa**: el mapa vivo (canvas) es la vista del mundo; el globo queda de apoyo.
2. **El lore propio primero**: las decisiones de contenido salen del Catálogo y la Bitácora,
   no del material de origen.
3. **Tests antes de publicar**: nada llega a `main` sin los tests en verde.
4. **Commits pequeños y claros** (`feat(catalogo): …`) para que otro agente o Copilot
   pueda continuar el trabajo sin conflictos.

## Próximos pasos (priorizados)

1. **El catálogo alimenta el mundo vivo**: usar nombres, lugares y categorías del
   Catálogo del Mundo para generar o renombrar islas, rumores y eventos de la simulación
   (puente catálogo → `src/mundo/simulacion.js`).
2. **Completar el lore**: redactar los relatos que aún dicen "Relato pendiente de completar"
   usando `tools/conversor_catalogo.js` como vía de carga.
3. **Identidad propia**: migrar títulos y textos de la interfaz de "One-Latam RPG" a
   "Un Millón de Piratas" (título de la página, portada, HUD).
4. **Más vida en el mar**: rutas comerciales entre islas, convoyes, y hazañas emergentes
   entre tripulaciones que ya existen en la simulación.
5. **Rendimiento**: mover `catalogo.json` (556 KB) a carga diferida fuera del bundle
   principal y decidir el rol del planeta WebGL detrás del mapa vivo.
6. **Registro de decisiones**: anotar aquí cada cambio grande de diseño con fecha,
   para mantener continuidad entre sesiones de trabajo (agente o humano).
