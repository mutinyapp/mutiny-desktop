// E44-v1 authorizes ONLY an unsigned disposable darwin package. Never starts Electron.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, cpSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const proof = dirname(fileURLToPath(import.meta.url));
const root = resolve(proof, "../..");
const require = createRequire(import.meta.url);
assert.equal(process.platform, "darwin");
assert.equal(process.arch, "x64", "this approved unsigned harness intentionally avoids arm64 fuse auto-signing");
const directory = mkdtempSync(join(tmpdir(), "E44-forge-"));
const snapshot = join(directory, "source");
const output = join(directory, "package");
const receipts = join(proof, "receipts");
mkdirSync(snapshot); mkdirSync(receipts, { recursive: true });
let receipt = { platform: "darwin", arch: "x64", output, signedByHarness: false, launched: false };
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
try {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  for (const file of files) {
    const destination = join(snapshot, file); mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(root, file), destination, { recursive: true, dereference: true });
  }
  symlinkSync(join(root, "node_modules"), join(snapshot, "node_modules"), "dir");
  const forgeSourceHash = hash(join(snapshot, "forge.config.ts"));
  assert.equal(forgeSourceHash, hash(join(root, "forge.config.ts")));
  // A proof-only higher-precedence config inherits the real product config. The
  // ONLY removed hook is explicit macOS signing. Vite/rebuild/fuses all run.
  writeFileSync(join(snapshot, "forge.config.js"), `
const assert = require("node:assert/strict");
module.exports = async () => {
 const jiti = require("jiti").createJiti(__filename);
 const config = await jiti.import(require("node:path").join(__dirname,"forge.config.ts"), { default: true });
 assert.equal(typeof config.hooks.postPackage, "function");
 assert.deepEqual(Object.keys(config.hooks), ["postPackage"]);
 delete config.hooks.postPackage;
  const output = process.env.E44_PACKAGE_OUT;
  assert.ok(output);
  config.outDir = output;
  config.packagerConfig.osxSign = false;
 config.packagerConfig.osxNotarize = false;
 const fuses = config.plugins.find(plugin => plugin.name === "fuses");
 assert.ok(fuses);
 assert.deepEqual(fuses.fusesConfig, { version: "1", 0: false, 1: true, 2: false, 3: false, 4: true, 5: true });
 return config;
};
`);
  const rebuildRequire = createRequire(require.resolve("@electron/rebuild"));
  const abi = rebuildRequire("node-abi").getAbi("44.5.1", "electron");
  assert.equal(abi, "149");
  const env = { ...process.env, E44_PACKAGE_OUT: output, PLATFORM: "darwin", CSC_IDENTITY_AUTO_DISCOVERY: "false", CI: "true" };
  delete env.MUTINY_MACOS_SIGNING_MODE;
  delete env.MUTINY_DEVELOPER_ID_TEAM;
  delete env.MUTINY_NOTARY_KEYCHAIN_PROFILE;
  const argv = ["exec", "electron-forge", "package", "--platform=darwin", "--arch=x64"];
  const result = spawnSync("pnpm", argv, { cwd: snapshot, env, encoding: "utf8", timeout: 300000, maxBuffer: 32 * 1024 * 1024 });
  writeFileSync(join(receipts, "unsigned-forge.stdout.log"), result.stdout || "");
  writeFileSync(join(receipts, "unsigned-forge.stderr.log"), result.stderr || "");
  console.log(result.stdout); console.error(result.stderr);
  receipt = { ...receipt, argv: ["pnpm", ...argv], exit: result.status, signal: result.signal, error: result.error?.message ?? null, abi, forge: require("@electron-forge/core/package.json").version, rebuild: require("@electron/rebuild/package.json").version, nodeABI: rebuildRequire("node-abi/package.json").version, forgeSourceHash };
  assert.equal(result.status, 0, "unsigned Forge package must succeed");
  const app = join(output, "Mutiny-darwin-x64", "Mutiny.app");
  const info = JSON.parse(execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", join(app, "Contents", "Info.plist")], { encoding: "utf8" }));
  const wire = await require("@electron/fuses").getCurrentFuseWire(app);
  const archiveWire = await require("@electron/fuses").getCurrentFuseWire(require("electron"));
  assert.deepEqual([6,7,8].map(key => wire[key]), [6,7,8].map(key => archiveWire[key]));
  assert.equal(Object.keys(wire).filter(key => key !== "version").length, 9);
  assert.deepEqual([0,1,2,3,4,5].map(key => wire[key]), [48,49,48,48,49,49]);
  assert.equal(info.NSAudioCaptureUsageDescription, "Mutiny needs system audio access for screen sharing.");
  assert.equal(info.LSMinimumSystemVersion, "13.0");
  receipt = { ...receipt, info: { minimumOS: info.LSMinimumSystemVersion, audioCaptureUsage: info.NSAudioCaptureUsageDescription }, fuseWire: wire, asarSHA256: hash(join(app,"Contents","Resources","app.asar")) };
} finally {
  rmSync(directory, { recursive: true, force: true });
  receipt.removedOwnedOutput = true;
  writeFileSync(join(receipts, "unsigned-forge.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt, null, 2));
}
