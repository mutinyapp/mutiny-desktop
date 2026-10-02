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

const proof = process.env.T17_PROOF;
const mode = process.env.T17_PLATFORM || "darwin";
const scenario = process.env.T17_SCENARIO || "full-v3";
const port = Number(process.env.T17_PORT || "49205");
assert.ok([49205,49206,49207,49208,49209].includes(port), "assigned T17 port only");
const prefix = `${mode}-${scenario}`;
const authorization: unknown[] = [];
const frameStates: unknown[] = [];
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
  response.writeHead(status, {"Content-Type":"text/html", "Cache-Control":"no-store", "Connection":"close", "Content-Security-Policy":"default-src 'none'; script-src 'none'; style-src 'none'"});
  response.end(status === 200 ? "<!doctype html><title>Recovered</title><h1 id='recovered'>Recovered without restart</h1>" : "<!doctype html><title>Unavailable</title><h1>Unavailable</h1>");
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
  dispose=installOfflineRecovery(window,configured,join(__dirname,"offline.html"));
  registerWindowControlHandlers(ipcMain,()=>window,event=>{
    const current=window.webContents.mainFrame;
    const sender=event.senderFrame;
    const hosted=isTrustedIpc(event,window,configured);
    const offline=isOfflineCaptionIpc(event,window);
    const byId=webFrameMain.fromId(current.processId,current.routingId);
    const byToken=webFrameMain.fromFrameToken(current.processId,current.frameToken);
    const tuple={byIdSame:byId===current,byTokenSame:byToken===current,byId:frameState(byId ?? null),byToken:frameState(byToken),hosted,offline,self:isOfflineCaptionIpc({sender:window.webContents,senderFrame:current},window),sameContents:event.sender===window.webContents,sameFrame:sender===current,detached:current.detached,sender:frameState(sender),current:frameState(current)};
    authorization.push(tuple); console.log("AUTHORIZATION",JSON.stringify({scenario,mode,...tuple}));
    return hosted||offline;
  });
  for (const name of ["did-start-navigation","did-navigate","dom-ready","did-finish-load","render-process-gone"] as const) (window.webContents as EventEmitter).on(name,()=>frameStates.push({event:name,frame:frameState(window.webContents.mainFrame)}));
  ipcMain.on("minimise",()=>captions.minimise++); ipcMain.on("maximise",()=>captions.maximise++); ipcMain.on("close",()=>captions.close++);
  for(const action of ["maximize","unmaximize","minimize","restore","close","closed"] as const) (window as EventEmitter).on(action,()=>events.push(action));
  window.webContents.on("did-finish-load",()=>{if(url().startsWith("file:")) window.webContents.send("config",{customFrame:true});});
  status=scenario === "no-crash-no-cdp" || scenario === "full-v3" ? 503 : 200;
  void window.loadURL(configured.href).catch((): void => undefined);
  if (scenario === "no-crash-no-cdp" || scenario === "full-v3") {
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
  if (scenario === "crash-only" || scenario === "full-v3") {
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
  // Real caption IPC, real native BrowserWindow actions. On macOS the controls
  // are intentionally hidden; only the simulated Windows presentation is pointer-clicked.
  const actionErrors: string[] = [];
  async function attempt(action: string, assertion: () => Promise<void>) {
    try {
      const count = captions[action as keyof typeof captions];
      await click(action, mode === "darwin");
      await until(()=>captions[action as keyof typeof captions] === count + 1,`${action} IPC delivery`);
      const tuple = authorization[authorization.length - 1] as {hosted:boolean;offline:boolean};
      assert.ok(tuple.hosted || tuple.offline,`${action} sender must be authorized before native action`);
      await assertion();
    }
    catch (error) { actionErrors.push(`${action}: ${String(error)}`); }
  }
  // Preserve each native assertion; collect failures so a refused Maximise cannot
  // hide Minimise/Close authorization tuples in the isolation matrix.
  await attempt("maximise",async()=>{await until(()=>window.isMaximized(),"native maximize"); assert.equal(captions.maximise,1);});
  await attempt("maximise",async()=>{await until(()=>!window.isMaximized(),"native unmaximize"); assert.equal(captions.maximise,2);});
  await attempt("minimise",async()=>{await until(()=>window.isMinimized(),"native minimize"); assert.equal(captions.minimise,1);});
  window.restore(); window.show();
  await until(()=>!window.isMinimized(),"restore harness window");
  const finalPage=await page();
  await shot("captions");
  const finalRequests = [...requests];
  assert.ok(finalRequests.every(value=>value.startsWith("file:")||value.startsWith(`http://127.0.0.1:${port}/`)));
  if (scenario === "cdp-only" || scenario === "full-v3") assert.ok(failures.some((failure: {code:number})=>failure.code===-106));
  const emittedBytes=readFileSync(join(__dirname,"offline.html"));
  await attempt("close",async()=>{
    await until(()=>window.isDestroyed(),"native close");
    assert.equal(captions.close,1);
    assert.equal(events.filter(e=>e==="close").length,1);
  });
  assert.deepEqual(actionErrors,[],"all native caption actions must work on the fallback");
  writeFileSync(join(proof,`${prefix}-runtime.json`),JSON.stringify({passed:true,scenario,port,authorization,frameStates,electron:process.versions.electron,host:process.platform,presentation:mode,finalPage,hits,captions,events,requests:finalRequests,consoleMessages,failures,emittedBytes:emittedBytes.length,emittedFile:join(__dirname,"offline.html"),scope:"Isolated Electron harness only. Windows presentation simulated on macOS; not installed Windows/Linux runtime acceptance."},null,2)+"\n");
}
app.on("window-all-closed",()=>{ /* run() owns cleanup and receipts */ });
run().then(()=>{dispose?.();server.close(()=>app.exit(0));}).catch(error=>{
  console.error(error); const receipt={passed:false,scenario,port,authorization,frameStates,consoleMessages,failures,requests,captions,events,url:window&&!window.isDestroyed()?url():null}; console.error(JSON.stringify(receipt,null,2)); writeFileSync(join(proof,`${prefix}-runtime.json`),JSON.stringify(receipt,null,2)+"\n"); writeFileSync(join(proof,`${prefix}-runtime-failure.txt`),String(error.stack||error));
  dispose?.(); if(window&&!window.isDestroyed()) window.destroy(); server.close(()=>app.exit(1));
});
