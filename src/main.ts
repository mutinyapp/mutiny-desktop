import { updateElectronApp } from "update-electron-app";

import { BrowserWindow, app, dialog, ipcMain, session, shell, systemPreferences } from "electron";
import started from "electron-squirrel-startup";

import "./native/autoLaunch";
import { initBadges } from "./native/badges";
import { RENDERER_CONTENT_SECURITY_POLICY } from "./native/contentSecurityPolicy";
import { config } from "./native/config";
import { initControlServer } from "./native/controlServer";
import { initDiscordRpc } from "./native/discordRpc";
import {
  createDisplayMediaRequestHandler,
  displayMediaHandlerOptions,
  openScreenSettingsIfRequested,
  screenPermissionGuidance,
} from "./native/displayMedia";
import { isTrustedNotificationCheck } from "./native/notificationPolicy";
import { showScreenPicker } from "./native/screenPicker";
import { hasConfiguredOrigin, isTrustedContents, isTrustedIpc } from "./native/rendererTrust";
import {
  ProtocolUrlQueue,
  applyFirstLaunchAutostart,
  extractProtocolUrls,
  isLoginItemLaunch,
  shouldStartMinimised,
} from "./native/startup";
import { initTray } from "./native/tray";
import { BUILD_URL, createMainWindow, mainWindow } from "./native/window";
import { registerWindowControlHandlers } from "./native/windowControls";
import { isOfflineCaptionIpc } from "./native/offlineRecovery";

// Squirrel-specific logic
// create/remove shortcuts on Windows when installing / uninstalling
// we just need to close out of the app immediately
if (started) {
  app.quit();
}

// disable hw-accel if so requested
if (!config.hardwareAcceleration) {
  app.disableHardwareAcceleration();
}

// ensure only one copy of the application can run
const protocolUrls = new ProtocolUrlQueue();
const acquiredLock = app.requestSingleInstanceLock();

if (acquiredLock) {
  // Register protocol handler for mutiny:// deep links
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('mutiny', process.execPath, [process.argv[1]]);
    }
  } else {
    app.setAsDefaultProtocolClient('mutiny');
  }

  // Queue protocol URLs until the hosted renderer has finished loading.
  app.on("open-url", (event, url) => {
    event.preventDefault();
    protocolUrls.enqueue(url);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  for (const url of extractProtocolUrls(process.argv)) protocolUrls.enqueue(url);

  // start auto update logic
  updateElectronApp();

  // create and configure the app when electron is ready
  app.on("ready", async () => {
    // Set COOP/COEP headers to enable SharedArrayBuffer for AudioWorklet
    // (required by DeepFilterNet3 noise suppression)
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Cross-Origin-Opener-Policy": ["same-origin"],
          "Cross-Origin-Embedder-Policy": ["require-corp"],
          "Content-Security-Policy": [RENDERER_CONTENT_SECURITY_POLICY],
        },
      });
    });

    // Native file picker for audio files (entrance sounds / soundboard)
    ipcMain.handle("dialog:openAudioFile", async (event) => {
      if (!isTrustedIpc(event, mainWindow, BUILD_URL)) throw new Error("Untrusted audio dialog caller");
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
          {
            name: "Audio Files",
            extensions: ["mp3", "wav", "ogg", "webm", "opus"],
          },
        ],
      });
      if (result.canceled || !isTrustedIpc(event, mainWindow, BUILD_URL)) return null;
      return result.filePaths[0];
    });

    // Grant media permissions for voice chat (microphone, camera, screen share)
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
      const allowed = ["media", "mediaKeySystem", "display-capture", "notifications"];
      callback(allowed.includes(permission) &&
        isTrustedContents(contents, mainWindow, BUILD_URL) &&
        details.isMainFrame === true && hasConfiguredOrigin(details.requestingUrl, BUILD_URL));
    });

    session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details) => {
      if (permission === "notifications") {
        return isTrustedNotificationCheck(contents, requestingOrigin, details, mainWindow, BUILD_URL);
      }
      const allowed = ["media", "mediaKeySystem", "display-capture"];
      return allowed.includes(permission) &&
        isTrustedContents(contents, mainWindow, BUILD_URL) &&
        details.isMainFrame === true && hasConfiguredOrigin(requestingOrigin, BUILD_URL) &&
        hasConfiguredOrigin(details.requestingUrl, BUILD_URL) &&
        (details.securityOrigin === undefined || hasConfiguredOrigin(details.securityOrigin, BUILD_URL)) &&
        (details.embeddingOrigin === undefined || hasConfiguredOrigin(details.embeddingOrigin, BUILD_URL));
    });

    // Prefer the native picker on supported macOS versions. Electron falls
    // back to this handler when the native picker is unavailable.
    session.defaultSession.setDisplayMediaRequestHandler(
      createDisplayMediaRequestHandler({
        authorize: (request) => isTrustedIpc(
          { sender: mainWindow?.webContents, senderFrame: request.frame }, mainWindow, BUILD_URL,
        ) && hasConfiguredOrigin(request.securityOrigin, BUILD_URL),
        platform: process.platform,
        getScreenAccessStatus: () =>
          systemPreferences.getMediaAccessStatus("screen"),
        pickSource: showScreenPicker,
        showPermissionGuidance: async (status) => {
          const result = await dialog.showMessageBox(
            mainWindow,
            screenPermissionGuidance(status),
          );
          await openScreenSettingsIfRequested(status, result.response, shell.openExternal);
        },
      }),
      displayMediaHandlerOptions(process.platform),
    );

    // Apply the one-time autostart default before creating the first window.
    try {
      applyFirstLaunchAutostart(config);
    } catch (error) {
      console.error("[mutiny] Failed to apply the autostart default", error);
    }

    const wasOpenedAtLogin = isLoginItemLaunch(
      process.platform,
      process.argv,
      app.getLoginItemSettings().wasOpenedAtLogin,
    );
    const window = createMainWindow({
      startMinimised: shouldStartMinimised(
        config.startMinimisedToTray,
        wasOpenedAtLogin,
      ),
    });
    window.webContents.once("did-finish-load", () =>
      protocolUrls.rendererReady(window),
    );

    registerWindowControlHandlers(ipcMain, () => mainWindow, (event) =>
      isTrustedIpc(event, mainWindow, BUILD_URL) || isOfflineCaptionIpc(event, mainWindow),
    );
    initBadges();
    initTray();
    initDiscordRpc();
    initControlServer();

    // Windows specific fix for notifications
    if (process.platform === "win32") {
      app.setAppUserModelId("gg.mutinyapp.notifications");
    }
  });

  // Focus the current window and deliver protocol argv from a second process.
  app.on("second-instance", (_event, argv) => {
    for (const url of extractProtocolUrls(argv)) protocolUrls.enqueue(url);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.restore();
      mainWindow.focus();
    }
  });

  // macOS specific behaviour to keep app active in dock:
  // (irrespective of the minimise-to-tray option)

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const window = createMainWindow();
      window.webContents.once("did-finish-load", () =>
        protocolUrls.rendererReady(window),
      );
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // ensure URLs launch in external context
  app.on("web-contents-created", (_, contents) => {
    // prevent navigation out of build URL origin
    contents.on("will-navigate", (event, navigationUrl) => {
      if (new URL(navigationUrl).origin !== BUILD_URL.origin) {
        event.preventDefault();
      }
    });

    // handle links externally
    contents.setWindowOpenHandler(({ url }) => {
      if (
        url.startsWith("http:") ||
        url.startsWith("https:") ||
        url.startsWith("mailto:")
      ) {
        setImmediate(() => {
          shell.openExternal(url);
        });
      }

      return { action: "deny" };
    });
  });
} else {
  app.quit();
}
