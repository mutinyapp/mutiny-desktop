// Diagnostic only: never runs Electron, Forge package/make, signing or publication.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { build, loadConfigFromFile } from 'vite';

const require = createRequire(import.meta.url);
const root = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const pluginRoot = dirname(require.resolve('@electron-forge/plugin-vite/package.json'));
const { getConfig } = require(join(pluginRoot, 'dist/config/vite.main.config.js'));
const forgeEnv = {
  root, mode: 'production', command: 'build',
  forgeConfig: { renderer: [] },
  forgeConfigSelf: { entry: 'proof/T17/asset-emission-probe-entry.mjs', target: 'main' },
};
const user = await loadConfigFromFile({ command: 'build', mode: 'production' }, join(root, 'vite.main.config.ts'));
assert.ok(user);
const config = getConfig(forgeEnv, user.config);
// Pin the assigned scratch explicitly; do not rely on a caller's host TMPDIR.
const scratch = '/Users/friday/.hermes/profiles/friday/cache/scratch';
const out = mkdtempSync(join(scratch, 'T17-emission-probe-'));
try {
  console.log(JSON.stringify({
    vite: require('vite/package.json').version,
    forge: require('@electron-forge/plugin-vite/package.json').version,
    library: config.build.lib,
    copyPublicDir: config.build.copyPublicDir,
    outputDirectory: out,
  }, null, 2));
  const result = await build({ ...config, configFile: false, build: { ...config.build, outDir: out } });
  const outputs = Array.isArray(result) ? result.flatMap(r => r.output) : result.output;
  console.log(JSON.stringify({
    emittedFiles: outputs.map(o => o.fileName),
    inlineDataURL: outputs.some(o => o.type === 'chunk' && o.code.includes('data:text/html;base64,')),
    chunks: outputs.filter(o => o.type === 'chunk').map(o => ({ fileName: o.fileName, code: o.code })),
  }, null, 2));
  assert.ok(outputs.some(o => o.type === 'asset' && o.fileName.endsWith('.html')),
    'T17 requires an emitted bundled HTML file: the unchanged Forge main config only inlines it');
} finally {
  rmSync(out, { recursive: true, force: true });
  console.log('Removed owned diagnostic build directory. No package/sign/runtime step executed.');
}
