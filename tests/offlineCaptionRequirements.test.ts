import { describe, expect, it, vi } from "vitest";

import { isTrustedIpc } from "../src/native/rendererTrust";
import { EventEmitter } from "node:events";
import { installOfflineRecovery, isOfflineCaptionIpc } from "../src/native/offlineRecovery";
import { registerWindowControlHandlers } from "../src/native/windowControls";

const configured = new URL("https://app.mutinyapp.gg");

function fixture(url: string) {
  const frame = { url };
  const contents = Object.assign(new EventEmitter(), { mainFrame: frame, isDestroyed: () => false });
  const window = Object.assign(new EventEmitter(), {
    webContents: contents,
    isDestroyed: () => false,
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    close: vi.fn(),
    isMaximized: () => false,
    isVisible: () => false, isMinimized: () => false,
    loadURL: (value: string) => { frame.url = value; return Promise.resolve(); },
  });
  installOfflineRecovery(window as unknown as Electron.BrowserWindow, configured, "/isolated-test/.vite/build/offline.html");
  if (url.startsWith("file:")) contents.emit("did-fail-load", {}, -105, "DNS", configured.href, true);
  const listeners = new Map<string, (event: Electron.IpcMainEvent) => void>();
  const ipc = {
    on: (channel: string, listener: (event: Electron.IpcMainEvent) => void) => {
      listeners.set(channel, listener);
    },
  };
  registerWindowControlHandlers(ipc, () => window, (event) =>
    isTrustedIpc(event, window, configured) || isOfflineCaptionIpc(event, window),
  );
  const event = { sender: contents, senderFrame: frame } as unknown as Electron.IpcMainEvent;
  return { window, event, listeners };
}

// Original preserved RED requirements now exercised with the exact approved exception.
describe("T17 existing caption-control trust boundary", () => {
  it.each([
    ["minimise", "minimize"],
    ["maximise", "maximize"],
    ["close", "close"],
  ] as const)("T17 requires bundled file controls for %s", (channel, method) => {
    const { window, event, listeners } = fixture(
      "file:///isolated-test/.vite/build/offline.html",
    );
    listeners.get(channel)?.(event);
    expect(window[method]).toHaveBeenCalledOnce();
  });

  it.each([
    ["minimise", "minimize"],
    ["maximise", "maximize"],
    ["close", "close"],
  ] as const)("allows configured main renderer for %s", (channel, method) => {
    const { window, event, listeners } = fixture(configured.toString());
    expect(isTrustedIpc(event, window, configured)).toBe(true);
    listeners.get(channel)?.(event);
    expect(window[method]).toHaveBeenCalledOnce();
  });
});
