import { expect, it } from "vitest";
import { windowZoomAction } from "../src/native/windowZoom";

const input = { type: "keyDown" as const, key: "=", control: false, meta: false, alt: false, shift: false };
for (const platform of ["darwin", "win32", "linux"] as const) {
  const accelerator = platform === "darwin" ? { meta: true } : { control: true };
  it.each([
    ["=", false, "in"], ["+", true, "in"], ["-", false, "out"], ["0", false, "reset"],
  ] as const)(`T41 ${platform} accelerator key %s shift %s selects %s`, (key, shift, action) => {
    expect(windowZoomAction(platform, { ...input, ...accelerator, key, shift })).toBe(action);
  });
  it.each([
    { type: "keyUp" as const }, { alt: true }, { control: true, meta: true },
    { key: "x" }, { key: "0", shift: true }, { key: "-", shift: true },
    { key: "+", shift: false },
    platform === "darwin" ? { control: true, meta: false } : { control: false, meta: true },
  ])(`T41 ${platform} refuses keyup/extra/wrong modifiers %j`, overrides => {
    expect(windowZoomAction(platform, { ...input, ...accelerator, ...overrides })).toBeUndefined();
  });
}
