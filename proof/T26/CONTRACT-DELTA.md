# T26 — historical scope blocker (resolved by T26-v2)

> Superseded by `/Users/friday/Projects/mutiny-ui-review-20261002/devplan/tasks/T26-v2.md`. The successor explicitly grants the bounded script/preload/config paths below. This predecessor receipt is retained as evidence; its "no implementation started" state describes the earlier worker, not the current candidate. Current outcome: `README.md`.

Governing contract: `/Users/friday/Projects/mutiny-ui-review-20261002/devplan/tasks/T26.md`.
Packet: `devplan/packets/friday-20261006-waveB/README.md`.
Baseline: `75ac011dd6dbe482ed58359d1d3274fe609e9b65` (fresh current desktop origin/main).
Worktree: `/Users/friday/Projects/mutiny-rebuild/wt/T26`.
Branch: `rebuild/T26-native-tokens-picker`.

## Evidence

- T26 line 5 allows only `src/native/{window,screenPicker,screenPickerResult,displayMedia}.ts`, `src/native/generated/*`, the offline page, tests, and proof artifacts; lines 28–29 forbid other changes.
- Requirement 1 (line 11) requires vendoring via `scripts/sync-tokens.mjs`. That script does not exist in this baseline and is outside the allowlist.
- Requirement 2 (line 12) requires the capability bridge `setAppearance('dark'|'light')` and durable cached appearance, default dark.
- `src/world/window.ts:13–45` is the actual contextBridge exposure of `window.native`; it has `getCapabilities` and `onCapabilitiesChanged` but no `setAppearance`.
- `src/native/window.ts:41–42` explicitly advertises `appearanceBridge: false`.
- `src/native/config.ts` wraps a private electron-store instance. Neither it nor `src/native/configSchema.ts` currently has appearance persistence.

## Proposed bounded successor scope

Add `scripts/sync-tokens.mjs` and `src/world/window.ts` to the writable paths. Also permit `src/native/config.ts` and `src/native/configSchema.ts` for a dedicated native-owned persisted appearance getter/setter/schema/default; do not expose appearance through the general renderer config update allowlist. No token-value changes or shared renderer-trust changes.

The appearance bridge must accept only the two enum values and authorize using the existing configured-origin/current-main-frame IPC policy, explicitly refusing detached frames. Keep file/data/subframe/stale-window callers denied, including the offline page (its existing caption-only exception remains unchanged).

Retain all original picker, offline, security, TDD and desktop gate requirements. Vendor the exact unchanged native-tokens.ts and manifest from web commit `db9de9e3e73ccc257d5a613e02b89d667bf1c0ce`.

## State

Stopped per worker.md line 20 before product edits. No source changes, tests, packaged-app launch, packaging, signing, release, push or PR creation performed. Only this blocker receipt was written; the new task worktree remains available for the approved successor.
