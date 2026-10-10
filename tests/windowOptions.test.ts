import { describe, expect, it } from "vitest";

import {
  mainWindowOptions,
  usesCustomFrame,
} from "../src/native/windowOptions";

describe("main window options", () => {
  it("reports the configured custom titlebar on every supported desktop platform", () => {
    expect(usesCustomFrame("darwin", true)).toBe(true);
    expect(usesCustomFrame("darwin", false)).toBe(false);
    expect(usesCustomFrame("win32", true)).toBe(true);
    expect(usesCustomFrame("linux", true)).toBe(true);
    expect(usesCustomFrame("linux", false)).toBe(false);
  });

  it("reports the chrome the live window was created with, not a pending preference", () => {
    // A frameless/hidden-inset window cannot change chrome until relaunch, so
    // the renderer must keep drawing its drag strip until then (and vice versa).
    expect(usesCustomFrame("darwin", false, true)).toBe(true);
    expect(usesCustomFrame("darwin", true, false)).toBe(false);
    expect(usesCustomFrame("win32", false, true)).toBe(true);
    expect(usesCustomFrame("linux", true, false)).toBe(false);
  });

  it("falls back to the standard draggable macOS titlebar when the custom frame is off", () => {
    const options = mainWindowOptions("darwin", false);
    expect(options).toMatchObject({
      frame: true,
      titleBarStyle: "default",
      minWidth: 800,
      minHeight: 600,
    });
    // hiddenInset without a renderer drag strip leaves no draggable area.
    expect(options.titleBarStyle).not.toBe("hiddenInset");
    expect(options).not.toHaveProperty("trafficLightPosition");
  });

  it("uses native hidden-inset chrome and traffic lights on macOS", () => {
    expect(mainWindowOptions("darwin", true)).toMatchObject({
      frame: true,
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 16 },
      minWidth: 800,
      minHeight: 600,
    });
  });

  it.each(["win32", "linux"] as const)(
    "T41 uses the 940 by 560 minimum and configured custom frame on %s",
    (platform) => {
      expect(mainWindowOptions(platform, true)).toMatchObject({
        frame: false,
        minWidth: 940,
        minHeight: 560,
      });
      expect(mainWindowOptions(platform, false)).toMatchObject({ frame: true });
      expect(mainWindowOptions(platform, true)).not.toHaveProperty("titleBarStyle");
      expect(mainWindowOptions(platform, true)).not.toHaveProperty("trafficLightPosition");
    },
  );
});
