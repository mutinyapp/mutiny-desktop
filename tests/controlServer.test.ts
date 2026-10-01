import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: () => "/tmp" },
}));
const window = vi.hoisted(() => ({
  isDestroyed: vi.fn(() => true),
  show: vi.fn(),
  focus: vi.fn(),
  webContents: { executeJavaScript: vi.fn() },
}));
vi.mock("../src/native/window", () => ({ mainWindow: window }));

import { createControlServer } from "../src/native/controlServer";
import { voiceControlScript } from "../src/native/voiceControl";

const token = "test-token";
let server: ReturnType<typeof createControlServer>;
let baseUrl: string;

beforeEach(async () => {
  vi.clearAllMocks();
  window.isDestroyed.mockReturnValue(true);
  window.webContents.executeJavaScript.mockResolvedValue("clicked:aria");
  server = createControlServer(token);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("Stream Deck HTTP server", () => {
  it("keeps ping unauthenticated and side-effect free", async () => {
    const response = await fetch(`${baseUrl}/ping`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, result: "pong" });
  });

  it("rejects drive-by state-changing GET requests", async () => {
    const response = await fetch(`${baseUrl}/disconnect`);
    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("rejects unauthenticated state-changing POST requests", async () => {
    const response = await fetch(`${baseUrl}/toggle-mute`, { method: "POST" });
    expect(response.status).toBe(401);
  });

  it("rejects browser-originated POST requests even with the token", async () => {
    const response = await fetch(`${baseUrl}/toggle-mute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: "https://evil.example",
        "Sec-Fetch-Site": "cross-site",
      },
    });
    expect(response.status).toBe(403);
  });

  it("accepts an authenticated origin-less local client request", async () => {
    const response = await fetch(`${baseUrl}/toggle-mute`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    // The policy accepted the request; no mocked application window is available.
    expect(response.status).toBe(503);
  });

  it.each([
    ["/toggle-mute", "toggleMute"],
    ["/mute", "toggleMute"],
    ["/toggle-deafen", "toggleDeafen"],
    ["/deafen", "toggleDeafen"],
    ["/disconnect", "disconnect"],
    ["/leave", "disconnect"],
  ] as const)("executes an authorized %s command exactly once and reports its result", async (path, action) => {
    window.isDestroyed.mockReturnValue(false);
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ ok: true, result: "clicked:aria" });
    expect(window.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    expect(window.webContents.executeJavaScript).toHaveBeenCalledWith(voiceControlScript(action));
    expect(window.focus).not.toHaveBeenCalled();
  });

  it("focuses the available window without executing a voice command", async () => {
    window.isDestroyed.mockReturnValue(false);
    const response = await fetch(`${baseUrl}/focus`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    await expect(response.json()).resolves.toEqual({ ok: true, result: "focused" });
    expect(window.show).toHaveBeenCalledTimes(1);
    expect(window.focus).toHaveBeenCalledTimes(1);
    expect(window.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  it("reports unavailable controls as a conflict instead of success", async () => {
    window.isDestroyed.mockReturnValue(false);
    window.webContents.executeJavaScript.mockResolvedValue("not-found");
    const response = await fetch(`${baseUrl}/disconnect`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ ok: false, result: "not-found" });
  });

  it("returns a renderer failure and still serves the next request", async () => {
    window.isDestroyed.mockReturnValue(false);
    window.webContents.executeJavaScript.mockRejectedValueOnce(new Error("synthetic renderer failure"));
    const request = { method: "POST", headers: { Authorization: `Bearer ${token}` } };
    const failed = await fetch(`${baseUrl}/toggle-mute`, request);
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({ ok: false, error: "synthetic renderer failure" });
    const recovered = await fetch(`${baseUrl}/toggle-mute`, request);
    expect(recovered.status).toBe(200);
    expect(window.webContents.executeJavaScript).toHaveBeenCalledTimes(2);
  });

  it("does not execute commands for an invalid token or unknown path", async () => {
    window.isDestroyed.mockReturnValue(false);
    const rejected = await fetch(`${baseUrl}/toggle-mute`, {
      method: "POST", headers: { Authorization: "Bearer invalid" },
    });
    expect(rejected.status).toBe(401);
    const unknown = await fetch(`${baseUrl}/unknown`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    expect(unknown.status).toBe(404);
    expect(window.webContents.executeJavaScript).not.toHaveBeenCalled();
    expect(window.show).not.toHaveBeenCalled();
  });
});
