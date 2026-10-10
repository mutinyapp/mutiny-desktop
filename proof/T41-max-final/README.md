# T41 maximize transition persistence — local unpublished proof

The change is only normal-bound persistence/event cleanup in `src/native/window.ts`.
`tests/T41-window.test.ts` adds deterministic resize/move-before-flag chronology for
maximize and fullscreen, hidden recreation, and owned transition-listener cleanup.
Every inherited test/assertion remains. The inherited maximized double now returns
Electron's retained normal rectangle, rather than its visible maximized rectangle.

Actual source-pinned results and failures are in:
`/Users/friday/Projects/mutiny-ui-review-20261002/devplan/evidence/controller-F1009-20261010T093023Z/T41-MAX-FINAL`.

## Bounded unpackaged replay
Run only in a disposable exact-source worktree, with copied dependencies, isolated
TMPDIR/cache/profile, network/listener guards qualified first, and ports 49720–49739
reserved/free. Never launch the installed/packaged application or a private profile.
The external deadline runner is preserved in the evidence directory. Set
`NODE_OPTIONS=--require=<absolute proof path>/port-guard.cjs`, `T41_BUILD` to an owned
build directory, `T41_PROFILE` to an owned synthetic profile, and `T41_OUTPUT` to an
owned evidence directory. Create `.checker/` before invoking `build-native.cjs`.
Use the repository's direct Node/Vite/Electron executables, not packaging commands.

`node proof/T41-max-final/build-native.cjs` bundles the real native window, config,
electron-store, trust, offline recovery and caption modules. Only icon, tray-menu
side effects and Discord RPC are fixture boundaries. The real preload is compiled
from `src/world/window.ts`; only version metadata is substituted.

Run `T41_PHASE=normal node node_modules/electron/cli.js
proof/T41-max-final/native-max-exit-observer-free.cjs`, then in a fresh Electron
process with the same profile, separate output and `T41_PHASE=restore`, run
`native-max-restore-observer-free.cjs`. The exit run writes expected-normal.json
independently and preserves actual config.json bytes; restore compares against
that independent original, not the potentially corrupted stored rectangle.
Neither run installs persistence setters or geometry event observers. All original
waits, failure assertions, zoom controls and cleanup checks are unchanged.

`native-runtime.cjs` retains chronology observations and the complete positive /
negative native transition, zoom, recovery, caption, minimize and close-to-tray
matrix. It does not test a real OS tray menu. Phases restore/clamp/malformed are
fresh hidden launches. Network denial and owned-positive assertions precede
product loading in every native process. Cleanup checks callback identities,
including the new transition callback, without removing Electron engine listeners.

Fix-removal falsification changes ONLY `persistState(true)` to `persistState(false)`
in a disposable source copy. Require the two new named unit cases and the native
maximize/disk/hidden-restore assertions RED, then exact restoration GREEN.

This is writer evidence, not independent acceptance. R2 web restart labels and
active-versus-stored settings remain unimplemented. Physical Windows/Linux, other
Mac architecture, full OS tray menus, installed-app and release remain unverified.
No commit/push/PR/merge/sign/package/publish/production action is authorized here.
