# T26-v2 worker proof

## Outcome

- Native main-window canvas, fallback picker and bundled offline page consume pinned generated Mutiny tokens.
- `window.native.setAppearance('dark' | 'light')` uses the existing configured-origin/current-main-frame authorization plus detached-frame refusal. It persists through a dedicated native property (default dark), never the general renderer-config allowlist.
- Capability snapshots advertise the installed appearance handler; an integrated real window/preload-module test proves the advertised method exists and routes through the genuine renderer-trust policy.
- The fallback always opens for one or more sources. Pointer selection/focus only selects; Share or source Enter confirms; Escape/Cancel cancels. It has 520×400 minimum geometry, 12px cards, violet focus and reduced-motion handling. Existing macOS system-picker preference, sandbox, escaping, offered-source allowlist, timeout and exactly-once result policy remain unchanged.
- Offline styling uses a main-owned generated CSS push for the exact bundled file, not file-page appearance IPC. Its caption-only exception and Retry behavior remain unchanged.

Governing: `tasks/T26.md` as amended by `tasks/T26-v2.md`; Wave B packet. Reused branch `rebuild/T26-native-tokens-picker`, baseline `75ac011dd6dbe482ed58359d1d3274fe609e9b65`.

## Gates

| Command | Exit | Result |
|---|---:|---|
| `ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm install --frozen-lockfile --ignore-scripts` | 0 | Frozen installation; Electron binary intentionally not installed |
| baseline `pnpm test` | 0 | 372 tests / 32 files |
| `node scripts/sync-tokens.mjs --check` | 0 | Exact pinned native output + manifest + regenerated offline CSS parity |
| `pnpm typecheck` | 0 | TypeScript pass |
| `pnpm test` | 0 | **429 tests / 36 files**, 57 added, zero failures/skips |
| `pnpm lint` | 0 | Zero errors/warnings |
| `git diff --cached --check -- assets/desktop/offline/offline.html scripts/sync-tokens.mjs src tests` | 0 | No source/test whitespace errors; raw proof logs retain their original output whitespace |
| `node proof/T26/mutate-appearance.mjs` | 0 | Mutation child exits 1: 17/75 named failures, candidate source hash unchanged |
| `PW_FROM=<Playwright 1.57.0 package.json> node proof/T26/render-proof.mjs` | 0 | Six rendered dark/light states; pointer, keyboard, one/many sources, Cancel/Escape, reduced motion, no horizontal overflow or external resources |
| `node proof/T26/scope-proof.mjs` | 0 | Protected sources unchanged; upstream byte parity; zero owned listeners |

`gates.json` is the pre-commit candidate receipt: it explicitly records the baseline HEAD, dirty status and SHA-256 of every changed functional source/test. Its logs contain actual unfiltered execution. Final committed-head gates are rerun to a lane-owned external scratch directory to avoid a self-referential evidence commit.

The inherited Vite CJS Node-API deprecation warning remains in baseline/final unit output; it is not a new failure. Signing/notarization/packaging contract tests use inherited synthetic tools, not real signing/package commands.

## RED → GREEN

- `red.log`: native appearance/provenance requirements fail on the predecessor. Its picker fixture initially has an import-hoisting setup failure; that failure is **not** claimed as picker behavior proof.
- `red-picker-corrected.log`: corrected fixture executed against the exact predecessor `screenPicker.ts`: 4 failures / 8 tests for missing single-source confirmation, Enter workflow, and dark/light minimum/token geometry. Candidate restored, then all eight pass.
- `red-sync.log`: four expected missing-sync-script failures before implementation.
- `red-offline-metrics.log`: expected missing generated radius/motion/titlebar variables before their implementation.
- `red-browser.log`: actual predecessor-emitted HTML fails with “explicit Share button is missing.” No renderer logic was replaced; the proof-only predecessor transform merely exports its existing builder.
- `green-targeted-v2.log`, final `test.log`: GREEN controls.
- `mutation-receipt.json` + full JSON/log: authorization removed only in a disposable exact-source copy. Same-origin subframe, stale frame/window, detached/destroyed callers, file/data, wrong origins and replacement-owner controls fail by name. The real `rendererTrust` module is never mocked or edited.

## Screenshots and runtime boundary

- `picker-{dark,light}-{680,520}.png`: default and 520×400 minimum picker layouts.
- `offline-{dark,light}.png`: generated offline appearance at 800×600, with Windows caption-layout fixture.
- `browser-proof.json`: exact viewport/computed styles, all request/console/error channels; no unexpected diagnostics.

All six screenshots were inspected: readable actions and focus, intact footer, safe title truncation, flat token hierarchy. At minimum height, the source list scrolls independently; its lower cards intentionally continue below the scroll viewport, not over the footer.

Thumbnails are explicitly synthetic local display/window fixtures. The browser harness compiles the actual production picker builder and native CSS adapter, mocking only Electron/config/window dependencies. It never starts Mutiny. Main/preload/persistence tests exercise real modules with OS/transport/store doubles; they are boundary proof, **not installed Windows/macOS runtime acceptance**. No packaged app, real screen capture, TCC prompt, production server, user call, package/sign/notarize/release command or workflow dispatch is used. The only preview listener is owned loopback port 49430, subsequently closed.

## Contract interpretation and CI boundary

- Historical path blocker `CONTRACT-DELTA.md` is resolved by T26-v2.
- The pinned upstream header contains no hash. The successor requires unchanged bytes, so provenance tests compare actual output SHA-256 with `manifest.outputs['native-tokens.ts']` and separately pin the unchanged manifest. No header/hash is invented and no token value is edited.
- See `CI-SCOPE.md`: the active PR workflow executes `pnpm run package`. To honor the direct no-package instruction, this PR uses the documented `skip-checks: true` trailer rather than triggering it. Hosted CI is explicitly **skipped, not green**. Parent approval for a no-package workflow successor or packaging is required before running that workflow. No workflow or trust-policy edits were made.

## Reproduction

```sh
node scripts/sync-tokens.mjs /path/to/mutiny-web-repo
node scripts/sync-tokens.mjs --check
node proof/T26/run-gates.mjs
node proof/T26/mutate-appearance.mjs
PW_FROM=/path/to/playwright-1.57.0/package.json node proof/T26/render-proof.mjs
T26_WEB_REPO=/path/to/mutiny-web-repo node proof/T26/scope-proof.mjs
```

Sync reads immutable Git object `db9de9e3e73ccc257d5a613e02b89d667bf1c0ce`, not the web worktree's mutable generated files. `--check` is offline-capable and non-repairing; tampered native output, manifest and offline CSS are all rejected by dedicated tests. The proof harness needs an installed Playwright Chromium; desktop dependencies/lockfiles were not changed.
