# E44-v1 — held shared Electron runtime prerequisite

**Local acceptance: PASS. Merge/release: HELD.** Governing contract:
`/Users/friday/Projects/mutiny-ui-review-20261002/devplan/tasks/E44-v1.md`,
DECISIONS #8. Base: `ec76ff76991bda4173bb8dcc4c35cfadc73b6bc1`.
No T17 source or worktree changes; this does not replace T17 product/platform acceptance.

## Implemented scope

- Exact Electron `38.1.2` → `44.5.1`, with synchronized Electron-owned npm/pnpm subtrees.
- The only Forge compatibility change is **locked transitive `node-abi` 3.94.0**
  (pnpm baseline 3.77.0; npm baseline 3.89.0). Versions 3.90–3.93 do not list
  Electron 44; 3.94.0 is the first succeeding compatible minor investigated.
  Forge stays **7.9.0**, `@electron/rebuild` stays **3.7.2**;
  both pnpm and a fresh npm installation resolve `getAbi('44.5.1', 'electron')` to **149**.
  No broad Forge migration, dependency overrides, or product config rewrite.
- `clipboard.writeText(action.url)` explicitly handles promise rejection in the
  existing Copy Link callback. Two tests exercise the real window/context-menu
  module with mocked Electron and actual asynchronous promises. The corresponding
  tests fail against the original source and pass against the candidate.
  Neither physical clipboard contents nor menu authorization changed.
- Add only `NSAudioCaptureUsageDescription` to the existing Forge `extendInfo`:
  “Mutiny needs system audio access for screen sharing.”
- Change only the two exact Electron version/pnpm-lock assertions in the signing
  contract. All other signing/notarization/security assertions remain byte-identical.
- `@electron/fuses` remains **1.8.0**. Packaged nine-entry v1 fuse wire reads
  `0..8 = 0,1,0,0,1,1,0,1,1`. The six explicit security settings are unchanged;
  unspecified entries 6–8 equal the unmodified Electron archive defaults.

## Final local gates

Commands run from the E44 worktree, using task-owned `TMPDIR`/caches. Each named
receipt includes the real argv, exit, UTC start, elapsed time, environment and log hash.
Earlier failed diagnostics are retained; they are not final gate results.

| Gate / command | Exit | Result / receipt |
|---|---:|---|
| Electron 38 isolated baseline `pnpm test --reporter=default --reporter=json ...` | 0 | **245/245**, 23 files; `receipts/baseline-all.*`, `baseline-tests.json` |
| G-D1 `pnpm typecheck` | 0 | `receipts/G-D1-final.*` |
| G-D2 `pnpm test --reporter=default --reporter=json --outputFile=proof/E44/receipts/candidate-tests-final.json` | 0 | **247/247**, 24 files, no pending/failures; `receipts/G-D2-final.*` |
| G-D3 `pnpm lint` | 0 | `receipts/G-D3-final.*` |
| `node proof/E44/run-native-probe.mjs` | 0 | Sync + deferred each exit 0, current frame `detached=false`; `receipts/native-probe-final.*`, `engine-{sync,deferred}.json` |
| `node proof/E44/run-unsigned-package.mjs` | 0 | Actual `pnpm exec electron-forge package --platform=darwin --arch=x64`; ABI 149, real ASAR/Info.plist/fuse readback; `receipts/unsigned-package-final.*`, `unsigned-forge.json` |
| `node proof/E44/verify-lock-scope.mjs` | 0 | Both lock diffs confined to Electron closure + ABI seam; **zero unrelated diffs**; `receipts/lock-scope-final.*`, `lock-scope.json` |
| `pnpm install --frozen-lockfile --ignore-scripts --store-dir "$E44_SCRATCH/cache/pnpm-store"` | 0 | `receipts/frozen-install.*` |
| Fresh scratch `npm@10.9.4 ci --ignore-scripts --no-audit --no-fund` | 0 | `receipts/npm10-ci.*`; actual npm identity and npm ABI 149 also recorded |
| `python3 proof/E44/verify-result.py` | 0 | Exact path/source-scope assertions, counts/log hashes, deleted package, free owned ports; `RESULTS.json`, `receipts/acceptance.*` |

Host measured: macOS **15.7.3**, **x86_64**, builder Node **22.23.3**, pnpm **10.18.1**.
Native receipts independently report Electron **44.5.1**, embedded Node **24.21.0**,
`process.versions.modules === '149'` and actual executable identity.

## Seven signing/notarization fixture failures: environment diagnosis

The isolated baseline uses the exact base manifest/lock/security scripts/tests and
its own dependencies: Electron **38.1.2**, rebuild **3.7.2**, node-abi **3.77.0**.
`receipts/baseline-diagnosis.json` records exact source hashes and matches all seven
failed test names against the prior spike.

The fixtures generate an **extensionless ESM shebang executable** and invoke it
through symlinks named `security`, `codesign`, etc. The spike's TMPDIR was below
`/Users/friday/Projects/package.json`, which explicitly declares `type: commonjs`.
On the measured Node 22.23.3 host, that parent scope makes this executable return
**status 0 with empty stdout/stderr and no body execution**. Identity discovery
therefore sees zero identities, and subsequent expected fake-tool calls are absent.
`diagnose-fixture-parent.mjs` proves the difference using disposable controlled
commonjs/neutral parents, without touching the real parent package.

With only TMPDIR under a disposable commonjs parent, the untouched Electron 38
signing suite reproduces **exactly the same seven failures, 9/16 passing**
(`baseline-commonjs-signing.*`, `baseline-commonjs-tests.json`). With the neutral
profile scratch TMPDIR, the original full baseline passes **245/245**, including
**16/16** signing tests. This is an environment/setup artifact, not an Electron 44
or signing product regression. No fixture/security-test repair was made.

Additional diagnostic: host npm **12.1.0** rejects both baseline and candidate
`npm ci` with the same pre-existing missing optional peer `encoding` / `iconv-lite`.
The synchronized candidate installs cleanly using **npm 10.9.4**, and its installed
Electron/rebuild/node-abi versions and ABI are verified. Unrelated npm 12 peer
repairs are outside this contract and were deliberately not added to either lock.

## Runtime and package safety

The native-only entry is copied from the named T17 spike, retaining its crash/load
assertion and sync/deferred paths. Changes are E44 environment/port names, structured
runtime identity and a tiny local `#error-class=Server` offline fixture. Its imports
are **Electron + node only**, with no Mutiny modules. Only ports **49270/49271** are
used; the probe tears down owned processes/server/user-data, and all **49270–49279**
ports are verified free afterwards. No T17 ports/worktree were used.

The package harness makes a fresh source snapshot **inside profile scratch**.
It inherits the actual candidate Forge config and runs real Vite/rebuild/fuses.
A proof-only higher-precedence config removes only the explicit signing hook,
sets signing/notarization false and routes output into the same disposable scratch.
Production signing config is unmodified. The host-x64 assertion avoids Forge's
arm64 automatic ad-hoc fuse re-signing. The product main/preload targets are
**compiled, never launched as an Electron application**. No installed Mutiny app
is launched. No make, sign, notarize, publish, release, production, updater or
credential-changing operation was performed. The complete package/snapshot is
removed in `finally`; only receipts/hashes are retained.

## Platform-floor hold and current workflow matrices

Electron 44 requires **macOS 13+** and no longer supplies **win32-ia32** or
**linux-armv7l** binaries. Petie's explicit approval is still required before merge.

- `build.yml`: no OS/arch matrix; `ubuntu-latest` PR build remains supported.
- `desktop-candidate.yml`: `macos-14 / darwin-arm64` and
  `windows-latest / win32-x64`; neither target must be removed.
- `release.yml`: the same darwin-arm64 and win32-x64 matrix; neither target must
  be removed. Both candidate/release workflows are dispatch-only; none dispatched.
- **No current matrix changes are required**, but customer macOS 12 support is lost;
  any out-of-repo ia32/armv7l distribution is no longer possible. Customer inventory
  has not been verified. All three workflows select builder Node major 22;
  Electron's npm package now requires **>=22.12.0** (this host satisfies it).

Live workflow/source preflight was read before push; no CI watch/dispatch or merge.
Screenshots: N/A, no visual/UI change. Contract deltas: **none**.

Unverified and separately gated: macOS arm64, Windows/Linux runtime and packaging,
installed/signed notifications (`UNNotification` now requires signing), physical
voice/camera/screen/system-audio/TCC, native addons at runtime, updater/rollback,
and T17's complete application crash-recovery scenarios. Local runtime/package
acceptance does not grant installed-platform, merge or release approval.

## Reproduction (only within an explicitly authorized isolated lane)

Set `E44_SCRATCH` to a fresh profile scratch directory. Put `TMPDIR`,
`XDG_CACHE_HOME`, `npm_config_cache`, `ELECTRON_CACHE`, and pnpm's `--store-dir`
under it, outside any ancestor `type: commonjs` package scope. Use Node >=22.12.0.
Install the frozen dependencies with `--ignore-scripts`; if running the native
probe, explicitly download with `node node_modules/electron/install.js`.
Electron 42+ lazy acquisition means `--ignore-scripts` alone does not block a
later binary download; `ELECTRON_SKIP_BINARY_DOWNLOAD` is no longer supported.
Run the exact gate commands above via `python3 proof/E44/run-command.py <name> -- <command>`.
Unsigned packaging is authorized only on this x64 host and only through the proof
harness. Do not use the regular macOS package scripts, which intentionally sign.

## Authoritative sources

Exact-version source excerpts + retrieval hashes are in `sources/authoritative-excerpts.json`.

- https://registry.npmjs.org/electron/44.5.1 — exact dependencies/engine/tarball.
- https://registry.npmjs.org/node-abi/3.94.0 — minimal ABI seam; registry tarball
  inspection for versions 3.90–3.94 is in `sources/abi-first-version.json`.
- https://raw.githubusercontent.com/electron/electron/v44.5.1/docs/breaking-changes.md
- https://raw.githubusercontent.com/electron/electron/v44.5.1/docs/api/clipboard.md
- https://raw.githubusercontent.com/electron/electron/v44.5.1/docs/api/desktop-capturer.md
- https://raw.githubusercontent.com/electron/electron/v44.5.1/docs/tutorial/fuses.md
- Upstream detached-reset lineage: https://github.com/electron/electron/pull/53102
  and https://github.com/electron/electron/pull/53109, verified by the supplied
  upstream research and independently exercised here with the native-only probe.
