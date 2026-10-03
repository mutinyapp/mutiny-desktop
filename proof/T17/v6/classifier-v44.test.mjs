import assert from "node:assert/strict";
import { test } from "vitest";
import { classifyScenario } from "../runtime-result.mjs";
const refused = () => ["maximise","maximise","minimise","close"].map(action=>({action,document:"offline",delivered:true,tuple:{hosted:false,offline:false,self:false,sameContents:true,sameFrame:true,detached:true},native:false,error:"caption-authorization-refused"}));
for(const scenario of ["crash-only","full-v3","crash-retry-hosted","crash-native-os"]) test(`${scenario}: Electron44 never waives detached refusal`,()=>{
  const result=classifyScenario({electron:"44.5.1",scenario,hardFailures:[],captionActions:refused()});
  assert.equal(result.result,"FAIL"); assert.equal(result.exit,1); assert.equal(result.knownGaps.length,0);
});
test("exact Electron38 diagnostic exception stays bounded",()=>{
  assert.equal(classifyScenario({electron:"38.1.2",scenario:"crash-only",hardFailures:[],captionActions:refused()}).result,"KNOWN-GAP");
});
