## Task T17-v4 — BLOCKED / CONTRACT DELTA; no merge

Crash caption refusal is now isolated to **Electron 38.1.2's sticky detached
WebFrameMain wrapper**, not CDP or a captured Mutiny authorization reference.
No production recovery repair or full T17 acceptance is claimed.

### Runtime isolation (real emitted file + unchanged production preload)
| Separate scenario | Darwin exit | Windows-presentation exit | Authorization / detached |
|---|---:|---:|---|
| HTTP 503 fallback; no crash/CDP | 0 | 0 | allowed / false |
| Crash only | 1 | 1 | refused / true |
| CDP offline only, real -106 | 0 | 0 | allowed / false |
| Full v3 sequence | 1 | 1 | refused / true |

**8 cases: 4 pass / 4 fail.** Maximise/unmaximise/Minimise/Close IPC attempts are
made in every case. The failed cases receive all four commands, but the exact
current sender/main-frame wrapper reports detached=true, so no native action fires.
Fresh mainFrame, fromId and fromFrameToken lookups all return that same wrapper.
The full harness correctly exits **1**, without increased timeouts or removed assertions.

A **native-only counterexample**, importing Electron + node and no product
recovery/trust/controls/preload modules, reproduces the same defect both with
immediate and setImmediate-deferred post-crash loading (**exit 1 / 1**).
Pinned source sets detached=true on disposal and clears only disposed, not detached,
when updating the wrapper to a new RenderFrameHost.

### Scope stop / requested successor
The current caption predicate already resolves the current owner/frame per action.
Re-resolving through the documented APIs cannot repair this runtime flag.
Do not weaken detached-frame refusal. A successor must explicitly approve either:
- a **verified runtime fix/update**, with package/lock changes (fixed version not yet identified/tested), or
- a broader fresh-window recovery-owner lifecycle, including **src/main.ts protocol-ready rebinding outside the caption-registration-only allowance**.

No protected files or production code changed. Full explanation and source citations:
[`proof/T17/v4-CONTRACT-DELTA.md`](proof/T17/v4-CONTRACT-DELTA.md).
Version-matched retrieved sources and hashes: `proof/T17/v4/electron-authoritative-sources.json`.

### Fresh local gates
| Command | Exit | Result |
|---|---:|---|
| `pnpm typecheck` | 0 | G-D1 |
| `pnpm test` | 0 | G-D2: 29 files / **349 tests**, four added boundary regressions |
| `pnpm lint` | 0 | G-D3 |
| `node proof/T17/check-emission-mutations.mjs` | 0 | Clean assertion 0; omit/wrong-name/truncate assertions **1/1/1**; all builds 0; source unchanged |
| `T17_PORT=49206 T17_PROOF="$PWD/proof/T17/v4/runtime" node proof/T17/run-electron-runtime.mjs` | **1** | All eight isolation cases execute; failed crash acceptance retained |
| Same launcher with `T17_ENGINE_PROBE=sync` / `deferred` | **1 / 1** | Native-only RED controls |

The new unit tests characterize dynamic fresh-frame acceptance plus stale-frame,
sticky-detached and previous-owner refusal. They pass against unchanged production
code; they are **not a repair or Electron crash acceptance**. Existing detached,
subframe/file/data/other-file/URL-variant/destroyed/unrelated-privilege negatives remain intact.

### Evidence and screenshots
- `proof/T17/v4/isolation-summary.json`: complete per-action authorization matrix.
- `proof/T17/v4/runtime.log`, `runtime/*-runtime.json`: exact final runtime receipts.
- `proof/T17/v4/engine-{sync,deferred}.log`, `runtime/engine-{sync,deferred}.json`: native-only reproducer.
- `proof/T17/v4/{typecheck,test,lint,emission,runtime}.{log,json}`: gate receipts.
- `proof/T17/v4/runtime/darwin-full-v3-offline.png`.
- `proof/T17/v4/runtime/win32-full-v3-offline.png`.

Screenshots visually inspected: legible/unclipped, Retry visible, HTML captions hidden
on Darwin and visible for Windows presentation. **Rendering is not caption success.**
Windows presentation is simulated on macOS; installed Windows/Linux and native
traffic lights remain unverified.

### Safety / ownership
Frozen predecessor: `db249a04ae66fef949d3f1de92ea81d795a99929`.
Only tests and proof/T17 changed; exact paths/hashes: `proof/T17/v4/changed-files.json`.
Shared trust, offline production recovery, src/main.ts, preload, build configs,
dependencies, locks and workflows are byte-identical to the predecessor.
All four live workflow entries and frozen script hashes re-audited; no automatic
publisher. **No CI watch/poll/rerun/wait, dispatch, merge, production contact,
installed/package app launch, src/main.ts execution, local packaging/signing/
notarization/release, shared-process kill, credentials/tokens/decisions/STATUS/
skills/memory changes.** Only harness-owned Electron used, exclusively on **49206**;
controller-owned 49205 and its review clone/processes untouched. Port default remains
unchanged; scratch and owned resources are released with readback evidence.

**Draft remains BLOCKED. Friday owns hosted CI polling; no hosted success claimed for this successor.**
