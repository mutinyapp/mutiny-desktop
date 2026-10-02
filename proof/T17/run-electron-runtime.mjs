// Build-only isolated fixture. No Forge package/make/publish or application entry.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { build, loadConfigFromFile } from "vite";
const require=createRequire(import.meta.url);
const root=resolve(dirname(new URL(import.meta.url).pathname),"../..");
const plugin=join(dirname(require.resolve("@electron-forge/plugin-vite/package.json")),"dist/config");
const {getConfig:mainConfig}=require(join(plugin,"vite.main.config.js"));
const {getConfig:preloadConfig}=require(join(plugin,"vite.preload.config.js"));
const scratch="/Users/friday/.hermes/profiles/friday/cache/scratch";
const dir=mkdtempSync(join(scratch,"T17-real-electron-"));
const out=join(dir,".vite/build");
const env=(entry,target)=>({root,mode:"production",command:"build",forgeConfig:{renderer:[]},forgeConfigSelf:{entry,target}});
try {
  const user=await loadConfigFromFile({command:"build",mode:"production"},join(root,"vite.main.config.ts"));
  const config=mainConfig(env("proof/T17/electron-runtime-entry.ts","main"),user.config);
  await build({...config,configFile:false,build:{...config.build,outDir:out}});
  const authored=readFileSync(join(root,"assets/desktop/offline/offline.html"));
  assert.deepEqual(readFileSync(join(out,"offline.html")),authored);
  const preload=await loadConfigFromFile({command:"build",mode:"production"},join(root,"vite.preload.config.ts"));
  for(const mode of ["darwin","win32"]) {
    const config=preloadConfig(env("src/preload.ts","preload"),preload.config);
    await build({...config,configFile:false,define:{...config.define,...(mode === "win32" ? {"process.platform":JSON.stringify("win32")} : {})},build:{...config.build,outDir:out,rollupOptions:{...config.build.rollupOptions,output:{...config.build.rollupOptions.output,entryFileNames:mode === "darwin"?"preload.js":"preload-win.js"}}}});
  }
  const electron=require("electron");
  for(const mode of ["darwin","win32"]) {
    const result=spawnSync(electron,[join(out,"electron-runtime-entry.js")],{cwd:root,encoding:"utf8",timeout:120000,env:{...process.env,T17_PROOF:join(root,"proof/T17"),T17_PLATFORM:mode,T17_USER_DATA:join(dir,`user-data-${mode}`)}});
    console.log(result.stdout); console.error(result.stderr);
    assert.equal(result.status,0,`Electron ${mode} harness exits cleanly`);
    const receipt=JSON.parse(readFileSync(join(root,"proof/T17",`${mode}-runtime.json`)));
    assert.equal(receipt.passed,true);
    console.log(JSON.stringify({mode,exit:result.status,emittedSHA256:createHash("sha256").update(authored).digest("hex"),receipt},null,2));
  }
} finally { rmSync(dir,{recursive:true,force:true}); console.log("Removed owned harness build, user-data and cache directories."); }
