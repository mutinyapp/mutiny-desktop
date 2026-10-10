import { EventEmitter } from "node:events";
import { beforeEach, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({
  config: { appearance: "dark", customFrame: true, spellchecker: true, minimiseToTray: true,
    windowState: { isMaximised: false } as DesktopConfig["windowState"], sync: vi.fn() },
  displays: [{ id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
    { id: 2, workArea: { x: -1600, y: 0, width: 1600, height: 900 } }],
}));
class Contents extends EventEmitter {
  mainFrame = { url: "http://127.0.0.1:49720/", detached: false, send: vi.fn() };
  zoom = 0;
  isDestroyed() { return false; }
  getZoomLevel() { return this.zoom; }
  setZoomLevel(value: number) { this.zoom = value; }
}
class Window extends EventEmitter {
  webContents = new Contents(); maximized = false; fullscreen = false; destroyed = false;
  constructor(readonly options: Electron.BrowserWindowConstructorOptions) { super(); }
  isDestroyed() { return this.destroyed; }
  isMaximized() { return this.maximized; }
  isFullScreen() { return this.fullscreen; }
  getNormalBounds() { return { x: this.options.x ?? 100, y: this.options.y ?? 100, width: this.options.width, height: this.options.height }; }
  getBounds() { return this.getNormalBounds(); }
  setMenu = vi.fn(); loadURL = vi.fn(); hide = vi.fn();
  maximize() { this.maximized = true; this.emit("maximize"); }
}
vi.mock("electron", () => ({ BrowserWindow: Window,
  screen: { getAllDisplays: () => f.displays, getPrimaryDisplay: () => f.displays[0], getDisplayMatching: () => f.displays[0] },
  app: { commandLine: { hasSwitch: () => true, getSwitchValue: () => "http://127.0.0.1:49720" }, on: vi.fn() },
  ipcMain: { handle: vi.fn() }, nativeImage: { createFromDataURL: vi.fn() }, Menu: {}, clipboard: {} }));
vi.mock("../src/native/config", () => ({ config: f.config }));
vi.mock("../src/native/tray", () => ({ updateTrayMenu: vi.fn() }));
vi.mock("../assets/desktop/icon.png?asset", () => ({ default: "data:image/png;base64," }));
let native: typeof import("../src/native/window"); let window: Window;
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); f.config.windowState = { isMaximised: false };
  native = await import("../src/native/window");
});
function create() { window = native.createMainWindow() as unknown as Window; }
function key(overrides: Partial<Electron.Input> = {}) {
  const event = { preventDefault: vi.fn() };
  window.webContents.emit("before-input-event", event, {type: "keyDown", key: "=", control: process.platform !== "darwin", meta: process.platform === "darwin", alt: false, shift: false, ...overrides});
  return event;
}
it.each([
  { x: 99999, y: -99999, width: 1040, height: 680 },
  { x: 0, y: 0, width: 99999, height: 99999 },
  { x: 0, y: 0, width: 1, height: 1 },
])("T41 clamps offscreen/oversized/undersized normal geometry %j", bounds => {
  f.config.windowState = { isMaximised: false, normalBounds: bounds, displayId: 1 };
  create(); const b = window.getBounds();
  expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(1920); expect(b.y + b.height).toBeLessThanOrEqual(1080);
  expect(b.width).toBeGreaterThanOrEqual(process.platform === "darwin" ? 800 : 940);
  expect(b.height).toBeGreaterThanOrEqual(process.platform === "darwin" ? 600 : 560);
});
it("T41 restores negative-coordinate secondary display", () => {
  f.config.windowState = { isMaximised: false, normalBounds: { x: -1400, y: 80, width: 1040, height: 680 }, displayId: 2 };
  create(); expect(window.options.x).toBe(-1400); expect(window.options.y).toBe(80);
});
it("T41 removed display returns offscreen bounds to primary", () => {
  f.config.windowState = { isMaximised: false, normalBounds: { x: 9000, y: 9000, width: 1040, height: 680 }, displayId: 999 };
  create(); expect(window.options.x).toBe(880); expect(window.options.y).toBe(400);
});
it.each([null, {}, { x: NaN, y: 0, width: 1000, height: 600 }, { x: 0, y: 0, width: -1, height: 600 }, { x: "1", y: 0, width: 1000, height: 600 }])("T41 malformed saved bounds safely fall back %j", normalBounds => {
  f.config.windowState = { isMaximised: false, normalBounds } as DesktopConfig["windowState"];
  create(); expect(window.options).toMatchObject({ x: 320, y: 180, width: 1280, height: 720 });
});
it("T41 normal bounds restore on real createMainWindow", () => {
  f.config.windowState = { isMaximised: false, normalBounds: { x: 220, y: 140, width: 1040, height: 680 }, displayId: 1 };
  create(); expect(window.options).toMatchObject({ x: 220, y: 140, width: 1040, height: 680 });
});
it("T41 persists normal bounds and display on resize", () => {
  create(); window.emit("resize");
  expect(f.config.windowState).toMatchObject({ normalBounds: window.getNormalBounds(), displayId: 1 });
});
it("T41 does not replace normal geometry while maximized", () => {
  create(); window.emit("resize"); const previous = { ...f.config.windowState };
  // Electron retains normal bounds once maximized; the visible rectangle grows.
  vi.spyOn(window, "getNormalBounds").mockReturnValue(previous.normalBounds);
  window.options.width = 1920; window.options.height = 1080; window.maximized = true; window.emit("maximize"); window.emit("resize");
  expect(f.config.windowState).toEqual({ ...previous, isMaximised: true });
});
it("T41 does not replace normal geometry while fullscreen", () => {
  create(); window.emit("resize"); const previous = { ...f.config.windowState };
  window.options.width = 1920; window.fullscreen = true; window.emit("resize");
  expect(f.config.windowState).toEqual(previous);
});
it.each([
  ["maximize", true, false],
  ["enter-full-screen", false, true],
] as const)("T41 corrects resize-before-flag chronology on %s and fresh hidden restore", (event, maximized, fullscreen) => {
  const normalBounds = { x: 120, y: 115, width: 1040, height: 680 };
  const transient = { x: 9, y: 31, width: 2447, height: 1361 };
  f.config.windowState = { isMaximised: false, normalBounds, displayId: 1 };
  create();
  const bounds = vi.spyOn(window, "getNormalBounds").mockReturnValue(transient);
  // Real macOS animation delivers resize before either state flag changes.
  window.emit("resize"); window.emit("move");
  expect(window.isMaximized()).toBe(false); expect(window.isFullScreen()).toBe(false);
  bounds.mockReturnValue(normalBounds);
  window.maximized = maximized; window.fullscreen = fullscreen; window.emit(event);
  expect(f.config.windowState).toEqual({ normalBounds, displayId: 1, isMaximised: maximized });
  window.emit("resize"); window.emit("move");
  expect(f.config.windowState.normalBounds).toEqual(normalBounds);
  window = native.createMainWindow({ startMinimised: true }) as unknown as Window;
  expect(window.options).toMatchObject({ ...normalBounds, show: false });
  expect(window.isMaximized()).toBe(false);
});
it("T41 removes owned transition persistence callbacks on destruction", () => {
  create();
  const transitions = ["maximize", "unmaximize", "enter-full-screen", "leave-full-screen"];
  for (const event of transitions) expect(window.listenerCount(event)).toBeGreaterThanOrEqual(2);
  window.emit("closed");
  for (const event of transitions) expect(window.listenerCount(event)).toBe(0);
});
it("T41 hidden startup restores bounds without maximizing", () => {
  f.config.windowState = { isMaximised: true, normalBounds: { x: 220, y: 140, width: 1040, height: 680 }, displayId: 1 };
  window = native.createMainWindow({ startMinimised: true }) as unknown as Window;
  expect(window.options.show).toBe(false); expect(window.maximized).toBe(false); expect(window.options.width).toBe(1040);
});
it("T41 old windows cannot overwrite replacement state", () => {
  create(); const old = window; create(); window.emit("resize"); const state = { ...f.config.windowState };
  old.options.width = 1400; old.emit("resize"); expect(f.config.windowState).toEqual(state);
});
it("T41 cleans up owned geometry listeners on close", () => {
  create(); window.emit("closed"); for (const event of ["resize", "move", "maximize", "unmaximize"]) expect(window.listenerCount(event)).toBe(0);
});
it("T41 closed cleanup never dereferences destroyed BrowserWindow contents", () => {
  create(); const contents = window.webContents;
  Object.defineProperty(window, "webContents", { get() { throw new Error("Object has been destroyed"); } });
  expect(() => window.emit("closed")).not.toThrow();
  expect(contents.listenerCount("before-input-event")).toBe(0);
});
it("T41 platform accelerator zooms in", () => { create(); key(); expect(window.webContents.zoom).toBe(1); });
it("T41 shifted plus zooms in", () => { create(); key({ key: "+", shift: true }); expect(window.webContents.zoom).toBe(1); });
it("T41 minus zooms out", () => { create(); key({ key: "-" }); expect(window.webContents.zoom).toBe(-1); });
it("T41 zero resets zoom", () => { create(); window.webContents.zoom = 3; expect(key({ key: "0" }).preventDefault).toHaveBeenCalledOnce(); expect(window.webContents.zoom).toBe(0); });
it.each([
  { type: "keyUp" as const }, { alt: true }, { meta: true, control: true },
  { key: "x" }, { control: false, meta: false }, { key: "0", shift: true }, { key: "-", shift: true },
  { control: process.platform === "darwin", meta: process.platform !== "darwin" },
])("T41 ignores unhandled input %j without prevention", input => {
  create(); const event = key(input); expect(window.webContents.zoom).toBe(0); expect(event.preventDefault).not.toHaveBeenCalled();
});
