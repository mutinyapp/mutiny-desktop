import { pathToFileURL } from "node:url";
import type { BrowserWindow } from "electron";
import { offlineErrorClass, retryDelay, shouldShowOffline } from "./offlinePolicy";
import type { OfflineErrorClass } from "./offlinePolicy";
import { hasConfiguredOrigin } from "./rendererTrust";
import type { RendererWindow } from "./rendererTrust";

// Authority is created only by the main process requesting its emitted file.
// Do not share this exception with any general renderer/permission policy.
const documents = new WeakMap<RendererWindow, string>();
export function isOfflineCaptionIpc(
  event: { sender: unknown; senderFrame: unknown }, window: RendererWindow | undefined,
): boolean {
  try {
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return false;
    const frame = window.webContents.mainFrame as { url: string; detached?: boolean };
    const owned = documents.get(window);
    return !!owned && event.sender === window.webContents && event.senderFrame === frame &&
      !frame.detached && frame.url === owned;
  } catch { return false; }
}

/** Install before the first remote load; the file path and retry URL are main-owned. */
export function installOfflineRecovery(window: BrowserWindow, configured: URL, file: string): () => void {
  const contents = window.webContents;
  const target = configured.href;
  const bundled = pathToFileURL(file).href;
  let active = false;
  let loadingOffline = false;
  let inFlight = false;
  let disposed = false;
  let attempt = 0;
  let remaining = 5000;
  let due = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;

  const alive = () => !disposed && !window.isDestroyed() && !contents.isDestroyed();
  const visible = () => alive() && window.isVisible() && !window.isMinimized();
  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const retry = () => {
    if (!alive() || !active || inFlight) return;
    clearTimer();
    documents.delete(window);
    inFlight = true;
    loadingOffline = false;
    attempt++;
    // Never read a navigation target from a renderer message or URL.
    void Promise.resolve(window.loadURL(target)).catch(() => {
      // did-fail-load handles the exact main-frame failure, including -3.
    });
  };
  const schedule = () => {
    if (!visible() || !active || inFlight || loadingOffline || timer !== undefined) return;
    due = Date.now() + remaining;
    timer = setTimeout(() => {
      timer = undefined;
      if (visible()) retry();
    }, remaining);
  };
  const pause = () => {
    if (timer !== undefined) remaining = Math.max(0, due - Date.now());
    clearTimer();
  };
  const show = (error: OfflineErrorClass) => {
    if (!alive()) return;
    const url = `${bundled}?error=${error}`;
    if (loadingOffline) return;
    clearTimer();
    active = true;
    inFlight = false;
    loadingOffline = true;
    remaining = retryDelay(attempt);
    documents.set(window, url);
    const load = ++generation;
    void Promise.resolve(window.loadURL(url)).catch(error => {
      if (alive() && generation === load) {
        loadingOffline = false;
        documents.delete(window);
        console.error("[mutiny] Bundled offline document failed to load", error);
      }
    });
  };
  const fail = (_event: Electron.Event, code: number, _description: string, url: string, mainFrame: boolean) => {
    if (shouldShowOffline(code, mainFrame) && hasConfiguredOrigin(url, configured)) show(offlineErrorClass(code));
  };
  const crash = () => show("server");
  const navigated = (_event: Electron.Event, url: string, responseCode: number) => {
    if (responseCode >= 400 && hasConfiguredOrigin(url, configured)) show("server");
  };
  const finished = () => {
    if (!alive()) return;
    const url = contents.mainFrame.url;
    if (url === documents.get(window)) {
      loadingOffline = false;
      schedule();
    } else if (!loadingOffline && hasConfiguredOrigin(url, configured)) {
      clearTimer();
      documents.delete(window);
      active = false;
      inFlight = false;
      attempt = 0;
      remaining = 5000;
    }
  };
  const navigate = (event: Electron.Event & { frame?: unknown; initiator?: unknown; isMainFrame?: boolean }, url: string) => {
    if (!active) return;
    // The offline document receives no arbitrary renderer navigation authority.
    event.preventDefault();
    const frame = contents.mainFrame;
    if (event.isMainFrame === true && event.frame === frame && event.initiator === frame &&
      isOfflineCaptionIpc({ sender: contents, senderFrame: frame }, window) &&
      url === `${documents.get(window)}&retry=1`) retry();
  };
  const dispose = () => {
    disposed = true;
    generation++;
    clearTimer();
    documents.delete(window);
    contents.removeListener("did-fail-load", fail);
    contents.removeListener("render-process-gone", crash);
    contents.removeListener("did-navigate", navigated);
    contents.removeListener("did-finish-load", finished);
    contents.removeListener("will-navigate", navigate);
    window.removeListener("hide", pause);
    window.removeListener("minimize", pause);
    window.removeListener("show", schedule);
    window.removeListener("restore", schedule);
    window.removeListener("closed", dispose);
  };
  contents.on("did-fail-load", fail);
  contents.on("render-process-gone", crash);
  contents.on("did-navigate", navigated);
  contents.on("did-finish-load", finished);
  contents.on("will-navigate", navigate);
  window.on("hide", pause);
  window.on("minimize", pause);
  window.on("show", schedule);
  window.on("restore", schedule);
  window.once("closed", dispose);
  return dispose;
}
