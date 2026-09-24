type MainWindowChromeOptions = Pick<
  Electron.BrowserWindowConstructorOptions,
  | "frame"
  | "titleBarStyle"
  | "trafficLightPosition"
  | "minWidth"
  | "minHeight"
>;

/**
 * Whether the renderer must draw its own draggable titlebar.
 *
 * `windowCustomFrame` is the chrome the live main window was actually created
 * with. Window chrome cannot change without recreating the window, so while a
 * preference toggle is pending relaunch the renderer must keep matching the
 * live window rather than the stored preference; otherwise a hidden-inset or
 * frameless window loses its only drag region.
 */
export function usesCustomFrame(
  _platform: NodeJS.Platform,
  customFrame: boolean,
  windowCustomFrame?: boolean,
): boolean {
  return windowCustomFrame ?? customFrame;
}

export function mainWindowOptions(
  platform: NodeJS.Platform,
  customFrame: boolean,
): MainWindowChromeOptions {
  if (platform === "darwin") {
    if (!customFrame) {
      // The web titlebar is hidden when the custom frame is off, so keep the
      // native macOS titlebar: it provides dragging and double-click-to-zoom.
      return {
        minWidth: 800,
        minHeight: 600,
        frame: true,
        titleBarStyle: "default",
      };
    }

    return {
      minWidth: 800,
      minHeight: 600,
      frame: true,
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 16 },
    };
  }

  return {
    minWidth: 300,
    minHeight: 300,
    frame: !customFrame,
  };
}
