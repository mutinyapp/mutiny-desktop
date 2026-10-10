const path=require('node:path'),fs=require('node:fs'),{createRequire}=require('node:module');
const root=process.env.T41_SOURCE||process.cwd(),req=createRequire(path.join(process.cwd(),'package.json')), {build}=req('vite'), ts=req('typescript');
(async()=>{
 const out=process.env.T41_BUILD;const entry=path.join(root,'.checker','native-entry.ts');
 fs.writeFileSync(entry,`export * from '../src/native/window';\nexport {config} from '../src/native/config';\nexport {registerWindowControlHandlers} from '../src/native/windowControls';\nexport {isTrustedIpc} from '../src/native/rendererTrust';\nexport {isOfflineCaptionIpc} from '../src/native/offlineRecovery';\n`);
 await build({configFile:false,logLevel:'info',plugins:[{name:'independent-fixture-boundaries',enforce:'pre',resolveId(id,importer){if(id.endsWith('?asset'))return '\0check-icon';if(id==='./tray'&&importer?.endsWith('/src/native/window.ts'))return '\0check-tray';if(id==='./discordRpc'&&importer?.endsWith('/src/native/config.ts'))return '\0check-rpc'},load(id){if(id==='\0check-icon')return 'export default "data:image/png;base64,"';if(id==='\0check-tray')return 'export const updateTrayMenu=()=>{}';if(id==='\0check-rpc')return 'export const initDiscordRpc=()=>{}; export const destroyDiscordRpc=()=>{}'}}],build:{outDir:out,emptyOutDir:true,minify:false,rollupOptions:{external:['electron','electron-store','node:path','node:url'],output:{interop:'compat'}},lib:{entry,formats:['cjs'],fileName:()=> 'native.cjs'}}});
 fs.copyFileSync(path.join(root,'assets/desktop/offline/offline.html'),path.join(out,'offline.html'));
 let preload=fs.readFileSync(path.join(root,'src/world/window.ts'),'utf8');
 fs.writeFileSync(path.join(out,'preload.js'),ts.transpileModule(preload,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText.replace('require("../../package.json")','({version:"independent-synthetic-T41"})'));
})().catch(e=>{console.error(e);process.exitCode=1});
