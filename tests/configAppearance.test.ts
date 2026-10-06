import { beforeEach, describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ values: new Map<string, unknown>(), set: vi.fn(), handlers: new Map<string, (...args: unknown[]) => unknown>(), send: vi.fn() }));
vi.mock("electron", () => ({ ipcMain: { on: (name: string, handler: (...args: unknown[]) => unknown) => f.handlers.set(name, handler) } }));
vi.mock("electron-store", () => ({ default: class {
  constructor(options: { defaults: Record<string, unknown> }) { for (const [key, value] of Object.entries(options.defaults)) if (!f.values.has(key)) f.values.set(key, value); }
  get(key: string) { return f.values.get(key); }
  set(key: string, value: unknown) { f.set(key, value); f.values.set(key, value); }
} }));
const contents = { mainFrame: { url: "https://app.mutinyapp.gg/chat" }, isDestroyed: () => false, send: f.send };
vi.mock("../src/native/window", () => ({ BUILD_URL: new URL("https://app.mutinyapp.gg"), mainWindowCustomFrame: true, mainWindow: { webContents: contents, isDestroyed: () => false } }));
vi.mock("../src/native/discordRpc", () => ({ initDiscordRpc: vi.fn(), destroyDiscordRpc: vi.fn() }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); f.values.clear(); });
describe("dedicated native appearance persistence", () => {
  it("defaults to dark without exposing appearance in the legacy config cache", async () => {
    const { config } = await import("../src/native/config");
    expect(config.appearance).toBe("dark");
    config.sync();
    expect(f.send.mock.calls[0][1]).not.toHaveProperty("appearance");
  });
  it("persists light and recovers it when the native module is recreated", async () => {
    const { config } = await import("../src/native/config");
    config.appearance = "light";
    expect(f.set).toHaveBeenCalledWith("appearance", "light");
    expect(f.send).not.toHaveBeenCalled();
    vi.resetModules();
    expect((await import("../src/native/config")).config.appearance).toBe("light");
  });
  it.each([undefined, null, "system", 42, {}])("fails back to dark for invalid stored appearance %j", async value => {
    f.values.set("appearance", value);
    expect((await import("../src/native/config")).config.appearance).toBe("dark");
  });
  it.each(["light", "dark"])("refuses appearance %s through the general renderer config allowlist", async value => {
    await import("../src/native/config");
    f.handlers.get("config")({ sender: contents, senderFrame: contents.mainFrame }, { appearance: value });
    expect(f.set).not.toHaveBeenCalled();
  });
  it("schema limits the dedicated stored value to the two modes", async () => {
    const { configSchema } = await import("../src/native/configSchema");
    expect(configSchema.appearance).toEqual({ type: "string", enum: ["dark", "light"] });
  });
});
