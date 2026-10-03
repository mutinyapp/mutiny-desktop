// Build-only isolated fixture. No Forge package/make/publish or application entry.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { build, loadConfigFromFile } from "vite";
const require=createRequire(import.meta.url);
const root=resolve(dirname(new URL(import.meta.url).pathname),"../..");
const plugin=join(dirname(require.resolve("@electron-forge/plugin-vite/package.json")),"dist/config");
const {getConfig:mainConfig}=require(join(plugin,"vite.main.config.js"));
const {getConfig:preloadConfig}=require(join(plugin,"vite.preload.config.js"));
const scratch=process.env.T17_SCRATCH || "/Users/friday/.hermes/profiles/friday/cache/scratch";
const expectedElectron=JSON.parse(readFileSync(join(root,"package.json"))).devDependencies.electron;
assert.ok(["38.1.2","44.5.1"].includes(expectedElectron));
process.env.T17_EXPECT_ELECTRON=expectedElectron;
const binary=process.env.T17_ELECTRON || require("electron");
const dir=mkdtempSync(join(scratch,"T17-real-electron-"));
const out=join(dir,".vite/build");
const proof=process.env.T17_PROOF || join(root,"proof/T17/v6/runtime");
mkdirSync(proof,{recursive:true});
const port=Number(process.env.T17_PORT || "49270");
assert.ok([49270,49271,49272,49273,49274,49275,49276,49277,49278,49279].includes(port),"v6 assigned T17 ports only");
process.env.T17_PORT=String(port);
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
    const result=spawnSync(binary,[join(out,`${entry}.js`)],{cwd:root,encoding:"utf8",timeout:120000,env:{...process.env,T17_PROOF:proof,T17_USER_DATA:join(dir,"engine-user-data")}});
    assert.ifError(result.error);
    console.log(result.stdout); console.error(result.stderr);
    assert.equal(result.status,0,"Native Electron frame lifecycle regression must pass");
  } else {
  const preload=await loadConfigFromFile({command:"build",mode:"production"},join(root,"vite.preload.config.ts"));
  for(const mode of ["darwin","win32"]) {
    const config=preloadConfig(env("src/preload.ts","preload"),preload.config);
    await build({...config,configFile:false,define:{...config.define,...(mode === "win32" ? {"process.platform":JSON.stringify("win32")} : {})},build:{...config.build,outDir:out,rollupOptions:{...config.build.rollupOptions,output:{...config.build.rollupOptions.output,entryFileNames:mode === "darwin"?"preload.js":"preload-win.js"}}}});
  }
  const electron=binary;
  const results=[];
  const modes=process.env.T17_MODES ? process.env.T17_MODES.split(",") : ["darwin","win32"];
  const scenarios=process.env.T17_SCENARIOS ? process.env.T17_SCENARIOS.split(",") : ["no-crash-no-cdp","crash-only","cdp-only","full-v3","crash-retry-hosted","crash-native-os","no-crash-retry-hosted"];
  for(const mode of modes) for (const scenario of scenarios) {
    assert.ok(["darwin","win32"].includes(mode));
    assert.ok(["no-crash-no-cdp","crash-only","cdp-only","full-v3","crash-retry-hosted","crash-native-os","no-crash-retry-hosted"].includes(scenario));
    rmSync(join(proof,`${mode}-${scenario}-runtime.json`),{force:true});
    const result=spawnSync(electron,[join(out,"electron-runtime-entry.js")],{cwd:root,encoding:"utf8",timeout:120000,env:{...process.env,T17_PROOF:proof,T17_PLATFORM:mode,T17_SCENARIO:scenario,T17_USER_DATA:join(dir,`user-data-${mode}-${scenario}`)}});
    assert.ifError(result.error);
    console.log(result.stdout); console.error(result.stderr);
    const receipt=JSON.parse(readFileSync(join(proof,`${mode}-${scenario}-runtime.json`)));
    results.push({mode,scenario,exit:result.status,passed:receipt.passed,result:receipt.result,knownGapCount:receipt.knownGaps?.length||0,hardFailures:receipt.hardFailures,characterization:receipt.characterization,authorization:receipt.authorization,captionActions:receipt.captionActions,retryIntents:receipt.retryIntents});
    console.log(JSON.stringify({mode,scenario,exit:result.status,emittedSHA256:createHash("sha256").update(authored).digest("hex"),receipt},null,2));
  }
  const summary={port,emittedSHA256:createHash("sha256").update(authored).digest("hex"),scenarioCount:results.length,passCount:results.filter(r=>r.result === "PASS").length,knownGapCount:results.filter(r=>r.result === "KNOWN-GAP").length,failCount:results.filter(r=>r.result === "FAIL").length,captionAttemptCount:results.reduce((n,r)=>n+(r.captionActions?.length||0),0),results};
  writeFileSync(join(proof,"isolation-summary.json"),JSON.stringify(summary,null,2)+"\n");
  assert.ok(results.every(result=>result.exit === 0 && result.passed && (expectedElectron === "44.5.1" ? result.result === "PASS" && result.knownGapCount === 0 : ["PASS","KNOWN-GAP"].includes(result.result))),`Non-gap Electron requirements failed: ${JSON.stringify(results.map(({mode,scenario,exit,result,hardFailures})=>({mode,scenario,exit,result,hardFailures})))}`);
  }
} finally { rmSync(dir,{recursive:true,force:true}); console.log("Removed owned harness build, user-data and cache directories."); }
