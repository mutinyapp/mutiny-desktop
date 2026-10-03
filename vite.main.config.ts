import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [{
    name: "mutiny-bundled-offline-document",
    buildStart() {
      this.emitFile({
        type: "asset",
        fileName: "offline.html",
        source: readFileSync(join(__dirname, "assets/desktop/offline/offline.html")),
      });
    },
  }],
});
