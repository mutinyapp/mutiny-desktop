# T18 — read-only capability handshake evidence

## Outcome and scope

- Baseline: `b341130ec1584049c306ecc02f649e52622dba9e`.
- Worktree / branch: `/Users/friday/Projects/mutiny-rebuild/wt/T18` / `rebuild/T18-capability-handshake`.
- `window.native.getCapabilities()` invokes main and resolves a fresh version-1 snapshot: `platform`, actual `customFrame`, live `maximized` / `fullscreen`, and `appearanceBridge: false`.
- `window.native.onCapabilitiesChanged(cb)` receives only the snapshot and returns a subscription-specific unsubscribe function.
- Main installs the read-only invoke handler before `loadURL`, once across window recreation. State events are connected directly in `createMainWindow` and cleaned up on `closed`.
- Main uses the existing configured-origin/current-main-frame IPC policy for the new handler and notifications, additionally refusing detached frames. Events target the currently authorized `WebFrameMain`, not a renderer broadcast or a cached frame.
- Legacy `desktopConfig.get()` and its `config` push listener remain unchanged. Existing mutations, protocol URLs, window controls, audio dialog and autostart bridges remain unchanged.
- `src/main.ts`, shared renderer trust, credentials, permission policy, palette, T17 and canonical planning files were not changed. No offline-document trust exception was granted.
- Contract deltas: none. Integration fits inside the allowed window/preload-world paths without editing `src/main.ts`.

## Baseline gates (executed before any source/test writes)

The commands below ran in this worktree at the baseline. These are recorded results, not a reconstructed raw transcript.

| Command | Exit | Result |
| --- | --- | --- |
| `ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm install --frozen-lockfile --ignore-scripts` | 0 | Frozen dependency graph installed; lifecycle scripts disabled |
| `pnpm typecheck` | 0 | `tsc --noEmit` passed |
| `pnpm test` | 0 | 21 files / 191 tests passed; no skips |
| `pnpm lint` | 0 | ESLint passed |

Toolchain: Node `v22.23.3`, pnpm `10.18.1`, Electron dependency `38.1.2`, Vitest `2.1.9`.

## TDD / final gates

The captured RED transcripts have trailing whitespace trimmed; assertions, failures, counts and exit codes are otherwise preserved.

| Command | Exit | Result / raw evidence |
| --- | --- | --- |
| `pnpm exec vitest run tests/windowCapabilities.test.ts tests/preloadCapabilities.test.ts` (initial RED) | 1 | 42 failed / 12 passed; `tdd-red.log`. One backward-compatibility timeout was a test-fixture reset issue, not product evidence. |
| Same command after resetting invoke mocks, before implementation (corrected RED) | 1 | 41 failed / 13 passed; `tdd-red-corrected.log`. Missing new APIs/handler and missing event emissions are the intended failures. |
| Same command after implementation (GREEN) | 0 | 2 files / 54 tests passed; `tdd-green.log` |
| `pnpm typecheck` | 0 | `typecheck.log` |
| `pnpm test` | 0 | 23 files / 245 tests passed; baseline 191 plus 54 added; `test.log` |
| `pnpm lint` | 0 | `lint.log` |
| `git diff --check` | 0 | No whitespace errors |

The added tests execute the real `src/native/window.ts` creation path and real preload entrypoint/bridges; Electron, native window operations and IPC delivery are test doubles. They cover pre-load handshake, delayed/rejected IPC, fresh snapshots, read-only behavior, pending frame preferences, single handler registration, replacement windows, reload/stale/same-origin subframes, invalid/off-origin/file/data URLs, explicitly configured self-host origins, destroyed/detached owners, all four state events, frame-targeted delivery, teardown, unsubscribe isolation and legacy bridges.

## Version-matched authoritative sources consulted

The configured web-extraction backend was disabled. Read-only Python HTTPS retrieval recovered these exact Electron `v38.1.2` documents; no plugin settings were changed.

- https://raw.githubusercontent.com/electron/electron/v38.1.2/docs/api/ipc-main.md — `ipcMain.handle` supports a synchronous return value as an asynchronous invoke reply; the handler needs no cache or load event.
- https://raw.githubusercontent.com/electron/electron/v38.1.2/docs/api/ipc-renderer.md — invoke returns a Promise; removeListener removes the exact subscription listener.
- https://raw.githubusercontent.com/electron/electron/v38.1.2/docs/api/web-frame-main.md — `frame.send` sends only to the selected frame; `detached` identifies frames replaced during navigation.
- https://raw.githubusercontent.com/electron/electron/v38.1.2/docs/api/base-window.md — maximize/unmaximize/enter-full-screen/leave-full-screen event definitions.
- https://raw.githubusercontent.com/electron/electron/v38.1.2/docs/api/browser-window.md — on macOS fullscreen transitions are asynchronous; snapshot updates are emitted after the fullscreen state events, not when requesting a transition.

## Verification boundary / risks

- Screenshots: none; this task changes the IPC contract, not visible UI.
- No real Electron or installed Mutiny launch, window/OS runtime acceptance, packaging, signing, notarization, releases, deployment, production/contact activity, merge, shared-process termination or credential/permission changes were performed.
- Tests for pre-existing release/signing contracts use the repository's synthetic tool fixtures; their pass results are not signing or release acceptance.
- Hosted web adoption and actual Mac/Windows/Linux window behavior remain separate runtime/integration gates. A newer web client must feature-detect these optional APIs when used with an older installed shell.
- The legacy synchronous cache intentionally retains its historical initialization semantics. New consumers should use the async handshake rather than infer state from an uninitialized legacy cache.
- PR head/URL readback and any CI status are reported in the handoff/PR, not treated as product runtime proof here.
