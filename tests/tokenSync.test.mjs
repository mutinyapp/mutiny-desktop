import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
const root = join(import.meta.dirname, "..");
describe("native-token sync drift gate", () => {
  it("has an offline-capable check command for the pinned unchanged outputs", () => {
    const script = join(root, "scripts/sync-tokens.mjs");
    expect(existsSync(script)).toBe(true);
    const result = spawnSync(process.execPath, [script, "--check"], { cwd: root, encoding: "utf8" });
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
  it.each(["native-tokens.ts", "manifest.json", "offline.html"])("rejects drift in %s without repairing it", file => {
    const script = join(root, "scripts/sync-tokens.mjs");
    expect(existsSync(script)).toBe(true);
    const dir = mkdtempSync(join(tmpdir(), "T26-token-drift-"));
    try {
      mkdirSync(join(dir, "src/native/generated"), { recursive: true });
      mkdirSync(join(dir, "assets/desktop/offline"), { recursive: true });
      for (const name of ["native-tokens.ts", "manifest.json"]) writeFileSync(join(dir, "src/native/generated", name), readFileSync(join(root, "src/native/generated", name)));
      writeFileSync(join(dir, "assets/desktop/offline/offline.html"), readFileSync(join(root, "assets/desktop/offline/offline.html")));
      const target = file === "offline.html" ? join(dir, "assets/desktop/offline", file) : join(dir, "src/native/generated", file);
      const broken = file === "offline.html" ? readFileSync(target, "utf8").replace("--mutiny-surface-canvas: #171522", "--mutiny-surface-canvas: #000000") : readFileSync(target, "utf8") + "\n";
      writeFileSync(target, broken);
      const result = spawnSync(process.execPath, [script, "--check", "--root", dir], { encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/drift|hash/i);
      expect(readFileSync(target, "utf8")).toBe(broken);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
