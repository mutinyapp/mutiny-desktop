# T17-v3 — BLOCKED on real Electron caption runtime

This candidate is **not completed T17 acceptance**. Do not merge. The predecessor
asset-emission scope issue is resolved within the approved narrow v3 path; the
new runtime failure below is retained without weakening trust or tests.

## Implemented and independently executable locally

- `vite.main.config.ts` adds only a byte-preserving emission plugin for authored
  `assets/desktop/offline/offline.html` -> `.vite/build/offline.html`.
- A local token-colored recovery page, error classification, configured-URL-only
  Retry intent (intercepted same-file navigation, no new IPC), main-frame load
  failure / HTTP server error / renderer-crash recovery, visible-only
  5s/15s/30s/60s retry, remaining-delay pause/resume, successful-load reset and
  timer/listener cleanup.
- Existing three caption handlers receive the exact approved main-owned bundled
  document exception; shared renderer trust is byte-identical to accepted main.
- Production config/autostart/badge/audio-file/display/permission negatives,
  other files/query/hash/case/encoding/subframe/destroyed/stale authority checks.
- Original preserved caption RED ran fresh: 3 failed / 3 passed; its feature
  assertions now pass with the main-owned activation fixture. Emission RED ran
  fresh before implementation. Behavior RED: 36 failed / 37 passed; GREEN: 79/79.
- Fresh G-D1 `pnpm typecheck` -> 0; G-D2 `pnpm test` -> 0, **29 files / 345 tests**
  (245 accepted main + 6 preserved diagnostics + 94 added); G-D3 `pnpm lint` -> 0.
- Actual installed-config emission unit gate passes byte equality. Deterministic
  omission, wrong-filename and truncated-byte mutants all fail the verifier;
  unchanged-source control passes, with before/after hash invariance.

## Exact runtime blocker

Command: `node proof/T17/run-electron-runtime.mjs` -> **exit 1**.
Final reproducer transcript: `v3-exact-frame-diagnostic.log`.
Harness source: `electron-runtime-entry.ts`; launcher `run-electron-runtime.mjs`.

The harness builds the real recovery/controls modules and unchanged production
preload with installed Forge 7.9.0 / Vite 5.4.20. It loads the actual byte-identical
emitted file in repo Electron **38.1.2**, without importing or executing
`src/main.ts`, single-instance/updater/protocol/autostart/control-server services,
any packaged/installed Mutiny, or production. It owns only loopback port 49205,
one BrowserWindow, its renderer and scratch user-data/build directories.

Observed sequence:
1. Real loopback HTTP 503 -> emitted Server fallback, screenshot.
2. Real 5-second retry attempts the configured URL and returns to fallback.
3. Retry button -> loopback HTTP 200 recovery; a 5.2-second observation does not
   reload the recovered app.
4. `forcefullyCrashRenderer()` on this harness-owned renderer -> Server fallback,
   screenshot.
5. CDP Network offline on this owned renderer -> real main-frame
   `ERR_INTERNET_DISCONNECTED` **-106** -> emitted Offline fallback, screenshot.
6. Maximise button sends exactly one existing IPC command, but native maximize
   times out. Authorization log is:
   `hosted=false; offline=false; self=false; sameContents=true; sameFrame=true; detached=true`.
   Sender and current frame URL both name the exact emitted
   `offline.html?error=offline` file. The detached-frame guard therefore refuses
   the action. Minimise and Close runtime assertions are not reached.

**Root cause is not isolated.** The observed sequence includes both a forced
renderer crash and a CDP attach/offline/detach lifecycle. This receipt does not
establish whether production recovery timing or the test fixture lifecycle leaves
that frame detached. Do not remove the detached guard, broaden file trust, mock
caption success, or relabel the green Vitest doubles as Electron caption proof.
Per the v3 stop line, product edits stop at this newly uncovered runtime failure.
A controller-directed follow-up should isolate those lifecycle transitions and
repair recovery or the fixture within existing authority, if possible.

Earlier harness setup failures are retained separately: the first launcher
accidentally replaced Forge's preload output object and lost CJS format (fixed by
preserving its format); session offline emulation did not induce a navigation
failure on the loopback fixture, so the real -106 is induced through CDP instead.
Neither correction modified preload config, dependency locks or product trust.

## Screenshot review and proof limits

`darwin-server.png`, `darwin-crash.png`, `darwin-offline.png` are actual emitted
Electron captures at 900x600 CSS px / 1800x1200 PNG pixels. The inspected Offline
capture has legible wordmark/class/body copy and a visible Retry button, no
clipping, and no duplicate HTML captions on macOS. CapturePage excludes native
window controls; traffic-light runtime is not proven by this screenshot.

The scheduled Windows-presentation run is **not reached**. Its test-only Vite
`process.platform` constant would simulate presentation on macOS using the same
production preload; it would never prove native installed Windows/Linux behavior.
No successful full runtime receipt or caption runtime acceptance is claimed.
DNS/TLS classification is unit-proven, not real DNS/TLS network runtime proof.

## Scope / external state / resource release

Fresh source/script/live-workflow audit: `v3-workflow-scope-audit.json` (all 4 live
entries enumerated). Only build.yml has an automatic PR path; the release writer
and candidate workflow are dispatch-only and are never dispatched. The historical
brand workflow source remains absent from current main. Main's only change is
caption helper import + existing registration. Protected source/config/scripts
and shared renderer trust are otherwise unchanged. No public writer was found.

No production contact, installed/package launch, shared process kill, local
package/sign/notarize/publish, release, merge, credential/token/decision/contract/
STATUS/skill/memory change occurred. The one harness-owned renderer was crashed
for the explicit recovery test; owned Electron processes exit, the loopback
listener is closed, and scratch build/user-data directories are removed in finally.
The slot/worktree is frozen for independent checking, not released as accepted.

No new trust-scope approval is requested or inferred. The ordinary v3 emission
delta was implemented exactly; current blocker is failed runtime acceptance.
