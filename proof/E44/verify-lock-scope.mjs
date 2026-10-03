// Fail closed on any resolver drift outside Electron and the minimal ABI seam.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve, posix } from "node:path";
import { fileURLToPath } from "node:url";
const proof = dirname(fileURLToPath(import.meta.url));
const root = resolve(proof, "../..");
const require = createRequire(import.meta.url);
const yaml = createRequire(require.resolve("eslint"))("js-yaml");
const base = "ec76ff76991bda4173bb8dcc4c35cfadc73b6bc1";
const before = (file) => execFileSync("git", ["show", `${base}:${file}`], { cwd: root, encoding: "utf8" });
const after = (file) => readFileSync(join(root, file), "utf8");
const changed = (a,b) => [...new Set([...Object.keys(a),...Object.keys(b)])].filter(key => JSON.stringify(a[key]) !== JSON.stringify(b[key])).sort();
const npmOld = JSON.parse(before("package-lock.json"));
const npmNew = JSON.parse(after("package-lock.json"));
const pnpmOld = yaml.load(before("pnpm-lock.yaml"));
const pnpmNew = yaml.load(after("pnpm-lock.yaml"));
function npmClosure(data) {
 const seen = new Set(), queue = ["node_modules/electron"];
 while (queue.length) {
  const key = queue.shift(); if (seen.has(key)) continue; seen.add(key);
  const info = data.packages[key]; assert.ok(info, `missing ${key}`);
  for (const dependency of Object.keys({ ...info.dependencies, ...info.optionalDependencies })) {
   let directory = key, found;
   for (;;) {
    const candidate = posix.join(directory, "node_modules", dependency);
    if (data.packages[candidate]) { found = candidate; break; }
    if (directory === ".") break;
    directory = posix.dirname(directory);
   }
   assert.ok(found, `unresolved ${key} -> ${dependency}`); queue.push(found);
  }
 }
 return seen;
}
const npmAllowed = new Set([...npmClosure(npmOld), ...npmClosure(npmNew), "node_modules/node-abi"]);
const npmChanged = changed(npmOld.packages,npmNew.packages);
for (const key of npmChanged) if (key !== "") assert.ok(npmAllowed.has(key), `npm drift: ${key}`);
const rootNew = structuredClone(npmNew.packages[""]);
rootNew.devDependencies.electron = "38.1.2";
assert.deepEqual(rootNew, npmOld.packages[""]);
function pnpmClosure(data) {
 const seen = new Set(), queue = [`electron@${data.importers["."].devDependencies.electron.version}`];
 while (queue.length) {
  const key = queue.shift(); if (seen.has(key)) continue; seen.add(key);
  const info = data.snapshots[key]; assert.ok(info, `missing ${key}`);
  for (const [dependency, version] of Object.entries({ ...info.dependencies, ...info.optionalDependencies })) queue.push(`${dependency}@${version}`);
 }
 return seen;
}
const pnpmAllowed = new Set([...pnpmClosure(pnpmOld), ...pnpmClosure(pnpmNew), "node-abi@3.77.0", "node-abi@3.94.0"]);
const pnpmPackageAllowed = new Set([...pnpmAllowed].map(key => key.replace(/\(.*/, "")));
const pnpmPackages = changed(pnpmOld.packages,pnpmNew.packages);
const pnpmSnapshots = changed(pnpmOld.snapshots,pnpmNew.snapshots);
for (const key of pnpmPackages) assert.ok(pnpmPackageAllowed.has(key), `pnpm package drift: ${key}`);
for (const key of pnpmSnapshots) {
 if (key === "@electron/rebuild@3.7.2") {
  const value = structuredClone(pnpmNew.snapshots[key]); value.dependencies["node-abi"] = "3.77.0";
  assert.deepEqual(value,pnpmOld.snapshots[key]);
 } else assert.ok(pnpmAllowed.has(key), `pnpm snapshot drift: ${key}`);
}
const importer = structuredClone(pnpmNew.importers); importer["."].devDependencies.electron = pnpmOld.importers["."].devDependencies.electron;
assert.deepEqual(importer,pnpmOld.importers);
assert.deepEqual(pnpmNew.settings,pnpmOld.settings);
assert.equal(pnpmNew.lockfileVersion,pnpmOld.lockfileVersion);
assert.equal(npmNew.packages["node_modules/electron"].version,"44.5.1");
assert.equal(npmNew.packages["node_modules/node-abi"].version,"3.94.0");
const manifest = JSON.parse(after("package.json")), manifestOld = JSON.parse(before("package.json"));
assert.equal(manifest.devDependencies.electron,"44.5.1"); manifest.devDependencies.electron="38.1.2"; assert.deepEqual(manifest,manifestOld);
const receipt = { base, npmChanged, pnpmPackages, pnpmSnapshots, exactElectron: "44.5.1", minimalSeam: "node-abi 3.94.0 only; Forge/rebuild unchanged", unrelatedDiffs: 0, hashes: Object.fromEntries(["package.json","pnpm-lock.yaml","package-lock.json"].map(file=>[file,createHash("sha256").update(after(file)).digest("hex")])) };
writeFileSync(join(proof,"receipts","lock-scope.json"),JSON.stringify(receipt,null,2)+"\n");
console.log(JSON.stringify(receipt,null,2));
