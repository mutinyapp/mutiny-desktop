# T17-v2 — BLOCKED: bundled HTML emission needs one build-config path

## Status

**BLOCKED. No offline implementation, feature acceptance, screenshot, or Electron
runtime acceptance is claimed.** The owner-approved caption-only exception in
`tasks/T17-v2.md` is understood; the predecessor trust delta is no longer awaiting
approval. This is a different, build-asset scope blocker.

The sole released T17 checkout was verified clean at
`23695ec12e53e822659527fcae5d6fa5f05c73e3`, matching its origin branch and PR39.
Accepted `origin/main` at `ec76ff76991bda4173bb8dcc4c35cfadc73b6bc1` was reconciled
by ordinary merge, producing `f055d617707f69b14274d1ee5ce903be65b435c8`.
No rebase or force-push. Product source equals that accepted main; this successor
adds diagnostic evidence only. The six predecessor boundary tests and preserved
RED caption-requirement source/log are retained unchanged, not relabeled as
working offline caption controls.

## Exact conflict

The successor requires a **bundled `offline.html`**, authorizes only its exact
main-process-owned `file:` URL, and requires runtime proof of the **emitted
bundled asset**. Its allowed paths omit `vite.main.config.ts` and
`forge.config.ts`.

The actual installed stack is Vite **5.4.20**, Forge Vite plugin **7.9.0**:

- `forge.config.ts:188-210`: the main/preload builds are registered with no
  renderer builds. The main build uses `vite.main.config.ts`, which is just an
  empty `defineConfig({})`.
- `node_modules/@electron-forge/plugin-vite/dist/config/vite.main.config.js:10-15,25-30`:
  `copyPublicDir: false`; main output is a CJS **library** build.
- `node_modules/vite/dist/node/chunks/dep-D_zLpgQd.js:20473-20485`:
  `shouldInline` returns true immediately for `config.build.lib`; changing asset
  size or `assetsInlineLimit` does not cause a library HTML asset to emit.
- `node_modules/@electron-forge/plugin-vite/dist/VitePlugin.js:114-130`:
  Forge's default packager filter excludes everything outside `/.vite`.
  Merely putting a file under the allowed `assets/desktop/offline/` therefore
  does not make it available in the distributed app.

Version-matched official source:
https://v5.vite.dev/config/build-options.html#build-assetsinlinelimit
explicitly says `build.lib` always inlines assets, ignoring the inline limit.
The page was fetched successfully via Python urllib after the configured
web-extraction backend reported unavailable; no Hermes config was changed.

## Executed counterexample

`TMPDIR=/Users/friday/.hermes/profiles/friday/cache/scratch node proof/T17/check-asset-emission.mjs`
→ **exit 1**, one failed bundled-file assertion.

This diagnostic uses the installed Forge plugin's real `getConfig`, the actual
repository `vite.main.config.ts`, and a minimal HTML `?url` import. Only the
entry is replaced with a fixture so no application entrypoint runs.

Observed output: **one JS file, zero HTML files**. Its exported URL is
`data:text/html;base64,...`, not a bundled-file URL. The Vite build itself succeeds;
the required emitted-HTML assertion fails for the expected reason.
Source/log/receipt: `check-asset-emission.mjs`, `asset-emission-probe-entry.mjs`,
`asset-emission-probe.html`, `v2-asset-emission.log`, `v2-asset-emission.json`.

The fixture is explicitly **not product UI or an offline implementation**.
It does not run Electron, Forge package/make/publish, or signing.
The first probe used the host default temporary path despite the packet's TMPDIR
statement; it removed its owned directory in `finally`. The retained final probe
pins the assigned scratch path explicitly and also removes it in `finally`.
No resources are retained by the diagnostic.

## Requested exact CONTRACT DELTA (not implemented)

Add **`vite.main.config.ts` only for a narrowly scoped offline-asset emission
plugin** that emits the byte-for-byte authored
`assets/desktop/offline/offline.html` as `.vite/build/offline.html` during the
existing main-process build. Do not alter other build options, Forge packaging,
preload configuration, dependency manifests/lockfiles, workflows, signing,
publication, or release behavior.

Keep every T17-v2 security and runtime requirement unchanged: exact bundled-file
URL/current window/current WebContents/current main frame; caption-only exception
at the existing registration; shared renderer trust untouched; no new broad
bridge or unrelated privilege; Retry bound to configured app URL; visible-only
5/15/30/60-second schedule; no reload-on-reconnect of a successful app.

A small deterministic emission hook is sufficient; no general asset pipeline
redesign is proposed. No hook or unapproved config change was made.

Rejected substitutes: loading the development source asset path (not packaged),
trusting a `data:` URL (explicitly forbidden), or writing an embedded HTML string
at runtime into a writable cache (not the contracted emitted bundled file and a
different file-authority lifecycle). No approval for those is inferred.

Resume only after the orchestrator freezes an approved successor adding this
exact path. Then preserve/execute RED caption assertions before behavior changes,
implement all feature and negative tests, run the isolated repo-Electron runtime
harness and screenshot, all gates, and exact-head hosted build CI. Green diagnostics
cannot replace those acceptance criteria.

## Executed gates (diagnostic baseline, not offline acceptance)

- `ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm install --frozen-lockfile --ignore-scripts`
  → exit 0. No Electron runtime was installed/launched by this successor.
- Main inventory: `pnpm exec vitest run --exclude tests/offlineTrustBoundary.test.ts`
  → exit 0; **23 files / 245 tests passed**. All product source and those tests are
  unchanged from accepted main; the only excluded suite is the six predecessor
  T17 characterization assertions.
- G-D1 `pnpm typecheck` → exit 0.
- G-D2 `pnpm test` → exit 0; **24 files / 251 tests passed**
  (245 main + 6 predecessor diagnostic assertions; zero new feature tests).
- G-D3 `pnpm lint` → exit 0.

Logs and machine receipts are under `proof/T17/v2-*`. The repository signing and
notarization unit tests use synthetic applications and fake tools; these are not
real package/sign/notarization runs. Hosted Build App status is recorded in PR39;
any green build remains diagnostic, not T17 recovery acceptance.

## Workflow safety and remaining acceptance

`v2-workflow-audit.json` records all **four** live workflow entries (all active),
source/script hashes, and the automatic-event audit. Only `build.yml` is present
with a PR trigger; it lints/typechecks/tests and packages on Ubuntu, whose Forge
postPackage hook returns before the macOS signing script. `release.yml` (including
its public GitHub release writer) and `desktop-candidate.yml` are dispatch-only;
neither was dispatched. The active historical Brand Regression entry's source is
absent from current main/candidate (GitHub contents API 404), so it is not a
current automatic path. There are no branch-push/tag/release triggers in the
three current workflow sources and no automatic public writer. Draft status was
not used as a safety guard. No workflow setting or publication guard was changed.

All offline product behavior remains unimplemented/unverified, including policy,
backoff, trust exception, local caption actions, emitted UI, crash/recovery,
platform presentation, and runtime screenshot. No production access, installed
Mutiny launch, process kill, deployment, local packaging/signing/notarization,
release, merge, secret/credential/DNS change, canonical contract/token/STATUS edit,
or skill/memory modification was performed. The desktop slot has no running
owned Electron/preview process and is released for the independent checker.

Reusable lesson (returned here, not saved to protected memories/skills): establish
asset emission and the packager inclusion filter before building a local-file
fallback. Forge main library builds inline URL assets while its package filter
keeps only `.vite`; a source asset alone cannot satisfy emitted-file authority.
