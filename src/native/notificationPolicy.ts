import { isTrustedContents, type RendererWindow } from "./rendererTrust";

// Security origins are serialized origins, not arbitrary URLs. Electron's GURL
// serialization includes a trailing slash; do not normalize malformed input.
function isConfiguredSecurityOrigin(value: unknown, configured: URL): boolean {
  return (configured.protocol === "https:" || configured.protocol === "http:") &&
    (value === configured.origin || value === `${configured.origin}/`);
}

export function isTrustedNotificationCheck(
  contents: unknown,
  requestingOrigin: unknown,
  details: { isMainFrame?: boolean; requestingUrl?: string; embeddingOrigin?: string; securityOrigin?: string } | null | undefined,
  owner: RendererWindow | undefined,
  configured: URL,
): boolean {
  // Electron 38.1.2 GetPermissionStatus has no RenderFrameHost: null contents,
  // false isMainFrame, embeddingOrigin, and no requestingUrl. This is origin
  // authorization plus live-owner state, NOT proof of a calling frame's identity.
  // Never reuse this exception for IPC, permission requests, or other permissions.
  try {
    return contents === null && !!details && details.isMainFrame === false &&
      details.requestingUrl === undefined &&
      isConfiguredSecurityOrigin(requestingOrigin, configured) &&
      isConfiguredSecurityOrigin(details.embeddingOrigin, configured) &&
      (details.securityOrigin === undefined || isConfiguredSecurityOrigin(details.securityOrigin, configured)) &&
      isTrustedContents(owner?.webContents, owner, configured);
  } catch { return false; }
}
