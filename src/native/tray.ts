import { Menu, Tray, app, nativeImage } from "electron";
import type { BrowserWindow } from "electron";

import trayIconAsset from "../../assets/desktop/icon.png?asset";
import { version } from "../../package.json";

import { getMainWindow } from "./window";

// internal tray state
let tray: Tray | undefined;
let showMainWindow: () => BrowserWindow | undefined;

// Create and resize tray icon for macOS
function createTrayIcon() {
  const image = nativeImage.createFromDataURL(trayIconAsset);
  const resized = image.resize({ width: 20, height: 20 });

  // Mark as template image so it adapts to dark/light mode
  resized.setTemplateImage(true);

  return resized;
}

// trayIcon.setTemplateImage(true);

export function initTray(show: () => BrowserWindow | undefined) {
  showMainWindow = show;
  const trayIcon = createTrayIcon();
  tray = new Tray(trayIcon);
  updateTrayMenu();
  tray.setToolTip("Mutiny for Desktop");
  tray.setImage(trayIcon);
  tray.on("click", () => {
    showMainWindow()?.focus();
  });
}

export function updateTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Mutiny for Desktop", type: "normal", enabled: false },
      {
        label: "Version",
        type: "submenu",
        submenu: Menu.buildFromTemplate([
          {
            label: version,
            type: "normal",
            enabled: false,
          },
        ]),
      },
      { type: "separator" },
      {
        label: getMainWindow()?.isVisible() ? "Hide App" : "Show App",
        type: "normal",
        click() {
          const window = getMainWindow();
          if (window?.isVisible()) {
            window.hide();
          } else {
            showMainWindow();
          }
        },
      },
      {
        label: "Quit App",
        type: "normal",
        click: () => app.quit(),
      },
    ]),
  );
}
