import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const [inputArg, outputArg, platform, arch] = process.argv.slice(2);
if (process.argv.length !== 6 || !((platform === "darwin" && arch === "arm64") || (platform === "win32" && arch === "x64"))) throw new Error("Expected input output {darwin arm64|win32 x64}");
const input = resolve(inputArg);
const output = resolve(outputArg);
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const files = new Map();
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing symlink: ${path}`);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile() && (/\.(zip|dmg|exe|nupkg)$/.test(entry.name) || entry.name === "RELEASES")) {
      if (files.has(entry.name)) throw new Error(`Duplicate artifact: ${entry.name}`);
      files.set(entry.name, path);
    }
  }
}
walk(input);
const zip = `Mutiny-${platform}-${arch}-${version}.zip`;
function requireAsset(name) {
  if (!files.has(name) || readFileSync(files.get(name)).length === 0) throw new Error(`Missing/empty artifact: ${name}`);
  return readFileSync(files.get(name));
}
requireAsset(zip);
if (platform === "win32") {
  requireAsset("Mutiny-Setup.exe");
  const manifest = requireAsset("RELEASES").toString("utf8").trim();
  const referenced = new Set();
  for (const line of manifest.split(/\r?\n/)) {
    const match = /^([a-f0-9]{40}) ([^\s/\\]+\.nupkg) ([0-9]+)$/i.exec(line);
    if (!match || basename(match[2]) !== match[2]) throw new Error("Invalid generated RELEASES line");
    const [, hash, name, size] = match;
    const bytes = requireAsset(name);
    if (createHash("sha1").update(bytes).digest("hex") !== hash.toLowerCase() || bytes.length !== Number(size)) throw new Error(`RELEASES mismatch: ${name}`);
    referenced.add(name);
  }
  if (!referenced.has(`Mutiny-${version}-full.nupkg`)) throw new Error("Missing current full nupkg in RELEASES");
  for (const name of files.keys()) if (name.endsWith(".nupkg") && !referenced.has(name)) throw new Error(`Unreferenced nupkg: ${name}`);
}
// Fresh staging only: never overwrite a previous candidate or source artifacts.
mkdirSync(output);
for (const [name, path] of files) copyFileSync(path, join(output, name));
copyFileSync(files.get(zip), join(output, `Mutiny-${platform}-${arch}.zip`));
writeFileSync(join(output, "QA-ONLY.txt"), `Candidate ${version}; source ${process.env.GITHUB_SHA || "local-unbound"}. NOT FOR PUBLICATION. macOS ad-hoc QA; Windows unsigned. No runtime acceptance implied.\n`);
const sums = readdirSync(output).sort().map((name) => `${createHash("sha256").update(readFileSync(join(output, name))).digest("hex")}  ${name}\n`).join("");
writeFileSync(join(output, "SHA256SUMS.txt"), sums);
console.log(`Staged and hashed ${files.size} generated assets plus stable alias and QA notice`);
