// Same extensionless ESM shebang + symlink shape as the untouched signing fixture.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync, symlinkSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
const parent = mkdtempSync(join(tmpdir(), "E44-fixture-parent-"));
const rows = [];
try {
 for (const type of ["commonjs", "neutral"]) {
  const dir = join(parent, type); mkdirSync(dir);
  if (type === "commonjs") writeFileSync(join(dir, "package.json"), JSON.stringify({ type }));
  const fake = join(dir, "fake-tool");
  writeFileSync(fake, `#!${process.execPath}\nimport {basename} from 'node:path';\nconsole.log(JSON.stringify({argv:process.argv,tool:basename(process.argv[1])}));\n`);
  chmodSync(fake, 0o755); symlinkSync("fake-tool", join(dir, "security"));
  const result = spawnSync(join(dir, "security"), ["find-identity", "-v", "-p", "codesigning"], { encoding: "utf8" });
  rows.push({ type, status: result.status, stdout: result.stdout, stderr: result.stderr, execPath: process.execPath, node: process.versions.node });
 }
 console.log(JSON.stringify(rows, null, 2));
 assert.equal(rows[1].status, 0); assert.equal(JSON.parse(rows[1].stdout).tool, "security");
 assert.notEqual(rows[0].stdout, rows[1].stdout);
} finally { rmSync(parent, { recursive: true, force: true }); }
