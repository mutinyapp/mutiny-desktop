const {app,screen,session,net,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const out=process.env.T41_OUTPUT,build=process.env.T41_BUILD,phase=process.env.T41_PHASE||'normal',profile=process.env.T41_PROFILE;
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(profile,{recursive:true});
app.setPath('userData',profile);app.setPath('sessionData',path.join(profile,'sessionData'));app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-server','http://127.0.0.1:49720');app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('host-resolver-rules','MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost');
const checks=[],failures=[],network=[],transitions=[],observers=[];let server,window,native,offline=false;
const write=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({phase,electron:process.versions.electron,node:process.versions.node,platform:process.platform,arch:process.arch,checks,count:checks.length,failures,network,transitions,state:native?.config.windowState},null,2));
const fail=e=>{console.error('NATIVE_FAILURE',e?.stack||e);write();server?.close();app.exit(1)};
process.on('uncaughtException',fail);process.on('unhandledRejection',fail);
app.on('window-all-closed',()=>console.log('OWNED FIXTURE retains loop for replacement'));
const check=(name,fn)=>{try{fn();checks.push(name);console.log('PASS',name)}catch(e){failures.push({name,error:e.stack});console.error('FAIL',name,e.stack)}write()};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,timeout=10000){const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error('readiness timeout '+label);await pause(30)}}
async function loaded(owner){await until(()=>!owner.webContents.isLoading()&&owner.webContents.getURL().startsWith('http://127.0.0.1:49720/'),'owned document');await owner.webContents.executeJavaScript('document.readyState')}
async function capture(name){fs.writeFileSync(path.join(out,name+'.png'),(await window.webContents.capturePage()).toPNG())}
async function destroyed(owner,label){const c=owner.webContents;for(const [w,e,listener] of observers)if(w===owner)w.removeListener(e,listener);const events=['move','resize','maximize','unmaximize','enter-full-screen','leave-full-screen'];const before=Object.fromEntries(events.map(e=>[e,owner.listeners(e).map(f=>({name:f.name,source:f.toString()}))]));const owned=events.flatMap(e=>owner.listeners(e).filter(f=>['generateState','generateTransitionState','notifyCapabilities'].includes(f.name)).map(f=>[e,f]));const zoom=c.listeners('before-input-event').filter(f=>f.name==='zoom');check(label+' checker identifies actual product callbacks',()=>{assert(owned.length>=8);assert.equal(zoom.length,1)});owner.destroy();const after=Object.fromEntries(events.map(e=>[e,owner.listeners(e).map(f=>({name:f.name,source:f.toString()}))]));fs.writeFileSync(path.join(out,label.replaceAll(' ','-')+'-listeners.json'),JSON.stringify({before,after,zoomAfter:c.listeners('before-input-event').map(f=>({name:f.name,source:f.toString()}))},null,2));check(label+' native destroyed cleanly',()=>assert(owner.isDestroyed()));check(label+' product geometry/zoom/capability listeners removed',()=>{for(const [e,f] of owned)assert(!owner.listeners(e).includes(f),e+' '+f.name);for(const f of zoom)assert(!c.listeners('before-input-event').includes(f))});}
(async()=>{
 await app.whenReady();
 session.defaultSession.setSpellCheckerEnabled(false);
 const offlineFile=new URL('file://'+path.join(build,'offline.html')).href;
 session.defaultSession.webRequest.onBeforeRequest((d,cb)=>{const u=new URL(d.url);const allowed=(u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.port==='49720')||(u.protocol==='file:'&&u.pathname===new URL(offlineFile).pathname);network.push({url:d.url,allowed});cb({cancel:!allowed})});
 server=http.createServer((_q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.statusCode=offline?503:200;r.end('<!doctype html><style>body{background:#171522;color:#fffdfa;font:20px system-ui;padding:40px}h1{color:#a899ff}</style><h1>Mutiny · independent T41 native checker</h1><p>Synthetic local bounds / zoom / persistence fixture</p><p>No account, installed app, or private content</p>')});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(49720,'127.0.0.1',resolve)});
 for(const url of ['https://example.invalid/checker-denied','http://127.0.0.1:49719/checker-denied']){let denied=false;try{await net.fetch(url)}catch{denied=true}check('actual Electron request denied '+url,()=>assert(denied));check('request hit guard before network '+url,()=>assert(network.some(d=>d.url===url&&!d.allowed)))}
 const positive=await net.fetch('http://127.0.0.1:49720/control');check('actual Electron owned-loopback positive',()=>assert.equal(positive.status,200));
 native=require(path.join(build,'native.cjs'));
 native.registerWindowControlHandlers(ipcMain,()=>native.mainWindow,e=>native.isTrustedIpc(e,native.mainWindow,native.BUILD_URL)||native.isOfflineCaptionIpc(e,native.mainWindow));
 if(phase==='normal'){native.config.customFrame=true;native.config.minimiseToTray=false;native.config.windowState={isMaximised:false}}
 if(phase==='clamp')native.config.windowState={isMaximised:false,displayId:-7654,normalBounds:{x:100000,y:-100000,width:100000,height:100000}};
 if(phase==='malformed')native.config.windowState={isMaximised:false,displayId:'bad',normalBounds:{x:'bad',y:0,width:-1,height:600}};
 const saved=native.config.windowState;
 window=native.createMainWindow({startMinimised:phase!=='normal'});
 if(phase!=='normal')check('fresh launch-to-tray stays hidden',()=>assert.equal(window.isVisible(),false));
 if(phase==='restore')check('fresh process restores on-disk normal bounds',()=>assert.deepEqual(window.getBounds(),saved.normalBounds));
 const work=screen.getDisplayMatching(window.getBounds()).workArea;
 if(phase==='clamp')check('actual removed-display/offscreen/oversize window visible clamp',()=>{const b=window.getBounds();assert(b.x>=work.x);assert(b.y>=work.y);assert(b.x+b.width<=work.x+work.width);assert(b.y+b.height<=work.y+work.height)});
 if(phase==='malformed')check('actual malformed geometry falls back',()=>{const b=window.getBounds();assert.equal(b.width,Math.min(1280,work.width));assert.equal(b.height,Math.min(720,work.height));assert(b.x>=work.x&&b.y>=work.y)});
 await loaded(window);check('real native main-window preload capability handshake',()=>assert.equal(native.mainWindowCustomFrame,true));
 const caps=await window.webContents.executeJavaScript('window.native.getCapabilities()');check('current main frame capability returns active chrome',()=>assert.equal(caps.customFrame,true));
 if(phase==='normal'){
  native.config.customFrame=false;check('stored frame toggle remains stored',()=>assert.equal(native.config.customFrame,false));const c=await window.webContents.executeJavaScript('window.native.getCapabilities()');check('stored toggle does not change active frame',()=>assert.equal(c.customFrame,true));native.config.customFrame=true;
  await window.webContents.executeJavaScript('window.capEvents=[];window.stopCaps=window.native.onCapabilitiesChanged(c=>capEvents.push(c));true');
  const level=()=>window.webContents.getZoomLevel(),accel=process.platform==='darwin'?'meta':'control';
  const send=async(key,mods,type='keyDown')=>{window.webContents.sendInputEvent({type,keyCode:key,modifiers:mods});await pause(100)};
  window.webContents.setZoomLevel(0);await send('=',[accel]);check('actual accelerator equals zooms in',()=>assert.equal(level(),1));await send('-', [accel]);check('actual accelerator minus zooms out',()=>assert.equal(level(),0));await send('+',[accel,'shift']);check('actual shifted plus zooms in',()=>assert.equal(level(),1));await send('0',[accel]);check('actual accelerator zero resets',()=>assert.equal(level(),0));
  for(const [name,key,mods,type] of [['alt','=',['alt',accel],'keyDown'],['keyup','=',[accel],'keyUp'],['extra accelerator','=',[accel,accel==='meta'?'control':'meta'],'keyDown'],['wrong accelerator','=',[accel==='meta'?'control':'meta'],'keyDown'],['other key','X',[accel],'keyDown'],['shift reset','0',[accel,'shift'],'keyDown']]){await send(key,mods,type);check('actual zoom negative '+name,()=>assert.equal(level(),0))}
  await capture('normal-zoom-reset');
  const a=screen.getPrimaryDisplay().workArea;const bounds={x:a.x+Math.min(120,Math.max(0,a.width-1040)),y:a.y+Math.min(90,Math.max(0,a.height-680)),width:1040,height:680};window.setBounds(bounds);await pause(200);
  check('actual normal move/resize persists bounds',()=>assert.deepEqual(native.config.windowState.normalBounds,window.getNormalBounds()));check('actual matching display persists',()=>assert.equal(native.config.windowState.displayId,screen.getDisplayMatching(window.getBounds()).id));
  const normal={...native.config.windowState.normalBounds};const disk=JSON.parse(fs.readFileSync(path.join(profile,'config.json'),'utf8'));check('real Config/electron-store writes exact state to disk',()=>assert.deepEqual(disk.windowState,native.config.windowState));
  window.maximize();await until(()=>window.isMaximized(),'maximize');await pause(200);check('actual maximized normal bounds not overwritten',()=>assert.deepEqual(native.config.windowState.normalBounds,normal));check('actual maximized flag stored',()=>assert.equal(native.config.windowState.isMaximised,true));
 check('actual maximized disk rectangle remains normal',()=>assert.deepEqual(JSON.parse(fs.readFileSync(path.join(profile,'config.json'),'utf8')).windowState.normalBounds,normal));
 fs.writeFileSync(path.join(profile,'expected-normal.json'),JSON.stringify(normal));fs.writeFileSync(path.join(out,'disk-at-maximize.json'),fs.readFileSync(path.join(profile,'config.json')));await destroyed(window,'max-exit');write();server.close(()=>app.exit(failures.length?1:0));return;
  const maxEvents=await window.webContents.executeJavaScript('capEvents');check('real preload receives maximize capability event',()=>assert(maxEvents.some(c=>c.maximized)));
  window.unmaximize();await until(()=>!window.isMaximized(),'unmaximize');await pause(200);
  const full=async v=>{const e=v?'enter-full-screen':'leave-full-screen';await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('native transition timeout '+e)),10000);window.once(e,()=>{clearTimeout(timer);transitions.push(e);resolve()});window.setFullScreen(v)})};
  await full(true);await pause(200);check('actual fullscreen normal bounds not overwritten',()=>assert.deepEqual(native.config.windowState.normalBounds,normal));await full(false);
  await window.webContents.executeJavaScript('window.stopCaps();window.capEvents=[]');window.maximize();await until(()=>window.isMaximized(),'maximize after unsubscribe');await pause(150);const afterUnsub=await window.webContents.executeJavaScript('capEvents.length');check('real preload unsubscribe callback count stays zero',()=>assert.equal(afterUnsub,0));window.unmaximize();await until(()=>!window.isMaximized(),'unmaximize after unsubscribe');await pause(200);
  const old=window;window=native.createMainWindow({startMinimised:true});await loaded(window);check('replacement restores bounds and stays hidden',()=>{assert.deepEqual(window.getBounds(),normal);assert.equal(window.isVisible(),false)});await destroyed(old,'old replacement');
  window.show();await capture('replacement-normal');
  offline=true;await window.loadURL(native.BUILD_URL.href).catch(()=>{});await until(()=>window.webContents.getURL().startsWith(offlineFile)&&!window.webContents.isLoading(),'bundled offline recovery');check('actual local503 routes to bundled offline',()=>assert(window.webContents.getURL().startsWith(offlineFile)));await capture('bundled-offline');
  const refusal=await window.webContents.executeJavaScript('window.native.getCapabilities().then(()=>false,()=>true)');check('bundled offline refuses general capabilities IPC',()=>assert(refusal));
  await window.webContents.executeJavaScript('window.native.maximise()');await until(()=>window.isMaximized(),'offline authorized caption maximize');check('current bundled offline caption still works',()=>assert(window.isMaximized()));window.unmaximize();await until(()=>!window.isMaximized(),'offline unmaximize');
  offline=false;await window.webContents.executeJavaScript('document.querySelector("#retry").click()');await loaded(window);check('real bundled Retry returns to owned configured origin',()=>assert.equal(window.webContents.getURL(),native.BUILD_URL.href));
  window.setBounds(normal);await pause(200);check('final normal bounds retained for fresh process',()=>assert.deepEqual(native.config.windowState.normalBounds,normal));
 }
 fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify({bounds:window.getBounds(),state:native.config.windowState,displays:screen.getAllDisplays().map(d=>({id:d.id,workArea:d.workArea}))},null,2));
 await destroyed(window,'final');write();server.close(()=>app.exit(failures.length?1:0));
})().catch(fail);
