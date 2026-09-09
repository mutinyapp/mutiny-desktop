import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => {
  const frame = { url: "https://selfhost.example:8443/chat" };
  const wc = { mainFrame: frame, isDestroyed: () => false, once: vi.fn(), on: vi.fn() };
  return { frame, wc, window: { webContents: wc, isDestroyed: () => false },
    appEvents: new Map(), handlers: new Map(), permissions: new Map(),
    dialog: vi.fn().mockResolvedValue({ canceled: true }), picker: vi.fn().mockResolvedValue(null) };
});
vi.mock("electron", () => ({
  app: { requestSingleInstanceLock: () => true, setAsDefaultProtocolClient: vi.fn(),
    on: (name: string, fn: unknown) => f.appEvents.set(name, fn),
    getLoginItemSettings: () => ({}), setAppUserModelId: vi.fn() },
  BrowserWindow: {}, shell: {}, systemPreferences: { getMediaAccessStatus: () => "granted" },
  dialog: { showOpenDialog: f.dialog }, ipcMain: { handle: (name: string, fn: unknown) => f.handlers.set(name, fn) },
  session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() },
    setPermissionRequestHandler: (fn: unknown) => f.permissions.set("request", fn),
    setPermissionCheckHandler: (fn: unknown) => f.permissions.set("check", fn),
    setDisplayMediaRequestHandler: (fn: unknown) => f.permissions.set("display", fn) } },
}));
vi.mock("update-electron-app", () => ({ updateElectronApp: vi.fn() }));
vi.mock("electron-squirrel-startup", () => ({ default: false }));
vi.mock("../src/native/autoLaunch", () => ({}));
vi.mock("../src/native/config", () => ({ config: { hardwareAcceleration: true } }));
vi.mock("../src/native/window", () => ({ BUILD_URL: new URL("https://selfhost.example:8443/chat"), mainWindow: f.window, createMainWindow: () => f.window }));
vi.mock("../src/native/screenPicker", () => ({ showScreenPicker: f.picker }));
vi.mock("../src/native/badges", () => ({ initBadges: vi.fn() }));
vi.mock("../src/native/controlServer", () => ({ initControlServer: vi.fn() }));
vi.mock("../src/native/discordRpc", () => ({ initDiscordRpc: vi.fn() }));
vi.mock("../src/native/tray", () => ({ initTray: vi.fn() }));
vi.mock("../src/native/windowControls", () => ({ registerWindowControlHandlers: vi.fn() }));
beforeAll(async () => { await import("../src/main"); await f.appEvents.get("ready")(); });
beforeEach(() => { vi.clearAllMocks(); f.frame.url = "https://selfhost.example:8443/chat"; });
describe("production main native authority", () => {
  it.each(["securityOrigin", "embeddingOrigin"])("rejects conflicting check %s", (key) => {
    expect(f.permissions.get("check")(f.wc, "media", "https://selfhost.example:8443", {
      isMainFrame: true, requestingUrl: f.frame.url, [key]: "https://attacker.example",
    })).toBe(false);
  });
  it("allows matching media securityOrigin", () => {
    expect(f.permissions.get("check")(f.wc, "media", "https://selfhost.example:8443", {
      isMainFrame: true, requestingUrl: f.frame.url, securityOrigin: "https://selfhost.example:8443",
    })).toBe(true);
  });
  it.each([
    ["other contents", {}, true, "https://selfhost.example:8443/chat"],
    ["null contents", null, true, "https://selfhost.example:8443/chat"],
    ["subframe", f.wc, false, "https://selfhost.example:8443/chat"],
    ["other origin", f.wc, true, "https://attacker.example"],
    ["wrong port", f.wc, true, "https://selfhost.example/chat"],
    ["opaque origin", f.wc, true, "data:text/html,hi"],
  ])("denies permission request/check from %s", (_label, wc, isMainFrame, requestingUrl) => {
    const cb = vi.fn();
    const details = { isMainFrame, requestingUrl };
    f.permissions.get("request")(wc, "media", cb, details);
    expect(cb).toHaveBeenCalledWith(false);
    expect(f.permissions.get("check")(wc, "media", requestingUrl, details)).toBe(false);
  });
  it.each(["media", "mediaKeySystem", "display-capture", "notifications"])("allows configured main-frame %s request", (permission) => {
    const cb = vi.fn();
    f.permissions.get("request")(f.wc, permission, cb, { isMainFrame: true, requestingUrl: f.frame.url });
    expect(cb).toHaveBeenCalledWith(true);
  });
  it("allows configured main-frame media check", () => {
    expect(f.permissions.get("check")(f.wc, "media", "https://selfhost.example:8443", { isMainFrame: true, requestingUrl: f.frame.url })).toBe(true);
  });
  it("rejects a navigated owner even when supplied request URL is trusted", () => {
    f.frame.url = "https://attacker.example";
    const cb = vi.fn();
    f.permissions.get("request")(f.wc, "media", cb, { isMainFrame: true, requestingUrl: "https://selfhost.example:8443" });
    expect(cb).toHaveBeenCalledWith(false);
  });
  it.each([null, { url: "https://selfhost.example:8443/chat" }, { url: "https://attacker.example" }])("rejects display frame %j before picker", async (frame) => {
    const cb = vi.fn();
    await f.permissions.get("display")({ frame, securityOrigin: "https://selfhost.example:8443" }, cb);
    expect(f.picker).not.toHaveBeenCalled(); expect(cb).toHaveBeenCalledOnce(); expect(cb).toHaveBeenCalledWith({});
  });
  it("allows trusted display request through user picker", async () => {
    await f.permissions.get("display")({ frame: f.frame, securityOrigin: "https://selfhost.example:8443" }, vi.fn());
    expect(f.picker).toHaveBeenCalledOnce();
  });
  it("rejects audio dialog from same-origin subframe", async () => {
    await expect(f.handlers.get("dialog:openAudioFile")({ sender: f.wc, senderFrame: { url: f.frame.url } })).rejects.toThrow();
    expect(f.dialog).not.toHaveBeenCalled();
  });
  it("allows trusted audio dialog with human cancellation", async () => {
    expect(await f.handlers.get("dialog:openAudioFile")({ sender: f.wc, senderFrame: f.frame })).toBeNull();
    expect(f.dialog).toHaveBeenCalledOnce();
  });
});
