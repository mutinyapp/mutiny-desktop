import { expect, it, vi } from "vitest";
import { registerBadgeHandler } from "../src/native/badgesRegistration";
import { registerWindowControlHandlers } from "../src/native/windowControls";
it("rejects window mutations before side effects", () => {
  const listeners = new Map(); const ipc = { on: (name: string, fn: unknown) => listeners.set(name, fn) };
  const window = { minimize: vi.fn(), maximize: vi.fn(), unmaximize: vi.fn(), close: vi.fn(), isDestroyed: () => false, isMaximized: () => false };
  registerWindowControlHandlers(ipc, () => window, () => false);
  for (const name of ["minimise", "maximise", "close"]) listeners.get(name)({});
  expect(window.minimize).not.toHaveBeenCalled(); expect(window.maximize).not.toHaveBeenCalled(); expect(window.close).not.toHaveBeenCalled();
});
it("rejects badge mutations before side effects", () => {
  const listeners = new Map(); const ipc = { on: (name: string, fn: unknown) => listeners.set(name, fn) };
  const set = vi.fn(); registerBadgeHandler(ipc, set, () => false);
  listeners.get("setBadgeCount")({}, 5); expect(set).not.toHaveBeenCalled();
});
