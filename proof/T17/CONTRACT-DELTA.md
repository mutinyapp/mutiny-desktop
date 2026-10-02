# T17 — blocked contract delta: local caption-control authority

## Status and scope

**BLOCKED; no offline implementation or runtime acceptance is claimed.**

Prepared worktree: `/Users/friday/Projects/mutiny-rebuild/wt/T17`.
Branch: `rebuild/T17-offline-recovery`.
Frozen baseline: `b341130ec1584049c306ecc02f649e52622dba9e`.

No production connection, installed Mutiny launch, shared process termination,
package, signing, notarization, release, or merge was performed. Product source,
canonical contracts, STATUS, token values, and owner decisions are unchanged.

## Exact source evidence

At the frozen baseline:

- `src/main.ts:168` registers the existing `minimise`, `maximise`, and `close`
  handlers with `isTrustedIpc(event, mainWindow, BUILD_URL)` as their sole
  authorization predicate.
- `src/native/rendererTrust.ts:7-13` accepts only a configured HTTP(S) origin and
  a caller HTTP(S) URL with that same origin; a `file:` page always fails.
- `src/native/rendererTrust.ts:16-34` also requires the current main window's
  WebContents and exact main-frame identity. Preserving those checks matters.
- `src/native/windowControls.ts:22-25` returns without acting when authorization
  fails; `:28-32` registers the three caption actions.
- `src/world/window.ts:22-24` sends those same three commands from the existing
  renderer bridge. Merely calling this bridge from offline.html does not work.
- `src/main.ts:88-121,128-130` reuses the general trust functions for audio-file
  dialogs, permissions and display capture. Globally trusting a local page
  would improperly extend unrelated authority.
- `src/main.ts:213-218` restricts renderer-initiated navigation to the configured
  app origin. A main-process `loadFile` can load the fallback, but does not make
  its caption IPC trusted.

T17 allows `src/native/window.ts`, new `src/native/offline*`, assets, tests and
`proof/T17/`; it asks for working existing trusted IPC with no new privileges.
The delegation additionally prohibits auth/security changes and explicitly
requires a contract delta if that trust cannot support the bundled page.

## Executed counterexample

`pnpm exec vitest run tests/offlineTrustBoundary.test.ts`, using the saved
requirement assertions in `red-caption-requirement.test.ts.txt`:

- exit 1; 3 failed / 3 passed (6 total).
- Each bundled-file caption assertion fails: expected action once, actual zero.
- Each configured-HTTP(S)-main-frame positive control succeeds.

The probe invokes the real production `registerWindowControlHandlers` and
`isTrustedIpc`; only the external Electron event/window objects are fakes. This
is executable authorization evidence, **not an Electron runtime test**.

The committed test is explicitly a **boundary characterization**, not a
weakened feature acceptance test. It records that those file calls must remain
rejected until the narrow exception is approved. The red source/log is retained
separately and the requirement is still unmet.

## Requested narrow CONTRACT DELTA (not implemented)

Approve precisely one additional product path, **`src/main.ts`**, and a scoped
caption-only authorization change at the registration currently on line 168.

Proposed shape:

1. Keep `isTrustedIpc`, `isTrustedContents`, and `hasConfiguredOrigin` unchanged.
2. Add a helper under the already allowed `src/native/offline*` paths that
   validates the active offline document against a **main-process-owned exact
   bundled file URL** (including only main-process-constructed class parameters).
   Require current main-window/WebContents identity, exact main-frame identity,
   non-destroyed objects, and matching current main-frame URL. Do not accept
   `file:` generally, a directory prefix, an origin of `null`, a `data:` URL,
   arbitrary query values, another window, or a subframe.
3. At the existing registration only, authorize caption actions for either the
   existing trusted hosted main frame or that exact active offline main frame.
   Retain existing three channels and main-process action implementations.
4. Do not grant the offline document config writes, autostart, badges, dialogs,
   audio files, media/notification/display permissions, protocol authority,
   arbitrary IPC, arbitrary navigation, or a new broad renderer bridge.
5. Implement Retry/backoff under native offline recovery, bound to the configured
   app URL; no renderer-supplied navigation target and no reconnect reload of a
   successfully loaded app. Prove cleanup, hide/minimize pause, and recovery reset.
6. Add negative tests for other local files, URL variants, subframes, other and
   destroyed windows, and every unrelated privilege. Then run isolated Electron
   runtime proof of the emitted bundled asset and real retry/caption path without
   launching `src/main.ts` or installed Mutiny (avoids single-instance/updater/
   protocol/autostart/control-server side effects).

This is a requested explicit exception to the prohibition on auth/security
changes, not an assertion that current authorization already supports offline
controls. No approval is inferred and no new listeners or trust workaround have
been added under the allowed paths.

The frozen T17 note says T25 generates these colors; the delegation corrects the
follow-up to **T26**, which should replace the temporary dark token literals.
No canonical packet was edited.

## Gate evidence

Baseline dependency setup:
`pnpm install --frozen-lockfile --ignore-scripts` → exit 0.
Electron is not run for this characterization, and lifecycle scripts were not run.

Baseline at the frozen product source:

- `pnpm typecheck` → exit 0.
- `pnpm test` → exit 0; 21 files / 191 tests passed.
- `pnpm lint` → exit 0.

The draft evidence PR contains six additional characterization tests:

- `pnpm typecheck` → exit 0.
- `pnpm test` → exit 0; 22 files / 197 tests passed.
- `pnpm lint` → exit 0.

Commands, exit codes and counts are recorded in `candidate-gates.json` and the
three `candidate-*.log` files. There were no preexisting gate failures and no
candidate gate failures. Green diagnostic gates do not fulfill T17.

## Remaining / unverified

All product acceptance remains open: bundled offline.html, error classification,
Retry, visibility-aware 5/15/30/60-second backoff, real local caption actions,
renderer-crash recovery, no reload of an already loaded app, token-colored
rendering and screenshots. No bundled build/runtime or Windows/Linux acceptance
is claimed. Resume implementation only after the contract delta is approved.
