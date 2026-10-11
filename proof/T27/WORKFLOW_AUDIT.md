T27 publication-safety audit

Live main at audit: 405092bff4044f0ffd23b0fb06e909dc3535495c (same as assigned base).
All three current workflow sources and invoked source scripts were retrieved
from that exact GitHub ref, byte-compared with local files, and preserved under
proof/T27/workflow-audit. receipt.json binds paths/head; forge.config.ts.source
is a source snapshot renamed to avoid including audit copies in TypeScript gates.

Current workflow sources:
  build.yml: workflow_dispatch + path-filtered pull_request. No branch push,
    tag push, or release event. Hosted ubuntu-latest; lint/typecheck/test then
    pnpm run package. PR creation without suppression would package: forbidden.
  desktop-candidate.yml: workflow_dispatch only. Hosted Mac/Windows make path
    invokes Forge, Mac dev-ad-hoc signing postPackage hook, candidate staging,
    and Actions artifact uploads. Not dispatched or executed here.
  release.yml: workflow_dispatch only. make + artifact upload followed by
    softprops/action-gh-release with draft:false/prerelease:false. Public release
    publication remains protected. Not dispatched or executed here.

Invocation trace reviewed read-only:
  package.json package/make/publish scripts → Forge definitions.
  forge.config.ts makers and GitHub publisher; macOS postPackage invokes
    scripts/macos-sign.mjs → scripts/macos-signing-verification.mjs.
  candidate invokes scripts/stage-desktop-candidate.mjs.
  scripts/macos-notarize.mjs → verification helper also reviewed; no execution
    outside inherited synthetic unit tests (those substitute all system tools).

Live Actions metadata enumerates 4 workflows / declared total_count 4, all active.
It includes historical brand-check.yml ID256356989, absent from current main's
exact workflow directory (3 sources). Active metadata is not a durable guard;
no source was restored and no workflow state was changed.

Safe publication plan under accepted DECISIONS #18/#19:
  Only rebuild/F1009-T27 will be pushed. No tag/main push, dispatch, release,
    merge, --auto, --admin, force-push, signing or packaging.
  Candidate commit preserves literal skip-checks: true trailer, preceded by
    two blank lines, with --cleanup=verbatim. This suppresses PR hosted Build App;
    no automatic branch/tag/release paths exist in current source.
  Draft PR identifies bounded partial and unresolved Settings. Draft alone is
    not the suppression mechanism. Controller later requires independent local
    exact-head review. CI intentionally skipped, never represented as green.

No workflow, publisher, build, release, dependency, config, trust, or signing
source definitions changed by T27. No CI watching.
