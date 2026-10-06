import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
const root = resolve(import.meta.dirname, "../..");
const require = createRequire(join(root, "package.json"));
const { build } = require("esbuild");
const { chromium } = createRequire(process.env.PW_FROM || "/Users/friday/Projects/mutiny-rebuild/wt/T21/package.json")("playwright");
const baseline = process.env.T26_BASELINE_RENDER === "1";
const result = await build({ stdin: { contents: 'export { buildPickerHTML } from "./src/native/screenPicker"; export { nativeSurfaceCSS } from "./src/native/generated/surfaceTokens";', resolveDir: root }, bundle: true, write: false, platform: "node", format: "esm", plugins: [{ name: "isolated-presentation-only", setup(b) {
  b.onResolve({ filter: /^electron$/ }, () => ({ path: "electron", namespace: "fixture" }));
  b.onResolve({ filter: /^\.\/window$/ }, args => args.importer.endsWith("screenPicker.ts") ? { path: "window", namespace: "fixture" } : undefined);
  b.onResolve({ filter: /^\.\/config$/ }, args => args.importer.endsWith("screenPicker.ts") ? { path: "config", namespace: "fixture" } : undefined);
  b.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path === "electron" ? "export const BrowserWindow=class {}; export const desktopCapturer={}; export const ipcMain={};" : args.path === "config" ? 'export const config={appearance:"dark"};' : "export const mainWindow=null;" }));
  if (baseline) b.onLoad({ filter: /\/src\/native\/screenPicker\.ts$/ }, () => ({ contents: execFileSync("git", ["show", "75ac011d:src/native/screenPicker.ts"], { cwd: root, encoding: "utf8" }) + "\nexport { buildPickerHTML };", loader: "ts", resolveDir: join(root, "src/native") }));
} }] });
const modulePath = join(root, "proof/T26/picker-render.mjs");
writeFileSync(modulePath, result.outputFiles[0].contents);
const { buildPickerHTML, nativeSurfaceCSS } = await import(pathToFileURL(modulePath).href + `?baseline=${baseline}`);
const thumbnail = (title, colour) => `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="${colour}"/><rect x="20" y="26" width="280" height="128" rx="10" fill="#fffdfa"/><rect x="20" y="26" width="70" height="128" rx="10" fill="#e5dfed"/><text x="104" y="58" font-family="sans-serif" font-size="13" fill="#171522">${title}</text><path d="M104 82h164M104 102h130M104 122h154" stroke="#cfc9be" stroke-width="5"/></svg>`).toString("base64")}`;
const fixture = [
  { id: "screen:1:0", name: "Display 1", thumbnail: thumbnail("Crew chat", "#23202f"), appIcon: null, isScreen: true },
  { id: "window:2:0", name: "Mutiny — crew chat", thumbnail: thumbnail("Crew chat", "#171522"), appIcon: null, isScreen: false },
  { id: "window:3:0", name: 'A long window title with <markup> & "quotes" that must truncate safely', thumbnail: thumbnail("Project notes", "#f4f1ea"), appIcon: null, isScreen: false },
];
const receipt = { baseline, port: 49430, states: [], requests: [], console: [], pageErrors: [], failures: [] };
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:49430");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (url.pathname === "/offline") res.end(baseline ? execFileSync("git", ["show", "75ac011d:assets/desktop/offline/offline.html"], { cwd: root }) : readFileSync(join(root, "assets/desktop/offline/offline.html")));
  else res.end(buildPickerHTML(url.searchParams.has("one") ? fixture.slice(0, 1) : url.searchParams.has("many") ? Array.from({ length: 30 }, (_, i) => ({ ...fixture[i % fixture.length], id: `window:${i}:0`, isScreen: false })) : fixture, url.searchParams.get("mode") || "dark"));
});
let browser;
try {
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(49430, "127.0.0.1", resolve); });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 680, height: 520 } });
  page.on("request", request => { const url = request.url(); receipt.requests.push(url.startsWith("data:") ? "data:local-fixture" : url); if (!url.startsWith("data:") && !url.startsWith("http://127.0.0.1:49430/")) receipt.failures.push(`external request: ${url}`); });
  page.on("console", msg => { if (["error", "warning"].includes(msg.type())) receipt.console.push({ type: msg.type(), text: msg.text() }); });
  page.on("pageerror", error => receipt.pageErrors.push(error.message));
  page.on("requestfailed", request => receipt.failures.push(request.failure()?.errorText));
  await page.addInitScript(() => {
    window.calls = { share: [], cancel: 0 };
    window.screenPicker = { select: id => window.calls.share.push(id), cancel: () => window.calls.cancel++ };
    window.native = { platform: "win32", minimise() {}, maximise() {}, close() {} };
    window.desktopConfig = { get: () => ({ customFrame: true }) };
  });
  for (const mode of ["dark", "light"]) {
    for (const viewport of [{ width: 680, height: 520 }, { width: 520, height: 400 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`http://127.0.0.1:49430/?mode=${mode}`);
      assert.equal(await page.locator("#share").count(), 1, "explicit Share button is missing");
      assert(await page.locator("#share").isDisabled());
      await page.locator(".source").first().click();
      assert.deepEqual(await page.evaluate(() => window.calls.share), [], "thumbnail selection started capture");
      await page.locator("#share").click();
      assert.deepEqual(await page.evaluate(() => window.calls.share), ["screen:1:0"]);
      const metrics = await page.evaluate(() => ({ viewport: [innerWidth, innerHeight], overflow: document.documentElement.scrollWidth > innerWidth, radius: getComputedStyle(document.querySelector(".source")).borderRadius, canvas: getComputedStyle(document.body).backgroundColor, focus: getComputedStyle(document.documentElement).getPropertyValue("--mutiny-accent-focus").trim(), share: document.getElementById("share").getBoundingClientRect().toJSON() }));
      assert.equal(metrics.overflow, false); assert.equal(metrics.radius, "12px");
      assert.equal(metrics.canvas, mode === "dark" ? "rgb(23, 21, 34)" : "rgb(231, 228, 223)");
      assert.equal(metrics.focus, mode === "dark" ? "#a899ff" : "#5438df");
      assert(metrics.share.y >= 0 && metrics.share.bottom <= viewport.height);
      await page.locator(".source").first().focus();
      const screenshot = `picker-${mode}-${viewport.width}.png`;
      await page.screenshot({ path: join(root, "proof/T26", screenshot) });
      receipt.states.push({ surface: "picker", mode, viewport, metrics, screenshot });
    }
    await page.goto(`http://127.0.0.1:49430/?mode=${mode}&one`);
    await page.keyboard.press("Tab");
    assert.equal(await page.locator(".source").getAttribute("aria-pressed"), "true");
    assert.deepEqual(await page.evaluate(() => window.calls.share), []);
    await page.keyboard.press("Enter");
    assert.deepEqual(await page.evaluate(() => window.calls.share), ["screen:1:0"]);
    await page.keyboard.press("Escape"); assert.equal(await page.evaluate(() => window.calls.cancel), 1);
    await page.locator("#cancel").click(); assert.equal(await page.evaluate(() => window.calls.cancel), 2);
    await page.goto(`http://127.0.0.1:49430/?mode=${mode}&many`);
    await page.locator(".source").last().focus(); await page.keyboard.press("Enter");
    assert.deepEqual(await page.evaluate(() => window.calls.share), ["window:29:0"]);
    assert(await page.locator("#cancel").isVisible()); assert(await page.locator("#share").isVisible());
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await page.locator(".source").first().evaluate(node => getComputedStyle(node).transitionDuration), "0s");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto("http://127.0.0.1:49430/offline?error=dns");
    // Actual main-owned CSS adapter, not an appearance IPC from the local page.
    await page.addStyleTag({ content: nativeSurfaceCSS(mode) });
    const offline = await page.locator("main").evaluate(node => ({ canvas: getComputedStyle(node).backgroundColor, text: getComputedStyle(node).color }));
    assert.equal(offline.canvas, mode === "dark" ? "rgb(23, 21, 34)" : "rgb(231, 228, 223)");
    assert.equal(offline.text, mode === "dark" ? "rgb(255, 253, 250)" : "rgb(23, 21, 34)");
    const screenshot = `offline-${mode}.png`;
    await page.screenshot({ path: join(root, "proof/T26", screenshot) });
    receipt.states.push({ surface: "offline", mode, viewport: { width: 800, height: 600 }, metrics: offline, screenshot });
  }
  assert.deepEqual(receipt.console, []); assert.deepEqual(receipt.pageErrors, []); assert.deepEqual(receipt.failures, []);
  writeFileSync(join(root, "proof/T26/browser-proof.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(`Browser presentation proof passed: ${receipt.states.length} states; pointer, keyboard, one/many source, Escape/Cancel, reduced motion, overflow and local-only resources`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
