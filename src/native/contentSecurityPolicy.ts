/**
 * CSP injected on every response by the main process (src/main.ts).
 *
 * Voice noise suppression needs, in the renderer:
 *  - 'wasm-unsafe-eval': WebAssembly.compile for DeepFilterNet3 (Studio)
 *    and RNNoise (Enhanced). This allows wasm only, not JS eval().
 *  - blob: the DeepFilterNet3 library loads its AudioWorklet from a blob URL.
 *  - https://cdn.jsdelivr.net: the pinned RNNoise worklet module.
 * Without an explicit script-src these fall back to default-src and both
 * denoisers fail to load (the call then transmits without ML denoising).
 */
const APP_ORIGINS = "https://app.mutinyapp.gg https://*.mutinyapp.gg";

export const RENDERER_CONTENT_SECURITY_POLICY =
  [
    `default-src 'self' 'unsafe-inline' data: ${APP_ORIGINS}`,
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: ${APP_ORIGINS} https://cdn.jsdelivr.net`,
    "media-src 'self' blob: data: https:",
    "connect-src 'self' wss: https:",
  ].join("; ") + ";";
