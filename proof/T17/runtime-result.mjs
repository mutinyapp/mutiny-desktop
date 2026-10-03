// Caption-only exception to harness acceptance, not to product authorization.
export function classifyScenario({scenario,hardFailures,captionActions,expectedActions=4,electron="38.1.2"}) {
  const crash=["crash-only","full-v3","crash-retry-hosted","crash-native-os"].includes(scenario);
  const gaps=[];
  const failures=[...hardFailures];
  if(captionActions.length!==expectedActions) failures.push("caption action inventory mismatch");
  for(const action of captionActions) {
    if(action.delivered && action.native && !action.error) continue;
    const t=action.tuple;
    const exact=electron === "38.1.2" && crash && action.document==="offline" && action.delivered && !action.native &&
      action.error==="caption-authorization-refused" && t?.hosted===false && t?.offline===false &&
      t?.self===false && t?.sameContents===true && t?.sameFrame===true && t?.detached===true;
    if(exact) gaps.push({name:"ELECTRON38-CRASH-OFFLINE-CAPTION-REFUSAL",...action});
    else failures.push(`${action.document}/${action.action}: ${action.error || "missing effect/delivery"}`);
  }
  return {result:failures.length?"FAIL":gaps.length?"KNOWN-GAP":"PASS",exit:failures.length?1:0,knownGaps:gaps,hardFailures:failures};
}
