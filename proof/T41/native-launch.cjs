const {app,screen}=require('electron');const fs=require('node:fs');const path=require('node:path');const http=require('node:http');const assert=require('node:assert/strict');
const out=process.env.T41_OUTPUT,build=process.env.T41_BUILD,phase=process.env.T41_PHASE||'normal';
app.setPath('userData',path.join(out,'userData'));app.setPath('sessionData',path.join(out,'sessionData'));app.disableHardwareAcceleration();app.commandLine.appendSwitch('force-server','http://127.0.0.1:49720');
process.on('uncaughtException',error=>{console.error('UNCAUGHT',error);app.exit(1)});
process.on('unhandledRejection',error=>{console.error('UNHANDLED',error);app.exit(1)});
let server,window,checks=[];const check=(name,fn)=>{fn();checks.push(name);console.log('PASS',name)};const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await app.whenReady();server=http.createServer((req,res)=>res.end('<!doctype html><meta charset="utf-8"><h1>T41 synthetic fixture</h1>'));await new Promise(r=>server.listen(49720,'127.0.0.1',r));
 const saved=phase==='normal'?{isMaximised:false}:phase==='restore'?JSON.parse(fs.readFileSync(process.env.T41_STATE,'utf8')):{isMaximised:false,displayId:-99,normalBounds:{x:999999,y:-999999,width:99999,height:99999}};
 let state=saved;globalThis.__T41Config={appearance:'dark',customFrame:true,spellchecker:true,minimiseToTray:false,sync(){},get windowState(){return state},set windowState(v){state=v;fs.writeFileSync(path.join(out,'state.json'),JSON.stringify(v))}};
 const native=require(path.join(build,'window.cjs'));window=native.createMainWindow({startMinimised:phase!=='normal'});
 window.webContents.session.webRequest.onBeforeRequest((d,callback)=>callback({cancel:!d.url.startsWith('http://127.0.0.1:49720/')}));
 if(phase!=='normal'){
  check('launch-to-tray stays hidden',()=>assert.equal(window.isVisible(),false));
  if(phase==='restore')check('fresh process restores persisted normal geometry',()=>assert.deepEqual(window.getBounds(),saved.normalBounds));
  else {const b=window.getBounds(),area=screen.getDisplayMatching(b).workArea;check('actual removed-display clamp',()=>{assert(b.x>=area.x);assert(b.y>=area.y);assert(b.x+b.width<=area.x+area.width);assert(b.y+b.height<=area.y+area.height)})}
  window.show();
 }
 await new Promise((resolve,reject)=>{window.webContents.once('did-finish-load',resolve);window.webContents.once('did-fail-load',(_e,c,m)=>reject(new Error(c+':'+m)))});
 const caps=await window.webContents.executeJavaScript('window.native.getCapabilities()');check('real preload handshake',()=>assert.equal(caps.customFrame,true));
 if(phase==='normal'){
  const accel=process.platform==='darwin'?'meta':'control';const send=async(key,mods,type='keyDown')=>{window.webContents.sendInputEvent({type,keyCode:key,modifiers:mods});await pause(120)};const z=()=>window.webContents.getZoomLevel();window.webContents.setZoomLevel(0);
  await send('=',[accel]);check('platform zoom in',()=>assert.equal(z(),1));await send('-',[accel]);check('platform zoom out',()=>assert.equal(z(),0));await send('=',[accel]);await send('0',[accel]);check('reset',()=>assert.equal(z(),0));
  await send('=',[accel,'alt']);check('alt negative',()=>assert.equal(z(),0));await send('=',[accel],'keyUp');check('keyup negative',()=>assert.equal(z(),0));await send('X',[accel]);check('other key negative',()=>assert.equal(z(),0));
  window.setBounds({x:500,y:300,width:1040,height:680});await pause(200);check('persist normal geometry',()=>assert.deepEqual(state.normalBounds,window.getNormalBounds()));check('persist display',()=>assert.equal(state.displayId,screen.getDisplayMatching(window.getBounds()).id));
  const normal={...state.normalBounds};const transition=value=>new Promise((resolve,reject)=>{const name=value?'enter-full-screen':'leave-full-screen';const timer=setTimeout(()=>reject(new Error(name+' timeout')),10000);window.once(name,()=>{clearTimeout(timer);resolve()});window.setFullScreen(value)});await transition(true);check('fullscreen retains normal geometry',()=>assert.deepEqual(state.normalBounds,normal));await transition(false);
 }
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({phase,checks,count:checks.length,state},null,2));
})().then(()=>{server?.close();app.exit(0)}).catch(e=>{console.error(e);server?.close();app.exit(1)});
