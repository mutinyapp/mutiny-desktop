import { EventEmitter } from "node:events";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ writeText: vi.fn(), template: [] as Electron.MenuItemConstructorOptions[], config: { customFrame: true, spellchecker: true, minimiseToTray: true, windowState: { isMaximised: false }, sync: vi.fn() } }));
class TestWindow extends EventEmitter {
  webContents = new EventEmitter();
  setMenu = vi.fn(); loadURL = vi.fn();
}
vi.mock("electron", () => ({ screen: {
  getAllDisplays: () => [{ id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }],
  getPrimaryDisplay: () => ({ id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }),
  getDisplayMatching: () => ({ id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }),
}, BrowserWindow: TestWindow, clipboard: { writeText: f.writeText }, Menu: { buildFromTemplate: (template: Electron.MenuItemConstructorOptions[]) => { f.template = template; return { popup: vi.fn() }; } }, ipcMain: { handle: vi.fn() }, app: { on: vi.fn(), commandLine: { hasSwitch: () => false } }, nativeImage: { createFromDataURL: vi.fn() } }));
vi.mock("../../src/native/config", () => ({ config: f.config }));
vi.mock("../../src/native/tray", () => ({ updateTrayMenu: vi.fn() }));
vi.mock("../../assets/desktop/icon.png?asset", () => ({ default: "data:image/png;base64," }));
let window: TestWindow;
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks();
  const native = await import("../../src/native/window");
  window = native.createMainWindow() as unknown as TestWindow;
});
afterEach(() => vi.restoreAllMocks());
function clickLink(url = "https://example.test/link") {
  window.webContents.emit("context-menu", {}, { linkURL: url, isEditable: false, mediaType: "none", selectionText: "", misspelledWord: "", editFlags: {} });
  const link = f.template.find(item => item.label === "Copy Link");
  expect(link).toBeDefined();
  return link.click as () => void;
}
it("Copy Link handles Electron 44 clipboard rejection without an unhandled promise", async () => {
  const error = new Error("clipboard unavailable");
  let rejectWrite!: (error: Error) => void;
  const write = new Promise<void>((_resolve, reject) => { rejectWrite = reject; });
  f.writeText.mockReturnValue(write);
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  clickLink()();
  rejectWrite(error);
  await Promise.resolve();
  expect(f.writeText).toHaveBeenCalledOnce();
  expect(f.writeText).toHaveBeenCalledWith("https://example.test/link");
  expect(log).toHaveBeenCalledOnce();
  expect(log).toHaveBeenCalledWith("Failed to copy link:", error);
});
it("Copy Link preserves the exact link and completes a successful asynchronous write", async () => {
  let complete: () => void;
  const write = new Promise<void>(resolve => { complete = resolve; });
  const caught = vi.spyOn(write, "catch");
  f.writeText.mockReturnValue(write);
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const url = "https://example.test/path?q=a%20b#part";
  clickLink(url)(); complete(); await write;
  expect(f.writeText).toHaveBeenCalledOnce();
  expect(f.writeText).toHaveBeenCalledWith(url);
  expect(caught).toHaveBeenCalledOnce();
  expect(log).not.toHaveBeenCalled();
});
