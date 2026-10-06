import { join } from "node:path";

import { BrowserWindow, desktopCapturer, ipcMain } from "electron";

import { config } from "./config";
import { color, nativeTokens, type Scheme } from "./generated/native-tokens";
import { nativeSurfaceCSS } from "./generated/surfaceTokens";
import { mainWindow } from "./window";
import { registerPickerSession } from "./screenPickerResult";

/** The native macOS picker bypasses this fallback when available. */
export async function showScreenPicker(): Promise<Electron.DesktopCapturerSource | null> {
  const sources = await desktopCapturer.getSources({
    types: ["screen", "window"],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: process.platform !== "win32",
  });

  if (sources.length === 0) return null;
  // Always ask, including the single-source/portal case.
  const appearance = config.appearance;
  return new Promise((resolve) => {
    const picker = new BrowserWindow({
      width: 680,
      height: 520,
      minWidth: 520,
      minHeight: 400,
      parent: mainWindow,
      modal: true,
      resizable: true,
      minimizable: false,
      maximizable: false,
      frame: false,
      backgroundColor: color("surface.canvas", appearance),
      webPreferences: {
        preload: join(__dirname, "pickerPreload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    picker.setMenu(null);
    registerPickerSession(ipcMain, picker, sources, resolve);
    const sourceData = sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
      isScreen: source.id.startsWith("screen:"),
    }));
    void picker.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(buildPickerHTML(sourceData, appearance))}`,
    ).catch(() => picker.close());
  });
}

interface SourceInfo {
  id: string;
  name: string;
  thumbnail: string;
  appIcon: string | null;
  isScreen: boolean;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function sourceHTML(source: SourceInfo): string {
  const id = escapeAttribute(source.id), name = escapeAttribute(source.name);
  return `<button class="source" type="button" data-source-id="${id}" title="${name}" aria-pressed="false">
    <img src="${escapeAttribute(source.thumbnail)}" alt="">
    <span class="label">${name}</span>
  </button>`;
}

export function buildPickerHTML(sources: SourceInfo[], appearance: Scheme = "dark"): string {
  const screens = sources.filter((source) => source.isScreen);
  const windows = sources.filter((source) => !source.isScreen);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Share your screen — Mutiny</title>
<style>
  ${nativeSurfaceCSS(appearance)}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    background: var(--mutiny-surface-canvas); color: var(--mutiny-text-primary);
    padding: ${nativeTokens["space.5"]}px; user-select: none;
    height: 100vh; display: flex; flex-direction: column; gap: ${nativeTokens["space.3"]}px;
    -webkit-app-region: drag;
  }
  h2 { font-size: ${nativeTokens["type.size.title"]}px; font-weight: 600; }
  h3 { font-size: ${nativeTokens["type.size.meta"]}px; font-weight: 500; margin: 4px 0 8px; color: var(--mutiny-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
  .sources { flex: 1; min-height: 0; overflow: auto; padding: 3px; -webkit-app-region: no-drag; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px; }
  .source {
    background: var(--mutiny-surface-card); color: inherit; border: 2px solid transparent;
    border-radius: ${nativeTokens["radius.panel"]}px; padding: 8px; cursor: pointer;
    transition: background-color ${nativeTokens["motion.hover"]}ms, border-color ${nativeTokens["motion.hover"]}ms;
    display: flex; flex-direction: column; align-items: center; min-width: 0;
  }
  .source:hover { background: var(--mutiny-surface-raised); }
  .source[aria-pressed="true"] { border-color: var(--mutiny-accent-focus); background: var(--mutiny-surface-selected); }
  .source:focus-visible, .btn:focus-visible { outline: 2px solid var(--mutiny-accent-focus); outline-offset: 1px; }
  .source img { width: 100%; border-radius: ${nativeTokens["radius.xs"]}px; aspect-ratio: 16/9; object-fit: contain; background: var(--mutiny-surface-canvas); }
  .label { margin-top: 6px; font-size: ${nativeTokens["type.size.meta"]}px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; padding: 0 4px; }
  .buttons { display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0; -webkit-app-region: no-drag; }
  .btn { min-height: ${nativeTokens["platform.touchTargetMin"]}px; padding: 8px 20px; border-radius: ${nativeTokens["radius.pill"]}px; border: none; cursor: pointer; font: inherit; font-size: 13px; font-weight: 600; }
  .btn-cancel { background: var(--mutiny-surface-control); color: var(--mutiny-text-primary); }
  .btn-cancel:hover { background: var(--mutiny-surface-raised); }
  .btn-share { background: var(--mutiny-accent-solid); color: var(--mutiny-text-onAccent); }
  .btn:disabled { background: var(--mutiny-surface-control); color: var(--mutiny-text-secondary); cursor: default; }
  @media (prefers-reduced-motion: reduce) { .source { transition: none; } }
</style>
</head>
<body>
  <h2>Share your screen</h2>
  <main class="sources" aria-label="Available screens and windows">
    ${screens.length > 0 ? `<h3>Screens</h3><div class="grid">${screens.map(sourceHTML).join("")}</div>` : ""}
    ${windows.length > 0 ? `<h3>Windows</h3><div class="grid">${windows.map(sourceHTML).join("")}</div>` : ""}
  </main>
  <div class="buttons"><button class="btn btn-cancel" id="cancel" type="button">Cancel</button><button class="btn btn-share" id="share" type="button" disabled>Share</button></div>
<script>
  const elements = [...document.querySelectorAll('[data-source-id]')];
  const share = document.getElementById('share');
  let selected = null;
  function select(element) {
    selected = element.dataset.sourceId;
    elements.forEach(source => source.setAttribute('aria-pressed', String(source === element)));
    share.disabled = false;
  }
  function confirm() { if (selected !== null) window.screenPicker.select(selected); }
  elements.forEach(element => {
    element.addEventListener('click', () => select(element));
    element.addEventListener('focus', () => select(element));
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); select(element); confirm(); }
    });
  });
  share.addEventListener('click', confirm);
  document.getElementById('cancel').addEventListener('click', () => window.screenPicker.cancel());
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); window.screenPicker.cancel(); }
  });
</script>
</body>
</html>`;
}
