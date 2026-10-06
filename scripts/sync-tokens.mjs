#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Frozen cross-repository source; never regenerate or rewrite its two outputs.
const revision = "db9de9e3e73ccc257d5a613e02b89d667bf1c0ce";
const hashes = {
  "native-tokens.ts": "9b9ea1381d75b9730f0cb8fc43089fb8d550a3df4a603839e63ca42699dc4f42",
  "manifest.json": "765a90246378666f582cbba00605d44f5b344df6d6f3749be3e86fd29c3258fc",
};
const begin = "/* BEGIN GENERATED MUTINY TOKENS */";
const end = "/* END GENERATED MUTINY TOKENS */";
const args = process.argv.slice(2);
const check = args.includes("--check");
const rootIndex = args.indexOf("--root");
const root = rootIndex < 0 ? resolve(dirname(fileURLToPath(import.meta.url)), "..") : resolve(args[rootIndex + 1]);
const webRepo = args.find((arg, index) => !arg.startsWith("--") && (rootIndex < 0 || index !== rootIndex + 1));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
try {
  const generated = join(root, "src/native/generated");
  const artifacts = Object.fromEntries(Object.keys(hashes).map(name => {
    const bytes = !check && webRepo
      ? execFileSync("git", ["-C", resolve(webRepo), "show", `${revision}:packages/tokens/dist/${name}`])
      : readFileSync(join(generated, name));
    if (hash(bytes) !== hashes[name]) throw new Error(`Pinned artifact hash drift: ${name}`);
    return [name, bytes];
  }));
  const manifest = JSON.parse(artifacts["manifest.json"].toString());
  if (hash(artifacts["native-tokens.ts"]) !== manifest.outputs["native-tokens.ts"]) throw new Error("Manifest output hash drift");
  const tokens = JSON.parse(artifacts["native-tokens.ts"].toString().match(/export const nativeTokens = ([\s\S]*?) as const;/)[1]);
  const variables = mode => Object.entries(tokens)
    .filter(([key]) => key.startsWith(`color.${mode}.`))
    .map(([key, value]) => `    --mutiny-${key.slice(`color.${mode}.`.length).replaceAll(".", "-")}: ${value};`)
    .join("\n");
  const metrics = Object.entries(tokens)
    .filter(([key, value]) => typeof value === "number" && (/^(radius|space|platform)\./.test(key) || key === "motion.hover"))
    .map(([key, value]) => `    --mutiny-${key.replaceAll(".", "-")}: ${value}${key.startsWith("motion.") ? "ms" : "px"};`)
    .join("\n");
  const css = `${begin}\n    :root { color-scheme: dark;\n${metrics}\n${variables("dark")}\n    }\n    :root[data-appearance="light"] { color-scheme: light;\n${variables("light")}\n    }\n    ${end}`;
  const offlinePath = join(root, "assets/desktop/offline/offline.html");
  const offline = readFileSync(offlinePath, "utf8");
  const block = /\/\* BEGIN GENERATED MUTINY TOKENS \*\/[\s\S]*?\/\* END GENERATED MUTINY TOKENS \*\//;
  if (!block.test(offline)) throw new Error("Offline generated token block is missing");
  const updated = offline.replace(block, css);
  if (check) {
    if (updated !== offline) throw new Error("Offline generated CSS drift");
    console.log(`Token check passed: ${revision}; native output + manifest + offline CSS`);
  } else {
    if (!webRepo) throw new Error("Usage: node scripts/sync-tokens.mjs <mutiny-web-repo> | --check");
    mkdirSync(generated, { recursive: true });
    for (const [name, bytes] of Object.entries(artifacts)) writeFileSync(join(generated, name), bytes);
    writeFileSync(offlinePath, updated);
    console.log(`Synced unchanged token artifacts from ${revision}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
