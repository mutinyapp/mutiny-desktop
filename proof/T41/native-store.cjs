const {app}=require('electron');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const out=process.env.T41_OUTPUT;app.setPath('userData',path.join(out,'userData'));app.setPath('sessionData',path.join(out,'sessionData'));app.disableHardwareAcceleration();
(async()=>{await app.whenReady();const {default:Store}=await import('electron-store');const ts=require('typescript');const Module=require('node:module');const filename=path.resolve('src/native/configSchema.ts');const mod=new Module(filename);mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,filename);
 const {configSchema,configDefaults}=mod.exports;
 let count=0;
 for(const bounds of [null,{},'bad',{x:0,y:0,width:-3,height:500},{x:'bad',y:0,width:1000,height:700}]){
  const name='bounds-'+count;const dir=path.join(out,'store');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,name+'.json'),JSON.stringify({...configDefaults,windowState:{isMaximised:false,normalBounds:bounds,displayId:'removed'}}));
  const store=new Store({name,cwd:dir,schema:configSchema,defaults:configDefaults});assert.equal(store.get('windowState').isMaximised,false);console.log('PASS malformed on-disk native bounds',JSON.stringify(bounds));count++;
 }
 const store=new Store({name:'persist',cwd:path.join(out,'store'),schema:configSchema,defaults:configDefaults});
 const state={isMaximised:false,normalBounds:{x:100,y:200,width:1000,height:700},displayId:17};store.set('windowState',state);const second=new Store({name:'persist',cwd:path.join(out,'store'),schema:configSchema,defaults:configDefaults});assert.deepEqual(second.get('windowState'),state);console.log('PASS actual electron-store persistence');count++;
 fs.writeFileSync(path.join(out,'store-result.json'),JSON.stringify({count}));
})().then(()=>app.exit(0)).catch(e=>{console.error(e);app.exit(1)});
