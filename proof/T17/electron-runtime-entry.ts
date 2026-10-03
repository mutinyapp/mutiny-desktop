// Isolated harness only. Never import src/main.ts or its application services.
import assert from "node:assert/strict";
import type { EventEmitter } from "node:events";
import { writeFileSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { app, BrowserWindow, ipcMain, webFrameMain } from "electron";
import { installOfflineRecovery, isOfflineCaptionIpc } from "../../src/native/offlineRecovery";
import { isTrustedIpc } from "../../src/native/rendererTrust";
import { registerWindowControlHandlers } from "../../src/native/windowControls";
import { mainWindowOptions } from "../../src/native/windowOptions";
import { classifyScenario } from "./runtime-result.mjs";

const proof = process.env.T17_PROOF;
const mode = process.env.T17_PLATFORM || "darwin";
const scenario = process.env.T17_SCENARIO || "full-v3";
const port = Number(process.env.T17_PORT || "49206");
assert.ok([49206,49207,49208,49209].includes(port), "v5 assigned T17 ports only");
const prefix = `${mode}-${scenario}`;
const authorization: unknown[] = [];
const frameStates: unknown[] = [];
type AuthorizationTuple = {hosted:boolean;offline:boolean;self:boolean;sameContents:boolean;sameFrame:boolean;detached:boolean};
type CaptionAction = {action:string;document:string;delivered:boolean;tuple:AuthorizationTuple|null;native:boolean;error:string|null;nativeEvents?:string[]};
const captionActions: CaptionAction[] = [];
const hardFailures: string[] = [];
const retryIntents: unknown[] = [];
const characterization: Record<string, unknown> = {};
let pendingAction = "";
let captionDocument = "offline";
const frameIds = new WeakMap<object, number>();
let nextFrameId = 0;
function frameState(frame: Electron.WebFrameMain | null) {
  if (!frame) return null;
  if (!frameIds.has(frame)) frameIds.set(frame, ++nextFrameId);
  try { return {id:frameIds.get(frame), detached:frame.detached, destroyed:frame.isDestroyed(), url:frame.url, processId:frame.processId,routingId:frame.routingId}; }
  catch (error) { return {id:frameIds.get(frame),error:String(error)}; }
}
const userData = process.env.T17_USER_DATA;
app.setPath("userData", userData);
app.setPath("sessionData", userData);
app.commandLine.appendSwitch("use-mock-keychain");
let window: BrowserWindow;
let status = 503;
let hits = 0;
const requests: string[] = [];
const consoleMessages: unknown[] = [];
const failures: unknown[] = [];
const events: string[] = [];
const captions = {minimise:0,maximise:0,close:0};
const server = createServer((_request, response) => {
  hits++;
  response.writeHead(status, {"Content-Type":"text/html", "Cache-Control":"no-store", "Connection":"close", "Content-Security-Policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'"});
  response.end(status === 200 ? "<!doctype html><title>Recovered</title><h1 id='recovered'>Recovered without restart</h1><nav><button id='maximise'>Maximise</button><button id='minimise'>Minimise</button><button id='close'>Close</button></nav><script>for(const a of ['maximise','minimise','close'])document.getElementById(a).onclick=()=>window.native[a]();</script>" : "<!doctype html><title>Unavailable</title><h1>Unavailable</h1>");
});
const wait = (ms: number) => new Promise<void>(resolve=>setTimeout(resolve,ms));
async function until(test: ()=>boolean|Promise<boolean>, label: string, limit = 10000) {
  const start=Date.now();
  while(Date.now()-start < limit) { if(await test()) return; await wait(40); }
  throw new Error(`Timed out: ${label}`);
}
const url = () => window.webContents.mainFrame.url;
async function page() {
  return window.webContents.executeJavaScript(`({title:document.title, error:document.querySelector('#error-class')?.textContent, heading:document.querySelector('h1')?.textContent, captionsHidden:document.querySelector('#captions')?.hidden, platform:window.native?.platform, width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth, background:getComputedStyle(document.documentElement).backgroundColor, controls:[...document.querySelectorAll('button')].map(b=>({id:b.id,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}))})`);
}
async function click(id: string, hidden = false) {
  if(hidden) { await window.webContents.executeJavaScript(`document.getElementById(${JSON.stringify(id)}).click()`); return; }
  const p = await window.webContents.executeJavaScript(`(()=>{const r=document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`);
  window.webContents.sendInputEvent({type:"mouseDown",button:"left",clickCount:1,...p});
  window.webContents.sendInputEvent({type:"mouseUp",button:"left",clickCount:1,...p});
}
async function shot(name: string) { const image=await window.webContents.capturePage(); writeFileSync(join(proof,`${prefix}-${name}.png`),image.toPNG()); }
let dispose: ()=>void;
async function run() {
  await app.whenReady();
  assert.equal(process.versions.electron,"38.1.2","v5 characterization is pinned to Electron 38.1.2");
  await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(port,"127.0.0.1",resolve);});
  const configured = new URL(`http://127.0.0.1:${port}/app?configured=1`);
  window=new BrowserWindow({ ...mainWindowOptions(process.platform,true), width:900,height:600,show:true,backgroundColor:"#23202f",webPreferences:{preload:join(__dirname, mode === "darwin" ? "preload.js" : "preload-win.js"),contextIsolation:true,nodeIntegration:false,sandbox:true,partition:`T17-${prefix}`} });
  window.webContents.session.webRequest.onBeforeRequest((details,callback)=>{
    requests.push(details.url);
    const allowed=details.url.startsWith("file:") || details.url.startsWith(`http://127.0.0.1:${port}/`);
    callback({cancel:!allowed});
  });
  window.webContents.on("console-message",(_event,level,message)=>consoleMessages.push({level,message}));
  window.webContents.on("did-fail-load",(_event,code,description,failed,main)=>failures.push({code,description,url:failed,main}));
  window.webContents.on("render-process-gone",(_event,details)=>events.push(`renderer:${details.reason}`));
  // Mirror the existing app-wide navigation boundary as well as real recovery wiring.
  window.webContents.on("will-navigate",(event,destination)=>{if(new URL(destination).origin !== configured.origin) event.preventDefault();});
  // Observe the navigation authority BEFORE the recovery listener can revoke the
  // owned offline document on successful Retry. This is an observer, not a guard.
  window.webContents.on("will-navigate",(event: Electron.Event & {frame?:unknown;initiator?:unknown;isMainFrame?:boolean},destination)=>{
    if(!destination.endsWith("&retry=1")) return;
    const current=window.webContents.mainFrame;
    retryIntents.push({action:"Retry",destination,defaultPrevented:event.defaultPrevented,hosted:isTrustedIpc({sender:window.webContents,senderFrame:event.initiator},window,configured),offline:isOfflineCaptionIpc({sender:window.webContents,senderFrame:event.initiator},window),self:isOfflineCaptionIpc({sender:window.webContents,senderFrame:current},window),sameContents:true,sameFrame:event.initiator===current,eventFrameSame:event.frame===current,isMainFrame:event.isMainFrame,detached:current.detached,current:frameState(current)});
  });
  dispose=installOfflineRecovery(window,configured,join(__dirname,"offline.html"));
  registerWindowControlHandlers(ipcMain,()=>window,event=>{
    const current=window.webContents.mainFrame;
    const sender=event.senderFrame;
    const hosted=isTrustedIpc(event,window,configured);
    const offline=isOfflineCaptionIpc(event,window);
    const byId=webFrameMain.fromId(current.processId,current.routingId);
    const byToken=webFrameMain.fromFrameToken(current.processId,current.frameToken);
    const tuple={action:pendingAction,document:captionDocument,byIdSame:byId===current,byTokenSame:byToken===current,byId:frameState(byId ?? null),byToken:frameState(byToken),hosted,offline,self:isOfflineCaptionIpc({sender:window.webContents,senderFrame:current},window),sameContents:event.sender===window.webContents,sameFrame:sender===current,detached:current.detached,sender:frameState(sender),current:frameState(current)};
    authorization.push(tuple); console.log("AUTHORIZATION",JSON.stringify({scenario,mode,...tuple}));
    return hosted||offline;
  });
  for (const name of ["did-start-navigation","did-navigate","dom-ready","did-finish-load","render-process-gone"] as const) (window.webContents as EventEmitter).on(name,()=>frameStates.push({event:name,frame:frameState(window.webContents.mainFrame)}));
  ipcMain.on("minimise",()=>captions.minimise++); ipcMain.on("maximise",()=>captions.maximise++); ipcMain.on("close",()=>captions.close++);
  for(const action of ["maximize","unmaximize","minimize","restore","close","closed"] as const) (window as EventEmitter).on(action,()=>events.push(action));
  window.webContents.on("did-finish-load",()=>{if(url().startsWith("file:")) window.webContents.send("config",{customFrame:true});});
  status=["no-crash-no-cdp","full-v3","no-crash-retry-hosted"].includes(scenario) ? 503 : 200;
  void window.loadURL(configured.href).catch((): void => undefined);
  if (["no-crash-no-cdp","full-v3","no-crash-retry-hosted"].includes(scenario)) {
  await until(async()=>url().endsWith("offline.html?error=server") && (await page()).error === "Server","real HTTP failure -> emitted offline page");
  const initial = await page();
  assert.equal(initial.platform,mode); assert.equal(initial.captionsHidden,mode === "darwin");
  assert.equal(initial.scrollWidth,initial.width); assert.equal(initial.bodyWidth,initial.width);
  assert.equal(initial.background,"rgb(35, 32, 47)");
  await shot("server");
  if (scenario === "full-v3") {
  const firstHits=hits; const autoStart=Date.now();
  await until(()=>hits>firstHits,"real 5-second retry",8000);
  const autoElapsed=Date.now()-autoStart;
  assert.ok(autoElapsed>=4000 && autoElapsed<8000);
  await until(async()=>url().startsWith("file:") && (await page()).error === "Server","failed auto-retry returns offline");
  window.hide(); const hiddenHits=hits; await wait(1000); assert.equal(hits,hiddenHits); window.show();
  status=200;
  await click("retry");
  await until(async()=>url() === configured.href && (await page()).heading === "Recovered without restart","real Retry button recovers configured URL");
  const recoveredHits=hits;
  await wait(5200); assert.equal(hits,recoveredHits,"successful app must not be reloaded");
  }
  } else {
    await until(async()=>url() === configured.href && (await page()).heading === "Recovered without restart","isolated hosted start");
  }
  if (["crash-only","full-v3","crash-retry-hosted","crash-native-os"].includes(scenario)) {
  // Real crash of this harness-owned renderer, not any installed application.
  window.webContents.forcefullyCrashRenderer();
  await until(async()=>url().startsWith("file:") && (await page()).error === "Server","crashed renderer -> offline");
  await shot("crash");
  }
  if (scenario === "cdp-only" || scenario === "full-v3") {
  // The real network-emulation failure exercises Chromium's -106 policy.
  await window.webContents.session.clearCache();
  window.webContents.debugger.attach("1.3");
  await window.webContents.debugger.sendCommand("Network.enable");
  await window.webContents.debugger.sendCommand("Network.setCacheDisabled", {cacheDisabled:true});
  await window.webContents.debugger.sendCommand("Network.emulateNetworkConditions", {offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  if (scenario === "full-v3") await click("retry");
  else void window.loadURL(configured.href).catch((): void => undefined);
  await until(async()=>url().endsWith("offline.html?error=offline") && (await page()).error === "Offline","real offline network failure");
  await shot("offline");
  await window.webContents.debugger.sendCommand("Network.emulateNetworkConditions", {offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  window.webContents.debugger.detach();
  }
  // Preserve every v4 native assertion. Only the precisely documented refusal
  // may be classified KNOWN-GAP; arrival, unexpected effects and all other errors
  // stay hard failures. Collect each action so a refusal never hides later facts.
  async function attempt(action: string, assertion: () => Promise<void>) {
    pendingAction=action;
    const record: CaptionAction={action,document:captionDocument,delivered:false,tuple:null,native:false,error:null};
    const beforeEvents=events.length;
    try {
      const count=captions[action as keyof typeof captions];
      const beforeAuthorization=authorization.length;
      await click(action,mode === "darwin");
      await until(()=>captions[action as keyof typeof captions] === count + 1,`${action} IPC delivery`);
      assert.equal(authorization.length,beforeAuthorization+1,"one caption authorization per delivered action");
      record.delivered=true;
      record.tuple=authorization[authorization.length-1] as AuthorizationTuple;
      if(!record.tuple.hosted && !record.tuple.offline) {
        record.error="caption-authorization-refused";
        await wait(80);
        record.native=events.slice(beforeEvents).some(event=>["maximize","unmaximize","minimize","close","closed"].includes(event));
      } else {
        await assertion();
        assert.ok(events.slice(beforeEvents).some(event=>["maximize","unmaximize","minimize","close","closed"].includes(event)),`${action} real native event must occur`);
        record.native=true;
      }
    } catch(error) {record.error=String(error);}
    record.nativeEvents=events.slice(beforeEvents);
    captionActions.push(record);
    pendingAction="";
  }
  async function captionSequence() {
    const before={...captions};
    await attempt("maximise",async()=>{await until(()=>window.isMaximized(),"native maximize"); assert.equal(captions.maximise,before.maximise+1);});
    await attempt("maximise",async()=>{await until(()=>!window.isMaximized(),"native unmaximize"); assert.equal(captions.maximise,before.maximise+2);});
    await attempt("minimise",async()=>{await until(()=>window.isMinimized(),"native minimize"); assert.equal(captions.minimise,before.minimise+1);});
    window.restore(); window.show();
    await until(()=>!window.isMinimized(),"restore harness window");
    const finalPage=await page();
    await shot(captionDocument === "offline" ? "captions" : "hosted-captions");
    const finalRequests=[...requests];
    assert.ok(finalRequests.every(value=>value.startsWith("file:")||value.startsWith(`http://127.0.0.1:${port}/`)));
    if(scenario === "cdp-only" || scenario === "full-v3") assert.ok(failures.some((failure: {code:number})=>failure.code===-106));
    await attempt("close",async()=>{
      await until(()=>window.isDestroyed(),"native close");
      assert.equal(captions.close,before.close+1);
      assert.equal(events.filter(event=>event==="close").length,1);
    });
    return {finalPage,finalRequests};
  }
  let final: {finalPage:unknown;finalRequests:string[]};
  if(scenario !== "no-crash-retry-hosted") final=await captionSequence();
  if(["crash-retry-hosted","no-crash-retry-hosted"].includes(scenario)) {
    // Pause automatic retries while testing the actual Retry button, so a timed
    // main-process load cannot falsely count as successful manual navigation.
    window.hide(); status=200;
    const beforeHits=hits;
    const beforeRequests=requests.length;
    const manualStart=Date.now();
    await click("retry",true);
    await wait(1000);
    const manualRecovered=url() === configured.href && (await page()).heading === "Recovered without restart";
    characterization.manualRetry={worked:manualRecovered,elapsed:Date.now()-manualStart,hitsBefore:beforeHits,hitsAfter:hits,requests:requests.slice(beforeRequests),automaticRetryPaused:true,intents:[...retryIntents]};
    if(!manualRecovered) hardFailures.push(`${scenario}: Retry button did not recover configured HTTP 200 app (automatic retry paused)`);
    // Continue fact gathering even if Retry fails; explicitly distinguish the
    // automatic main-process recovery from the manual button's result.
    window.show();
    await until(async()=>url() === configured.href && (await page()).heading === "Recovered without restart","post-crash HTTP 200 recovery (manual or explicitly recorded automatic)",8000);
    characterization.hostedRestoration={mechanism:manualRecovered?"manual Retry":"automatic retry after show",url:url(),frame:frameState(window.webContents.mainFrame)};
    await shot("hosted-restored");
    captionDocument="hosted-restored";
    final=await captionSequence();
    const hostedActions=captionActions.filter(action=>action.document === "hosted-restored");
    characterization.hostedCaptionsAuthorized=hostedActions.length===4 && hostedActions.every(action=>action.delivered && action.tuple?.hosted && action.native && !action.error);
    characterization.stopBeforeReadyUpdate=scenario === "crash-retry-hosted" && characterization.hostedCaptionsAuthorized!==true;
  }
  if(scenario === "crash-native-os") {
    // BrowserWindow methods model the native OS frame/taskbar/Alt+F4 path.
    // They do NOT reauthorize or bypass renderer IPC and add no product behavior.
    const beforeNative=events.length;
    const beforeIpc={...captions};
    window.minimize();
    await until(()=>window.isMinimized(),"post-crash native OS minimize");
    assert.ok(events.slice(beforeNative).includes("minimize"));
    window.restore(); window.show();
    await until(()=>!window.isMinimized(),"post-crash native OS restore");
    window.close();
    await until(()=>window.isDestroyed(),"post-crash native OS close");
    assert.ok(events.slice(beforeNative).includes("close") && events.slice(beforeNative).includes("closed"));
    assert.deepEqual(captions,beforeIpc,"OS methods must not synthesize caption IPC");
    characterization.nativeOS={minimize:true,restore:true,close:true,closed:true,events:events.slice(beforeNative),ipcUnchanged:true,authorization:"not applicable: native main-process path, no renderer authority"};
  }
  const result=classifyScenario({scenario,hardFailures,captionActions,expectedActions:scenario === "crash-retry-hosted"?8:4});
  const emittedBytes=readFileSync(join(__dirname,"offline.html"));
  const receipt={passed:result.exit===0,...result,scenario,port,authorization,captionActions,characterization,retryIntents,frameStates,electron:process.versions.electron,host:process.platform,presentation:mode,finalPage:final.finalPage,hits,captions,events,requests:final.finalRequests,consoleMessages,failures,emittedBytes:emittedBytes.length,emittedFile:join(__dirname,"offline.html"),scope:"Isolated Electron harness only. Windows presentation simulated on macOS; not installed Windows/Linux runtime acceptance."};
  writeFileSync(join(proof,`${prefix}-runtime.json`),JSON.stringify(receipt,null,2)+"\n");
  console.log(result.result,JSON.stringify(result));
  return result.exit;
}
app.on("window-all-closed",()=>{ /* run() owns cleanup and receipts */ });
run().then(exit=>{dispose?.();if(window&&!window.isDestroyed()) window.destroy();server.close(()=>app.exit(exit));}).catch(error=>{
  hardFailures.push(String(error));
  const result=classifyScenario({scenario,hardFailures,captionActions,expectedActions:scenario === "crash-retry-hosted"?8:4});
  console.error(error); const receipt={passed:false,...result,scenario,port,electron:process.versions.electron,host:process.platform,presentation:mode,authorization,captionActions,characterization,retryIntents,frameStates,consoleMessages,failures,requests,captions,events,url:window&&!window.isDestroyed()?url():null}; console.error(JSON.stringify(receipt,null,2)); writeFileSync(join(proof,`${prefix}-runtime.json`),JSON.stringify(receipt,null,2)+"\n"); writeFileSync(join(proof,`${prefix}-runtime-failure.txt`),String(error.stack||error));
  dispose?.(); if(window&&!window.isDestroyed()) window.destroy(); server.close(()=>app.exit(1));
});
