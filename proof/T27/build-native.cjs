const { build } = require('vite');
const path = require('node:path');
(async () => {
  await build({
    configFile: false,
    logLevel: 'info',
    plugins: [{
      name: 'T27-isolated-native-boundary',
      enforce: 'pre',
      resolveId(id, importer) {
        if (id === 'electron') return '\0T27-electron';
        if (id === './window' && importer?.endsWith('/src/native/tray.ts')) return '\0T27-window';
      },
      load(id) {
        if (id === '\0T27-electron') return 'export const {Menu, Tray, dialog, nativeImage} = globalThis.__T27Electron;';
        if (id === '\0T27-window') return 'export const mainWindow = globalThis.__T27Window; export const quitApp = () => globalThis.__T27Quit();';
      },
    }],
    build: {
      outDir: path.join(__dirname, 'native-build'),
      emptyOutDir: true,
      minify: false,
      lib: { entry: path.resolve('src/native/tray.ts'), formats: ['cjs'], fileName: () => 'tray.cjs' },
    },
  });
})().catch(error => { console.error(error); process.exitCode = 1; });
