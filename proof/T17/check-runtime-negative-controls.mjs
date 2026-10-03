// Disposable falsification of non-gap gates. Never edit candidate product bytes.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, copyFileSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
const root=resolve(dirname(new URL(import.meta.url).pathname),"../..");
const proof=join(root,"proof/T17/v5/negative-controls");
mkdirSync(proof,{recursive:true});
const hash=value=>createHash("sha256").update(value).digest("hex");
const paths=execFileSync("git",["ls-files","-z"],{cwd:root,encoding:"utf8"}).split("\0").filter(Boolean);
const fixtures=["electron-runtime-entry.ts","run-electron-runtime.mjs","runtime-result.mjs"].map(name=>`proof/T17/${name}`);
const cases=[
  {name:"retry",scenario:"no-crash-retry-hosted",path:"src/native/offlineRecovery.ts",from:'url === `${documents.get(window)}&retry=1`) retry();',to:'url === `${documents.get(window)}&retry=1`) { /* negative control: disable manual Retry */ }',failure:"Retry button did not recover"},
  {name:"fallback",scenario:"no-crash-no-cdp",path:"src/native/offlineRecovery.ts",from:'const url = `${bundled}?error=${error}`;',to:'const url = `${bundled}.missing?error=${error}`;',failure:"real HTTP failure -> emitted offline page"},
  {name:"no-crash-captions",scenario:"no-crash-no-cdp",path:"src/native/windowControls.ts",from:'if (!authorize(event)) return;',to:'if (!authorize(event)) return;\n    return; // negative control: omit native caption action',failure:"native maximize"},
];
const protectedBefore=Object.fromEntries(cases.map(c=>[c.path,hash(readFileSync(join(root,c.path)))]));
const results=[];
for(const control of cases) {
  const dir=mkdtempSync("/Users/friday/.hermes/profiles/friday/cache/scratch/T17-v5-negative-");
  try {
    for(const path of paths.filter(p=>!p.startsWith("proof/") && p!=="assets").concat(fixtures)) {
      const target=join(dir,path); mkdirSync(dirname(target),{recursive:true}); copyFileSync(join(root,path),target);
    }
    symlinkSync(join(root,"node_modules"),join(dir,"node_modules"),"dir");
    const executions=[];
    for(const mutated of [false,true]) {
      const label=`${control.name}-${mutated?"mutant":"clean"}`;
      const output=join(proof,label); mkdirSync(output,{recursive:true});
      if(mutated) {
        const target=join(dir,control.path);const original=readFileSync(target,"utf8");
        assert.equal(original.split(control.from).length,2,"mutation anchor must occur exactly once");
        writeFileSync(target,original.replace(control.from,control.to));
      }
      const command=`T17_PORT=49207 T17_MODES=darwin T17_SCENARIOS=${control.scenario} T17_PROOF=${output} node proof/T17/run-electron-runtime.mjs`;
      const run=spawnSync(process.execPath,["proof/T17/run-electron-runtime.mjs"],{cwd:dir,encoding:"utf8",timeout:120000,env:{...process.env,T17_PORT:"49207",T17_MODES:"darwin",T17_SCENARIOS:control.scenario,T17_PROOF:output}});
      const log=run.stdout+run.stderr;writeFileSync(join(proof,`${label}.log`),log);
      const receipt=JSON.parse(readFileSync(join(output,`darwin-${control.scenario}-runtime.json`)));
      assert.equal(run.status,mutated?1:0,`${label} exit`);
      assert.equal(receipt.result,mutated?"FAIL":"PASS");
      if(mutated) assert.ok(receipt.hardFailures.some(f=>f.includes(control.failure)),`${label} must fail named behavior, not setup`);
      executions.push({command,exit:run.status,result:receipt.result,hardFailures:receipt.hardFailures,logSHA256:hash(log),sourceSHA256:hash(readFileSync(join(dir,control.path)))});
    }
    results.push({name:control.name,scenario:control.scenario,mutationPath:control.path,executions});
  } finally {rmSync(dir,{recursive:true,force:true});}
}
const protectedAfter=Object.fromEntries(Object.keys(protectedBefore).map(path=>[path,hash(readFileSync(join(root,path)))]));
assert.deepEqual(protectedAfter,protectedBefore,"candidate product source unchanged");
const receipt={controlCount:results.length,cleanExits:results.map(c=>c.executions[0].exit),mutantExits:results.map(c=>c.executions[1].exit),results,protectedBefore,protectedAfter,sourceUnchanged:true,port:49207};
writeFileSync(join(proof,"results.json"),JSON.stringify(receipt,null,2)+"\n");
console.log(JSON.stringify(receipt,null,2));
