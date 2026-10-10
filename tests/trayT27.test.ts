import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const f = vi.hoisted(() => {
  const images: {
    source: string;
    setTemplateImage: ReturnType<typeof vi.fn>;
    addRepresentation: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
  }[] = [];
  const window = {
    isMinimized: vi.fn(() => false),
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    isVisible: vi.fn(() => true),
    hide: vi.fn(),
  };
  return {
    images,
    window,
    quit: vi.fn(),
    about: vi.fn(),
    tray: {
      setToolTip: vi.fn(),
      setImage: vi.fn(),
      setContextMenu: vi.fn(),
      on: vi.fn(),
    },
    buildMenu: vi.fn(
      (template: Electron.MenuItemConstructorOptions[]) => template,
    ),
  };
});
vi.mock("electron", () => ({
  Menu: { buildFromTemplate: f.buildMenu },
  Tray: class {
    constructor() {
      return f.tray;
    }
  },
  dialog: { showMessageBox: f.about },
  nativeImage: {
    createFromDataURL: (source: string) => {
      const image = {
        source,
        setTemplateImage: vi.fn(),
        addRepresentation: vi.fn(),
        resize: vi.fn(),
      };
      image.resize.mockReturnValue(image);
      f.images.push(image);
      return image;
    },
  },
}));
vi.mock("../src/native/window", () => ({
  mainWindow: f.window,
  quitApp: f.quit,
}));

const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
async function init(platform = "darwin") {
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true,
  });
  const module = await import("../src/native/tray");
  module.initTray();
  return module;
}
function menu() {
  return f.tray.setContextMenu.mock.calls.at(
    -1,
  )[0] as Electron.MenuItemConstructorOptions[];
}
function click(item: Electron.MenuItemConstructorOptions) {
  item.click(undefined, undefined, undefined);
}
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  f.images.length = 0;
  f.window.isMinimized.mockReturnValue(false);
});
afterEach(() => Object.defineProperty(process, "platform", platformDescriptor));

describe("T27 actual tray wiring", () => {
  it("uses exact five-item menu, no Hide or version submenu", async () => {
    await init();
    expect(
      menu().map((item) =>
        item.type === "separator" ? "separator" : item.label,
      ),
    ).toEqual([
      "Show Mutiny",
      "Settings",
      "About (1.2.7)",
      "separator",
      "Quit",
    ]);
    expect(menu().every((item) => !item.submenu)).toBe(true);
  });
  it("restores minimized window before Show and focus", async () => {
    await init();
    f.window.isMinimized.mockReturnValue(true);
    click(menu()[0]);
    expect(f.window.restore).toHaveBeenCalledOnce();
    expect(f.window.show).toHaveBeenCalledOnce();
    expect(f.window.focus).toHaveBeenCalledOnce();
    expect(f.window.restore.mock.invocationCallOrder[0]).toBeLessThan(
      f.window.show.mock.invocationCallOrder[0],
    );
    expect(f.window.show.mock.invocationCallOrder[0]).toBeLessThan(
      f.window.focus.mock.invocationCallOrder[0],
    );
    expect(f.window.hide).not.toHaveBeenCalled();
  });
  it("shows and focuses a visible window instead of toggling it hidden", async () => {
    await init();
    click(menu()[0]);
    expect(f.window.restore).not.toHaveBeenCalled();
    expect(f.window.show).toHaveBeenCalledOnce();
    expect(f.window.focus).toHaveBeenCalledOnce();
    expect(f.window.hide).not.toHaveBeenCalled();
  });
  it("tray click also restores then shows and focuses", async () => {
    await init();
    f.window.isMinimized.mockReturnValue(true);
    const handler = f.tray.on.mock.calls.find(
      ([event]) => event === "click",
    )[1];
    handler();
    expect(f.window.restore).toHaveBeenCalledOnce();
    expect(f.window.show).toHaveBeenCalledOnce();
    expect(f.window.focus).toHaveBeenCalledOnce();
    expect(f.window.restore.mock.invocationCallOrder[0]).toBeLessThan(
      f.window.show.mock.invocationCallOrder[0],
    );
  });
  it("exposes real About dialog with current version", async () => {
    await init();
    click(menu()[2]);
    expect(f.about).toHaveBeenCalledWith(
      f.window,
      expect.objectContaining({
        title: "About Mutiny",
        message: "Mutiny",
        detail: "Version 1.2.7",
      }),
    );
  });
  it("Quit reuses existing quitApp ownership", async () => {
    await init();
    click(menu()[4]);
    expect(f.quit).toHaveBeenCalledOnce();
  });
  it("exposes the functioning Settings action, not a disabled placeholder", async () => {
    await init();
    expect(menu()[1].label).toBe("Settings");
    expect(menu()[1].enabled).not.toBe(false);
    expect(menu()[1].click).toBeTypeOf("function");
  });
  it("menu refresh preserves Show action regardless of visibility", async () => {
    const module = await init();
    f.window.isVisible.mockReturnValue(false);
    module.updateTrayMenu();
    expect(menu()[0].label).toBe("Show Mutiny");
  });
  it("macOS selects 16px template plus real 2x representation without resize", async () => {
    await init("darwin");
    expect(f.images[0].source).toContain("trayTemplate.png");
    expect(f.images[0].addRepresentation).toHaveBeenCalledWith({
      scaleFactor: 2,
      dataURL: expect.stringContaining("trayTemplate@2x.png"),
    });
    expect(f.images[0].setTemplateImage).toHaveBeenCalledWith(true);
    expect(f.images[0].resize).not.toHaveBeenCalled();
  });
  it.each(["win32", "linux"])(
    "%s selects colour PNG and explicitly disables template mode",
    async (platform) => {
      await init(platform);
      expect(f.images[0].source).toContain("trayColour.png");
      expect(f.images[0].setTemplateImage).toHaveBeenCalledWith(false);
      expect(f.images[0].addRepresentation).not.toHaveBeenCalled();
      expect(f.images[0].resize).not.toHaveBeenCalled();
    },
  );
  it("initializes tooltip and same icon on tray", async () => {
    await init();
    expect(f.tray.setToolTip).toHaveBeenCalledWith("Mutiny for Desktop");
    expect(f.tray.setImage).toHaveBeenCalledWith(f.images[0]);
  });
});
