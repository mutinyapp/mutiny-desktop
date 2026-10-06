import { EventEmitter } from "node:events";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PICKER_CANCEL_CHANNEL, PICKER_READY_CHANNEL, PICKER_SELECT_CHANNEL } from "../src/native/screenPickerResult";

const f = vi.hoisted(() => ({ sources: [] as Electron.DesktopCapturerSource[], windows: [] as Picker[], ipc: undefined as EventEmitter, appearance: "dark" as "dark" | "light" }));
class Picker extends EventEmitter {
  webContents = new EventEmitter();
  html = "";
  constructor(readonly options: Electron.BrowserWindowConstructorOptions) { super(); f.windows.push(this); }
  setMenu = vi.fn();
  close = vi.fn(() => this.emit("closed"));
  loadURL = vi.fn(async (url: string) => { this.html = decodeURIComponent(url.split(",").slice(1).join(",")); });
}
vi.mock("electron", () => ({ BrowserWindow: Picker, desktopCapturer: { getSources: async () => f.sources }, ipcMain: f.ipc }));
vi.mock("../src/native/window", () => ({ mainWindow: {} }));
vi.mock("../src/native/config", () => ({ config: { get appearance() { return f.appearance; } } }));
let showScreenPicker: typeof import("../src/native/screenPicker").showScreenPicker;
f.ipc = new EventEmitter();
function source(id: string, name = "Display 1") {
  return { id, name, thumbnail: { toDataURL: () => "data:image/png;base64," }, appIcon: null } as unknown as Electron.DesktopCapturerSource;
}
async function open(sources = [source("screen:1:0")]) {
  f.sources = sources;
  const pending = showScreenPicker();
  await Promise.resolve();
  const picker = f.windows.at(-1);
  if (picker) f.ipc.emit(PICKER_READY_CHANNEL, { sender: picker.webContents });
  return { pending, picker };
}
// Execute the actual emitted script, not a duplicated selection policy.
function controls(picker: Picker) {
  class Element {
    listeners = new Map<string, (event: Record<string, unknown>) => void>();
    dataset: { sourceId?: string } = {};
    disabled = false;
    attributes = new Map<string, string>();
    classList = { toggle: vi.fn() };
    addEventListener(name: string, fn: (event: Record<string, unknown>) => void) { this.listeners.set(name, fn); }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    fire(name: string, event: Record<string, unknown> = {}) { this.listeners.get(name)?.(event); }
  }
  const sources = [...picker.html.matchAll(/data-source-id="([^"]+)"/g)].map(match => {
    const element = new Element(); element.dataset.sourceId = match[1]; return element;
  });
  const cancel = new Element(), share = new Element(), documentEvents = new Element();
  share.disabled = true;
  const bridge = { select: vi.fn(), cancel: vi.fn() };
  runInNewContext(picker.html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    window: { screenPicker: bridge }, document: {
      querySelectorAll: () => sources,
      getElementById: (id: string) => id === "cancel" ? cancel : share,
      addEventListener: documentEvents.addEventListener.bind(documentEvents),
    },
  });
  return { sources, cancel, share, documentEvents, bridge };
}
afterEach(() => { for (const picker of f.windows) picker.close(); });
beforeEach(async () => { vi.clearAllMocks(); f.windows.length = 0; f.appearance = "dark";
  ({ showScreenPicker } = await import("../src/native/screenPicker"));
});
describe("real fallback picker workflow", () => {
  it("returns null without creating a picker for zero sources", async () => {
    f.sources = []; expect(await showScreenPicker()).toBeNull(); expect(f.windows).toHaveLength(0);
  });
  it("always asks even for one source and resolves only after explicit Share", async () => {
    const { pending, picker } = await open();
    expect(picker).toBeDefined();
    if (!picker) return;
    const done = vi.fn(); void pending.then(done);
    await Promise.resolve(); expect(done).not.toHaveBeenCalled();
    const c = controls(picker);
    expect(picker.html).toContain('id="share"');
    expect(c.share.disabled).toBe(true);
    c.sources[0].fire("click");
    expect(c.bridge.select).not.toHaveBeenCalled();
    expect(c.share.disabled).toBe(false);
    expect(c.sources[0].attributes.get("aria-pressed")).toBe("true");
    c.share.fire("click");
    expect(c.bridge.select).toHaveBeenCalledWith("screen:1:0");
    f.ipc.emit(PICKER_SELECT_CHANNEL, { sender: picker.webContents }, "screen:1:0");
    expect(await pending).toBe(f.sources[0]);
  });
  it("keyboard focus selects a source and Enter confirms it", async () => {
    const { pending, picker } = await open([source("screen:1:0"), source("window:2:0")]);
    const c = controls(picker);
    c.sources[1].fire("focus");
    expect(c.bridge.select).not.toHaveBeenCalled();
    c.sources[1].fire("keydown", { key: "Enter", preventDefault: vi.fn() });
    expect(c.bridge.select).toHaveBeenCalledWith("window:2:0");
    f.ipc.emit(PICKER_CANCEL_CHANNEL, { sender: picker.webContents }); await pending;
  });
  it.each(["button", "Escape"])("cancels through %s", async action => {
    const { pending, picker } = await open([source("screen:1:0"), source("window:2:0")]);
    const c = controls(picker);
    if (action === "button") c.cancel.fire("click");
    else c.documentEvents.fire("keydown", { key: "Escape", preventDefault: vi.fn() });
    expect(c.bridge.cancel).toHaveBeenCalledOnce();
    f.ipc.emit(PICKER_CANCEL_CHANNEL, { sender: picker.webContents }); expect(await pending).toBeNull();
  });
  it.each(["dark", "light"] as const)("uses generated %s colours, radii and sandboxed minimum geometry", async appearance => {
    f.appearance = appearance;
    const { pending, picker } = await open([source("screen:1:0"), source("window:2:0")]);
    expect(picker.options).toMatchObject({ minWidth: 520, minHeight: 400, backgroundColor: appearance === "dark" ? "#171522" : "#e7e4df", webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    expect(picker.html).toContain(`--mutiny-accent-focus: ${appearance === "dark" ? "#a899ff" : "#5438df"}`);
    expect(picker.html).toContain("border-radius: 12px");
    expect(picker.html).toContain("prefers-reduced-motion");
    expect(picker.html).not.toContain("transition: all");
    f.ipc.emit(PICKER_CANCEL_CHANNEL, { sender: picker.webContents }); await pending;
  });
  it("escapes hostile source titles and ids while preserving grouping", async () => {
    const { pending, picker } = await open([source('window:1:"<>&', '<img src=x onerror="bad()">'), source("screen:1:0")]);
    expect(picker.html).not.toContain('<img src=x onerror="bad()">');
    expect(picker.html).toContain("&lt;img src=x onerror=&quot;bad()&quot;&gt;");
    expect(picker.html).toContain("Screens"); expect(picker.html).toContain("Windows");
    f.ipc.emit(PICKER_CANCEL_CHANNEL, { sender: picker.webContents }); await pending;
  });
});
