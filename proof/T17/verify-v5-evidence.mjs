// Readback verifier for the frozen v5 evidence, product invariance and owned resources.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
const root=resolve(dirname(new URL(import.meta.url).pathname),"../..");
const proof=join(root,"proof/T17/v5");
const frozen="c6f0b0306b81dd1028f5c87e4791417061b67ca0";
const json=path=>JSON.parse(readFileSync(join(proof,path),"utf8"));
const hash=value=>createHash("sha256").update(value).digest("hex");
const summary=json("runtime-verified/isolation-summary.json");
assert.equal(summary.scenarioCount,14);assert.equal(summary.results.length,14);
assert.equal(summary.passCount,6);assert.equal(summary.knownGapCount,6);assert.equal(summary.failCount,2);
assert.equal(summary.captionAttemptCount,64);
assert.equal(summary.results.reduce((n,r)=>n+r.captionActions.length,0),64);
const compact={port:summary.port,emittedSHA256:summary.emittedSHA256,scenarioCount:14,passCount:6,knownGapCount:6,failCount:2,captionAttemptCount:64,tupleOrder:["hosted","offline","self","sameContents","sameFrame","detached"],results:[]};
for(const result of summary.results) {
  assert.equal(result.exit,result.scenario === "crash-retry-hosted"?1:0);
  const receipt=json(`runtime-verified/${result.mode}-${result.scenario}-runtime.json`);
  assert.equal(receipt.electron,"38.1.2");
  assert.equal(receipt.port,49206);
  if(result.scenario === "crash-retry-hosted") {
    assert.equal(receipt.characterization.manualRetry.worked,false);
    assert.equal(receipt.characterization.manualRetry.hitsBefore,receipt.characterization.manualRetry.hitsAfter);
    assert.deepEqual(receipt.characterization.manualRetry.requests,[]);
    assert.equal(receipt.characterization.hostedCaptionsAuthorized,true);
    assert.equal(receipt.characterization.hostedRestoration.mechanism,"automatic retry after show");
    assert.equal(receipt.characterization.stopBeforeReadyUpdate,false);
    assert.equal(receipt.hardFailures.length,1);assert.match(receipt.hardFailures[0],/Retry button did not recover/);
  }
  if(result.scenario === "no-crash-retry-hosted") {
    assert.equal(receipt.characterization.manualRetry.worked,true);
    assert.equal(receipt.characterization.manualRetry.hitsAfter,receipt.characterization.manualRetry.hitsBefore+1);
    assert.equal(receipt.retryIntents[0].offline,true);assert.equal(receipt.retryIntents[0].self,true);
  }
  if(result.scenario === "crash-native-os") {
    assert.equal(receipt.characterization.nativeOS.minimize,true);
    assert.equal(receipt.characterization.nativeOS.close,true);
    assert.equal(receipt.characterization.nativeOS.closed,true);
    assert.equal(receipt.characterization.nativeOS.ipcUnchanged,true);
  }
  compact.results.push({mode:result.mode,scenario:result.scenario,result:result.result,exit:result.exit,hardFailures:result.hardFailures,characterization:receipt.characterization,retryIntents:receipt.retryIntents,actions:receipt.captionActions.map(action=>({action:action.action,document:action.document,delivered:action.delivered,tuple:compact.tupleOrder.map(key=>action.tuple[key]),native:action.native,nativeEvents:action.nativeEvents}))});
}
writeFileSync(join(proof,"characterization-summary.json"),JSON.stringify(compact,null,2)+"\n");
const tests=json("final-tests.json");assert.equal(tests.numTotalTests,365);assert.equal(tests.numPassedTests,365);assert.equal(tests.numFailedTests,0);assert.equal(tests.numPendingTests,0);
assert.match(readFileSync(join(proof,"verified-test.log"),"utf8"),/30 passed \(30\)/);
assert.match(readFileSync(join(proof,"verified-test.log"),"utf8"),/365 passed \(365\)/);
for(const gate of ["typecheck","test","lint"]) assert.equal(json(`verified-${gate}.json`).exit,0);
assert.equal(json("verified-runtime.json").exit,1);
const negatives=json("negative-controls/results.json");assert.equal(negatives.controlCount,3);assert.deepEqual(negatives.cleanExits,[0,0,0]);assert.deepEqual(negatives.mutantExits,[1,1,1]);assert.equal(negatives.sourceUnchanged,true);
const emission=json("emission-controls.json");assert.equal(emission.authoredBytes,4933);assert.deepEqual(emission.controls.map(c=>c.assertionExit),[0,1,1,1]);assert.equal(emission.sourceUnchanged,true);
const paths=execFileSync("git",["ls-files","-z"],{cwd:root,encoding:"utf8"}).split("\0").filter(path=>path&&!path.startsWith("proof/")&&path!=="assets");
const invariance=paths.map(path=>{const current=readFileSync(join(root,path));const original=execFileSync("git",["show",`${frozen}:${path}`],{cwd:root,maxBuffer:Math.max(1024*1024,current.length+65536)});assert.deepEqual(current,original,`protected byte invariance: ${path}`);return {path,bytes:current.length,sha256:hash(current)};});
const live=JSON.parse(execFileSync("gh",["api","repos/mutinyapp/mutiny-desktop/actions/workflows","--paginate"],{cwd:root,encoding:"utf8"}));
assert.equal(live.total_count,live.workflows.length);assert.equal(live.total_count,4);
const absent=spawnSync("gh",["api",`repos/mutinyapp/mutiny-desktop/contents/.github/workflows/brand-check.yml?ref=${frozen}`],{cwd:root,encoding:"utf8"});assert.equal(absent.status,1);assert.match(absent.stderr,/HTTP 404/);
writeFileSync(join(proof,"workflow-scope-audit.json"),JSON.stringify({frozen,protectedCount:invariance.length,invariance,workflowTotal:live.total_count,workflows:live.workflows.map(({id,name,path,state})=>({id,name,path,state})),brandCurrentSourceAbsent:true,automaticEvents:["pull_request: build.yml; lint/typecheck/test/Linux package"],automaticPublicWriter:false,dispatchNotAuthorized:["release.yml","desktop-candidate.yml"],ciWatchedOrPolled:false,productOrWorkflowChanges:false},null,2)+"\n");
const ownDirs=new Set();
for(const dir of ["runtime","runtime-final","runtime-verified"]) {
  for(const name of readdirSync(join(proof,dir)).filter(n=>n.endsWith("-runtime.json"))) {
    const receipt=json(`${dir}/${name}`);if(receipt.emittedFile) ownDirs.add(resolve(receipt.emittedFile,"../../.."));
  }
}
for(const control of negatives.results) for(const kind of ["clean","mutant"]) {
  const receipt=json(`negative-controls/${control.name}-${kind}/darwin-${control.scenario}-runtime.json`);
  if(receipt.emittedFile) ownDirs.add(resolve(receipt.emittedFile,"../../.."));
}
for(const dir of ownDirs) assert.equal(existsSync(dir),false,`owned scratch removed: ${dir}`);
const ps=execFileSync("ps",["-axo","pid,ppid,command"],{encoding:"utf8"});
const remaining=ps.split("\n").filter(line=>[...ownDirs].some(dir=>line.includes(dir)));assert.deepEqual(remaining,[]);
const ports=[];
for(const port of [49206,49207,49208,49209]) {
  const server=createServer();await new Promise((ok,fail)=>{server.once("error",fail);server.listen(port,"127.0.0.1",ok);});await new Promise(ok=>server.close(ok));ports.push({port,bind:true,closed:true});
}
writeFileSync(join(proof,"resource-release.json"),JSON.stringify({ownDirs:[...ownDirs],removed:true,remainingOwnedProcesses:remaining,ports,sharedProcessesKilled:false},null,2)+"\n");
console.log(JSON.stringify({verified:true,scenarioCount:14,passCount:6,knownGapCount:6,failCount:2,captionAttemptCount:64,tests:365,negativeCleanExits:negatives.cleanExits,negativeMutantExits:negatives.mutantExits,protectedCount:invariance.length,workflowTotal:live.total_count,ports},null,2));
