## Task
T17 — **BLOCKED; draft evidence PR, not an implementation or acceptance claim.**
Baseline: `b341130ec1584049c306ecc02f649e52622dba9e`.

## Summary
- Preserve the existing security boundary and product source unchanged.
- Add six characterization tests for existing caption IPC: three bundled-file refusals and three configured-origin positive controls.
- Preserve the RED requirement probe (3 failed / 3 passed) plus exact baseline/candidate gate logs.
- Request a narrow approved contract delta before implementing bundled offline recovery.

## Contract delta — approval required
`src/main.ts:168` authorizes caption IPC using `isTrustedIpc`; `rendererTrust.ts:7-13,16-34` deliberately rejects `file:` renderers, and `windowControls.ts:22-32` consequently performs no caption action. Merely reusing the preload bridge cannot make offline caption buttons work.

Request permission to modify **only the caption-handler registration in `src/main.ts`**, plus a new helper under the already allowed `src/native/offline*` paths, to allow the exact main-process-owned bundled offline document in the current main window/main frame for the existing three caption actions only. Keep shared renderer trust and all config/autostart/badge/dialog/media/notification/display-capture authorization unchanged. No generic file trust, new broad bridge, duplicate IPC workaround, or security exception has been implemented.

Full exact-source evidence, negative-test requirements and proposed scope: [`proof/T17/CONTRACT-DELTA.md`](proof/T17/CONTRACT-DELTA.md).
The generated-color follow-up is **T26**, not the frozen packet's T25 typo; no canonical packet edits.

## Gate results
Dependency setup: `pnpm install --frozen-lockfile --ignore-scripts` → exit 0.

| Command | Baseline | Evidence candidate |
| --- | --- | --- |
| `pnpm typecheck` | exit 0 | exit 0 |
| `pnpm test` | exit 0; 21 files / 191 tests passed | exit 0; 22 files / 197 tests passed |
| `pnpm lint` | exit 0 | exit 0 |

No preexisting failures. Green characterization tests are **not offline feature acceptance**.

RED counterexample: `pnpm exec vitest run tests/offlineTrustBoundary.test.ts`, against saved `proof/T17/red-caption-requirement.test.ts.txt`, → exit 1; 3 caption requirements failed, 3 configured-origin controls passed. The source snapshot and transcript preserve the unmet requirement; the committed test explicitly characterizes current denial.

## Proof artifacts / screenshots
`proof/T17/` contains baseline/candidate logs and gate receipts, RED source/transcript and the contract delta.
**No screenshots, bundled build or Electron runtime proof:** implementation is blocked pending authorization approval. Nothing installed or packaged was launched.

## Remaining
All product implementation/acceptance remains open: bundled offline page, error classes, explicit Retry, visibility-aware 5/15/30/60-second backoff, crash recovery, actual safe caption controls, token colors, built-asset reachability and Windows/Linux runtime proof.

No production access, installed Mutiny launch, shared process termination, packaging, signing, notarization, publishing, merge, secrets or auth/security changes were performed.
