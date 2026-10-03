import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { build, loadConfigFromFile } from "vite";
import { describe, expect, it } from "vitest";
const require = createRequire(import.meta.url);
const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const { getConfig } = require(join(dirname(require.resolve("@electron-forge/plugin-vite/package.json")), "dist/config/vite.main.config.js"));
describe("bundled offline emission through the real main config", () => {
  it("emits the authored HTML byte-identically at .vite/build/offline.html", async () => {
    const dir = mkdtempSync(join(tmpdir(), "T17-unit-emission-"));
    try {
      const user = await loadConfigFromFile({command:"build",mode:"production"},join(root,"vite.main.config.ts"));
      const config = getConfig({root,mode:"production",command:"build",forgeConfig:{renderer:[]},forgeConfigSelf:{entry:"proof/T17/asset-emission-probe-entry.mjs",target:"main"}},user.config);
      const out = join(dir,".vite/build");
      const result = await build({...config,configFile:false,logLevel:"silent",build:{...config.build,outDir:out}});
      expect(readFileSync(join(out,"offline.html"))).toEqual(readFileSync(join(root,"assets/desktop/offline/offline.html")));
      const outputs = Array.isArray(result) ? result.flatMap(r=>r.output) : result.output;
      expect(outputs.filter(o=>o.type==="asset"&&o.fileName.endsWith(".html")).map(o=>o.fileName)).toEqual(["offline.html"]);
    } finally { rmSync(dir,{recursive:true,force:true}); }
  });
});
