import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => {
  const frame = { url: "https://selfhost.example:8443/chat" };
  const wc = { get mainFrame() { return frame; }, isDestroyed: (): boolean => false, once: vi.fn(), on: vi.fn() };
  return { frame, wc, window: { get webContents() { return wc; }, isDestroyed: (): boolean => false },
    hasOwner: true, buildUrl: new URL("https://selfhost.example:8443/chat"),
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
vi.mock("../src/native/window", () => ({ BUILD_URL: f.buildUrl, get mainWindow() { return f.hasOwner ? f.window : undefined; }, createMainWindow: () => f.window }));
vi.mock("../src/native/screenPicker", () => ({ showScreenPicker: f.picker }));
vi.mock("../src/native/badges", () => ({ initBadges: vi.fn() }));
vi.mock("../src/native/controlServer", () => ({ initControlServer: vi.fn() }));
vi.mock("../src/native/discordRpc", () => ({ initDiscordRpc: vi.fn() }));
vi.mock("../src/native/tray", () => ({ initTray: vi.fn() }));
vi.mock("../src/native/windowControls", () => ({ registerWindowControlHandlers: vi.fn() }));
beforeAll(async () => { await import("../src/main"); await f.appEvents.get("ready")(); });
beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks();
  f.dialog.mockResolvedValue({ canceled: true }); f.picker.mockResolvedValue(null);
  f.frame.url = "https://selfhost.example:8443/chat";
  f.buildUrl.href = f.frame.url; f.hasOwner = true;
});
describe("Electron 38 origin-only notification production callback", () => {
  const origin = "https://selfhost.example:8443/";
  const details = () => ({ embeddingOrigin: origin, isMainFrame: false });
  const check = (wc: unknown = null, requestingOrigin: unknown = origin, d: unknown = details(), permission = "notifications") =>
    f.permissions.get("check")(wc, permission, requestingOrigin, d);

  it("accepts the exact pinned GetPermissionStatus null-contents signature", () => {
    expect(check()).toBe(true);
    f.frame.url = `${origin}chat/another-route`;
    expect(check(null, origin.slice(0, -1), { ...details(), embeddingOrigin: origin.slice(0, -1) })).toBe(true);
  });
  it.each([undefined, null, "", "null", "not a URL", "https://attacker.example/", "https://selfhost.example/",
    "http://selfhost.example:8443/", "https://user@selfhost.example:8443/", " https://selfhost.example:8443/",
    "https://selfhost.example:8443/chat", "https://selfhost.example:8443/?x", "https://selfhost.example:8443/#x", 42])(
    "rejects malformed/untrusted/missing embedding origin %j", (embeddingOrigin) => {
      expect(check(null, origin, { ...details(), embeddingOrigin })).toBe(false);
    });
  it.each([null, "", "null", "https://attacker.example/", "https://selfhost.example/", "https://user@selfhost.example:8443/",
    " https://selfhost.example:8443/", "https://selfhost.example:8443/chat"])("rejects invalid requesting origin %j", (requestingOrigin) => {
    expect(check(null, requestingOrigin)).toBe(false);
  });
  it("rejects conflicting optional media securityOrigin", () => {
    expect(check(null, origin, { ...details(), securityOrigin: "https://attacker.example/" })).toBe(false);
  });
  it.each([null, {}, { embeddingOrigin: origin }, { embeddingOrigin: origin, isMainFrame: true },
    { embeddingOrigin: origin, isMainFrame: false, requestingUrl: origin },
    { embeddingOrigin: origin, isMainFrame: false, requestingUrl: "https://attacker.example/" }])(
    "rejects absent/forged frame details %j", (d) => { expect(check(null, origin, d)).toBe(false); });
  it.each([f.wc, {}, { mainFrame: { url: origin } }])("rejects non-null contents notification branches", (wc) => {
    expect(check(wc)).toBe(false);
    expect(check(wc, origin, { ...details(), isMainFrame: true, requestingUrl: f.frame.url })).toBe(false);
  });
  it.each(["media", "mediaKeySystem", "display-capture", "geolocation", "clipboard-read"])("does not grant null-contents %s", (permission) => {
    expect(check(null, origin, details(), permission)).toBe(false);
  });
  it.each(["https://attacker.example/", "https://selfhost.example/chat", "about:blank", ""])("denies navigated owner %s", (url) => {
    f.frame.url = url;
    expect(check()).toBe(false);
  });
  it.each(["http://localhost:8080/base", "http://192.168.1.20:9000/chat", "https://selfhost.example:8443/mutiny"])(
    "preserves configured self-host base path and port %s", (configured) => {
      f.buildUrl.href = configured; f.frame.url = `${configured}/room`;
      const securityOrigin = `${f.buildUrl.origin}/`;
      expect(check(null, securityOrigin, { embeddingOrigin: securityOrigin, isMainFrame: false })).toBe(true);
      expect(check(null, "https://app.mutinyapp.gg/", { embeddingOrigin: securityOrigin, isMainFrame: false })).toBe(false);
    });
  it("denies missing bound owner", () => {
    f.hasOwner = false;
    expect(check()).toBe(false);
  });
  it("denies destroyed owning window", () => {
    vi.spyOn(f.window, "isDestroyed").mockReturnValue(true);
    expect(check()).toBe(false);
  });
  it("denies destroyed owning renderer", () => {
    vi.spyOn(f.wc, "isDestroyed").mockReturnValue(true);
    expect(check()).toBe(false);
  });
  it("denies inaccessible owning contents without throwing", () => {
    vi.spyOn(f.window, "webContents", "get").mockImplementation(() => { throw new Error("disposed"); });
    expect(check()).toBe(false);
  });
  it("denies inaccessible owning frame", () => {
    vi.spyOn(f.wc, "mainFrame", "get").mockImplementation(() => { throw new Error("disposed"); });
    expect(check()).toBe(false);
  });
  it("does not extend origin-only authority to IPC or permission requests", async () => {
    await expect(f.handlers.get("dialog:openAudioFile")({ sender: null, senderFrame: null })).rejects.toThrow();
    const cb = vi.fn();
    f.permissions.get("request")(null, "notifications", cb, details());
    expect(cb).toHaveBeenCalledWith(false);
  });
});

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

describe("offline caption exception never grants production privileges", () => {
  const offline = "file:///isolated-test/.vite/build/offline.html?error=dns";
  it.each(["media", "mediaKeySystem", "display-capture", "notifications", "geolocation", "clipboard-read"])("denies offline %s requests and checks", permission => {
    f.frame.url = offline;
    const cb = vi.fn();
    f.permissions.get("request")(f.wc, permission, cb, {isMainFrame:true, requestingUrl:offline});
    expect(cb).toHaveBeenCalledWith(false);
    expect(f.permissions.get("check")(f.wc, permission, "null", {isMainFrame:true, requestingUrl:offline})).toBe(false);
    expect(f.permissions.get("check")(null, permission, f.buildUrl.origin, {isMainFrame:false, embeddingOrigin:f.buildUrl.origin})).toBe(false);
  });
  it("denies offline audio-file dialogs", async () => {
    f.frame.url = offline;
    await expect(f.handlers.get("dialog:openAudioFile")({sender:f.wc,senderFrame:f.frame})).rejects.toThrow();
    expect(f.dialog).not.toHaveBeenCalled();
  });
  it("denies offline display picking", async () => {
    f.frame.url = offline; const cb = vi.fn();
    await f.permissions.get("display")({frame:f.frame,securityOrigin:"null"},cb);
    expect(cb).toHaveBeenCalledWith({}); expect(f.picker).not.toHaveBeenCalled();
  });
});
