import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const frame = { url: "https://app.mutinyapp.gg/channels" };
  const wc = { mainFrame: frame, isDestroyed: () => false, send: vi.fn(), session: { setSpellCheckerEnabled: vi.fn() } };
  return {
    frame, wc,
    on: new Map<string, (...args: unknown[]) => unknown>(),
    handle: new Map<string, (...args: unknown[]) => unknown>(),
    set: vi.fn(), disable: vi.fn(),
    getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
    setLoginItemSettings: vi.fn(),
  };
});
vi.mock("electron", () => ({
  ipcMain: {
    on: (name: string, fn: (...args: unknown[]) => unknown) => fake.on.set(name, fn),
    handle: (name: string, fn: (...args: unknown[]) => unknown) => fake.handle.set(name, fn),
  },
  app: { getLoginItemSettings: fake.getLoginItemSettings, setLoginItemSettings: fake.setLoginItemSettings },
}));
vi.mock("electron-store", () => ({ default: class {
  get() { return false; }
  set = fake.set;
} }));
vi.mock("auto-launch", () => ({ default: class {
  isEnabled = async () => true;
  disable = fake.disable;
} }));
vi.mock("../src/native/window", () => ({
  BUILD_URL: new URL("https://app.mutinyapp.gg"),
  mainWindow: { webContents: fake.wc, isDestroyed: () => false },
}));
vi.mock("../src/native/discordRpc", () => ({ initDiscordRpc: vi.fn(), destroyDiscordRpc: vi.fn() }));
import { config } from "../src/native/config";
import "../src/native/autoLaunch";
const trusted = () => ({ sender: fake.wc, senderFrame: fake.frame });
function listener(map: Map<string, (...args: unknown[]) => unknown>, name: string) {
  const fn = map.get(name);
  if (!fn) throw new Error(`Missing handler ${name}`);
  return fn;
}

const originalPrototype = Object.getPrototypeOf(config);
beforeEach(() => {
  vi.restoreAllMocks(); vi.clearAllMocks();
  fake.frame.url = "https://app.mutinyapp.gg/channels";
  Object.setPrototypeOf(config, originalPrototype);
  for (const key of Object.keys(config)) Reflect.deleteProperty(config, key);
});
describe("config IPC boundary", () => {
  it.each([
    ["other WebContents", () => ({ ...trusted(), sender: {} })],
    ["same-origin subframe", () => ({ ...trusted(), senderFrame: { url: fake.frame.url } })],
    ["missing frame", () => ({ ...trusted(), senderFrame: null as unknown })],
  ])("rejects %s before mutation", (_name, event) => {
    listener(fake.on, "config")(event(), { minimiseToTray: false });
    expect(fake.set).not.toHaveBeenCalled();
  });
  it.each([null, [], "bad", { minimiseToTray: "false" }, { windowState: { isMaximised: 1 } },
    { minimiseToTray: true, unknown: false }, { windowState: { isMaximised: true, extra: true } },
    JSON.parse('{"__proto__":{"polluted":true}}'), { constructor: false }, { sync: false },
  ])("rejects malformed payload %j atomically", (payload) => {
    const sync = config.sync;
    expect(() => listener(fake.on, "config")(trusted(), payload)).not.toThrow();
    expect(fake.set).not.toHaveBeenCalled();
    expect(config.sync).toBe(sync);
    expect(Object.hasOwn(config, "unknown")).toBe(false);
    expect(Object.hasOwn(config, "constructor")).toBe(false);
    expect(Object.getPrototypeOf(config).constructor.name).toBe("Config");
  });
  it("allows legitimate boolean setting", () => {
    vi.spyOn(config, "sync").mockImplementation(() => undefined);
    listener(fake.on, "config")(trusted(), { minimiseToTray: false });
    expect(fake.set).toHaveBeenCalledWith("minimiseToTray", false);
  });
});
describe("offline page has no config or autostart authority", () => {
  it("rejects a valid config mutation from the bundled file", () => {
    fake.frame.url = "file:///isolated-test/.vite/build/offline.html?error=dns";
    listener(fake.on, "config")(trusted(), { minimiseToTray: false });
    expect(fake.set).not.toHaveBeenCalled();
  });
  it.each(["autostart:get", "autostart:set"])("rejects bundled %s", async channel => {
    fake.frame.url = "file:///isolated-test/.vite/build/offline.html?error=dns";
    await expect(listener(fake.handle, channel)(trusted(), true)).rejects.toThrow();
    expect(fake.setLoginItemSettings).not.toHaveBeenCalled(); expect(fake.disable).not.toHaveBeenCalled();
  });
});
describe("autostart IPC boundary", () => {
  it.each(["autostart:get", "autostart:set"])("rejects untrusted %s", async (channel) => {
    await expect(listener(fake.handle, channel)({ sender: {}, senderFrame: fake.frame }, true)).rejects.toThrow();
    expect(fake.setLoginItemSettings).not.toHaveBeenCalled();
  });
  it.each(["false", 0, null, {}, []])("rejects non-boolean %j", async (value) => {
    await expect(listener(fake.handle, "autostart:set")(trusted(), value)).rejects.toThrow();
    expect(fake.setLoginItemSettings).not.toHaveBeenCalled();
  });
  it("reads legacy Windows state without migration or writes", async () => {
    const original = Object.getOwnPropertyDescriptor(process, "platform");
    if (!original) throw new Error("Missing platform descriptor");
    Object.defineProperty(process, "platform", { value: "win32" });
    try {
      expect(await listener(fake.handle, "autostart:get")(trusted())).toBe(true);
      expect(fake.setLoginItemSettings).not.toHaveBeenCalled();
      expect(fake.disable).not.toHaveBeenCalled();
    } finally { Object.defineProperty(process, "platform", original); }
  });
});
