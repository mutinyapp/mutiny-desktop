// Execute only the copied native-only entry; never Mutiny src/main.ts or a packaged app.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdtempSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
const proof = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const scratch = mkdtempSync(join(tmpdir(), "E44-native-"));
const receipts = join(proof, "receipts");
mkdirSync(receipts, { recursive: true });
const runs = [];
try {
  const entry = join(scratch, "probe.cjs");
  await build({ entryPoints: [join(proof, "electron-frame-lifecycle-entry.ts")], outfile: entry, platform: "node", format: "cjs", bundle: false });
  copyFileSync(join(proof, "offline.html"), join(scratch, "offline.html"));
  for (const [index, mode] of ["sync", "deferred"].entries()) {
    const port = 49270 + index;
    const userData = join(scratch, mode);
    mkdirSync(userData);
    const env = { ...process.env, E44_PORT: String(port), E44_PROOF: receipts, E44_USER_DATA: userData, E44_ENGINE_PROBE: mode };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.NODE_OPTIONS;
    const result = spawnSync(require("electron"), [entry], { encoding: "utf8", timeout: 45000, env });
    writeFileSync(join(receipts, `native-${mode}.stdout.log`), result.stdout || "");
    writeFileSync(join(receipts, `native-${mode}.stderr.log`), result.stderr || "");
    console.log(result.stdout); console.error(result.stderr);
    const receipt = { mode, port, exit: result.status, signal: result.signal, error: result.error?.message ?? null };
    runs.push(receipt);
    writeFileSync(join(receipts, "native-runs.json"), JSON.stringify(runs, null, 2) + "\n");
    assert.equal(result.status, 0, "native-only probe must pass");
    const engine = JSON.parse(readFileSync(join(receipts, `engine-${mode}.json`), "utf8"));
    assert.equal(engine.electron, "44.5.1");
    assert.equal(engine.current.detached, false);
    await new Promise((resolve, reject) => {
      const server = createServer(); server.once("error", reject);
      server.listen(port, "127.0.0.1", () => server.close(resolve));
    });
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
  console.log("Removed owned native-only probe build/user-data; assigned ports are free after successful probes.");
}
