type Frame = { url: string };
type Contents = { mainFrame: Frame; isDestroyed(): boolean };
export type RendererWindow = { isDestroyed(): boolean; webContents: Contents };

// The locally configured HTTP(S) server is the authority, not a renderer URL.
// Preserve explicit --force-server self-hosting, including local HTTP servers.
export function hasConfiguredOrigin(value: string, configured: URL): boolean {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(configured.protocol) &&
      ["https:", "http:"].includes(url.protocol) &&
      !url.username && !url.password && url.origin === configured.origin;
  } catch { return false; }
}

export function isTrustedContents(
  sender: unknown, window: RendererWindow | undefined, configured: URL,
): boolean {
  try {
    return !!window && !window.isDestroyed() && sender === window.webContents &&
      !window.webContents.isDestroyed() &&
      hasConfiguredOrigin(window.webContents.mainFrame.url, configured);
  } catch { return false; }
}

export function isTrustedIpc(
  event: { sender: unknown; senderFrame: unknown },
  window: RendererWindow | undefined,
  configured: URL,
): boolean {
  try {
    return isTrustedContents(event.sender, window, configured) &&
      event.senderFrame === window.webContents.mainFrame;
  } catch { return false; }
}
