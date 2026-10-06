import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const root = join(__dirname, "..");
describe("pinned native token provenance", () => {
  it("vendors the unchanged generated output and validates the manifest output hash", () => {
    const file = join(root, "src/native/generated/native-tokens.ts");
    expect(existsSync(file)).toBe(true);
    const bytes = readFileSync(file);
    const manifest = JSON.parse(readFileSync(join(root, "src/native/generated/manifest.json"), "utf8"));
    expect(bytes.toString().split("\n")[0]).toBe("// Generated. Dimensions are px-equivalent points; durations are milliseconds.");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(manifest.outputs["native-tokens.ts"]);
    expect(manifest.outputs["native-tokens.ts"]).toBe("9b9ea1381d75b9730f0cb8fc43089fb8d550a3df4a603839e63ca42699dc4f42");
    expect(manifest.sourceSha256).toBe("0949aa935047b1999d1016e5af5330abbba8d5a426040eac5d1cbaec228fd3bc");
  });
  it("offline HTML consumes local generated CSS variables without raw colour literals outside that block", () => {
    const html = readFileSync(join(root, "assets/desktop/offline/offline.html"), "utf8");
    expect(html).toContain("/* BEGIN GENERATED MUTINY TOKENS */");
    expect(html).toContain("--mutiny-surface-canvas: #171522");
    expect(html).toContain("--mutiny-surface-canvas: #e7e4df");
    expect(html).toContain("background: var(--mutiny-surface-canvas)");
    expect(html).toContain("border-radius: var(--mutiny-radius-contentComfortable)");
    expect(html).toContain("transition: background-color var(--mutiny-motion-hover)");
    expect(html).toContain("height: var(--mutiny-platform-titlebarHeight)");
    const authored = html.replace(/\/\* BEGIN GENERATED MUTINY TOKENS \*\/[\s\S]*?\/\* END GENERATED MUTINY TOKENS \*\//, "");
    expect(authored).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(html).not.toContain("setAppearance");
  });
});
