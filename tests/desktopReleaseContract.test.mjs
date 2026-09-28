import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(resolve(path), "utf8");
describe("desktop release integration", () => {
  it("bumps both package metadata and npm root lock metadata", () => {
    const pkg = JSON.parse(read("package.json"));
    const lock = JSON.parse(read("package-lock.json"));
    expect(pkg.version).toBe("1.2.7");
    expect(lock.version).toBe(pkg.version);
    expect(lock.packages[""].version).toBe(pkg.version);
  });
  it("collects generated RELEASES, packages, stable aliases and checksums for release", () => {
    const workflow = read(".github/workflows/release.yml");
    expect(workflow).toContain("out/make/**/RELEASES");
    expect(workflow).toContain('find artifacts -name "RELEASES" -exec cp {} release/');
    expect(workflow).toContain("test -s release/RELEASES");
    for (const extension of ["zip", "dmg", "exe", "nupkg"]) {
      expect(workflow).toContain(`out/make/**/*.${extension}`);
      expect(workflow).toContain(`find artifacts -name "*.${extension}"`);
    }
    expect(workflow.indexOf('find artifacts -name "RELEASES"')).toBeLessThan(workflow.indexOf("sha256sum ./*"));
  });
  it("defines a read-only, explicitly ad-hoc candidate using canonical validation and makers", () => {
    expect(existsSync(".github/workflows/desktop-candidate.yml")).toBe(true);
    const workflow = read(".github/workflows/desktop-candidate.yml");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("persist-credentials: false");
    for (const text of ["macos-14", "windows-latest", "arch: arm64", "arch: x64", "pnpm lint", "pnpm typecheck", "pnpm test", "pnpm run make --platform=", "MUTINY_MACOS_SIGNING_MODE: dev-ad-hoc", "PLATFORM: ${{ matrix.platform }}", "node scripts/stage-desktop-candidate.mjs", "actions/upload-artifact@v4", "if-no-files-found: error"]) expect(workflow).toContain(text);
    expect(workflow).not.toMatch(/contents: write|secrets\.|action-gh-release|pnpm (?:run )?publish|notarize:mac|release-developer-id|--no-sandbox|--disable-web-security/);
  });
});
