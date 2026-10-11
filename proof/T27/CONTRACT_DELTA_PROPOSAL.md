CONTRACT_DELTA_PROPOSAL — T27 Settings (unresolved; approval required)

Retained requirement: Settings opens the existing web settings route via IPC.

Evidence at exact frozen inputs:
  Desktop base 405092bff4044f0ffd23b0fb06e909dc3535495c:
    src/world/window.ts:7–11 dispatches mutiny-protocol-url after protocol-url.
    src/world/window.ts:41–45 exposes native.onProtocolUrl.
  Web origin/main b4cb2f74229cccc6bc9b832d9dcb67d7a80d5240:
    packages/client/src/index.tsx:68–72 SettingsRedirect opens user settings.
    packages/client/src/index.tsx:167 registers /settings.
    packages/client/src/Interface.tsx:35–48 intercepts router /settings navigation.
    Complete tracked-tree git grep for protocol-url, mutiny-protocol-url and
    onProtocolUrl exits 1: no renderer consumer exists. A route alone is not an
    IPC listener. The current mutable web checkout is not this frozen baseline;
    diagnosis used git show/grep against the exact named SHA.

Scope conflict:
  T27 may edit only tray source/policy/assets/new tests/proof. It may not edit
  web routing, world/preload/window, IPC authority, CSP, config, or loadURL.
  Sending an event with no listener cannot meet the retained requirement.

Exact proposed successor scope (NOT implemented or authorized here):
  Add a separately owned web change in
    packages/client/src/Interface.tsx
    and a task-specific renderer routing test,
  with a narrowly validated consumer of the EXISTING native.onProtocolUrl
  subscription, accepting ONLY mutiny://settings, navigating through the
  EXISTING router to /settings, and disposing the subscription on unmount.
  After accepted web prerequisite, permit src/native/tray.ts to send exactly
  protocol-url / mutiny://settings to the current owned main frame using the
  existing rendererTrust boundary and configured BUILD_URL checks; no new IPC
  channel, preload method, executeJavaScript, loadURL change, or trust/CSP delta.
  Freeze the exact web prerequisite and desktop combined head; require RED→GREEN
  end-to-end synthetic settings-open proof plus malformed/foreign protocol
  negatives, offline/stale/subframe refusal and listener teardown tests.

Current candidate disposition:
  Independent icons, five menu entries, restore/show/focus, real About version
  dialog wiring, and existing Quit callback are implemented. Settings is visibly
  disabled with no click handler rather than a fake action. This is a bounded
  partial, NOT task completion, NOT independent GO, and NOT merge/release approval.
