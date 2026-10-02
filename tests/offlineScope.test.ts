import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { registerBadgeHandler } from "../src/native/badgesRegistration";
import { isTrustedIpc } from "../src/native/rendererTrust";
const source = readFileSync(join(__dirname, "../src/main.ts"), "utf8");
describe("offline exact production scope", () => {
  it("wires the exception only to the existing caption registration", () => {
    expect(source.match(/isOfflineCaptionIpc\(event, mainWindow\)/g)).toHaveLength(1);
    expect(source).toContain("isTrustedIpc(event, mainWindow, BUILD_URL) || isOfflineCaptionIpc(event, mainWindow)");
  });
  it("does not grant offline badge authority", () => {
    const contents = {mainFrame:{url:"file:///isolated-test/.vite/build/offline.html?error=dns"},isDestroyed:()=>false};
    const window = {webContents:contents,isDestroyed:()=>false};
    const setBadge = vi.fn(); let handler: (event: Electron.IpcMainEvent, count: number)=>void;
    registerBadgeHandler({on:(_name, fn)=>{handler=fn;}},setBadge,e=>isTrustedIpc(e,window,new URL("https://app.mutinyapp.gg")));
    handler({sender:contents,senderFrame:contents.mainFrame} as unknown as Electron.IpcMainEvent,3);
    expect(setBadge).not.toHaveBeenCalled();
  });
  it("adds no broad IPC or protocol bridge to the offline asset", () => {
    const html = readFileSync(join(__dirname, "../assets/desktop/offline/offline.html"),"utf8");
    expect(html).not.toMatch(/ipcRenderer|invoke\(|fetch\(|https?:|mutiny:|getAutostart|setAutostart|setBadgeCount|openAudioFile|desktopConfig\.set/);
    expect(html).toContain("location.href = location.href + \"&retry=1\"");
  });
});
