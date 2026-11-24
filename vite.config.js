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
    }
  }]
});
