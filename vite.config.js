import { cpSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {},
  plugins: [{
    name: "copy-lazy-lore",
    closeBundle() {
      cpSync(resolve("src/data"), resolve("dist/src/data"), { recursive: true });
      // EL GUARDIÁN ANTI-BUILD-VIEJA: sin sw.js en el dist, el service worker no
      // existe en producción y los assets sin hash (main.css, systems.js…) quedan
      // cacheados por UN AÑO en el teléfono del jugador — la fuente real de los
      // errores "imposibles" que solo ve quien ya había jugado antes.
      cpSync(resolve("sw.js"), resolve("dist/sw.js"));
    }
  }]
});
