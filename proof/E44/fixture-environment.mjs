import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, symlinkSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(),'E44-argv-'));
try {
 const fake = join(dir,'fake-tool');
 writeFileSync(fake, `#!${process.execPath}\nimport {basename} from 'node:path';\nconsole.log(JSON.stringify({argv:process.argv,tool:basename(process.argv[1])}));\n`);
 chmodSync(fake,0o755); symlinkSync('fake-tool', join(dir,'security'));
 const result = spawnSync(join(dir,'security'), ['find-identity','-v','-p','codesigning'], {encoding:'utf8'});
 console.log(JSON.stringify({execPath:process.execPath, node:process.versions.node, tmpdir:tmpdir(), status:result.status, stdout:result.stdout, stderr:result.stderr},null,2));
 assert.equal(result.status,0); assert.equal(JSON.parse(result.stdout).tool,'security');
} finally { rmSync(dir,{recursive:true,force:true}); }
