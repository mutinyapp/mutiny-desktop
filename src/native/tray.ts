import { Menu, Tray, dialog, nativeImage } from "electron";

import trayColourAsset from "../../assets/desktop/trayColour.png?asset";
import trayTemplateAsset from "../../assets/desktop/trayTemplate.png?asset";
import trayTemplate2xAsset from "../../assets/desktop/trayTemplate@2x.png?asset";
import { version } from "../../package.json";

import { isTrustedIpc } from "./rendererTrust";
import { trayIconPolicy, trayMenuTemplate } from "./trayPolicy";
import { BUILD_URL, mainWindow, quitApp } from "./window";

let tray: Tray = null;

function createTrayIcon() {
  const policy = trayIconPolicy(process.platform);
  const image = nativeImage.createFromDataURL(
    policy.asset === "template" ? trayTemplateAsset : trayColourAsset,
  );
  if (policy.template) {
    image.addRepresentation({ scaleFactor: 2, dataURL: trayTemplate2xAsset });
  }
  image.setTemplateImage(policy.template);
  return image;
}

function showMutiny() {
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

export function initTray() {
  const trayIcon = createTrayIcon();
  tray = new Tray(trayIcon);
  updateTrayMenu();
  tray.setToolTip("Mutiny for Desktop");
  tray.setImage(trayIcon);
  tray.on("click", showMutiny);
}

function openSettings() {
  // Resolve ownership at action time, not when the tray menu was created.
  const window = mainWindow;
  try {
    if (!window || window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
    const contents = window.webContents;
    const frame = contents.mainFrame;
    if (
      frame.detached ||
      frame.parent ||
      !isTrustedIpc(
        { sender: contents, senderFrame: frame },
        mainWindow,
        BUILD_URL,
      )
    )
      return;
    if (
      window !== mainWindow ||
      contents !== window.webContents ||
      frame !== contents.mainFrame ||
      frame.detached
    )
      return;
    frame.send("protocol-url", "mutiny://settings");
  } catch {
    // Navigation/teardown may replace or detach the captured frame. Fail closed.
  }
}

export function updateTrayMenu() {
  tray.setContextMenu(
    Menu.buildFromTemplate(
      trayMenuTemplate(version, {
        show: showMutiny,
        settings: openSettings,
        about: () => {
          void dialog.showMessageBox(mainWindow, {
            type: "info",
            title: "About Mutiny",
            message: "Mutiny",
            detail: `Version ${version}`,
            buttons: ["OK"],
          });
        },
        quit: quitApp,
      }),
    ),
  );
}
