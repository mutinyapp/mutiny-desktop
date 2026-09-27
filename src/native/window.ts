import { join } from "node:path";

import { BrowserWindow, Menu, app, clipboard, nativeImage } from "electron";

import windowIconAsset from "../../assets/desktop/icon.png?asset";

import { config } from "./config";
import { buildContextMenuTemplate } from "./contextMenuPolicy";
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
    backgroundColor: "#191919",
    icon: windowIcon,
    webPreferences: {
      // relative to `.vite/build`
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: config.spellchecker,
    },
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

  // load the entrypoint
  mainWindow.loadURL(BUILD_URL.toString());

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

  // send the config
  mainWindow.webContents.on("did-finish-load", () => config.sync());

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
          clipboard.writeText(action.url);
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
