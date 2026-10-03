// Native Electron control: no Mutiny recovery, trust, controls, or app entry imports.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, webFrameMain } from "electron";
const port = Number(process.env.T17_PORT || "49270");
assert.ok([49270,49271,49272,49273,49274,49275,49276,49277,49278,49279].includes(port));
const proof = process.env.T17_PROOF;
const deferred = process.env.T17_ENGINE_PROBE === "deferred";
app.setPath("userData",process.env.T17_USER_DATA);
app.setPath("sessionData",process.env.T17_USER_DATA);
app.commandLine.appendSwitch("use-mock-keychain");
let window: BrowserWindow;
const server = createServer((_req,res)=>{res.writeHead(200,{"Content-Type":"text/html","Connection":"close"});res.end("<!doctype html><title>Native lifecycle control</title>");});
const wait = (ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function until(test:()=>boolean|Promise<boolean>) { const start=Date.now(); while(Date.now()-start<10000) {if(await test()) return;await wait(40);} throw new Error("native frame probe load timeout"); }
function snapshot(frame:Electron.WebFrameMain) {return {detached:frame.detached,destroyed:frame.isDestroyed(),url:frame.url,processId:frame.processId,routingId:frame.routingId};}
app.on("window-all-closed",()=>{/* probe owns teardown */});
async function run() {
  await app.whenReady();
  await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(port,"127.0.0.1",resolve);});
  window=new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
  await window.loadURL(`http://127.0.0.1:${port}/`);
  const before=window.webContents.mainFrame;
  const beforeState=snapshot(before);
  assert.equal(beforeState.detached,false);
  const bundled=`${pathToFileURL(join(__dirname,"offline.html")).href}?error=server`;
  window.webContents.once("render-process-gone",()=>{
    const load=()=>{void window.loadURL(bundled).catch(error=>console.error(error));};
    if(deferred) setImmediate(load); else load();
  });
  window.webContents.forcefullyCrashRenderer();
  await until(async()=>window.webContents.getURL() === bundled && await window.webContents.executeJavaScript("document.querySelector('#error-class')?.textContent === 'Server'"));
  const current=window.webContents.mainFrame;
  const byId=webFrameMain.fromId(current.processId,current.routingId);
  const byToken=webFrameMain.fromFrameToken(current.processId,current.frameToken);
  const receipt={electron:process.versions.electron,deferred,port,before:beforeState,current:snapshot(current),sameWrapper:before===current,byIdSame:byId===current,byTokenSame:byToken===current,imports:"Electron + node only; no product modules",expectedDetached:false};
  writeFileSync(join(proof,`engine-${deferred?"deferred":"sync"}.json`),JSON.stringify(receipt,null,2)+"\n");
  console.log(JSON.stringify(receipt,null,2));
  assert.equal(current.detached,false,"current newly loaded main frame must not remain detached after crash");
}
run().then(()=>{window.destroy();server.close(()=>app.exit(0));}).catch(error=>{console.error(error);if(window&&!window.isDestroyed())window.destroy();server.close(()=>app.exit(1));});
