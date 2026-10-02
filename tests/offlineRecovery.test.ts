import { EventEmitter } from "node:events";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installOfflineRecovery, isOfflineCaptionIpc } from "../src/native/offlineRecovery";
import { isTrustedContents, isTrustedIpc, hasConfiguredOrigin } from "../src/native/rendererTrust";
import { registerWindowControlHandlers } from "../src/native/windowControls";
const target = new URL("https://selfhost.example:8443/base?fixed=1");
const file = "/isolated-test/.vite/build/offline.html";
const local = (error = "dns") => `${pathToFileURL(file).href}?error=${error}`;
class Contents extends EventEmitter {
  mainFrame = { url: target.href, detached: false };
  destroyed = false;
  isDestroyed() { return this.destroyed; }
}
class Window extends EventEmitter {
  webContents = new Contents(); visible = true; minimized = false; destroyed = false;
  isVisible() { return this.visible; } isMinimized() { return this.minimized; } isDestroyed() { return this.destroyed; }
  loadURL = vi.fn(async (url: string) => { this.webContents.mainFrame.url = url; if (url.startsWith("file:")) this.webContents.emit("did-finish-load"); });
  minimize = vi.fn(); maximize = vi.fn(); unmaximize = vi.fn(); close = vi.fn(); isMaximized() { return false; }
}
let window: Window;
let dispose: () => void;
function event(owner = window, frame = owner.webContents.mainFrame) { return { sender: owner.webContents, senderFrame: frame } as unknown as Electron.IpcMainEvent; }
function fail(code = -105, url = target.href, main = true) { window.webContents.emit("did-fail-load", {}, code, "failure", url, main); }
async function flush() { await Promise.resolve(); await Promise.resolve(); }
beforeEach(() => { vi.useFakeTimers(); window = new Window(); dispose = installOfflineRecovery(window as unknown as Electron.BrowserWindow, target, file); });
afterEach(() => { dispose(); vi.useRealTimers(); });
describe("real offline recovery wiring", () => {
  it("loads the exact main-owned bundled file on main-frame failure", () => { fail(); expect(window.loadURL).toHaveBeenCalledWith(local()); });
  it.each([[-3,true],[-105,false]] as const)("ignores %s main=%s", (code, main) => { fail(code,target.href,main); expect(window.loadURL).not.toHaveBeenCalled(); });
  it("does not recurse after the bundled file itself fails", () => { fail(); window.loadURL.mockClear(); fail(-6,local()); expect(window.loadURL).not.toHaveBeenCalled(); });
  it("refuses a failed foreign document", () => { fail(-105,"https://attacker.example/"); expect(window.loadURL).not.toHaveBeenCalled(); });
  it("shows server recovery on a real renderer crash", () => { window.webContents.emit("render-process-gone",{}, {reason:"crashed"}); expect(window.loadURL).toHaveBeenCalledWith(local("server")); });
  it.each([400,404,500,503])("handles HTTP %s server failures", code => { window.webContents.emit("did-navigate",{}, target.href, code); expect(window.loadURL).toHaveBeenCalledWith(local("server")); });
  it("does not schedule or reload a successfully loaded app on reconnect/show/restore", () => { window.webContents.emit("did-finish-load"); window.emit("show"); window.emit("restore"); vi.advanceTimersByTime(200000); expect(window.loadURL).not.toHaveBeenCalled(); });
  it("retries the configured URL only, at 5/15/30/60/60 seconds", async () => {
    fail(); await flush();
    for (const delay of [5000,15000,30000,60000,60000]) {
      window.loadURL.mockClear(); await vi.advanceTimersByTimeAsync(delay-1); expect(window.loadURL).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1); expect(window.loadURL).toHaveBeenCalledOnce(); expect(window.loadURL).toHaveBeenCalledWith(target.href);
      fail(); await flush();
    }
  });
  it.each(["hide","minimize"])("pauses while %s and resumes remaining delay", async mode => {
    fail(); await flush(); await vi.advanceTimersByTimeAsync(2000);
    if (mode === "hide") window.visible = false; else window.minimized = true;
    window.emit(mode); window.loadURL.mockClear(); await vi.advanceTimersByTimeAsync(100000); expect(window.loadURL).not.toHaveBeenCalled();
    window.visible = true; window.minimized = false; window.emit(mode === "hide" ? "show" : "restore");
    await vi.advanceTimersByTimeAsync(2999); expect(window.loadURL).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(window.loadURL).toHaveBeenCalledOnce(); expect(window.loadURL).toHaveBeenCalledWith(target.href);
  });
  it("never auto-retries an initially hidden failure", async () => { window.visible = false; fail(); await flush(); window.loadURL.mockClear(); await vi.advanceTimersByTimeAsync(60000); expect(window.loadURL).not.toHaveBeenCalled(); window.visible = true; window.emit("show"); await vi.advanceTimersByTimeAsync(5000); expect(window.loadURL).toHaveBeenCalledOnce(); expect(window.loadURL).toHaveBeenCalledWith(target.href); });
  it("resets backoff and revokes file authority after recovery", async () => { fail(); await flush(); await vi.advanceTimersByTimeAsync(5000); expect(isOfflineCaptionIpc(event(),window)).toBe(false); fail(); await flush(); window.webContents.mainFrame.url = target.href; window.webContents.emit("did-finish-load"); window.loadURL.mockClear(); await vi.advanceTimersByTimeAsync(60000); expect(window.loadURL).not.toHaveBeenCalled(); fail(); await flush(); window.loadURL.mockClear(); await vi.advanceTimersByTimeAsync(5000); expect(window.loadURL).toHaveBeenCalledOnce(); expect(window.loadURL).toHaveBeenCalledWith(target.href); });
  it("binds manual Retry to main config and prevents renderer navigation", async () => { fail(); await flush(); const e = {preventDefault:vi.fn(), frame:window.webContents.mainFrame, initiator:window.webContents.mainFrame, isMainFrame:true}; window.loadURL.mockClear(); window.webContents.emit("will-navigate",e,`${local()}&retry=1`); expect(e.preventDefault).toHaveBeenCalledOnce(); expect(window.loadURL).toHaveBeenCalledOnce(); expect(window.loadURL).toHaveBeenCalledWith(target.href); expect(isOfflineCaptionIpc(event(),window)).toBe(false); });
  it.each(["https://attacker.example/", "file:///else.html", `${local()}&retry=2`, `${local()}&retry=1&target=https://attacker.example/`])("never navigates to renderer-supplied %s", async url => { fail(); await flush(); window.loadURL.mockClear(); const e = {preventDefault:vi.fn(), frame:window.webContents.mainFrame, initiator:window.webContents.mainFrame, isMainFrame:true}; window.webContents.emit("will-navigate",e,url); expect(e.preventDefault).toHaveBeenCalledOnce(); expect(window.loadURL).not.toHaveBeenCalled(); });
  it("refuses subframe-initiated Retry", async () => { fail(); await flush(); window.loadURL.mockClear(); window.webContents.emit("will-navigate",{preventDefault:vi.fn(), frame:window.webContents.mainFrame, initiator:{url:local()}, isMainFrame:true},`${local()}&retry=1`); expect(window.loadURL).not.toHaveBeenCalled(); });
  it("cleans timers, authority, and every owned listener on close", async () => { fail(); await flush(); window.emit("closed"); window.loadURL.mockClear(); expect(isOfflineCaptionIpc(event(),window)).toBe(false); expect(vi.getTimerCount()).toBe(0); fail(); window.webContents.emit("render-process-gone",{}); window.emit("show"); await vi.advanceTimersByTimeAsync(100000); expect(window.loadURL).not.toHaveBeenCalled(); expect(window.webContents.listenerCount("will-navigate")).toBe(0); });
});
describe("exact offline caption authority", () => {
  it.each(["minimise","maximise","close"])("allows %s once only for the active exact file", channel => { fail(); const listeners = new Map<string,(e: Electron.IpcMainEvent)=>void>(); registerWindowControlHandlers({on:(name,fn)=>listeners.set(name,fn)},()=>window,e=>isTrustedIpc(e,window,target)||isOfflineCaptionIpc(e,window)); listeners.get(channel)(event()); expect(window[channel === "minimise" ? "minimize" : channel === "maximise" ? "maximize" : "close"]).toHaveBeenCalledOnce(); });
  it("does not authorize the exact file without main-owned activation", () => { window.webContents.mainFrame.url = local(); expect(isOfflineCaptionIpc(event(),window)).toBe(false); });
  it.each(["file:///isolated-test/.vite/build/else.html", "file:///isolated-test/.vite/build/offline.html.bak", `${local()}#x`, `${local()}&extra=1`, local("arbitrary"), local("tls"), local().replace("offline.html","OFFLINE.html"), local().replace("offline","%6fffline"), local().replace("dns","%64ns"), "null", "data:text/html,offline", "about:blank"])("rejects URL variant %s", url => { fail(); window.webContents.mainFrame.url = url; expect(isOfflineCaptionIpc(event(),window)).toBe(false); });
  it.each(["other contents","subframe","destroyed window","destroyed contents","detached frame","missing window"])("rejects %s", mode => { fail(); const e = { ...event() }; if(mode === "other contents") e.sender = {} as Electron.WebContents; if(mode === "subframe") e.senderFrame = {url:local()} as Electron.WebFrameMain; if(mode === "destroyed window") window.destroyed=true; if(mode === "destroyed contents") window.webContents.destroyed=true; if(mode === "detached frame") window.webContents.mainFrame.detached=true; expect(isOfflineCaptionIpc(e,mode === "missing window" ? undefined : window)).toBe(false); });
  it("never changes general IPC, contents, or configured-origin trust", () => { fail(); expect(isOfflineCaptionIpc(event(),window)).toBe(true); expect(isTrustedIpc(event(),window,target)).toBe(false); expect(isTrustedContents(window.webContents,window,target)).toBe(false); expect(hasConfiguredOrigin(local(),target)).toBe(false); });
});
