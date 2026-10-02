/** Versioned read-only state of the live main window, not pending preferences. */
export type NativeCapabilities = {
  version: 1;
  platform: NodeJS.Platform;
  customFrame: boolean;
  maximized: boolean;
  fullscreen: boolean;
  appearanceBridge: boolean;
};
