# T26 CI scope boundary

The worker is authorized to push and open a PR, but explicitly forbidden to package, sign or release.

Observed source at desktop baseline `75ac011dd6dbe482ed58359d1d3274fe609e9b65`:
- `.github/workflows/build.yml` triggers on `pull_request` for `src/**` and `tests/**`.
- Its final `Build` step executes `pnpm run package`.
- GitHub's workflow API reports that workflow active. A draft PR would not prevent it.
- The release and candidate workflows are dispatch-only; no dispatch is authorized or performed.

This review artifact therefore uses the documented `skip-checks: true` commit trailer (two empty lines before the trailer, committed with `--cleanup=verbatim`). No `[skip ci]` marker, workflow edit, repository setting change, merge, package, signing, or publication is performed. This is an explicitly CI-skipped PR, **not green hosted CI**. The mandatory desktop local typecheck/test/lint gates run without skips; hosted CI is not an acceptance gate in T26/G-D1..G-D3.

Before any later CI or integration requiring that workflow, the parent must obtain an explicit build-only/no-package workflow successor or packaging authorization. Do not remove the trailer or rerun/dispatch workflows inside this worker lane.

Authoritative skip behavior: https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/skipping-workflow-runs
GitHub documents that `skip-checks: true` suppresses push/pull_request workflows, not pull_request_target or workflow_dispatch. The exact current trigger inventory was inspected before publication; there are no pull_request_target jobs in this candidate.
