## Task
T17-v3 — **BLOCKED on real Electron caption runtime; do not merge.**
Contract: `/Users/friday/Projects/mutiny-ui-review-20261002/devplan/tasks/T17-v3.md`.
Accepted main: `ec76ff76991bda4173bb8dcc4c35cfadc73b6bc1`.

## Implemented
- Narrow byte-identical bundled offline asset emission; no other build/config/dependency/workflow changes.
- Offline/DNS/TLS/server policy, local token-colored UI, configured-URL Retry, visible-only 5/15/30/60-second backoff, pause/resume/reset/cleanup.
- Exact main-owned file/current-main-frame caption exception at existing registration only. Shared renderer trust unchanged. No new IPC bridge or unrelated privileges.
- Preserved original RED caption requirements now pass as unit feature assertions; all unrelated privilege negatives remain refused.

## Fresh gates
| Command | Exit | Result |
|---|---|---|
| `pnpm typecheck` | 0 | G-D1 |
| `pnpm test` | 0 | G-D2: 29 files / 345 tests (245 main + 6 preserved + 94 added) |
| `pnpm lint` | 0 | G-D3 |
| `node proof/T17/check-emission-mutations.mjs` | 0 | byte-identical clean control; omit/wrong-name/truncate controls all correctly rejected |
| `node proof/T17/run-electron-runtime.mjs` | **1** | **BLOCKED**, exact detached-frame caption refusal |

## Runtime blocker — not feature acceptance
Real repo Electron 38.1.2 loads the actual emitted file. HTTP 503 fallback, 5-second retry, manual HTTP 200 recovery without restart, real renderer crash fallback, and CDP-induced real -106 Offline fallback are exercised. Then Maximise IPC arrives once but native action is refused: current exact file/main frame reports `detached=true`; sameContents/sameFrame=true, offline authorization=false. Minimise/Close and the Windows-presentation run are not reached. Root cause is not isolated between crash recovery and harness CDP lifecycle. No guard, trust check or test was weakened.

Full blocker: [`proof/T17/v3-RUNTIME-BLOCKER.md`](proof/T17/v3-RUNTIME-BLOCKER.md).
Exact transcript: `proof/T17/v3-exact-frame-diagnostic.log`.
Unit logs/receipts: `proof/T17/v3-gates.json`, `v3-{typecheck,test,lint}.log`.

## Screenshots — partial rendering only
- `proof/T17/darwin-server.png`
- `proof/T17/darwin-crash.png`
- `proof/T17/darwin-offline.png`

Offline screenshot visually inspected: legible, no clipping, Retry visible, HTML captions suppressed on macOS. Native traffic lights and Windows/Linux platform runtime remain unverified.

## Contract deltas / safety
Approved v3 emission scope implemented exactly. No new trust authority requested or inferred. The new runtime failure is retained under the stop line; this draft remains blocked regardless of green local/hosted CI.
Source/scripts + all 4 live workflow entries audited before push (`v3-workflow-scope-audit.json`); no automatic publisher. No dispatch, production, local packaging/signing/notarization/publication, installed Mutiny launch, shared process kill, merge, credentials, tokens/decisions/contracts/STATUS/skills/memory edits. Port 49205 and owned Electron/scratch resources released.
