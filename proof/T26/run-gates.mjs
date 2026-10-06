import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, "../..");
const out = process.env.T26_GATE_OUTPUT || join(root, "proof/T26");
const receipt = { head: spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim(), baselineTests: 372, expectedTests: 429, gates: [], sourceHashes: {} };
receipt.worktreeStatus = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout;
for (const path of ["assets/desktop/offline/offline.html", "scripts/sync-tokens.mjs", "src/native/config.ts", "src/native/configSchema.ts", "src/native/window.ts", "src/native/screenPicker.ts", "src/world/window.ts", "src/native/generated/native-tokens.ts", "src/native/generated/manifest.json", "src/native/generated/surfaceTokens.ts", "tests/windowCapabilities.test.ts", "tests/configAppearance.test.ts", "tests/nativePickerSurface.test.ts", "tests/nativeTokens.test.ts", "tests/tokenSync.test.mjs"]) {
  receipt.sourceHashes[path] = createHash("sha256").update(readFileSync(join(root, path))).digest("hex");
}
for (const [name, command, args] of [
  ["token-check", "node", ["scripts/sync-tokens.mjs", "--check"]],
  ["typecheck", "pnpm", ["typecheck"]],
  ["test", "pnpm", ["test"]],
  ["lint", "pnpm", ["lint"]],
]) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", timeout: 300000, maxBuffer: 4 * 1024 * 1024 });
  const text = (result.stdout || "") + (result.stderr || "");
  writeFileSync(join(out, `${name}.log`), text);
  const gate = { command: [command, ...args].join(" "), exit: result.status, log: `${name}.log` };
  if (name === "test") {
    gate.tests = Number(text.match(/Tests\s+(\d+) passed/)[1]);
    gate.files = Number(text.match(/Test Files\s+(\d+) passed/)[1]);
    assert.equal(gate.tests, receipt.expectedTests);
  }
  receipt.gates.push(gate);
  writeFileSync(join(out, "gates.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(`${gate.command} -> exit ${gate.exit}${gate.tests ? ` -> ${gate.tests} tests / ${gate.files} files` : ""}`);
  assert.equal(result.status, 0, text);
}
