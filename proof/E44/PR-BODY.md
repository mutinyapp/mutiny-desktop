## E44-v1 — held shared runtime prerequisite

**DRAFT / DO NOT MERGE.** Petie's explicit platform-floor approval is still required (DECISIONS #8). Base: `ec76ff76991bda4173bb8dcc4c35cfadc73b6bc1`.

### Changes
- Pin Electron **44.5.1** in the manifest and synchronize only its npm/pnpm dependency subtrees.
- Minimal Forge seam: locked transitive **node-abi 3.94.0**, resolving ABI **149**. Forge **7.9.0**, rebuild **3.7.2**, fuses **1.8.0** unchanged; no toolchain/config migration.
- Handle Copy Link clipboard promise rejection, with two real-window-module behavioral tests using actual promises.
- Add only `NSAudioCaptureUsageDescription`; change only the signing test's two Electron pin assertions, preserving every security assertion.

### Verified local gates
| Gate | Real exit / result |
|---|---|
| Isolated Electron 38 baseline | 0 — **245/245** tests |
| `pnpm typecheck` | 0 |
| `pnpm test --reporter=default --reporter=json ...` | 0 — **247/247**, 24 files, 0 pending |
| `pnpm lint` | 0 |
| Native-only Electron + node sync/deferred crash probes | both 0; exact **44.5.1**, ABI **149**, current `detached=false` |
| Unsigned scratch `electron-forge package --platform=darwin --arch=x64` | 0; real rebuild/fuses/ASAR/Info.plist readback; package/snapshot deleted |
| Lock-subtree validator + frozen pnpm install | 0; **zero unrelated dependency changes** |
| Fresh npm **10.9.4** `ci --ignore-scripts` | 0; installed Electron/rebuild/node-abi + ABI verified |
| Source-scope/count/log-hash/cleanup acceptance | 0; only contracted product edits, ports 49270–49279 free |

Proof: [`proof/E44/README.md`](proof/E44/README.md), [`RESULTS.json`](proof/E44/RESULTS.json), and full command/JSON receipts under [`proof/E44/receipts`](proof/E44/receipts).

### Baseline fixture diagnosis
The exact same seven signing/notarization failures reproduce on untouched Electron 38 with only TMPDIR under a controlled `type: commonjs` parent. The extensionless ESM fake-tool symlinks return status 0 without executing their bodies on this host. A neutral task-owned profile scratch TMPDIR makes the full original suite pass 245/245, including all 16 signing tests. No test/security repair was made.

Host npm 12.1.0 also rejects both baseline and candidate due to the same pre-existing missing optional peer `encoding`/`iconv-lite`; npm 10.9.4 installs the scoped lockset successfully. Unrelated peer repair intentionally excluded.

### Merge hold / platform floor
Electron 44 requires **macOS 13+**, removes **win32-ia32** / **linux-armv7l**, and requires builder Node **>=22.12.0**. Current build/release matrices require **no target changes**: Ubuntu PR build; Mac arm64 on macos-14 and Windows x64 on windows-latest. Customer macOS 12 support still changes and needs Petie's approval. No workflow edits or dispatches.

### Boundaries and remaining acceptance
- No merge, CI watch, make, real signing/notarization, publishing/release, production, credentials changes, or installed-app launch.
- Proof-only scratch packaging removes the signing hook only in memory/config inside its disposable snapshot; real product signing config unchanged. Product main/preload sources compiled, never launched as an Electron application.
- Local darwin-x64 proof does not establish macOS arm64/Windows/Linux installed runtime, physical voice/capture/TCC, signed notifications, native-addon runtime, updater/rollback, or full T17 application recovery acceptance.
- Screenshots: N/A (runtime prerequisite, no visual change).
- Contract deltas: **none**.
