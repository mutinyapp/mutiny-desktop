import AutoLaunch from "auto-launch";
import { app, ipcMain } from "electron";

import {
  disableWindowsAutoLaunch,
  enableWindowsAutoLaunch,
  linuxAutoLaunchOptions,
  windowsAutoLaunchSettings,
} from "./startup";

import { BUILD_URL, mainWindow } from "./window";
import { isTrustedIpc } from "./rendererTrust";

const linuxAutoLaunch = new AutoLaunch(linuxAutoLaunchOptions());
const legacyWindowsAutoLaunch = new AutoLaunch({ name: "Mutiny" });

export const autoLaunch = {
  async isEnabled(): Promise<boolean> {
    if (process.platform === "linux") return linuxAutoLaunch.isEnabled();
    if (process.platform === "win32") {
      return app.getLoginItemSettings(windowsAutoLaunchSettings(process.execPath, true)).openAtLogin ||
        await legacyWindowsAutoLaunch.isEnabled();
    }
    return app.getLoginItemSettings().openAtLogin;
  },

  async enable(): Promise<void> {
    if (process.platform === "linux") return linuxAutoLaunch.enable();
    if (process.platform === "win32") {
      return enableWindowsAutoLaunch(app, legacyWindowsAutoLaunch, process.execPath);
    }
    app.setLoginItemSettings({ openAtLogin: true });
  },

  async disable(): Promise<void> {
    if (process.platform === "linux") return linuxAutoLaunch.disable();
    if (process.platform === "win32") {
      return disableWindowsAutoLaunch(app, legacyWindowsAutoLaunch, process.execPath);
    }
    app.setLoginItemSettings({ openAtLogin: false });
  },
};

ipcMain.handle("autostart:get", async (event): Promise<boolean> => {
  if (!isTrustedIpc(event, mainWindow, BUILD_URL)) throw new Error("Untrusted autostart caller");
  return autoLaunch.isEnabled();
});
ipcMain.handle("autostart:set", async (event, state: unknown): Promise<boolean> => {
  if (!isTrustedIpc(event, mainWindow, BUILD_URL)) throw new Error("Untrusted autostart caller");
  if (typeof state !== "boolean") throw new TypeError("Autostart state must be boolean");
  if (state) {
    await autoLaunch.enable();
  } else {
    await autoLaunch.disable();
  }
  return autoLaunch.isEnabled();
});
