// Offline integration test: node --test tests/desktopLifecycle.node.mjs (Node 24).
// Run the real main, tray, window, IPC registration and preload with a modeled
// Electron event loop. No Electron binary, native dialogs, servers or network.
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { setImmediate as nextTurn } from "node:timers/promises";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const src = new URL("src/", root).href;
let fixtureId = 0;

function cancelable() {
  return { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
}

async function boot(t, platform = "darwin", { minimiseToTray = true, atLogin = false, link, earlyActivate = false } = {}) {
  const id = `desktopLifecycle${++fixtureId}`;
  const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value: platform });
  const tag = `?fixture=${id}`;
  const config = { hardwareAcceleration: true, customFrame: true, appearance: "dark", spellchecker: true,
    minimiseToTray, startMinimisedToTray: atLogin, windowState: { isMaximised: atLogin }, sync() {} };

  const app = new EventEmitter();
  const ipcMain = new EventEmitter();
  const ipcRenderer = new EventEmitter();
  const windows = [];
  const live = () => windows.filter(window => !window.isDestroyed());
  const renderer = {};
  const dockBadges = [];
  const appBadges = [];
  const protocolClients = [];
  let tray;
  let ready = false;
  let quitting = false;
  let quitCalls = 0;
  let exits = 0;
  let cancelUnload = false;

  Object.assign(app, {
    commandLine: { hasSwitch: () => false }, requestSingleInstanceLock: () => true, isReady: () => ready,
    getLoginItemSettings: () => ({ wasOpenedAtLogin: atLogin }), setAppUserModelId() {},
    setAsDefaultProtocolClient: (...args) => protocolClients.push(args),
    dock: { setBadge: label => dockBadges.push(label) }, setBadgeCount: count => appBadges.push(count),
    quit() {
      quitCalls++;
      const event = cancelable();
      app.emit("before-quit", event);
      if (event.defaultPrevented) return;
      quitting = true;
      for (const window of live()) window.close();
      quitting = false;
      if (!live().length) { app.emit("will-quit", cancelable()); exits++; }
    },
  });
  ipcMain.handle = () => {};

  class Contents extends EventEmitter {
    mainFrame = { url: "about:blank", detached: false };
    destroyed = false;
    sends = [];
    isDestroyed() { return this.destroyed; }
    send(channel, ...args) {
      this.sends.push([channel, ...args]);
      ipcRenderer.emit(channel, {}, ...args);
    }
  }
  const sender = window => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame });
  ipcRenderer.send = (channel, ...args) => ipcMain.emit(channel, sender(live()[0]), ...args);

  class BrowserWindow extends EventEmitter {
    static getAllWindows = live;
    contents = new Contents();
    destroyed = false;
    minimized = false;
    maximized = false;
    focused = 0;
    overlays = [];
    constructor(options) {
      super();
      assert.ok(ready, "Electron cannot construct BrowserWindows before ready");
      this.visible = options.show;
      windows.push(this);
    }
    assertAlive() { if (this.destroyed) throw new Error("Object has been destroyed"); }
    get webContents() { this.assertAlive(); return this.contents; }
    isDestroyed() { return this.destroyed; }
    isVisible() { this.assertAlive(); return this.visible && !this.minimized; }
    isMinimized() { this.assertAlive(); return this.minimized; }
    isMaximized() { return this.maximized; }
    isFullScreen() { return false; }
    focus() { this.assertAlive(); this.focused++; }
    show() { this.assertAlive(); if (!this.visible) { this.visible = true; this.emit("show"); } }
    hide() { this.assertAlive(); if (this.visible) { this.visible = false; this.emit("hide"); } }
    minimize() { this.assertAlive(); this.minimized = true; this.emit("minimize"); }
    restore() { this.assertAlive(); this.minimized = false; this.emit("restore"); }
    maximize() { this.maximized = true; this.emit("maximize"); }
    unmaximize() { this.maximized = false; this.emit("unmaximize"); }
    setMenu() {}
    setOverlayIcon(...args) { this.assertAlive(); this.overlays.push(args); }
    loadURL(url) { this.url = url; return Promise.resolve(); }
    finish() { this.webContents.mainFrame.url = this.url; this.webContents.emit("did-finish-load"); }
    close() {
      this.assertAlive();
      const event = cancelable();
      this.emit("close", event);
      if (event.defaultPrevented || cancelUnload) return;
      this.destroyed = this.contents.destroyed = true;
      this.emit("closed");
      if (!quitting && !live().length) app.emit("window-all-closed");
    }
  }
  class Tray extends EventEmitter {
    constructor() { super(); tray = this; }
    setToolTip() {}
    setImage() {}
    setContextMenu(menu) { this.menu = menu; }
  }
  const image = { resize: () => image, setTemplateImage() {} };
  const display = { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
  const stubs = {
    electron: { app, BrowserWindow, Tray, NativeImage: undefined, Menu: { buildFromTemplate: items => items }, ipcMain, ipcRenderer,
      contextBridge: { exposeInMainWorld: (name, value) => { renderer[name] = value; } },
      screen: { getAllDisplays: () => [display], getPrimaryDisplay: () => display },
      nativeImage: { createFromDataURL: () => image }, clipboard: {}, dialog: {}, shell: {}, systemPreferences: {},
      session: { defaultSession: { webRequest: { onHeadersReceived() {} }, setPermissionRequestHandler() {},
        setPermissionCheckHandler() {}, setDisplayMediaRequestHandler() {} } } },
    "update-electron-app": { updateElectronApp() {} },
    "electron-squirrel-startup": { default: false },
    [src + "native/config.ts"]: { config },
    [src + "native/autoLaunch.ts"]: {},
    [src + "native/controlServer.ts"]: { initControlServer() {} },
    [src + "native/discordRpc.ts"]: { initDiscordRpc() {} },
    [src + "native/screenPicker.ts"]: { showScreenPicker() {} },
    asset: { default: "data:image/png;base64," },
    package: { version: JSON.parse(readFileSync(new URL("package.json", root), "utf8")).version },
  };
  globalThis[id] = stubs;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (!context.parentURL?.endsWith(tag)) return next(specifier, context);
      if (Object.hasOwn(stubs, specifier)) return { url: `stub:${id}:${specifier}`, shortCircuit: true };
      if (!specifier.startsWith(".")) return next(specifier, context);
      if (specifier.endsWith("?asset")) return { url: `stub:${id}:asset`, shortCircuit: true };
      if (specifier.endsWith("package.json")) return { url: `stub:${id}:package`, shortCircuit: true };
      const url = new URL(`${specifier}.ts`, context.parentURL).href;
      return { url: Object.hasOwn(stubs, url) ? `stub:${id}:${url}` : `${url}${tag}`, shortCircuit: true };
    },
    load(url, context, next) {
      const prefix = `stub:${id}:`;
      if (url.startsWith(prefix)) {
        const key = url.slice(prefix.length);
        const reference = `globalThis[${JSON.stringify(id)}][${JSON.stringify(key)}]`;
        const source = Object.keys(stubs[key]).map(name => name === "default" ?
          `export default ${reference}.default;` : `export const ${name} = ${reference}.${name};`).join("\n");
        return { format: "module", source, shortCircuit: true };
      }
      if (!url.startsWith(src) || !url.endsWith(tag)) return next(url, context);
      const file = new URL(url);
      const source = `const __dirname = "/isolated-test/.vite/build";\n${stripTypeScriptTypes(readFileSync(file, "utf8"))}`;
      return { format: "module", source, shortCircuit: true };
    },
  });
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  globalThis.window = new EventTarget();
  t.after(() => {
    hooks.deregister();
    delete globalThis[id];
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete globalThis.window;
    Object.defineProperty(process, "platform", originalPlatform);
  });

  await import(`${src}main.ts${tag}`);
  const openUrl = url => { const event = cancelable(); app.emit("open-url", event, url); assert.ok(event.defaultPrevented); };
  if (link) openUrl(link);
  if (earlyActivate) app.emit("activate");
  ready = true;
  await app.listeners("ready")[0]();
  await import(`${src}world/window.ts${tag}`);
  return { app, config, ipcMain, sender, live, windows, renderer, protocolClients, openUrl, dockBadges, appBadges,
    createAuxiliaryWindow: () => new BrowserWindow({ show: true }),
    cancelUnload: value => { cancelUnload = value; },
    get quitCalls() { return quitCalls; }, get exits() { return exits; },
    trayClick: () => tray.emit("click"),
    menuLabel: () => tray.menu.find(item => /^(Show|Hide) App$/.test(item.label)).label,
    menuClick: label => tray.menu.find(item => item.label === label).click(),
  };
}

for (const entry of ["tray click", "tray Show App", "Dock Activate"]) {
  test(`macOS ${entry} recreates one owned window after close and reuses it`, async t => {
    const f = await boot(t, "darwin", { minimiseToTray: false });
    const reopen = entry === "tray click" ? f.trayClick : entry === "tray Show App" ?
      () => f.menuClick(f.menuLabel()) : () => f.app.emit("activate");
    for (let cycle = 1; cycle <= 2; cycle++) {
      const original = f.live()[0];
      original.close();
      assert.deepEqual(f.live(), []);
      assert.equal(f.quitCalls, 0);
      assert.equal(f.menuLabel(), "Show App");
      reopen();
      const replacement = f.live()[0];
      assert.ok(replacement.isVisible());
      assert.notEqual(original, replacement);
      assert.equal(f.menuLabel(), "Hide App");
      f.trayClick();
      f.app.emit("activate");
      assert.deepEqual(f.live(), [replacement]);
      assert.equal(f.windows.length, cycle + 1);
    }
  });
}

test("macOS Dock Activate waits for ready and keys off the main owner, not auxiliary windows", async t => {
  const f = await boot(t, "darwin", { earlyActivate: true, minimiseToTray: false });
  assert.equal(f.windows.length, 1);
  const original = f.live()[0];
  const auxiliary = f.createAuxiliaryWindow();
  original.close();
  f.app.emit("activate");
  const replacement = f.live().find(window => window !== auxiliary);
  assert.ok(replacement?.isVisible());
  assert.equal(replacement.focused, 1);
  f.trayClick();
  assert.deepEqual(f.live(), [auxiliary, replacement]);
});

for (const state of ["visible", "hidden", "closed"]) {
  test(`macOS tray Quit App exits with the main window ${state}`, async t => {
    const f = await boot(t, "darwin", { minimiseToTray: state !== "closed" });
    if (state !== "visible") f.live()[0].close();
    f.menuClick("Quit App");
    assert.equal(f.quitCalls, 1);
    assert.equal(f.exits, 1);
    assert.deepEqual(f.live(), []);
  });
}

test("a canceled before-quit does not let the next ordinary Close bypass minimise-to-tray", async t => {
  const f = await boot(t);
  const window = f.live()[0];
  f.app.once("before-quit", event => event.preventDefault());
  f.app.quit();
  await nextTurn();
  window.close();
  assert.deepEqual(f.live(), [window]);
  assert.equal(window.isVisible(), false);
  f.menuClick("Show App");
  assert.equal(window.isVisible(), true);
  f.menuClick("Quit App");
  assert.equal(f.exits, 1);
});

test("a renderer canceling Quit leaves ordinary Close as hide-to-tray", async t => {
  const f = await boot(t);
  const window = f.live()[0];
  f.cancelUnload(true);
  f.menuClick("Quit App");
  assert.equal(f.quitCalls, 1);
  assert.equal(f.exits, 0);
  f.cancelUnload(false);
  window.close();
  assert.deepEqual(f.live(), [window]);
  assert.equal(window.isVisible(), false);
});

for (const platform of ["win32", "linux"]) {
  test(`${platform} keeps close-to-tray, tray show/hide and last-window quit`, async t => {
    const f = await boot(t, platform);
    const window = f.live()[0];
    window.finish();
    f.renderer.native.close();
    assert.equal(window.isVisible(), false);
    assert.equal(f.quitCalls, 0);
    f.menuClick("Show App");
    f.menuClick("Hide App");
    f.trayClick();
    assert.ok(window.isVisible());
    assert.equal(window.focused, 1);
    assert.deepEqual(f.live(), [window]);
    f.config.minimiseToTray = false;
    f.renderer.native.close();
    assert.equal(f.quitCalls, 1);
    assert.equal(f.exits, 1);
  });

  test(`${platform} tray Quit App exits even with minimise-to-tray on`, async t => {
    const f = await boot(t, platform);
    f.menuClick("Quit App");
    assert.equal(f.quitCalls, 1);
    assert.equal(f.exits, 1);
  });
}

test("macOS login-to-tray stays hidden until explicitly shown", async t => {
  const f = await boot(t, "darwin", { atLogin: true });
  const window = f.live()[0];
  assert.equal(window.isVisible(), false);
  assert.equal(window.isMaximized(), false);
  f.trayClick();
  assert.ok(window.isVisible());
  assert.deepEqual(f.live(), [window]);
});

test("public protocol bridge forwards cold, warm and tray-replacement links once", async t => {
  const cold = "mutiny://invite/cold";
  const warm = "mutiny://invite/warm";
  const reopened = "mutiny://invite/reopened";
  const f = await boot(t, "darwin", { minimiseToTray: false, link: cold });
  const urls = [];
  const events = [];
  globalThis.window.addEventListener("mutiny-protocol-url", event => events.push(event.detail));
  const unsubscribe = f.renderer.native.onProtocolUrl(url => urls.push(url));
  assert.deepEqual(f.protocolClients, [["mutiny"]]);
  const first = f.live()[0];
  assert.deepEqual(urls, []);
  first.finish();
  f.openUrl(warm);
  f.openUrl("https://example.invalid/not-mutiny");
  assert.deepEqual(urls, [cold, warm]);
  first.close();
  f.openUrl(reopened);
  f.trayClick();
  assert.deepEqual(urls, [cold, warm]);
  const replacement = f.live()[0];
  replacement.finish();
  replacement.finish();
  assert.deepEqual(urls, [cold, warm, reopened]);
  assert.deepEqual(events, urls);
  unsubscribe();
});

for (const platform of ["darwin", "win32", "linux"]) {
  test(`${platform} public badge bridge sets and clears only for the live, trusted owner`, async t => {
    const f = await boot(t, platform, { minimiseToTray: false });
    const owner = f.live()[0];
    const badges = () => platform === "darwin" ? f.dockBadges : platform === "linux" ? f.appBadges :
      owner.overlays.map(([, label]) => label);
    f.renderer.native.setBadgeCount(9); // before the configured origin is loaded
    owner.finish();
    const oldSender = f.sender(owner);
    f.ipcMain.emit("setBadgeCount", { ...oldSender, senderFrame: { url: owner.url } }, 8);
    f.renderer.native.setBadgeCount(2);
    f.renderer.native.setBadgeCount(0);
    assert.deepEqual(badges(), platform === "darwin" ? ["2", ""] : platform === "linux" ? [2, 0] :
      ["2 Notifications", "No Notifications"]);
    if (platform === "darwin") {
      owner.close();
      f.app.emit("activate");
      f.live()[0].finish();
      f.ipcMain.emit("setBadgeCount", oldSender, 7);
      f.renderer.native.setBadgeCount(3);
      assert.deepEqual(badges(), ["2", "", "3"]);
    }
  });
}
