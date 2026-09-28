import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { RENDERER_CONTENT_SECURITY_POLICY } from "../src/native/contentSecurityPolicy";

const directives = Object.fromEntries(
  RENDERER_CONTENT_SECURITY_POLICY.split(";")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const [name, ...sources] = d.split(/\s+/);
      return [name, sources];
    }),
);

describe("renderer CSP", () => {
  it("lets voice denoisers compile wasm and load their worklets", () => {
    const script = directives["script-src"];
    expect(script).toBeDefined();
    expect(script).toContain("'wasm-unsafe-eval'"); // DeepFilterNet3 + RNNoise
    expect(script).toContain("blob:"); // DeepFilterNet3 worklet
    expect(script).toContain("https://cdn.jsdelivr.net"); // RNNoise worklet
  });

  it("does not allow JavaScript eval", () => {
    expect(RENDERER_CONTENT_SECURITY_POLICY).not.toContain("'unsafe-eval'");
  });

  it("keeps the existing app, media and connect scopes", () => {
    expect(directives["default-src"]).toContain("https://app.mutinyapp.gg");
    expect(directives["media-src"]).toEqual(["'self'", "blob:", "data:", "https:"]);
    expect(directives["connect-src"]).toEqual(["'self'", "wss:", "https:"]);
  });

  it("is the policy the main process injects", () => {
    const main = readFileSync("src/main.ts", "utf8");
    expect(main).toContain('"Content-Security-Policy": [RENDERER_CONTENT_SECURITY_POLICY]');
    expect(main).not.toMatch(/"default-src 'self'/);
  });
});
