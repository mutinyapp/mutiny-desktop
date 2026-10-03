## Task
T17-v2 — **BLOCKED; diagnostic draft, not offline-recovery implementation.**
Contract: `/Users/friday/Projects/mutiny-ui-review-20261002/devplan/tasks/T17-v2.md`.
Accepted main: `ec76ff76991bda4173bb8dcc4c35cfadc73b6bc1` (T18 included).

## Summary
- Verified the sole released T17 worktree/branch clean at the predecessor PR head `23695ec12e53e822659527fcae5d6fa5f05c73e3`.
- Reconciled accepted main by ordinary merge; no rebase, force-push or merge into main.
- Preserved the six existing trust-boundary tests and RED caption requirement evidence unchanged. The caption-only exception is approved by decision 7; its old blocker is superseded.
- Found and executed a separate build-asset scope blocker before implementing product behavior. Product source equals accepted main.

## Exact new CONTRACT DELTA — approval required
The contracted emitted bundled `offline.html` cannot be delivered by the current allowed source/asset paths alone: Forge's Vite main build is a library, which always inlines HTML URL imports; its packager excludes all files outside `.vite`, and public copying is disabled. The real installed-config probe emits **1 JS / 0 HTML files** with a `data:` URL and fails the required HTML-file assertion.

Request **`vite.main.config.ts` only for a narrow offline-asset emission plugin**, emitting byte-identical `assets/desktop/offline/offline.html` into `.vite/build/offline.html` in the existing main build. No other options/configs/workflows/dependencies/signing/publication changes. All T17-v2 trust and behavior requirements stay unchanged. No plugin or security exception was implemented.

Full evidence and precise proposal: [`proof/T17/v2-CONTRACT-DELTA.md`](proof/T17/v2-CONTRACT-DELTA.md).
Predecessor evidence remains [`proof/T17/CONTRACT-DELTA.md`](proof/T17/CONTRACT-DELTA.md), explicitly superseded for its caption-approval hold.

## Gates — diagnostic, not recovery acceptance
| Command | Exit | Count/result |
| --- | --- | --- |
| `ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm install --frozen-lockfile --ignore-scripts` | 0 | dependency setup; no lifecycle scripts |
| `pnpm exec vitest run --exclude tests/offlineTrustBoundary.test.ts` | 0 | 23 files / 245 main tests pass |
| G-D1 `pnpm typecheck` | 0 | pass |
| G-D2 `pnpm test` | 0 | 24 files / 251 tests pass (245 main + 6 predecessor diagnostics; 0 new feature tests) |
| G-D3 `pnpm lint` | 0 | pass |
| `TMPDIR=/Users/friday/.hermes/profiles/friday/cache/scratch node proof/T17/check-asset-emission.mjs` | 1 | expected RED: 1 failed emitted-HTML assertion; JS contains inline data URL |

Receipts/logs: [`proof/T17/v2-gates.json`](proof/T17/v2-gates.json) and `v2-*.log`.
Workflow source + invoked scripts + all 4 live active entries audited before push/PR update: [`proof/T17/v2-workflow-audit.json`](proof/T17/v2-workflow-audit.json). Current automatic PR workflow has no public writer; publisher/candidate workflows are dispatch-only and were not dispatched. No workflow settings changed.

## Screenshot / runtime
**None.** No offline UI, emitted product asset, or isolated repo-Electron runtime was implemented or accepted. The HTML file under `proof/T17/` is solely a diagnostic fixture, not a product page.

## Remaining / risks
All offline feature acceptance remains open: error policy/classes, Retry, visibility-aware backoff and cleanup, caption-only authorization and negative cases, no successful-app reconnect reload, real crash/recovery and platform controls, token-colored rendering, emitted asset/runtime screenshot. Green gates/CI here do not satisfy T17.

No production access/deployment, installed Mutiny launch, process kill, local package/sign/notarization, publishing, main merge, credential/DNS change, canonical contract/STATUS/token edit, or skill/memory change. No owned runtime/preview remains; desktop slot released. Resume under an approved successor with the exact build-config exception.
