import { beforeEach, describe, expect, it, vi } from "vitest";

type Capabilities = {
  version: 1; platform: NodeJS.Platform; customFrame: boolean;
  maximized: boolean; fullscreen: boolean; appearanceBridge: boolean;
};
type NativeBridge = {
  platform: NodeJS.Platform;
  getCapabilities(): Promise<Capabilities>;
  onCapabilitiesChanged(callback: (capabilities: Capabilities) => void): () => void;
  minimise(): void; maximise(): void; close(): void;
  setBadgeCount(count: number): void;
  onProtocolUrl(callback: (url: string) => void): () => void;
  openAudioFile(): Promise<unknown>;
};
type ConfigBridge = {
  get(): DesktopConfig | undefined;
  set(config: Partial<DesktopConfig>): void;
  getAutostart(): Promise<boolean>;
};
const f = vi.hoisted(() => ({
  exposed: new Map<string, unknown>(),
  listeners: new Map<string, Set<(...args: unknown[]) => void>>(),
  invoke: vi.fn(), send: vi.fn(), removeListener: vi.fn(),
}));
vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: (name: string, bridge: unknown) => f.exposed.set(name, bridge) },
  ipcRenderer: {
    invoke: f.invoke, send: f.send,
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      if (!f.listeners.has(channel)) f.listeners.set(channel, new Set());
      f.listeners.get(channel).add(listener);
    },
    removeListener: (channel: string, listener: (...args: unknown[]) => void) => {
      f.removeListener(channel, listener);
      f.listeners.get(channel)?.delete(listener);
    },
  },
}));
const capabilities: Capabilities = { version: 1, platform: process.platform,
  customFrame: true, maximized: false, fullscreen: false, appearanceBridge: false };
let native: NativeBridge;
let config: ConfigBridge;
function deliver(channel: string, payload: unknown, event: unknown = {}) {
  for (const listener of f.listeners.get(channel) ?? []) listener(event, payload);
}
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks();
  f.exposed.clear(); f.listeners.clear();
  f.invoke.mockReset();
  f.invoke.mockResolvedValue(capabilities);
  await import("../src/preload");
  native = f.exposed.get("native") as NativeBridge;
  config = f.exposed.get("desktopConfig") as ConfigBridge;
});

describe("preload read-only capability handshake", () => {
  it("fetches from main before the first legacy config push", async () => {
    expect(config.get()).toBeUndefined();
    expect(await native.getCapabilities()).toEqual(capabilities);
    expect(f.invoke).toHaveBeenCalledWith("native:getCapabilities");
    expect(f.send).not.toHaveBeenCalled();
  });
  it("waits for delayed IPC rather than synthesizing an uninitialized cache snapshot", async () => {
    let resolve: (value: Capabilities) => void;
    f.invoke.mockReturnValueOnce(new Promise<Capabilities>((done) => { resolve = done; }));
    const settled = vi.fn();
    const pending = native.getCapabilities().then(settled);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    resolve(capabilities);
    await pending;
    expect(settled).toHaveBeenCalledWith(capabilities);
    expect(config.get()).toBeUndefined();
  });
  it("propagates a rejected handshake instead of claiming false capabilities", async () => {
    f.invoke.mockRejectedValueOnce(new Error("Untrusted capabilities caller"));
    await expect(native.getCapabilities()).rejects.toThrow("Untrusted capabilities caller");
  });
  it("requests a fresh snapshot on every call instead of caching stale window state", async () => {
    expect(await native.getCapabilities()).toEqual(capabilities);
    f.invoke.mockResolvedValueOnce({ ...capabilities, maximized: true, fullscreen: true });
    expect(await native.getCapabilities()).toEqual({ ...capabilities, maximized: true, fullscreen: true });
    expect(f.invoke).toHaveBeenCalledTimes(2);
  });
  it("subscribes without invoking state changes and never exposes the Electron event", () => {
    const callback = vi.fn();
    native.onCapabilitiesChanged(callback);
    const event = { sender: "privileged renderer internals" };
    deliver("native:capabilitiesChanged", capabilities, event);
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(capabilities);
    expect(f.send).not.toHaveBeenCalled();
  });
  it("removes only this subscription and leaves other consumers active", () => {
    const first = vi.fn(), second = vi.fn();
    const unsubscribe = native.onCapabilitiesChanged(first);
    native.onCapabilitiesChanged(second);
    unsubscribe(); unsubscribe();
    deliver("native:capabilitiesChanged", { ...capabilities, maximized: true });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    expect(f.listeners.get("native:capabilitiesChanged").size).toBe(1);
  });
  it("supports independent subscriptions using the same callback", () => {
    const callback = vi.fn();
    const first = native.onCapabilitiesChanged(callback);
    native.onCapabilitiesChanged(callback);
    first();
    deliver("native:capabilitiesChanged", capabilities);
    expect(callback).toHaveBeenCalledOnce();
  });
});

describe("backward-compatible preload bridges", () => {
  it("keeps legacy synchronous get() and config pushes working after the new handshake", async () => {
    await native.getCapabilities();
    const data: DesktopConfig = { firstLaunch: false, customFrame: true,
      minimiseToTray: true, startMinimisedToTray: false, spellchecker: true,
      hardwareAcceleration: true, discordRpc: true, windowState: { isMaximised: false } };
    deliver("config", data);
    expect(config.get()).toEqual(data);
    deliver("config", { ...data, customFrame: false });
    expect(config.get()).toEqual({ ...data, customFrame: false });
  });
  it("does not contaminate the old config cache with capability events", () => {
    deliver("native:capabilitiesChanged", capabilities);
    expect(config.get()).toBeUndefined();
  });
  it("preserves existing window action channels", () => {
    native.minimise(); native.maximise(); native.close(); native.setBadgeCount(3);
    expect(f.send.mock.calls).toEqual([["minimise"], ["maximise"], ["close"], ["setBadgeCount", 3]]);
    expect(native.platform).toBe(process.platform);
  });
  it("preserves config mutations, autostart, and the audio dialog bridge", async () => {
    config.set({ customFrame: false });
    expect(f.send).toHaveBeenCalledWith("config", { customFrame: false });
    await config.getAutostart(); await native.openAudioFile();
    expect(f.invoke.mock.calls).toEqual([["autostart:get"], ["dialog:openAudioFile"]]);
  });
  it("does not remove unrelated protocol listeners when capabilities are unsubscribed", () => {
    const callback = vi.fn();
    native.onProtocolUrl(callback);
    const unsubscribe = native.onCapabilitiesChanged(vi.fn());
    unsubscribe();
    expect(f.listeners.get("protocol-url").size).toBe(2);
  });
});
