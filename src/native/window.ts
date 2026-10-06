import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { BrowserWindow, Menu, app, clipboard, ipcMain, nativeImage } from "electron";

import windowIconAsset from "../../assets/desktop/icon.png?asset";

import type { NativeCapabilities } from "../world/capabilities";
import { config } from "./config";
import { color } from "./generated/native-tokens";
import { nativeSurfaceCSS } from "./generated/surfaceTokens";
import { buildContextMenuTemplate } from "./contextMenuPolicy";
import { isTrustedIpc } from "./rendererTrust";
import { installOfflineRecovery } from "./offlineRecovery";
import { shouldRestoreMaximised } from "./startup";
import { updateTrayMenu } from "./tray";
import { mainWindowOptions } from "./windowOptions";

// global reference to main window
export let mainWindow: BrowserWindow;

// custom-frame setting the current main window was created with
export let mainWindowCustomFrame: boolean | undefined;

// currently in-use build
export const BUILD_URL = new URL(
  app.commandLine.hasSwitch("force-server")
    ? app.commandLine.getSwitchValue("force-server")
    : /*MAIN_WINDOW_VITE_DEV_SERVER_URL ??*/ "https://app.mutinyapp.gg",
);

// internal window state
let shouldQuit = false;
let capabilitiesHandlerRegistered = false;
let appearanceHandlerRegistered = false;
let disposeOfflineRecovery: (() => void) | undefined;

function capabilitiesSnapshot(window: BrowserWindow, customFrame: boolean): NativeCapabilities {
  return {
    version: 1,
    platform: process.platform,
    customFrame,
    maximized: window.isMaximized(),
    fullscreen: window.isFullScreen(),
    appearanceBridge: appearanceHandlerRegistered,
  };
}

// load the window icon
const windowIcon = nativeImage.createFromDataURL(windowIconAsset);

// windowIcon.setTemplateImage(true);

/**
 * Create the main application window
 */
export function createMainWindow(options: { startMinimised?: boolean } = {}) {
  // chrome is fixed for the window's lifetime; the renderer mirrors this
  mainWindowCustomFrame = config.customFrame;

  // create the window
  mainWindow = new BrowserWindow({
    show: !options.startMinimised,
    ...mainWindowOptions(process.platform, mainWindowCustomFrame),
    width: 1280,
    height: 720,
    backgroundColor: color("surface.canvas", config.appearance),
    icon: windowIcon,
    webPreferences: {
      // relative to `.vite/build`
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: config.spellchecker,
    },
  });

  // Install before loading the renderer. Keep one handler across window
  // recreation, but resolve its authority and state from the current owner.
  if (!capabilitiesHandlerRegistered) {
    ipcMain.handle("native:getCapabilities", (event): NativeCapabilities => {
      if (!isTrustedIpc(event, mainWindow, BUILD_URL) || event.senderFrame.detached) {
        throw new Error("Untrusted capabilities caller");
      }
      return capabilitiesSnapshot(mainWindow, mainWindowCustomFrame);
    });
    capabilitiesHandlerRegistered = true;
  }

  if (!appearanceHandlerRegistered) {
    ipcMain.handle("native:setAppearance", (event, appearance: unknown): void => {
      if (!isTrustedIpc(event, mainWindow, BUILD_URL) || event.senderFrame.detached) {
        throw new Error("Untrusted appearance caller");
      }
      if (appearance !== "dark" && appearance !== "light") throw new Error("Invalid appearance");
      config.appearance = appearance;
      mainWindow.setBackgroundColor(color("surface.canvas", appearance));
    });
    appearanceHandlerRegistered = true;
  }

  // Capture this window's actual chrome, never a restart-pending preference.
  const window = mainWindow;
  const customFrame = mainWindowCustomFrame;
  const notifyCapabilities = () => {
    try {
      const frame = window.webContents.mainFrame;
      if (frame.detached || !isTrustedIpc(
        { sender: window.webContents, senderFrame: frame }, mainWindow, BUILD_URL,
      )) return;
      frame.send("native:capabilitiesChanged", capabilitiesSnapshot(window, customFrame));
    } catch {
      // A frame can disappear during navigation or teardown. The next trusted
      // document obtains a fresh snapshot through getCapabilities().
    }
  };
  window.on("maximize", notifyCapabilities);
  window.on("unmaximize", notifyCapabilities);
  window.on("enter-full-screen", notifyCapabilities);
  window.on("leave-full-screen", notifyCapabilities);
  window.once("closed", () => {
    window.removeListener("maximize", notifyCapabilities);
    window.removeListener("unmaximize", notifyCapabilities);
    window.removeListener("enter-full-screen", notifyCapabilities);
    window.removeListener("leave-full-screen", notifyCapabilities);
  });

  // hide the options
  mainWindow.setMenu(null);

  // Restore visible windows to their previous state. Calling maximize() on a
  // hidden BrowserWindow makes it visible, defeating login-to-tray startup.
  if (
    shouldRestoreMaximised(
      config.windowState.isMaximised,
      options.startMinimised === true,
    )
  ) {
    mainWindow.maximize();
  }

  // Install recovery before loading so even the first failure has local controls.
  disposeOfflineRecovery?.();
  disposeOfflineRecovery = installOfflineRecovery(mainWindow, BUILD_URL, join(__dirname, "offline.html"));
  void Promise.resolve(mainWindow.loadURL(BUILD_URL.toString())).catch(() => {
    // Recovery handles main-frame failures; cancelled (-3) loads are ignored.
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, code, description, url) => {
      console.error(`[LOAD FAIL] ${url} — ${code}: ${description}`);
    },
  );
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[LOAD OK] Page finished loading");
  });
  mainWindow.webContents.on("console-message", (_event, _level, message) => {
    console.log(`[RENDERER] ${message}`);
  });

  // minimise window to tray
  mainWindow.on("close", (event) => {
    if (!shouldQuit && config.minimiseToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // update tray menu when window is shown/hidden
  mainWindow.on("show", updateTrayMenu);
  mainWindow.on("hide", updateTrayMenu);

  // keep track of window state
  function generateState() {
    config.windowState = {
      isMaximised: mainWindow.isMaximized(),
    };
  }

  mainWindow.on("maximize", generateState);
  mainWindow.on("unmaximize", generateState);

  // rebind zoom controls to be more sensible
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.control && input.key === "=") {
      // zoom in (+)
      event.preventDefault();
      mainWindow.webContents.setZoomLevel(
        mainWindow.webContents.getZoomLevel() + 1,
      );
    } else if (input.control && input.key === "-") {
      // zoom out (-)
      event.preventDefault();
      mainWindow.webContents.setZoomLevel(
        mainWindow.webContents.getZoomLevel() - 1,
      );
    }
  });

  // Offline styling is a main-owned presentation push, not a file-page IPC grant.
  // Match only this build's bundled path; the caption-only exception stays unchanged.
  window.webContents.on("did-finish-load", () => {
    config.sync();
    try {
      const frame = window.webContents.mainFrame;
      const url = new URL(frame.url);
      url.search = ""; url.hash = "";
      if (window !== mainWindow || window.isDestroyed() || window.webContents.isDestroyed() || frame.detached ||
        url.href !== pathToFileURL(join(__dirname, "offline.html")).href) return;
      void window.webContents.insertCSS(nativeSurfaceCSS(config.appearance)).catch(() => {
        // A disposed document retains the safe generated dark fallback.
      });
    } catch { /* No styling for unavailable/non-bundled documents. */ }
  });

  // context menu: registering this listener replaces Chromium's default menu,
  // so clipboard/link/image/spelling items are built by contextMenuPolicy.
  mainWindow.webContents.on("context-menu", (_, params) => {
    const template = buildContextMenuTemplate(params, (action) => {
      switch (action.kind) {
        case "replaceMisspelling":
          mainWindow.webContents.replaceMisspelling(action.suggestion);
          break;
        case "addToDictionary":
          mainWindow.webContents.session.addWordToSpellCheckerDictionary(
            action.word,
          );
          break;
        case "copyLink":
          void clipboard.writeText(action.url).catch((error) => {
            console.error("Failed to copy link:", error);
          });
          break;
        case "copyImage":
          mainWindow.webContents.copyImageAt(action.x, action.y);
          break;
        case "toggleSpellcheck":
          config.spellchecker = !config.spellchecker;
          break;
      }
    });

    // don't show an empty menu
    if (template.length > 0) {
      Menu.buildFromTemplate(template).popup({ window: mainWindow });
    }
  });

  // mainWindow.webContents.openDevTools();
  return mainWindow;
}

/**
 * Quit the entire app
 */
export function quitApp() {
  shouldQuit = true;
  mainWindow.close();
}

// Ensure global app quit works properly
app.on("before-quit", () => {
  shouldQuit = true;
});
