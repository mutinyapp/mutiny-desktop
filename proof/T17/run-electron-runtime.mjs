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
const proof=process.env.T17_PROOF || join(root,"proof/T17");
const entry=process.env.T17_ENGINE_PROBE ? "electron-frame-lifecycle-entry" : "electron-runtime-entry";
const env=(entry,target)=>({root,mode:"production",command:"build",forgeConfig:{renderer:[]},forgeConfigSelf:{entry,target}});
try {
  const user=await loadConfigFromFile({command:"build",mode:"production"},join(root,"vite.main.config.ts"));
  const config=mainConfig(env(`proof/T17/${entry}.ts`,"main"),user.config);
  await build({...config,configFile:false,build:{...config.build,outDir:out}});
  const authored=readFileSync(join(root,"assets/desktop/offline/offline.html"));
  assert.deepEqual(readFileSync(join(out,"offline.html")),authored);
  if (process.env.T17_ENGINE_PROBE) {
    assert.ok(["sync","deferred"].includes(process.env.T17_ENGINE_PROBE));
    const result=spawnSync(require("electron"),[join(out,`${entry}.js`)],{cwd:root,encoding:"utf8",timeout:120000,env:{...process.env,T17_PROOF:proof,T17_USER_DATA:join(dir,"engine-user-data")}});
    console.log(result.stdout); console.error(result.stderr);
    assert.equal(result.status,0,"Native Electron frame lifecycle regression must pass");
  } else {
  const preload=await loadConfigFromFile({command:"build",mode:"production"},join(root,"vite.preload.config.ts"));
  for(const mode of ["darwin","win32"]) {
    const config=preloadConfig(env("src/preload.ts","preload"),preload.config);
    await build({...config,configFile:false,define:{...config.define,...(mode === "win32" ? {"process.platform":JSON.stringify("win32")} : {})},build:{...config.build,outDir:out,rollupOptions:{...config.build.rollupOptions,output:{...config.build.rollupOptions.output,entryFileNames:mode === "darwin"?"preload.js":"preload-win.js"}}}});
  }
  const electron=require("electron");
  const results=[];
  const modes=process.env.T17_MODES ? process.env.T17_MODES.split(",") : ["darwin","win32"];
  const scenarios=process.env.T17_SCENARIOS ? process.env.T17_SCENARIOS.split(",") : ["no-crash-no-cdp","crash-only","cdp-only","full-v3"];
  for(const mode of modes) for (const scenario of scenarios) {
    assert.ok(["darwin","win32"].includes(mode));
    assert.ok(["no-crash-no-cdp","crash-only","cdp-only","full-v3"].includes(scenario));
    const result=spawnSync(electron,[join(out,"electron-runtime-entry.js")],{cwd:root,encoding:"utf8",timeout:120000,env:{...process.env,T17_PROOF:proof,T17_PLATFORM:mode,T17_SCENARIO:scenario,T17_USER_DATA:join(dir,`user-data-${mode}-${scenario}`)}});
    console.log(result.stdout); console.error(result.stderr);
    const receipt=JSON.parse(readFileSync(join(proof,`${mode}-${scenario}-runtime.json`)));
    results.push({mode,scenario,exit:result.status,passed:receipt.passed});
    console.log(JSON.stringify({mode,scenario,exit:result.status,emittedSHA256:createHash("sha256").update(authored).digest("hex"),receipt},null,2));
  }
  assert.ok(results.every(result=>result.exit === 0 && result.passed),`All isolated Electron scenarios must pass: ${JSON.stringify(results)}`);
  }
} finally { rmSync(dir,{recursive:true,force:true}); console.log("Removed owned harness build, user-data and cache directories."); }
