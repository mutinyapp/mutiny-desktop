const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const req = createRequire(path.resolve('package.json'));
const { build } = req('vite');
const ts = req('typescript');
(async () => {
 const out = process.env.T41_BUILD;
 await build({configFile:false,logLevel:'info',plugins:[{name:'T41-isolated-native-fixture',enforce:'pre',
  resolveId(id,importer){
   if(id.endsWith('?asset'))return '\0T41-icon';
   if(id==='./config'&&importer?.endsWith('/src/native/window.ts'))return '\0T41-config';
   if(id==='./tray'&&importer?.endsWith('/src/native/window.ts'))return '\0T41-tray';
  },
  load(id){
   if(id==='\0T41-icon')return 'export default "data:image/png;base64,"';
   if(id==='\0T41-config')return 'export const config=globalThis.__T41Config';
   if(id==='\0T41-tray')return 'export const updateTrayMenu=()=>{}';
  }
 }],build:{outDir:out,emptyOutDir:true,minify:false,rollupOptions:{external:['electron','node:path','node:url']},lib:{entry:path.resolve('src/native/window.ts'),formats:['cjs'],fileName:()=> 'window.cjs'}}});
 fs.copyFileSync('assets/desktop/offline/offline.html',path.join(out,'offline.html'));
 const preload=fs.readFileSync('src/world/window.ts','utf8');
 fs.writeFileSync(path.join(out,'preload.js'),ts.transpileModule(preload,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText.replace('require("../../package.json")','({version:"synthetic-T41"})'));
})().catch(e=>{console.error(e);process.exitCode=1});
