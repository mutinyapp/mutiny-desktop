# T17-v4 — BLOCKED: pinned Electron frame-lifecycle defect

**Do not merge. No recovery repair or full T17 acceptance is claimed.**
Frozen starting head: `db249a04ae66fef949d3f1de92ea81d795a99929`.
Product source, shared trust, preload/build/dependency/workflow configuration remain
byte-identical to that head. Only harness/evidence and four additional boundary
regressions changed.

## Isolation result

The exact emitted asset and unchanged production preload ran in repo Electron
**38.1.2**, separately for each scenario and each presentation. All four caption
attempts (Maximise, unmaximise, Minimise, Close) are delivered in every scenario.
Failures are collected, not suppressed; the aggregate harness still exits **1**.

| Scenario | Darwin exit | Windows-presentation exit | Offline authorization / detached |
|---|---:|---:|---|
| Real HTTP 503 fallback, no crash, no CDP | 0 | 0 | true / false |
| Hosted HTTP 200 → renderer crash → fallback, no CDP | 1 | 1 | false / true |
| Hosted HTTP 200 → CDP -106 failure → fallback, no crash | 0 | 0 | true / false |
| Full v3 sequence: 503/retry/200/crash/CDP -106 | 1 | 1 | false / true |

Thus **8 scenarios: 4 pass / 4 fail**. Successful scenarios perform real native
maximize/unmaximize/minimize/restore/close. Failed scenarios receive exactly
`{maximise:2,minimise:1,close:1}` IPC messages, but no native caption actions fire.
For every refused action:
`hosted=false; offline=false; self=false; sameContents=true; sameFrame=true; detached=true`.

Fresh `webContents.mainFrame`, `webFrameMain.fromId(current.processId,current.routingId)`
and `webFrameMain.fromFrameToken(current.processId,current.frameToken)` all return
**the same wrapper**, still detached, despite the exact new emitted-document URL.
This is not a pre-crash reference retained by the caption predicate: the predicate
already resolves the current owner/frame at each authorization.

Receipts: `v4/isolation-summary.json`, `v4/runtime.log`, and
`v4/runtime/{darwin,win32}-{no-crash-no-cdp,crash-only,cdp-only,full-v3}-runtime.json`.
The preliminary RED is retained separately under `v4/initial-isolation*`;
`v4/isolation.log` is the earlier full isolation run. The final `v4/runtime.log`
preserves every existing native action assertion plus the new explicit IPC
arrival/authorization assertions. No timeouts were increased or cases skipped.

## Native-only counterexample: not Mutiny recovery or CDP

`proof/T17/electron-frame-lifecycle-entry.ts` imports **Electron + node only**:
no Mutiny recovery, trust, window controls, preload, or application entry modules.
It loads loopback HTTP 200, reads the live main frame, crashes its owned renderer,
then main-process-loads the emitted fallback. Both variants reproduce the defect:

- Synchronous load in `render-process-gone`: **exit 1**.
- `setImmediate`-deferred load after that event: **exit 1**.

In both, the freshly read current frame has `detached=true`, `isDestroyed()=false`,
the correct new fallback URL, and the same wrapper identity as before the crash.
Both documented lookup alternatives also return that same wrapper. This rules out
CDP attachment/detachment and Mutiny's recovery listener timing as the cause.
Native-only RED receipts: `v4/engine-{sync,deferred}.log` and
`v4/runtime/engine-{sync,deferred}.json`.

Reproduce (use the Friday-assigned free port, not the checker-owned 49205):

```sh
T17_PORT=49206 T17_PROOF="$PWD/proof/T17/v4/runtime" \
  node proof/T17/run-electron-runtime.mjs
# exit 1; all eight presentation/scenario runs execute
T17_PORT=49206 T17_PROOF="$PWD/proof/T17/v4/runtime" T17_ENGINE_PROBE=sync \
  node proof/T17/run-electron-runtime.mjs
# exit 1; no product modules
T17_PORT=49206 T17_PROOF="$PWD/proof/T17/v4/runtime" T17_ENGINE_PROBE=deferred \
  node proof/T17/run-electron-runtime.mjs
# exit 1; deferring recovery does not repair the wrapper
```

The default port remains 49205 for compatibility; all this writer's executions
explicitly used **49206**. The controller clone, its 49205 listener, and Electron
processes were never touched.

## Version-matched documented lifecycle and actual implementation

Authoritative Electron 38.1.2 documentation:
- https://github.com/electron/electron/blob/v38.1.2/docs/api/web-frame-main.md#framedetached-readonly
  defines detached as removal from the frame tree, including replaced unloading
  documents. Frame tree node identity persists through its lifetime; frame
  routing/process identities describe the current renderer.
- https://github.com/electron/electron/blob/v38.1.2/docs/api/structures/ipc-main-event.md
  says `senderFrame` may become null after navigation/destruction. Do not replace
  genuine sender authority with URL-only or general local-file authority.

Exact-version source explains the observed binary behavior:
- https://github.com/electron/electron/blob/v38.1.2/shell/browser/api/electron_api_web_frame_main.cc#L184-L203
  `MarkRenderFrameDisposed()` sets **both** detached and disposed to true;
  `UpdateRenderFrameHost()` replaces the host/token and clears **disposed only**,
  leaving detached sticky.
- https://github.com/electron/electron/blob/v38.1.2/shell/browser/api/electron_api_web_contents.cc#L1777-L1819
  frame deletion marks the wrapper disposed; a host change reuses the wrapper
  via the frame-tree-node map and calls `UpdateRenderFrameHost()`.
- The WebFrameMain source at lines 539–586 reuses existing wrappers and pins them
  until the internal frame is deleted. Re-reading or dropping a JS reference
  does not produce a new safe wrapper in this runtime.

Retrieved docs, numbered source excerpts and hashes are retained in
`v4/electron-authoritative-sources.json`. This is a runtime/source lifecycle defect,
not permission to disregard the detached-frame guard.

## CONTRACT DELTA requested; not implemented

The contracted repair (resolve the current owner/frame at authorization time)
is already present and the three documented lookups demonstrably cannot repair
this pinned runtime's sticky flag. Keeping a genuinely detached sender refused
precludes deleting, overriding, or reinterpreting that guard.

Request a successor choosing one explicitly scoped repair:
1. A verified Electron runtime fix/update, with narrowly approved **package.json
   and dependency-lock paths**. A fixed release is **not identified or tested**
   here; do not assume a version bump resolves it. Source-only spot checks of
   38.2.0, 38.3.0 and 39.0.0 retain the same missing reset; no binaries were
   installed, dependencies changed, or acceptance transferred to those versions.
2. A separately designed fresh BrowserWindow/WebContents recovery-owner lifecycle,
   including the necessary **src/main.ts protocol-ready owner rebinding beyond
   the caption-registration-only allowance**, state restoration and stale-owner
   regressions. Current `src/main.ts:165-167,204-207` attaches protocol readiness
   to the created window; silently recreating it inside recovery would risk
   breaking this retained behavior. No such recreation was implemented.

No rendererTrust, shared-trust, preload-config or protected-path edit was made.
Stop at this delta rather than weakening trust, disguising a native defect as a
fixture correction, or claiming a GREEN double replaced failed crash runtime.

## Fresh gates and negative controls

- `pnpm typecheck` → **0** (G-D1).
- `pnpm test` → **0**, **29 files / 349 tests** (345 retained + four added).
- `pnpm lint` → **0** (G-D3).
- `node proof/T17/check-emission-mutations.mjs` → **0**:
  unchanged-source control assertion **0**; omission **1**, wrong filename **1**,
  truncated bytes **1**. Each build itself exits 0; the verifier rejects the
  three mutants. Source hash invariance retained.
- Full `T17_PORT=49206 ... node proof/T17/run-electron-runtime.mjs` → **1**;
  all eight cases above run; no full-runtime acceptance.
- Native-only synchronous and deferred lifecycle controls → **1 / 1**.

Gate logs/exit receipts: `v4/{typecheck,test,lint,emission,runtime}.{log,json}`;
mutation specifics: `v4/emission-controls.json`. Added unit regressions prove
current-frame replacement, identical-URL stale-frame refusal, sticky-detached
refusal, and previous-owner refusal. They pass against unchanged production code
and are **boundary tests, not a repair or native post-crash acceptance**. Existing
subframe/file/data/other-file/query/hash/encoding/destroyed/unrelated-privilege
negatives remain intact and pass.

## Rendering and safety

Screenshots in `v4/runtime/` show the actual emitted document. The inspected
`darwin-full-v3-offline.png` and `win32-full-v3-offline.png` are legible and unclipped,
with Retry; Darwin suppresses HTML captions, Windows presentation displays all
three. Screenshots do not establish action success. Windows presentation is
simulated on macOS with the unchanged production preload; installed Windows/Linux
and macOS native traffic-light behavior remain unverified.

`v4/workflow-scope-audit.json` re-enumerates all **four** live workflow entries,
rechecks every frozen workflow/script hash and protected-source invariance, and
confirms no automatic publisher. No CI runs were watched, polled, rerun or awaited.
No production, installed/package app, src/main.ts execution, local packaging,
signing, notarization, release, merge, credential/token/decision/STATUS/skill/memory
changes, or shared-process termination occurred. The native renderer crash was
limited to this harness's own process. Owned scratch trees were removed in finally;
resource-release verification is in `v4/resource-release.json`.

Exact changed paths and hashes are enumerated in `v4/changed-files.json`.
The lane remains **BLOCKED** and must remain draft; Friday owns CI polling.
