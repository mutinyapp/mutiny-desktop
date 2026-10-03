# T17-v5 — BLOCKED: post-crash manual Retry is outside the caption-only waiver

**No T17 acceptance or merge. Keep PR39 draft.** The v5 characterization and
honest exit semantics are implemented, but the new required scenario exposes a
hard failure beyond DECISIONS #8: **the actual Retry button is refused after a
renderer crash**. No production code or trust/dependency/build/workflow change
was made to hide or repair it.

## Owner decision and retained boundary

Governing packet: `/Users/friday/Projects/mutiny-ui-review-20261002/devplan/tasks/T17-v5.md`,
retaining T17/v2/v3/v4 and DECISIONS #7/#8. Decision #8 waives only crash-recovery
caption refusal on Electron **38.1.2**, not missing fallback, broken Retry, or
broken native OS controls. E44 remains the separately approved runtime lane:
`/Users/friday/Projects/mutiny-ui-review-20261002/devplan/tasks/E44-v1.md`.
The disposable 44.5.1 spike's eight original runtime cases pass, but it did not
contain this new manual post-crash Retry characterization; no new E44 proof is
claimed here. Its README retains its own dependency/acceptance/platform holds:
`/Users/friday/Projects/mutiny-rebuild/spikes/T17-electron44/README.md`.

Starting checkout was clean on `rebuild/T17-offline-recovery`, with local HEAD,
tracking origin, actual remote branch and PR39 all equal to
`c6f0b0306b81dd1028f5c87e4791417061b67ca0`; main was
`ec76ff76991bda4173bb8dcc4c35cfadc73b6bc1`. Preflight was read-only.
All changes are confined to **proof/T17/**. Source invariance checks cover all
**109 tracked non-proof files**, not just selected security paths.

## New characterization: Retry, automatic recovery, hosted captions, OS escape

Each presentation runs in its own repo Electron **38.1.2** process and fresh
window, using the real emitted 4933-byte asset and unchanged production preload,
recovery, renderer trust and caption handlers. The served HTTP 200 document is a
loopback fixture with buttons using the existing native bridge, **not the remote
production Mutiny application**.

### Crash → offline → manual Retry

1. The owned renderer loads the configured HTTP 200 fixture and is forcefully
   crashed; the actual Server fallback appears.
2. All four caption intents are delivered and refused with the documented tuple.
3. The harness hides the window to pause automatic retry, changes its loopback
   server to HTTP 200, and clicks the real Retry DOM button. This prevents the
   automatic timer from falsely satisfying manual Retry.
4. After the unchanged one-second observation, **no configured request occurred**:
   request delta is empty and server hits remain **1 → 1**, in both presentations.
   The real `will-navigate` intent arrived, was prevented, and had the same
   detached/current-frame refusal tuple as the offline captions.
5. A matched **no-crash paused-timer control** runs the same hide/button procedure:
   it recovers via manual Retry, requests the configured URL exactly once, and
   server hits become **1 → 2**, in both presentations. This rules out the hide or
   DOM-click fixture as the cause of the crash-only Retry refusal.

The navigation observer runs **before** the unchanged recovery listener can
revoke the owned document, so the positive Retry authorization is recorded at
entry rather than after successful navigation has already deleted its authority.

Source explanation: `src/native/offlineRecovery.ts:109-116` authorizes Retry
through `isOfflineCaptionIpc`; `:18-19` refuses its still-detached current wrapper.
This couples the otherwise caption-scoped crash gap to manual Retry. That code
is unchanged. Full tuples and actual request/response observations, not a mock
or source inference alone, are retained in `v5/runtime-verified/*-runtime.json`.

### Explicitly distinguished automatic restoration

After the failed manual attempt, the harness shows its window and lets the real
main-process timer recover to HTTP 200. Receipts label this mechanism
**`automatic retry after show`**, never successful manual Retry.
The restored hosted fixture's Maximise/unmaximise/Minimise/Close all authorize
**`hosted=true`** and perform real native effects, although the current wrapper's
`detached` flag remains true. The unchanged hosted predicate differs from the
exact-file offline predicate; no guard or product trust was modified.

**The specific step-4 hosted-caption stop condition is NOT triggered.** Its
`stopBeforeReadyUpdate=false` observation is retained. Nevertheless, the separate
step-2 Retry hard requirement fails, so the requested ready-for-independent-review
status is not truthfully available. The exact manual-Retry-to-restored-hosted
sequence cannot be claimed: automatic retry, not that button, restored the page.

### Native OS control path

Separate `crash-native-os` cases invoke **BrowserWindow.minimize()/restore()/close()**
from main after the crash and refused HTML captions, as contracted for OS-frame,
taskbar or Alt+F4-equivalent main-process behavior. Both presentations produce
`minimize, restore, close, closed`, with no new caption IPC. Renderer authorization
is **not applicable**, not fabricated as an allowed renderer tuple. The owned
window can be closed/minimized through the native main-process path.

These are native methods exercised on **macOS**; Windows presentation is simulated
by the existing test-only preload constant. No physical/installed Windows, Linux
or actual Alt+F4 acceptance, and no macOS traffic-light click proof, is claimed.

## Complete retained and extended runtime matrix

Tuple order is **(hosted, offline, self, sameContents, sameFrame, detached)**.
Every row exists for **Darwin and Windows presentation**, with identical flags
for each Maximise/unmaximise/Minimise/Close action. Full sender/current URLs,
process/routing identities and lookup identities remain in the raw receipts.

- **A** = `(false,true,true,true,true,false)`; offline captions authorized/effective.
- **B** = `(false,false,false,true,true,true)`; offline captions refused/no native effect.
- **C** = `(true,false,false,true,true,true)`; restored hosted captions authorized/effective.
- **D** = `(true,false,false,true,true,false)`; no-crash restored hosted captions authorized/effective.

| Scenario (each presentation) | Exit / named result | Per-action authorization |
|---|---|---|
| retained no-crash/no-CDP HTTP 503 fallback | 0 / PASS | A × 4 |
| retained crash only | 0 / KNOWN-GAP | B × 4 |
| retained CDP-only real -106 offline fallback | 0 / PASS | A × 4 |
| retained full-v3 sequence, including auto retry/pause/manual recovery/no reload/crash/CDP | 0 / KNOWN-GAP | B × 4 |
| added crash → Retry → explicitly automatic HTTP 200 restoration | **1 / FAIL** | B × 4 on offline; C × 4 on hosted; Retry B |
| added post-crash native OS methods | 0 / KNOWN-GAP | B × 4 HTML intents; native OS path succeeds independently |
| added no-crash matched paused-timer Retry control | 0 / PASS | Retry A; D × 4 hosted captions |

**14 cases: 6 PASS / 6 KNOWN-GAP / 2 FAIL; 64 caption IPC attempts.**
Original eight cases are retained, not removed, filtered out of acceptance,
rewritten as successful captions, or given longer deadlines.
The aggregate launcher honestly exits **1** because both crash-Retry cases fail.
Named gap: **`ELECTRON38-CRASH-OFFLINE-CAPTION-REFUSAL`**. Raw refusal tuples are
reported even when another hard failure makes the overall scenario FAIL.

## Honest exit semantics and negative controls

`runtime-result.mjs` allows KNOWN-GAP only for the exact crash/offline caption
refusal tuple with delivered IPC, no native effect, and the specific authorization
refusal outcome. Non-crash and CDP-only actions remain hard-required. Missing IPC,
missing native effects, altered owner/frame/detached tuples, restored-hosted refusal,
missing action inventory and every independent hard failure still exit nonzero.

TDD semantic RED: **16 cases, 14 pass / 2 fail, exit 1** against the inherited
all-caption-errors-are-fatal rule; GREEN: **16/16**. The initial Node-runner test
was picked up by Vitest without a Vitest suite, causing an initial full-suite
failure despite the retained 349 passing tests. The assertion set was moved to
the repository's Vitest runner; final full gate is **365/365**, no skipped cases.
Initial RED/setup receipts are retained separately, not relabeled green.

`check-runtime-negative-controls.mjs` copies unchanged candidate product and the
current fixture into owned disposable trees, symlinks existing dependencies,
and runs a clean control before each independent mutation. Candidate source
hashes remain unchanged. Actual **launcher process exits**, not merely a caught
assertion status, are recorded:

| Disposable mutation | Clean launcher | Mutated launcher | Required named failure observed |
|---|---:|---:|---|
| disable manual Retry at its existing navigation action | 0 / PASS | **1 / FAIL** | Retry button did not recover configured HTTP 200 app |
| point fallback load at a missing emitted file | 0 / PASS | **1 / FAIL** | real HTTP failure → emitted offline page times out |
| omit native caption actions after authorization, without crash | 0 / PASS | **1 / FAIL** | native maximize/minimize missing; real native event absent |

The negative-control **driver exits 0 only because it verifies all three clean
0 / mutant 1 pairs and named behavioral failures**. It does not make the candidate's
failed post-crash Retry pass. All disposable trees are removed in `finally`.

## Verified final gates

| Exact command | Exit | Actual result |
|---|---:|---|
| `pnpm typecheck` | 0 | G-D1 |
| `pnpm test` | 0 | G-D2: **30 files / 365 tests**, 349 retained + 16 added |
| `pnpm lint` | 0 | G-D3: no errors or warnings |
| `T17_EMISSION_RECEIPT="$PWD/proof/T17/v5/emission-controls.json" node proof/T17/check-emission-mutations.mjs` | 0 | clean verifier 0; omission/wrong-name/truncation **1/1/1**; all builds 0; 4933 bytes identical |
| `T17_PORT=49206 T17_PROOF="$PWD/proof/T17/v5/runtime-verified" node proof/T17/run-electron-runtime.mjs` | **1** | complete 14-case matrix; manual post-crash Retry is hard failure |
| `node proof/T17/check-runtime-negative-controls.mjs` | 0 | three clean 0 / mutant 1 launcher pairs |
| `node proof/T17/verify-v5-evidence.mjs` | 0 | totals, 109 protected files, all 4 live workflows and resource release verified |

A first evidence verifier hit Node's default execFileSync buffer on a large
unchanged icon asset. Its buffer was sized from the file's real byte count;
final invariance verification passes. No source hash comparison was omitted.

## Proof map and visual inspection

- `v5/characterization-summary.json`: compact per-action tuples, Retry facts and OS results.
- `v5/runtime-verified/isolation-summary.json`: full final matrix and exact totals.
- `v5/runtime-verified/*-runtime.json`: each scenario's native authorization/events/requests.
- `v5/verified-{runtime,typecheck,test,lint}.{log,json}`: final exact command exits.
- `v5/final-tests.json`: separate complete 365-case JSON test inventory.
- `v5/negative-controls/results.json` and individual clean/mutant logs/receipts.
- `v5/emission-controls.json`: byte/emission mutant receipts.
- `v5/workflow-scope-audit.json`: all protected hashes and four live workflow entries.
- `v5/resource-release.json`: owned scratch paths removed; no owned Electron process;
  successful bind/close on all four permitted ports **49206–49209**.
- `v5/runtime-verified/{darwin,win32}-crash-retry-hosted-crash.png`: inspected actual
  fallback captures; wordmark, Server pill, copy and Retry legible/unclipped;
  Darwin HTML captions absent and all three Windows-presentation captions visible.
  Screenshot appearance never counts as action success.

`v5/runtime/` preserves the preliminary 12-case characterization before the matched
no-crash control. `runtime-final/` retains the 14-case run before the Retry observer
ordering correction. Only `runtime-verified/` is final acceptance evidence.

## CONTRACT DELTA / next owner decision

**Do not broaden the caption-only waiver or weaken Retry/frame authorization.**
The new impact is not hosted captions staying broken until restart; hosted captions
recover via automatic restoration. It is **post-crash manual Retry refusing to
navigate**, even with a responding HTTP 200 server.

Friday must route this separate failure to Petie: either require E44 to prove the
new crash/manual-Retry scenario before T17 acceptance, or obtain a new explicitly
bounded acceptance decision covering manual Retry and its automatic-recovery
fallback. No expanded approval is inferred and no such change is implemented.
PR39 may be updated with this **blocked evidence**, not marked ready.

No production contact, installed/package Mutiny launch, src/main.ts execution,
packaging/signing/notarization/publication/release, merge, CI watch/poll/dispatch,
shared-process kill, dependency/preload/trust/build/workflow or credentials/
DECISIONS/STATUS/skills edits. Only harness-owned Electron and permitted ports
were used. The branch is frozen for independent review of this blocker.
