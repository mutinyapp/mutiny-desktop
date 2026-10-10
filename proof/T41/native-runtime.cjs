const {app,screen}=require('electron');
const fs=require('node:fs');const path=require('node:path');const http=require('node:http');const assert=require('node:assert/strict');
const out=process.env.T41_OUTPUT;const build=process.env.T41_BUILD;const baseline=process.env.T41_BASELINE==='1';
app.setPath('userData',path.join(out,'userData'));app.setPath('sessionData',path.join(out,'sessionData'));app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-server','http://127.0.0.1:49720');
process.on('uncaughtException',error=>{console.error('UNCAUGHT',error);app.exit(1)});
process.on('unhandledRejection',error=>{console.error('UNHANDLED',error);app.exit(1)});
// Keep this owned harness alive between replacement windows, as the real tray
// application does; otherwise Electron begins quitting before recreation.
app.on('window-all-closed',()=>{ console.log('HARNESS window-all-closed retained'); });
const html='<!doctype html><meta charset="utf-8"><style>body{background:#171522;color:#e7e4df;font:20px system-ui;padding:28px}h1{color:#b5a4ff}</style><h1>Mutiny · T41 synthetic native fixture</h1><p>Window bounds / keyboard zoom · no account or private content</p><p id="state">Local fixture</p>';
let server,window;let checks=[];
const check=(name,fn)=>{fn();checks.push(name);console.log('PASS',name)};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await app.whenReady();server=http.createServer((req,res)=>res.end(html));await new Promise(r=>server.listen(49720,'127.0.0.1',r));
 let state={isMaximised:false};const config={appearance:'dark',customFrame:true,spellchecker:true,minimiseToTray:false,sync(){},get windowState(){return state},set windowState(s){state=s;fs.writeFileSync(path.join(out,'state.json'),JSON.stringify(s))}};
 globalThis.__T41Config=config;
 const native=require(path.join(build,'window.cjs'));window=native.createMainWindow();
 window.webContents.session.webRequest.onBeforeRequest((details,callback)=>{const allow=details.url.startsWith('http://127.0.0.1:49720/')||details.url.startsWith('file:'+build+'/offline.html');if(!allow)console.log('BLOCKED request',details.url);callback({cancel:!allow})});
 await new Promise((resolve,reject)=>{window.webContents.once('did-finish-load',resolve);window.webContents.once('did-fail-load',(_e,c,m)=>reject(new Error(c+':'+m)))});
 const caps=await window.webContents.executeJavaScript('window.native.getCapabilities()');check('active customFrame capability',()=>assert.equal(caps.customFrame,true));config.customFrame=false;const pending=await window.webContents.executeJavaScript('window.native.getCapabilities()');check('stored change does not alter active frame',()=>assert.equal(pending.customFrame,true));
 const level=()=>window.webContents.getZoomLevel();const send=async(key,mods,type='keyDown')=>{window.webContents.sendInputEvent({type,keyCode:key,modifiers:mods});await pause(120)};
 const accelerator=process.platform==='darwin'?'meta':'control';window.webContents.setZoomLevel(0);
 await send('=',[accelerator]);check('native zoom in',()=>assert.equal(level(),baseline&&process.platform==='darwin'?0:1));
 await send('-', [accelerator]);check('native zoom out',()=>assert.equal(level(),0));
 await send('=',[accelerator]);await send('0',[accelerator]);check('native reset',()=>assert.equal(level(),baseline&&process.platform!=='darwin'?1:0));
 window.webContents.setZoomLevel(0);await send('=',[accelerator,'alt']);check('alt modifier does not zoom',()=>assert.equal(level(),baseline&&process.platform!=='darwin'?1:0));
 window.webContents.setZoomLevel(0);await send('=',[accelerator],'keyUp');check('keyup does not zoom',()=>assert.equal(level(),baseline&&process.platform!=='darwin'?1:0));window.webContents.setZoomLevel(0);
 const before=window.getBounds();console.log('NATIVE',JSON.stringify({electron:process.versions.electron,platform:process.platform,displays:screen.getAllDisplays().map(d=>({id:d.id,workArea:d.workArea})),before,state}));
 await pause(150);fs.writeFileSync(path.join(out,baseline?'before.png':'after.png'),(await window.webContents.capturePage()).toPNG());
 if(!baseline){
  window.setBounds({x:before.x+30,y:before.y+20,width:1040,height:680});await pause(200);check('normal geometry persists',()=>assert.deepEqual(state.normalBounds,window.getNormalBounds()));check('display persists',()=>assert.equal(state.displayId,screen.getDisplayMatching(window.getBounds()).id));
  const normal={...state.normalBounds};
  async function fullscreen(value) {
   const event=value?'enter-full-screen':'leave-full-screen';
   console.log('TRANSITION request',event,'current',window.isFullScreen());
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Native transition timeout '+event)),10000);window.once(event,()=>{clearTimeout(timer);console.log('TRANSITION observed',event);resolve()});window.setFullScreen(value)});
  }
  await fullscreen(true);check('fullscreen is not normal geometry',()=>assert.deepEqual(state.normalBounds,normal));await fullscreen(false);
  const loaded=owner=>new Promise((resolve,reject)=>{owner.webContents.once('did-finish-load',resolve);owner.webContents.once('did-fail-load',(_e,c,m)=>reject(new Error(c+':'+m)))});
  const old=window;window=native.createMainWindow({startMinimised:true});await loaded(window);old.destroy();check('recreated normal bounds',()=>assert.deepEqual(window.getBounds(),normal));check('start-to-tray remains hidden',()=>assert.equal(window.isVisible(),false));
  state={isMaximised:false,normalBounds:{x:999999,y:-999999,width:99999,height:99999},displayId:-987};const previous=window;window=native.createMainWindow({startMinimised:true});await loaded(window);previous.destroy();const b=window.getBounds(),work=screen.getDisplayMatching(b).workArea;check('removed/offscreen display clamps actual window',()=>{assert(b.x>=work.x);assert(b.y>=work.y);assert(b.x+b.width<=work.x+work.width);assert(b.y+b.height<=work.y+work.height)});
 }
 fs.writeFileSync(path.join(out,'runtime-result.json'),JSON.stringify({baseline,checks,count:checks.length,state},null,2));
})().then(()=>{if(window&&!window.isDestroyed())window.destroy();server?.close();app.exit(0)}).catch(e=>{console.error(e);if(window&&!window.isDestroyed())window.destroy();server?.close();app.exit(1)});
