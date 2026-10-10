import { beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => {
  const frame = {
    url: "http://127.0.0.1:49710/home",
    detached: false,
    parent: null as object | null,
    send: vi.fn(),
  };
  const contents = {
    mainFrame: frame,
    isDestroyed: vi.fn(() => false),
    send: vi.fn(),
  };
  const window = {
    webContents: contents,
    isDestroyed: vi.fn(() => false),
    isMinimized: vi.fn(() => true),
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
  };
  return {
    frame,
    contents,
    window,
    current: window,
    menu: [] as Electron.MenuItemConstructorOptions[],
  };
});
vi.mock("electron", () => ({
  Menu: {
    buildFromTemplate: (menu: Electron.MenuItemConstructorOptions[]) => {
      f.menu = menu;
      return menu;
    },
  },
  Tray: class {
    setContextMenu() {}
    setToolTip() {}
    setImage() {}
    on() {}
  },
  nativeImage: {
    createFromDataURL: () => ({
      setTemplateImage() {},
      addRepresentation() {},
    }),
  },
  dialog: { showMessageBox: vi.fn() },
}));
vi.mock("../src/native/window", () => ({
  get mainWindow() {
    return f.current;
  },
  BUILD_URL: new URL("http://127.0.0.1:49710"),
  quitApp: vi.fn(),
}));
async function setup() {
  (await import("../src/native/tray")).initTray();
  return () => f.menu[1].click?.(undefined, undefined, undefined);
}
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  f.current = f.window;
  f.contents.mainFrame = f.frame;
  f.frame.url = "http://127.0.0.1:49710/home";
  f.frame.detached = false;
  f.frame.parent = null;
  f.window.isDestroyed.mockReturnValue(false);
  f.contents.isDestroyed.mockReturnValue(false);
  f.window.isMinimized.mockReturnValue(true);
});
describe("T27 Settings actual tray authorization", () => {
  it("enables Settings and sends literal URL through captured current authorized main frame after restore/show/focus", async () => {
    const click = await setup();
    expect(f.menu[1].enabled).not.toBe(false);
    expect(f.menu[1].click).toBeTypeOf("function");
    click();
    expect(f.window.restore).toHaveBeenCalledOnce();
    expect(f.window.show).toHaveBeenCalledOnce();
    expect(f.window.focus).toHaveBeenCalledOnce();
    expect(f.frame.send).toHaveBeenCalledWith(
      "protocol-url",
      "mutiny://settings",
    );
    expect(f.window.focus.mock.invocationCallOrder[0]).toBeLessThan(
      f.frame.send.mock.invocationCallOrder[0],
    );
    expect(f.contents.send).not.toHaveBeenCalled();
  });
  it.each([
    "https://foreign.invalid/",
    "file:///tmp/offline.html",
    "data:text/html,offline",
    "http://127.0.0.1:49711/home",
    "http://user@127.0.0.1:49710/home",
  ])("refuses document %s using real rendererTrust", async (url) => {
    const click = await setup();
    f.frame.url = url;
    click();
    expect(f.frame.send).not.toHaveBeenCalled();
  });
  it("refuses destroyed window", async () => {
    const click = await setup();
    f.window.isDestroyed.mockReturnValue(true);
    click();
    expect(f.frame.send).not.toHaveBeenCalled();
  });
  it("refuses destroyed contents", async () => {
    const click = await setup();
    f.contents.isDestroyed.mockReturnValue(true);
    click();
    expect(f.frame.send).not.toHaveBeenCalled();
  });
  it("refuses detached main frame", async () => {
    const click = await setup();
    f.frame.detached = true;
    click();
    expect(f.frame.send).not.toHaveBeenCalled();
  });
  it("refuses a subframe masquerading as main", async () => {
    const click = await setup();
    f.frame.parent = {} as never;
    click();
    expect(f.frame.send).not.toHaveBeenCalled();
  });
  it("refuses replaced window during Show", async () => {
    const click = await setup();
    f.window.show.mockImplementationOnce(() => {
      f.current = { ...f.window };
    });
    click();
    expect(f.frame.send).not.toHaveBeenCalled();
  });
  it("refuses stale frame swapped while authorizing", async () => {
    const click = await setup();
    let reads = 0;
    const other = { ...f.frame, send: vi.fn() };
    Object.defineProperty(f.contents, "mainFrame", {
      configurable: true,
      get() {
        return ++reads === 1 ? f.frame : other;
      },
    });
    try {
      click();
      expect(f.frame.send).not.toHaveBeenCalled();
      expect(other.send).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(f.contents, "mainFrame", {
        configurable: true,
        writable: true,
        value: f.frame,
      });
    }
  });
  it("rechecks changed origin on repeated action, then recovers only at configured origin", async () => {
    const click = await setup();
    click();
    f.frame.url = "https://foreign.invalid";
    click();
    expect(f.frame.send).toHaveBeenCalledTimes(1);
    f.frame.url = "http://127.0.0.1:49710/another";
    click();
    expect(f.frame.send).toHaveBeenCalledTimes(2);
  });
  it("fails closed if current frame disappears during teardown", async () => {
    const click = await setup();
    f.frame.send.mockImplementationOnce(() => {
      throw Error("frame gone");
    });
    expect(click).not.toThrow();
  });
});
