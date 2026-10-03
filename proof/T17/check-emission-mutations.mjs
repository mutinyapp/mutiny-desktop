import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { build, loadConfigFromFile } from "vite";
const require=createRequire(import.meta.url);
const root=resolve(dirname(new URL(import.meta.url).pathname),"../..");
const {getConfig}=require(join(dirname(require.resolve("@electron-forge/plugin-vite/package.json")),"dist/config/vite.main.config.js"));
const scratch="/Users/friday/.hermes/profiles/friday/cache/scratch";
const hash=value=>createHash("sha256").update(value).digest("hex");
const before=hash(readFileSync(join(root,"vite.main.config.ts")));
const authored=readFileSync(join(root,"assets/desktop/offline/offline.html"));
const controls=[];
for(const mutation of ["clean","omit-emission","wrong-filename","truncate-bytes"]) {
  const dir=mkdtempSync(join(scratch,`T17-${mutation}-`));
  try {
    const user=await loadConfigFromFile({command:"build",mode:"production"},join(root,"vite.main.config.ts"));
    if(mutation === "omit-emission") user.config.plugins=[];
    if(["wrong-filename","truncate-bytes"].includes(mutation)) {
      const plugin=user.config.plugins[0]; const original=plugin.buildStart;
      plugin.buildStart=function(...args) {
        const context=Object.create(this);
        context.emitFile=asset=>this.emitFile({...asset,...(mutation === "wrong-filename" ? {fileName:"else.html"} : {source:asset.source.subarray(1)})});
        return original.apply(context,args);
      };
    }
    const config=getConfig({root,mode:"production",command:"build",forgeConfig:{renderer:[]},forgeConfigSelf:{entry:"proof/T17/asset-emission-probe-entry.mjs",target:"main"}},user.config);
    const out=join(dir,".vite/build");
    await build({...config,configFile:false,logLevel:"silent",build:{...config.build,outDir:out}});
    let verdict="passed",failure=null;
    try {
      assert.ok(readdirSync(out).includes("offline.html"),"exact emitted filename missing");
      assert.deepEqual(readFileSync(join(out,"offline.html")),authored,"emitted HTML differs from authored bytes");
    } catch(error) { verdict="failed"; failure=error.message; }
    assert.equal(verdict,mutation === "clean" ? "passed" : "failed");
    controls.push({mutation,buildExit:0,assertionExit:verdict === "passed"?0:1,verdict,failure});
  } finally {rmSync(dir,{recursive:true,force:true});}
}
assert.equal(hash(readFileSync(join(root,"vite.main.config.ts"))),before);
const receipt={sourceSHA256:before,authoredSHA256:hash(authored),authoredBytes:authored.length,controls,sourceUnchanged:true};
writeFileSync(process.env.T17_EMISSION_RECEIPT || join(root,"proof/T17/v3-emission-mutations.json"),JSON.stringify(receipt,null,2)+"\n");
console.log(JSON.stringify(receipt,null,2));
