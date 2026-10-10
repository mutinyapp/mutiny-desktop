import { EventEmitter } from "node:events";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => ({
  handlers: new Map<string, (event: Electron.IpcMainInvokeEvent, value?: unknown) => unknown>(),
  exposed: new Map<string, unknown>(),
  handle: vi.fn(),
  configured: "https://app.mutinyapp.gg",
  windows: [] as TestWindow[],
  config: {
    appearance: "dark" as "dark" | "light", customFrame: true, spellchecker: true, minimiseToTray: true,
    windowState: { isMaximised: false }, sync: vi.fn(),
  },
}));

class TestFrame {
  url = `${f.configured}/channels`;
  detached = false;
  send = vi.fn();
}
class TestContents extends EventEmitter {
  mainFrame = new TestFrame();
  destroyed = false;
  isDestroyed() { return this.destroyed; }
  send = vi.fn();
  insertCSS = vi.fn().mockResolvedValue("css-key");
}
class TestWindow extends EventEmitter {
  webContents = new TestContents();
  destroyed = false;
  maximized = false;
  fullscreen = false;
  constructor(readonly options: Electron.BrowserWindowConstructorOptions) {
    super();
    f.windows.push(this);
  }
  isDestroyed() { return this.destroyed; }
  isMaximized() { return this.maximized; }
  isFullScreen() { return this.fullscreen; }
  getNormalBounds() { return { x: this.options.x, y: this.options.y, width: this.options.width, height: this.options.height }; }
  setMenu = vi.fn();
  setBackgroundColor = vi.fn();
  maximize() { this.maximized = true; this.emit("maximize"); }
  loadURL = vi.fn();
}
vi.mock("electron", () => ({
  BrowserWindow: TestWindow,
  screen: {
    getAllDisplays: () => [{ id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }],
    getPrimaryDisplay: () => ({ id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }),
    getDisplayMatching: () => ({ id: 1 }),
  },
  contextBridge: { exposeInMainWorld: (name: string, bridge: unknown) => f.exposed.set(name, bridge) },
  ipcRenderer: { on: vi.fn(), send: vi.fn(), invoke: (name: string, value: unknown) =>
    Promise.resolve().then(() => f.handlers.get(name)?.(trusted(), value)) },
  ipcMain: { handle: (channel: string, handler: (event: Electron.IpcMainInvokeEvent, value?: unknown) => unknown) => {
    f.handle(channel);
    if (f.handlers.has(channel)) throw new Error(`Duplicate handler: ${channel}`);
    f.handlers.set(channel, handler);
  } },
  app: { commandLine: {
    hasSwitch: () => f.configured !== "https://app.mutinyapp.gg",
    getSwitchValue: () => f.configured,
  }, on: vi.fn() },
  nativeImage: { createFromDataURL: vi.fn() },
  Menu: {}, clipboard: {},
}));
vi.mock("../src/native/config", () => ({ config: f.config }));
vi.mock("../src/native/tray", () => ({ updateTrayMenu: vi.fn() }));
vi.mock("../assets/desktop/icon.png?asset", () => ({ default: "data:image/png;base64," }));

let native: typeof import("../src/native/window");
let window: TestWindow;
function trusted(owner = window, frame = owner.webContents.mainFrame) {
  return { sender: owner.webContents, senderFrame: frame } as unknown as Electron.IpcMainInvokeEvent;
}
function read(event = trusted()) {
  const handler = f.handlers.get("native:getCapabilities");
  if (!handler) throw new Error("Missing capability handler");
  return handler(event);
}
function snapshot(customFrame = true) {
  return { version: 1, platform: process.platform, customFrame,
    maximized: false, fullscreen: false, appearanceBridge: true };
}
async function create(configured = "https://app.mutinyapp.gg") {
  vi.resetModules();
  f.configured = configured;
  native = await import("../src/native/window");
  native.createMainWindow();
  window = f.windows.at(-1);
}
beforeEach(async () => {
  vi.restoreAllMocks(); vi.clearAllMocks();
  f.handlers.clear(); f.windows.length = 0;
  Object.assign(f.config, { appearance: "dark" as "dark" | "light", customFrame: true, spellchecker: true, minimiseToTray: true,
    windowState: { isMaximised: false } });
  f.config.appearance = "dark"; f.exposed.clear();
  await create();
  await import("../src/world/window");
});

describe("capability handshake through the real main-window setup", () => {
  it("answers before did-finish-load without reading or syncing the legacy renderer cache", () => {
    expect(read()).toEqual(snapshot());
    expect(f.config.sync).not.toHaveBeenCalled();
    expect(window.webContents.send).not.toHaveBeenCalled();
  });
  it("is read-only and returns independent live snapshots on every request", () => {
    const before = { ...f.config, windowState: { ...f.config.windowState } };
    const first = read();
    window.maximized = true; window.fullscreen = true;
    expect(read()).toEqual({ ...snapshot(), maximized: true, fullscreen: true });
    expect(first).toEqual(snapshot());
    expect(f.config).toEqual(before);
  });
  it.each([true, false])("reports actual frame %s rather than the pending preference", (actual) => {
    f.config.customFrame = actual;
    native.createMainWindow();
    window = f.windows.at(-1);
    f.config.customFrame = !actual;
    expect(read()).toEqual(snapshot(actual));
  });
  it("installs exactly one handler and reads the replacement main window", () => {
    const old = window;
    f.config.customFrame = false;
    native.createMainWindow();
    window = f.windows.at(-1);
    window.maximized = true;
    expect(read()).toEqual({ ...snapshot(false), maximized: true });
    expect(f.handle.mock.calls.filter(([name]) => name === "native:getCapabilities")).toHaveLength(1);
    expect(() => read(trusted(old))).toThrow(/Untrusted/);
  });
  it.each([
    ["other WebContents", () => ({ ...trusted(), sender: {} })],
    ["same-origin subframe", () => ({ ...trusted(), senderFrame: new TestFrame() })],
    ["stale frame", () => {
      const stale = window.webContents.mainFrame;
      window.webContents.mainFrame = new TestFrame();
      return trusted(window, stale);
    }],
    ["missing frame", () => ({ ...trusted(), senderFrame: null as unknown })],
    ["origin-only notification signature", () => ({ sender: null as unknown, senderFrame: null as unknown })],
  ])("rejects %s", (_label, event) => {
    expect(() => read(event() as Electron.IpcMainInvokeEvent)).toThrow(/Untrusted/);
  });
  it.each([
    "https://attacker.example/chat", "http://app.mutinyapp.gg/chat",
    "https://app.mutinyapp.gg:8443/chat", "https://user@ app.mutinyapp.gg/chat",
    "https://user@app.mutinyapp.gg/chat", "about:blank", "", "not a URL",
    "file:///bundled/offline.html", "data:text/html,offline",
  ])("denies an untrusted current main-frame URL %s", (url) => {
    window.webContents.mainFrame.url = url;
    expect(() => read()).toThrow(/Untrusted/);
  });
  it.each(["http://localhost:8080/base", "https://selfhost.example:8443/mutiny"])(
    "accepts only the explicitly configured self-hosted origin %s", async (configured) => {
      f.handlers.clear();
      await create(configured);
      expect(read()).toEqual(snapshot());
      window.webContents.mainFrame.url = "https://app.mutinyapp.gg/chat";
      expect(() => read()).toThrow(/Untrusted/);
    },
  );
  it.each(["window", "contents", "detached frame"])("denies destroyed %s", (target) => {
    if (target === "window") window.destroyed = true;
    if (target === "contents") window.webContents.destroyed = true;
    if (target === "detached frame") window.webContents.mainFrame.detached = true;
    expect(() => read()).toThrow(/Untrusted/);
  });
  it("allows a fresh trusted frame after a same-origin reload, not the replaced frame", () => {
    const old = window.webContents.mainFrame;
    window.webContents.mainFrame = new TestFrame();
    window.webContents.mainFrame.url = `${f.configured}/auth`;
    expect(read()).toEqual(snapshot());
    expect(() => read(trusted(window, old))).toThrow(/Untrusted/);
  });
});

describe("appearance bridge through real main-window and preload modules", () => {
  function set(value: unknown, event = trusted()) {
    const handler = f.handlers.get("native:setAppearance");
    if (!handler) throw new Error("Missing appearance handler");
    return handler(event, value);
  }
  it("exposes the method that the capability snapshot advertises", async () => {
    const bridge = f.exposed.get("native") as { setAppearance(value: "dark" | "light"): Promise<void> };
    expect(typeof bridge.setAppearance).toBe("function");
    expect(read()).toMatchObject({ appearanceBridge: true });
    await bridge.setAppearance("light");
    expect(f.config.appearance).toBe("light");
    expect(window.setBackgroundColor).toHaveBeenCalledWith("#e7e4df");
    await bridge.setAppearance("dark");
    expect(window.setBackgroundColor).toHaveBeenLastCalledWith("#171522");
  });
  it.each(["dark", "light"] as const)("starts with the cached %s canvas", (appearance) => {
    f.config.appearance = appearance;
    native.createMainWindow();
    expect(f.windows.at(-1).options.backgroundColor).toBe(appearance === "dark" ? "#171522" : "#e7e4df");
  });
  it.each([undefined, null, "system", "LIGHT", "", 0, false, {}, [], { appearance: "light" }])(
    "rejects invalid appearance %j without side effects", value => {
      expect(() => set(value)).toThrow(/appearance/i);
      expect(f.config.appearance).toBe("dark");
      expect(window.setBackgroundColor).not.toHaveBeenCalled();
    },
  );
  it.each(["subframe", "stale frame", "stale window", "detached", "destroyed window", "destroyed contents", "missing frame", "other contents"])(
    "rejects %s before persistence or repaint", target => {
      let event = trusted();
      if (target === "subframe") event = trusted(window, new TestFrame());
      if (target === "stale frame") window.webContents.mainFrame = new TestFrame();
      if (target === "stale window") native.createMainWindow();
      if (target === "detached") window.webContents.mainFrame.detached = true;
      if (target === "destroyed window") window.destroyed = true;
      if (target === "destroyed contents") window.webContents.destroyed = true;
      if (target === "missing frame") event = { ...event, senderFrame: null };
      if (target === "other contents") event = { ...event, sender: {} } as unknown as Electron.IpcMainInvokeEvent;
      expect(() => set("light", event)).toThrow(/Untrusted/);
      expect(f.config.appearance).toBe("dark");
      for (const owner of f.windows) expect(owner.setBackgroundColor).not.toHaveBeenCalled();
    },
  );
  it.each(["file:///bundled/offline.html?error=dns", "data:text/html,offline", "about:blank", "https://evil.example/", "http://app.mutinyapp.gg/", "https://app.mutinyapp.gg:8443/"])(
    "denies appearance authority to %s", url => {
      window.webContents.mainFrame.url = url;
      expect(() => set("light")).toThrow(/Untrusted/);
      expect(f.config.appearance).toBe("dark");
      expect(window.setBackgroundColor).not.toHaveBeenCalled();
    },
  );
  it("registers one handler and accepts only the replacement owner after recreation", () => {
    const old = window;
    native.createMainWindow(); window = f.windows.at(-1);
    expect(() => set("light", trusted(old))).toThrow(/Untrusted/);
    set("light");
    expect(window.setBackgroundColor).toHaveBeenCalledWith("#e7e4df");
    expect(f.handle.mock.calls.filter(([name]) => name === "native:setAppearance")).toHaveLength(1);
  });
  it("accepts the explicit self-hosted origin but not the default host", async () => {
    f.handlers.clear(); await create("http://localhost:49430/mutiny");
    set("light");
    expect(f.config.appearance).toBe("light");
    window.webContents.mainFrame.url = "https://app.mutinyapp.gg/";
    expect(() => set("dark")).toThrow(/Untrusted/);
    expect(f.config.appearance).toBe("light");
  });
  it("can style only the exact bundled offline file without granting it appearance IPC", () => {
    f.config.appearance = "light";
    window.webContents.mainFrame.url = pathToFileURL(join(__dirname, "../src/native/offline.html")).href + "?error=dns";
    window.webContents.emit("did-finish-load");
    expect(window.webContents.insertCSS).toHaveBeenCalledWith(expect.stringContaining("--mutiny-surface-canvas: #e7e4df"));
    expect(() => set("dark")).toThrow(/Untrusted/);
  });
  it.each(["file:///other/offline.html", "data:text/html,offline", "https://app.mutinyapp.gg/"])(
    "does not inject offline styling into %s", url => {
      window.webContents.mainFrame.url = url;
      window.webContents.emit("did-finish-load");
      expect(window.webContents.insertCSS).not.toHaveBeenCalled();
    },
  );
});

describe("capability change events from main-window state", () => {
  it.each([
    ["maximize", true, false], ["unmaximize", false, false],
    ["enter-full-screen", false, true], ["leave-full-screen", false, false],
  ] as const)("emits the live snapshot once on %s", (event, maximized, fullscreen) => {
    window.maximized = maximized; window.fullscreen = fullscreen;
    window.emit(event);
    expect(window.webContents.mainFrame.send).toHaveBeenCalledOnce();
    expect(window.webContents.mainFrame.send).toHaveBeenCalledWith(
      "native:capabilitiesChanged", { ...snapshot(), maximized, fullscreen },
    );
    expect(window.webContents.send).not.toHaveBeenCalled();
  });
  it("sends to the current frame after reload rather than a cached frame", () => {
    const old = window.webContents.mainFrame;
    window.webContents.mainFrame = new TestFrame();
    window.emit("enter-full-screen");
    expect(old.send).not.toHaveBeenCalled();
    expect(window.webContents.mainFrame.send).toHaveBeenCalledOnce();
  });
  it.each(["about:blank", "file:///bundled/offline.html", "data:text/html,offline", "https://attacker.example/"])(
    "does not emit to an untrusted document %s", (url) => {
      window.webContents.mainFrame.url = url;
      window.emit("enter-full-screen");
      expect(window.webContents.mainFrame.send).not.toHaveBeenCalled();
    },
  );
  it.each(["window", "contents", "detached frame"])("does not emit after destruction of %s", (target) => {
    if (target === "window") window.destroyed = true;
    if (target === "contents") window.webContents.destroyed = true;
    if (target === "detached frame") window.webContents.mainFrame.detached = true;
    window.emit("enter-full-screen");
    expect(window.webContents.mainFrame.send).not.toHaveBeenCalled();
  });
  it("does not emit from a superseded window", () => {
    const old = window;
    native.createMainWindow();
    old.emit("enter-full-screen");
    expect(old.webContents.mainFrame.send).not.toHaveBeenCalled();
  });
  it("removes capability listeners when the owning window closes", () => {
    window.emit("closed");
    window.emit("enter-full-screen"); window.emit("leave-full-screen");
    window.emit("maximize"); window.emit("unmaximize");
    expect(window.webContents.mainFrame.send).not.toHaveBeenCalled();
    expect(window.listenerCount("enter-full-screen")).toBe(0);
    expect(window.listenerCount("leave-full-screen")).toBe(0);
  });
  it("tolerates a frame disappearing between authorization and send", () => {
    window.webContents.mainFrame.send.mockImplementation(() => { throw new Error("Frame was disposed"); });
    expect(() => window.emit("enter-full-screen")).not.toThrow();
  });
  it("emits the actual frame while a restart-dependent preference is pending", () => {
    f.config.customFrame = false;
    window.emit("enter-full-screen");
    expect(window.webContents.mainFrame.send).toHaveBeenCalledWith("native:capabilitiesChanged", snapshot(true));
  });
});
