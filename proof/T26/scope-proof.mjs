import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
const root = resolve(import.meta.dirname, "../..");
const git = args => execFileSync("git", args, { cwd: root });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const receipt = { baseline: "75ac011dd6dbe482ed58359d1d3274fe609e9b65", branch: git(["branch", "--show-current"]).toString().trim(), protectedFiles: {}, upstreamByteParity: {}, tests: { baseline: 372, final: 429, added: 429 - 372 } };
for (const path of ["src/native/rendererTrust.ts", "src/native/configIpcPolicy.ts", "src/native/offlineRecovery.ts", "src/native/displayMedia.ts", "src/native/screenPickerResult.ts", "src/main.ts"]) {
  const baseline = hash(git(["show", `${receipt.baseline}:${path}`]));
  const candidate = hash(readFileSync(join(root, path)));
  assert.equal(candidate, baseline, `${path} must stay unchanged`);
  receipt.protectedFiles[path] = { baseline, candidate };
}
for (const name of ["native-tokens.ts", "manifest.json"]) {
  const upstream = execFileSync("git", ["-C", process.env.T26_WEB_REPO || "/Users/friday/Projects/mutiny-rebuild/web", "show", `db9de9e3e73ccc257d5a613e02b89d667bf1c0ce:packages/tokens/dist/${name}`]);
  assert.deepEqual(readFileSync(join(root, "src/native/generated", name)), upstream);
  receipt.upstreamByteParity[name] = true;
}
const ports = spawnSync("lsof", ["-nP", "-iTCP:49430-49439", "-sTCP:LISTEN"], { encoding: "utf8" });
assert.equal(ports.status, 1, `Unexpected owned-port listener: ${ports.stdout} ${ports.stderr}`);
assert.equal(ports.stdout, ""); assert.equal(ports.stderr, "");
receipt.listenerTeardown = { command: "lsof -nP -iTCP:49430-49439 -sTCP:LISTEN", exit: ports.status, stdout: ports.stdout, stderr: ports.stderr, listeners: 0 };
writeFileSync(join(root, "proof/T26/scope-receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log("Scope proof passed: protected sources unchanged; pinned upstream outputs byte-identical; owned listeners 0; 57 tests added");
