# T17-v6 — destructive Close proof lifetime repaired

**Writer local combined gates PASS. Independent acceptance and integration remain parent-owned. PR39 stays draft; no merge.**

The repair is proof-only. Offline caption Close still executes real IPC, performs the real native Close and destroys its BrowserWindow. The crash/manual-Retry and crash/native-method characterizations now start a separate owner, independently load the configured hosted fixture, actually crash that renderer, and reach the real emitted fallback before their retained assertions. Each receipt names both fixture identities. No Close interception, destruction masking, fake native action, deadline increase, product fix or Electron44 known-gap waiver was introduced.

## Frozen inputs and source identity

| Input | Exact identity |
|---|---|
| Governing contract | `/Users/friday/Projects/mutiny-ui-review-20261002/devplan/tasks/T17-v6.md`, predecessors T17/v2/v3/v4/v5, E44-v1, DECISIONS7–9 |
| Starting T17/PR39 | `4324db1e43654fa464c5259cb47caa7f7fabfdf1` |
| Exact accepted E44 prerequisite | `1dc22d3e90a6f8766cbee04102e35b845ea1359f` |
| Automatic reviewed combined tree | `446b1b0acf2e4fc19065b9a071f8d6a9f3c1b590` |
| **Validated combined source tree** | **`302c6804e2baf28da27ce82a6610d6be504e61b8`** |

The separate disposable checkout retained T17 HEAD. `git merge-tree --write-tree` produced the exact reviewed automatic tree without conflicts; `git read-tree --reset -u` materialized it, then only the six candidate proof-source paths in `freeze.json` were applied. No merge commit, branch integration or manual conflict resolution occurred. The controller may integrate E44 separately; validation still used its exact frozen SHA.

`product-integrity.json` binds **109 non-proof paths** to frozen-T17 and reviewed-combined SHA256/Git blobs before/after. All writer product/dependency/workflow/trust/preload/security-test bytes match frozen T17; all disposable combined product bytes match the automatic composition of the two reviewed sources. `combined-product.diff` is intentionally empty against that reviewed composition; `combined-vs-t17-product.diff` and `combined-vs-e44-product.diff` expose each source's complementary product delta. **227 retained v5 files are byte-identical**, including RED evidence.

The source-only `combined-frozen-source.tar.gz` preserves all **577 source files/symlinks**; its tree manifest and archive-verification receipt verify every Git blob and mode. It contains no installed runtime, dependencies, caches or generated build. `verify.py` recomputes the tree and validates archive bytes, retained product/v5 hashes, executed gates and behavioral receipts without requiring the deleted scratch checkout.

## RED → GREEN

- `lifetime-red-real`: all four affected Electron44 cases (two presentations × crash/manual-Retry or crash/native-method) exit1 with **Object has been destroyed**, after real offline caption Close succeeds. Full receipts and screenshots are retained. This is fixture teardown/order RED, not a demonstrated Retry product failure.
- New classifier tests were first observed **4 failed /1 passed**: the predecessor mislabeled Electron44 refusals KNOWN-GAP. The fix limits that exact diagnostic exception to38.1.2. Final focused tests **21/21** pass; Electron44 detached refusal is fatal.
- The first binary-override attempt (`lifetime-red`) failed before runtime receipts; its ENOENT setup transcript remains retained and is **not** counted as RED. Explicit stock44 binary selection corrected launch setup.

## Complete combined runtime matrix

Actual native runtime **Electron44.5.1 / ABI149**, macOS15.7.3 x64. Builder Node22.23.3 and in-checkout pnpm10.18.1. Binary hash/path are in `binary-identity.json`.

| Scenario | Darwin presentation | Windows presentation on macOS |
|---|---|---|
| no-crash-no-cdp | PASS | PASS |
| crash-only | PASS | PASS |
| cdp-only | PASS | PASS |
| full-v3 | PASS | PASS |
| crash-retry-hosted | PASS | PASS |
| crash-native-os | PASS | PASS |
| no-crash-retry-hosted | PASS | PASS |

**14 cases /14 PASS /0 FAIL /0 KNOWN-GAP; aggregate exit0;64 caption attempts.** All existing maximize/unmaximize/minimize/Close assertions, IPC arrival counts, native event/state checks, scenario inventory and deadlines remain. Repeated Close counts are fixture-relative, not silently removed.

- Offline action tuples: hosted=false, offline=true, current contents/frame=true, detached=false. Restored hosted action tuples: hosted=true, offline=false, current contents/frame=true, detached=false. Every Close records close/closed and actual destruction.
- Independent crash follow-up fixtures have distinct BrowserWindow/WebContents IDs and a fresh actual crash/fallback, rather than reusing the destroyed caption owner.
- Four manual-Retry cases hide the owner to pause automatic retry, verify no pre-click request, click the real DOM Retry button, require **exactly one** `http://127.0.0.1:49270/app?configured=1` request and HTTP200 hosted restoration, then verify no automatic reload and all hosted native captions.
- Both crash/native-method cases require actual minimize/restore/close/closed and unchanged caption IPC counts. These are native **BrowserWindow main/OS methods**, not physical OS-input proof.
- Exact emitted fallback remains4933 bytes/SHA256 `33aba3c676f65b56a45ffcc3dde2a16c75846636717ca280087940f00c0ed712`.

## Commands, true exits and controls

Full argv, cwd, isolated environment, elapsed time and log hashes: `RESULTS.json`, individual `*.json`/`*.log`. The bounded runner is `run-gate.py`; all runtime children retain the original120s launcher deadline and behavior waits.

| Executed command in disposable combined checkout | Exit | Result |
|---|---:|---|
| `pnpm typecheck` |0| G-D1 |
| `pnpm test --reporter=default --reporter=json --outputFile=.../unit-results.json` |0| **32 files /372 tests**,0 failed/pending |
| `pnpm lint` |0| G-D3 |
| `T17_ELECTRON=<owned44 binary> T17_PORT=49270 T17_PROOF=.../runtime14 node proof/T17/run-electron-runtime.mjs` |0| Complete14/14 matrix |
| `node proof/T17/check-runtime-negative-controls.mjs` |0| Broken Retry/fallback/no-crash captions: matched clean exits0/0/0, mutants1/1/1, named behavior fails |
| `node proof/T17/check-emission-mutations.mjs` |0| Clean exact-byte verifier0; omit/wrong-name/truncate assertions1/1/1; each build0 |
| Launcher with `T17_ENGINE_PROBE=sync`, port49272 |0| Native-only current frame detached=false after actual crash/load |
| Launcher with `T17_ENGINE_PROBE=deferred`, port49273 |0| Same deferred control |
| `node proof/E44/verify-lock-scope.mjs` |0| Exact Electron closure/ABI seam still confined |
| `pnpm exec vitest run proof/T17/v6/classifier-v44.test.mjs proof/T17/runtime-result.test.mjs` |0|21/21, final matched run in scratch |
| `python3 proof/T17/v6/verify.py` |0| Tree/archive/source/behavioral-receipt integrity |

Runtime mutants exist only in disposable copies; candidate product hashes before/after match. No producer security test was changed. Unsigned packaging was **not rerun** by this T17 writer; E44's separately reviewed packaging proof is not substituted for this matrix or expanded into release acceptance.

## Electron38 remains explicitly diagnostic

The writer branch still pins38.1.2; E44 is a separate prerequisite. A fresh diagnostic run of the two affected scenarios in both presentations gives aggregate **exit1**: post-crash manual Retry **FAILS** in both; native methods work but offline captions retain the exact38-only KNOWN-GAP. See `baseline38*.json/log` and `baseline38/`. No38 recovery acceptance is claimed. All earlier v5 RED evidence is unchanged.

## Visual inspection and remaining gaps

The actual independent fallback screenshots are unclipped/readable, with Server/Retry simultaneously visible; Darwin hides HTML captions and Windows presentation exposes all three. The restored hosted capture is a deliberately plain loopback fixture, not the Mutiny app or product visual acceptance. Native effects are established by IPC/state/events, not screenshots.

Windows presentation is macOS runtime, **not physical/native Windows acceptance**. macOS arm64/Windows/Linux exact-final-tree installed runtime/packaging, physical keyboard/taskbar/traffic-light input, capture/audio/TCC, signed notifications, native addons, updater/rollback, signing/notarization/release remain unverified. The approved Electron44 platform floor does not approve any of those actions.

## Cleanup, scope and publication boundary

`cleanup.json`: entire owned scratch checkout/runtime/dependencies/caches/build/user/session data removed (**42,950 files**),0 owned processes before disposal, no process kills, all ten49270–49279 ports bind before/after. The initial writer-tree classifier run generated one ignored203-byte Vitest cache; it was identified, removed, and the final matched control ran in disposable scratch. No product file changed.

`workflow-preflight.json` records frozen source plus live workflow inventory. Automatic branch publication is absent; PR build is Ubuntu validation/package only; candidate/release workflows are manual-only. The API's historical active brand workflow has no current source file (404). No workflow/credential changes, dispatch, CI watching, production access, installed-Mutiny action, `src/main.ts` launch, signing, release or merge occurred. Final publication is an ordinary fast-forward proof-only successor to PR39, with exact head/draft readback; parent owns independent checking and hosted CI observation.
