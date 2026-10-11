const electron = require('electron');
const { app, BrowserWindow, Tray, Menu, nativeImage } = electron;
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
app.setPath('userData', path.join(__dirname, 'native-user-data'));
app.setPath('sessionData', path.join(__dirname, 'native-user-data/session'));
app.commandLine.appendSwitch('disable-background-networking');
const timer = setTimeout(() => { console.error('T27 native timeout'); app.exit(1); }, 45000);
let window, tray;
const operations = [];
const evidence = { platform: process.platform, electron: process.versions.electron, packaged: app.isPackaged, checks: [], external_requests: [] };
const check = (name, condition) => { assert.ok(condition, name); evidence.checks.push(name); };
function waitEvent(emitter, name) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`missing ${name}`)), 5000);
    emitter.once(name, () => { clearTimeout(timeout); resolve(); });
  });
}
app.whenReady().then(async () => {
  window = new BrowserWindow({ width: 820, height: 460, show: false, title: 'T27 isolated synthetic tray fixture', webPreferences: { nodeIntegration: false, contextIsolation: true } });
  window.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const permitted = details.url.startsWith('file:') || details.url.startsWith('data:');
    if (!permitted) evidence.external_requests.push(details.url);
    callback({ cancel: !permitted });
  });
  for (const name of ['restore', 'show', 'focus']) {
    const original = window[name].bind(window);
    window[name] = (...args) => { operations.push(name); return original(...args); };
  }
  globalThis.__T27Window = window;
  globalThis.__T27Quit = () => { evidence.quit_calls = (evidence.quit_calls || 0) + 1; };
  globalThis.__T27Electron = {
    ...electron,
    Menu: { buildFromTemplate(template) {
      const menu = Menu.buildFromTemplate(template);
      evidence.menu = menu.items.map(item => ({ label: item.label, type: item.type, enabled: item.enabled }));
      globalThis.__T27Menu = menu;
      return menu;
    } },
    Tray: class extends Tray {
      constructor(image) { super(image); tray = this; evidence.image = { size: image.getSize(), scaleFactors: image.getScaleFactors(), template: image.isTemplateImage(), empty: image.isEmpty() }; }
    },
  };
  const source = require('./native-build/tray.cjs');
  source.initTray();
  check('unpackaged repository Electron only', !app.isPackaged);
  check('real mac template 16 logical pixels', evidence.image.size.width === 16 && evidence.image.size.height === 16);
  check('real representations 1x and 2x', JSON.stringify(evidence.image.scaleFactors) === '[1,2]');
  check('real template flag and nonempty image', evidence.image.template && !evidence.image.empty);
  check('real native five-item menu', JSON.stringify(evidence.menu.map(item => item.type === 'separator' ? 'separator' : item.label)) === JSON.stringify(['Show Mutiny', 'Settings', 'About (1.2.7)', 'separator', 'Quit']));
  check('Settings remains disabled unresolved', !globalThis.__T27Menu.items[1].enabled);
  const icons = ['trayTemplate.png', 'trayTemplate@2x.png', 'trayColour.png'].map(name => ({ name, url: 'data:image/png;base64,'+fs.readFileSync(path.resolve('assets/desktop', name)).toString('base64') }));
  const html = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>body{font:18px system-ui;background:#eee;color:#111;padding:20px}section{padding:20px;margin:12px 0;background:#fff}img{margin:0 18px;image-rendering:pixelated}.dark{background:#111;color:#fff}.dark img.template{filter:invert(1)}</style><h1>T27 isolated synthetic native fixture</h1><p>Repository Electron ${process.versions.electron}; real tray policy and Menu</p><p>${evidence.menu.map(item => item.type==='separator'?'|':item.label+(item.enabled?'':' (disabled)')).join(' · ')}</p>${['light','dark'].map(theme=>`<section class="${theme}">${theme}: ${icons.map(icon=>`<img class="${icon.name.includes('Template')?'template':''}" src="${icon.url}" title="${icon.name}">`).join('')}</section>`).join('')}<p>Settings unresolved — no web protocol-url listener. No production contact.</p>`;
  fs.writeFileSync(path.join(__dirname, 'native-fixture.html'), html);
  await window.loadFile(path.join(__dirname, 'native-fixture.html'));
  window.show();
  window.hide(); operations.length = 0;
  globalThis.__T27Menu.items[0].click();
  check('real hidden Show calls show then focus', JSON.stringify(operations) === '["show","focus"]' && window.isVisible());
  const minimized = waitEvent(window, 'minimize'); window.minimize(); await minimized;
  check('real window minimized before tray action', window.isMinimized());
  operations.length = 0;
  const restored = waitEvent(window, 'restore');
  tray.emit('click'); await restored;
  check('real tray event restores then shows then focuses', JSON.stringify(operations) === '["restore","show","focus"]' && !window.isMinimized() && window.isVisible());
  const capture = await window.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'native-fixture.png'), capture.toPNG());
  globalThis.__T27Menu.items[4].click();
  check('Quit uses scoped existing callback boundary', evidence.quit_calls === 1);
  check('no external renderer requests', evidence.external_requests.length === 0);
  evidence.limitations = ['Tray click emitted programmatically, not a physical OS click', 'Fixture screenshot is BrowserWindow content, not OS tray/menu screenshot', 'About dialog wiring covered by units; dialog not opened in runtime', 'Windows/Linux policy and assets tested, native platform runtime not exercised', 'Settings not implemented; independent acceptance pending'];
  fs.writeFileSync(path.join(__dirname, 'native-result.json'), JSON.stringify(evidence, null, 2)+'\n');
  console.log(JSON.stringify(evidence));
  tray.destroy(); window.destroy(); clearTimeout(timer); app.exit(0);
}).catch(error => {
  console.error(error.stack || error);
  fs.writeFileSync(path.join(__dirname, 'native-failure.json'), JSON.stringify({ ...evidence, error: String(error) }, null, 2)+'\n');
  tray?.destroy(); window?.destroy(); clearTimeout(timer); app.exit(1);
});
