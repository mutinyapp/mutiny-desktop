# Version/API inputs

Detected from installed metadata and commands: Node v22.23.3, pnpm 10.18.1, Electron 44.5.1, Vitest 2.1.9. Browser proof resolves the existing Playwright 1.57.0 installation explicitly; no product dependency is added.

- Electron 44.5.1 BrowserWindow API: https://github.com/electron/electron/blob/v44.5.1/docs/api/browser-window.md#winsetbackgroundcolorbackgroundcolor — generated resolved hex values are valid `backgroundColor`/`setBackgroundColor` input.
- Electron 44.5.1 WebFrameMain API: https://github.com/electron/electron/blob/v44.5.1/docs/api/web-frame-main.md#framedetached-readonly — detached frames can occur while unload listeners run and the newly navigated page replaces them. The new appearance invoke refuses them in addition to the existing identity/origin check.
- Installed `electron.d.ts` declares `setBackgroundColor(backgroundColor: string): void`; production typecheck runs against those pinned declarations.
- GitHub Actions skip-message contract: https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/skipping-workflow-runs — `skip-checks: true` at the end of a commit after two empty lines suppresses push/pull_request workflow execution; `--cleanup=verbatim` preserves that whitespace. It does not suppress pull_request_target or workflow_dispatch. The candidate has no pull_request_target workflow.

These define API/CI expectations, not runtime acceptance. Actual tests, browser receipts and explicit gaps are in README.md.
