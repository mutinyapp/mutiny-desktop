import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it, expect } from "vitest";

describe("candidate artifact staging (synthetic packaging unit test, not runtime proof)", () => {
  it("copies every asset byte, validates real RELEASES format against nupkg, and rejects tampering/missing manifest", () => {
    const root = mkdtempSync(join(tmpdir(), "candidate-stage-"));
    try {
      const input = join(root, "make");
      mkdirSync(input);
      const data = Buffer.from("synthetic nupkg bytes");
      const nupkg = "Mutiny-1.2.5-full.nupkg";
      const assets = { [nupkg]: data, "Mutiny-Setup.exe": "exe", "Mutiny-win32-x64-1.2.5.zip": "zip", "extra.dmg": "dmg" };
      for (const [name, bytes] of Object.entries(assets)) writeFileSync(join(input, name), bytes);
      const manifest = `${createHash("sha1").update(data).digest("hex")} ${nupkg} ${data.length}\n`;
      writeFileSync(join(input, "RELEASES"), manifest);
      const run = (suffix) => spawnSync(process.execPath, [resolve("scripts/stage-desktop-candidate.mjs"), input, join(root, suffix), "win32", "x64"], { encoding: "utf8" });
      const result = run("good");
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(join(root, "good", "RELEASES"), "utf8")).toBe(manifest);
      for (const [name, bytes] of Object.entries(assets)) expect(readFileSync(join(root, "good", name))).toEqual(Buffer.from(bytes));
      const sums = readFileSync(join(root, "good", "SHA256SUMS.txt"), "utf8");
      for (const name of readdirSync(join(root, "good")).filter((name) => name !== "SHA256SUMS.txt")) expect(sums).toContain(`${createHash("sha256").update(readFileSync(join(root, "good", name))).digest("hex")}  ${name}\n`);
      writeFileSync(join(input, nupkg), "tampered");
      expect(run("bad").status).not.toBe(0);
      rmSync(join(input, "RELEASES"));
      expect(run("missing").status).not.toBe(0);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
